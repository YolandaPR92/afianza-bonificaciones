import { NextRequest, NextResponse } from "next/server";
import { all, get, run } from "@/lib/db";
import { requireEdicionInterna, requireSession, withAuthErrors } from "@/lib/auth";
import { logEvento } from "@/lib/audit";

async function getHandler() {
  const session = await requireSession();
  let sql = "SELECT * FROM Proyecto";
  const params: any[] = [];
  if (session.rol === "admin_cliente" || session.rol === "investigador") {
    sql += " WHERE clienteId = $1";
    params.push(session.clienteId);
  }
  sql += " ORDER BY nombre ASC";
  const proyectos = await all(sql, params);
  return NextResponse.json({ proyectos });
}

export const GET = withAuthErrors(getHandler);

async function postHandler(req: NextRequest) {
  const session = await requireEdicionInterna();
  const body = await req.json();
  if (!body.nombre || !body.clienteId) {
    return NextResponse.json({ error: "Nombre y cliente requeridos" }, { status: 400 });
  }
  const res = await run<any>(
    `INSERT INTO Proyecto (clienteId, nombre, codigo, descripcionBreve, descripcionTecnica, tecnologias, fechaInicio)
     VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
    [
      parseInt(body.clienteId), body.nombre, body.codigo || null,
      body.descripcionBreve || null, body.descripcionTecnica || null,
      body.tecnologias || null, body.fechaInicio || null,
    ]
  );
  const id = res.rows[0].id;
  const proyecto = await get("SELECT * FROM Proyecto WHERE id = $1", [id]);
  await logEvento("Proyecto", id, "creado", session.email);
  return NextResponse.json({ proyecto });
}

export const POST = withAuthErrors(postHandler);
