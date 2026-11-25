import { NextRequest, NextResponse } from "next/server";
import { all, get } from "@/lib/db";
import { requireSession, withAuthErrors } from "@/lib/auth";

async function getHandler(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await requireSession();
  const mensualidadId = parseInt(params.id);

  const mens = await get<any>(
    `SELECT m.*, v.personaId, p.clienteId as personaClienteId
     FROM Mensualidad m JOIN Vinculo v ON v.id=m.vinculoId JOIN Persona p ON p.id=v.personaId
     WHERE m.id = $1`,
    [mensualidadId]
  );
  if (!mens) return NextResponse.json({ error: "No encontrada" }, { status: 404 });
  if ((session.rol === "admin_cliente" || session.rol === "investigador") && mens.personaClienteId !== session.clienteId) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const evidencias = await all<any>("SELECT * FROM Evidencia WHERE mensualidadId = $1 ORDER BY version ASC", [mensualidadId]);
  for (const e of evidencias) {
    e.archivos = await all(
      `SELECT a.*, mr.motivo as motivoTexto, mr.comoSubsanar as motivoComoSubsanar, lp.nombre as lineaProyectoNombre
       FROM Archivo a
       LEFT JOIN MotivoRechazo mr ON mr.codigo = a.motivoCodigo
       LEFT JOIN LineaProyecto lp ON lp.id = a.lineaProyectoId
       WHERE a.evidenciaId = $1`,
      [e.id]
    );
    e.checkPeriodo = !!e.checkPeriodo; e.checkNombre = !!e.checkNombre; e.checkTecnico = !!e.checkTecnico;
  }
  return NextResponse.json({ evidencias });
}

export const GET = withAuthErrors(getHandler);
