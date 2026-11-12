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

/** Descanso em texto: 90 → "1 min 30 s", 120 → "2 min", 45 → "45 s". */
export function textoDescanso(seg: number): string {
  if (seg < 60) return `${seg} s`;
  const min = Math.floor(seg / 60);
  const resto = seg % 60;
  return resto ? `${min} min ${resto} s` : `${min} min`;
}

/** Opções de descanso do editor de ficha, em segundos. */
export const DESCANSOS = [30, 45, 60, 75, 90, 120, 150, 180, 240, 300];

/** Para buscar sem se importar com acento e maiúscula. */
export const normalizar = (s: string) => s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().trim();

/** Incremento de carga em texto: 0 → "peso do corpo", 2.5 → "sobe 2,5 kg por vez". */
export const textoIncremento = (inc: number) => (inc === 0 ? 'peso do corpo' : `sobe ${fmt(inc)} kg por vez`);
