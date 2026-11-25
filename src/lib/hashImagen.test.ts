import { describe, expect, it } from "vitest";
import sharp from "sharp";
import { calcularHashPerceptual, distanciaHamming, UMBRAL_DUPLICADO } from "./hashImagen";

async function imagenSolida(color: { r: number; g: number; b: number }): Promise<Buffer> {
  return sharp({ create: { width: 64, height: 64, channels: 3, background: color } }).png().toBuffer();
}

async function imagenTablero(): Promise<Buffer> {
  const svg = `<svg width="64" height="64">${Array.from({ length: 8 }, (_, y) =>
    Array.from({ length: 8 }, (_, x) => `<rect x="${x * 8}" y="${y * 8}" width="8" height="8" fill="${(x + y) % 2 ? "black" : "white"}"/>`).join("")
  ).join("")}</svg>`;
  return sharp(Buffer.from(svg)).png().toBuffer();
}

describe("calcularHashPerceptual / distanciaHamming", () => {
  it("dos imágenes idénticas tienen distancia 0", async () => {
    const a = await calcularHashPerceptual(await imagenSolida({ r: 100, g: 150, b: 200 }));
    const b = await calcularHashPerceptual(await imagenSolida({ r: 100, g: 150, b: 200 }));
    expect(a).not.toBeNull();
    expect(distanciaHamming(a!, b!)).toBe(0);
  });

  it("una imagen re-codificada en JPEG (con pérdida) sigue por debajo del umbral", async () => {
    const original = await imagenTablero();
    const reescalada = await sharp(original).resize(200, 200).jpeg({ quality: 70 }).toBuffer();
    const a = await calcularHashPerceptual(original);
    const b = await calcularHashPerceptual(reescalada);
    expect(distanciaHamming(a!, b!)).toBeLessThanOrEqual(UMBRAL_DUPLICADO);
  });

  it("una imagen muy distinta (sólida vs. tablero) supera el umbral", async () => {
    const a = await calcularHashPerceptual(await imagenSolida({ r: 255, g: 255, b: 255 }));
    const b = await calcularHashPerceptual(await imagenTablero());
    expect(distanciaHamming(a!, b!)).toBeGreaterThan(UMBRAL_DUPLICADO);
  });

  it("un buffer que no es una imagen da null, no lanza", async () => {
    expect(await calcularHashPerceptual(Buffer.from("esto no es una imagen"))).toBeNull();
  });
});
