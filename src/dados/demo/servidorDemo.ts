// Servidor de mentira, só na memória, para `npm run demo` e para testar as telas sem login.
// Parâmetros na URL:
//   ?tela=login | perfil | convite | inativo
//   ?papel=admin (padrão) | personal | aluno | aluno-com-personal
import { instante, iso, parseISO } from '../../lib/datas';
import type {
  Cardio,
  Exercicio,
  ExercicioDoTreino,
  Ficha,
  Grupo,
  Medicao,
  Papel,
  Perfil,
  ResumoSessao,
  Serie,
  Treino,
  Usuario,
  UsuarioPainel,
} from '../../lib/tipos';
import { FalhaServidor, paraUltimaVez, type Servidor } from '../servidor';
import padrao from './padrao.json';

const params = new URLSearchParams(location.search);
const tela = params.get('tela');
const papelUrl = params.get('papel') ?? 'admin';
const papel: Papel = papelUrl === 'personal' ? 'personal' : papelUrl.startsWith('aluno') ? 'aluno' : 'admin';
const EU: Usuario = { id: 'demo', email: 'voce@exemplo.com' };

const grupos = padrao.grupos as Grupo[];
const catalogo = new Map<string, Exercicio>((padrao.exercicios as Exercicio[]).map((e) => [e.id, e]));
const treinosPadrao = padrao.treinos as Treino[];

type Conta = {
  email: string;
  userId: string | null;
  nome: string | null;
  papel: Papel;
  ativo: boolean;
  personal: string | null;
  convidadoEm: string;
  ultimoAcesso: string | null;
};
const contas = new Map<string, Conta>();
const perfis = new Map<string, Perfil>();
const fichas = new Map<string, { id: string; userId: string | null; treinos: Treino[]; arquivados: Treino[] }>();
const series = new Map<string, Serie>(); // chave: uid|data|treino|exercicio|indice
const cardios = new Map<string, Cardio & { uid: string }>();
const medicoes = new Map<string, Medicao & { uid: string }>();
const ouvintes = new Set<(u: Usuario | null) => void>();
let logado = tela !== 'login';
let seq = 0;
const novoId = (p: string) => `${p}-${Date.now().toString(36)}-${seq++}`;

const kS = (uid: string, s: Pick<Serie, 'data' | 'treinoId' | 'exercicioId' | 'indice'>) =>
  `${uid}|${s.data}|${s.treinoId}|${s.exercicioId}|${s.indice}`;
const diasAtras = (n: number) => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return iso(d);
};
const contaDe = (uid: string) => [...contas.values()].find((c) => c.userId === uid);
const meuPapel = (): Papel => contas.get(EU.email)!.papel;

function copiarPadrao(uid: string) {
  if (fichas.has(uid)) return fichas.get(uid)!;
  const f = {
    id: `ficha-${uid}`,
    userId: uid,
    treinos: treinosPadrao.map((t) => ({ ...structuredClone(t), id: `${uid}-${t.id}` })),
    arquivados: [],
  };
  fichas.set(uid, f);
  return f;
}

function semearSessoes(uid: string, voltas: { inicio: number; delta: number }[]) {
  const treinos = copiarPadrao(uid).treinos;
  for (const { inicio, delta } of voltas) {
    treinos.forEach((t, ti) => {
      const data = diasAtras(inicio - ti);
      const quando = new Date(parseISO(data).getTime() + 19 * 3600_000).toISOString();
      for (const ex of t.exercicios) {
        const base = ex.incremento > 0 ? 10 + ex.ordem * 7.5 : null;
        for (let i = 0; i < ex.series; i++) {
          const reps = ex.id === 'agachamento' && delta ? ex.repsMax : ex.repsMin + delta + (i === 0 ? 1 : 0);
          const carga = base == null ? null : base + delta * ex.incremento * 0.5;
          const s: Serie = {
            data,
            treinoId: t.id,
            exercicioId: ex.id,
            indice: i,
            carga,
            reps,
            feita: true,
            alteradoEm: quando,
          };
          series.set(kS(uid, s), s);
        }
      }
      if (t.cardio.startsWith('Depois'))
        cardios.set(`${uid}|${data}|${t.id}`, { uid, data, treinoId: t.id, cardioMin: 20, alteradoEm: quando });
    });
  }
}

