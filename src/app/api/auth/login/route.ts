import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { get } from "@/lib/db";
import { createSessionCookie } from "@/lib/auth";

export async function POST(req: NextRequest) {
  const { email, password } = await req.json();
  if (!email || !password) {
    return NextResponse.json({ error: "Email y contraseña requeridos" }, { status: 400 });
  }

  const user = await get<any>("SELECT * FROM Usuario WHERE email = $1", [email]);
  if (!user) return NextResponse.json({ error: "Credenciales incorrectas" }, { status: 401 });

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) return NextResponse.json({ error: "Credenciales incorrectas" }, { status: 401 });

  await createSessionCookie({
    userId: user.id,
    email: user.email,
    rol: user.rol,
    clienteId: user.clienteId,
    personaId: user.personaId,
  });

  const destino = ["admin_consultora", "tecnico"].includes(user.rol) ? "/interno" : "/portal";
  return NextResponse.json({ ok: true, destino });
}
