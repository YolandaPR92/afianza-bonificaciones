import { NextRequest, NextResponse } from "next/server";
import { all, get, run } from "@/lib/db";
import { requireRole, requireSession, ROLES_INTERNOS, withAuthErrors } from "@/lib/auth";
import { logEvento } from "@/lib/audit";
import { bonificadaEnMes, mesesDelEjercicio } from "@/lib/ejercicio";

const MESES = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];

function shapeRow(r: any) {
  return {
    id: r.id, vinculoId: r.vinculoId, mes: r.mes, anio: r.anio, estado: r.estado, ejercicioId: r.ejercicioId,
    vinculo: {
      id: r.vinculoId, personaId: r.personaId, proyectoId: r.proyectoId, dedicacion: r.dedicacion,
      persona: { id: r.personaId, nombre: r.personaNombre, clienteId: r.personaClienteId },
      proyecto: {
        id: r.proyectoId, nombre: r.proyectoNombre, codigo: r.proyectoCodigo,
        cliente: { id: r.proyectoClienteId, nombre: r.clienteNombre, minEvidenciasValidasMes: r.clienteMinEvidenciasValidasMes },
      },
    },
    evidencias: [],
  };
}

async function getHandler(req: NextRequest) {
  const session = await requireSession();
  const sp = req.nextUrl.searchParams;

  let sql = `
    SELECT m.*, v.personaId, v.proyectoId, v.dedicacion,
           p.nombre as personaNombre, p.clienteId as personaClienteId,
           pr.nombre as proyectoNombre, pr.codigo as proyectoCodigo, pr.clienteId as proyectoClienteId,
           c.nombre as clienteNombre, c.minEvidenciasValidasMes as clienteMinEvidenciasValidasMes
    FROM Mensualidad m
    JOIN Vinculo v ON v.id = m.vinculoId
    JOIN Persona p ON p.id = v.personaId
    JOIN Proyecto pr ON pr.id = v.proyectoId
    JOIN Cliente c ON c.id = pr.clienteId
  `;
  const cond: string[] = [];
  const params: any[] = [];

  if (session.rol === "admin_cliente" || session.rol === "investigador") {
    cond.push(`p.clienteId = $${params.length + 1}`);
    params.push(session.clienteId);
    if (session.rol === "investigador") { cond.push(`v.personaId = $${params.length + 1}`); params.push(session.personaId); }
  } else {
    if (sp.get("clienteId")) { cond.push(`p.clienteId = $${params.length + 1}`); params.push(parseInt(sp.get("clienteId")!)); }
    if (sp.get("proyectoId")) { cond.push(`v.proyectoId = $${params.length + 1}`); params.push(parseInt(sp.get("proyectoId")!)); }
    if (sp.get("personaId")) { cond.push(`v.personaId = $${params.length + 1}`); params.push(parseInt(sp.get("personaId")!)); }
  }
  if (sp.get("mes")) { cond.push(`m.mes = $${params.length + 1}`); params.push(parseInt(sp.get("mes")!)); }
  if (sp.get("anio")) { cond.push(`m.anio = $${params.length + 1}`); params.push(parseInt(sp.get("anio")!)); }
  if (sp.get("estado")) { cond.push(`m.estado = $${params.length + 1}`); params.push(sp.get("estado")!); }
  if (sp.get("ejercicioId")) { cond.push(`m.ejercicioId = $${params.length + 1}`); params.push(parseInt(sp.get("ejercicioId")!)); }

  if (cond.length) sql += " WHERE " + cond.join(" AND ");
  sql += " ORDER BY m.anio DESC, m.mes DESC";

  const rows = await all(sql, params);
  const mensualidades = rows.map(shapeRow);

  // Adjuntar la última versión de evidencia (con sus archivos) de cada mensualidad
  for (const m of mensualidades) {
    const ev = await get<any>("SELECT * FROM Evidencia WHERE mensualidadId = $1 ORDER BY version DESC LIMIT 1", [m.id]);
    if (ev) {
      const archivos = await all(
        `SELECT a.*, mr.motivo as motivoTexto, mr.comoSubsanar as motivoComoSubsanar, lp.nombre as lineaProyectoNombre
         FROM Archivo a
         LEFT JOIN MotivoRechazo mr ON mr.codigo = a.motivoCodigo
         LEFT JOIN LineaProyecto lp ON lp.id = a.lineaProyectoId
         WHERE a.evidenciaId = $1`,
        [ev.id]
      );
      m.evidencias = [{ ...ev, checkPeriodo: !!ev.checkPeriodo, checkNombre: !!ev.checkNombre, checkTecnico: !!ev.checkTecnico, archivos }];
    }
  }

  return NextResponse.json({ mensualidades });
}

