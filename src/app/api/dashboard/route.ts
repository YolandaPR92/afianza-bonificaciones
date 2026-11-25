import { NextResponse } from "next/server";
import { get } from "@/lib/db";
import { requireRole, ROLES_INTERNOS, withAuthErrors } from "@/lib/auth";

async function getHandler() {
  await requireRole(ROLES_INTERNOS);
  const clientes = (await get<any>("SELECT COUNT(*) as n FROM Cliente"))!.n;
  const personas = (await get<any>("SELECT COUNT(*) as n FROM Persona WHERE estado='Activo'"))!.n;
  const proyectosActivos = (await get<any>("SELECT COUNT(*) as n FROM Proyecto WHERE estado='Activo'"))!.n;
  const pendientes = (await get<any>("SELECT COUNT(*) as n FROM Mensualidad WHERE estado='pendiente'"))!.n;
  const enRevision = (await get<any>("SELECT COUNT(*) as n FROM Mensualidad WHERE estado='en_revision'"))!.n;
  const validadas = (await get<any>("SELECT COUNT(*) as n FROM Mensualidad WHERE estado='validada'"))!.n;
  const rechazadas = (await get<any>("SELECT COUNT(*) as n FROM Mensualidad WHERE estado='rechazada'"))!.n;
  return NextResponse.json({ clientes, personas, proyectosActivos, pendientes, enRevision, validadas, rechazadas });
}

export const GET = withAuthErrors(getHandler);
