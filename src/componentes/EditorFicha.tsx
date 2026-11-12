import { useEffect, useMemo, useState } from 'react';
import type { Catalogo } from '../contexto';
import {
  adicionarExercicio,
  adicionarTreino,
  alterarExercicio,
  alterarTreino,
  copiarTreinos,
  LIMITE_APELIDO,
  LIMITE_NOME,
  MAX_TREINOS,
  moverExercicio,
  moverTreino,
  mudou as diferente,
  paraSalvar,
  problemas as verificar,
  removerExercicio,
  removerTreino,
  type Rascunho,
} from '../lib/ficha';
import { DESCANSOS, normalizar, textoDescanso } from '../lib/formato';
import type { Exercicio, Ficha, Treino, TreinoParaSalvar } from '../lib/tipos';
import { FormExercicio } from './FormExercicio';

/** De onde dá para copiar os treinos ao montar uma ficha. */
export type FonteCopia = { id: string; rotulo: string; carregar: () => Promise<Treino[]> };

type Props = {
  ficha: Ficha;
  catalogo: Catalogo;
  podeCadastrar: boolean;
  fontes: FonteCopia[];
  online: boolean;
  aoSalvar: (treinos: TreinoParaSalvar[]) => Promise<void>;
  aoCadastrar: (e: Omit<Exercicio, 'id'>) => Promise<Exercicio>;
};

const faixa = (a: number, b: number) => Array.from({ length: b - a + 1 }, (_, i) => a + i);
const comAtual = (lista: number[], v: number) => (lista.includes(v) ? lista : [...lista, v].sort((x, y) => x - y));

