// Atividade dos últimos dias, no formato do gráfico de contribuições do GitHub:
// colunas são semanas (segunda a domingo) e a cor de cada dia sobe com o volume treinado.
import { iso, parseISO } from './datas';
import type { ResumoSessao } from './tipos';

export type Nivel = 0 | 1 | 2 | 3 | 4;

export type DiaAtividade = {
  data: string;
  /** Fora da janela (antes do primeiro dia ou depois de hoje): não é desenhado. */
  foraDoPeriodo: boolean;
  sessoes: { treinoId: string; series: number }[];
  series: number; // séries registradas no dia, somando as sessões
  nivel: Nivel;
};

export type Atividade = {
  inicio: string;
  fim: string;
  semanas: DiaAtividade[][]; // cada semana tem 7 dias, de segunda a domingo
  diasTreinados: number;
  series: number;
  mediaPorSemana: number;
};

/** Nível de cor pelo volume do dia: 0 = não treinou; 4 = 24 séries ou mais. */
export function nivelDoDia(series: number, sessoes: number): Nivel {
  if (sessoes === 0) return 0;
  if (series < 8) return 1;
  if (series < 16) return 2;
  if (series < 24) return 3;
  return 4;
}

const somarDias = (d: Date, n: number) => {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
};

export function atividade(resumos: ResumoSessao[], hoje: string, dias = 30): Atividade {
  const fim = hoje;
  const inicio = iso(somarDias(parseISO(hoje), -(dias - 1)));

  const porDia = new Map<string, { treinoId: string; series: number }[]>();
  for (const r of resumos) {
    if (r.registradas <= 0 || r.data < inicio || r.data > fim) continue;
    porDia.set(r.data, [...(porDia.get(r.data) ?? []), { treinoId: r.treinoId, series: r.registradas }]);
  }

  const primeiro = parseISO(inicio);
  let d = somarDias(primeiro, -((primeiro.getDay() + 6) % 7)); // segunda da primeira semana
  const semanas: DiaAtividade[][] = [];
  while (iso(d) <= fim) {
    const semana: DiaAtividade[] = [];
    for (let i = 0; i < 7; i++) {
      const data = iso(d);
      const foraDoPeriodo = data < inicio || data > fim;
      const sessoes = foraDoPeriodo ? [] : (porDia.get(data) ?? []);
      const series = sessoes.reduce((a, s) => a + s.series, 0);
      semana.push({ data, foraDoPeriodo, sessoes, series, nivel: nivelDoDia(series, sessoes.length) });
      d = somarDias(d, 1);
    }
    semanas.push(semana);
  }

  const diasTreinados = porDia.size;
  return {
    inicio,
    fim,
    semanas,
    diasTreinados,
    series: [...porDia.values()].flat().reduce((a, s) => a + s.series, 0),
    mediaPorSemana: Math.round((diasTreinados / (dias / 7)) * 10) / 10,
  };
}
