import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";

export default async function Home() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (["admin_consultora", "tecnico"].includes(session.rol)) redirect("/interno");
  redirect("/portal");
}
