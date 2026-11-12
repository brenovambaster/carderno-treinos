// Catálogo de exercícios: admin e personal cadastram; só o admin corrige ou apaga.
import { useEffect, useMemo, useState } from 'react';
import { useApp } from '../contexto';
import { FormExercicio } from '../componentes/FormExercicio';
import { normalizar, textoIncremento } from '../lib/formato';
import type { Exercicio } from '../lib/tipos';
import { href } from '../rotas';

const porNome = (a: Exercicio, b: Exercicio) => a.nome.localeCompare(b.nome, 'pt-BR');

export function TelaCatalogo() {
  const { servidor, catalogo, alterarCatalogo, acesso, online } = useApp();
  const ehAdmin = acesso.papel === 'admin';
  const [grupo, setGrupo] = useState('');
  const [busca, setBusca] = useState('');
  const [editando, setEditando] = useState<string | null>(null); // id ou 'novo'
  const [apagando, setApagando] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; texto: string } | null>(null);

  // Pega o que outros cadastraram desde que o app abriu.
  useEffect(() => {
    servidor.catalogo().then(alterarCatalogo, () => undefined);
  }, [servidor]); // eslint-disable-line react-hooks/exhaustive-deps

  const q = normalizar(busca);
  const porGrupo = useMemo(
    () =>
      catalogo.grupos
        .filter((g) => !grupo || g.id === grupo)
        .map((g) => ({
          grupo: g,
          exercicios: catalogo.exercicios
            .filter((e) => e.grupo === g.id && (!q || normalizar(e.nome).includes(q)))
            .sort(porNome),
        }))
        .filter((x) => x.exercicios.length > 0),
    [catalogo, grupo, q],
  );

  async function apagar(e: Exercicio) {
    if (apagando !== e.id) {
      setApagando(e.id);
      return;
    }
    setApagando(null);
    try {
      await servidor.apagarExercicio(e.id);
      alterarCatalogo({ ...catalogo, exercicios: catalogo.exercicios.filter((x) => x.id !== e.id) });
      setMsg({ ok: true, texto: `${e.nome} saiu do catálogo.` });
    } catch (err) {
      setMsg({ ok: false, texto: (err as Error).message || 'Não consegui apagar.' });
    }
  }

  return (
    <div className="stack">
      <a className="voltar" href={href({ v: 'usuarios' })}>
        ← {ehAdmin ? 'Usuários' : 'Alunos'}
      </a>
      <h1 className="titulo">Catálogo</h1>
      <p className="muted small">
        Os exercícios que podem entrar nas fichas.{' '}
        {ehAdmin ? 'Só você corrige ou apaga; personais também cadastram.' : 'Só o admin corrige ou apaga.'}
      </p>
      {!online && <p className="aviso small">Sem conexão: mudar o catálogo precisa de internet.</p>}

      {editando === 'novo' ? (
        <FormExercicio
          grupos={catalogo.grupos}
          grupoInicial={grupo || undefined}
          rotulo="Cadastrar"
          aoCancelar={() => setEditando(null)}
          aoSalvar={async (dados) => {
            const novo = await servidor.cadastrarExercicio(dados);
            alterarCatalogo({ ...catalogo, exercicios: [...catalogo.exercicios, novo].sort(porNome) });
            setEditando(null);
            setMsg({ ok: true, texto: `${novo.nome} entrou no catálogo.` });
          }}
        />
      ) : (
        <button type="button" className="btn" onClick={() => setEditando('novo')}>
          Cadastrar exercício
        </button>
      )}

      <div className="row2">
        <label className="lbl">
          Grupo
          <select value={grupo} onChange={(e) => setGrupo(e.target.value)}>
            <option value="">Todos</option>
            {catalogo.grupos.map((g) => (
              <option key={g.id} value={g.id}>
                {g.nome}
              </option>
            ))}
          </select>
        </label>
        <label className="lbl">
          Buscar
          <input value={busca} placeholder="nome" onChange={(e) => setBusca(e.target.value)} />
        </label>
      </div>
      {msg && <p className={`small ${msg.ok ? 'ok' : 'erro'}`}>{msg.texto}</p>}

      {porGrupo.length === 0 && <p className="empty">Nenhum exercício encontrado.</p>}
      {porGrupo.map(({ grupo: g, exercicios }) => (
        <div className="card" key={g.id}>
          <h2>{g.nome}</h2>
          <div className="list">
            {exercicios.map((e) =>
              editando === e.id ? (
                <FormExercicio
                  key={e.id}
                  grupos={catalogo.grupos}
                  inicial={e}
                  rotulo="Salvar"
                  aoCancelar={() => setEditando(null)}
                  aoSalvar={async (dados) => {
                    const novo = { ...dados, id: e.id };
                    await servidor.alterarExercicio(novo);
                    alterarCatalogo({
                      ...catalogo,
                      exercicios: catalogo.exercicios.map((x) => (x.id === e.id ? novo : x)).sort(porNome),
                    });
                    setEditando(null);
                  }}
                />
              ) : (
                <div className="li" key={e.id}>
                  <div>
                    <div className="t">{e.nome}</div>
                    <div className="s">{textoIncremento(e.incremento)}</div>
                  </div>
                  {ehAdmin && (
                    <div className="btn-row">
                      <button type="button" className="btn ghost small" onClick={() => setEditando(e.id)}>
                        Editar
                      </button>
                      <button type="button" className="btn danger small" onClick={() => void apagar(e)}>
                        {apagando === e.id ? 'Apagar mesmo' : 'Apagar'}
                      </button>
                    </div>
                  )}
                </div>
              ),
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
