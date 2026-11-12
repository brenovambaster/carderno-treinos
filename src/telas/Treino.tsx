import { useEffect, useMemo, useState } from 'react';
import { useApp } from '../contexto';
import { CHECK } from '../componentes/Moldura';
import { chaveSerie, enfileirar, gravarCache, lerCache, pendentes, type ItemFila } from '../dados/armazem';
import { listaDoDia, montarDia, type Dia } from '../dados/dia';
import { ddmm, hojeISO } from '../lib/datas';
import { fmt, LIMITE_CARGA, LIMITE_REPS, num } from '../lib/formato';
import { atualizarResumo, proximoTreino, serieRegistrada, sessoesNaSemana, treinoAoAbrir } from '../lib/sequencia';
import { sugerir, type Sugestao } from '../lib/sugestao';
import type { Cardio, Exercicio, Serie, UltimaVez } from '../lib/tipos';

const campo = (n: number | null) => (n == null ? '' : n.toLocaleString('pt-BR', { maximumFractionDigits: 2, useGrouping: false }));
const inteiro = (v: string, max: number) => {
  const n = num(v, max);
  return n == null ? null : Math.round(n);
};

function Dica({ ex, sg }: { ex: Exercicio; sg: Sugestao }) {
  if (sg.tipo === 'primeira') {
    return (
      <div className="hint first">
        Primeira vez: escolha uma carga em que você faça <strong>{ex.repsMin} reps</strong> com 1–2 sobrando.
      </div>
    );
  }
  const ls = sg.ultima.series;
  const mesma = ls.every((s) => s.carga === ls[0].carga);
  const corpo = mesma
    ? (ls[0].carga != null ? `${fmt(ls[0].carga)} kg × ` : '') + ls.map((s) => s.reps).join(' · ')
    : ls.map((s) => (s.carga != null ? `${fmt(s.carga)} kg × ` : '') + s.reps).join(' · ');
  const ultima = (
    <>
      Última vez ({ddmm(sg.ultima.data)}): <strong>{corpo}</strong>
    </>
  );
  if (sg.tipo === 'subir') {
    return (
      <div className="hint up">
        {ultima}
        <br />
        Todas as séries bateram {ex.repsMax}. <strong>Suba a carga: tente {fmt(sg.carga)} kg</strong> (ou o peso mais próximo
        disponível).
      </div>
    );
  }
  if (sg.tipo === 'subir-corpo') {
    return (
      <div className="hint up">
        {ultima}
        <br />
        Todas as séries bateram {ex.repsMax}. <strong>Dificulte:</strong> coloque peso extra ou diminua a ajuda do graviton.
      </div>
    );
  }
  return (
    <div className="hint">
      {ultima}
      <br />
      Mantenha a carga e tente fazer mais repetições.
    </div>
  );
}

