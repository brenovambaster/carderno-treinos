import { createClient } from '@supabase/supabase-js';
import type { Cardio, Exercicio, Medicao, Perfil, ResumoSessao, Serie, Treino, Usuario } from '../lib/tipos';
import { falha, paraUltimaVez, type Servidor } from './servidor';

type Linha = Record<string, any>;

const n = (v: unknown) => (v == null ? null : Number(v));

const paraSerie = (r: Linha): Serie => ({
  data: r.data,
  treinoId: r.treino_id,
  exercicioId: r.exercicio_id,
  indice: r.indice,
  carga: n(r.carga),
  reps: n(r.reps),
  feita: !!r.feita,
  alteradoEm: r.alterado_em,
});

const paraCardio = (r: Linha): Cardio => ({
  data: r.data,
  treinoId: r.treino_id,
  cardioMin: n(r.cardio_min),
  alteradoEm: r.alterado_em,
});

const paraExercicio = (r: Linha): Exercicio => ({
  id: r.id,
  treinoId: r.treino_id,
  ordem: r.ordem,
  nome: r.nome,
  series: r.series,
  repsMin: r.reps_min,
  repsMax: r.reps_max,
  descanso: r.descanso,
  descansoSeg: r.descanso_seg,
  incremento: Number(r.incremento),
  dica: r.dica,
});

const paraTreino = (r: Linha): Treino => ({
  id: r.id,
  ordem: r.ordem,
  nome: r.nome,
  apelido: r.apelido,
  foco: r.foco,
  cardio: r.cardio,
  exercicios: (r.exercicios ?? []).map(paraExercicio).sort((a: Exercicio, b: Exercicio) => a.ordem - b.ordem),
});

