// Servidor de mentira, só na memória, para `npm run demo` e para testar as telas sem login.
// Parâmetros na URL: ?tela=login | perfil | convite
import { iso, parseISO } from '../../lib/datas';
import { instante } from '../../lib/datas';
import type { Cardio, Medicao, Perfil, ResumoSessao, Rotina, Serie, Usuario } from '../../lib/tipos';
import { FalhaServidor, paraUltimaVez, type Servidor } from '../servidor';
import rotinaJson from './rotina.json';

const rotina = rotinaJson as Rotina;
const tela = new URLSearchParams(location.search).get('tela');
const USUARIO: Usuario = { id: 'demo', email: 'voce@exemplo.com' };

let logado = tela !== 'login';
let perfil: Perfil | null =
  tela === 'perfil'
    ? null
    : { sexo: 'M', nascimento: '2002-05-10', alturaCm: 171, tipoTrabalho: 'sentado', objetivo: 'perder', metaSemanal: 6 };
const series = new Map<string, Serie>();
const cardios = new Map<string, Cardio>();
const medicoes = new Map<string, Medicao>();
const ouvintes = new Set<(u: Usuario | null) => void>();

const k = (s: Serie) => `${s.data}|${s.treinoId}|${s.exercicioId}|${s.indice}`;
const diasAtras = (n: number) => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return iso(d);
};

// Histórico: duas voltas completas na rotina, a última terminando anteontem.
function semear() {
  const voltas = [
    { inicio: 15, delta: 0 },
    { inicio: 7, delta: 1 },
  ];
  for (const { inicio, delta } of voltas) {
    rotina.forEach((t, ti) => {
      const data = diasAtras(inicio - ti);
      const quando = new Date(parseISO(data).getTime() + 19 * 3600_000).toISOString();
      for (const ex of t.exercicios) {
        const base = ex.incremento > 0 ? 10 + ex.ordem * 7.5 : null;
        for (let i = 0; i < ex.series; i++) {
          const reps = ex.id === 'agachamento' && delta ? ex.repsMax : ex.repsMin + delta + (i === 0 ? 1 : 0);
          const carga = base == null ? null : base + delta * ex.incremento * 0.5;
          const s: Serie = { data, treinoId: t.id, exercicioId: ex.id, indice: i, carga, reps, feita: true, alteradoEm: quando };
          series.set(k(s), s);
        }
      }
      if (t.cardio.startsWith('Depois')) cardios.set(`${data}|${t.id}`, { data, treinoId: t.id, cardioMin: 20, alteradoEm: quando });
    });
  }
  [
    [21, 75.0, 90.0, 7200],
    [14, 74.6, 89.4, 8100],
    [7, 74.1, 88.9, 8600],
  ].forEach(([d, peso, cintura, passos]) => {
    const data = diasAtras(d);
    medicoes.set(data, { data, peso, cintura, passos });
  });
}
semear();

const espera = () => new Promise((r) => setTimeout(r, 120));
async function rede() {
  await espera();
  if (!navigator.onLine) throw new FalhaServidor('Failed to fetch', true);
}

export function criarServidorDemo(): Servidor {
  return {
    async sessaoAtual() {
      return logado ? USUARIO : null;
    },
    aoMudarSessao(cb) {
      ouvintes.add(cb);
      return () => ouvintes.delete(cb);
    },
    async entrarComGoogle() {
      logado = true;
      ouvintes.forEach((cb) => cb(USUARIO));
    },
    async sair() {
      logado = false;
      ouvintes.forEach((cb) => cb(null));
    },
    async temConvite() {
      await rede();
      return tela !== 'convite';
    },
    async rotina() {
      await rede();
      return structuredClone(rotina);
    },
    async perfil() {
      await rede();
      return perfil;
    },
    async salvarPerfil(_uid, p) {
      await rede();
      perfil = p;
    },
    async resumos() {
      await rede();
      const mapa = new Map<string, ResumoSessao>();
      for (const s of series.values()) {
        const chave = `${s.data}|${s.treinoId}`;
        const r = mapa.get(chave) ?? { data: s.data, treinoId: s.treinoId, feitas: 0, registradas: 0, alteradoEm: s.alteradoEm };
        if (s.feita) r.feitas++;
        if (s.feita || s.reps != null) r.registradas++;
        if (instante(s.alteradoEm) > instante(r.alteradoEm)) r.alteradoEm = s.alteradoEm;
        mapa.set(chave, r);
      }
      return [...mapa.values()].sort((a, b) => (a.data < b.data ? 1 : -1));
    },
    async dia(data) {
      await rede();
      return {
        series: [...series.values()].filter((s) => s.data === data),
        cardios: [...cardios.values()].filter((c) => c.data === data),
      };
    },
    async ultimaVez(data) {
      await rede();
      const ultima = new Map<string, string>();
      for (const s of series.values())
        if (s.data < data && s.reps != null && (ultima.get(s.exercicioId) ?? '') < s.data) ultima.set(s.exercicioId, s.data);
      const linhas = [...series.values()]
        .filter((s) => s.reps != null && ultima.get(s.exercicioId) === s.data)
        .map((s) => ({ exercicio_id: s.exercicioId, data: s.data, indice: s.indice, carga: s.carga, reps: s.reps as number }));
      return paraUltimaVez(linhas);
    },
    async enviarSeries(_uid, novas) {
      await rede();
      for (const s of novas) {
        const atual = series.get(k(s));
        if (!atual || instante(s.alteradoEm) >= instante(atual.alteradoEm)) series.set(k(s), { ...s });
      }
    },
    async enviarCardios(_uid, novos) {
      await rede();
      for (const c of novos) cardios.set(`${c.data}|${c.treinoId}`, { ...c });
    },
    async historico(exercicioId) {
      await rede();
      return [...series.values()]
        .filter((s) => s.exercicioId === exercicioId && s.reps != null)
        .sort((a, b) => (a.data === b.data ? a.indice - b.indice : a.data < b.data ? 1 : -1));
    },
    async cardiosRecentes() {
      await rede();
      return [...cardios.values()].filter((c) => c.cardioMin != null);
    },
    async medicoes() {
      await rede();
      return [...medicoes.values()].sort((a, b) => (a.data < b.data ? -1 : 1));
    },
    async salvarMedicao(_uid, m) {
      await rede();
      medicoes.set(m.data, { ...m });
    },
    async apagarMedicao(data) {
      await rede();
      medicoes.delete(data);
    },
  };
}
