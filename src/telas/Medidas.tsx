import { useState, type FormEvent } from 'react';
import { useApp } from '../contexto';
import { Grafico } from '../componentes/Grafico';
import { gravarCache } from '../dados/armazem';
import { ddmm, hojeISO } from '../lib/datas';
import { fmt, num } from '../lib/formato';
import type { Medicao, Objetivo } from '../lib/tipos';

type Campo = 'peso' | 'cintura';

/** Se a variação é boa (true), ruim (false) ou neutra (null) para o objetivo. */
function direcao(objetivo: Objetivo, campo: Campo, delta: number): boolean | null {
  if (delta === 0) return null;
  if (objetivo === 'perder') return delta < 0;
  if (objetivo === 'ganhar' && campo === 'peso') return delta > 0;
  return null;
}

const REGRAS: Record<Objetivo, [string, string][]> = {
  perder: [
    ['Cintura caindo e cargas subindo:', 'está funcionando. Não mude nada, mesmo com o peso parado (é gordura virando músculo).'],
    ['Peso caindo 0,3–0,5 kg por semana:', 'ritmo ideal para perder gordura sem perder músculo.'],
    ['3 semanas sem a cintura cair:', 'corte ~200 kcal por dia (tire o macarrão ou a batata de uma refeição) ou some 2.000 passos por dia.'],
    ['Peso caindo mais de 1 kg por semana e a força caindo:', 'coma ~200 kcal a mais.'],
  ],
  manter: [
    ['Peso variando até 1 kg para cima ou para baixo:', 'está mantendo. Oscilação de um dia para o outro é água.'],
    ['Cargas subindo com o peso parado:', 'está ganhando músculo e perdendo um pouco de gordura.'],
    ['Cintura subindo 2 cm ou mais em um mês:', 'corte ~200 kcal por dia.'],
  ],
  ganhar: [
    ['Peso subindo 0,25–0,5 kg por semana:', 'ritmo bom para ganhar músculo sem acumular muita gordura.'],
    ['3 semanas sem o peso subir:', 'coma ~200 kcal a mais por dia.'],
    ['Cintura subindo mais de 1 cm por mês:', 'o ritmo está rápido demais; tire ~150 kcal por dia.'],
    ['Cargas subindo:', 'é o melhor sinal de que está funcionando.'],
  ],
};

