import { useState, type FormEvent } from 'react';
import { hojeISO, idade } from '../lib/datas';
import { num } from '../lib/formato';
import { OBJETIVOS, TIPOS_TRABALHO, type Objetivo, type Perfil, type Sexo, type TipoTrabalho } from '../lib/tipos';

type Props = {
  inicial?: Perfil;
  comPeso: boolean;
  aoSalvar: (p: Perfil, peso: number | null) => Promise<void>;
  aoCancelar?: () => void;
  rotuloBotao: string;
};

export function FormPerfil({ inicial, comPeso, aoSalvar, aoCancelar, rotuloBotao }: Props) {
  const [f, setF] = useState({
    sexo: inicial?.sexo ?? '',
    nascimento: inicial?.nascimento ?? '',
    altura: inicial ? String(inicial.alturaCm).replace('.', ',') : '',
    peso: '',
    tipoTrabalho: inicial?.tipoTrabalho ?? '',
    objetivo: inicial?.objetivo ?? '',
    metaSemanal: String(inicial?.metaSemanal ?? 6),
  });
  const [erro, setErro] = useState('');
  const [salvando, setSalvando] = useState(false);
  const hoje = hojeISO();
  const mudar = (k: keyof typeof f) => (e: { target: { value: string } }) => {
    setErro('');
    setF((x) => ({ ...x, [k]: e.target.value }));
  };

  async function enviar(e: FormEvent) {
    e.preventDefault();
    const altura = num(f.altura);
    const peso = num(f.peso);
    const anos = f.nascimento ? idade(f.nascimento, hoje) : -1;
    let problema = '';
    if (!f.sexo) problema = 'Escolha o sexo (usado no cálculo de calorias).';
    else if (anos < 10 || anos > 100) problema = 'Confira a data de nascimento.';
    else if (altura == null || altura < 100 || altura > 250) problema = 'Altura em centímetros, entre 100 e 250.';
    else if (comPeso && (peso == null || peso < 20 || peso > 400)) problema = 'Peso em kg, entre 20 e 400.';
    else if (!f.tipoTrabalho) problema = 'Escolha como é o seu trabalho.';
    else if (!f.objetivo) problema = 'Escolha o objetivo.';
    if (problema) {
      setErro(problema);
      return;
    }
    setErro('');
    setSalvando(true);
    try {
      await aoSalvar(
        {
          sexo: f.sexo as Sexo,
          nascimento: f.nascimento,
          alturaCm: altura as number,
          tipoTrabalho: f.tipoTrabalho as TipoTrabalho,
          objetivo: f.objetivo as Objetivo,
          metaSemanal: Number(f.metaSemanal),
        },
        comPeso ? peso : null,
      );
    } catch {
      setErro(navigator.onLine ? 'Não consegui salvar agora. Tente de novo.' : 'Sem conexão: o perfil precisa de internet para salvar.');
      setSalvando(false);
    }
  }

  return (
    <form className="card" onSubmit={enviar} noValidate>
      <div className="row2">
        <label className="lbl" htmlFor="p-sexo">
          Sexo
          <select id="p-sexo" value={f.sexo} onChange={mudar('sexo')}>
            <option value="" disabled>
              Escolha
            </option>
            <option value="M">Homem</option>
            <option value="F">Mulher</option>
          </select>
        </label>
        <label className="lbl" htmlFor="p-nasc">
          Nascimento
          <input type="date" id="p-nasc" max={hoje} value={f.nascimento} onChange={mudar('nascimento')} />
        </label>
        <label className="lbl" htmlFor="p-altura">
          Altura (cm)
          <input className="n" id="p-altura" inputMode="decimal" placeholder="171" autoComplete="off" value={f.altura} onChange={mudar('altura')} />
        </label>
        {comPeso && (
          <label className="lbl" htmlFor="p-peso">
            Peso hoje (kg)
            <input className="n" id="p-peso" inputMode="decimal" placeholder="75,0" autoComplete="off" value={f.peso} onChange={mudar('peso')} />
          </label>
        )}
        <label className="lbl" htmlFor="p-trab">
          Trabalho
          <select id="p-trab" value={f.tipoTrabalho} onChange={mudar('tipoTrabalho')}>
            <option value="" disabled>
              Escolha
            </option>
            {Object.entries(TIPOS_TRABALHO).map(([v, r]) => (
              <option key={v} value={v}>
                {r[0].toUpperCase() + r.slice(1)}
              </option>
            ))}
          </select>
        </label>
        <label className="lbl" htmlFor="p-obj">
          Objetivo
          <select id="p-obj" value={f.objetivo} onChange={mudar('objetivo')}>
            <option value="" disabled>
              Escolha
            </option>
            {Object.entries(OBJETIVOS).map(([v, r]) => (
              <option key={v} value={v}>
                {r[0].toUpperCase() + r.slice(1)}
              </option>
            ))}
          </select>
        </label>
        <label className="lbl" htmlFor="p-meta">
          Treinos por semana
          <select id="p-meta" value={f.metaSemanal} onChange={mudar('metaSemanal')}>
            {[1, 2, 3, 4, 5, 6, 7].map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </label>
      </div>
      {erro && (
        <p className="erro small" role="alert">
          {erro}
        </p>
      )}
      <div className="btn-row">
        <button className="btn" type="submit" disabled={salvando}>
          {salvando ? 'Salvando…' : rotuloBotao}
        </button>
        {aoCancelar && (
          <button className="btn ghost" type="button" onClick={aoCancelar} disabled={salvando}>
            Cancelar
          </button>
        )}
      </div>
    </form>
  );
}
