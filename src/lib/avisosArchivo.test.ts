import { describe, expect, it } from "vitest";
import { avisoFechaTrabajo } from "./avisosArchivo";

describe("avisoFechaTrabajo", () => {
  it("sin fecha no hay aviso", () => {
    expect(avisoFechaTrabajo(null, 7, 2026)).toBeNull();
  });

  it("fecha dentro del mes y en día laborable: sin aviso", () => {
    // 15-07-2026 es miércoles
    expect(avisoFechaTrabajo("2026-07-15", 7, 2026)).toBeNull();
  });

  it("fecha fuera del mes de la mensualidad: M2", () => {
    expect(avisoFechaTrabajo("2026-06-30", 7, 2026)).toMatch(/^M2/);
  });

  it("fecha en sábado: M8", () => {
    // 11-07-2026 es sábado
    expect(avisoFechaTrabajo("2026-07-11", 7, 2026)).toMatch(/^M8/);
  });

  it("fecha en domingo: M8", () => {
    // 12-07-2026 es domingo
    expect(avisoFechaTrabajo("2026-07-12", 7, 2026)).toMatch(/^M8/);
  });
});
