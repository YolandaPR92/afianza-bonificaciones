import { NextRequest, NextResponse } from "next/server";
import { get, run } from "@/lib/db";
import { requireEdicionInterna, withAuthErrors } from "@/lib/auth";
import { logEvento } from "@/lib/audit";

async function patchHandler(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await requireEdicionInterna();
  const id = parseInt(params.id);
  const body = await req.json();
  const current = await get<any>("SELECT * FROM Proyecto WHERE id = $1", [id]);
  if (!current) return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  await run(
    `UPDATE Proyecto SET nombre=$1, codigo=$2, descripcionBreve=$3, descripcionTecnica=$4, tecnologias=$5, fechaInicio=$6, estado=$7 WHERE id=$8`,
    [
      body.nombre ?? current.nombre, body.codigo ?? current.codigo,
      body.descripcionBreve ?? current.descripcionBreve, body.descripcionTecnica ?? current.descripcionTecnica,
      body.tecnologias ?? current.tecnologias, body.fechaInicio ?? current.fechaInicio,
      body.estado ?? current.estado, id,
    ]
  );
  await logEvento("Proyecto", id, "editado", session.email);
  const proyecto = await get("SELECT * FROM Proyecto WHERE id = $1", [id]);
  return NextResponse.json({ proyecto });
}

export const PATCH = withAuthErrors(patchHandler);

async function deleteHandler(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await requireEdicionInterna();
  const id = parseInt(params.id);
  const current = await get<any>("SELECT * FROM Proyecto WHERE id = $1", [id]);
  if (!current) return NextResponse.json({ error: "No encontrado" }, { status: 404 });

  const { n: vinculos } = (await get<any>("SELECT COUNT(*) as n FROM Vinculo WHERE proyectoId = $1", [id]))!;
  if (vinculos > 0) {
    return NextResponse.json(
      { error: `No se puede eliminar: tiene ${vinculos} vínculo(s) asociado(s). Da de baja (Finalizar) el proyecto en su lugar.` },
      { status: 409 }
    );
  }

  await run("DELETE FROM Proyecto WHERE id = $1", [id]);
  await logEvento("Proyecto", id, "eliminado", session.email);
  return NextResponse.json({ ok: true });
}

export const DELETE = withAuthErrors(deleteHandler);
