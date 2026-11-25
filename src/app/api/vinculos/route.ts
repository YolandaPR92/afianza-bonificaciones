import { NextRequest, NextResponse } from "next/server";
import { all, get, run } from "@/lib/db";
import { requireEdicionInterna, requireSession, withAuthErrors } from "@/lib/auth";
import { logEvento } from "@/lib/audit";

function shape(rows: any[]) {
  return rows.map((r) => ({
    id: r.id,
    personaId: r.personaId,
    proyectoId: r.proyectoId,
    rol: r.rol,
    dedicacion: r.dedicacion,
    activo: r.activo,
    pctCoordinacion: r.pctCoordinacion,
    pctDespliegues: r.pctDespliegues,
    pctSoporte: r.pctSoporte,
    pctGestion: r.pctGestion,
    pctNoIDi: r.pctNoIDi,
    observacionesFicha: r.observacionesFicha,
    persona: { id: r.personaId, nombre: r.personaNombre, clienteId: r.personaClienteId },
    proyecto: { id: r.proyectoId, nombre: r.proyectoNombre, codigo: r.proyectoCodigo, clienteId: r.proyectoClienteId },
  }));
}

async function getHandler(req: NextRequest) {
  const session = await requireSession();
  let sql = `
    SELECT v.*, p.nombre as personaNombre, p.clienteId as personaClienteId,
           pr.nombre as proyectoNombre, pr.codigo as proyectoCodigo, pr.clienteId as proyectoClienteId
    FROM Vinculo v
    JOIN Persona p ON p.id = v.personaId
    JOIN Proyecto pr ON pr.id = v.proyectoId
  `;
  const conditions: string[] = [];
  const params: any[] = [];
  if (session.rol === "admin_cliente" || session.rol === "investigador") {
    conditions.push(`p.clienteId = $${params.length + 1}`);
    params.push(session.clienteId);
    if (session.rol === "investigador") {
      conditions.push(`v.personaId = $${params.length + 1}`);
      params.push(session.personaId);
    }
  }
  if (conditions.length) sql += " WHERE " + conditions.join(" AND ");
  sql += " ORDER BY v.id ASC";
  const rows = await all(sql, params);
  return NextResponse.json({ vinculos: shape(rows) });
}

export const GET = withAuthErrors(getHandler);

async function postHandler(req: NextRequest) {
  const session = await requireEdicionInterna();
  const body = await req.json();
  if (!body.personaId || !body.proyectoId) {
    return NextResponse.json({ error: "Persona y proyecto requeridos" }, { status: 400 });
  }

  const persona = await get<any>("SELECT clienteId FROM Persona WHERE id = $1", [parseInt(body.personaId)]);
  const proyecto = await get<any>("SELECT clienteId FROM Proyecto WHERE id = $1", [parseInt(body.proyectoId)]);
  if (!persona || !proyecto) {
    return NextResponse.json({ error: "Persona o proyecto no encontrados" }, { status: 400 });
  }
  if (persona.clienteId !== proyecto.clienteId) {
    return NextResponse.json({ error: "La persona y el proyecto deben pertenecer al mismo cliente" }, { status: 400 });
  }

  const res = await run<any>(
    "INSERT INTO Vinculo (personaId, proyectoId, rol, dedicacion) VALUES ($1, $2, $3, $4) RETURNING id",
    [parseInt(body.personaId), parseInt(body.proyectoId), body.rol || null, body.dedicacion ? parseInt(body.dedicacion) : null]
  );
  const id = res.rows[0].id;
  await logEvento("Vinculo", id, "creado", session.email);
  const vinculo = await get("SELECT * FROM Vinculo WHERE id = $1", [id]);
  return NextResponse.json({ vinculo });
}

export const POST = withAuthErrors(postHandler);
