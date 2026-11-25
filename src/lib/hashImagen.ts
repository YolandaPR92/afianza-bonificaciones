// Hash perceptual (aHash 16×16, sección 7.1) para sugerir duplicados — nunca rechaza
// nada sola, solo rellena una sugerencia que el técnico ve al revisar.
import sharp from "sharp";

export async function calcularHashPerceptual(buffer: Buffer): Promise<string | null> {
  try {
    const { data } = await sharp(buffer)
      .resize(16, 16, { fit: "fill" })
      .grayscale()
      .raw()
      .toBuffer({ resolveWithObject: true });
    const promedio = data.reduce((s, v) => s + v, 0) / data.length;
    let hex = "";
    for (let i = 0; i < data.length; i += 4) {
      let nibble = 0;
      for (let b = 0; b < 4; b++) nibble = (nibble << 1) | (data[i + b] >= promedio ? 1 : 0);
      hex += nibble.toString(16);
    }
    return hex;
  } catch {
    return null; // no es una imagen que sharp sepa decodificar: no hay hash, no pasa nada
  }
}

/** Distancia de Hamming entre dos hashes hexadecimales del mismo tamaño. */
export function distanciaHamming(a: string, b: string): number {
  if (a.length !== b.length) return Infinity;
  let distancia = 0;
  for (let i = 0; i < a.length; i++) {
    let x = parseInt(a[i], 16) ^ parseInt(b[i], 16);
    while (x) { distancia += x & 1; x >>= 1; }
  }
  return distancia;
}

export const UMBRAL_DUPLICADO = 5;
