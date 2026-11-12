// Edição da Ficha de treino: operações puras sobre um rascunho (a lista de treinos),
// usadas pelo editor. Nada aqui fala com o servidor.
import type { Exercicio, ExercicioDoTreino, Treino, TreinoParaSalvar } from './tipos';

export const MAX_TREINOS = 7;
export const NOVO_EXERCICIO = { series: 3, repsMin: 8, repsMax: 12, descansoSeg: 90 };
export const LIMITE_NOME = 40;
export const LIMITE_APELIDO = 14;

/** Rascunho: os treinos em ordem. Treino criado no editor tem id começando com "novo:". */
export type Rascunho = Treino[];
type Prescricao = Pick<ExercicioDoTreino, 'series' | 'repsMin' | 'repsMax' | 'descansoSeg'>;
type DadosTreino = Pick<Treino, 'nome' | 'apelido' | 'foco' | 'cardio'>;

let seq = 0;
export const idNovo = () => `novo:${Date.now().toString(36)}-${(seq++).toString(36)}`;
export const ehNovo = (id: string) => id.startsWith('novo:');

function renumerar<T extends { ordem: number }>(lista: T[]): T[] {
  return lista.map((x, i) => (x.ordem === i + 1 ? x : { ...x, ordem: i + 1 }));
}

function mover<T extends { ordem: number }>(lista: T[], de: number, delta: number): T[] {
  const para = de + delta;
  if (de < 0 || para < 0 || para >= lista.length) return lista;
  const l = [...lista];
  const [x] = l.splice(de, 1);
  l.splice(para, 0, x);
  return renumerar(l);
}

const noTreino = (r: Rascunho, treinoId: string, f: (t: Treino) => Treino): Rascunho =>
  r.map((t) => (t.id === treinoId ? f(t) : t));

export function adicionarTreino(r: Rascunho): Rascunho {
  if (r.length >= MAX_TREINOS) return r;
  const usados = new Set(r.map((t) => t.nome));
  let n = r.length;
  let nome = '';
  do nome = `Treino ${String.fromCharCode(65 + n++)}`;
  while (usados.has(nome));
  return [...r, { id: idNovo(), ordem: r.length + 1, nome, apelido: nome, foco: '', cardio: '', exercicios: [] }];
}

export const removerTreino = (r: Rascunho, id: string): Rascunho => renumerar(r.filter((t) => t.id !== id));

export const moverTreino = (r: Rascunho, id: string, delta: number): Rascunho =>
  mover(
    r,
    r.findIndex((t) => t.id === id),
    delta,
  );

/** Altera nome, nome curto, foco ou cardio. Se o nome curto acompanhava o nome, continua acompanhando. */
export function alterarTreino(r: Rascunho, id: string, mudanca: Partial<DadosTreino>): Rascunho {
  return noTreino(r, id, (t) => {
    const novo = { ...t, ...mudanca };
    if (mudanca.nome != null && mudanca.apelido == null && t.apelido === t.nome.slice(0, LIMITE_APELIDO)) {
      novo.apelido = mudanca.nome.slice(0, LIMITE_APELIDO);
    }
    return novo;
  });
}

export function adicionarExercicio(r: Rascunho, treinoId: string, ex: Exercicio): Rascunho {
  return noTreino(r, treinoId, (t) =>
    t.exercicios.some((e) => e.id === ex.id)
      ? t
      : { ...t, exercicios: [...t.exercicios, { ...ex, ...NOVO_EXERCICIO, ordem: t.exercicios.length + 1 }] },
  );
}

export const removerExercicio = (r: Rascunho, treinoId: string, exId: string): Rascunho =>
  noTreino(r, treinoId, (t) => ({ ...t, exercicios: renumerar(t.exercicios.filter((e) => e.id !== exId)) }));

export const moverExercicio = (r: Rascunho, treinoId: string, exId: string, delta: number): Rascunho =>
  noTreino(r, treinoId, (t) => ({
    ...t,
    exercicios: mover(
      t.exercicios,
      t.exercicios.findIndex((e) => e.id === exId),
      delta,
    ),
  }));

export function alterarExercicio(r: Rascunho, treinoId: string, exId: string, mudanca: Partial<Prescricao>): Rascunho {
  return noTreino(r, treinoId, (t) => ({
    ...t,
    exercicios: t.exercicios.map((e) => {
      if (e.id !== exId) return e;
      const novo = { ...e, ...mudanca };
      // Mexendo numa ponta da faixa, a outra acompanha para a faixa continuar válida.
      if (mudanca.repsMin != null && novo.repsMax < novo.repsMin) novo.repsMax = novo.repsMin;
      if (mudanca.repsMax != null && novo.repsMin > novo.repsMax) novo.repsMin = novo.repsMax;
      return novo;
    }),
  }));
}

/** Os treinos de outra ficha como treinos novos (para começar uma ficha copiando). */
export const copiarTreinos = (treinos: Treino[]): Rascunho =>
  renumerar(treinos.map((t) => ({ ...t, id: idNovo(), exercicios: t.exercicios.map((e) => ({ ...e })) })));

/** O que impede salvar. Lista vazia = pode salvar. */
export function problemas(r: Rascunho): string[] {
  const p: string[] = [];
  if (r.length === 0) p.push('A ficha precisa de pelo menos um treino.');
  if (r.length > MAX_TREINOS) p.push(`A ficha pode ter no máximo ${MAX_TREINOS} treinos.`);
  for (const t of r) {
    const nome = t.nome.trim() || `Treino ${t.ordem}`;
    if (!t.nome.trim()) p.push(`O treino ${t.ordem} está sem nome.`);
    else if (t.nome.trim().length > LIMITE_NOME) p.push(`O nome do treino "${nome}" passa de ${LIMITE_NOME} letras.`);
    if (!t.apelido.trim()) p.push(`O treino "${nome}" está sem nome curto.`);
    else if (t.apelido.trim().length > LIMITE_APELIDO)
      p.push(`O nome curto do treino "${nome}" passa de ${LIMITE_APELIDO} letras.`);
    if (t.exercicios.length === 0) p.push(`O treino "${nome}" está sem exercícios.`);
    for (const e of t.exercicios) {
      if (!(e.series >= 1 && e.series <= 10)) p.push(`${e.nome} (${nome}): séries entre 1 e 10.`);
      if (!(e.repsMin >= 1 && e.repsMax <= 100 && e.repsMin <= e.repsMax))
        p.push(`${e.nome} (${nome}): faixa de repetições inválida.`);
    }
  }
  return p;
}

export function paraSalvar(r: Rascunho): TreinoParaSalvar[] {
  return r.map((t) => ({
    id: ehNovo(t.id) ? null : t.id,
    nome: t.nome.trim(),
    apelido: t.apelido.trim(),
    foco: t.foco.trim(),
    cardio: t.cardio.trim(),
    exercicios: t.exercicios.map((e) => ({
      id: e.id,
      series: e.series,
      repsMin: e.repsMin,
      repsMax: e.repsMax,
      descansoSeg: e.descansoSeg,
    })),
  }));
}

export const mudou = (a: Rascunho, b: Rascunho) => JSON.stringify(paraSalvar(a)) !== JSON.stringify(paraSalvar(b));