export function TelaTreino() {
  const { servidor, usuario, rotina, perfil, resumos, alterarResumos, sync, iniciarDescanso, pedidoAbrir } = useApp();
  const uid = usuario.id;
  const hoje = hojeISO();
  const [data, setData] = useState(hoje);
  const [treinoId, setTreinoId] = useState(() => treinoAoAbrir(rotina, resumos, hoje));
  const [dia, setDia] = useState<Dia | null>(null);
  const [uv, setUv] = useState<UltimaVez>({});
  const [textos, setTextos] = useState<Record<string, string>>({});
  const [tremendo, setTremendo] = useState<string | null>(null);

  // Pedido vindo da Evolução ("Abrir").
  useEffect(() => {
    if (!pedidoAbrir) return;
    setData(pedidoAbrir.data);
    setTreinoId(pedidoAbrir.treinoId);
    window.scrollTo(0, 0);
  }, [pedidoAbrir]);

  // Séries do dia: servidor (ou cópia local) + fila.
  useEffect(() => {
    let vivo = true;
    (async () => {
      let base: { series: Serie[]; cardios: Cardio[] } | undefined;
      try {
        base = await servidor.dia(data);
      } catch {
        base = await lerCache(`dia:${uid}:${data}`);
      }
      const fila = await pendentes(uid);
      if (!vivo) return;
      setDia(montarDia(data, base ?? { series: [], cardios: [] }, fila));
      setTextos({});
    })();
    return () => {
      vivo = false;
    };
  }, [data, uid, servidor]);

  // Última vez de cada exercício antes desta data (base da sugestão).
  useEffect(() => {
    let vivo = true;
    (async () => {
      let v: UltimaVez | undefined;
      try {
        v = await servidor.ultimaVez(data);
        if (data === hojeISO()) void gravarCache(`uv:${uid}`, v);
      } catch {
        v = await lerCache(`uv:${uid}`);
      }
      if (vivo) setUv(v ?? {});
    })();
    return () => {
      vivo = false;
    };
  }, [data, uid, servidor]);

  // Guarda o dia no aparelho e atualiza o resumo da sessão (próximo treino, contador da semana).
  useEffect(() => {
    if (!dia) return;
    const t = setTimeout(() => void gravarCache(`dia:${uid}:${dia.data}`, listaDoDia(dia)), 400);
    alterarResumos((r) => atualizarResumo(r, dia.data, treinoId, Object.values(dia.series)));
    return () => clearTimeout(t);
  }, [dia, treinoId, uid, alterarResumos]);

  const treino = rotina.find((t) => t.id === treinoId) ?? rotina[0];
  const proximo = proximoTreino(rotina, resumos);
  const pronto = dia != null && dia.data === data;
  const sugestoes = useMemo(
    () => Object.fromEntries(treino.exercicios.map((e) => [e.id, sugerir(e, uv[e.id])])),
    [treino, uv],
  );

  const vazia = (ex: Exercicio, i: number): Serie => ({
    data,
    treinoId: treino.id,
    exercicioId: ex.id,
    indice: i,
    carga: null,
    reps: null,
    feita: false,
    alteradoEm: '',
  });
  const seriesDe = (ex: Exercicio): Serie[] =>
    Array.from(
      { length: ex.series },
      (_, i) => dia?.series[chaveSerie({ data, treinoId: treino.id, exercicioId: ex.id, indice: i })] ?? vazia(ex, i),
    );

  function gravar(novas: Serie[], cardio?: Cardio) {
    setDia((d) => {
      if (!d || d.data !== data) return d;
      const n: Dia = { ...d, series: { ...d.series }, cardios: { ...d.cardios } };
      for (const s of novas) n.series[chaveSerie(s)] = s;
      if (cardio) n.cardios[cardio.treinoId] = cardio;
      return n;
    });
    const itens: ItemFila[] = novas.map((s) => ({ tipo: 'serie' as const, ...s }));
    if (cardio) itens.push({ tipo: 'cardio', ...cardio });
    void enfileirar(uid, itens).then(() => sync.agendar());
  }

  function alterar(ex: Exercicio, i: number, mudanca: Partial<Serie>) {
    const atual = seriesDe(ex)[i];
    gravar([{ ...atual, ...mudanca, alteradoEm: new Date().toISOString() }]);
  }

  function phCarga(ex: Exercicio, series: Serie[], i: number, sg: Sugestao): string {
    const anterior = i > 0 ? series[i - 1] : null;
    if (anterior?.feita && anterior.carga != null) return campo(anterior.carga);
    if (sg.carga != null) return campo(sg.carga);
    return ex.incremento === 0 ? '—' : '';
  }
  function phReps(ex: Exercicio, i: number, sg: Sugestao): string {
    if (sg.tipo === 'manter' && sg.reps[i] != null) return String(sg.reps[i]);
    if (sg.tipo === 'subir' || sg.tipo === 'subir-corpo') return '';
    return String(ex.repsMin);
  }

  function marcar(ex: Exercicio, i: number) {
    const series = seriesDe(ex);
    const s = series[i];
    if (s.feita) {
      alterar(ex, i, { feita: false });
      return;
    }
    if (s.reps == null) {
      setTremendo(`${ex.id}-${i}`);
      setTimeout(() => setTremendo(null), 350);
      document.getElementById(`rp-${ex.id}-${i}`)?.focus();
      return;
    }
    let carga = s.carga;
    if (carga == null) {
      const ph = phCarga(ex, series, i, sugestoes[ex.id]);
      const n = num(ph, LIMITE_CARGA);
      if (n != null) {
        carga = n;
        setTextos((t) => ({ ...t, [`kg-${ex.id}-${i}`]: ph }));
      }
    }
    alterar(ex, i, { feita: true, carga });
    const completo = series.every((x, j) => (j === i ? true : x.feita));
    const seguinte = treino.exercicios[treino.exercicios.indexOf(ex) + 1];
    const rotulo = !completo
      ? `próxima: série ${i + 2}`
      : seguinte
        ? `próximo: ${seguinte.nome.split(' (')[0]}`
        : 'último exercício feito';
    if (!(completo && !seguinte)) iniciarDescanso(ex.descansoSeg, rotulo);
  }

  const todas = treino.exercicios.flatMap(seriesDe);
  const feitas = todas.filter((s) => s.feita).length;
  const semana = sessoesNaSemana(resumos, hoje);
  const cardio = dia?.cardios[treino.id];
  const textoCardio = textos.cardio ?? (cardio?.cardioMin != null ? String(cardio.cardioMin) : '');

  return (
    <div className="stack">
      <div className="chips" role="group" aria-label="Escolha o treino">
        {rotina.map((t) => {
          const tem = pronto && Object.values(dia.series).some((s) => s.treinoId === t.id && serieRegistrada(s));
          return (
            <button
              key={t.id}
              type="button"
              className={`chip${tem ? ' has' : ''}${t.id === proximo.id ? ' next' : ''}`}
              aria-pressed={t.id === treino.id}
              aria-label={`${t.nome}${t.id === proximo.id ? ' (próximo treino)' : ''}`}
              onClick={() => {
                setTreinoId(t.id);
                window.scrollTo(0, 0);
              }}
            >
              <b>{t.ordem}</b>
              <small>{t.apelido}</small>
            </button>
          );
        })}
      </div>

      <div className="dayhead">
        <div>
          <h1>{treino.nome}</h1>
          <p className="sub">
            {treino.foco} · {treino.ordem}º da sequência
            {treino.id === proximo.id && <span className="tag">próximo</span>}
          </p>
        </div>
        <div className="meta-row">
          <label className="date" htmlFor="data">
            Data
            <input
              type="date"
              id="data"
              value={data}
              max={hoje}
              onChange={(e) => e.target.value && setData(e.target.value)}
            />
          </label>
          <span className="count">
            <b>
              {feitas}/{todas.length}
            </b>{' '}
            séries · semana: {semana} de {perfil.metaSemanal}
          </span>
        </div>
        <div className="bar" aria-hidden="true">
          <i style={{ width: `${todas.length ? Math.round((feitas / todas.length) * 100) : 0}%` }} />
        </div>
      </div>

      {!pronto ? (
        <p className="empty">Carregando…</p>
      ) : (
        <>
          {treino.exercicios.map((ex, idx) => {
            const sg = sugestoes[ex.id];
            const series = seriesDe(ex);
            const completo = series.every((s) => s.feita);
            return (
              <article key={ex.id} className={`ex${completo ? ' complete' : ''}`} id={`ex-${ex.id}`}>
                <div className="ex-h">
                  <span className="n">{idx + 1}</span>
                  <div>
                    <h2>{ex.nome}</h2>
                    <p>
                      {ex.series} séries · {ex.repsMin}–{ex.repsMax} reps · descanso {ex.descanso}
                    </p>
                  </div>
                </div>
                <Dica ex={ex} sg={sg} />
                <div className="sets">
                  {series.map((s, i) => {
                    const idKg = `kg-${ex.id}-${i}`;
                    const idRp = `rp-${ex.id}-${i}`;
                    const noTopo = s.reps != null && s.reps >= ex.repsMax;
                    return (
                      <div key={i} className={`set${tremendo === `${ex.id}-${i}` ? ' shake' : ''}`}>
                        <span className="sn">{i + 1}</span>
                        <label className="fld">
                          <input
                            className="n"
                            id={idKg}
                            inputMode="decimal"
                            autoComplete="off"
                            aria-label={`Série ${i + 1}, carga em kg`}
                            placeholder={phCarga(ex, series, i, sg)}
                            value={textos[idKg] ?? campo(s.carga)}
                            onChange={(e) => {
                              const v = e.target.value;
                              setTextos((t) => ({ ...t, [idKg]: v }));
                              alterar(ex, i, { carga: num(v, LIMITE_CARGA) });
                            }}
                          />
                          <small>kg</small>
                        </label>
                        <label className="fld">
                          <input
                            className={`n${noTopo ? ' top' : ''}`}
                            id={idRp}
                            inputMode="numeric"
                            autoComplete="off"
                            aria-label={`Série ${i + 1}, repetições`}
                            placeholder={phReps(ex, i, sg)}
                            value={textos[idRp] ?? (s.reps == null ? '' : String(s.reps))}
                            onChange={(e) => {
                              const v = e.target.value;
                              setTextos((t) => ({ ...t, [idRp]: v }));
                              alterar(ex, i, { reps: inteiro(v, LIMITE_REPS) });
                            }}
                          />
                          <small>reps</small>
                        </label>
                        <button
                          type="button"
                          className="done"
                          aria-pressed={s.feita}
                          aria-label={`Marcar série ${i + 1} como feita`}
                          onClick={() => marcar(ex, i)}
                        >
                          {CHECK}
                        </button>
                      </div>
                    );
                  })}
                </div>
                <details>
                  <summary>Como fazer</summary>
                  <p>{ex.dica}</p>
                </details>
              </article>
            );
          })}

          <div className="card">
            <h2>Cardio</h2>
            <p className="muted small">
              {treino.cardio}. Esteira com 8–12% de inclinação, num ritmo em que dá para conversar com esforço.
            </p>
            <label className="lbl" htmlFor="cardio">
              Minutos feitos
              <input
                className="n"
                id="cardio"
                inputMode="numeric"
                autoComplete="off"
                placeholder="20"
                value={textoCardio}
                onChange={(e) => {
                  const v = e.target.value;
                  setTextos((t) => ({ ...t, cardio: v }));
                  gravar([], {
                    data,
                    treinoId: treino.id,
                    cardioMin: inteiro(v, 600),
                    alteradoEm: new Date().toISOString(),
                  });
                }}
              />
            </label>
          </div>
          <p className="note">
            Tudo é salvo sozinho enquanto você digita, mesmo sem sinal: o que não subir fica guardado no aparelho e é
            enviado quando a conexão voltar. Ao marcar uma série, o descanso começa a contar.
          </p>
        </>
      )}
    </div>
  );
}
