import { createClient } from '@supabase/supabase-js';
import type {
  Acesso,
  Cardio,
  Exercicio,
  Ficha,
  Medicao,
  Papel,
  ResumoSessao,
  Serie,
  Usuario,
  UsuarioPainel,
} from '../lib/tipos';
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
  nome: r.nome,
  grupo: r.grupo,
  incremento: Number(r.incremento),
  dica: r.dica ?? '',
});

/** A ficha vem pronta do banco (ficha_de / ficha_padrao); só garante os números. */
const paraFicha = (j: Linha): Ficha => ({
  id: j.id,
  userId: j.userId ?? null,
  podeEditar: !!j.podeEditar,
  arquivados: j.arquivados ?? [],
  treinos: (j.treinos ?? []).map((t: Linha) => ({
    ...t,
    exercicios: (t.exercicios ?? []).map((e: Linha) => ({ ...e, incremento: Number(e.incremento) })),
  })),
});

const paraUsuarioPainel = (r: Linha): UsuarioPainel => ({
  email: r.email,
  userId: r.user_id,
  nome: r.nome,
  papel: r.papel,
  ativo: !!r.ativo,
  personal: r.personal_email,
  convidadoEm: r.convidado_em,
  ultimoAcesso: r.ultimo_acesso,
  metaSemanal: r.meta_semanal,
  ultimaSessao: r.ultima_sessao,
  sessoes4Semanas: Number(r.sessoes_4_semanas ?? 0),
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
        if (evento === 'SIGNED_IN' || evento === 'TOKEN_REFRESHED' || evento === 'USER_UPDATED')
          cb(usuario(sessao?.user));
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
    async meuAcesso() {
      const a = (await q(sb.rpc('meu_acesso'))) as Linha;
      return {
        convidado: !!a?.convidado,
        ativo: !!a?.ativo,
        papel: (a?.papel ?? 'aluno') as Papel,
        personal: a?.personal ?? null,
      } satisfies Acesso;
    },

    async ficha(uid) {
      return paraFicha((await q(sb.rpc('ficha_de', uid ? { p_user: uid } : {}))) as Linha);
    },
    async fichaPadrao() {
      return paraFicha((await q(sb.rpc('ficha_padrao'))) as Linha);
    },
    async salvarFicha(fichaId, treinos) {
      await q(sb.rpc('salvar_ficha', { p_ficha: fichaId, p_treinos: treinos }));
    },

    async catalogo() {
      const [grupos, exercicios] = await Promise.all([
        q(sb.from('grupos').select('id, nome, ordem').order('ordem')),
        q(sb.from('exercicios').select('id, nome, grupo, incremento, dica').order('nome')),
      ]);
      return { grupos: grupos as any, exercicios: (exercicios as Linha[]).map(paraExercicio) };
    },
    async cadastrarExercicio(e) {
      const r = await q(
        sb
          .from('exercicios')
          .insert({ nome: e.nome.trim(), grupo: e.grupo, incremento: e.incremento, dica: e.dica.trim() })
          .select('id, nome, grupo, incremento, dica')
          .single(),
      );
      return paraExercicio(r as Linha);
    },
    async alterarExercicio(e) {
      await q(
        sb
          .from('exercicios')
          .update({ nome: e.nome.trim(), grupo: e.grupo, incremento: e.incremento, dica: e.dica.trim() })
          .eq('id', e.id),
      );
    },
    async apagarExercicio(id) {
      await q(sb.from('exercicios').delete().eq('id', id));
    },

    async perfil(uid) {
      const r = (await q(sb.from('perfis').select('*').eq('user_id', uid).maybeSingle())) as Linha | null;
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
    async salvarPerfil(uid, p) {
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

    async resumos(uid) {
      const linhas = await q(
        sb
          .from('resumo_sessoes')
          .select('data, treino_id, feitas, registradas, alterado_em')
          .eq('user_id', uid)
          .order('data', { ascending: false })
          .order('alterado_em', { ascending: false })
          .limit(120),
      );
      return (linhas as Linha[]).map((r): ResumoSessao => ({
        data: r.data,
        treinoId: r.treino_id,
        feitas: Number(r.feitas),
        registradas: Number(r.registradas),
        alteradoEm: r.alterado_em,
      }));
    },
    async dia(uid, data) {
      const [series, cardios] = await Promise.all([
        q(sb.from('series').select('*').eq('user_id', uid).eq('data', data)),
        q(sb.from('sessoes').select('*').eq('user_id', uid).eq('data', data)),
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

    async historico(uid, exercicioId) {
      const linhas = await q(
        sb
          .from('series')
          .select('*')
          .eq('user_id', uid)
          .eq('exercicio_id', exercicioId)
          .not('reps', 'is', null)
          .order('data', { ascending: false })
          .order('indice')
          .limit(1000),
      );
      return (linhas as Linha[]).map(paraSerie);
    },
    async exerciciosFeitos(uid) {
      const linhas = (await q(sb.rpc('exercicios_feitos', { p_user: uid }))) as unknown;
      return (Array.isArray(linhas) ? linhas : []).map((l: any) => (typeof l === 'string' ? l : l.exercicios_feitos));
    },
    async cardiosRecentes(uid) {
      const linhas = await q(
        sb
          .from('sessoes')
          .select('*')
          .eq('user_id', uid)
          .not('cardio_min', 'is', null)
          .order('data', { ascending: false })
          .limit(120),
      );
      return (linhas as Linha[]).map(paraCardio);
    },

    async medicoes(uid) {
      const linhas = await q(
        sb.from('medicoes').select('data, peso, cintura, passos').eq('user_id', uid).order('data'),
      );
      return (linhas as Linha[]).map((r): Medicao => ({
        data: r.data,
        peso: n(r.peso),
        cintura: n(r.cintura),
        passos: n(r.passos),
      }));
    },
    async salvarMedicao(uid, m) {
      await q(
        sb
          .from('medicoes')
          .upsert({ user_id: uid, ...m, atualizado_em: new Date().toISOString() }, { onConflict: 'user_id,data' }),
      );
    },
    async apagarMedicao(uid, data) {
      await q(sb.from('medicoes').delete().eq('user_id', uid).eq('data', data));
    },

    async usuarios() {
      const linhas = await q(
        sb.from('painel_usuarios').select('*').order('nome', { nullsFirst: false }).order('email'),
      );
      return (linhas as Linha[]).map(paraUsuarioPainel);
    },
    async convidar(u) {
      await q(
        sb.from('usuarios').insert({
          email: u.email.trim().toLowerCase(),
          papel: u.papel,
          personal_email: u.papel === 'aluno' ? u.personal : null,
        }),
      );
    },
    async alterarUsuario(email, m) {
      const mudanca: Linha = {};
      if (m.papel !== undefined) mudanca.papel = m.papel;
      if (m.ativo !== undefined) mudanca.ativo = m.ativo;
      if (m.personal !== undefined) mudanca.personal_email = m.personal;
      await q(sb.from('usuarios').update(mudanca).eq('email', email));
    },
    async cancelarConvite(email) {
      await q(sb.from('usuarios').delete().eq('email', email));
    },
  };
}
