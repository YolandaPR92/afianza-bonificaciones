import { NextRequest, NextResponse } from "next/server";
import { get, run } from "@/lib/db";
import { requireEdicionInterna, withAuthErrors } from "@/lib/auth";
import { logEvento } from "@/lib/audit";

async function patchHandler(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await requireEdicionInterna();
  const id = parseInt(params.id);
  const body = await req.json();
  const current = await get<any>("SELECT * FROM Ejercicio WHERE id = $1", [id]);
  if (!current) return NextResponse.json({ error: "No encontrado" }, { status: 404 });

  if (body.estado && !["abierto", "cerrado"].includes(body.estado)) {
    return NextResponse.json({ error: "Estado inválido" }, { status: 400 });
  }

  await run("UPDATE Ejercicio SET nombre=$1, fechaInicio=$2, fechaFin=$3, estado=$4 WHERE id=$5", [
    body.nombre ?? current.nombre,
    body.fechaInicio ?? current.fechaInicio,
    body.fechaFin ?? current.fechaFin,
    body.estado ?? current.estado,
    id,
  ]);
  await logEvento("Ejercicio", id, "editado", session.email);
  const ejercicio = await get("SELECT * FROM Ejercicio WHERE id = $1", [id]);
  return NextResponse.json({ ejercicio });
}

export const PATCH = withAuthErrors(patchHandler);
