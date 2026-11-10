import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';

/** Token aleatorio de 256 bits, apto para URLs. */
export function generarToken(bytes = 32): string {
  return randomBytes(bytes).toString('base64url');
}

export function sha256(valor: string): string {
  return createHash('sha256').update(valor, 'utf8').digest('hex');
}

/** Comparación en tiempo constante para evitar ataques de temporización. */
export function iguales(a: string, b: string): boolean {
  const ba = Buffer.from(a, 'utf8');
  const bb = Buffer.from(b, 'utf8');
  return ba.length === bb.length && timingSafeEqual(ba, bb);
}

/** Código legible para imprimir bajo el QR de la mesa (sin caracteres ambiguos como 0/O, 1/I). */
export function generarCodigoMesa(longitud = 8): string {
  const alfabeto = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  const bytes = randomBytes(longitud);
  let codigo = '';
  for (let i = 0; i < longitud; i++) {
    codigo += alfabeto[bytes[i] % alfabeto.length];
  }
  return codigo;
}

/** Interpreta un JSON guardado en la base de datos; devuelve el valor por defecto si está dañado. */
export function leerJson<T>(texto: string | null | undefined, porDefecto: T): T {
  if (!texto) return porDefecto;
  try {
    return JSON.parse(texto) as T;
  } catch {
    return porDefecto;
  }
}
