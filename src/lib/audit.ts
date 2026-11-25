import { run } from "./db";

export async function logEvento(entidad: string, entidadId: number, accion: string, usuario: string, detalle?: string) {
  await run(
    "INSERT INTO EventoAuditoria (entidad, entidadId, accion, usuario, detalle) VALUES ($1, $2, $3, $4, $5)",
    [entidad, entidadId, accion, usuario, detalle || null]
  );
}