/** A ficha só para ler: quem não pode editar vê tudo o que está nela. */
function FichaSoLeitura({ ficha, catalogo }: { ficha: Ficha; catalogo: Catalogo }) {
  const grupo = (id: string) => catalogo.grupos.find((g) => g.id === id)?.nome ?? '';
  return (
    <>
      {ficha.treinos.map((t) => (
        <div className="card" key={t.id}>
          <h2>
            {t.ordem} · {t.nome}
          </h2>
          {t.foco && <p className="muted small">{t.foco}</p>}
          <div className="list">
            {t.exercicios.map((e) => (
              <div className="li" key={e.id}>
                <div>
                  <div className="t">{e.nome}</div>
                  <div className="s">{grupo(e.grupo)}</div>
                </div>
                <div className="s num">
                  {e.series} × {e.repsMin === e.repsMax ? e.repsMin : `${e.repsMin}–${e.repsMax}`} ·{' '}
                  {textoDescanso(e.descansoSeg)}
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </>
  );
}

export function EditorFicha({ ficha, catalogo, podeCadastrar, fontes, online, aoSalvar, aoCadastrar }: Props) {
  const [rascunho, setRascunho] = useState<Rascunho>(ficha.treinos);
  const [selIdx, setSelIdx] = useState(0);
  const [escolhendo, setEscolhendo] = useState(false);
  const [cadastrando, setCadastrando] = useState(false);
  const [filtroGrupo, setFiltroGrupo] = useState('');
  const [busca, setBusca] = useState('');
  const [fonte, setFonte] = useState(fontes[0]?.id ?? '');
  const [confirmarCopia, setConfirmarCopia] = useState(false);
  const [confirmarRemocao, setConfirmarRemocao] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; texto: string } | null>(null);

  // Ficha nova vinda do servidor (depois de salvar): o rascunho recomeça dela, no mesmo treino.
  useEffect(() => {
    setRascunho(ficha.treinos);
    setSelIdx((i) => Math.min(i, Math.max(0, ficha.treinos.length - 1)));
  }, [ficha]);

  const mudou = diferente(rascunho, ficha.treinos);
  const problemas = useMemo(() => verificar(rascunho), [rascunho]);

  useEffect(() => {
    if (!mudou) return;
    const avisar = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener('beforeunload', avisar);
    return () => window.removeEventListener('beforeunload', avisar);
  }, [mudou]);

  const treino = rascunho[Math.min(selIdx, rascunho.length - 1)];
  const nomeGrupo = (id: string) => catalogo.grupos.find((g) => g.id === id)?.nome ?? '';
  const disponiveis = useMemo(() => {
    if (!treino) return [];
    const ja = new Set(treino.exercicios.map((e) => e.id));
    const q = normalizar(busca);
    return catalogo.exercicios
      .filter(
        (e) => !ja.has(e.id) && (!filtroGrupo || e.grupo === filtroGrupo) && (!q || normalizar(e.nome).includes(q)),
      )
      .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
  }, [catalogo, treino, filtroGrupo, busca]);

  if (!ficha.podeEditar) return <FichaSoLeitura ficha={ficha} catalogo={catalogo} />;

  function mexer(novo: Rascunho) {
    setRascunho(novo);
    setMsg(null);
  }

  function selecionar(i: number) {
    setSelIdx(i);
    setEscolhendo(false);
    setCadastrando(false);
    setConfirmarRemocao(false);
  }

  async function copiar() {
    const f = fontes.find((x) => x.id === fonte);
    if (!f) return;
    if (!confirmarCopia) {
      setConfirmarCopia(true);
      return;
    }
    setConfirmarCopia(false);
    try {
      const treinos = await f.carregar();
      mexer(copiarTreinos(treinos));
      selecionar(0);
      setMsg({ ok: true, texto: `Treinos copiados de "${f.rotulo}". Ajuste o que quiser e salve.` });
    } catch (e) {
      setMsg({ ok: false, texto: (e as Error).message || 'Não consegui copiar agora.' });
    }
  }

  async function salvar() {
    setSalvando(true);
    setMsg(null);
    try {
      await aoSalvar(paraSalvar(rascunho));
      setMsg({ ok: true, texto: 'Ficha salva. Vale a partir da próxima sessão.' });
    } catch (e) {
      setMsg({ ok: false, texto: (e as Error).message || 'Não consegui salvar. Tente de novo.' });
    } finally {
      setSalvando(false);
    }
  }

  return (
    <>
      {fontes.length > 0 && (
        <div className="card">
          <h2>Começar copiando</h2>
          <p className="muted small">
            Troca todos os treinos abaixo pelos da ficha escolhida. Nada é gravado até você salvar.
          </p>
          <div className="copiar">
            <select
              aria-label="Copiar os treinos de"
              value={fonte}
              onChange={(e) => {
                setFonte(e.target.value);
                setConfirmarCopia(false);
              }}
            >
              {fontes.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.rotulo}
                </option>
              ))}
            </select>
            <button
              type="button"
              className={`btn small ${confirmarCopia ? 'danger' : 'ghost'}`}
              onClick={() => void copiar()}
            >
              {confirmarCopia ? 'Trocar todos os treinos' : 'Copiar'}
            </button>
          </div>
        </div>
      )}

      <div className="chips" role="group" aria-label="Treinos da ficha">
        {rascunho.map((t, i) => (
          <button
            key={t.id}
            type="button"
            className="chip"
            aria-pressed={t === treino}
            aria-label={t.nome || `Treino ${t.ordem}`}
            onClick={() => selecionar(i)}
          >
            <b>{t.ordem}</b>
            <small>{t.apelido || '—'}</small>
          </button>
        ))}
        {rascunho.length < MAX_TREINOS && (
          <button
            type="button"
            className="chip add"
            aria-label="Adicionar treino"
            onClick={() => {
              mexer(adicionarTreino(rascunho));
              selecionar(rascunho.length);
            }}
          >
            <b>+</b>
            <small>treino</small>
          </button>
        )}
      </div>

      {treino && (
        <>
          <div className="card">
            <div className="row2">
              <label className="lbl">
                Nome do treino
                <input
                  value={treino.nome}
                  maxLength={LIMITE_NOME}
                  onChange={(e) => mexer(alterarTreino(rascunho, treino.id, { nome: e.target.value }))}
                />
              </label>
              <label className="lbl">
                Nome curto (botão)
                <input
                  value={treino.apelido}
                  maxLength={LIMITE_APELIDO}
                  onChange={(e) => mexer(alterarTreino(rascunho, treino.id, { apelido: e.target.value }))}
                />
              </label>
            </div>
            <label className="lbl">
              Foco
              <input
                value={treino.foco}
                placeholder="Ex.: Peito e costas"
                onChange={(e) => mexer(alterarTreino(rascunho, treino.id, { foco: e.target.value }))}
              />
            </label>
            <label className="lbl">
              Cardio
              <input
                value={treino.cardio}
                placeholder="Ex.: Depois: 20 min de caminhada inclinada"
                onChange={(e) => mexer(alterarTreino(rascunho, treino.id, { cardio: e.target.value }))}
              />
            </label>
            <div className="btn-row">
              <button
                type="button"
                className="btn ghost small"
                disabled={treino.ordem === 1}
                onClick={() => {
                  mexer(moverTreino(rascunho, treino.id, -1));
                  setSelIdx(treino.ordem - 2);
                }}
              >
                ← Antes
              </button>
              <button
                type="button"
                className="btn ghost small"
                disabled={treino.ordem === rascunho.length}
                onClick={() => {
                  mexer(moverTreino(rascunho, treino.id, 1));
                  setSelIdx(treino.ordem);
                }}
              >
                Depois →
              </button>
              {rascunho.length > 1 && (
                <button
                  type="button"
                  className="btn danger small"
                  onClick={() => {
                    if (!confirmarRemocao) {
                      setConfirmarRemocao(true);
                      return;
                    }
                    mexer(removerTreino(rascunho, treino.id));
                    selecionar(Math.max(0, treino.ordem - 2));
                  }}
                >
                  {confirmarRemocao ? 'Remover mesmo' : 'Remover treino'}
                </button>
              )}
            </div>
            {confirmarRemocao && (
              <p className="muted small">
                O histórico desse treino não se perde: as sessões feitas continuam na Evolução.
              </p>
            )}
          </div>

          {treino.exercicios.length === 0 && <p className="empty">Este treino ainda não tem exercícios.</p>}
          {treino.exercicios.map((e, i) => (
            <div className="ex ed" key={e.id}>
              <div className="ex-h">
                <span className="n">{i + 1}</span>
                <div>
                  <h2>{e.nome}</h2>
                  <p>{nomeGrupo(e.grupo)}</p>
                </div>
              </div>
              <div className="ed-grid">
                <label className="lbl">
                  Séries
                  <select
                    value={e.series}
                    onChange={(ev) =>
                      mexer(alterarExercicio(rascunho, treino.id, e.id, { series: Number(ev.target.value) }))
                    }
                  >
                    {faixa(1, 10).map((v) => (
                      <option key={v}>{v}</option>
                    ))}
                  </select>
                </label>
                <label className="lbl">
                  Reps mín.
                  <select
                    value={e.repsMin}
                    onChange={(ev) =>
                      mexer(alterarExercicio(rascunho, treino.id, e.id, { repsMin: Number(ev.target.value) }))
                    }
                  >
                    {comAtual(faixa(1, 30), e.repsMin).map((v) => (
                      <option key={v}>{v}</option>
                    ))}
                  </select>
                </label>
                <label className="lbl">
                  Reps máx.
                  <select
                    value={e.repsMax}
                    onChange={(ev) =>
                      mexer(alterarExercicio(rascunho, treino.id, e.id, { repsMax: Number(ev.target.value) }))
                    }
                  >
                    {comAtual(faixa(1, 50), e.repsMax).map((v) => (
                      <option key={v}>{v}</option>
                    ))}
                  </select>
                </label>
                <label className="lbl">
                  Descanso
                  <select
                    value={e.descansoSeg}
                    onChange={(ev) =>
                      mexer(alterarExercicio(rascunho, treino.id, e.id, { descansoSeg: Number(ev.target.value) }))
                    }
                  >
                    {comAtual(DESCANSOS, e.descansoSeg).map((v) => (
                      <option key={v} value={v}>
                        {textoDescanso(v)}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <div className="btn-row">
                <button
                  type="button"
                  className="btn ghost small"
                  aria-label={`Subir ${e.nome}`}
                  disabled={i === 0}
                  onClick={() => mexer(moverExercicio(rascunho, treino.id, e.id, -1))}
                >
                  ↑ Subir
                </button>
                <button
                  type="button"
                  className="btn ghost small"
                  aria-label={`Descer ${e.nome}`}
                  disabled={i === treino.exercicios.length - 1}
                  onClick={() => mexer(moverExercicio(rascunho, treino.id, e.id, 1))}
                >
                  ↓ Descer
                </button>
                <button
                  type="button"
                  className="btn danger small"
                  aria-label={`Remover ${e.nome}`}
                  onClick={() => mexer(removerExercicio(rascunho, treino.id, e.id))}
                >
                  Remover
                </button>
              </div>
            </div>
          ))}

          {escolhendo ? (
            <div className="card">
              <h2>Adicionar exercício</h2>
              <div className="row2">
                <label className="lbl">
                  Grupo
                  <select value={filtroGrupo} onChange={(e) => setFiltroGrupo(e.target.value)}>
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
              {disponiveis.length ? (
                <div className="escolha">
                  {disponiveis.map((e) => (
                    <button
                      key={e.id}
                      type="button"
                      className="li-btn"
                      onClick={() => mexer(adicionarExercicio(rascunho, treino.id, e))}
                    >
                      <span>{e.nome}</span>
                      <small>{nomeGrupo(e.grupo)} ＋</small>
                    </button>
                  ))}
                </div>
              ) : (
                <p className="empty">Nenhum exercício encontrado.</p>
              )}
              {podeCadastrar &&
                (cadastrando ? (
                  <FormExercicio
                    grupos={catalogo.grupos}
                    grupoInicial={filtroGrupo || undefined}
                    rotulo="Cadastrar e adicionar"
                    aoCancelar={() => setCadastrando(false)}
                    aoSalvar={async (dados) => {
                      const novo = await aoCadastrar(dados);
                      mexer(adicionarExercicio(rascunho, treino.id, novo));
                      setCadastrando(false);
                    }}
                  />
                ) : (
                  <button type="button" className="btn ghost small" onClick={() => setCadastrando(true)}>
                    Não achou? Cadastrar exercício
                  </button>
                ))}
              <button
                type="button"
                className="btn ghost small"
                onClick={() => {
                  setEscolhendo(false);
                  setCadastrando(false);
                }}
              >
                Fechar
              </button>
            </div>
          ) : (
            <button type="button" className="btn ghost" onClick={() => setEscolhendo(true)}>
              + Adicionar exercício
            </button>
          )}
        </>
      )}

      {(mudou || msg) && (
        <div className="salvar-bar">
          {mudou && problemas.length > 0 && (
            <p className="aviso small">
              {problemas[0]}
              {problemas.length > 1 ? ` (e mais ${problemas.length - 1})` : ''}
            </p>
          )}
          {msg && <p className={`small ${msg.ok ? 'ok' : 'erro'}`}>{msg.texto}</p>}
          {!online && mudou && <p className="aviso small">Sem conexão: salvar a ficha precisa de internet.</p>}
          <div className="btn-row">
            <button
              type="button"
              className="btn ghost"
              disabled={!mudou || salvando}
              onClick={() => mexer(ficha.treinos)}
            >
              Descartar
            </button>
            <button
              type="button"
              className="btn"
              disabled={!mudou || problemas.length > 0 || salvando || !online}
              onClick={() => void salvar()}
            >
              {salvando ? 'Salvando…' : 'Salvar ficha'}
            </button>
          </div>
        </div>
      )}
    </>
  );
}
