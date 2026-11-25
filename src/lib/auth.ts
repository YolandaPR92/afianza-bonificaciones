import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import type { NextRequest } from "next/server";
import { get } from "@/lib/db";

const COOKIE_NAME = "expediente_session";
const JWT_DEFAULT_SECRET = "dev-secret-change-me";

if (
  process.env.NODE_ENV === "production" &&
  (!process.env.JWT_SECRET || process.env.JWT_SECRET === JWT_DEFAULT_SECRET)
) {
  throw new Error(
    "JWT_SECRET no está configurada (o sigue siendo el valor por defecto de desarrollo). " +
    "Define una variable de entorno JWT_SECRET segura antes de desplegar a producción."
  );
}

const secret = new TextEncoder().encode(process.env.JWT_SECRET || JWT_DEFAULT_SECRET);

export type SessionPayload = {
  userId: number;
  email: string;
  rol: "admin_consultora" | "tecnico" | "admin_cliente" | "investigador";
  clienteId: number | null;
  personaId: number | null;
};

export async function createSessionCookie(payload: SessionPayload) {
  const token = await new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(secret);

  cookies().set(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });
}

export function clearSessionCookie() {
  cookies().delete(COOKIE_NAME);
}

export async function getSession(): Promise<SessionPayload | null> {
  const token = cookies().get(COOKIE_NAME)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret);
    return payload as unknown as SessionPayload;
  } catch {
    return null;
  }
}

/** Server-side guard: throws a Response if the session doesn't match one of the allowed roles. */
export async function requireRole(roles: SessionPayload["rol"][]): Promise<SessionPayload> {
  const session = await getSession();
  if (!session) {
    throw new Response(JSON.stringify({ error: "No autenticado" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }
  if (!roles.includes(session.rol)) {
    throw new Response(JSON.stringify({ error: "No autorizado" }), {
      status: 403,
      headers: { "Content-Type": "application/json" },
    });
  }
  return session;
}

export async function requireSession(): Promise<SessionPayload> {
  const session = await getSession();
  if (!session) {
    throw new Response(JSON.stringify({ error: "No autenticado" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }
  return session;
}

export const ROLES_INTERNOS: SessionPayload["rol"][] = ["admin_consultora", "tecnico"];
export const ROLES_CLIENTE: SessionPayload["rol"][] = ["admin_cliente", "investigador"];

/**
 * Permiso de edición de datos maestros (Cliente/Persona/Proyecto/Vinculo): admin_consultora
 * siempre lo tiene; tecnico solo si su autorizadoEdicion está activo. Se consulta la BD en
 * cada llamada (nunca el valor de la cookie de sesión) para que revocar el permiso se aplique
 * de inmediato, sin esperar a que el usuario vuelva a iniciar sesión.
 */
export async function tieneEdicionInterna(session: SessionPayload): Promise<boolean> {
  if (session.rol === "admin_consultora") return true;
  if (session.rol === "tecnico") {
    const usuario = await get<any>("SELECT autorizadoEdicion FROM Usuario WHERE id = $1", [session.userId]);
    return !!usuario?.autorizadoEdicion;
  }
  return false;
}

/** Server-side guard: throws si el usuario no tiene permiso de edición de datos maestros. */
export async function requireEdicionInterna(): Promise<SessionPayload> {
  const session = await requireSession();
  if (!(await tieneEdicionInterna(session))) {
    throw new Response(JSON.stringify({ error: "No autorizado: no tienes permiso de edición" }), {
      status: 403,
      headers: { "Content-Type": "application/json" },
    });
  }
  return session;
}

type RouteHandler<T = any> = (req: NextRequest, ctx: T) => Promise<Response> | Response;

/**
 * Next.js App Router treats a thrown Response as an unhandled exception (500), not as the
 * HTTP response it represents. requireRole/requireSession throw Response objects on auth
 * failure, so every route handler that calls them must be wrapped with this to surface the
 * real status code (401/403) instead of a generic 500.
 */
export function withAuthErrors<T = any>(handler: RouteHandler<T>): RouteHandler<T> {
  return async (req, ctx) => {
    try {
      return await handler(req, ctx);
    } catch (err) {
      if (err instanceof Response) return err;
      throw err;
    }
  };
}
