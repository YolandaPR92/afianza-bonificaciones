import { NextRequest, NextResponse } from "next/server";
import { get, run } from "@/lib/db";
import { requireSession, ROLES_CLIENTE, withAuthErrors } from "@/lib/auth";
import { logEvento } from "@/lib/audit";
import { promises as fs } from "fs";
import path from "path";
import { calcularHashPerceptual } from "@/lib/hashImagen";

const UPLOAD_DIR = path.join(process.cwd(), "uploads");

async function postHandler(req: NextRequest) {
  const session = await requireSession();
  if (!ROLES_CLIENTE.includes(session.rol)) {
    return NextResponse.json({ error: "Solo el cliente puede subir evidencias" }, { status: 403 });
  }

  const form = await req.formData();
  const mensualidadId = parseInt(form.get("mensualidadId") as string);
  const comentario = (form.get("comentario") as string) || "";
  const files = form.getAll("archivos") as File[];

  const mens = await get<any>(
    `SELECT m.*, v.personaId, p.clienteId as personaClienteId
     FROM Mensualidad m JOIN Vinculo v ON v.id=m.vinculoId JOIN Persona p ON p.id=v.personaId
     WHERE m.id = $1`,
    [mensualidadId]
  );
  if (!mens) return NextResponse.json({ error: "Mensualidad no encontrada" }, { status: 404 });
  if (mens.personaClienteId !== session.clienteId) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }
  if (session.rol === "investigador" && mens.personaId !== session.personaId) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const { n: versionesPrevias } = (await get<any>("SELECT COUNT(*) as n FROM Evidencia WHERE mensualidadId = $1", [mensualidadId]))!;

  const insertEv = await run<any>(
    "INSERT INTO Evidencia (mensualidadId, version, subidoPor, comentarioCliente, estado) VALUES ($1, $2, $3, $4, 'en_revision') RETURNING id",
    [mensualidadId, versionesPrevias + 1, session.email, comentario]
  );
  const evidenciaId = Number(insertEv.rows[0].id);

  await fs.mkdir(UPLOAD_DIR, { recursive: true });
  for (const file of files) {
    if (!file || typeof file === "string") continue;
    const buffer = Buffer.from(await file.arrayBuffer());
    const safeName = `${Date.now()}-${file.name}`.replace(/[^a-zA-Z0-9._-]/g, "_");
    await fs.writeFile(path.join(UPLOAD_DIR, safeName), buffer);
    const hashImagen = file.type?.startsWith("image/") ? await calcularHashPerceptual(buffer) : null;
    await run("INSERT INTO Archivo (evidenciaId, nombre, ruta, tipo, tamano, hashImagen) VALUES ($1, $2, $3, $4, $5, $6)", [
      evidenciaId, file.name, safeName, file.type || null, buffer.length, hashImagen,
    ]);
  }

  await run("UPDATE Mensualidad SET estado = 'en_revision' WHERE id = $1", [mensualidadId]);
  await logEvento("Evidencia", evidenciaId, "subida", session.email, `v${versionesPrevias + 1}`);

  return NextResponse.json({ ok: true, evidenciaId });
}

export const POST = withAuthErrors(postHandler);
