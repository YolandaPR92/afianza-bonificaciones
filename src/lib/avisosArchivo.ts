// Comprobaciones automáticas al subir/revisar una evidencia (sección 7.2): no
// rechazan nada, solo rellenan una sugerencia que el técnico ve al revisar.

/** M2 si la fecha cae fuera del mes de la mensualidad; M8 si cae en fin de semana. */
export function avisoFechaTrabajo(fechaTrabajo: string | null, mes: number, anio: number): string | null {
  if (!fechaTrabajo) return null;
  const m = fechaTrabajo.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  const [, yStr, mStr, dStr] = m;
  const y = parseInt(yStr, 10), mo = parseInt(mStr, 10), d = parseInt(dStr, 10);
  if (y !== anio || mo !== mes) {
    return "M2 — la fecha del trabajo cae fuera del mes de esta mensualidad";
  }
  const diaSemana = new Date(Date.UTC(y, mo - 1, d)).getUTCDay();
  if (diaSemana === 0 || diaSemana === 6) {
    return "M8 — la fecha del trabajo cae en fin de semana";
  }
  return null;
}
