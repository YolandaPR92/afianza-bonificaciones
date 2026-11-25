"use client";
import { useEffect, useRef, useState } from "react";
import TopBar from "@/components/TopBar";

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

export default function PortalPage() {
  const [session, setSession] = useState<any>(null);
  const [personas, setPersonas] = useState<any[]>([]);
  const [personaId, setPersonaId] = useState<number | null>(null);
  const [vinculos, setVinculos] = useState<any[]>([]);
  const [mensualidades, setMensualidades] = useState<any[]>([]);
  const [uploadFor, setUploadFor] = useState<number | null>(null);
  const [comentario, setComentario] = useState("");
  const [files, setFiles] = useState<FileList | null>(null);
  const [historyFor, setHistoryFor] = useState<any[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [filtroNombre, setFiltroNombre] = useState("");
  const [filtroPuesto, setFiltroPuesto] = useState("");
  const [filtroDepartamento, setFiltroDepartamento] = useState("");
  const [editingPersona, setEditingPersona] = useState(false);

  async function loadAll() {
    const me = await fetch("/api/auth/me").then((r) => r.json());
    setSession(me.session);
    const p = await fetch("/api/personas").then((r) => r.json());
    setPersonas(p.personas);
    const defaultPersona = me.session.rol === "investigador" ? me.session.personaId : p.personas[0]?.id;
    setPersonaId(defaultPersona);
    const v = await fetch("/api/vinculos").then((r) => r.json());
    setVinculos(v.vinculos);
    const m = await fetch("/api/mensualidades").then((r) => r.json());
    setMensualidades(m.mensualidades);
  }

  useEffect(() => {
    loadAll();
  }, []);

  if (!session) return <div className="max-w-5xl mx-auto px-7 py-16 text-muted">Cargando…</div>;

  const misVinculos = vinculos.filter((v) => v.personaId === personaId);
  const personaActual = personas.find((p) => p.id === personaId);

  const puestosUnicos = Array.from(new Set(personas.map((p) => p.puesto).filter(Boolean)));
  const departamentosUnicos = Array.from(new Set(personas.map((p) => p.departamento).filter(Boolean)));
  const personasFiltradas = personas.filter((p) => {
    if (filtroNombre && !p.nombre.toLowerCase().includes(filtroNombre.toLowerCase())) return false;
    if (filtroPuesto && p.puesto !== filtroPuesto) return false;
    if (filtroDepartamento && p.departamento !== filtroDepartamento) return false;
    return true;
  });

  async function openUpload(mensId: number) {
    setUploadFor(mensId);
    setComentario("");
    setFiles(null);
  }

  async function submitUpload() {
    if (!uploadFor) return;
    setBusy(true);
    const fd = new FormData();
    fd.append("mensualidadId", String(uploadFor));
    fd.append("comentario", comentario);
    if (files) Array.from(files).forEach((f) => fd.append("archivos", f));
    const res = await fetch("/api/evidencias", { method: "POST", body: fd });
    setBusy(false);
    if (!res.ok) {
      const d = await res.json();
      alert(d.error || "Error al subir la evidencia");
      return;
    }
    setUploadFor(null);
    await loadAll();
  }

  async function openHistory(mensId: number) {
    const data = await fetch(`/api/mensualidades/${mensId}/evidencias`).then((r) => r.json());
    setHistoryFor(data.evidencias);
  }

  async function addPersona(data: any) {
    const res = await fetch("/api/personas", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
    if (!res.ok) {
      const d = await res.json();
      alert(d.error || "Error al crear la persona");
      throw new Error(d.error || "error");
    }
    await loadAll();
  }

  async function savePersona(id: number, data: any) {
    const res = await fetch(`/api/personas/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
    if (!res.ok) {
      const d = await res.json();
      alert(d.error || "Error al guardar los cambios");
      return;
    }
    setEditingPersona(false);
    await loadAll();
  }

  return (
    <div className="max-w-6xl mx-auto px-7 pb-16">
      <TopBar email={session.email} subtitle="Portal Cliente" />
      <div className="bg-revbg border border-[#c6d5ef] rounded-md px-4 py-2.5 text-sm text-steel my-4">
        Versión alfa — subida de archivos real, sesión real por usuario. Datos de prueba ficticios.
      </div>

      {session.rol === "admin_cliente" && <NuevaPersonaForm onSubmit={addPersona} />}

      {session.rol === "admin_cliente" && (
        <div className="panel">
          <p className="text-sm text-muted mb-3.5">Busca o filtra para elegir qué investigador ver abajo; selecciónalo en el desplegable "Investigador" para consultar o subir sus evidencias.</p>
          <div className="flex gap-2 flex-wrap mb-3.5">
            <input
              className="field w-auto"
              placeholder="Buscar por nombre…"
              value={filtroNombre}
              onChange={(e) => setFiltroNombre(e.target.value)}
            />
            <select className="field w-auto" value={filtroPuesto} onChange={(e) => setFiltroPuesto(e.target.value)}>
              <option value="">Puesto: todos</option>
              {puestosUnicos.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
            <select className="field w-auto" value={filtroDepartamento} onChange={(e) => setFiltroDepartamento(e.target.value)}>
              <option value="">Departamento: todos</option>
              {departamentosUnicos.map((d) => <option key={d} value={d}>{d}</option>)}
            </select>
            <button
              className="btn btn-ghost"
              onClick={() => { setFiltroNombre(""); setFiltroPuesto(""); setFiltroDepartamento(""); }}
            >
              Limpiar filtros
            </button>
          </div>
          <label className="label">Investigador</label>
          <div className="flex gap-2 items-end">
            <select
              className="field max-w-xs"
              value={personaId ?? ""}
              onChange={(e) => { setPersonaId(parseInt(e.target.value)); setEditingPersona(false); }}
            >
              {personasFiltradas.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nombre}
                </option>
              ))}
            </select>
            {personaActual && (
              <button className="btn btn-ghost" onClick={() => setEditingPersona((v) => !v)}>
                {editingPersona ? "Cancelar" : "Editar"}
              </button>
            )}
          </div>
          {editingPersona && personaActual && (
            <EditPersonaForm
              persona={personaActual}
              onSave={(data) => savePersona(personaActual.id, data)}
              onCancel={() => setEditingPersona(false)}
            />
          )}
        </div>
      )}

      <div className="panel">
        {personaActual && (
          <>
            <h2 className="font-serif text-2xl mb-1">{personaActual.nombre}</h2>
            <div className="text-sm text-muted mb-4">{personaActual.puesto}</div>
            {personaActual.queDebeAportar && (
              <div className="bg-pendbg border border-[#f0dbb0] rounded-md px-3.5 py-2.5 mb-4 text-sm leading-relaxed">
                <b className="text-pend">Qué debe aportar:</b> {personaActual.queDebeAportar}
              </div>
            )}
          </>
        )}

        {misVinculos.length > 0 && (
          <p className="text-sm text-muted mb-4">
            Por cada proyecto verás un mes a mes: sube un archivo que demuestre tu trabajo técnico (código, documentación, capturas…) cuando el mes esté "Pendiente de aportar" o "Rechazada", y consulta el estado de los que ya has enviado.
          </p>
        )}

        {misVinculos.length === 0 && <div className="text-muted text-sm py-6 text-center">Sin proyectos vinculados.</div>}

        {misVinculos.map((v) => {
          const mens = mensualidades
            .filter((m) => m.vinculoId === v.id)
            .sort((a: any, b: any) => a.anio - b.anio || a.mes - b.mes);
          return (
            <div key={v.id} className="border border-line rounded-lg mb-4 overflow-hidden">
              <div className="bg-paper px-4 py-3 border-b border-line flex justify-between items-center">
                <div>
                  <span className="font-bold text-sm">{v.proyecto.nombre}</span>{" "}
                  <span className="text-xs text-muted font-mono">· {v.proyecto.codigo}</span>
                </div>
                <span className="text-sm text-muted">Dedicación {v.dedicacion}%</span>
              </div>
              {mens.length === 0 && <div className="px-4 py-3 text-sm text-muted">Sin mensualidades generadas todavía.</div>}
              {mens.map((m: any) => {
                const canUpload = m.estado === "pendiente" || m.estado === "rechazada";
                return (
                  <div key={m.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 border-b last:border-0 border-[#EFF1F3] text-sm">
                    <div className="font-semibold w-full sm:w-36">
                      {MESES[m.mes - 1]} {m.anio}
                    </div>
                    <Badge estado={m.estado} />
                    <div className="flex gap-1.5 flex-wrap">
                      {m.estado === "rechazada" && (
                        <button className="btn btn-ghost" onClick={() => openHistory(m.id)}>Ver motivo</button>
                      )}
                      {canUpload ? (
                        <button className="btn btn-primary" onClick={() => openUpload(m.id)}>
                          {m.estado === "rechazada" ? "Subsanar" : "Subir evidencia"}
                        </button>
                      ) : (
                        <button className="btn btn-ghost" onClick={() => openHistory(m.id)}>
                          Ver detalle
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>

      {/* Modal subir */}
      {uploadFor && (
        <div className="fixed inset-0 bg-[rgba(16,32,58,.45)] flex items-center justify-center z-50" onClick={(e) => e.target === e.currentTarget && setUploadFor(null)}>
          <div className="bg-white rounded-xl w-[480px] max-w-[92vw] p-7 shadow-2xl">
            <h3 className="font-serif text-lg mb-1">Subir evidencia</h3>
            <div className="bg-pendbg border border-[#f0dbb0] rounded-md px-3.5 py-2.5 my-3 text-sm leading-relaxed">
              <b className="text-pend">Para que sea válida debe verse:</b>
              <br />
              1. El mes y año del periodo &nbsp; 2. El nombre completo &nbsp; 3. Contenido técnico realizado
            </div>
            <label className="label">Archivo(s)</label>
            <input className="field mb-3" type="file" multiple onChange={(e) => setFiles(e.target.files)} />
            <label className="label">Comentario</label>
            <textarea className="field min-h-[80px]" value={comentario} onChange={(e) => setComentario(e.target.value)} placeholder="Describe el contenido técnico…" />
            <div className="flex justify-end gap-2 mt-4">
              <button className="btn btn-ghost" onClick={() => setUploadFor(null)}>
                Cancelar
              </button>
              <button className="btn btn-primary" disabled={busy} onClick={submitUpload}>
                {busy ? "Enviando…" : "Enviar a revisión"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal histórico */}
      {historyFor && (
        <div className="fixed inset-0 bg-[rgba(16,32,58,.45)] flex items-center justify-center z-50" onClick={(e) => e.target === e.currentTarget && setHistoryFor(null)}>
          <div className="bg-white rounded-xl w-[520px] max-w-[92vw] p-7 shadow-2xl max-h-[86vh] overflow-auto">
            <h3 className="font-serif text-lg mb-4">Histórico de evidencias</h3>
            {historyFor.length === 0 && <div className="text-muted text-sm">Sin evidencias.</div>}
            {historyFor.map((e) => (
              <div key={e.id} className="border-t border-dashed border-line pt-3 mt-3 first:border-0 first:mt-0 first:pt-0 text-sm">
                <b>Evidencia v{e.version}</b>
                <div className="mt-1 space-y-1.5">
                  {e.archivos.map((a: any) => (
                    <div key={a.id}>
                      <span className="font-mono">{a.nombre}</span>
                      {a.resultado && a.resultado !== "valida" && (
                        <div className="text-muted">
                          {a.motivoCodigo && <div>{a.motivoCodigo} — {a.motivoTexto}</div>}
                          {a.motivoComoSubsanar && <div>Cómo subsanarlo: {a.motivoComoSubsanar}</div>}
                          {a.comentarioCliente && <div>{a.comentarioCliente}</div>}
                        </div>
                      )}
                    </div>
                  ))}
                  {e.archivos.length === 0 && <span className="text-muted">Sin archivos adjuntos</span>}
                </div>
                <div className="text-muted mt-1">{new Date(e.fechaSubida).toLocaleDateString()} · {e.subidoPor}</div>
                {e.estado !== "en_revision" && (
                  <div className={`mt-1 ${e.estado === "validada" ? "text-ok" : "text-bad"}`}>
                    {e.estado === "validada" ? "Validada" : "Rechazada"} — {e.comentarioRevision}
                  </div>
                )}
              </div>
            ))}
            <div className="flex justify-end mt-4">
              <button className="btn btn-ghost" onClick={() => setHistoryFor(null)}>
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function EditPersonaForm({ persona, onSave, onCancel }: { persona: any; onSave: (data: any) => void; onCancel: () => void }) {
  const [nombre, setNombre] = useState(persona.nombre);
  const [puesto, setPuesto] = useState(persona.puesto || "");
  const [departamento, setDepartamento] = useState(persona.departamento || "");
  const [idUsuario, setIdUsuario] = useState(persona.idUsuario || "");

  return (
    <div className="bg-paper border border-line rounded-md p-3.5 mt-3">
      <div className="flex gap-2.5 flex-wrap items-end">
        <label className="flex flex-col gap-1 text-sm text-muted flex-1 min-w-[160px]">
          Nombre completo
          <input className="field" value={nombre} onChange={(e) => setNombre(e.target.value)} />
        </label>
        <label className="flex flex-col gap-1 text-sm text-muted flex-1 min-w-[140px]">
          Puesto
          <input className="field" value={puesto} onChange={(e) => setPuesto(e.target.value)} />
        </label>
        <label className="flex flex-col gap-1 text-sm text-muted flex-1 min-w-[140px]">
          Departamento
          <input className="field" value={departamento} onChange={(e) => setDepartamento(e.target.value)} />
        </label>
        <label className="flex flex-col gap-1 text-sm text-muted flex-1 min-w-[160px]">
          ID de usuario
          <input className="field" value={idUsuario} onChange={(e) => setIdUsuario(e.target.value)} />
        </label>
        <div className="flex gap-2">
          <button className="btn btn-primary" onClick={() => onSave({ nombre, puesto, departamento, idUsuario })}>
            Guardar
          </button>
          <button className="btn btn-ghost" onClick={onCancel}>Cancelar</button>
        </div>
      </div>
    </div>
  );
}

function NuevaPersonaForm({ onSubmit }: { onSubmit: (data: any) => Promise<void> }) {
  const [nombre, setNombre] = useState("");
  const [puesto, setPuesto] = useState("");
  const [departamento, setDepartamento] = useState("");
  const [idUsuario, setIdUsuario] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [saved, setSaved] = useState(false);
  const lockRef = useRef(false);

  async function submit() {
    if (lockRef.current) return;
    if (!nombre.trim()) {
      alert("El nombre completo es obligatorio.");
      return;
    }
    lockRef.current = true;
    setSubmitting(true);
    setSaved(false);
    try {
      await onSubmit({ nombre, puesto, departamento, idUsuario });
      setNombre(""); setPuesto(""); setDepartamento(""); setIdUsuario("");
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch {
      // el propio onSubmit ya informa del error (alert)
    } finally {
      lockRef.current = false;
      setSubmitting(false);
    }
  }

  return (
    <div className="panel">
      <h3 className="font-serif text-base mb-3.5">Añadir investigador</h3>
      <div className="flex gap-2.5 flex-wrap items-end">
        <label className="flex flex-col gap-1 text-sm text-muted flex-1 min-w-[160px]">
          Nombre completo
          <input className="field" value={nombre} onChange={(e) => setNombre(e.target.value)} disabled={submitting} />
        </label>
        <label className="flex flex-col gap-1 text-sm text-muted flex-1 min-w-[140px]">
          Puesto
          <input className="field" value={puesto} onChange={(e) => setPuesto(e.target.value)} disabled={submitting} />
        </label>
        <label className="flex flex-col gap-1 text-sm text-muted flex-1 min-w-[140px]">
          Departamento
          <input className="field" value={departamento} onChange={(e) => setDepartamento(e.target.value)} disabled={submitting} />
        </label>
        <label className="flex flex-col gap-1 text-sm text-muted flex-1 min-w-[160px]">
          ID de usuario
          <input
            className="field"
            placeholder="Vacío = autogenerado"
            value={idUsuario}
            onChange={(e) => setIdUsuario(e.target.value)}
            disabled={submitting}
          />
        </label>
        <div className="flex items-center gap-2">
          <button className="btn btn-primary" onClick={submit} disabled={submitting}>
            {submitting ? "Guardando…" : "Añadir investigador"}
          </button>
          {saved && <span className="text-sm text-ok font-semibold">✓ Guardado</span>}
        </div>
      </div>
    </div>
  );
}
