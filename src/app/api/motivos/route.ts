import { NextResponse } from "next/server";
import { all } from "@/lib/db";
import { requireRole, ROLES_INTERNOS, withAuthErrors } from "@/lib/auth";

async function getHandler() {
  await requireRole(ROLES_INTERNOS);
  const motivos = await all("SELECT * FROM MotivoRechazo ORDER BY orden ASC");
  return NextResponse.json({ motivos });
}

export const GET = withAuthErrors(getHandler);