export function criarServidorSupabase(): Servidor {
  const sb = createClient(import.meta.env.VITE_SUPABASE_URL, import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY, {
    auth: { flowType: 'pkce', persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
  });

  /** Executa uma consulta e transforma erro (inclusive de rede) em FalhaServidor. */
  async function q<R extends { data: unknown; error: unknown }>(p: PromiseLike<R>): Promise<R['data']> {
    let r: R;
    try {
      r = await p;
    } catch (e) {
      throw falha(e);
    }
    if (r.error) throw falha(r.error);
    return r.data;
  }

  const usuario = (u: { id: string; email?: string } | undefined | null): Usuario | null =>
    u ? { id: u.id, email: u.email ?? '' } : null;

  return {
    async sessaoAtual() {
      const s = await q(sb.auth.getSession());
      return usuario(s.session?.user);
    },
    aoMudarSessao(cb) {
      const { data } = sb.auth.onAuthStateChange((evento, sessao) => {
        if (evento === 'SIGNED_IN' || evento === 'TOKEN_REFRESHED' || evento === 'USER_UPDATED') cb(usuario(sessao?.user));
        else if (evento === 'SIGNED_OUT') cb(null);
      });
      return () => data.subscription.unsubscribe();
    },
    async entrarComGoogle() {
      await q(
        sb.auth.signInWithOAuth({
          provider: 'google',
          options: { redirectTo: window.location.origin + window.location.pathname },
        }),
      );
    },
    async sair() {
      await sb.auth.signOut();
    },

    async temConvite() {
      return (await q(sb.rpc('tem_convite'))) === true;
    },
    async rotina() {
      // `series` também liga treinos a exercícios (muitos-para-muitos), então o PostgREST
      // precisa saber qual ligação usar; sem isso responde 300 (PGRST201).
      const linhas = await q(
        sb
          .from('treinos')
          .select('*, exercicios!exercicios_treino_id_fkey(*)')
          .order('ordem')
          .order('ordem', { referencedTable: 'exercicios' }),
      );
      return (linhas as Linha[]).map(paraTreino);
    },
    async perfil() {
      const r = (await q(sb.from('perfis').select('*').maybeSingle())) as Linha | null;
      if (!r) return null;
      return {
        sexo: r.sexo,
        nascimento: r.nascimento,
        alturaCm: Number(r.altura_cm),
        tipoTrabalho: r.tipo_trabalho,
        objetivo: r.objetivo,
        metaSemanal: r.meta_semanal,
      };
    },
    async salvarPerfil(uid, p: Perfil) {
      await q(
        sb.from('perfis').upsert(
          {
            user_id: uid,
            sexo: p.sexo,
            nascimento: p.nascimento,
            altura_cm: p.alturaCm,
            tipo_trabalho: p.tipoTrabalho,
            objetivo: p.objetivo,
            meta_semanal: p.metaSemanal,
            atualizado_em: new Date().toISOString(),
          },
          { onConflict: 'user_id' },
        ),
      );
    },

    async resumos() {
      const linhas = await q(
        sb
          .from('resumo_sessoes')
          .select('data, treino_id, feitas, registradas, alterado_em')
          .order('data', { ascending: false })
          .order('alterado_em', { ascending: false })
          .limit(120),
      );
      return (linhas as Linha[]).map(
        (r): ResumoSessao => ({
          data: r.data,
          treinoId: r.treino_id,
          feitas: Number(r.feitas),
          registradas: Number(r.registradas),
          alteradoEm: r.alterado_em,
        }),
      );
    },
    async dia(data) {
      const [series, cardios] = await Promise.all([
        q(sb.from('series').select('*').eq('data', data)),
        q(sb.from('sessoes').select('*').eq('data', data)),
      ]);
      return { series: (series as Linha[]).map(paraSerie), cardios: (cardios as Linha[]).map(paraCardio) };
    },
    async ultimaVez(data) {
      return paraUltimaVez((await q(sb.rpc('ultima_vez', { p_data: data }))) as any);
    },
    async enviarSeries(uid, series) {
      await q(
        sb.from('series').upsert(
          series.map((s) => ({
            user_id: uid,
            data: s.data,
            treino_id: s.treinoId,
            exercicio_id: s.exercicioId,
            indice: s.indice,
            carga: s.carga,
            reps: s.reps,
            feita: s.feita,
            alterado_em: s.alteradoEm,
          })),
          { onConflict: 'user_id,data,treino_id,exercicio_id,indice' },
        ),
      );
    },
    async enviarCardios(uid, cardios) {
      await q(
        sb.from('sessoes').upsert(
          cardios.map((c) => ({
            user_id: uid,
            data: c.data,
            treino_id: c.treinoId,
            cardio_min: c.cardioMin,
            alterado_em: c.alteradoEm,
          })),
          { onConflict: 'user_id,data,treino_id' },
        ),
      );
    },

    async historico(exercicioId) {
      const linhas = await q(
        sb
          .from('series')
          .select('*')
          .eq('exercicio_id', exercicioId)
          .not('reps', 'is', null)
          .order('data', { ascending: false })
          .order('indice')
          .limit(1000),
      );
      return (linhas as Linha[]).map(paraSerie);
    },
    async cardiosRecentes() {
      const linhas = await q(
        sb.from('sessoes').select('*').not('cardio_min', 'is', null).order('data', { ascending: false }).limit(120),
      );
      return (linhas as Linha[]).map(paraCardio);
    },

    async medicoes() {
      const linhas = await q(sb.from('medicoes').select('data, peso, cintura, passos').order('data'));
      return (linhas as Linha[]).map(
        (r): Medicao => ({ data: r.data, peso: n(r.peso), cintura: n(r.cintura), passos: n(r.passos) }),
      );
    },
    async salvarMedicao(uid, m) {
      await q(
        sb.from('medicoes').upsert(
          { user_id: uid, ...m, atualizado_em: new Date().toISOString() },
          { onConflict: 'user_id,data' },
        ),
      );
    },
    async apagarMedicao(data) {
      await q(sb.from('medicoes').delete().eq('data', data));
    },
  };
}