export const GET = withAuthErrors(getHandler);

// Generación en lote (sección 3): dado un ejercicio, crea la mensualidad pendiente de
// cada vínculo activo para todos sus meses, desde el inicio del ejercicio (o el alta en
// bonificación de la persona si es posterior) hasta el mes actual — nunca de meses
// futuros. El cron mensual (pendiente de la sección 9.6) reutilizará esta misma función
// para crear solo la mensualidad del mes en curso.
async function postHandler(req: NextRequest) {
  const session = await requireRole(ROLES_INTERNOS);
  const body = await req.json();
  const ejercicioId = parseInt(body.ejercicioId);
  if (!ejercicioId) return NextResponse.json({ error: "Ejercicio requerido" }, { status: 400 });

  const ejercicio = await get<any>("SELECT * FROM Ejercicio WHERE id = $1", [ejercicioId]);
  if (!ejercicio) return NextResponse.json({ error: "Ejercicio no encontrado" }, { status: 404 });

  const hoy = new Date();
  const mesActual = { anio: hoy.getFullYear(), mes: hoy.getMonth() + 1 };
  const meses = mesesDelEjercicio(ejercicio.fechaInicio, ejercicio.fechaFin).filter(
    (m) => m.anio < mesActual.anio || (m.anio === mesActual.anio && m.mes <= mesActual.mes)
  );

  const vinculos = await all<any>(
    `SELECT v.*, pr.nombre as proyectoNombre, p.fechaAltaBonificacion, p.fechaBajaBonificacion
     FROM Vinculo v
     JOIN Proyecto pr ON pr.id = v.proyectoId
     JOIN Persona p ON p.id = v.personaId
     WHERE v.activo = true AND p.clienteId = $1`,
    [ejercicio.clienteId]
  );

  let creadas = 0;
  for (const v of vinculos) {
    for (const { mes, anio } of meses) {
      if (!bonificadaEnMes(v.fechaAltaBonificacion, v.fechaBajaBonificacion, anio, mes)) continue;
      const existe = await get("SELECT id FROM Mensualidad WHERE vinculoId=$1 AND mes=$2 AND anio=$3", [v.id, mes, anio]);
      if (existe) continue;
      const res = await run<any>(
        "INSERT INTO Mensualidad (vinculoId, ejercicioId, mes, anio, estado) VALUES ($1, $2, $3, $4, 'pendiente') RETURNING id",
        [v.id, ejercicioId, mes, anio]
      );
      await run("INSERT INTO Notificacion (mensualidadId, tipo, mensaje) VALUES ($1, $2, $3)", [
        res.rows[0].id,
        "pendiente_aportar",
        `Tienes pendiente aportar la evidencia de ${MESES[mes - 1]} ${anio} para el proyecto ${v.proyectoNombre}.`,
      ]);
      creadas++;
    }
  }
  await logEvento("Mensualidad", 0, "generación en lote", session.email, `ejercicio ${ejercicio.nombre}: ${creadas} creadas`);
  return NextResponse.json({ creadas });
}

export const POST = withAuthErrors(postHandler);