function semear() {
  const agora = new Date().toISOString();
  const conta = (c: Partial<Conta> & Pick<Conta, 'email'>) =>
    contas.set(c.email, {
      userId: null,
      nome: null,
      papel: 'aluno',
      ativo: true,
      personal: null,
      convidadoEm: diasAtras(40),
      ultimoAcesso: null,
      ...c,
    });
  conta({
    email: EU.email,
    userId: EU.id,
    nome: 'Você',
    papel,
    ativo: tela !== 'inativo',
    personal: papelUrl === 'aluno-com-personal' ? 'carla@exemplo.com' : null,
    ultimoAcesso: agora,
  });
  if (EU.email !== 'carla@exemplo.com')
    conta({
      email: 'carla@exemplo.com',
      userId: 'carla',
      nome: 'Carla Personal',
      papel: 'personal',
      ultimoAcesso: diasAtras(1),
    });
  const personalDoJoao = papel === 'personal' ? EU.email : 'carla@exemplo.com';
  conta({
    email: 'joao@exemplo.com',
    userId: 'joao',
    nome: 'João Silva',
    personal: personalDoJoao,
    ultimoAcesso: diasAtras(2),
  });
  conta({ email: 'ana@exemplo.com', userId: 'ana', nome: 'Ana Souza', ultimoAcesso: diasAtras(9) });
  conta({
    email: 'bia@exemplo.com',
    userId: 'bia',
    nome: 'Bia Lima',
    personal: personalDoJoao,
    ativo: false,
    ultimoAcesso: diasAtras(60),
  });
  conta({ email: 'pedro@exemplo.com', convidadoEm: diasAtras(1) });

  if (tela !== 'perfil')
    perfis.set(EU.id, {
      sexo: 'M',
      nascimento: '2002-05-10',
      alturaCm: 171,
      tipoTrabalho: 'sentado',
      objetivo: 'perder',
      metaSemanal: 6,
    });
  perfis.set('joao', {
    sexo: 'M',
    nascimento: '1995-03-02',
    alturaCm: 180,
    tipoTrabalho: 'bracal',
    objetivo: 'ganhar',
    metaSemanal: 4,
  });
  perfis.set('ana', {
    sexo: 'F',
    nascimento: '1999-08-20',
    alturaCm: 163,
    tipoTrabalho: 'em_pe',
    objetivo: 'perder',
    metaSemanal: 3,
  });

  fichas.set('padrao', { id: 'padrao', userId: null, treinos: structuredClone(treinosPadrao), arquivados: [] });
  // Histórico: duas voltas completas na ficha, a última terminando anteontem.
  semearSessoes(EU.id, [
    { inicio: 15, delta: 0 },
    { inicio: 7, delta: 1 },
  ]);
  semearSessoes('joao', [{ inicio: 10, delta: 0 }]);
  [
    [21, 75.0, 90.0, 7200],
    [14, 74.6, 89.4, 8100],
    [7, 74.1, 88.9, 8600],
  ].forEach(([d, peso, cintura, passos]) => {
    const data = diasAtras(d);
    medicoes.set(`${EU.id}|${data}`, { uid: EU.id, data, peso, cintura, passos });
    medicoes.set(`joao|${data}`, { uid: 'joao', data, peso: peso + 8, cintura: cintura - 4, passos: passos + 2000 });
  });
}
semear();

const espera = () => new Promise((r) => setTimeout(r, 120));
async function rede() {
  await espera();
  if (!navigator.onLine) throw new FalhaServidor('Failed to fetch', true);
  if (!contas.get(EU.email)?.ativo) throw new FalhaServidor('Sem permissão para isso.', false);
}
const negar = () => {
  throw new FalhaServidor('Sem permissão para isso.', false);
};

function podeVer(uid: string) {
  if (uid === EU.id || meuPapel() === 'admin') return true;
  return meuPapel() === 'personal' && contaDe(uid)?.personal === EU.email;
}
function podeEditar(f: { userId: string | null }) {
  const p = meuPapel();
  if (p === 'admin') return true;
  if (f.userId === EU.id) return p === 'personal' || !contas.get(EU.email)!.personal;
  return f.userId != null && p === 'personal' && contaDe(f.userId)?.personal === EU.email;
}
const paraFicha = (f: { id: string; userId: string | null; treinos: Treino[]; arquivados: Treino[] }): Ficha =>
  structuredClone({
    id: f.id,
    userId: f.userId,
    podeEditar: podeEditar(f),
    treinos: f.treinos,
    arquivados: f.arquivados.map(({ id, nome, apelido }) => ({ id, nome, apelido })),
  });
const dosUsuario = <T>(mapa: Map<string, T & { uid: string }>, uid: string) =>
  [...mapa.values()].filter((x) => x.uid === uid).map(({ uid: _u, ...resto }) => resto as unknown as T);
const seriesDe = (uid: string) => [...series.entries()].filter(([k]) => k.startsWith(`${uid}|`)).map(([, s]) => s);

