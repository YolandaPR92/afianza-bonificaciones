import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";

const secret = new TextEncoder().encode(process.env.JWT_SECRET || "dev-secret-change-me");
const COOKIE_NAME = "expediente_session";

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const isProtected = pathname.startsWith("/interno") || pathname.startsWith("/portal");
  if (!isProtected) return NextResponse.next();

  const token = req.cookies.get(COOKIE_NAME)?.value;
  if (!token) return NextResponse.redirect(new URL("/login", req.url));

  try {
    const { payload } = await jwtVerify(token, secret);
    const rol = payload.rol as string;
    if (pathname.startsWith("/interno") && !["admin_consultora", "tecnico"].includes(rol)) {
      return NextResponse.redirect(new URL("/portal", req.url));
    }
    if (pathname.startsWith("/portal") && !["admin_cliente", "investigador"].includes(rol)) {
      return NextResponse.redirect(new URL("/interno", req.url));
    }
    return NextResponse.next();
  } catch {
    return NextResponse.redirect(new URL("/login", req.url));
  }
}

export const config = {
  matcher: ["/interno/:path*", "/portal/:path*"],
};
