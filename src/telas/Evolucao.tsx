import { useEffect, useMemo, useState } from 'react';
import { useApp, type Catalogo } from '../contexto';
import { Grafico } from '../componentes/Grafico';
import type { Servidor } from '../dados/servidor';
import { ddmm, diaDaSemana } from '../lib/datas';
import { fmt } from '../lib/formato';
import { sessaoMaisRecente } from '../lib/sequencia';
import type { Cardio, Ficha, ResumoSessao, Serie } from '../lib/tipos';

type Props = {
  servidor: Servidor;
  uid: string;
  ficha: Ficha;
  catalogo: Catalogo;
  resumos: ResumoSessao[];
  online: boolean;
  /** Só na própria evolução: abre a sessão na tela de treino. */
  abrirSessao?: (data: string, treinoId: string) => void;
};

/** Gráfico e histórico por exercício, mais os treinos registrados. Serve para a própria evolução e para a de um aluno. */
export function PainelEvolucao({ servidor, uid, ficha, catalogo, resumos, online, abrirSessao }: Props) {
  const nomeTreino = (id: string) =>
    ficha.treinos.find((t) => t.id === id)?.nome ??
    ficha.arquivados.find((t) => t.id === id)?.nome ??
    'Treino que saiu da ficha';
  const [feitos, setFeitos] = useState<string[]>([]);
  const [exId, setExId] = useState(() => {
    const ultima = sessaoMaisRecente(resumos);
    return (ficha.treinos.find((t) => t.id === ultima?.treinoId) ?? ficha.treinos[0])?.exercicios[0]?.id ?? '';
  });
  const [historico, setHistorico] = useState<Serie[] | null | 'erro'>(null);
  const [cardios, setCardios] = useState<Cardio[]>([]);

  const naFicha = useMemo(() => new Set(ficha.treinos.flatMap((t) => t.exercicios.map((e) => e.id))), [ficha]);
  const foraDaFicha = catalogo.exercicios.filter((e) => feitos.includes(e.id) && !naFicha.has(e.id));
  const ex =
    catalogo.exercicios.find((e) => e.id === exId) ??
    ficha.treinos.flatMap((t) => t.exercicios).find((e) => e.id === exId);
  const peloCorpo = ex?.incremento === 0;

  useEffect(() => {
    servidor.exerciciosFeitos(uid).then(setFeitos, () => undefined);
    servidor.cardiosRecentes(uid).then(setCardios, () => undefined);
  }, [servidor, uid]);

  useEffect(() => {
    if (!exId) return;
    let vivo = true;
    setHistorico(null);
    servidor
      .historico(uid, exId)
      .then((h) => vivo && setHistorico(h))
      .catch(() => vivo && setHistorico('erro'));
    return () => {
      vivo = false;
    };
  }, [exId, servidor, uid, online]);

  const linhas = useMemo(() => {
    if (!Array.isArray(historico)) return [];
    const porData = new Map<string, Serie[]>();
    for (const s of historico) porData.set(s.data, [...(porData.get(s.data) ?? []), s]);
    return [...porData.entries()]
      .sort((a, b) => (a[0] < b[0] ? 1 : -1))
      .map(([data, series]) => {
        const ordenadas = series.sort((a, b) => a.indice - b.indice);
        const cargas = ordenadas.map((s) => s.carga).filter((c): c is number => c != null);
        const y =
          peloCorpo || cargas.length === 0 ? Math.max(...ordenadas.map((s) => s.reps ?? 0)) : Math.max(...cargas);
        return { data, series: ordenadas, y };
      });
  }, [historico, peloCorpo]);

  const recentes = resumos.filter((r) => r.registradas > 0).slice(0, 20);
  const cardioDe = (data: string, treinoId: string) =>
    cardios.find((c) => c.data === data && c.treinoId === treinoId)?.cardioMin ?? null;

  return (
    <>
      <div className="card">
        <label className="lbl" htmlFor={`exsel-${uid}`}>
          Exercício
          <select id={`exsel-${uid}`} value={exId} onChange={(e) => setExId(e.target.value)}>
            {ficha.treinos.map((t) => (
              <optgroup key={t.id} label={`${t.ordem} · ${t.nome}`}>
                {t.exercicios.map((x) => (
                  <option key={x.id} value={x.id}>
                    {x.nome}
                  </option>
                ))}
              </optgroup>
            ))}
            {foraDaFicha.length > 0 && (
              <optgroup label="Fora da ficha (com histórico)">
                {foraDaFicha.map((x) => (
                  <option key={x.id} value={x.id}>
                    {x.nome}
                  </option>
                ))}
              </optgroup>
            )}
          </select>
        </label>
        <p className="muted small">
          {peloCorpo ? 'Maior número de repetições em cada treino.' : 'Maior carga usada em cada treino (kg).'}
        </p>
        {historico === 'erro' ? (
          <p className="aviso">
            {online
              ? 'Não consegui carregar agora. Tente de novo em instantes.'
              : 'Sem conexão: a evolução precisa de internet.'}
          </p>
        ) : historico === null ? (
          <p className="empty">Carregando…</p>
        ) : (
          <>
            <Grafico
              pontos={linhas
                .slice()
                .reverse()
                .map((l) => ({ data: l.data, y: l.y }))}
              unidade={peloCorpo ? 'repetições' : 'kg'}
            />
            {linhas.length ? (
              <div className="list">
                {linhas.slice(0, 12).map((l) => (
                  <div className="li" key={l.data}>
                    <div>
                      <div className="t">{ddmm(l.data)}</div>
                      <div className="s">{diaDaSemana(l.data)}</div>
                    </div>
                    <div className="sets-sum">
                      {l.series.map((s) => (s.carga != null ? `${fmt(s.carga)}×` : '') + s.reps).join(' · ')}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="empty">Ainda não há registros deste exercício.</p>
            )}
          </>
        )}
      </div>

      <div className="card">
        <h2>Treinos registrados</h2>
        {recentes.length ? (
          <div className="list">
            {recentes.map((r) => {
              const t = ficha.treinos.find((x) => x.id === r.treinoId);
              const total = t ? t.exercicios.reduce((a, e) => a + e.series, 0) : r.registradas;
              const c = cardioDe(r.data, r.treinoId);
              return (
                <div className="li" key={`${r.data}|${r.treinoId}`}>
                  <div>
                    <div className="t">
                      {ddmm(r.data)} · {nomeTreino(r.treinoId)}
                    </div>
                    <div className="s">
                      {r.feitas} de {total} séries{c ? ` · ${c} min de cardio` : ''}
                    </div>
                  </div>
                  {abrirSessao && t && (
                    <button type="button" className="btn ghost small" onClick={() => abrirSessao(r.data, r.treinoId)}>
                      Abrir
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <p className="empty">
            Nenhum treino registrado ainda. Eles aparecem aqui assim que a primeira série for anotada.
          </p>
        )}
      </div>
    </>
  );
}

export function TelaEvolucao() {
  const { servidor, usuario, ficha, catalogo, resumos, online, abrirSessao } = useApp();
  return (
    <div className="stack">
      <h1 className="titulo">Evolução</h1>
      <PainelEvolucao
        servidor={servidor}
        uid={usuario.id}
        ficha={ficha}
        catalogo={catalogo}
        resumos={resumos}
        online={online}
        abrirSessao={abrirSessao}
      />
    </div>
  );
}
