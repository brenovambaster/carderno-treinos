import { useCallback, useEffect, useMemo, useState } from 'react';
import { AppCtx, type Contexto } from './contexto';
import { Cronometro, useCronometro } from './componentes/Cronometro';
import { Abas, Topo, type Vista } from './componentes/Moldura';
import { gravarCache, lerCache, pendentes, semTipo } from './dados/armazem';
import { ehSemRede, type Servidor } from './dados/servidor';
import { Sincronizador, type EstadoSync } from './dados/sincronizador';
import { hojeISO } from './lib/datas';
import { resumosComPendentes } from './lib/sequencia';
import type { Medicao, Perfil, ResumoSessao, Rotina, Serie, Usuario } from './lib/tipos';
import { TelaLogin, TelaPrimeiroAcesso, TelaSemConvite, TelaSemDados } from './telas/Entrada';
import { TelaEvolucao } from './telas/Evolucao';
import { FormPerfil } from './telas/FormPerfil';
import { TelaMedidas } from './telas/Medidas';
import { TelaPlano } from './telas/Plano';
import { TelaTreino } from './telas/Treino';

const ULTIMO_USUARIO = 'caderno-treino:usuario';
const VISTAS: Vista[] = ['treino', 'evolucao', 'medidas', 'plano'];

type Dados = { rotina: Rotina; perfil: Perfil; resumos: ResumoSessao[]; medicoes: Medicao[] };
type Fase = 'carregando' | 'login' | 'sem-convite' | 'primeiro-acesso' | 'sem-dados' | 'app';

function lerUltimoUsuario(): Usuario | null {
  try {
    return JSON.parse(localStorage.getItem(ULTIMO_USUARIO) ?? 'null');
  } catch {
    return null;
  }
}

function lerVista(): Vista {
  const h = location.hash.replace('#', '') as Vista;
  return VISTAS.includes(h) ? h : 'treino';
}

/** Tira da URL o que o login do Google deixou (?code=...). */
function limparUrl() {
  const url = new URL(location.href);
  let mudou = false;
  for (const p of ['code', 'error', 'error_code', 'error_description', 'state']) {
    if (url.searchParams.has(p)) {
      url.searchParams.delete(p);
      mudou = true;
    }
  }
  if (mudou) history.replaceState(null, '', url.pathname + url.search + url.hash);
}

/** Busca no servidor e guarda uma cópia; sem sinal, usa a cópia. */
async function buscar<T>(chave: string, f: () => Promise<T>): Promise<T | undefined> {
  try {
    const v = await f();
    void gravarCache(chave, v);
    return v;
  } catch {
    return lerCache<T>(chave);
  }
}

async function carregar(servidor: Servidor, u: Usuario): Promise<{ fase: Fase; dados?: Dados }> {
  const convite = await buscar(`convite:${u.id}`, () => servidor.temConvite());
  if (convite === false) return { fase: 'sem-convite' };
  const [rotina, perfil, resumos, medicoes] = await Promise.all([
    buscar('rotina', () => servidor.rotina()),
    buscar(`perfil:${u.id}`, () => servidor.perfil()),
    buscar(`resumos:${u.id}`, () => servidor.resumos()),
    buscar(`medicoes:${u.id}`, () => servidor.medicoes()),
  ]);
  if (!rotina?.length || perfil === undefined) return { fase: 'sem-dados' };
  if (perfil === null) return { fase: 'primeiro-acesso' };
  const daFila = (await pendentes(u.id)).filter((i) => i.tipo === 'serie').map((i) => semTipo(i) as Serie);
  return {
    fase: 'app',
    dados: { rotina, perfil, resumos: resumosComPendentes(resumos ?? [], daFila), medicoes: medicoes ?? [] },
  };
}

