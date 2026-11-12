import type {
  Acesso,
  Cardio,
  Exercicio,
  Ficha,
  Grupo,
  Medicao,
  Papel,
  Perfil,
  ResumoSessao,
  Serie,
  TreinoParaSalvar,
  UltimaVez,
  Usuario,
  UsuarioPainel,
} from '../lib/tipos';

/**
 * Tudo o que o app pede ao servidor. Há duas implementações: Supabase e demonstração.
 * Métodos com `uid` servem para os próprios dados e, para admin e personal, para os
 * dados de quem eles acompanham (o servidor confere quem pode ver o quê).
 */
export interface Servidor {
  sessaoAtual(): Promise<Usuario | null>;
  aoMudarSessao(cb: (u: Usuario | null) => void): () => void;
  entrarComGoogle(): Promise<void>;
  sair(): Promise<void>;
  /** Registra o acesso e diz se o e-mail tem convite, se está ativo e qual o papel. */
  meuAcesso(): Promise<Acesso>;

  /** Ficha de um usuário (a própria, sem uid). Na primeira vez, é uma cópia da padrão. */
  ficha(uid?: string): Promise<Ficha>;
  fichaPadrao(): Promise<Ficha>;
  salvarFicha(fichaId: string, treinos: TreinoParaSalvar[]): Promise<void>;

  catalogo(): Promise<{ grupos: Grupo[]; exercicios: Exercicio[] }>;
  cadastrarExercicio(e: Omit<Exercicio, 'id'>): Promise<Exercicio>;
  alterarExercicio(e: Exercicio): Promise<void>;
  apagarExercicio(id: string): Promise<void>;

  perfil(uid: string): Promise<Perfil | null>;
  salvarPerfil(uid: string, p: Perfil): Promise<void>;

  resumos(uid: string): Promise<ResumoSessao[]>;
  dia(uid: string, data: string): Promise<{ series: Serie[]; cardios: Cardio[] }>;
  ultimaVez(data: string): Promise<UltimaVez>;
  enviarSeries(uid: string, series: Serie[]): Promise<void>;
  enviarCardios(uid: string, cardios: Cardio[]): Promise<void>;

  historico(uid: string, exercicioId: string): Promise<Serie[]>;
  exerciciosFeitos(uid: string): Promise<string[]>;
  cardiosRecentes(uid: string): Promise<Cardio[]>;

  medicoes(uid: string): Promise<Medicao[]>;
  salvarMedicao(uid: string, m: Medicao): Promise<void>;
  apagarMedicao(uid: string, data: string): Promise<void>;

  /** Admin: todos. Personal: os alunos dele (e a própria linha). */
  usuarios(): Promise<UsuarioPainel[]>;
  convidar(u: { email: string; papel: Exclude<Papel, 'admin'>; personal: string | null }): Promise<void>;
  alterarUsuario(email: string, mudanca: { papel?: Exclude<Papel, 'admin'>; ativo?: boolean; personal?: string | null }): Promise<void>;
  cancelarConvite(email: string): Promise<void>;
}

export class FalhaServidor extends Error {
  constructor(
    mensagem: string,
    readonly semRede: boolean,
    readonly dadoInvalido = false,
  ) {
    super(mensagem);
  }
}

const offline = () => typeof navigator !== 'undefined' && navigator.onLine === false;

export function ehSemRede(e: unknown): boolean {
  if (e instanceof FalhaServidor) return e.semRede;
  return e instanceof TypeError || offline();
}

/** Mensagens do banco que o usuário pode ler como estão, ou traduzidas. */
function mensagemLegivel(e: { message?: string; code?: string; details?: string }): string {
  const msg = e?.message ?? '';
  if (e?.code === '23505' && /exercicios_nome_unico/.test(msg)) return 'Já existe um exercício com esse nome no catálogo.';
  if (e?.code === '23505' && /usuarios_pkey/.test(msg)) return 'Esse e-mail já foi convidado.';
  if (e?.code === '23505' && /treino_exercicios_pkey/.test(msg)) return 'Um treino ficou com o mesmo exercício duas vezes.';
  if (e?.code === '23503' && /exercicios/.test(msg)) return 'Esse exercício está em uso numa ficha ou no histórico de alguém.';
  if (e?.code === '42501') return /permissão/i.test(msg) ? msg : 'Sem permissão para isso.';
  return msg;
}

export function falha(err: { message?: string; code?: string } | unknown): FalhaServidor {
  const e = err as { message?: string; code?: string };
  const msg = mensagemLegivel(e) || String(err);
  const semRede = offline() || /failed to fetch|networkerror|load failed|network request failed|fetch/i.test(msg);
  // Classes 22 (dado inválido) e 23 (restrição violada) do Postgres: reenviar não adianta.
  const dadoInvalido = /^2[23]/.test(e?.code ?? '');
  return new FalhaServidor(msg, semRede, dadoInvalido);
}

/** Converte linhas de ultima_vez() em um mapa por exercício. */
export function paraUltimaVez(
  linhas: { exercicio_id: string; data: string; indice: number; carga: number | string | null; reps: number }[],
): UltimaVez {
  const uv: UltimaVez = {};
  for (const l of [...linhas].sort((a, b) => a.indice - b.indice)) {
    const atual = (uv[l.exercicio_id] ??= { data: l.data, series: [] });
    atual.series.push({ carga: l.carga == null ? null : Number(l.carga), reps: l.reps });
  }
  return uv;
}
