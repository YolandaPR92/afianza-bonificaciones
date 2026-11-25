import { NextRequest, NextResponse } from "next/server";
import { get, run } from "@/lib/db";
import { requireRole, withAuthErrors } from "@/lib/auth";
import { logEvento } from "@/lib/audit";

async function patchHandler(req: NextRequest, { params }: { params: { codigo: string } }) {
  const session = await requireRole(["admin_consultora"]);
  const codigo = params.codigo;
  const body = await req.json();
  const current = await get<any>("SELECT * FROM MotivoRechazo WHERE codigo = $1", [codigo]);
  if (!current) return NextResponse.json({ error: "No encontrado" }, { status: 404 });

  await run(
    "UPDATE MotivoRechazo SET motivo=$1, comoSubsanar=$2, activo=$3, orden=$4 WHERE codigo=$5",
    [
      body.motivo ?? current.motivo,
      body.comoSubsanar ?? current.comoSubsanar,
      body.activo ?? current.activo,
      body.orden ?? current.orden,
      codigo,
    ]
  );
  await logEvento("MotivoRechazo", 0, "editado", session.email, codigo);
  const motivo = await get("SELECT * FROM MotivoRechazo WHERE codigo = $1", [codigo]);
  return NextResponse.json({ motivo });
}

export const PATCH = withAuthErrors(patchHandler);
