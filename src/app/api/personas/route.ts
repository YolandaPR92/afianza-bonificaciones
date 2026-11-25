import { NextRequest, NextResponse } from "next/server";
import { all, get, run } from "@/lib/db";
import { requireSession, tieneEdicionInterna, withAuthErrors } from "@/lib/auth";
import { logEvento } from "@/lib/audit";

async function generarIdUsuario(clienteId: number): Promise<string> {
  const cliente = await get<any>("SELECT nombre FROM Cliente WHERE id = $1", [clienteId]);
  const prefix = (cliente?.nombre || "CLIENTE").toUpperCase().replace(/\s+/g, "");
  const prefixEscaped = prefix.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const existentes = await all<any>("SELECT idUsuario FROM Persona WHERE clienteId = $1", [clienteId]);
  const patron = new RegExp(`^${prefixEscaped}_(\\d+)$`);
  let max = 0;
  for (const e of existentes) {
    const m = patron.exec(e.idUsuario || "");
    if (m) max = Math.max(max, parseInt(m[1]));
  }
  return `${prefix}_${String(max + 1).padStart(2, "0")}`;
}

async function getHandler(req: NextRequest) {
  const session = await requireSession();
  const clienteIdParam = req.nextUrl.searchParams.get("clienteId");

  let sql = "SELECT * FROM Persona";
  const params: any[] = [];
  if (session.rol === "admin_cliente" || session.rol === "investigador") {
    sql += " WHERE clienteId = $1";
    params.push(session.clienteId);
    if (session.rol === "investigador") {
      sql += " AND id = $2";
      params.push(session.personaId);
    }
  } else if (clienteIdParam) {
    sql += " WHERE clienteId = $1";
    params.push(parseInt(clienteIdParam));
  }
  sql += " ORDER BY nombre ASC";
  const personas = await all(sql, params);
  return NextResponse.json({ personas });
}

export const GET = withAuthErrors(getHandler);

async function postHandler(req: NextRequest) {
  const session = await requireSession();
  const isInterno = await tieneEdicionInterna(session);
  const esAdminCliente = session.rol === "admin_cliente";
  if (!isInterno && !esAdminCliente) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const body = await req.json();

  // admin_cliente nunca puede elegir cliente: siempre el suyo propio.
  const clienteId = isInterno ? parseInt(body.clienteId) : session.clienteId!;
  if (!body.nombre || !clienteId) {
    return NextResponse.json({ error: "Nombre y cliente requeridos" }, { status: 400 });
  }

  const idUsuario = body.idUsuario?.trim() || (await generarIdUsuario(clienteId));

  // admin_cliente solo rellena campos básicos; los campos con impacto fiscal
  // (fechas de bonificación) y los de perfil (titulación, incorporación) los
  // completa la consultora después, al revisar el alta.
  const puesto = body.puesto || null;
  const departamento = body.departamento || null;
  const titulacion = isInterno ? (body.titulacion || null) : null;
  const fechaIncorporacion = isInterno ? (body.fechaIncorporacion || null) : null;
  const fechaAltaBonificacion = isInterno ? (body.fechaAltaBonificacion || null) : null;

  const res = await run<any>(
    `INSERT INTO Persona (clienteId, nombre, idUsuario, puesto, departamento, titulacion, fechaIncorporacion, fechaAltaBonificacion)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id`,
    [clienteId, body.nombre, idUsuario, puesto, departamento, titulacion, fechaIncorporacion, fechaAltaBonificacion]
  );
  const id = res.rows[0].id;
  const persona = await get("SELECT * FROM Persona WHERE id = $1", [id]);
  await logEvento("Persona", id, "creada", session.email);
  return NextResponse.json({ persona });
}

export const POST = withAuthErrors(postHandler);
