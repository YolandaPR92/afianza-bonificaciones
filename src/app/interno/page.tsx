"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import TopBar from "@/components/TopBar";
import HistorialModal from "@/components/HistorialModal";
import { fetchMensHistorial } from "@/lib/historial";

const MESES = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];
const TABS: [string, string][] = [
  ["maestros", "Datos maestros"],
  ["evidencias", "Revisar evidencias"],
];

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

export default function InternoPage() {
  const [session, setSession] = useState<any>(null);
  const [stats, setStats] = useState<any>(null);
  const [clientes, setClientes] = useState<any[]>([]);
  const [personas, setPersonas] = useState<any[]>([]);
  const [proyectos, setProyectos] = useState<any[]>([]);
  const [vinculos, setVinculos] = useState<any[]>([]);
  const [mensualidades, setMensualidades] = useState<any[]>([]);
  const [filters, setFilters] = useState<any>({ clienteId: "", proyectoId: "", personaId: "", mes: "", anio: "", estado: "", ejercicioId: "" });
  const [reviewId, setReviewId] = useState<number | null>(null);
  const [checks, setChecks] = useState({ periodo: false, nombre: false, tecnico: false });
  const [comentario, setComentario] = useState("");
  const [editing, setEditing] = useState<{ type: string; id: number } | null>(null);
  const [tab, setTab] = useState<string>("maestros");
  const [showMgmt, setShowMgmt] = useState(false);
  const [showRegistry, setShowRegistry] = useState(false);
  const [historyFor, setHistoryFor] = useState<any[] | null>(null);
  const [motivos, setMotivos] = useState<any[]>([]);
  const [ejercicios, setEjercicios] = useState<any[]>([]);
  const [personalClienteId, setPersonalClienteId] = useState("");
  const [registroClienteId, setRegistroClienteId] = useState("");
  const [seleccionPersonaId, setSeleccionPersonaId] = useState("");
  const [seleccionProyectoId, setSeleccionProyectoId] = useState("");
  const [seleccionVinculoId, setSeleccionVinculoId] = useState("");

  async function loadAll() {
    const me = await fetch("/api/auth/me").then((r) => r.json());
    setSession(me.session);
    const [s, c, p, pr, v, mo, ej] = await Promise.all([
      fetch("/api/dashboard").then((r) => r.json()),
      fetch("/api/clientes").then((r) => r.json()),
      fetch("/api/personas").then((r) => r.json()),
      fetch("/api/proyectos").then((r) => r.json()),
      fetch("/api/vinculos").then((r) => r.json()),
      fetch("/api/motivos").then((r) => r.json()),
      fetch("/api/ejercicios").then((r) => r.json()),
    ]);
    setStats(s);
    setClientes(c.clientes);
    setRegistroClienteId((prev) => prev || (c.clientes[0] ? String(c.clientes[0].id) : ""));
    setPersonas(p.personas);
    setProyectos(pr.proyectos);
    setVinculos(v.vinculos);
    setMotivos(mo.motivos || []);
    setEjercicios(ej.ejercicios || []);
    await loadMensualidades();
  }

  async function loadMensualidades(f = filters) {
    const qs = new URLSearchParams();
    Object.entries(f).forEach(([k, val]) => { if (val) qs.set(k, String(val)); });
    const m = await fetch(`/api/mensualidades?${qs.toString()}`).then((r) => r.json());
    setMensualidades(m.mensualidades);
  }

  useEffect(() => { loadAll(); }, []); // eslint-disable-line

  function updateFilter(patch: any) {
    const f = { ...filters, ...patch };
    setFilters(f);
    loadMensualidades(f);
  }

  if (!session || !stats) return <div className="max-w-6xl mx-auto px-7 py-16 text-muted">Cargando…</div>;

  const clientesActivos = clientes.filter((c: any) => c.estado !== "Inactivo");
  const personasDelCliente = personas.filter((p: any) => String(p.clienteId) === registroClienteId);
  const proyectosDelCliente = proyectos.filter((p: any) => String(p.clienteId) === registroClienteId);
  const vinculosDelCliente = vinculos.filter((v: any) => String(v.persona?.clienteId) === registroClienteId);
  const personasCliente = personasDelCliente.filter((p: any) => !seleccionPersonaId || String(p.id) === seleccionPersonaId);
  const proyectosCliente = proyectosDelCliente.filter((p: any) => !seleccionProyectoId || String(p.id) === seleccionProyectoId);
  const vinculosCliente = vinculosDelCliente.filter((v: any) => !seleccionVinculoId || String(v.id) === seleccionVinculoId);
  const hoy = new Date();
  const ejercicioFiltro = filters.ejercicioId ? ejercicios.find((ej: any) => String(ej.id) === filters.ejercicioId) : null;
  const mesesOrdenFiltro = (() => {
    if (!ejercicioFiltro) return [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
    const inicio = parseInt(ejercicioFiltro.fechaInicio.slice(5, 7)) - 1;
    return Array.from({ length: 12 }, (_, i) => (inicio + i) % 12);
  })();
  const mensualidadActual = reviewId ? mensualidades.find((m) => m.id === reviewId) : null;
  const evidenciaActual = mensualidadActual?.evidencias?.[0] ?? null;
  const archivosActual: any[] = evidenciaActual?.archivos ?? [];
  const minRequerido = mensualidadActual?.vinculo?.proyecto?.cliente?.minEvidenciasValidasMes ?? 1;
  const todosRevisados = archivosActual.length > 0 && archivosActual.every((a) => a.resultado);
  const validasCount = archivosActual.filter((a) => a.resultado === "valida").length;
  const debilesCount = archivosActual.filter((a) => a.resultado === "debil").length;
  const cumpleMinimo = validasCount >= minRequerido;
  const esDebil = todosRevisados && !cumpleMinimo && debilesCount > 0;
  const canValidate = checks.periodo && checks.nombre && checks.tecnico && todosRevisados && cumpleMinimo;

  async function openReview(mensId: number) {
    setReviewId(mensId);
    setChecks({ periodo: false, nombre: false, tecnico: false });
    setComentario("");
  }

  async function openMensHistory(mensId: number) {
    setHistoryFor(await fetchMensHistorial(mensId));
  }

  async function revisarArchivo(archivoId: number, data: any) {
    const res = await fetch(`/api/archivos/${archivoId}/revisar`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const d = await res.json();
      alert(d.error);
      return null;
    }
    const resultado = await res.json();
    await loadMensualidades();
    return resultado;
  }

  async function decide(resultado: "validada" | "rechazada") {
    if (!evidenciaActual) return;
    if (resultado === "rechazada" && !comentario.trim()) {
      alert("El rechazo requiere un motivo.");
      return;
    }
    const res = await fetch(`/api/evidencias/${evidenciaActual.id}/revisar`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ resultado, comentario, checkPeriodo: checks.periodo, checkNombre: checks.nombre, checkTecnico: checks.tecnico }),
    });
    if (!res.ok) {
      const d = await res.json();
      alert(d.error);
      return;
    }
    setReviewId(null);
    await loadAll();
  }

  // ---- gestión: altas ----
  async function addCliente(data: any) {
    if (!data.nombre) {
      alert("La razón social es obligatoria.");
      throw new Error("validation");
    }
    const res = await fetch("/api/clientes", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
    if (!res.ok) {
      const d = await res.json();
      alert(d.error || "Error al crear el cliente");
      throw new Error(d.error || "error");
    }
    await loadAll();
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
  async function addProyecto(data: any) {
    const res = await fetch("/api/proyectos", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
    if (!res.ok) {
      const d = await res.json();
      alert(d.error || "Error al crear el proyecto");
      throw new Error(d.error || "error");
    }
    await loadAll();
  }
  async function addEjercicio(data: any) {
    if (!data.nombre || !data.fechaInicio || !data.fechaFin) {
      alert("Nombre, fecha de inicio y fecha de fin son obligatorios.");
      throw new Error("validation");
    }
    const res = await fetch("/api/ejercicios", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
    if (!res.ok) {
      const d = await res.json();
      alert(d.error || "Error al crear el ejercicio");
      throw new Error(d.error || "error");
    }
    await loadAll();
  }
  async function toggleEjercicio(id: number, estado: string) {
    await fetch(`/api/ejercicios/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ estado }) });
    await loadAll();
  }
  async function addVinculo(data: any) {
    const res = await fetch("/api/vinculos", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
    if (!res.ok) {
      const d = await res.json();
      alert(d.error || "Error al crear el vínculo");
      throw new Error(d.error || "error");
    }
    await loadAll();
  }
  async function addUsuario(data: any) {
    const res = await fetch("/api/usuarios", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
    if (!res.ok) {
      const d = await res.json();
      alert(d.error || "Error al crear el usuario");
      return;
    }
    alert("Usuario creado correctamente.");
  }
  async function generarLote(ejercicioId: string) {
    const res = await fetch("/api/mensualidades", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ejercicioId }) });
    if (!res.ok) {
      const d = await res.json();
      alert(d.error || "Error al generar mensualidades");
      return;
    }
    const d = await res.json();
    alert(d.creadas > 0 ? `Se han generado ${d.creadas} mensualidad(es).` : "Ya existían todas las que tocaba generar.");
    await loadAll();
  }

  // ---- registros: editar/baja ----
  async function saveCliente(id: number, data: any) {
    await fetch(`/api/clientes/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
    setEditing(null);
    await loadAll();
  }
  async function savePersona(id: number, data: any) {
    await fetch(`/api/personas/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
    setEditing(null);
    await loadAll();
  }
  async function saveProyecto(id: number, data: any) {
    await fetch(`/api/proyectos/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
    setEditing(null);
    await loadAll();
  }
  async function saveVinculo(id: number, data: any) {
    await fetch(`/api/vinculos/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
    setEditing(null);
    await loadAll();
  }

  function cambiarClienteRegistro(id: string) {
    setRegistroClienteId(id);
    setEditing(null);
    setSeleccionPersonaId("");
    setSeleccionProyectoId("");
    setSeleccionVinculoId("");
  }

  async function eliminarRegistro(url: string, descripcion: string) {
    if (!confirm(`Esta acción no se puede deshacer. ¿Confirmas que quieres eliminar ${descripcion} definitivamente?`)) return;
    const res = await fetch(url, { method: "DELETE" });
    if (!res.ok) {
      const d = await res.json();
      alert(d.error || "Error al eliminar");
      return;
    }
    await loadAll();
  }

  return (
    <div className="max-w-[1400px] mx-auto px-7 pb-16">
      <TopBar email={session.email} subtitle="Panel Interno" />

      <div className="grid grid-cols-7 gap-px bg-line border border-line rounded-lg overflow-hidden mb-5 mt-4">
        {[
          ["Clientes", stats.clientes],
          ["Investigadores", stats.personas],
          ["Proyectos activos", stats.proyectosActivos],
          ["Pend. de aportar", stats.pendientes],
          ["Pend. de revisar", stats.enRevision],
          ["Validadas", stats.validadas],
          ["Rechazadas", stats.rechazadas],
        ].map(([label, n]) => (
          <div key={label as string} className="bg-white px-4 py-4">
            <div className="font-serif text-2xl font-semibold text-ink">{n}</div>
            <div className="text-xs text-muted uppercase tracking-wide mt-0.5">{label}</div>
          </div>
        ))}
      </div>

      {/* PESTAÑAS */}
      <div className="flex gap-1 border-b border-line mb-5">
        {TABS.map(([id, label]) => (
          <button
            key={id}
            className={`px-4 py-2.5 text-sm font-semibold border-b-2 -mb-px transition-colors ${
              tab === id ? "border-accent text-accent" : "border-transparent text-muted hover:text-ink"
            }`}
            onClick={() => setTab(id)}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "maestros" && (
      <>
      {/* GESTIÓN DE DATOS */}
      <details
        className="border border-line rounded-lg mb-3.5"
        open={showMgmt}
        onToggle={(e: any) => { if (e.target === e.currentTarget) setShowMgmt(e.target.open); }}
      >
        <summary className="px-4 py-3 font-semibold text-sm cursor-pointer bg-steel text-white rounded-lg">Gestión de datos (altas)</summary>
        <div className="p-4 space-y-3">
          <details className="border border-line rounded-lg">
            <summary className="px-4 py-2.5 font-semibold text-sm cursor-pointer bg-paper rounded-lg border-l-4 border-accent text-steel">Clientes</summary>
            <div className="p-4">
              <MiniForm
                label="Nuevo cliente"
                fields={[
                  { id: "nombre", label: "Razón social" },
                  { id: "cif", label: "CIF" },
                ]}
                onSubmit={(v) => addCliente(v)} buttonLabel="Añadir cliente"
              />
            </div>
          </details>

          <details className="border border-line rounded-lg">
            <summary className="px-4 py-2.5 font-semibold text-sm cursor-pointer bg-paper rounded-lg border-l-4 border-accent text-steel">Personal y proyectos</summary>
            <div className="p-4 space-y-4">
              <label className="flex flex-col gap-1 text-sm text-muted max-w-xs">
                Cliente
                <select className="field" value={personalClienteId} onChange={(e) => setPersonalClienteId(e.target.value)}>
                  <option value="">—</option>
                  {clientesActivos.map((c: any) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                </select>
              </label>
              <MiniForm
                label="Nueva persona"
                fields={[
                  { id: "nombre", label: "Nombre completo" },
                  { id: "puesto", label: "Puesto" },
                  { id: "idUsuario", label: "ID de usuario", placeholder: "Vacío = autogenerado" },
                  { id: "titulacion", label: "Titulación" },
                  { id: "fechaIncorporacion", label: "Fecha de incorporación", type: "date" },
                  { id: "fechaAltaBonificacion", label: "Fecha de alta en bonificación", type: "date" },
                ]}
                onSubmit={(v) => addPersona({ ...v, clienteId: personalClienteId })} buttonLabel="Añadir persona"
              />
              <MiniForm
                label="Nuevo proyecto"
                fields={[
                  { id: "nombre", label: "Nombre del proyecto" },
                  { id: "codigo", label: "Código" },
                  { id: "descripcionBreve", label: "Descripción breve" },
                  { id: "descripcionTecnica", label: "Descripción técnica" },
                  { id: "tecnologias", label: "Tecnologías" },
                  { id: "fechaInicio", label: "Fecha de inicio", type: "date" },
                ]}
                onSubmit={(v) => addProyecto({ ...v, clienteId: personalClienteId })} buttonLabel="Añadir proyecto"
              />
              <VincularForm clienteId={personalClienteId} personas={personas} proyectos={proyectos} onSubmit={addVinculo} />
              <MiniForm
                label="Nuevo ejercicio fiscal"
                fields={[
                  { id: "nombre", label: "Nombre", placeholder: "p. ej. 2026 o 2026/27" },
                  { id: "fechaInicio", label: "Fecha de inicio", type: "date" },
                  { id: "fechaFin", label: "Fecha de fin", type: "date" },
                ]}
                onSubmit={(v) => addEjercicio({ ...v, clienteId: personalClienteId })} buttonLabel="Añadir ejercicio"
              />
              {personalClienteId && (
                <div>
                  <div className="text-xs uppercase tracking-wide text-muted mb-2">Ejercicios de este cliente</div>
                  {ejercicios.filter((ej: any) => String(ej.clienteId) === personalClienteId).length === 0 && (
                    <div className="text-muted text-sm mb-2">Sin ejercicios creados todavía.</div>
                  )}
                  {ejercicios.filter((ej: any) => String(ej.clienteId) === personalClienteId).map((ej: any) => (
                    <div key={ej.id} className="flex items-center justify-between gap-2 text-sm py-1.5 border-b last:border-0 border-[#EFF1F3]">
                      <div>
                        <b>{ej.nombre}</b> <span className="text-muted">({ej.fechaInicio} — {ej.fechaFin})</span>
                        {ej.requiereIMV && <span className="badge badge-pend ml-1.5">Requiere IMV tipo D</span>}
                        <span className="text-muted ml-1.5">Límite IMV: {ej.fechaLimiteIMV}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`badge ${ej.estado === "cerrado" ? "badge-bad" : "badge-ok"}`}>{ej.estado}</span>
                        <button className="btn btn-ghost" onClick={() => toggleEjercicio(ej.id, ej.estado === "cerrado" ? "abierto" : "cerrado")}>
                          {ej.estado === "cerrado" ? "Reabrir" : "Cerrar"}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </details>

          <details className="border border-line rounded-lg">
            <summary className="px-4 py-2.5 font-semibold text-sm cursor-pointer bg-paper rounded-lg border-l-4 border-accent text-steel">Mensualidades</summary>
            <div className="p-4">
              <div className="bg-paper border border-line rounded-md p-3.5 flex items-end gap-3 flex-wrap">
                <div className="flex-[2] min-w-[220px] text-sm">
                  <b className="text-ink">Generar mensualidades en lote</b>
                  <div className="text-muted">
                    Para el ejercicio elegido, crea la mensualidad pendiente de cada vínculo activo desde su inicio
                    (o el alta en bonificación de la persona, si es posterior) hasta el mes actual. Nunca crea meses futuros.
                  </div>
                </div>
                <LoteForm ejercicios={ejercicios} onSubmit={generarLote} />
              </div>
            </div>
          </details>

          <details className="border border-line rounded-lg">
            <summary className="px-4 py-2.5 font-semibold text-sm cursor-pointer bg-paper rounded-lg border-l-4 border-accent text-steel">Usuarios y permisos</summary>
            <div className="p-4 space-y-4">
              <div className="bg-paper border border-line rounded-md p-3.5">
                <div className="text-sm mb-2"><b className="text-ink">Nuevo usuario</b></div>
                <UsuarioForm clientes={clientesActivos} personas={personas} onSubmit={addUsuario} />
              </div>
              {session.rol === "admin_consultora" && (
                <div className="bg-paper border border-line rounded-md p-3.5">
                  <div className="text-sm mb-2"><b className="text-ink">Autorización de edición (técnicos)</b></div>
                  <div className="text-muted text-sm mb-2">
                    Un técnico solo puede crear/editar/borrar clientes, personas, proyectos y vínculos si está autorizado aquí.
                    Revisar evidencias no se ve afectado.
                  </div>
                  <TecnicosAutorizacion />
                </div>
              )}
            </div>
          </details>
        </div>
      </details>

      {/* REGISTROS EXISTENTES */}
      <details
        className="border border-line rounded-lg mb-5"
        open={showRegistry}
        onToggle={(e: any) => { if (e.target === e.currentTarget) setShowRegistry(e.target.open); }}
      >
        <summary className="px-4 py-3 font-semibold text-sm cursor-pointer bg-steel text-white rounded-lg">Registros existentes (editar / dar de baja)</summary>
        <div className="p-4">
          <div className="text-xs uppercase tracking-wide text-muted mb-2">Clientes</div>
          <table className="table-review mb-5">
            <thead><tr><th>Nombre</th><th>CIF</th><th>Estado</th><th>Mín. válidas/mes</th><th></th></tr></thead>
            <tbody>
              {clientes.map((c: any) => editing?.type === "cliente" && editing.id === c.id ? (
                <EditRowCliente key={c.id} c={c} onSave={(d) => saveCliente(c.id, d)} onCancel={() => setEditing(null)} />
              ) : (
                <tr key={c.id}>
                  <td>{c.nombre}</td>
                  <td className="font-mono text-xs">{c.cif || "—"}</td>
                  <td>{c.estado === "Inactivo" ? <span className="badge badge-bad">Inactivo</span> : <span className="badge badge-ok">Activo</span>}</td>
                  <td className="text-center">{c.minEvidenciasValidasMes ?? 1}</td>
                  <td className="whitespace-nowrap">
                    <button className="btn btn-ghost mr-1.5" onClick={() => setEditing({ type: "cliente", id: c.id })}>Editar</button>
                    <button className="btn btn-ghost mr-1.5" onClick={() => saveCliente(c.id, { estado: c.estado === "Inactivo" ? "Activo" : "Inactivo" })}>
                      {c.estado === "Inactivo" ? "Reactivar" : "Dar de baja"}
                    </button>
                    <button className="btn btn-ghost" onClick={() => eliminarRegistro(`/api/clientes/${c.id}`, `el cliente "${c.nombre}"`)}>Eliminar</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <label className="flex flex-col gap-1 text-sm text-muted mb-4 max-w-xs">
            Cliente
            <select className="field" value={registroClienteId} onChange={(e) => cambiarClienteRegistro(e.target.value)}>
              <option value="">— Selecciona un cliente —</option>
              {clientes.map((c: any) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
            </select>
          </label>

          {!registroClienteId ? (
            <div className="text-muted text-sm py-8 text-center border border-dashed border-line rounded-lg mb-5">
              Selecciona un cliente para ver su personal, proyectos y vínculos.
            </div>
          ) : (
            <>
              <div className="text-xs uppercase tracking-wide text-muted mb-2">Personas</div>
              <select
                className="field mb-2.5 max-w-xs"
                value={seleccionPersonaId}
                onChange={(e) => setSeleccionPersonaId(e.target.value)}
              >
                <option value="">Todas</option>
                {personasDelCliente.map((p: any) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
              </select>
              <div className="overflow-x-auto mb-5">
              <table className="table-review">
                <thead>
                  <tr>
                    <th>Nombre</th><th>ID de usuario</th><th>Puesto</th><th>Titulación</th>
                    <th>F. Incorporación</th><th>F. Alta Bonif.</th><th>F. Baja Bonif.</th><th>Estado</th><th></th>
                  </tr>
                </thead>
                <tbody>
                  {personasCliente.length === 0 && (
                    <tr><td colSpan={9} className="text-center text-muted py-4">Sin personas que coincidan.</td></tr>
                  )}
                  {personasCliente.map((p: any) => editing?.type === "persona" && editing.id === p.id ? (
                    <EditRowPersona key={p.id} p={p} onSave={(d) => savePersona(p.id, d)} onCancel={() => setEditing(null)} />
                  ) : (
                    <tr key={p.id}>
                      <td><Link href={`/interno/personas/${p.id}`} className="underline text-accent">{p.nombre}</Link></td>
                      <td className="font-mono text-xs">{p.idUsuario || "—"}</td>
                      <td>{p.puesto || "—"}</td>
                      <td>{p.titulacion || "—"}</td>
                      <td>{p.fechaIncorporacion || "—"}</td>
                      <td>{p.fechaAltaBonificacion || "—"}</td>
                      <td>{p.fechaBajaBonificacion || "—"}</td>
                      <td>{p.estado === "Baja" ? <span className="badge badge-bad">Baja</span> : <span className="badge badge-ok">Activo</span>}</td>
                      <td className="whitespace-nowrap">
                        <button className="btn btn-ghost mr-1.5" onClick={() => setEditing({ type: "persona", id: p.id })}>Editar</button>
                        <button className="btn btn-ghost mr-1.5" onClick={() => savePersona(p.id, { estado: p.estado === "Baja" ? "Activo" : "Baja" })}>
                          {p.estado === "Baja" ? "Reactivar" : "Dar de baja"}
                        </button>
                        <button className="btn btn-ghost" onClick={() => eliminarRegistro(`/api/personas/${p.id}`, `la persona "${p.nombre}"`)}>Eliminar</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              </div>

              <div className="text-xs uppercase tracking-wide text-muted mb-2">Proyectos</div>
              <select
                className="field mb-2.5 max-w-xs"
                value={seleccionProyectoId}
                onChange={(e) => setSeleccionProyectoId(e.target.value)}
              >
                <option value="">Todos</option>
                {proyectosDelCliente.map((p: any) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
              </select>
              <div className="overflow-x-auto mb-5">
              <table className="table-review">
                <thead>
                  <tr>
                    <th>Nombre</th><th>Código</th><th>Descripción breve</th><th>Descripción técnica</th>
                    <th>Tecnologías</th><th>F. Inicio</th><th>Estado</th><th></th>
                  </tr>
                </thead>
                <tbody>
                  {proyectosCliente.length === 0 && (
                    <tr><td colSpan={8} className="text-center text-muted py-4">Sin proyectos que coincidan.</td></tr>
                  )}
                  {proyectosCliente.map((p: any) => editing?.type === "proyecto" && editing.id === p.id ? (
                    <EditRowProyecto key={p.id} p={p} onSave={(d) => saveProyecto(p.id, d)} onCancel={() => setEditing(null)} />
                  ) : (
                    <tr key={p.id}>
                      <td>{p.nombre}</td>
                      <td className="font-mono text-xs">{p.codigo || "—"}</td>
                      <td>{p.descripcionBreve || "—"}</td>
                      <td>{p.descripcionTecnica || "—"}</td>
                      <td>{p.tecnologias || "—"}</td>
                      <td>{p.fechaInicio || "—"}</td>
                      <td>{p.estado === "Finalizado" ? <span className="badge badge-pend">Finalizado</span> : <span className="badge badge-ok">Activo</span>}</td>
                      <td className="whitespace-nowrap">
                        <button className="btn btn-ghost mr-1.5" onClick={() => setEditing({ type: "proyecto", id: p.id })}>Editar</button>
                        <button className="btn btn-ghost mr-1.5" onClick={() => saveProyecto(p.id, { estado: p.estado === "Finalizado" ? "Activo" : "Finalizado" })}>
                          {p.estado === "Finalizado" ? "Reactivar" : "Finalizar"}
                        </button>
                        <button className="btn btn-ghost" onClick={() => eliminarRegistro(`/api/proyectos/${p.id}`, `el proyecto "${p.nombre}"`)}>Eliminar</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              </div>

              <div className="text-xs uppercase tracking-wide text-muted mb-2">Vínculos persona-proyecto</div>
              <select
                className="field mb-2.5 max-w-xs"
                value={seleccionVinculoId}
                onChange={(e) => setSeleccionVinculoId(e.target.value)}
              >
                <option value="">Todos</option>
                {vinculosDelCliente.map((v: any) => (
                  <option key={v.id} value={v.id}>{v.persona?.nombre} — {v.proyecto?.nombre}</option>
                ))}
              </select>
              <table className="table-review">
                <thead><tr><th>Persona — Proyecto</th><th>Dedicación</th><th>Estado</th><th></th></tr></thead>
                <tbody>
                  {vinculosCliente.length === 0 && (
                    <tr><td colSpan={4} className="text-center text-muted py-4">Sin vínculos que coincidan.</td></tr>
                  )}
                  {vinculosCliente.map((v: any) => editing?.type === "vinculo" && editing.id === v.id ? (
                    <EditRowVinculo key={v.id} v={v} onSave={(d) => saveVinculo(v.id, d)} onCancel={() => setEditing(null)} />
                  ) : (
                    <tr key={v.id}>
                      <td>{v.persona?.nombre} — {v.proyecto?.nombre}</td><td>{v.dedicacion}%</td>
                      <td>{v.activo ? <span className="badge badge-ok">Activo</span> : <span className="badge badge-bad">Inactivo</span>}</td>
                      <td className="whitespace-nowrap">
                        <button className="btn btn-ghost mr-1.5" onClick={() => setEditing({ type: "vinculo", id: v.id })}>Editar</button>
                        <button className="btn btn-ghost mr-1.5" onClick={() => saveVinculo(v.id, { activo: !v.activo })}>
                          {v.activo ? "Dar de baja" : "Reactivar"}
                        </button>
                        <button
                          className="btn btn-ghost"
                          onClick={() => eliminarRegistro(`/api/vinculos/${v.id}`, `el vínculo "${v.persona?.nombre} — ${v.proyecto?.nombre}"`)}
                        >
                          Eliminar
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}
        </div>
      </details>
      </>
      )}

      {tab === "evidencias" && (
      <>
      {/* FILTROS + TABLA DE REVISIÓN */}
      <div className="panel">
        <h3 className="font-serif text-base text-steel mb-3.5">Evidencias — todas las mensualidades</h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 mb-2">
          <label className="label">
            Cliente
            <select className="field" value={filters.clienteId} onChange={(e) => updateFilter({ clienteId: e.target.value })}>
              <option value="">Todos</option>
              {clientes.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
            </select>
          </label>
          <label className="label">
            Proyecto
            <select className="field" value={filters.proyectoId} onChange={(e) => updateFilter({ proyectoId: e.target.value })}>
              <option value="">Todos</option>
              {proyectos.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
            </select>
          </label>
          <label className="label">
            Persona
            <select className="field" value={filters.personaId} onChange={(e) => updateFilter({ personaId: e.target.value })}>
              <option value="">Todas</option>
              {personas.map((p: any) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
            </select>
          </label>
          <label className="label">
            Ejercicio
            <select className="field" value={filters.ejercicioId} onChange={(e) => updateFilter({ ejercicioId: e.target.value })}>
              <option value="">Todos</option>
              {ejercicios.map((ej: any) => <option key={ej.id} value={ej.id}>{ej.nombre}</option>)}
            </select>
          </label>
          <label className="label">
            Mes
            <select className="field" value={filters.mes} onChange={(e) => updateFilter({ mes: e.target.value })}>
              <option value="">Todos</option>
              {mesesOrdenFiltro.map((i) => <option key={i} value={i + 1}>{MESES[i]}</option>)}
            </select>
          </label>
          <label className="label">
            Año
            <select className="field" value={filters.anio} onChange={(e) => updateFilter({ anio: e.target.value })}>
              <option value="">Todos</option>
              {[2025, 2026, 2027].map((a) => <option key={a} value={a}>{a}</option>)}
            </select>
          </label>
          <label className="label">
            Estado
            <select className="field" value={filters.estado} onChange={(e) => updateFilter({ estado: e.target.value })}>
              <option value="">Todos</option>
              <option value="pendiente">Pendiente de aportar</option>
              <option value="en_revision">En revisión</option>
              <option value="validada">Validada</option>
              <option value="rechazada">Rechazada</option>
            </select>
          </label>
        </div>
        <div className="mb-3.5">
          <button className="btn btn-ghost" onClick={() => updateFilter({ clienteId: "", proyectoId: "", personaId: "", mes: "", anio: "", estado: "", ejercicioId: "" })}>Limpiar filtros</button>
        </div>

        <table className="table-review">
          <thead><tr><th>Cliente</th><th>Persona</th><th>Proyecto</th><th>Mes</th><th>Estado</th><th></th></tr></thead>
          <tbody>
            {mensualidades.length === 0 && <tr><td colSpan={6} className="text-center text-muted py-6">Ninguna mensualidad coincide con los filtros.</td></tr>}
            {mensualidades.map((m: any) => {
              const mesPasado = m.anio < hoy.getFullYear() || (m.anio === hoy.getFullYear() && m.mes < hoy.getMonth() + 1);
              const sinEvidenciaM9 = m.estado === "pendiente" && (!m.evidencias || m.evidencias.length === 0) && mesPasado;
              return (
              <tr key={m.id}>
                <td>{m.vinculo.proyecto.cliente.nombre}</td>
                <td>{m.vinculo.persona.nombre}</td>
                <td>{m.vinculo.proyecto.nombre}</td>
                <td>{MESES[m.mes - 1]} {m.anio}</td>
                <td>
                  <Badge estado={m.estado} />
                  {sinEvidenciaM9 && <span className="badge badge-bad ml-1" title="Sugerencia M9: mes cerrado sin ninguna evidencia">M9</span>}
                </td>
                <td>
                  {m.estado === "en_revision" ? (
                    <button className="btn btn-primary" onClick={() => openReview(m.id)}>Revisar</button>
                  ) : (
                    <button className="btn btn-ghost" onClick={() => openMensHistory(m.id)}>Ver histórico</button>
                  )}
                </td>
              </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      </>
      )}

      {/* MODAL REVISAR */}
      {reviewId && evidenciaActual && (
        <div className="fixed inset-0 bg-[rgba(16,32,58,.45)] flex items-center justify-center z-50" onClick={(e) => e.target === e.currentTarget && setReviewId(null)}>
          <div className="bg-white rounded-xl w-[500px] max-w-[92vw] p-7 shadow-2xl max-h-[88vh] overflow-auto">
            <h3 className="font-serif text-lg text-steel mb-1">Revisar evidencia</h3>
            <div className="text-sm text-muted mb-3">
              {mensualidades.find((m) => m.id === reviewId)?.vinculo.persona.nombre} — v{evidenciaActual.version}
            </div>
            <p className="text-sm mb-2">{evidenciaActual.comentarioCliente}</p>

            <div className="text-xs font-bold text-muted uppercase mb-1.5">
              Revisión por archivo (mínimo {minRequerido} válida{minRequerido === 1 ? "" : "s"} para este cliente)
            </div>
            {archivosActual.length === 0 && <div className="text-muted text-sm mb-2">Sin archivos adjuntos.</div>}
            {archivosActual.map((a: any) => (
              <RevisarArchivoRow
                key={a.id}
                archivo={a}
                evidenciaId={evidenciaActual.id}
                motivos={motivos}
                onSave={(data) => revisarArchivo(a.id, data)}
              />
            ))}
            {esDebil && (
              <div className="bg-pendbg border border-[#f0dbb0] rounded-md px-3.5 py-2 my-2 text-sm text-pend">
                Débil: no hay suficientes archivos válidos ({validasCount}/{minRequerido}), pero hay al menos uno marcado como débil.
              </div>
            )}

            <div className="bg-paper border border-line rounded-md p-3.5 my-3">
              <div className="text-xs font-bold text-muted uppercase mb-2">Checklist de validez (los 3 deben cumplirse para validar, además de la revisión por archivo)</div>
              {[["periodo", "Se ve el mes y año del periodo"], ["nombre", "Se ve el nombre completo de la persona"], ["tecnico", "Se ve contenido técnico del trabajo realizado"]].map(([k, label]) => (
                <label key={k} className="flex items-center gap-2 text-sm py-1 cursor-pointer">
                  <input type="checkbox" checked={(checks as any)[k]} onChange={(e) => setChecks({ ...checks, [k]: e.target.checked })} />
                  {label}
                </label>
              ))}
            </div>
            <textarea className="field min-h-[80px]" placeholder="Motivo del rechazo (obligatorio) o comentario de validación…" value={comentario} onChange={(e) => setComentario(e.target.value)} />
            <div className="flex justify-end gap-2 mt-4">
              <button className="btn" style={{ borderColor: "#B5473A", color: "#B5473A" }} onClick={() => decide("rechazada")}>Rechazar</button>
              <button
                className="btn btn-primary"
                style={{ background: canValidate ? "#3F9A68" : undefined, borderColor: "#3F9A68" }}
                disabled={!canValidate}
                title={!todosRevisados ? "Revisa todos los archivos primero" : !cumpleMinimo ? `Faltan archivos válidos (mínimo ${minRequerido})` : undefined}
                onClick={() => decide("validada")}
              >
                Validar
              </button>
            </div>
          </div>
        </div>
      )}

      <HistorialModal historyFor={historyFor} onClose={() => setHistoryFor(null)} />
    </div>
  );
}

const TIPOS_CONTENIDO = [["pr", "PR"], ["commit", "Commit"], ["ticket", "Ticket"], ["documento", "Documento"], ["perfil", "Perfil"], ["otro", "Otro"]];

function RevisarArchivoRow({ archivo, evidenciaId, motivos, onSave }: any) {
  const [resultado, setResultado] = useState(archivo.resultado || "");
  const [motivoCodigo, setMotivoCodigo] = useState(archivo.motivoCodigo || "");
  const [comentarioCliente, setComentarioCliente] = useState(archivo.comentarioCliente || "");
  const [notaInterna, setNotaInterna] = useState(archivo.notaInterna || "");
  const [tipoContenido, setTipoContenido] = useState(archivo.tipoContenido || "");
  const [fechaTrabajo, setFechaTrabajo] = useState(archivo.fechaTrabajo || "");
  const [submitting, setSubmitting] = useState(false);
  const [sugerencias, setSugerencias] = useState<any>(null);

  const dirty = resultado !== (archivo.resultado || "")
    || motivoCodigo !== (archivo.motivoCodigo || "")
    || comentarioCliente !== (archivo.comentarioCliente || "")
    || notaInterna !== (archivo.notaInterna || "")
    || tipoContenido !== (archivo.tipoContenido || "")
    || fechaTrabajo !== (archivo.fechaTrabajo || "");

  async function guardar() {
    if (!resultado) { alert("Elige un resultado para el archivo."); return; }
    if (resultado === "no_valida" && !motivoCodigo) { alert("Un archivo no válido requiere un motivo."); return; }
    if ((resultado === "no_valida" || resultado === "debil") && !comentarioCliente.trim()) {
      alert("Un archivo no válido o débil requiere un comentario para el cliente.");
      return;
    }
    setSubmitting(true);
    try {
      const r = await onSave({ resultado, motivoCodigo: motivoCodigo || null, comentarioCliente, notaInterna, tipoContenido: tipoContenido || null, fechaTrabajo: fechaTrabajo || null });
      setSugerencias(r ? { fecha: r.sugerenciaFecha, duplicado: r.sugerenciaDuplicado } : null);
    } finally {
      setSubmitting(false);
    }
  }

  const badge = resultado === "valida" ? "badge-ok" : resultado === "debil" ? "badge-pend" : resultado === "no_valida" ? "badge-bad" : "badge-pend";
  const badgeLabel = resultado === "valida" ? "Válida" : resultado === "debil" ? "Débil" : resultado === "no_valida" ? "No válida" : "Sin revisar";

  return (
    <div className="border border-line rounded-md p-3 mb-2">
      <div className="flex items-center justify-between gap-2 flex-wrap mb-2">
        <a className="underline text-sm font-mono" href={`/api/evidencias/${evidenciaId}/archivo/${archivo.id}`} target="_blank">📄 {archivo.nombre}</a>
        <span className={`badge ${badge}`}>{badgeLabel}</span>
      </div>
      <div className="flex gap-2 flex-wrap items-end mb-2">
        <label className="flex flex-col gap-1 text-xs text-muted">
          Resultado
          <select className="field" value={resultado} onChange={(e) => setResultado(e.target.value)} disabled={submitting}>
            <option value="">—</option>
            <option value="valida">Válida</option>
            <option value="debil">Débil</option>
            <option value="no_valida">No válida</option>
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs text-muted">
          Tipo
          <select className="field" value={tipoContenido} onChange={(e) => setTipoContenido(e.target.value)} disabled={submitting}>
            <option value="">—</option>
            {TIPOS_CONTENIDO.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs text-muted">
          Fecha del trabajo
          <input className="field" type="date" value={fechaTrabajo} onChange={(e) => setFechaTrabajo(e.target.value)} disabled={submitting} />
        </label>
        {(resultado === "no_valida" || resultado === "debil") && (
          <label className="flex flex-col gap-1 text-xs text-muted flex-1 min-w-[180px]">
            Motivo{resultado === "no_valida" ? " (obligatorio)" : " (opcional)"}
            <select className="field" value={motivoCodigo} onChange={(e) => setMotivoCodigo(e.target.value)} disabled={submitting}>
              <option value="">—</option>
              {motivos.filter((m: any) => m.activo).map((m: any) => <option key={m.codigo} value={m.codigo}>{m.codigo} — {m.motivo}</option>)}
            </select>
          </label>
        )}
      </div>
      {(resultado === "no_valida" || resultado === "debil") && (
        <textarea
          className="field min-h-[50px] mb-2"
          placeholder="Comentario para el cliente (obligatorio)…"
          value={comentarioCliente}
          onChange={(e) => setComentarioCliente(e.target.value)}
          disabled={submitting}
        />
      )}
      <textarea
        className="field min-h-[40px] mb-2"
        placeholder="Nota interna (solo la ve la consultora)…"
        value={notaInterna}
        onChange={(e) => setNotaInterna(e.target.value)}
        disabled={submitting}
      />
      {sugerencias?.fecha && <div className="text-pend text-sm mb-1.5">⚠ Sugerencia: {sugerencias.fecha}</div>}
      {sugerencias?.duplicado && (
        <div className="text-pend text-sm mb-1.5">
          ⚠ Sugerencia M7: posible duplicado de "{sugerencias.duplicado.nombre}" ({sugerencias.duplicado.personaNombre}, distancia {sugerencias.duplicado.distancia})
        </div>
      )}
      <div className="flex justify-end">
        <button className="btn btn-ghost" onClick={guardar} disabled={submitting || !dirty}>
          {submitting ? "Guardando…" : "Guardar revisión"}
        </button>
      </div>
    </div>
  );
}

function MiniForm({ label, fields, onSubmit, buttonLabel }: any) {
  const emptyValues = () => Object.fromEntries(fields.map((f: any) => [f.id, f.default || ""]));
  const [values, setValues] = useState<any>(emptyValues);
  const [submitting, setSubmitting] = useState(false);
  const [saved, setSaved] = useState(false);
  const lockRef = useRef(false);

  async function submit() {
    // guardia síncrona en un ref: bloquea aunque lleguen varios clicks antes
    // de que React re-renderice y refleje `disabled` en el botón.
    if (lockRef.current) return;
    lockRef.current = true;
    setSubmitting(true);
    setSaved(false);
    try {
      await onSubmit(values);
      setValues(emptyValues());
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch {
      // el propio onSubmit ya informa del error (alert); no limpiamos el formulario
    } finally {
      lockRef.current = false;
      setSubmitting(false);
    }
  }

  return (
    <div className={`flex gap-2.5 flex-wrap items-end p-2 -m-2 rounded-md transition-colors duration-500 ${saved ? "bg-[#e7f5ee]" : ""}`}>
      {fields.map((f: any) => (
        <label key={f.id} className="flex flex-col gap-1 text-sm text-muted flex-1 min-w-[140px]">
          {f.label}
          {f.type === "select" ? (
            <select
              className="field"
              value={values[f.id]}
              onChange={(e) => setValues({ ...values, [f.id]: e.target.value })}
              disabled={submitting}
            >
              <option value="">—</option>
              {f.options.map(([v, l]: any) => <option key={v} value={v}>{l}</option>)}
            </select>
          ) : (
            <input
              className="field"
              type={f.type || "text"}
              value={values[f.id]}
              onChange={(e) => setValues({ ...values, [f.id]: e.target.value })}
              disabled={submitting}
              placeholder={f.placeholder}
            />
          )}
        </label>
      ))}
      <div className="flex items-center gap-2">
        <button className="btn" onClick={submit} disabled={submitting}>{submitting ? "Guardando…" : buttonLabel}</button>
        {saved && <span className="text-sm text-ok font-semibold">✓ Guardado</span>}
      </div>
    </div>
  );
}

function LoteForm({ ejercicios, onSubmit }: { ejercicios: any[]; onSubmit: (ejercicioId: string) => void }) {
  const [ejercicioId, setEjercicioId] = useState("");
  return (
    <div className="flex gap-2 items-end">
      <label className="flex flex-col gap-1 text-sm text-muted min-w-[220px]">
        Ejercicio
        <select className="field" value={ejercicioId} onChange={(e) => setEjercicioId(e.target.value)}>
          <option value="">—</option>
          {ejercicios.map((ej: any) => <option key={ej.id} value={ej.id}>{ej.nombre}</option>)}
        </select>
      </label>
      <button
        className="btn btn-primary"
        disabled={!ejercicioId}
        onClick={() => onSubmit(ejercicioId)}
      >
        Generar mensualidades pendientes
      </button>
    </div>
  );
}

function EditRowCliente({ c, onSave, onCancel }: any) {
  const [nombre, setNombre] = useState(c.nombre);
  const [cif, setCif] = useState(c.cif || "");
  const [estado, setEstado] = useState(c.estado);
  const [minEvidenciasValidasMes, setMinEvidenciasValidasMes] = useState(c.minEvidenciasValidasMes ?? 1);
  return (
    <tr>
      <td><input className="field" value={nombre} onChange={(e) => setNombre(e.target.value)} /></td>
      <td><input className="field" value={cif} onChange={(e) => setCif(e.target.value)} /></td>
      <td>
        <select className="field" value={estado} onChange={(e) => setEstado(e.target.value)}>
          <option value="Activo">Activo</option><option value="Inactivo">Inactivo</option>
        </select>
      </td>
      <td>
        <input
          className="field w-16"
          type="number"
          min={1}
          value={minEvidenciasValidasMes}
          onChange={(e) => setMinEvidenciasValidasMes(parseInt(e.target.value) || 1)}
          title="Mínimo de archivos válidos por mes para validar"
        />
      </td>
      <td className="whitespace-nowrap">
        <button className="btn btn-primary mr-1.5" onClick={() => onSave({ nombre, cif, estado, minEvidenciasValidasMes })}>Guardar</button>
        <button className="btn btn-ghost" onClick={onCancel}>Cancelar</button>
      </td>
    </tr>
  );
}
function EditRowPersona({ p, onSave, onCancel }: any) {
  const [nombre, setNombre] = useState(p.nombre);
  const [idUsuario, setIdUsuario] = useState(p.idUsuario || "");
  const [puesto, setPuesto] = useState(p.puesto || "");
  const [titulacion, setTitulacion] = useState(p.titulacion || "");
  const [fechaIncorporacion, setFechaIncorporacion] = useState(p.fechaIncorporacion || "");
  const [fechaAltaBonificacion, setFechaAltaBonificacion] = useState(p.fechaAltaBonificacion || "");
  const [fechaBajaBonificacion, setFechaBajaBonificacion] = useState(p.fechaBajaBonificacion || "");
  const [estado, setEstado] = useState(p.estado);
  return (
    <tr>
      <td><input className="field" value={nombre} onChange={(e) => setNombre(e.target.value)} /></td>
      <td><input className="field" value={idUsuario} onChange={(e) => setIdUsuario(e.target.value)} /></td>
      <td><input className="field" value={puesto} onChange={(e) => setPuesto(e.target.value)} /></td>
      <td><input className="field" value={titulacion} onChange={(e) => setTitulacion(e.target.value)} /></td>
      <td><input className="field" type="date" value={fechaIncorporacion} onChange={(e) => setFechaIncorporacion(e.target.value)} /></td>
      <td><input className="field" type="date" value={fechaAltaBonificacion} onChange={(e) => setFechaAltaBonificacion(e.target.value)} /></td>
      <td><input className="field" type="date" value={fechaBajaBonificacion} onChange={(e) => setFechaBajaBonificacion(e.target.value)} /></td>
      <td>
        <select className="field" value={estado} onChange={(e) => setEstado(e.target.value)}>
          <option value="Activo">Activo</option><option value="Baja">Baja</option>
        </select>
      </td>
      <td className="whitespace-nowrap">
        <button
          className="btn btn-primary mr-1.5"
          onClick={() => onSave({ nombre, idUsuario, puesto, titulacion, fechaIncorporacion, fechaAltaBonificacion, fechaBajaBonificacion, estado })}
        >
          Guardar
        </button>
        <button className="btn btn-ghost" onClick={onCancel}>Cancelar</button>
      </td>
    </tr>
  );
}
function EditRowProyecto({ p, onSave, onCancel }: any) {
  const [nombre, setNombre] = useState(p.nombre);
  const [codigo, setCodigo] = useState(p.codigo || "");
  const [descripcionBreve, setDescripcionBreve] = useState(p.descripcionBreve || "");
  const [descripcionTecnica, setDescripcionTecnica] = useState(p.descripcionTecnica || "");
  const [tecnologias, setTecnologias] = useState(p.tecnologias || "");
  const [fechaInicio, setFechaInicio] = useState(p.fechaInicio || "");
  const [estado, setEstado] = useState(p.estado);
  return (
    <tr>
      <td><input className="field" value={nombre} onChange={(e) => setNombre(e.target.value)} /></td>
      <td><input className="field" value={codigo} onChange={(e) => setCodigo(e.target.value)} /></td>
      <td><input className="field" value={descripcionBreve} onChange={(e) => setDescripcionBreve(e.target.value)} /></td>
      <td><input className="field" value={descripcionTecnica} onChange={(e) => setDescripcionTecnica(e.target.value)} /></td>
      <td><input className="field" value={tecnologias} onChange={(e) => setTecnologias(e.target.value)} /></td>
      <td><input className="field" type="date" value={fechaInicio} onChange={(e) => setFechaInicio(e.target.value)} /></td>
      <td>
        <select className="field" value={estado} onChange={(e) => setEstado(e.target.value)}>
          <option value="Activo">Activo</option><option value="Finalizado">Finalizado</option>
        </select>
      </td>
      <td className="whitespace-nowrap">
        <button
          className="btn btn-primary mr-1.5"
          onClick={() => onSave({ nombre, codigo, descripcionBreve, descripcionTecnica, tecnologias, fechaInicio, estado })}
        >
          Guardar
        </button>
        <button className="btn btn-ghost" onClick={onCancel}>Cancelar</button>
      </td>
    </tr>
  );
}

function TecnicosAutorizacion() {
  const [tecnicos, setTecnicos] = useState<any[] | null>(null);

  async function load() {
    const data = await fetch("/api/usuarios?rol=tecnico").then((r) => r.json());
    setTecnicos(data.usuarios);
  }

  useEffect(() => { load(); }, []); // eslint-disable-line

  async function toggle(id: number, valor: boolean) {
    await fetch(`/api/usuarios/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ autorizadoEdicion: valor }),
    });
    await load();
  }

  if (!tecnicos) return <div className="text-muted text-sm">Cargando…</div>;
  if (tecnicos.length === 0) return <div className="text-muted text-sm">No hay usuarios con rol técnico.</div>;

  return (
    <div>
      {tecnicos.map((t: any) => (
        <label key={t.id} className="flex items-center gap-2.5 text-sm py-1.5 border-b last:border-0 border-[#EFF1F3] cursor-pointer">
          <input type="checkbox" checked={t.autorizadoEdicion} onChange={(e) => toggle(t.id, e.target.checked)} />
          <span className="flex-1">{t.email}</span>
          <span className={`badge ${t.autorizadoEdicion ? "badge-ok" : "badge-bad"}`}>
            {t.autorizadoEdicion ? "Autorizado" : "Sin autorización"}
          </span>
        </label>
      ))}
    </div>
  );
}

function VincularForm({ clienteId, personas, proyectos, onSubmit }: any) {
  const [personaId, setPersonaId] = useState("");
  const [proyectoId, setProyectoId] = useState("");
  const [dedicacion, setDedicacion] = useState("50");
  const [submitting, setSubmitting] = useState(false);
  const [saved, setSaved] = useState(false);
  const lockRef = useRef(false);

  const personasCliente = personas.filter((p: any) => String(p.clienteId) === clienteId);
  const proyectosCliente = proyectos.filter((p: any) => String(p.clienteId) === clienteId);

  // si el cliente compartido cambia, las selecciones de persona/proyecto de este
  // formulario dejan de ser válidas (pertenecían al cliente anterior). Se ignora
  // el primer montaje: ahí ya empiezan vacías, no hace falta tocarlas.
  const primerRender = useRef(true);
  useEffect(() => {
    if (primerRender.current) {
      primerRender.current = false;
      return;
    }
    setPersonaId("");
    setProyectoId("");
  }, [clienteId]);

  async function submit() {
    if (lockRef.current) return;
    if (!personaId || !proyectoId) {
      alert("Selecciona un cliente arriba y, después, persona y proyecto.");
      return;
    }
    lockRef.current = true;
    setSubmitting(true);
    setSaved(false);
    try {
      await onSubmit({ personaId, proyectoId, dedicacion });
      setPersonaId("");
      setProyectoId("");
      setDedicacion("50");
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
    <div className={`flex gap-2.5 flex-wrap items-end p-2 -m-2 rounded-md transition-colors duration-500 ${saved ? "bg-[#e7f5ee]" : ""}`}>
      <label className="flex flex-col gap-1 text-sm text-muted flex-1 min-w-[160px]">
        Persona
        <select className="field" value={personaId} onChange={(e) => setPersonaId(e.target.value)} disabled={submitting || !clienteId}>
          <option value="">—</option>
          {personasCliente.map((p: any) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
        </select>
      </label>
      <label className="flex flex-col gap-1 text-sm text-muted flex-1 min-w-[160px]">
        Proyecto
        <select className="field" value={proyectoId} onChange={(e) => setProyectoId(e.target.value)} disabled={submitting || !clienteId}>
          <option value="">—</option>
          {proyectosCliente.map((p: any) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
        </select>
      </label>
      <label className="flex flex-col gap-1 text-sm text-muted flex-1 min-w-[140px]">
        Dedicación %
        <input
          className="field"
          type="number"
          value={dedicacion}
          onChange={(e) => setDedicacion(e.target.value)}
          disabled={submitting}
        />
      </label>
      <div className="flex items-center gap-2">
        <button className="btn" onClick={submit} disabled={submitting}>{submitting ? "Guardando…" : "Vincular"}</button>
        {saved && <span className="text-sm text-ok font-semibold">✓ Guardado</span>}
      </div>
    </div>
  );
}

function UsuarioForm({ clientes, personas, onSubmit }: any) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rol, setRol] = useState("tecnico");
  const [clienteId, setClienteId] = useState("");
  const [personaId, setPersonaId] = useState("");

  const necesitaCliente = rol === "admin_cliente" || rol === "investigador";
  const necesitaPersona = rol === "investigador";
  const personasCliente = personas.filter((p: any) => String(p.clienteId) === clienteId);

  function submit() {
    if (!email || !password) {
      alert("Email y contraseña son requeridos.");
      return;
    }
    onSubmit({
      email, password, rol,
      clienteId: necesitaCliente ? clienteId : null,
      personaId: necesitaPersona ? personaId : null,
    });
    setEmail(""); setPassword(""); setRol("tecnico"); setClienteId(""); setPersonaId("");
  }

  return (
    <div className="flex gap-2.5 flex-wrap items-end">
      <label className="flex flex-col gap-1 text-sm text-muted flex-1 min-w-[180px]">
        Email
        <input className="field" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
      </label>
      <label className="flex flex-col gap-1 text-sm text-muted flex-1 min-w-[140px]">
        Contraseña
        <input className="field" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
      </label>
      <label className="flex flex-col gap-1 text-sm text-muted flex-1 min-w-[160px]">
        Rol
        <select
          className="field"
          value={rol}
          onChange={(e) => { setRol(e.target.value); setClienteId(""); setPersonaId(""); }}
        >
          <option value="admin_consultora">Admin consultora</option>
          <option value="tecnico">Técnico</option>
          <option value="admin_cliente">Admin cliente</option>
          <option value="investigador">Investigador</option>
        </select>
      </label>
      {necesitaCliente && (
        <label className="flex flex-col gap-1 text-sm text-muted flex-1 min-w-[160px]">
          Cliente
          <select className="field" value={clienteId} onChange={(e) => { setClienteId(e.target.value); setPersonaId(""); }}>
            <option value="">—</option>
            {clientes.map((c: any) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
          </select>
        </label>
      )}
      {necesitaPersona && (
        <label className="flex flex-col gap-1 text-sm text-muted flex-1 min-w-[160px]">
          Persona
          <select className="field" value={personaId} onChange={(e) => setPersonaId(e.target.value)}>
            <option value="">—</option>
            {personasCliente.map((p: any) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
          </select>
        </label>
      )}
      <button className="btn" onClick={submit}>Crear usuario</button>
    </div>
  );
}
function EditRowVinculo({ v, onSave, onCancel }: any) {
  const [dedicacion, setDedicacion] = useState(v.dedicacion);
  return (
    <tr>
      <td>{v.persona?.nombre} — {v.proyecto?.nombre}</td>
      <td><input className="field w-20" type="number" value={dedicacion} onChange={(e) => setDedicacion(e.target.value)} /></td>
      <td>{v.activo ? <span className="badge badge-ok">Activo</span> : <span className="badge badge-bad">Inactivo</span>}</td>
      <td className="whitespace-nowrap">
        <button className="btn btn-primary mr-1.5" onClick={() => onSave({ dedicacion })}>Guardar</button>
        <button className="btn btn-ghost" onClick={onCancel}>Cancelar</button>
      </td>
    </tr>
  );
}

