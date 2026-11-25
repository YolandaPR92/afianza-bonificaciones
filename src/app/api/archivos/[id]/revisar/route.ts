import { NextRequest, NextResponse } from "next/server";
import { all, get, run } from "@/lib/db";
import { requireRole, ROLES_INTERNOS, withAuthErrors } from "@/lib/auth";
import { logEvento } from "@/lib/audit";
import { avisoFechaTrabajo } from "@/lib/avisosArchivo";
import { distanciaHamming, UMBRAL_DUPLICADO } from "@/lib/hashImagen";

const RESULTADOS = ["valida", "debil", "no_valida"];
const TIPOS_CONTENIDO = ["pr", "commit", "ticket", "documento", "perfil", "otro"];

async function postHandler(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await requireRole(ROLES_INTERNOS);
  const id = parseInt(params.id);
  const body = await req.json();
  const { resultado, motivoCodigo, comentarioCliente, notaInterna, tipoContenido, lineaProyectoId, fechaTrabajo } = body;

  if (!RESULTADOS.includes(resultado)) {
    return NextResponse.json({ error: "Resultado inválido" }, { status: 400 });
  }
  if (resultado === "no_valida" && !motivoCodigo) {
    return NextResponse.json({ error: "Un archivo no válido requiere un motivo" }, { status: 400 });
  }
  if ((resultado === "no_valida" || resultado === "debil") && !comentarioCliente?.trim()) {
    return NextResponse.json({ error: "Un archivo no válido o débil requiere un comentario para el cliente" }, { status: 400 });
  }
  if (tipoContenido && !TIPOS_CONTENIDO.includes(tipoContenido)) {
    return NextResponse.json({ error: "Tipo de contenido inválido" }, { status: 400 });
  }

  const archivo = await get<any>(
    `SELECT a.*, e.mensualidadId, v.proyectoId, v.personaId, m.mes, m.anio, p.clienteId
     FROM Archivo a
     JOIN Evidencia e ON e.id = a.evidenciaId
     JOIN Mensualidad m ON m.id = e.mensualidadId
     JOIN Vinculo v ON v.id = m.vinculoId
     JOIN Persona p ON p.id = v.personaId
     WHERE a.id = $1`,
    [id]
  );
  if (!archivo) return NextResponse.json({ error: "Archivo no encontrado" }, { status: 404 });

  let lineaProyectoIdFinal: number | null = null;
  if (lineaProyectoId) {
    const linea = await get<any>("SELECT * FROM LineaProyecto WHERE id = $1", [parseInt(lineaProyectoId)]);
    if (!linea || linea.proyectoId !== archivo.proyectoId) {
      return NextResponse.json({ error: "La línea de proyecto no corresponde al proyecto de esta evidencia" }, { status: 400 });
    }
    lineaProyectoIdFinal = linea.id;
  }

  await run(
    `UPDATE Archivo SET resultado=$1, motivoCodigo=$2, comentarioCliente=$3, notaInterna=$4, tipoContenido=$5,
     lineaProyectoId=$6, revisadoPor=$7, revisadoEn=NOW(), fechaTrabajo=$8 WHERE id=$9`,
    [
      resultado,
      resultado === "no_valida" ? motivoCodigo : motivoCodigo || null,
      comentarioCliente || null,
      notaInterna || null,
      tipoContenido || null,
      lineaProyectoIdFinal,
      session.email,
      fechaTrabajo || null,
      id,
    ]
  );
  await logEvento("Archivo", id, resultado, session.email, comentarioCliente || "");

  // Comprobaciones automáticas (sección 7): sugerencias, nunca bloqueos.
  const sugerenciaFecha = avisoFechaTrabajo(fechaTrabajo || null, archivo.mes, archivo.anio);

  let sugerenciaDuplicado: { archivoId: number; nombre: string; personaNombre: string; distancia: number } | null = null;
  if (archivo.hashImagen) {
    const otros = await all<any>(
      `SELECT a.id, a.nombre, a.hashImagen, p.nombre as personaNombre
       FROM Archivo a
       JOIN Evidencia e ON e.id = a.evidenciaId
       JOIN Mensualidad m ON m.id = e.mensualidadId
       JOIN Vinculo v ON v.id = m.vinculoId
       JOIN Persona p ON p.id = v.personaId
       WHERE p.clienteId = $1 AND a.id != $2 AND a.hashImagen IS NOT NULL`,
      [archivo.clienteId, id]
    );
    for (const otro of otros) {
      const distancia = distanciaHamming(archivo.hashImagen, otro.hashImagen);
      if (distancia <= UMBRAL_DUPLICADO) {
        sugerenciaDuplicado = { archivoId: otro.id, nombre: otro.nombre, personaNombre: otro.personaNombre, distancia };
        break;
      }
    }
  }

  const actualizado = await get("SELECT * FROM Archivo WHERE id = $1", [id]);
  return NextResponse.json({ archivo: actualizado, sugerenciaFecha, sugerenciaDuplicado });
}

export const POST = withAuthErrors(postHandler);