function resumosDe(uid: string): ResumoSessao[] {
  const mapa = new Map<string, ResumoSessao>();
  for (const s of seriesDe(uid)) {
    const chave = `${s.data}|${s.treinoId}`;
    const r = mapa.get(chave) ?? {
      data: s.data,
      treinoId: s.treinoId,
      feitas: 0,
      registradas: 0,
      alteradoEm: s.alteradoEm,
    };
    if (s.feita) r.feitas++;
    if (s.feita || s.reps != null) r.registradas++;
    if (instante(s.alteradoEm) > instante(r.alteradoEm)) r.alteradoEm = s.alteradoEm;
    mapa.set(chave, r);
  }
  return [...mapa.values()].sort((a, b) => (a.data < b.data ? 1 : -1));
}

export function criarServidorDemo(): Servidor {
  return {
    async sessaoAtual() {
      return logado ? EU : null;
    },
    aoMudarSessao(cb) {
      ouvintes.add(cb);
      return () => ouvintes.delete(cb);
    },
    async entrarComGoogle() {
      logado = true;
      ouvintes.forEach((cb) => cb(EU));
    },
    async sair() {
      logado = false;
      ouvintes.forEach((cb) => cb(null));
    },
    async meuAcesso() {
      await espera();
      if (tela === 'convite') return { convidado: false, ativo: false, papel: 'aluno', personal: null };
      const c = contas.get(EU.email)!;
      return { convidado: true, ativo: c.ativo, papel: c.papel, personal: c.personal };
    },

    async ficha(uid = EU.id) {
      await rede();
      if (!podeVer(uid)) negar();
      return paraFicha(copiarPadrao(uid));
    },
    async fichaPadrao() {
      await rede();
      return paraFicha(fichas.get('padrao')!);
    },
    async salvarFicha(fichaId, novos) {
      await rede();
      const f = [...fichas.values()].find((x) => x.id === fichaId);
      if (!f || !podeEditar(f)) negar();
      const ficha = f!;
      const antigos = [...ficha.treinos, ...ficha.arquivados];
      const treinos: Treino[] = novos.map((t, i) => ({
        id: t.id && antigos.some((a) => a.id === t.id) ? t.id : novoId('treino'),
        ordem: i + 1,
        nome: t.nome,
        apelido: t.apelido,
        foco: t.foco,
        cardio: t.cardio,
        exercicios: t.exercicios.map((e, j): ExercicioDoTreino => ({
          ...catalogo.get(e.id)!,
          ordem: j + 1,
          series: e.series,
          repsMin: e.repsMin,
          repsMax: e.repsMax,
          descansoSeg: e.descansoSeg,
        })),
      }));
      const ficaram = new Set(treinos.map((t) => t.id));
      const usados = new Set([...series.values()].map((s) => s.treinoId));
      ficha.arquivados = antigos.filter((t) => !ficaram.has(t.id) && usados.has(t.id));
      ficha.treinos = treinos;
    },

    async catalogo() {
      await rede();
      return {
        grupos: structuredClone(grupos),
        exercicios: [...catalogo.values()].sort((a, b) => a.nome.localeCompare(b.nome)),
      };
    },
    async cadastrarExercicio(e) {
      await rede();
      if (meuPapel() === 'aluno') negar();
      if ([...catalogo.values()].some((x) => x.nome.trim().toLowerCase() === e.nome.trim().toLowerCase()))
        throw new FalhaServidor('Já existe um exercício com esse nome no catálogo.', false);
      const novo = { ...e, nome: e.nome.trim(), id: novoId('ex') };
      catalogo.set(novo.id, novo);
      return novo;
    },
    async alterarExercicio(e) {
      await rede();
      if (meuPapel() !== 'admin') negar();
      catalogo.set(e.id, { ...e });
    },
    async apagarExercicio(id) {
      await rede();
      if (meuPapel() !== 'admin') negar();
      const emUso =
        [...fichas.values()].some((f) =>
          [...f.treinos, ...f.arquivados].some((t) => t.exercicios.some((e) => e.id === id)),
        ) || [...series.values()].some((s) => s.exercicioId === id);
      if (emUso) throw new FalhaServidor('Esse exercício está em uso numa ficha ou no histórico de alguém.', false);
      catalogo.delete(id);
    },

    async perfil(uid) {
      await rede();
      return podeVer(uid) ? (perfis.get(uid) ?? null) : null;
    },
    async salvarPerfil(uid, p) {
      await rede();
      if (uid !== EU.id) negar();
      perfis.set(uid, p);
    },
    async resumos(uid) {
      await rede();
      return podeVer(uid) ? resumosDe(uid) : [];
    },
    async dia(uid, data) {
      await rede();
      return {
        series: seriesDe(uid).filter((s) => s.data === data),
        cardios: dosUsuario(cardios, uid).filter((c) => c.data === data),
      };
    },
    async ultimaVez(data) {
      await rede();
      const minhas = seriesDe(EU.id);
      const ultima = new Map<string, string>();
      for (const s of minhas)
        if (s.data < data && s.reps != null && (ultima.get(s.exercicioId) ?? '') < s.data)
          ultima.set(s.exercicioId, s.data);
      const linhas = minhas
        .filter((s) => s.reps != null && ultima.get(s.exercicioId) === s.data)
        .map((s) => ({
          exercicio_id: s.exercicioId,
          data: s.data,
          indice: s.indice,
          carga: s.carga,
          reps: s.reps as number,
        }));
      return paraUltimaVez(linhas);
    },
    async enviarSeries(uid, novas) {
      await rede();
      for (const s of novas) {
        const atual = series.get(kS(uid, s));
        if (!atual || instante(s.alteradoEm) >= instante(atual.alteradoEm)) series.set(kS(uid, s), { ...s });
      }
    },
    async enviarCardios(uid, novos) {
      await rede();
      for (const c of novos) cardios.set(`${uid}|${c.data}|${c.treinoId}`, { ...c, uid });
    },
    async historico(uid, exercicioId) {
      await rede();
      if (!podeVer(uid)) return [];
      return seriesDe(uid)
        .filter((s) => s.exercicioId === exercicioId && s.reps != null)
        .sort((a, b) => (a.data === b.data ? a.indice - b.indice : a.data < b.data ? 1 : -1));
    },
    async exerciciosFeitos(uid) {
      await rede();
      return podeVer(uid)
        ? [
            ...new Set(
              seriesDe(uid)
                .filter((s) => s.reps != null)
                .map((s) => s.exercicioId),
            ),
          ]
        : [];
    },
    async cardiosRecentes(uid) {
      await rede();
      return podeVer(uid) ? dosUsuario(cardios, uid).filter((c) => c.cardioMin != null) : [];
    },
    async medicoes(uid) {
      await rede();
      if (!podeVer(uid)) return [];
      return dosUsuario<Medicao>(medicoes, uid).sort((a, b) => (a.data < b.data ? -1 : 1));
    },
    async salvarMedicao(uid, m) {
      await rede();
      if (uid !== EU.id) negar();
      medicoes.set(`${uid}|${m.data}`, { ...m, uid });
    },
    async apagarMedicao(uid, data) {
      await rede();
      if (uid !== EU.id) negar();
      medicoes.delete(`${uid}|${data}`);
    },

    async usuarios() {
      await rede();
      const p = meuPapel();
      const hoje = iso(new Date());
      return [...contas.values()]
        .filter((c) => p === 'admin' || c.email === EU.email || (p === 'personal' && c.personal === EU.email))
        .map((c): UsuarioPainel => {
          const rs = c.userId ? resumosDe(c.userId) : [];
          const limite = iso(new Date(parseISO(hoje).getTime() - 27 * 86400_000));
          return {
            email: c.email,
            userId: c.userId,
            nome: c.nome,
            papel: c.papel,
            ativo: c.ativo,
            personal: c.personal,
            convidadoEm: c.convidadoEm,
            ultimoAcesso: c.ultimoAcesso,
            metaSemanal: c.userId ? (perfis.get(c.userId)?.metaSemanal ?? null) : null,
            ultimaSessao: rs[0]?.data ?? null,
            sessoes4Semanas: rs.filter((r) => r.data >= limite).length,
          };
        });
    },
    async convidar(u) {
      await rede();
      if (meuPapel() !== 'admin') negar();
      const email = u.email.trim().toLowerCase();
      if (contas.has(email)) throw new FalhaServidor('Esse e-mail já foi convidado.', false);
      contas.set(email, {
        email,
        userId: null,
        nome: null,
        papel: u.papel,
        ativo: true,
        personal: u.papel === 'aluno' ? u.personal : null,
        convidadoEm: new Date().toISOString(),
        ultimoAcesso: null,
      });
    },
    async alterarUsuario(email, m) {
      await rede();
      if (meuPapel() !== 'admin') negar();
      const c = contas.get(email);
      if (!c || c.papel === 'admin') negar();
      const conta = c!;
      if (m.ativo !== undefined) conta.ativo = m.ativo;
      if (m.personal !== undefined) conta.personal = m.personal;
      if (m.papel !== undefined) {
        if (conta.papel === 'personal' && m.papel !== 'personal')
          for (const a of contas.values()) if (a.personal === email) a.personal = null;
        conta.papel = m.papel;
        if (m.papel !== 'aluno') conta.personal = null;
      }
    },
    async cancelarConvite(email) {
      await rede();
      if (meuPapel() !== 'admin' || contas.get(email)?.userId) negar();
      contas.delete(email);
    },
  };
}
