import { idade } from './datas';
import type { Medicao, Objetivo, Perfil, TipoTrabalho } from './tipos';

// Fator de atividade = trabalho + 0,05 por sessão semanal.
// Ex.: trabalho sentado e 6 sessões = 1,25 + 0,30 = 1,55 (o valor do caderno original).
const BASE_TRABALHO: Record<TipoTrabalho, number> = { sentado: 1.25, em_pe: 1.4, bracal: 1.6 };
export const AJUSTE_OBJETIVO: Record<Objetivo, number> = { perder: -400, manter: 0, ganhar: 300 };

export function fatorAtividade(tipo: TipoTrabalho, metaSemanal: number): number {
  return Math.min(2, Math.round((BASE_TRABALHO[tipo] + 0.05 * metaSemanal) * 100) / 100);
}

export type Metas = {
  peso: number;
  idade: number;
  tmb: number;
  fator: number;
  gasto: number;
  ajuste: number;
  kcal: number;
  prot: number;
  protMin: number;
};

/** Mifflin–St Jeor para o gasto parado, vezes o fator de atividade, mais o ajuste do objetivo. */
export function calcularMetas(perfil: Perfil, peso: number, hoje: string): Metas {
  const anos = idade(perfil.nascimento, hoje);
  const tmb = Math.round(10 * peso + 6.25 * perfil.alturaCm - 5 * anos + (perfil.sexo === 'M' ? 5 : -161));
  const fator = fatorAtividade(perfil.tipoTrabalho, perfil.metaSemanal);
  const gasto = Math.round(tmb * fator);
  const ajuste = AJUSTE_OBJETIVO[perfil.objetivo];
  return {
    peso,
    idade: anos,
    tmb,
    fator,
    gasto,
    ajuste,
    kcal: Math.round((gasto + ajuste) / 50) * 50,
    prot: Math.round(2 * peso),
    protMin: Math.round(1.6 * peso),
  };
}

/** Peso da medição mais recente que tem peso. */
export function pesoAtual(medicoes: Medicao[]): number | null {
  const comPeso = medicoes.filter((m) => m.peso != null).sort((a, b) => (a.data < b.data ? -1 : 1));
  return comPeso.length ? comPeso[comPeso.length - 1].peso : null;
}
