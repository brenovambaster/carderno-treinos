import { instante, semana } from './datas';
import type { ResumoSessao, Rotina, Serie, Treino } from './tipos';

/** A sessão mais recente (por data; empate pela última alteração). */
export function sessaoMaisRecente(resumos: ResumoSessao[]): ResumoSessao | undefined {
  let melhor: ResumoSessao | undefined;
  for (const r of resumos) {
    if (r.registradas <= 0) continue;
    if (
      !melhor ||
      r.data > melhor.data ||
      (r.data === melhor.data && instante(r.alteradoEm) > instante(melhor.alteradoEm))
    ) {
      melhor = r;
    }
  }
  return melhor;
}

/** Próximo treino: o que vem depois do treino da sessão mais recente, na ordem da rotina. */
export function proximoTreino(rotina: Rotina, resumos: ResumoSessao[]): Treino {
  const ultima = sessaoMaisRecente(resumos);
  if (!ultima) return rotina[0];
  const i = rotina.findIndex((t) => t.id === ultima.treinoId);
  if (i < 0) return rotina[0];
  return rotina[(i + 1) % rotina.length];
}

/** Ao abrir o app: a sessão de hoje, se já existe; senão, o próximo treino. */
export function treinoAoAbrir(rotina: Rotina, resumos: ResumoSessao[], hoje: string): string {
  const deHoje = sessaoMaisRecente(resumos.filter((r) => r.data === hoje));
  return deHoje ? deHoje.treinoId : proximoTreino(rotina, resumos).id;
}

export function sessoesNaSemana(resumos: ResumoSessao[], hoje: string): number {
  const [ini, fim] = semana(hoje);
  const chaves = new Set(
    resumos.filter((r) => r.registradas > 0 && r.data >= ini && r.data <= fim).map((r) => `${r.data}|${r.treinoId}`),
  );
  return chaves.size;
}

export const serieRegistrada = (s: Pick<Serie, 'feita' | 'reps'>) => s.feita || s.reps != null;

/** Atualiza o resumo de uma sessão a partir das séries dela (para funcionar sem sinal). */
export function atualizarResumo(
  resumos: ResumoSessao[],
  data: string,
  treinoId: string,
  series: Serie[],
): ResumoSessao[] {
  const daSessao = series.filter((s) => s.data === data && s.treinoId === treinoId);
  const registradas = daSessao.filter(serieRegistrada).length;
  const feitas = daSessao.filter((s) => s.feita).length;
  const alteradoEm = daSessao.reduce((a, s) => (instante(s.alteradoEm) > instante(a) ? s.alteradoEm : a), '');
  const resto = resumos.filter((r) => !(r.data === data && r.treinoId === treinoId));
  if (registradas === 0) return resto;
  return [{ data, treinoId, feitas, registradas, alteradoEm }, ...resto].sort((a, b) =>
    a.data === b.data ? instante(b.alteradoEm) - instante(a.alteradoEm) : a.data < b.data ? 1 : -1,
  );
}

/** Junta os resumos do servidor com as séries que ainda estão na fila. */
export function resumosComPendentes(resumos: ResumoSessao[], pendentes: Serie[]): ResumoSessao[] {
  let saida = resumos;
  const sessoes = new Set(pendentes.map((s) => `${s.data}|${s.treinoId}`));
  for (const k of sessoes) {
    const [data, treinoId] = k.split('|');
    const existente = saida.find((r) => r.data === data && r.treinoId === treinoId);
    if (existente) continue;
    saida = atualizarResumo(saida, data, treinoId, pendentes);
  }
  return saida;
}
