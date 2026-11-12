export function fmt(n: number | null | undefined, casas = 1): string {
  if (n == null || Number.isNaN(n)) return '–';
  return Number(n).toLocaleString('pt-BR', { maximumFractionDigits: casas });
}

/** Lê um número digitado ("62,5" ou "62.5"). Vazio, negativo ou acima do limite vira null. */
export function num(v: unknown, max = Number.POSITIVE_INFINITY): number | null {
  if (v == null) return null;
  const t = String(v).trim().replace(',', '.');
  if (t === '') return null;
  const n = Number(t);
  return Number.isFinite(n) && n >= 0 && n <= max ? n : null;
}

export const LIMITE_CARGA = 9999;
export const LIMITE_REPS = 999;
