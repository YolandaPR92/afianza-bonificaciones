import { NextRequest, NextResponse } from "next/server";
import { get } from "@/lib/db";
import { requireSession, withAuthErrors } from "@/lib/auth";
import { promises as fs } from "fs";
import path from "path";

const UPLOAD_DIR = path.join(process.cwd(), "uploads");

async function getHandler(req: NextRequest, { params }: { params: { id: string; archivoId: string } }) {
  await requireSession();
  const archivo = await get<any>("SELECT * FROM Archivo WHERE id = $1", [parseInt(params.archivoId)]);
  if (!archivo) return NextResponse.json({ error: "Archivo no encontrado" }, { status: 404 });

  const buffer = await fs.readFile(path.join(UPLOAD_DIR, archivo.ruta));
  return new NextResponse(buffer, {
    headers: {
      "Content-Type": archivo.tipo || "application/octet-stream",
      "Content-Disposition": `attachment; filename="${archivo.nombre}"`,
    },
  });
}

export const GET = withAuthErrors(getHandler);
