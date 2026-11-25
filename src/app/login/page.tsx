"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) {
      setError(data.error || "Error al iniciar sesión");
      return;
    }
    router.push(data.destino);
    router.refresh();
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="flex items-center gap-3 mb-8">
          <div className="w-9 h-9 bg-steel rounded flex items-center justify-center font-serif font-bold text-white">
            A
          </div>
          <div>
            <div className="font-serif font-semibold text-ink text-lg">
              Afianza <span className="text-[10px] bg-pendbg text-pend border border-[#f0dbb0] rounded px-1.5 py-0.5 uppercase font-bold align-middle">Alfa</span>
            </div>
            <div className="text-xs text-muted uppercase tracking-wide">Bonificaciones Sociales PI — Gestión de evidencias</div>
          </div>
        </div>

        <form onSubmit={submit} className="panel">
          <label className="label">Email</label>
          <input className="field mb-3" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          <label className="label">Contraseña</label>
          <input className="field mb-4" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          {error && <div className="text-bad text-sm mb-3">{error}</div>}
          <button className="btn btn-primary w-full" disabled={loading}>
            {loading ? "Entrando…" : "Entrar"}
          </button>
        </form>

        <div className="text-sm text-muted mt-4 leading-relaxed">
          Credenciales de prueba (datos ficticios) — ver README del proyecto:
          <br />
          admin@consultora.test / admin123 (panel interno)
          <br />
          admin@verdanttech.test / cliente123 (portal cliente)
        </div>
      </div>
    </div>
  );
}
