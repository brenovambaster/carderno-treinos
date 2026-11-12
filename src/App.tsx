import { useCallback, useEffect, useMemo, useState } from 'react';
import { AppCtx, type Catalogo, type Contexto } from './contexto';
import { Cronometro, useCronometro } from './componentes/Cronometro';
import { Abas, Topo } from './componentes/Moldura';
import { gravarCache, lerCache, pendentes, semTipo } from './dados/armazem';
import { ehSemRede, type Servidor } from './dados/servidor';
import { Sincronizador, type EstadoSync } from './dados/sincronizador';
import { hojeISO } from './lib/datas';
import { resumosComPendentes } from './lib/sequencia';
import type { Acesso, Ficha, Medicao, Perfil, ResumoSessao, Serie, Usuario } from './lib/tipos';
import { abaDe, href, lerRota, permitida, type Rota } from './rotas';
import { TelaCatalogo } from './telas/Catalogo';
import { TelaLogin, TelaInativo, TelaPrimeiroAcesso, TelaSemConvite, TelaSemDados } from './telas/Entrada';
import { TelaEvolucao } from './telas/Evolucao';
import { TelaFichaPadrao, TelaFichaUsuario, TelaMinhaFicha } from './telas/Fichas';
import { FormPerfil } from './telas/FormPerfil';
import { TelaMedidas } from './telas/Medidas';
import { TelaPlano } from './telas/Plano';
import { TelaTreino } from './telas/Treino';
import { TelaUsuario, TelaUsuarios } from './telas/Usuarios';

const ULTIMO_USUARIO = 'caderno-treino:usuario';

type Dados = {
  acesso: Acesso;
  ficha: Ficha;
  catalogo: Catalogo;
  perfil: Perfil;
  resumos: ResumoSessao[];
  medicoes: Medicao[];
};
type Fase = 'carregando' | 'login' | 'sem-convite' | 'inativo' | 'primeiro-acesso' | 'sem-dados' | 'app';

