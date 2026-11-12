const pad = (n: number) => String(n).padStart(2, '0');

export const iso = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

export function parseISO(s: string): Date {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export const hojeISO = () => iso(new Date());

export function ddmm(s: string): string {
  const d = parseISO(s);
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}`;
}

export const DIAS = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];

export const diaDaSemana = (s: string) => DIAS[parseISO(s).getDay()];

/** Segunda e domingo da semana que contém a data. */
export function semana(s: string): [string, string] {
  const d = parseISO(s);
  const desdeSegunda = (d.getDay() + 6) % 7;
  const seg = new Date(d);
  seg.setDate(d.getDate() - desdeSegunda);
  const dom = new Date(seg);
  dom.setDate(seg.getDate() + 6);
  return [iso(seg), iso(dom)];
}

export function idade(nascimento: string, hoje: string): number {
  const n = parseISO(nascimento);
  const h = parseISO(hoje);
  let anos = h.getFullYear() - n.getFullYear();
  if (h.getMonth() < n.getMonth() || (h.getMonth() === n.getMonth() && h.getDate() < n.getDate())) anos--;
  return anos;
}

/** Compara dois instantes ISO (formatos diferentes do cliente e do servidor). */
export const instante = (s: string | undefined | null) => (s ? Date.parse(s) : 0);

/** "2026-11-12" ou um instante ISO → "12/11/2026" (no fuso do aparelho). */
export function ddmmaaaa(s: string): string {
  const d = /^\d{4}-\d{2}-\d{2}$/.test(s) ? parseISO(s) : new Date(s);
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
}
