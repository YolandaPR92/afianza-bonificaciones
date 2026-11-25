import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { all, get, run } from "@/lib/db";
import { requireRole, withAuthErrors } from "@/lib/auth";
import { logEvento } from "@/lib/audit";

const ROLES_VALIDOS = ["admin_consultora", "tecnico", "admin_cliente", "investigador"];

async function getHandler(req: NextRequest) {
  await requireRole(["admin_consultora"]);
  const rol = req.nextUrl.searchParams.get("rol");
  let sql = "SELECT id, email, rol, clienteId, personaId, autorizadoEdicion, createdAt FROM Usuario";
  const params: any[] = [];
  if (rol) {
    sql += " WHERE rol = $1";
    params.push(rol);
  }
  sql += " ORDER BY email ASC";
  const rows = await all<any>(sql, params);
  const usuarios = rows.map((u) => ({ ...u, autorizadoEdicion: !!u.autorizadoEdicion }));
  return NextResponse.json({ usuarios });
}

export const GET = withAuthErrors(getHandler);

async function postHandler(req: NextRequest) {
  const session = await requireRole(["admin_consultora"]);
  const body = await req.json();
  const { email, password, rol, clienteId, personaId } = body;

  if (!email || !password || !rol) {
    return NextResponse.json({ error: "Email, contraseña y rol son requeridos" }, { status: 400 });
  }
  if (!ROLES_VALIDOS.includes(rol)) {
    return NextResponse.json({ error: "Rol no válido" }, { status: 400 });
  }

  const passwordHash = await bcrypt.hash(password, 10);
  let res;
  try {
    res = await run<any>(
      `INSERT INTO Usuario (email, passwordHash, rol, clienteId, personaId) VALUES ($1, $2, $3, $4, $5) RETURNING id`,
      [email, passwordHash, rol, clienteId ? parseInt(clienteId) : null, personaId ? parseInt(personaId) : null]
    );
  } catch {
    return NextResponse.json({ error: "Ya existe un usuario con ese email o esa persona" }, { status: 400 });
  }

  const id = res.rows[0].id;
  const usuario = await get(
    "SELECT id, email, rol, clienteId, personaId, createdAt FROM Usuario WHERE id = $1",
    [id]
  );
  await logEvento("Usuario", id, "creado", session.email);
  return NextResponse.json({ usuario });
}

export const POST = withAuthErrors(postHandler);
