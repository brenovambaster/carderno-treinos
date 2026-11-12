// Tipos do domínio. Os nomes seguem o CONTEXT.md.

export type Grupo = { id: string; nome: string; ordem: number };

/** Um exercício do catálogo: o movimento, cadastrado uma vez. */
export type Exercicio = {
  id: string;
  nome: string;
  grupo: string;
  incremento: number; // 0 = exercício com peso do corpo
  dica: string;
};

/** Um exercício como prescrito num treino da ficha. */
export type ExercicioDoTreino = Exercicio & {
  ordem: number;
  series: number;
  repsMin: number;
  repsMax: number; // topo da faixa
  descansoSeg: number;
};

export type Treino = {
  id: string;
  ordem: number;
  nome: string;
  apelido: string;
  foco: string;
  cardio: string;
  exercicios: ExercicioDoTreino[];
};

/** Treino que saiu da ficha mas tem histórico. */
export type TreinoArquivado = { id: string; nome: string; apelido: string };

/** Ficha de treino: os treinos em ordem de sequência. userId nulo = Ficha padrão. */
export type Ficha = {
  id: string;
  userId: string | null;
  podeEditar: boolean;
  treinos: Treino[];
  arquivados: TreinoArquivado[];
};

/** Um treino como o editor manda gravar: id nulo = treino novo. */
export type TreinoParaSalvar = {
  id: string | null;
  nome: string;
  apelido: string;
  foco: string;
  cardio: string;
  exercicios: { id: string; series: number; repsMin: number; repsMax: number; descansoSeg: number }[];
};

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

export type Papel = 'aluno' | 'personal' | 'admin';

/** O que o app sabe sobre o acesso de quem está logado. */
export type Acesso = {
  convidado: boolean;
  ativo: boolean;
  papel: Papel;
  personal: string | null; // e-mail do personal, se tiver
};

/** Uma linha da lista de usuários (admin) ou de alunos (personal). */
export type UsuarioPainel = {
  email: string;
  userId: string | null; // nulo: ainda não entrou no app
  nome: string | null;
  papel: Papel;
  ativo: boolean;
  personal: string | null;
  convidadoEm: string;
  ultimoAcesso: string | null;
  metaSemanal: number | null;
  ultimaSessao: string | null;
  sessoes4Semanas: number;
};

export const PAPEIS: Record<Papel, string> = {
  aluno: 'Aluno',
  personal: 'Personal',
  admin: 'Admin',
};

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
