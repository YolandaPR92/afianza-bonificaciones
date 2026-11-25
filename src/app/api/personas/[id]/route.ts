import { NextRequest, NextResponse } from "next/server";
import { get, run } from "@/lib/db";
import { requireEdicionInterna, requireRole, requireSession, ROLES_INTERNOS, tieneEdicionInterna, withAuthErrors } from "@/lib/auth";
import { logEvento } from "@/lib/audit";

async function getHandler(req: NextRequest, { params }: { params: { id: string } }) {
  await requireRole(ROLES_INTERNOS);
  const id = parseInt(params.id);
  const persona = await get<any>(
    `SELECT p.*, c.nombre as clienteNombre FROM Persona p JOIN Cliente c ON c.id = p.clienteId WHERE p.id = $1`,
    [id]
  );
  if (!persona) return NextResponse.json({ error: "No encontrada" }, { status: 404 });
  return NextResponse.json({ persona });
}

export const GET = withAuthErrors(getHandler);

async function patchHandler(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await requireSession();
  const id = parseInt(params.id);
  const body = await req.json();
  const current = await get<any>("SELECT * FROM Persona WHERE id = $1", [id]);
  if (!current) return NextResponse.json({ error: "No encontrado" }, { status: 404 });

  const isInterno = await tieneEdicionInterna(session);
  if (!isInterno) {
    if (session.rol !== "admin_cliente" || current.clienteId !== session.clienteId) {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }
  }

  if (isInterno) {
    await run(
      `UPDATE Persona SET nombre=$1, idUsuario=$2, puesto=$3, departamento=$4, titulacion=$5, estado=$6,
       fechaIncorporacion=$7, fechaAltaBonificacion=$8, fechaBajaBonificacion=$9, queDebeAportar=$10 WHERE id=$11`,
      [
        body.nombre ?? current.nombre, body.idUsuario ?? current.idUsuario, body.puesto ?? current.puesto,
        body.departamento ?? current.departamento, body.titulacion ?? current.titulacion,
        body.estado ?? current.estado,
        body.fechaIncorporacion ?? current.fechaIncorporacion,
        body.fechaAltaBonificacion ?? current.fechaAltaBonificacion,
        body.fechaBajaBonificacion ?? current.fechaBajaBonificacion,
        body.queDebeAportar ?? current.queDebeAportar,
        id,
      ]
    );
  } else {
    // admin_cliente: solo campos operativos, nunca estado ni fechas de bonificación
    await run("UPDATE Persona SET nombre=$1, idUsuario=$2, departamento=$3, puesto=$4 WHERE id=$5", [
      body.nombre ?? current.nombre, body.idUsuario ?? current.idUsuario,
      body.departamento ?? current.departamento, body.puesto ?? current.puesto, id,
    ]);
  }

  await logEvento("Persona", id, "editada", session.email);
  const persona = await get("SELECT * FROM Persona WHERE id = $1", [id]);
  return NextResponse.json({ persona });
}

export const PATCH = withAuthErrors(patchHandler);

async function deleteHandler(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await requireEdicionInterna();
  const id = parseInt(params.id);
  const current = await get<any>("SELECT * FROM Persona WHERE id = $1", [id]);
  if (!current) return NextResponse.json({ error: "No encontrado" }, { status: 404 });

  const { n: vinculos } = (await get<any>("SELECT COUNT(*) as n FROM Vinculo WHERE personaId = $1", [id]))!;
  const { n: usuarios } = (await get<any>("SELECT COUNT(*) as n FROM Usuario WHERE personaId = $1", [id]))!;
  if (vinculos > 0 || usuarios > 0) {
    const partes: string[] = [];
    if (vinculos > 0) partes.push(`${vinculos} vínculo(s) a proyectos`);
    if (usuarios > 0) partes.push(`${usuarios} cuenta(s) de usuario`);
    return NextResponse.json(
      { error: `No se puede eliminar: tiene ${partes.join(" y ")}. Da de baja la persona en su lugar.` },
      { status: 409 }
    );
  }

  await run("DELETE FROM Persona WHERE id = $1", [id]);
  await logEvento("Persona", id, "eliminada", session.email);
  return NextResponse.json({ ok: true });
}

export const DELETE = withAuthErrors(deleteHandler);