function lerUltimoUsuario(): Usuario | null {
  try {
    return JSON.parse(localStorage.getItem(ULTIMO_USUARIO) ?? 'null');
  } catch {
    return null;
  }
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

/** Busca no servidor e guarda uma cópia; se falhar, usa a cópia e anota o erro. */
async function buscar<T>(chave: string, f: () => Promise<T>, erros: string[]): Promise<T | undefined> {
  try {
    const v = await f();
    void gravarCache(chave, v);
    return v;
  } catch (e) {
    if (!ehSemRede(e)) erros.push((e as Error).message);
    return lerCache<T>(chave);
  }
}

type Carga = { fase: Fase; dados?: Dados; erro?: string };

async function carregar(servidor: Servidor, u: Usuario): Promise<Carga> {
  const erros: string[] = [];
  const acesso = await buscar(`acesso:${u.id}`, () => servidor.meuAcesso(), erros);
  if (!acesso) return { fase: 'sem-dados', erro: erros[0] };
  if (!acesso.convidado) return { fase: 'sem-convite' };
  if (!acesso.ativo) return { fase: 'inativo' };
  const [ficha, catalogo, perfil, resumos, medicoes] = await Promise.all([
    buscar(`ficha:${u.id}`, () => servidor.ficha(), erros),
    buscar('catalogo', () => servidor.catalogo(), erros),
    buscar(`perfil:${u.id}`, () => servidor.perfil(u.id), erros),
    buscar(`resumos:${u.id}`, () => servidor.resumos(u.id), erros),
    buscar(`medicoes:${u.id}`, () => servidor.medicoes(u.id), erros),
  ]);
  if (!ficha?.treinos?.length || !catalogo || perfil === undefined) return { fase: 'sem-dados', erro: erros[0] };
  if (perfil === null) return { fase: 'primeiro-acesso' };
  const daFila = (await pendentes(u.id)).filter((i) => i.tipo === 'serie').map((i) => semTipo(i) as Serie);
  return {
    fase: 'app',
    dados: {
      acesso,
      ficha,
      catalogo,
      perfil,
      resumos: resumosComPendentes(resumos ?? [], daFila),
      medicoes: medicoes ?? [],
    },
  };
}

export function App({ servidor }: { servidor: Servidor }) {
  const [usuario, setUsuario] = useState<Usuario | null | undefined>(undefined);
  const [fase, setFase] = useState<Fase>('carregando');
  const [erro, setErro] = useState<string | undefined>();
  const [dados, setDados] = useState<Dados | null>(null);
  const [tentativa, setTentativa] = useState(0);
  const [online, setOnline] = useState(navigator.onLine);
  const [rota, setRota] = useState<Rota>(() => lerRota());
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
      setErro(r.erro);
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
      setRota(lerRota());
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

  // Rota que o papel não abre volta para o treino.
  const papel = dados?.acesso.papel;
  useEffect(() => {
    if (papel && !permitida(rota, papel)) location.replace(href({ v: 'treino' }));
  }, [rota, papel]);

  const alterarResumos = useCallback(
    (f: (r: ResumoSessao[]) => ResumoSessao[]) => setDados((d) => (d ? { ...d, resumos: f(d.resumos) } : d)),
    [],
  );
  const alterarMedicoes = useCallback((m: Medicao[]) => setDados((d) => (d ? { ...d, medicoes: m } : d)), []);
  const alterarCatalogo = useCallback((c: Catalogo) => {
    setDados((d) => (d ? { ...d, catalogo: c } : d));
    void gravarCache('catalogo', c);
  }, []);
  const recarregarFicha = useCallback(async () => {
    if (!uid) return;
    const f = await servidor.ficha();
    setDados((d) => (d ? { ...d, ficha: f } : d));
    void gravarCache(`ficha:${uid}`, f);
  }, [servidor, uid]);

  const sair = useCallback(async () => {
    try {
      await servidor.sair();
    } catch {
      /* sem sinal: sai só deste aparelho */
    }
    localStorage.removeItem(ULTIMO_USUARIO);
    setUsuario(null);
  }, [servidor]);

  const deNovo = () => setTentativa((t) => t + 1);

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
    return <TelaSemConvite email={usuario.email} sair={() => void sair()} tentarDeNovo={deNovo} />;
  if (fase === 'inativo') return <TelaInativo email={usuario.email} sair={() => void sair()} tentarDeNovo={deNovo} />;
  if (fase === 'sem-dados') return <TelaSemDados erro={online ? erro : undefined} tentarDeNovo={deNovo} />;
  if (fase === 'primeiro-acesso') {
    return (
      <TelaPrimeiroAcesso>
        <FormPerfil
          comPeso
          rotuloBotao="Começar"
          aoSalvar={async (p, peso) => {
            await servidor.salvarPerfil(usuario.id, p);
            if (peso != null)
              await servidor.salvarMedicao(usuario.id, { data: hojeISO(), peso, cintura: null, passos: null });
            deNovo();
          }}
        />
      </TelaPrimeiroAcesso>
    );
  }
  if (!dados || !sync) return null;

  const ctx: Contexto = {
    servidor,
    usuario,
    acesso: dados.acesso,
    ficha: dados.ficha,
    recarregarFicha,
    catalogo: dados.catalogo,
    alterarCatalogo,
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
    rota,
    iniciarDescanso: cronometro.iniciar,
    pedidoAbrir,
    abrirSessao: (data, treinoId) => {
      setPedidoAbrir({ data, treinoId, n: Date.now() });
      location.hash = 'treino';
    },
    sair,
  };
  const visivel = permitida(rota, dados.acesso.papel) ? rota : ({ v: 'treino' } as Rota);

  return (
    <AppCtx.Provider value={ctx}>
      <Topo estado={estadoSync} online={online} />
      <main>
        <div className="wrap">
          {/* O treino fica montado para não perder o que está sendo digitado ao trocar de aba. */}
          <div hidden={visivel.v !== 'treino'}>
            <TelaTreino />
          </div>
          {visivel.v === 'evolucao' && <TelaEvolucao />}
          {visivel.v === 'medidas' && <TelaMedidas />}
          {visivel.v === 'plano' && <TelaPlano />}
          {visivel.v === 'ficha' && <TelaMinhaFicha />}
          {visivel.v === 'usuarios' && <TelaUsuarios />}
          {visivel.v === 'usuario' && <TelaUsuario key={visivel.email} email={visivel.email} />}
          {visivel.v === 'ficha-usuario' && <TelaFichaUsuario key={visivel.email} email={visivel.email} />}
          {visivel.v === 'padrao' && <TelaFichaPadrao />}
          {visivel.v === 'catalogo' && <TelaCatalogo />}
        </div>
      </main>
      <Cronometro c={cronometro} />
      <Abas atual={abaDe(visivel)} papel={dados.acesso.papel} />
    </AppCtx.Provider>
  );
}
