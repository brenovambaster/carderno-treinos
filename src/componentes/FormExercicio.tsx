import { useState, type FormEvent } from 'react';
import { fmt } from '../lib/formato';
import type { Exercicio, Grupo } from '../lib/tipos';

const INCREMENTOS = [0, 1, 2, 2.5, 5, 10];

type Props = {
  grupos: Grupo[];
  inicial?: Exercicio;
  grupoInicial?: string;
  rotulo: string;
  aoSalvar: (e: Omit<Exercicio, 'id'>) => Promise<void>;
  aoCancelar: () => void;
};

/** Cadastro ou correção de um exercício do catálogo. */
export function FormExercicio({ grupos, inicial, grupoInicial, rotulo, aoSalvar, aoCancelar }: Props) {
  const [nome, setNome] = useState(inicial?.nome ?? '');
  const [grupo, setGrupo] = useState(inicial?.grupo ?? grupoInicial ?? grupos[0]?.id ?? '');
  const [incremento, setIncremento] = useState(inicial?.incremento ?? 2.5);
  const [dica, setDica] = useState(inicial?.dica ?? '');
  const [erro, setErro] = useState('');
  const [salvando, setSalvando] = useState(false);
  const opcoes = INCREMENTOS.includes(incremento) ? INCREMENTOS : [...INCREMENTOS, incremento].sort((a, b) => a - b);

  async function salvar(e: FormEvent) {
    e.preventDefault();
    if (nome.trim().length < 2) {
      setErro('Escreva o nome do exercício.');
      return;
    }
    setSalvando(true);
    setErro('');
    try {
      await aoSalvar({ nome: nome.trim(), grupo, incremento, dica: dica.trim() });
    } catch (err) {
      setErro((err as Error).message || 'Não consegui salvar. Tente de novo.');
      setSalvando(false);
    }
  }

  return (
    <form className="card sub" onSubmit={salvar}>
      <label className="lbl">
        Nome do exercício
        <input
          value={nome}
          maxLength={80}
          onChange={(e) => setNome(e.target.value)}
          placeholder="Ex.: Remada cavalinho"
        />
      </label>
      <div className="row2">
        <label className="lbl">
          Grupo
          <select value={grupo} onChange={(e) => setGrupo(e.target.value)}>
            {grupos.map((g) => (
              <option key={g.id} value={g.id}>
                {g.nome}
              </option>
            ))}
          </select>
        </label>
        <label className="lbl">
          Progressão
          <select value={incremento} onChange={(e) => setIncremento(Number(e.target.value))}>
            {opcoes.map((i) => (
              <option key={i} value={i}>
                {i === 0 ? 'Peso do corpo' : `+${fmt(i)} kg`}
              </option>
            ))}
          </select>
        </label>
      </div>
      <label className="lbl">
        Como fazer (opcional)
        <textarea value={dica} rows={3} maxLength={600} onChange={(e) => setDica(e.target.value)} />
      </label>
      {erro && (
        <p className="erro small" role="alert">
          {erro}
        </p>
      )}
      <div className="btn-row">
        <button type="submit" className="btn small" disabled={salvando}>
          {salvando ? 'Salvando…' : rotulo}
        </button>
        <button type="button" className="btn ghost small" onClick={aoCancelar}>
          Cancelar
        </button>
      </div>
    </form>
  );
}
