import { describe, expect, it } from 'vitest';
import padrao from '../dados/demo/padrao.json';
import { calcularMetas, fatorAtividade, pesoAtual } from './metas';
import {
  atualizarResumo,
  proximoTreino,
  resumosComPendentes,
  sessoesNaSemana,
  treinoAoAbrir,
} from './sequencia';
import { sugerir } from './sugestao';
import type { Perfil, ResumoSessao, Serie, Treino } from './tipos';

const rotina = padrao.treinos as Treino[];
const agach = rotina[0].exercicios[0]; // 3 séries, 6–10, +5 kg
const barra = rotina[4].exercicios.find((e) => e.id === 'barra-fixa')!; // peso do corpo

const resumo = (data: string, treinoId: string, registradas = 3, alteradoEm = `${data}T20:00:00Z`): ResumoSessao => ({
  data,
  treinoId,
  feitas: registradas,
  registradas,
  alteradoEm,
});
const serie = (data: string, treinoId: string, indice: number, extra: Partial<Serie> = {}): Serie => ({
  data,
  treinoId,
  exercicioId: 'x',
  indice,
  carga: 10,
  reps: 8,
  feita: true,
  alteradoEm: `${data}T10:0${indice}:00Z`,
  ...extra,
});

describe('Sugestão de carga', () => {
  it('primeira vez sem histórico', () => {
    expect(sugerir(agach, undefined).tipo).toBe('primeira');
  });
  it('mantém a carga enquanto alguma série não chega ao topo', () => {
    const sg = sugerir(agach, { data: '2026-11-09', series: [{ carga: 60, reps: 10 }, { carga: 60, reps: 9 }, { carga: 57.5, reps: 8 }] });
    expect(sg).toMatchObject({ tipo: 'manter', carga: 60, reps: [10, 9, 8] });
  });
  it('sobe a carga quando todas as séries chegam ao topo da faixa', () => {
    const sg = sugerir(agach, { data: '2026-11-09', series: [{ carga: 62.5, reps: 10 }, { carga: 62.5, reps: 10 }, { carga: 62.5, reps: 11 }] });
    expect(sg).toMatchObject({ tipo: 'subir', carga: 67.5 });
  });
  it('não sobe se fez menos séries que o prescrito', () => {
    const sg = sugerir(agach, { data: '2026-11-09', series: [{ carga: 60, reps: 10 }, { carga: 60, reps: 10 }] });
    expect(sg.tipo).toBe('manter');
  });
  it('exercício com peso do corpo pede para dificultar', () => {
    const sg = sugerir(barra, { data: '2026-11-09', series: [{ carga: null, reps: 10 }, { carga: null, reps: 10 }, { carga: null, reps: 10 }] });
    expect(sg.tipo).toBe('subir-corpo');
  });
});

describe('Próximo treino', () => {
  it('sem sessões, começa pelo primeiro da ficha', () => {
    expect(proximoTreino(rotina, []).id).toBe('pernas-a');
  });
  it('segue a sequência, não o dia da semana (faltou terça, quarta abre o seguinte ao último feito)', () => {
    // Segunda 09/11 fez Pernas A; faltou terça; na quarta o próximo é Peito A.
    expect(proximoTreino(rotina, [resumo('2026-11-09', 'pernas-a')]).id).toBe('peito-costas-a');
  });
  it('depois do último treino volta ao primeiro', () => {
    expect(proximoTreino(rotina, [resumo('2026-11-14', 'ombros-bracos-b'), resumo('2026-11-13', 'peito-costas-b')]).id).toBe('pernas-a');
  });
  it('sessão pela metade conta como executada', () => {
    expect(proximoTreino(rotina, [resumo('2026-11-10', 'pernas-a', 1)]).id).toBe('peito-costas-a');
  });
  it('sessão sem nenhuma série registrada não conta', () => {
    expect(proximoTreino(rotina, [resumo('2026-11-11', 'peito-costas-a', 0), resumo('2026-11-10', 'pernas-a')]).id).toBe('peito-costas-a');
  });
  it('ao abrir, retoma a sessão de hoje se já começou', () => {
    expect(treinoAoAbrir(rotina, [resumo('2026-11-12', 'pernas-a', 2)], '2026-11-12')).toBe('pernas-a');
    expect(treinoAoAbrir(rotina, [resumo('2026-11-11', 'pernas-a')], '2026-11-12')).toBe('peito-costas-a');
  });
});

describe('Semana e resumos', () => {
  it('conta sessões de segunda a domingo', () => {
    const r = [resumo('2026-11-08', 'pernas-a'), resumo('2026-11-09', 'pernas-a'), resumo('2026-11-11', 'peito-costas-a'), resumo('2026-11-15', 'pernas-b')];
    expect(sessoesNaSemana(r, '2026-11-12')).toBe(3); // 08/11 é domingo da semana anterior
  });
  it('atualiza o resumo a partir das séries e some quando não sobra série', () => {
    const s = [serie('2026-11-12', 'pernas-a', 0), serie('2026-11-12', 'pernas-a', 1, { feita: false, reps: null })];
    const r = atualizarResumo([], '2026-11-12', 'pernas-a', s);
    expect(r).toEqual([expect.objectContaining({ feitas: 1, registradas: 1 })]);
    expect(atualizarResumo(r, '2026-11-12', 'pernas-a', [])).toEqual([]);
  });
  it('sessões que só existem na fila entram no resumo', () => {
    const r = resumosComPendentes([resumo('2026-11-10', 'pernas-a')], [serie('2026-11-12', 'peito-costas-a', 0)]);
    expect(proximoTreino(rotina, r).id).toBe('ombros-bracos-a');
  });
});

describe('Metas', () => {
  const breno: Perfil = { sexo: 'M', nascimento: '2002-05-10', alturaCm: 171, tipoTrabalho: 'sentado', objetivo: 'perder', metaSemanal: 6 };
  it('reproduz os números do caderno original', () => {
    expect(calcularMetas(breno, 75, '2026-11-12')).toMatchObject({ idade: 24, tmb: 1704, fator: 1.55, gasto: 2641, kcal: 2250, prot: 150, protMin: 120 });
  });
  it('usa a fórmula feminina e o ajuste de ganhar massa', () => {
    const m = calcularMetas({ ...breno, sexo: 'F', objetivo: 'ganhar', metaSemanal: 3 }, 60, '2026-11-12');
    expect(m.tmb).toBe(Math.round(600 + 6.25 * 171 - 5 * 24 - 161));
    expect(m.fator).toBe(1.4);
    expect(m.ajuste).toBe(300);
  });
  it('trabalho braçal aumenta o fator, com teto de 2', () => {
    expect(fatorAtividade('bracal', 6)).toBe(1.9);
    expect(fatorAtividade('bracal', 7)).toBe(1.95);
  });
  it('usa o peso da medição mais recente', () => {
    expect(pesoAtual([{ data: '2026-11-01', peso: 75, cintura: null, passos: null }, { data: '2026-11-08', peso: null, cintura: 88, passos: null }, { data: '2026-11-05', peso: 74.4, cintura: null, passos: null }])).toBe(74.4);
  });
});
