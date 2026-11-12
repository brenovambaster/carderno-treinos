import { describe, expect, it } from 'vitest';
import { atividade, nivelDoDia } from './atividade';
import type { ResumoSessao } from './tipos';

const r = (data: string, treinoId: string, registradas: number): ResumoSessao => ({
  data,
  treinoId,
  feitas: registradas,
  registradas,
  alteradoEm: `${data}T20:00:00Z`,
});

describe('Atividade dos últimos 30 dias', () => {
  // 12/11/2026 é quinta; 30 dias para trás começa em 14/10 (quarta).
  const a = atividade(
    [
      r('2026-11-12', 'pernas-a', 22),
      r('2026-11-10', 'peito-a', 5),
      r('2026-11-10', 'ombros-a', 4), // duas sessões no mesmo dia
      r('2026-10-14', 'pernas-b', 30), // primeiro dia da janela
      r('2026-10-13', 'pernas-b', 30), // fora da janela
      r('2026-11-11', 'peito-b', 0), // sessão sem série registrada não conta
    ],
    '2026-11-12',
  );

  it('monta semanas de segunda a domingo cobrindo a janela', () => {
    expect(a.inicio).toBe('2026-10-14');
    expect(a.semanas).toHaveLength(5);
    expect(a.semanas[0][0].data).toBe('2026-10-12'); // segunda
    expect(a.semanas.every((s) => s.length === 7)).toBe(true);
    expect(a.semanas[4][6].data).toBe('2026-11-15'); // domingo da última semana
  });
  it('dias antes do início e depois de hoje ficam fora', () => {
    expect(a.semanas[0][1]).toMatchObject({ data: '2026-10-13', foraDoPeriodo: true, nivel: 0 });
    expect(a.semanas[0][2]).toMatchObject({ data: '2026-10-14', foraDoPeriodo: false, nivel: 4 });
    expect(a.semanas[4][4]).toMatchObject({ data: '2026-11-13', foraDoPeriodo: true });
  });
  it('junta as sessões do mesmo dia', () => {
    const dia = a.semanas[4][1];
    expect(dia).toMatchObject({ data: '2026-11-10', series: 9, nivel: 2 });
    expect(dia.sessoes.map((s) => s.treinoId)).toEqual(['peito-a', 'ombros-a']);
  });
  it('resume dias treinados, séries e média por semana', () => {
    expect(a.diasTreinados).toBe(3);
    expect(a.series).toBe(61);
    expect(a.mediaPorSemana).toBe(0.7);
  });
  it('nível cresce com o volume do dia', () => {
    expect([0, 1, 8, 16, 24].map((s) => nivelDoDia(s, s ? 1 : 0))).toEqual([0, 1, 2, 3, 4]);
  });
});
