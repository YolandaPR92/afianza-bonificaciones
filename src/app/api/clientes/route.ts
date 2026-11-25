import { NextRequest, NextResponse } from "next/server";
import { all, get, run } from "@/lib/db";
import { requireEdicionInterna, requireSession, ROLES_INTERNOS, withAuthErrors } from "@/lib/auth";
import { logEvento } from "@/lib/audit";

async function getHandler() {
  const session = await requireSession();
  const clientes = ROLES_INTERNOS.includes(session.rol)
    ? await all("SELECT * FROM Cliente ORDER BY nombre ASC")
    : session.clienteId
      ? await all("SELECT * FROM Cliente WHERE id = $1", [session.clienteId])
      : [];
  return NextResponse.json({ clientes });
}

export const GET = withAuthErrors(getHandler);

async function postHandler(req: NextRequest) {
  const session = await requireEdicionInterna();
  const body = await req.json();
  if (!body.nombre) return NextResponse.json({ error: "Nombre requerido" }, { status: 400 });
  const res = await run<any>(
    "INSERT INTO Cliente (nombre, cif, consultorAsignado) VALUES ($1, $2, $3) RETURNING id",
    [body.nombre, body.cif || null, body.consultorAsignado || null]
  );
  const id = res.rows[0].id;
  const cliente = await get("SELECT * FROM Cliente WHERE id = $1", [id]);
  await logEvento("Cliente", id, "creado", session.email);
  return NextResponse.json({ cliente });
}

export const POST = withAuthErrors(postHandler);
