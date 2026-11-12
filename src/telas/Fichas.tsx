// As três telas que editam uma Ficha de treino: a própria, a de um usuário e a Ficha padrão.
import Alert from '@mui/material/Alert';
import Skeleton from '@mui/material/Skeleton';
import { useCallback, useEffect, useState } from 'react';
import { EditorFicha, type FonteCopia } from '../componentes/EditorFicha';
import { Cabecalho } from '../componentes/Pagina';
import { useApp } from '../contexto';
import type { Exercicio, Ficha, UsuarioPainel } from '../lib/tipos';
import { href } from '../rotas';

/** Cadastrar exercício a partir do editor: grava e já põe no catálogo da memória. */
function useCadastrar() {
  const { servidor, catalogo, alterarCatalogo } = useApp();
  return useCallback(
    async (e: Omit<Exercicio, 'id'>) => {
      const novo = await servidor.cadastrarExercicio(e);
      alterarCatalogo({
        ...catalogo,
        exercicios: [...catalogo.exercicios, novo].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')),
      });
      return novo;
    },
    [servidor, catalogo, alterarCatalogo],
  );
}

const NOTA_EDICAO =
  'Mudanças valem a partir da próxima sessão. O histórico de um exercício que sai da ficha continua na Evolução.';

export function TelaMinhaFicha() {
  const { servidor, ficha, catalogo, acesso, recarregarFicha, online } = useApp();
  const cadastrar = useCadastrar();
  return (
    <>
      <Cabecalho
        titulo="Sua ficha"
        voltar={{ href: href({ v: 'plano' }), rotulo: 'Perfil' }}
        subtitulo={
          ficha.podeEditar
            ? NOTA_EDICAO
            : `Quem monta a sua ficha é o seu personal${acesso.personal ? ` (${acesso.personal})` : ''}. Aqui você vê tudo o que está nela.`
        }
      />
      <EditorFicha
        ficha={ficha}
        catalogo={catalogo}
        podeCadastrar={acesso.papel !== 'aluno'}
        online={online}
        fontes={[
          { id: 'padrao', rotulo: 'Ficha padrão', carregar: async () => (await servidor.fichaPadrao()).treinos },
        ]}
        aoCadastrar={cadastrar}
        aoSalvar={async (treinos) => {
          await servidor.salvarFicha(ficha.id, treinos);
          await recarregarFicha();
        }}
      />
    </>
  );
}

export function TelaFichaPadrao() {
  const { servidor, catalogo, online } = useApp();
  const cadastrar = useCadastrar();
  const [ficha, setFicha] = useState<Ficha | null>(null);
  const [erro, setErro] = useState('');

  useEffect(() => {
    servidor.fichaPadrao().then(setFicha, (e) => setErro((e as Error).message));
  }, [servidor]);

  return (
    <>
      <Cabecalho
        titulo="Ficha padrão"
        voltar={{ href: href({ v: 'usuarios' }), rotulo: 'Usuários' }}
        subtitulo="Quem entra no app pela primeira vez recebe uma cópia desta ficha. Mudar aqui não muda a ficha de quem já tem a sua."
      />
      {erro ? (
        <Alert severity="warning">
          {online ? `Não consegui abrir a ficha: ${erro}` : 'Sem conexão: a ficha padrão precisa de internet.'}
        </Alert>
      ) : !ficha ? (
        <Skeleton variant="rounded" height={320} />
      ) : (
        <EditorFicha
          ficha={ficha}
          catalogo={catalogo}
          podeCadastrar
          online={online}
          fontes={[]}
          aoCadastrar={cadastrar}
          aoSalvar={async (treinos) => {
            await servidor.salvarFicha(ficha.id, treinos);
            setFicha(await servidor.fichaPadrao());
          }}
        />
      )}
    </>
  );
}

export function TelaFichaUsuario({ email }: { email: string }) {
  const { servidor, usuario, catalogo, acesso, online } = useApp();
  const cadastrar = useCadastrar();
  const [alvo, setAlvo] = useState<UsuarioPainel | null | undefined>(undefined);
  const [outros, setOutros] = useState<UsuarioPainel[]>([]);
  const [ficha, setFicha] = useState<Ficha | null>(null);
  const [erro, setErro] = useState('');

  useEffect(() => {
    let vivo = true;
    (async () => {
      try {
        const lista = await servidor.usuarios();
        const u = lista.find((x) => x.email === email) ?? null;
        if (!vivo) return;
        setAlvo(u);
        // De quem dá para copiar: admin, de todo mundo; personal, dos alunos dele.
        setOutros(
          lista.filter(
            (x) =>
              x.userId && x.email !== email && (acesso.papel === 'admin' || x.personal === usuario.email.toLowerCase()),
          ),
        );
        if (u?.userId) {
          const f = await servidor.ficha(u.userId);
          if (vivo) setFicha(f);
        }
      } catch (e) {
        if (vivo) setErro((e as Error).message);
      }
    })();
    return () => {
      vivo = false;
    };
  }, [servidor, email, acesso.papel, usuario.email]);

  const nome = alvo?.nome ?? email;
  const fontes: FonteCopia[] = [
    { id: 'padrao', rotulo: 'Ficha padrão', carregar: async () => (await servidor.fichaPadrao()).treinos },
    ...outros.map((o) => ({
      id: o.email,
      rotulo: `Ficha de ${o.nome ?? o.email}`,
      carregar: async () => (await servidor.ficha(o.userId!)).treinos,
    })),
  ];

  return (
    <>
      <Cabecalho
        titulo={`Ficha de ${nome.split(/[ @]/)[0]}`}
        voltar={{ href: href({ v: 'usuario', email }), rotulo: nome }}
        subtitulo={ficha ? (ficha.podeEditar ? NOTA_EDICAO : 'Você pode ver esta ficha, mas não alterar.') : undefined}
      />
      {erro ? (
        <Alert severity="warning">
          {online ? `Não consegui abrir a ficha: ${erro}` : 'Sem conexão: a ficha precisa de internet.'}
        </Alert>
      ) : alvo === undefined || (alvo?.userId && !ficha) ? (
        <Skeleton variant="rounded" height={320} />
      ) : !alvo ? (
        <Alert severity="warning">Usuário não encontrado.</Alert>
      ) : !alvo.userId || !ficha ? (
        <Alert severity="info">{nome} ainda não entrou no app. A ficha aparece depois do primeiro acesso.</Alert>
      ) : (
        <EditorFicha
          ficha={ficha}
          catalogo={catalogo}
          podeCadastrar={acesso.papel !== 'aluno'}
          online={online}
          fontes={fontes}
          aoCadastrar={cadastrar}
          aoSalvar={async (treinos) => {
            await servidor.salvarFicha(ficha.id, treinos);
            setFicha(await servidor.ficha(alvo.userId!));
          }}
        />
      )}
    </>
  );
}
