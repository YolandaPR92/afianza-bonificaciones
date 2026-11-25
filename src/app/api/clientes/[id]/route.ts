import { NextRequest, NextResponse } from "next/server";
import { get, run } from "@/lib/db";
import { requireEdicionInterna, withAuthErrors } from "@/lib/auth";
import { logEvento } from "@/lib/audit";

async function patchHandler(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await requireEdicionInterna();
  const id = parseInt(params.id);
  const body = await req.json();
  const current = await get<any>("SELECT * FROM Cliente WHERE id = $1", [id]);
  if (!current) return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  await run("UPDATE Cliente SET nombre=$1, cif=$2, consultorAsignado=$3, estado=$4, minEvidenciasValidasMes=$5 WHERE id=$6", [
    body.nombre ?? current.nombre,
    body.cif ?? current.cif,
    body.consultorAsignado ?? current.consultorAsignado,
    body.estado ?? current.estado,
    body.minEvidenciasValidasMes ?? current.minEvidenciasValidasMes,
    id,
  ]);
  await logEvento("Cliente", id, "editado", session.email);
  const cliente = await get("SELECT * FROM Cliente WHERE id = $1", [id]);
  return NextResponse.json({ cliente });
}

export const PATCH = withAuthErrors(patchHandler);

async function deleteHandler(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await requireEdicionInterna();
  const id = parseInt(params.id);
  const current = await get<any>("SELECT * FROM Cliente WHERE id = $1", [id]);
  if (!current) return NextResponse.json({ error: "No encontrado" }, { status: 404 });

  const { n: personas } = (await get<any>("SELECT COUNT(*) as n FROM Persona WHERE clienteId = $1", [id]))!;
  const { n: proyectos } = (await get<any>("SELECT COUNT(*) as n FROM Proyecto WHERE clienteId = $1", [id]))!;
  const { n: usuarios } = (await get<any>("SELECT COUNT(*) as n FROM Usuario WHERE clienteId = $1", [id]))!;
  if (personas > 0 || proyectos > 0 || usuarios > 0) {
    const partes: string[] = [];
    if (personas > 0) partes.push(`${personas} persona(s)`);
    if (proyectos > 0) partes.push(`${proyectos} proyecto(s)`);
    if (usuarios > 0) partes.push(`${usuarios} cuenta(s) de usuario`);
    return NextResponse.json(
      { error: `No se puede eliminar: tiene ${partes.join(", ")} asociados. Da de baja el cliente en su lugar.` },
      { status: 409 }
    );
  }

  await run("DELETE FROM Cliente WHERE id = $1", [id]);
  await logEvento("Cliente", id, "eliminado", session.email);
  return NextResponse.json({ ok: true });
}

export const DELETE = withAuthErrors(deleteHandler);
