"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import TopBar from "@/components/TopBar";
import HistorialModal from "@/components/HistorialModal";
import { fetchMensHistorial } from "@/lib/historial";
import { avisosElegibilidadVinculo } from "@/lib/elegibilidad";

const MESES = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];

function Badge({ estado }: { estado: string }) {
  const map: Record<string, [string, string]> = {
    pendiente: ["badge-pend", "Pendiente de aportar"],
    en_revision: ["badge-rev", "En revisión"],
    validada: ["badge-ok", "Validada"],
    rechazada: ["badge-bad", "Rechazada"],
  };
  const [cls, label] = map[estado] || ["badge-pend", estado];
  return <span className={`badge ${cls}`}>{label}</span>;
}

export default function PersonaDetallePage({ params }: { params: { id: string } }) {
  const personaId = parseInt(params.id);
  const [session, setSession] = useState<any>(null);
  const [persona, setPersona] = useState<any>(null);
  const [vinculos, setVinculos] = useState<any[]>([]);
  const [mensualidades, setMensualidades] = useState<any[]>([]);
  const [historyFor, setHistoryFor] = useState<any[] | null>(null);
  const [editandoAportar, setEditandoAportar] = useState(false);
  const [queDebeAportar, setQueDebeAportar] = useState("");

  async function loadAll() {
    const me = await fetch("/api/auth/me").then((r) => r.json());
    setSession(me.session);
    const [p, v, m] = await Promise.all([
      fetch(`/api/personas/${personaId}`).then((r) => r.json()),
      fetch("/api/vinculos").then((r) => r.json()),
      fetch("/api/mensualidades").then((r) => r.json()),
    ]);
    setPersona(p.persona);
    setQueDebeAportar(p.persona?.queDebeAportar || "");
    setVinculos(v.vinculos.filter((vi: any) => vi.personaId === personaId));
    setMensualidades(m.mensualidades);
  }

  useEffect(() => { loadAll(); }, []); // eslint-disable-line

  async function openMensHistory(mensId: number) {
    setHistoryFor(await fetchMensHistorial(mensId));
  }

  async function guardarQueDebeAportar() {
    const res = await fetch(`/api/personas/${personaId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ queDebeAportar }),
    });
    if (!res.ok) {
      const d = await res.json();
      alert(d.error || "Error al guardar");
      return;
    }
    setEditandoAportar(false);
    await loadAll();
  }

  if (!session || !persona) return <div className="max-w-5xl mx-auto px-7 py-16 text-muted">Cargando…</div>;

  return (
    <div className="max-w-5xl mx-auto px-7 pb-16">
      <TopBar email={session.email} subtitle="Ficha de persona" />
      <Link href="/interno" className="text-sm text-muted underline inline-block mt-3 mb-1">&larr; Volver al panel interno</Link>

      <div className="panel mt-3">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
          <h2 className="font-serif text-2xl">{persona.nombre}</h2>
          {persona.estado === "Baja" ? <span className="badge badge-bad">Baja</span> : <span className="badge badge-ok">Activo</span>}
        </div>
        <div className="grid grid-cols-2 gap-x-8 gap-y-3 text-sm">
          <div><span className="label">Cliente</span>{persona.clienteNombre || "—"}</div>
          <div><span className="label">ID de usuario</span>{persona.idUsuario || "—"}</div>
          <div><span className="label">Puesto</span>{persona.puesto || "—"}</div>
          <div><span className="label">Departamento</span>{persona.departamento || "—"}</div>
          <div><span className="label">Titulación</span>{persona.titulacion || "—"}</div>
          <div><span className="label">Fecha de incorporación</span>{persona.fechaIncorporacion || "—"}</div>
          <div><span className="label">Fecha de alta en bonificación</span>{persona.fechaAltaBonificacion || "—"}</div>
          <div><span className="label">Fecha de baja en bonificación</span>{persona.fechaBajaBonificacion || "—"}</div>
        </div>

        <div className="mt-4 pt-4 border-t border-line">
          <div className="flex items-center justify-between mb-1.5">
            <span className="label">Qué debe aportar <span className="text-muted font-normal">(visible para el cliente)</span></span>
            {!editandoAportar && <button className="btn btn-ghost" onClick={() => setEditandoAportar(true)}>Editar</button>}
          </div>
          {editandoAportar ? (
            <>
              <textarea className="field min-h-[70px]" value={queDebeAportar} onChange={(e) => setQueDebeAportar(e.target.value)} />
              <div className="flex justify-end gap-2 mt-2">
                <button className="btn btn-ghost" onClick={() => { setQueDebeAportar(persona.queDebeAportar || ""); setEditandoAportar(false); }}>Cancelar</button>
                <button className="btn btn-primary" onClick={guardarQueDebeAportar}>Guardar</button>
              </div>
            </>
          ) : (
            <p className="text-sm">{persona.queDebeAportar || "—"}</p>
          )}
        </div>
      </div>

      <h3 className="font-serif text-lg mt-6 mb-3">Proyectos vinculados</h3>
      {vinculos.length === 0 && <div className="text-muted text-sm py-6 text-center">Sin proyectos vinculados.</div>}
      {vinculos.map((v) => {
        const mens = mensualidades
          .filter((m: any) => m.vinculoId === v.id)
          .sort((a: any, b: any) => a.anio - b.anio || a.mes - b.mes);
        return (
          <div key={v.id} className="border border-line rounded-lg mb-4 overflow-hidden">
            <div className="bg-paper px-4 py-3 border-b border-line flex justify-between items-center flex-wrap gap-2">
              <div>
                <span className="font-bold text-sm">{v.proyecto.nombre}</span>{" "}
                <span className="text-xs text-muted font-mono">· {v.proyecto.codigo || "—"}</span>
              </div>
              <div className="text-sm text-muted flex items-center gap-3">
                {v.rol && <span>{v.rol}</span>}
                <span>Dedicación {v.dedicacion ?? "—"}%</span>
                {v.activo ? <span className="badge badge-ok">Activo</span> : <span className="badge badge-bad">Inactivo</span>}
              </div>
            </div>
            {avisosElegibilidadVinculo(v).length > 0 && (
              <div className="px-4 py-2 border-b border-[#EFF1F3] text-sm space-y-0.5">
                {avisosElegibilidadVinculo(v).map((a, i) => (
                  <div key={i} className={a.nivel === "error" ? "text-bad" : "text-pend"}>{a.nivel === "error" ? "❌" : "⚠"} {a.texto}</div>
                ))}
              </div>
            )}
            {mens.length === 0 && <div className="px-4 py-3 text-sm text-muted">Sin mensualidades generadas todavía.</div>}
            {mens.map((m: any) => (
              <button
                key={m.id}
                className="w-full flex items-center justify-between px-4 py-2.5 border-b last:border-0 border-[#EFF1F3] text-sm text-left hover:bg-paper transition-colors"
                onClick={() => openMensHistory(m.id)}
              >
                <span className="font-semibold w-36">{MESES[m.mes - 1]} {m.anio}</span>
                <Badge estado={m.estado} />
              </button>
            ))}
          </div>
        );
      })}

      <HistorialModal historyFor={historyFor} onClose={() => setHistoryFor(null)} />
    </div>
  );
}
