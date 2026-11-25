import { NextRequest, NextResponse } from "next/server";
import { get, run } from "@/lib/db";
import { requireRole, withAuthErrors } from "@/lib/auth";
import { logEvento } from "@/lib/audit";

async function patchHandler(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await requireRole(["admin_consultora"]);
  const id = parseInt(params.id);
  const body = await req.json();
  const current = await get<any>("SELECT * FROM Usuario WHERE id = $1", [id]);
  if (!current) return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  if (current.rol !== "tecnico") {
    return NextResponse.json({ error: "Solo se puede modificar la autorización de usuarios con rol técnico" }, { status: 400 });
  }

  const autorizadoEdicion = !!body.autorizadoEdicion;
  await run("UPDATE Usuario SET autorizadoEdicion = $1 WHERE id = $2", [autorizadoEdicion, id]);
  await logEvento(
    "Usuario",
    id,
    autorizadoEdicion ? "autorización de edición concedida" : "autorización de edición revocada",
    session.email
  );

  const usuario = await get<any>(
    "SELECT id, email, rol, clienteId, personaId, autorizadoEdicion, createdAt FROM Usuario WHERE id = $1",
    [id]
  );
  return NextResponse.json({ usuario: { ...usuario, autorizadoEdicion: !!usuario.autorizadoEdicion } });
}

export const PATCH = withAuthErrors(patchHandler);
