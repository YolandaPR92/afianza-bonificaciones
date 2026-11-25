// Helpers de fechas para el ejercicio fiscal configurable (sección 3 del encargo).
// Las fechas de la app llegan como "YYYY-MM-DD" (texto, igual que el resto de fechas
// de Persona/Proyecto); se tratan como año/mes/día sin horas para evitar líos de huso
// horario con el objeto Date nativo.

export function parseYMD(s: string): { y: number; m: number; d: number } {
  const [y, m, d] = s.split("-").map((x) => parseInt(x, 10));
  return { y, m, d };
}

function toMonthIndex(y: number, m: number): number {
  return y * 12 + (m - 1);
}

/** Suma n meses a una fecha "YYYY-MM-DD", conservando el día o recortándolo al último
 * día del mes resultante si este es más corto (p. ej. 31-12 + 6 meses no es 31-06). */
export function addMonths(s: string, n: number): string {
  const { y, m, d } = parseYMD(s);
  const idx = toMonthIndex(y, m) + n;
  const ny = Math.floor(idx / 12);
  const nm = (idx % 12) + 1;
  const ultimoDia = new Date(Date.UTC(ny, nm, 0)).getUTCDate();
  return `${ny}-${String(nm).padStart(2, "0")}-${String(Math.min(d, ultimoDia)).padStart(2, "0")}`;
}

/** fechaLimiteIMV = fin del ejercicio + 6 meses (sección 3). */
export function fechaLimiteIMV(fechaFin: string): string {
  return addMonths(fechaFin, 6);
}

/**
 * Lista ordenada de {mes, anio} desde fechaInicio hasta fechaFin del ejercicio
 * (ambos inclusive, por mes). Para un ejercicio no natural (p. ej. julio-junio)
 * da el orden real del ejercicio, no el orden natural enero-diciembre.
 */
export function mesesDelEjercicio(fechaInicio: string, fechaFin: string): { mes: number; anio: number }[] {
  const ini = parseYMD(fechaInicio);
  const fin = parseYMD(fechaFin);
  const out: { mes: number; anio: number }[] = [];
  let idx = toMonthIndex(ini.y, ini.m);
  const idxFin = toMonthIndex(fin.y, fin.m);
  while (idx <= idxFin) {
    out.push({ anio: Math.floor(idx / 12), mes: (idx % 12) + 1 });
    idx++;
  }
  return out;
}

/** Último día del mes, como "YYYY-MM-DD". */
export function finDeMes(anio: number, mes: number): string {
  const d = new Date(Date.UTC(anio, mes, 0)).getUTCDate();
  return `${anio}-${String(mes).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

/** Primer día del mes, como "YYYY-MM-DD". */
export function inicioDeMes(anio: number, mes: number): string {
  return `${anio}-${String(mes).padStart(2, "0")}-01`;
}

/**
 * ¿La persona está de alta en bonificación durante este mes? fechaAltaBonificacion
 * debe ser igual o anterior al fin de mes, y si hay fechaBajaBonificacion, no puede
 * ser anterior al inicio de mes (sección 3).
 */
export function bonificadaEnMes(fechaAlta: string | null, fechaBaja: string | null, anio: number, mes: number): boolean {
  if (!fechaAlta) return false;
  if (fechaAlta > finDeMes(anio, mes)) return false;
  if (fechaBaja && fechaBaja < inicioDeMes(anio, mes)) return false;
  return true;
}

/** Número de meses de solape entre [aIni,aFin] y [bIni,bFin] (inclusive, por mes). aFin/bFin null = sin límite. */
export function mesesSolapados(aIni: string, aFin: string | null, bIni: string, bFin: string): number {
  const iniA = parseYMD(aIni);
  const iniIdx = toMonthIndex(iniA.y, iniA.m);
  const iniB = parseYMD(bIni);
  const finB = parseYMD(bFin);
  const inicio = Math.max(iniIdx, toMonthIndex(iniB.y, iniB.m));
  const finIdxB = toMonthIndex(finB.y, finB.m);
  let finIdx = finIdxB;
  if (aFin) {
    const fa = parseYMD(aFin);
    finIdx = Math.min(finIdx, toMonthIndex(fa.y, fa.m));
  }
  return Math.max(0, finIdx - inicio + 1);
}
