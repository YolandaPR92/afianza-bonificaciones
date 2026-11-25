// Parser CSV mínimo (punto y coma, comillas dobles con escape "" y campos
// multilínea entre comillas), para no depender de una librería externa en un
// script de carga de un solo uso.
export function parseCsv(texto: string, delimitador = ";"): string[][] {
  const filas: string[][] = [];
  let fila: string[] = [];
  let campo = "";
  let enComillas = false;
  const s = texto.replace(/^﻿/, "");

  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (enComillas) {
      if (c === '"') {
        if (s[i + 1] === '"') { campo += '"'; i++; } else { enComillas = false; }
      } else {
        campo += c;
      }
      continue;
    }
    if (c === '"') { enComillas = true; continue; }
    if (c === delimitador) { fila.push(campo); campo = ""; continue; }
    if (c === "\r") continue;
    if (c === "\n") {
      fila.push(campo);
      filas.push(fila);
      fila = [];
      campo = "";
      continue;
    }
    campo += c;
  }
  if (campo.length > 0 || fila.length > 0) {
    fila.push(campo);
    filas.push(fila);
  }
  return filas.filter((f) => f.some((c) => c.trim() !== ""));
}

export function filasObjeto(texto: string): Record<string, string>[] {
  const [cabecera, ...resto] = parseCsv(texto);
  return resto.map((fila) => Object.fromEntries(cabecera.map((h, i) => [h.trim(), (fila[i] ?? "").trim()])));
}
