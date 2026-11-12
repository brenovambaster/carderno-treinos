// Tipos do domínio. Os nomes seguem o CONTEXT.md.

export type Exercicio = {
  id: string;
  treinoId: string;
  ordem: number;
  nome: string;
  series: number;
  repsMin: number;
  repsMax: number; // topo da faixa
  descanso: string;
  descansoSeg: number;
  incremento: number; // 0 = exercício com peso do corpo
  dica: string;
};

export type Treino = {
  id: string;
  ordem: number;
  nome: string;
  apelido: string;
  foco: string;
  cardio: string;
  exercicios: Exercicio[];
};

/** A rotina padrão: treinos em ordem de sequência. */
export type Rotina = Treino[];

export type Serie = {
  data: string; // AAAA-MM-DD
  treinoId: string;
  exercicioId: string;
  indice: number;
  carga: number | null;
  reps: number | null;
  feita: boolean;
  alteradoEm: string; // ISO; "vale o que foi digitado por último"
};

export type Cardio = {
  data: string;
  treinoId: string;
  cardioMin: number | null;
  alteradoEm: string;
};

export type ResumoSessao = {
  data: string;
  treinoId: string;
  feitas: number;
  registradas: number;
  alteradoEm: string;
};

export type SerieAnterior = { carga: number | null; reps: number };
export type UltimaSessao = { data: string; series: SerieAnterior[] };
/** Por exercício, as séries da última sessão em que ele foi feito. */
export type UltimaVez = Record<string, UltimaSessao>;

export type Sexo = 'M' | 'F';
export type TipoTrabalho = 'sentado' | 'em_pe' | 'bracal';
export type Objetivo = 'perder' | 'manter' | 'ganhar';

export type Perfil = {
  sexo: Sexo;
  nascimento: string;
  alturaCm: number;
  tipoTrabalho: TipoTrabalho;
  objetivo: Objetivo;
  metaSemanal: number;
};

export type Medicao = {
  data: string;
  peso: number | null;
  cintura: number | null;
  passos: number | null;
};

export type Usuario = { id: string; email: string };

export const TIPOS_TRABALHO: Record<TipoTrabalho, string> = {
  sentado: 'sentado',
  em_pe: 'em pé',
  bracal: 'braçal',
};

export const OBJETIVOS: Record<Objetivo, string> = {
  perder: 'perder gordura',
  manter: 'manter',
  ganhar: 'ganhar massa',
};
