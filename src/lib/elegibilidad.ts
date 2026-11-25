// Indicador de elegibilidad automática sobre la dedicación colateral de un vínculo: se
// calcula, nunca se guarda, para que no quede obsoleto si cambian los % de la ficha.

export type AvisoElegibilidad = { nivel: "error" | "aviso"; texto: string };

export function avisosElegibilidadVinculo(v: { pctNoIDi?: number | null }): AvisoElegibilidad[] {
  const avisos: AvisoElegibilidad[] = [];
  if (v.pctNoIDi == null) {
    avisos.push({ nivel: "aviso", texto: "Sin porcentajes de dedicación colateral informados" });
  } else if (v.pctNoIDi > 15) {
    avisos.push({ nivel: "error", texto: `Dedicación colateral del ${v.pctNoIDi}%, por encima del 15%` });
  }
  return avisos;
}
