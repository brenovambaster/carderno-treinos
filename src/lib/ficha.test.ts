import { describe, expect, it } from 'vitest';
import padrao from '../dados/demo/padrao.json';
import {
  adicionarExercicio,
  adicionarTreino,
  alterarExercicio,
  alterarTreino,
  copiarTreinos,
  ehNovo,
  MAX_TREINOS,
  moverExercicio,
  moverTreino,
  mudou,
  NOVO_EXERCICIO,
  paraSalvar,
  problemas,
  removerExercicio,
  removerTreino,
} from './ficha';
import { proximoTreino, treinoAoAbrir } from './sequencia';
import type { Exercicio, Treino } from './tipos';

const ficha = padrao.treinos as Treino[];
const catalogo = padrao.exercicios as Exercicio[];
const hip = catalogo.find((e) => e.id === 'hip-thrust')!;

describe('Editar a ficha', () => {
  it('trocar exercício = remover um e adicionar outro, no fim do treino', () => {
    let r = removerExercicio(ficha, 'pernas-a', 'agachamento');
    r = adicionarExercicio(r, 'pernas-a', hip);
    const t = r[0];
    expect(t.exercicios.map((e) => e.id)).not.toContain('agachamento');
    expect(t.exercicios.at(-1)).toMatchObject({ id: 'hip-thrust', ...NOVO_EXERCICIO, ordem: t.exercicios.length });
    expect(t.exercicios.map((e) => e.ordem)).toEqual(t.exercicios.map((_, i) => i + 1));
    expect(ficha[0].exercicios[0].id).toBe('agachamento'); // o original não muda
  });
  it('não repete exercício no mesmo treino', () => {
    const r = adicionarExercicio(ficha, 'pernas-a', catalogo[0]);
    expect(r[0].exercicios).toHaveLength(ficha[0].exercicios.length);
  });
  it('muda a ordem de exercícios e de treinos, sem passar das pontas', () => {
    const r = moverExercicio(ficha, 'pernas-a', 'legpress', -1);
    expect(r[0].exercicios.slice(0, 2).map((e) => e.id)).toEqual(['legpress', 'agachamento']);
    expect(moverExercicio(ficha, 'pernas-a', 'agachamento', -1)[0].exercicios).toEqual(ficha[0].exercicios);
    const t = moverTreino(ficha, 'pernas-b', -3);
    expect(t.map((x) => x.id).slice(0, 2)).toEqual(['pernas-b', 'pernas-a']);
    expect(t.map((x) => x.ordem)).toEqual([1, 2, 3, 4, 5, 6]);
  });
  it('ajusta séries, faixa e descanso; a faixa continua válida', () => {
    let r = alterarExercicio(ficha, 'pernas-a', 'agachamento', { series: 4, descansoSeg: 180 });
    expect(r[0].exercicios[0]).toMatchObject({ series: 4, descansoSeg: 180 });
    r = alterarExercicio(r, 'pernas-a', 'agachamento', { repsMin: 12 }); // era 6–10
    expect(r[0].exercicios[0]).toMatchObject({ repsMin: 12, repsMax: 12 });
  });
  it('cria e remove treinos, até 7', () => {
    let r = adicionarTreino(ficha);
    expect(r).toHaveLength(7);
    expect(r[6]).toMatchObject({ ordem: 7, nome: 'Treino G', exercicios: [] });
    expect(ehNovo(r[6].id)).toBe(true);
    expect(adicionarTreino(r)).toHaveLength(MAX_TREINOS);
    r = removerTreino(r, 'pernas-a');
    expect(r[0]).toMatchObject({ id: 'peito-costas-a', ordem: 1 });
  });
  it('o nome curto acompanha o nome enquanto não for mudado à parte', () => {
    let r = adicionarTreino(ficha.slice(0, 1));
    const id = r[1].id;
    r = alterarTreino(r, id, { nome: 'Costas e bíceps pesado' });
    expect(r[1].apelido).toBe('Costas e bícep'); // corta em 14 letras
    r = alterarTreino(r, id, { apelido: 'Costas' });
    r = alterarTreino(r, id, { nome: 'Costas e bíceps' });
    expect(r[1].apelido).toBe('Costas');
  });
  it('aponta o que impede salvar', () => {
    expect(problemas(ficha)).toEqual([]);
    let r = adicionarTreino(ficha.slice(0, 2));
    expect(problemas(r)).toEqual(['O treino "Treino C" está sem exercícios.']);
    r = alterarTreino(r, r[2].id, { nome: '' });
    expect(problemas(r)).toContain('O treino 3 está sem nome.');
    expect(problemas([])).toContain('A ficha precisa de pelo menos um treino.');
  });
  it('copiar de outra ficha cria treinos novos', () => {
    const r = copiarTreinos(ficha.slice(0, 3));
    expect(r.every((t) => ehNovo(t.id))).toBe(true);
    expect(paraSalvar(r).map((t) => t.id)).toEqual([null, null, null]);
    expect(paraSalvar(r)[0].exercicios[0]).toEqual({
      id: 'agachamento',
      series: 3,
      repsMin: 6,
      repsMax: 10,
      descansoSeg: 150,
    });
  });
  it('sabe se algo mudou', () => {
    expect(
      mudou(
        ficha,
        ficha.map((t) => ({ ...t })),
      ),
    ).toBe(false);
    expect(mudou(ficha, alterarExercicio(ficha, 'pernas-a', 'agachamento', { series: 4 }))).toBe(true);
  });
});

describe('Próximo treino com a ficha mudando', () => {
  const resumo = (data: string, treinoId: string) => ({
    data,
    treinoId,
    feitas: 3,
    registradas: 3,
    alteradoEm: `${data}T20:00:00Z`,
  });
  it('se o último treino feito saiu da ficha, recomeça pelo primeiro', () => {
    const semPernasA = removerTreino(ficha, 'pernas-a');
    expect(proximoTreino(semPernasA, [resumo('2026-11-12', 'pernas-a')]).id).toBe('peito-costas-a');
  });
  it('sessão de hoje de um treino que saiu da ficha não prende a tela', () => {
    const semPernasA = removerTreino(ficha, 'pernas-a');
    expect(treinoAoAbrir(semPernasA, [resumo('2026-11-12', 'pernas-a')], '2026-11-12')).toBe('peito-costas-a');
  });
});
