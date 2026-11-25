import { NextRequest, NextResponse } from "next/server";
import { get, run } from "@/lib/db";
import { requireEdicionInterna, withAuthErrors } from "@/lib/auth";
import { logEvento } from "@/lib/audit";

async function patchHandler(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await requireEdicionInterna();
  const id = parseInt(params.id);
  const body = await req.json();
  const current = await get<any>("SELECT * FROM Vinculo WHERE id = $1", [id]);
  if (!current) return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  await run("UPDATE Vinculo SET rol=$1, dedicacion=$2, activo=$3 WHERE id=$4", [
    body.rol ?? current.rol,
    body.dedicacion !== undefined ? parseInt(body.dedicacion) : current.dedicacion,
    body.activo !== undefined ? !!body.activo : current.activo,
    id,
  ]);
  await logEvento("Vinculo", id, body.activo === false ? "dado de baja" : "editado", session.email);
  const vinculo = await get("SELECT * FROM Vinculo WHERE id = $1", [id]);
  return NextResponse.json({ vinculo });
}

export const PATCH = withAuthErrors(patchHandler);

async function deleteHandler(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await requireEdicionInterna();
  const id = parseInt(params.id);
  const current = await get<any>("SELECT * FROM Vinculo WHERE id = $1", [id]);
  if (!current) return NextResponse.json({ error: "No encontrado" }, { status: 404 });

  const { n: mensualidades } = (await get<any>("SELECT COUNT(*) as n FROM Mensualidad WHERE vinculoId = $1", [id]))!;
  if (mensualidades > 0) {
    return NextResponse.json(
      { error: `No se puede eliminar: tiene ${mensualidades} mensualidad(es) generada(s). Da de baja el vínculo en su lugar.` },
      { status: 409 }
    );
  }

  await run("DELETE FROM Vinculo WHERE id = $1", [id]);
  await logEvento("Vinculo", id, "eliminado", session.email);
  return NextResponse.json({ ok: true });
}

export const DELETE = withAuthErrors(deleteHandler);