export function TelaMedidas() {
  const { servidor, usuario, perfil, medicoes, alterarMedicoes, online } = useApp();
  const hoje = hojeISO();
  const [form, setForm] = useState({ data: hoje, peso: '', cintura: '', passos: '' });
  const [msg, setMsg] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [confirmar, setConfirmar] = useState<string | null>(null);

  const lista = [...medicoes].sort((a, b) => (a.data < b.data ? -1 : 1));
  const comPeso = lista.filter((m) => m.peso != null);
  const comCintura = lista.filter((m) => m.cintura != null);

  function atualizar(novas: Medicao[]) {
    alterarMedicoes(novas);
    void gravarCache(`medicoes:${usuario.id}`, novas);
  }

  async function salvar(e: FormEvent) {
    e.preventDefault();
    const peso = num(form.peso, 400), cintura = num(form.cintura, 250), passos = num(form.passos, 100000);
    if (!form.data || (peso == null && cintura == null && passos == null)) {
      setMsg('Preencha pelo menos o peso ou a cintura.');
      return;
    }
    const antes = medicoes.find((m) => m.data === form.data);
    const nova: Medicao = {
      data: form.data,
      peso: peso ?? antes?.peso ?? null,
      cintura: cintura ?? antes?.cintura ?? null,
      passos: passos != null ? Math.round(passos) : (antes?.passos ?? null),
    };
    setSalvando(true);
    setMsg('Salvando…');
    try {
      await servidor.salvarMedicao(usuario.id, nova);
      atualizar([...medicoes.filter((m) => m.data !== nova.data), nova]);
      setForm({ data: hoje, peso: '', cintura: '', passos: '' });
      setMsg(`Medidas de ${ddmm(nova.data)} salvas.`);
    } catch {
      setMsg(online ? 'Não consegui salvar agora. Tente de novo em instantes.' : 'Sem conexão: tente de novo quando tiver sinal.');
    } finally {
      setSalvando(false);
    }
  }

  async function apagar(data: string) {
    if (confirmar !== data) {
      setConfirmar(data);
      return;
    }
    setConfirmar(null);
    try {
      await servidor.apagarMedicao(data);
      atualizar(medicoes.filter((m) => m.data !== data));
    } catch {
      setMsg('Não consegui apagar agora. Tente de novo com conexão.');
    }
  }

  const tile = (rotulo: string, arr: Medicao[], campo: Campo, unidade: string) => {
    if (!arr.length)
      return (
        <div className="tile">
          <div className="k">{rotulo}</div>
          <div className="v">–</div>
          <div className="d">sem registro</div>
        </div>
      );
    const a = arr[0][campo] as number, z = arr[arr.length - 1][campo] as number, d = z - a;
    const bom = arr.length < 2 ? null : direcao(perfil.objetivo, campo, d);
    return (
      <div className="tile">
        <div className="k">{rotulo}</div>
        <div className="v">
          {fmt(z)}
          <small>{unidade}</small>
        </div>
        <div className={`d${bom === true ? ' good' : bom === false ? ' bad' : ''}`}>
          {arr.length < 2 ? 'primeiro registro' : `${d > 0 ? '+' : ''}${fmt(d)} ${unidade} desde ${ddmm(arr[0].data)}`}
        </div>
      </div>
    );
  };

  const campoForm = (k: keyof typeof form) => ({
    value: form[k],
    onChange: (e: { target: { value: string } }) => setForm((f) => ({ ...f, [k]: e.target.value })),
    disabled: !online || salvando,
  });

  return (
    <div className="stack">
      <h1 style={{ fontSize: 36, textTransform: 'uppercase' }}>Medidas</h1>
      <div className="tiles">
        {tile('Cintura no umbigo', comCintura, 'cintura', 'cm')}
        {tile('Peso', comPeso, 'peso', 'kg')}
      </div>

      <form className="card" onSubmit={salvar}>
        <h2>Registrar a semana</h2>
        <p className="muted small">
          1x por semana, no mesmo dia: ao acordar, depois do banheiro e antes de comer. Fita na altura do umbigo, sem apertar.
        </p>
        {!online && <p className="aviso">Sem conexão: as medidas precisam de internet para salvar.</p>}
        <div className="row2">
          <label className="lbl" htmlFor="m-data">
            Data
            <input type="date" id="m-data" max={hoje} {...campoForm('data')} />
          </label>
          <label className="lbl" htmlFor="m-peso">
            Peso (kg)
            <input className="n" id="m-peso" inputMode="decimal" placeholder="75,0" autoComplete="off" {...campoForm('peso')} />
          </label>
          <label className="lbl" htmlFor="m-cint">
            Cintura (cm)
            <input className="n" id="m-cint" inputMode="decimal" placeholder="90,0" autoComplete="off" {...campoForm('cintura')} />
          </label>
          <label className="lbl" htmlFor="m-passos">
            Média de passos/dia
            <input className="n" id="m-passos" inputMode="numeric" placeholder="8000" autoComplete="off" {...campoForm('passos')} />
          </label>
        </div>
        <button className="btn" type="submit" disabled={!online || salvando}>
          Salvar medidas
        </button>
        <p className="note" role="status">
          {msg}
        </p>
      </form>

      <div className="card">
        <h2>Cintura (cm)</h2>
        <Grafico pontos={comCintura.map((m) => ({ data: m.data, y: m.cintura as number }))} unidade="cintura" />
      </div>
      <div className="card">
        <h2>Peso (kg)</h2>
        <Grafico pontos={comPeso.map((m) => ({ data: m.data, y: m.peso as number }))} unidade="peso" />
      </div>

      <div className="card">
        <h2>Como ler</h2>
        <ul className="rules">
          {REGRAS[perfil.objetivo].map(([t, d]) => (
            <li key={t}>
              <b>{t}</b> {d}
            </li>
          ))}
        </ul>
      </div>

      <div className="card">
        <h2>Registros</h2>
        {lista.length ? (
          <div className="list">
            {lista
              .slice()
              .reverse()
              .map((m) => (
                <div className="li" key={m.data}>
                  <div>
                    <div className="t">{ddmm(m.data)}</div>
                    <div className="s">
                      {[
                        m.peso != null ? `${fmt(m.peso)} kg` : null,
                        m.cintura != null ? `${fmt(m.cintura)} cm de cintura` : null,
                        m.passos != null ? `${fmt(m.passos, 0)} passos/dia` : null,
                      ]
                        .filter(Boolean)
                        .join(' · ')}
                    </div>
                  </div>
                  <button
                    type="button"
                    className={`btn ${confirmar === m.data ? 'danger' : 'ghost'} small`}
                    disabled={!online}
                    onClick={() => void apagar(m.data)}
                  >
                    {confirmar === m.data ? 'Confirmar' : 'Apagar'}
                  </button>
                </div>
              ))}
          </div>
        ) : (
          <p className="empty">Nenhuma medida ainda. Comece pela cintura: é o melhor sinal de como o corpo está mudando.</p>
        )}
      </div>
    </div>
  );
}
