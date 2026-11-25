"use client";
import { useRouter } from "next/navigation";

export default function TopBar({ email, subtitle }: { email: string; subtitle: string }) {
  const router = useRouter();
  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }
  return (
    <div className="flex items-center justify-between flex-wrap gap-y-2 py-5 border-b-2 border-ink mb-2">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 bg-steel rounded flex items-center justify-center font-serif font-bold text-white shrink-0">
          A
        </div>
        <div>
          <div className="font-serif font-semibold text-ink text-lg">
            Afianza{" "}
            <span className="text-xs bg-pendbg text-pend border border-[#f0dbb0] rounded px-1.5 py-0.5 uppercase font-bold align-middle">
              Alfa
            </span>
          </div>
          <div className="text-xs text-muted uppercase tracking-wide">Bonificaciones Sociales PI — {subtitle}</div>
        </div>
      </div>
      <div className="flex items-center gap-3 text-sm min-w-0">
        <span className="text-muted truncate max-w-[140px] sm:max-w-none">{email}</span>
        <button className="btn btn-ghost shrink-0" onClick={logout}>
          Cerrar sesión
        </button>
      </div>
    </div>
  );
}
