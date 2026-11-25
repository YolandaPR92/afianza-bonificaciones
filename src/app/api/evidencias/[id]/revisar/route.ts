import { NextRequest, NextResponse } from "next/server";
import { all, get, run } from "@/lib/db";
import { requireRole, ROLES_INTERNOS, withAuthErrors } from "@/lib/auth";
import { logEvento } from "@/lib/audit";

async function postHandler(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await requireRole(ROLES_INTERNOS);
  const id = parseInt(params.id);
  const body = await req.json();
  const { resultado, comentario, checkPeriodo, checkNombre, checkTecnico } = body;

  if (!["validada", "rechazada"].includes(resultado)) {
    return NextResponse.json({ error: "Resultado inválido" }, { status: 400 });
  }
  if (resultado === "rechazada" && !comentario?.trim()) {
    return NextResponse.json({ error: "El rechazo requiere un motivo" }, { status: 400 });
  }
  if (resultado === "validada" && !(checkPeriodo && checkNombre && checkTecnico)) {
    return NextResponse.json({ error: "Los 3 requisitos de validez deben estar marcados para validar" }, { status: 400 });
  }

  const evidencia = await get<any>("SELECT * FROM Evidencia WHERE id = $1", [id]);
  if (!evidencia) return NextResponse.json({ error: "No encontrada" }, { status: 404 });

  if (resultado === "validada") {
    const archivos = await all<any>("SELECT resultado FROM Archivo WHERE evidenciaId = $1", [id]);
    const cliente = await get<any>(
      `SELECT c.minEvidenciasValidasMes FROM Cliente c
       JOIN Proyecto pr ON pr.clienteId = c.id
       JOIN Vinculo v ON v.proyectoId = pr.id
       JOIN Mensualidad m ON m.vinculoId = v.id
       WHERE m.id = $1`,
      [evidencia.mensualidadId]
    );
    const minimo = cliente?.minEvidenciasValidasMes ?? 1;
    const sinRevisar = archivos.filter((a) => !a.resultado).length;
    const validas = archivos.filter((a) => a.resultado === "valida").length;
    if (archivos.length === 0 || sinRevisar > 0) {
      return NextResponse.json({ error: "Quedan archivos sin revisar: revísalos antes de validar" }, { status: 400 });
    }
    if (validas < minimo) {
      return NextResponse.json({ error: `No hay suficientes archivos válidos (mínimo ${minimo} para este cliente)` }, { status: 400 });
    }
  }

  await run(
    `UPDATE Evidencia SET estado=$1, revisadoPor=$2, fechaRevision=NOW(), comentarioRevision=$3,
     checkPeriodo=$4, checkNombre=$5, checkTecnico=$6 WHERE id=$7`,
    [resultado, session.email, comentario || null, !!checkPeriodo, !!checkNombre, !!checkTecnico, id]
  );
  await run("UPDATE Mensualidad SET estado=$1 WHERE id=$2", [resultado, evidencia.mensualidadId]);
  await logEvento("Evidencia", id, resultado, session.email, comentario || "");

  await run("INSERT INTO Notificacion (mensualidadId, tipo, mensaje) VALUES ($1, $2, $3)", [
    evidencia.mensualidadId,
    resultado,
    resultado === "validada" ? "La evidencia ha sido validada correctamente." : `La evidencia ha sido rechazada: ${comentario}`,
  ]);

  const updated = await get("SELECT * FROM Evidencia WHERE id = $1", [id]);
  return NextResponse.json({ evidencia: updated });
}

export const POST = withAuthErrors(postHandler);