export function App({ servidor }: { servidor: Servidor }) {
  const [usuario, setUsuario] = useState<Usuario | null | undefined>(undefined);
  const [fase, setFase] = useState<Fase>('carregando');
  const [dados, setDados] = useState<Dados | null>(null);
  const [tentativa, setTentativa] = useState(0);
  const [online, setOnline] = useState(navigator.onLine);
  const [vista, setVista] = useState<Vista>(lerVista);
  const [estadoSync, setEstadoSync] = useState<EstadoSync>({ estado: 'em-dia', pendentes: 0 });
  const [pedidoAbrir, setPedidoAbrir] = useState<Contexto['pedidoAbrir']>(null);
  const cronometro = useCronometro();

  // Sessão de login. Sem sinal e com o token vencido, segue com o último usuário.
  useEffect(() => {
    let vivo = true;
    (async () => {
      let u: Usuario | null = null;
      try {
        u = await servidor.sessaoAtual();
      } catch (e) {
        if (ehSemRede(e)) u = lerUltimoUsuario();
      }
      limparUrl();
      if (!vivo) return;
      if (u) localStorage.setItem(ULTIMO_USUARIO, JSON.stringify(u));
      setUsuario(u);
    })();
    const parar = servidor.aoMudarSessao((u) => {
      if (u) {
        localStorage.setItem(ULTIMO_USUARIO, JSON.stringify(u));
        setUsuario((atual) => (atual?.id === u.id ? atual : u));
      } else {
        localStorage.removeItem(ULTIMO_USUARIO);
        setUsuario(null);
      }
    });
    return () => {
      vivo = false;
      parar();
    };
  }, [servidor]);

  useEffect(() => {
    if (usuario === undefined) return;
    if (usuario === null) {
      setDados(null);
      setFase('login');
      return;
    }
    let vivo = true;
    setFase('carregando');
    carregar(servidor, usuario).then((r) => {
      if (!vivo) return;
      if (r.dados) setDados(r.dados);
      setFase(r.fase);
    });
    return () => {
      vivo = false;
    };
  }, [usuario, servidor, tentativa]);

  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    const hash = () => {
      setVista(lerVista());
      window.scrollTo(0, 0);
    };
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    window.addEventListener('hashchange', hash);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
      window.removeEventListener('hashchange', hash);
    };
  }, []);

  const uid = usuario?.id;
  const sync = useMemo(() => (uid ? new Sincronizador(uid, servidor, setEstadoSync) : null), [uid, servidor]);
  const ativo = fase === 'app';
  useEffect(() => {
    if (!sync || !ativo) return;
    sync.iniciar();
    return () => sync.parar();
  }, [sync, ativo]);

  useEffect(() => {
    if (uid && dados) void gravarCache(`resumos:${uid}`, dados.resumos);
  }, [uid, dados?.resumos]); // eslint-disable-line react-hooks/exhaustive-deps

  const alterarResumos = useCallback(
    (f: (r: ResumoSessao[]) => ResumoSessao[]) => setDados((d) => (d ? { ...d, resumos: f(d.resumos) } : d)),
    [],
  );
  const alterarMedicoes = useCallback((m: Medicao[]) => setDados((d) => (d ? { ...d, medicoes: m } : d)), []);

  const sair = useCallback(async () => {
    try {
      await servidor.sair();
    } catch {
      /* sem sinal: sai só deste aparelho */
    }
    localStorage.removeItem(ULTIMO_USUARIO);
    setUsuario(null);
  }, [servidor]);

  if (fase === 'carregando' || usuario === undefined) {
    return (
      <>
        <Topo online={online} />
        <div className="carregando">Carregando…</div>
      </>
    );
  }
  if (fase === 'login' || !usuario) return <TelaLogin entrar={() => servidor.entrarComGoogle()} />;
  if (fase === 'sem-convite')
    return <TelaSemConvite email={usuario.email} sair={() => void sair()} tentarDeNovo={() => setTentativa((t) => t + 1)} />;
  if (fase === 'sem-dados') return <TelaSemDados tentarDeNovo={() => setTentativa((t) => t + 1)} />;
  if (fase === 'primeiro-acesso') {
    return (
      <TelaPrimeiroAcesso>
        <FormPerfil
          comPeso
          rotuloBotao="Começar"
          aoSalvar={async (p, peso) => {
            await servidor.salvarPerfil(usuario.id, p);
            if (peso != null) await servidor.salvarMedicao(usuario.id, { data: hojeISO(), peso, cintura: null, passos: null });
            setTentativa((t) => t + 1);
          }}
        />
      </TelaPrimeiroAcesso>
    );
  }
  if (!dados || !sync) return null;

  const ctx: Contexto = {
    servidor,
    usuario,
    rotina: dados.rotina,
    perfil: dados.perfil,
    salvarPerfil: async (p) => {
      await servidor.salvarPerfil(usuario.id, p);
      setDados((d) => (d ? { ...d, perfil: p } : d));
      void gravarCache(`perfil:${usuario.id}`, p);
    },
    resumos: dados.resumos,
    alterarResumos,
    medicoes: dados.medicoes,
    alterarMedicoes,
    sync,
    estadoSync,
    online,
    iniciarDescanso: cronometro.iniciar,
    pedidoAbrir,
    abrirSessao: (data, treinoId) => {
      setPedidoAbrir({ data, treinoId, n: Date.now() });
      location.hash = 'treino';
    },
    sair,
  };

  return (
    <AppCtx.Provider value={ctx}>
      <Topo estado={estadoSync} online={online} />
      <main>
        <div className="wrap">
          <div hidden={vista !== 'treino'}>
            <TelaTreino />
          </div>
          {vista === 'evolucao' && <TelaEvolucao />}
          {vista === 'medidas' && <TelaMedidas />}
          {vista === 'plano' && <TelaPlano />}
        </div>
      </main>
      <Cronometro c={cronometro} />
      <Abas atual={vista} />
    </AppCtx.Provider>
  );
}
