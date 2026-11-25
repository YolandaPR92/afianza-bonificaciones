import { NextRequest, NextResponse } from "next/server";
import { all, get, run } from "@/lib/db";
import { requireEdicionInterna, requireSession, withAuthErrors } from "@/lib/auth";
import { logEvento } from "@/lib/audit";
import { fechaLimiteIMV, mesesSolapados } from "@/lib/ejercicio";

async function conDerivados(ejercicio: any): Promise<any> {
  const personas = await all<any>(
    "SELECT fechaAltaBonificacion, fechaBajaBonificacion FROM Persona WHERE clienteId = $1 AND fechaAltaBonificacion IS NOT NULL",
    [ejercicio.clienteId]
  );
  const bonificadas3Meses = personas.filter(
    (p) => mesesSolapados(p.fechaAltaBonificacion, p.fechaBajaBonificacion, ejercicio.fechaInicio, ejercicio.fechaFin) >= 3
  ).length;
  return {
    ...ejercicio,
    fechaLimiteIMV: fechaLimiteIMV(ejercicio.fechaFin),
    requiereIMV: bonificadas3Meses >= 10,
  };
}

async function getHandler(req: NextRequest) {
  const session = await requireSession();
  const clienteIdParam = req.nextUrl.searchParams.get("clienteId");

  let sql = "SELECT * FROM Ejercicio";
  const params: any[] = [];
  if (session.rol === "admin_cliente" || session.rol === "investigador") {
    sql += " WHERE clienteId = $1";
    params.push(session.clienteId);
  } else if (clienteIdParam) {
    sql += " WHERE clienteId = $1";
    params.push(parseInt(clienteIdParam));
  }
  sql += " ORDER BY fechaInicio DESC";
  const ejercicios = await all<any>(sql, params);
  const conDatos = await Promise.all(ejercicios.map(conDerivados));
  return NextResponse.json({ ejercicios: conDatos });
}

export const GET = withAuthErrors(getHandler);

async function postHandler(req: NextRequest) {
  const session = await requireEdicionInterna();
  const body = await req.json();
  const { clienteId, nombre, fechaInicio, fechaFin } = body;
  if (!clienteId || !nombre || !fechaInicio || !fechaFin) {
    return NextResponse.json({ error: "Cliente, nombre, fecha de inicio y fecha de fin son requeridos" }, { status: 400 });
  }
  if (fechaFin < fechaInicio) {
    return NextResponse.json({ error: "La fecha de fin no puede ser anterior a la de inicio" }, { status: 400 });
  }
  const res = await run<any>(
    "INSERT INTO Ejercicio (clienteId, nombre, fechaInicio, fechaFin) VALUES ($1, $2, $3, $4) RETURNING id",
    [parseInt(clienteId), nombre, fechaInicio, fechaFin]
  );
  const id = res.rows[0].id;
  const ejercicio = await get<any>("SELECT * FROM Ejercicio WHERE id = $1", [id]);
  await logEvento("Ejercicio", id, "creado", session.email);
  return NextResponse.json({ ejercicio: await conDerivados(ejercicio) });
}

export const POST = withAuthErrors(postHandler);
