import { instante } from '../lib/datas';
import type { Cardio, Serie } from '../lib/tipos';
import { chaveSerie, semTipo, type ItemFila } from './armazem';

/** As séries e o cardio de uma data, de todos os treinos. */
export type Dia = { data: string; series: Record<string, Serie>; cardios: Record<string, Cardio> };

export const diaVazio = (data: string): Dia => ({ data, series: {}, cardios: {} });

/** Junta o que veio do servidor (ou da cópia local) com a fila; vale o digitado por último. */
export function montarDia(data: string, base: { series: Serie[]; cardios: Cardio[] }, fila: ItemFila[]): Dia {
  const dia = diaVazio(data);
  for (const s of base.series) if (s.data === data) dia.series[chaveSerie(s)] = s;
  for (const c of base.cardios) if (c.data === data) dia.cardios[c.treinoId] = c;
  for (const item of fila) {
    if (item.data !== data) continue;
    if (item.tipo === 'serie') {
      const k = chaveSerie(item);
      const atual = dia.series[k];
      if (!atual || instante(item.alteradoEm) >= instante(atual.alteradoEm)) dia.series[k] = semTipo(item) as Serie;
    } else {
      const atual = dia.cardios[item.treinoId];
      if (!atual || instante(item.alteradoEm) >= instante(atual.alteradoEm)) dia.cardios[item.treinoId] = semTipo(item) as Cardio;
    }
  }
  return dia;
}

export const listaDoDia = (dia: Dia) => ({ series: Object.values(dia.series), cardios: Object.values(dia.cardios) });
