import { useEffect, useMemo, useState } from 'react';
import { useApp } from '../contexto';
import { Grafico } from '../componentes/Grafico';
import { ddmm, diaDaSemana } from '../lib/datas';
import { fmt } from '../lib/formato';
import { sessaoMaisRecente } from '../lib/sequencia';
import type { Cardio, Serie } from '../lib/tipos';

export function TelaEvolucao() {
  const { servidor, rotina, resumos, online, abrirSessao } = useApp();
  const exercicios = useMemo(() => rotina.flatMap((t) => t.exercicios), [rotina]);
  const [exId, setExId] = useState(() => {
    const ultima = sessaoMaisRecente(resumos);
    return (rotina.find((t) => t.id === ultima?.treinoId) ?? rotina[0]).exercicios[0].id;
  });
  const [historico, setHistorico] = useState<Serie[] | null | 'erro'>(null);
  const [cardios, setCardios] = useState<Cardio[]>([]);
  const ex = exercicios.find((e) => e.id === exId) ?? exercicios[0];

  useEffect(() => {
    let vivo = true;
    setHistorico(null);
    servidor
      .historico(exId)
      .then((h) => vivo && setHistorico(h))
      .catch(() => vivo && setHistorico('erro'));
    return () => {
      vivo = false;
    };
  }, [exId, servidor, online]);

  useEffect(() => {
    servidor.cardiosRecentes().then(setCardios, () => undefined);
  }, [servidor]);

  const linhas = useMemo(() => {
    if (!Array.isArray(historico)) return [];
    const porData = new Map<string, Serie[]>();
    for (const s of historico) porData.set(s.data, [...(porData.get(s.data) ?? []), s]);
    return [...porData.entries()]
      .sort((a, b) => (a[0] < b[0] ? 1 : -1))
      .map(([data, series]) => {
        const ordenadas = series.sort((a, b) => a.indice - b.indice);
        const cargas = ordenadas.map((s) => s.carga).filter((c): c is number => c != null);
        const y = ex.incremento === 0 || cargas.length === 0 ? Math.max(...ordenadas.map((s) => s.reps ?? 0)) : Math.max(...cargas);
        return { data, series: ordenadas, y };
      });
  }, [historico, ex]);

  const recentes = resumos.filter((r) => r.registradas > 0).slice(0, 20);
  const cardioDe = (data: string, treinoId: string) =>
    cardios.find((c) => c.data === data && c.treinoId === treinoId)?.cardioMin ?? null;

  return (
    <div className="stack">
      <h1 style={{ fontSize: 36, textTransform: 'uppercase' }}>Evolução</h1>
      <div className="card">
        <label className="lbl" htmlFor="exsel">
          Exercício
          <select id="exsel" value={exId} onChange={(e) => setExId(e.target.value)}>
            {rotina.map((t) => (
              <optgroup key={t.id} label={`${t.ordem} · ${t.nome}`}>
                {t.exercicios.map((x) => (
                  <option key={x.id} value={x.id}>
                    {x.nome}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </label>
        <p className="muted small">
          {ex.incremento === 0 ? 'Maior número de repetições em cada treino.' : 'Maior carga usada em cada treino (kg).'}
        </p>
        {historico === 'erro' ? (
          <p className="aviso">{online ? 'Não consegui carregar agora. Tente de novo em instantes.' : 'Sem conexão: a evolução precisa de internet.'}</p>
        ) : historico === null ? (
          <p className="empty">Carregando…</p>
        ) : (
          <>
            <Grafico
              pontos={linhas
                .slice()
                .reverse()
                .map((l) => ({ data: l.data, y: l.y }))}
              unidade={ex.incremento === 0 ? 'repetições' : 'kg'}
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
              const t = rotina.find((x) => x.id === r.treinoId);
              const total = t ? t.exercicios.reduce((a, e) => a + e.series, 0) : r.registradas;
              const c = cardioDe(r.data, r.treinoId);
              return (
                <div className="li" key={`${r.data}|${r.treinoId}`}>
                  <div>
                    <div className="t">
                      {ddmm(r.data)} · {t?.nome ?? r.treinoId}
                    </div>
                    <div className="s">
                      {r.feitas} de {total} séries{c ? ` · ${c} min de cardio` : ''}
                    </div>
                  </div>
                  <button type="button" className="btn ghost small" onClick={() => abrirSessao(r.data, r.treinoId)}>
                    Abrir
                  </button>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="empty">Nenhum treino registrado ainda. Eles aparecem aqui assim que você anotar a primeira série.</p>
        )}
      </div>
    </div>
  );
}
