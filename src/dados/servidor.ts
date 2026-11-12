import type { Cardio, Medicao, Perfil, ResumoSessao, Rotina, Serie, UltimaVez, Usuario } from '../lib/tipos';

/** Tudo o que o app pede ao servidor. Há duas implementações: Supabase e demonstração. */
export interface Servidor {
  sessaoAtual(): Promise<Usuario | null>;
  aoMudarSessao(cb: (u: Usuario | null) => void): () => void;
  entrarComGoogle(): Promise<void>;
  sair(): Promise<void>;

  temConvite(): Promise<boolean>;
  rotina(): Promise<Rotina>;
  perfil(): Promise<Perfil | null>;
  salvarPerfil(uid: string, p: Perfil): Promise<void>;

  resumos(): Promise<ResumoSessao[]>;
  dia(data: string): Promise<{ series: Serie[]; cardios: Cardio[] }>;
  ultimaVez(data: string): Promise<UltimaVez>;
  enviarSeries(uid: string, series: Serie[]): Promise<void>;
  enviarCardios(uid: string, cardios: Cardio[]): Promise<void>;

  historico(exercicioId: string): Promise<Serie[]>;
  cardiosRecentes(): Promise<Cardio[]>;

  medicoes(): Promise<Medicao[]>;
  salvarMedicao(uid: string, m: Medicao): Promise<void>;
  apagarMedicao(data: string): Promise<void>;
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

export function falha(err: { message?: string; code?: string } | unknown): FalhaServidor {
  const e = err as { message?: string; code?: string };
  const msg = e?.message ?? String(err);
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
