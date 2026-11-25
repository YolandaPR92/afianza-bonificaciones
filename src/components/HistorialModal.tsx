"use client";

export default function HistorialModal({ historyFor, onClose }: { historyFor: any[] | null; onClose: () => void }) {
  if (!historyFor) return null;
  return (
    <div className="fixed inset-0 bg-[rgba(16,32,58,.45)] flex items-center justify-center z-50" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="bg-white rounded-xl w-[520px] max-w-[92vw] p-7 shadow-2xl max-h-[86vh] overflow-auto">
        <h3 className="font-serif text-lg text-steel mb-4">Histórico de evidencias</h3>
        {historyFor.length === 0 && <div className="text-muted text-sm">Sin evidencias.</div>}
        {historyFor.map((e) => (
          <div key={e.id} className="border-t border-dashed border-line pt-3 mt-3 first:border-0 first:mt-0 first:pt-0 text-[12.5px]">
            <b>Evidencia v{e.version}</b>
            <div className="mt-1 space-y-1.5">
              {e.archivos.map((a: any) => (
                <div key={a.id} className="font-mono">
                  <div>
                    📄 <a className="underline" href={`/api/evidencias/${e.id}/archivo/${a.id}`} target="_blank">{a.nombre}</a>
                    {a.resultado && (
                      <span className={`badge ml-1.5 ${a.resultado === "valida" ? "badge-ok" : a.resultado === "debil" ? "badge-pend" : "badge-bad"}`}>
                        {a.resultado === "valida" ? "Válida" : a.resultado === "debil" ? "Débil" : "No válida"}
                      </span>
                    )}
                  </div>
                  {a.motivoCodigo && (
                    <div className="text-muted font-sans">{a.motivoCodigo} — {a.motivoTexto}</div>
                  )}
                  {a.comentarioCliente && <div className="text-muted font-sans">Para el cliente: {a.comentarioCliente}</div>}
                  {a.notaInterna && <div className="text-muted font-sans">Nota interna: {a.notaInterna}</div>}
                </div>
              ))}
              {e.archivos.length === 0 && <span className="font-mono text-muted">Sin archivos adjuntos</span>}
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
          <button className="btn btn-ghost" onClick={onClose}>Cerrar</button>
        </div>
      </div>
    </div>
  );
}
