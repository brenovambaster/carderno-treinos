import { useEffect, useState } from 'react';
import { useApp } from '../contexto';
import { pendentes } from '../dados/armazem';
import { hojeISO } from '../lib/datas';
import { fmt } from '../lib/formato';
import { calcularMetas, pesoAtual } from '../lib/metas';
import { OBJETIVOS, TIPOS_TRABALHO } from '../lib/tipos';
import { href } from '../rotas';
import { FormPerfil } from './FormPerfil';

export function TelaPlano() {
  const { usuario, perfil, salvarPerfil, medicoes, ficha, acesso, sair, estadoSync } = useApp();
  const [editando, setEditando] = useState(false);
  const [confirmarSaida, setConfirmarSaida] = useState<number | null>(null);
  const peso = pesoAtual(medicoes);
  const m = peso != null ? calcularMetas(perfil, peso, hojeISO()) : null;

  useEffect(() => setConfirmarSaida(null), [estadoSync.pendentes]);

  async function pedirSaida() {
    const n = (await pendentes(usuario.id)).length;
    if (n > 0 && confirmarSaida === null) {
      setConfirmarSaida(n);
      return;
    }
    await sair();
  }

  if (editando) {
    return (
      <div className="stack">
        <h1 className="titulo">Seu perfil</h1>
        <FormPerfil
          inicial={perfil}
          comPeso={false}
          rotuloBotao="Salvar perfil"
          aoCancelar={() => setEditando(false)}
          aoSalvar={async (p) => {
            await salvarPerfil(p);
            setEditando(false);
          }}
        />
        <p className="note">O peso fica em Medidas: as metas usam sempre o último peso registrado.</p>
      </div>
    );
  }

  const textoAjuste =
    perfil.objetivo === 'perder'
      ? <>Comendo ~400 kcal a menos que isso, o corpo tira a diferença da reserva de gordura. A proteína (2 g por kg) faz ele usar gordura, e não músculo.</>
      : perfil.objetivo === 'ganhar'
        ? <>Comendo ~300 kcal a mais que isso, sobra energia para construir músculo sem acumular muita gordura. A proteína (2 g por kg) é a matéria-prima.</>
        : <>Comendo perto disso, o peso fica estável. A proteína (2 g por kg) ajuda a trocar gordura por músculo aos poucos.</>;

  return (
    <div className="stack">
      <h1 className="titulo">Plano</h1>
      {m ? (
        <>
          <div className="tiles">
            <div className="tile">
              <div className="k">Calorias por dia</div>
              <div className="v">
                {fmt(m.kcal, 0)}
                <small>kcal</small>
              </div>
              <div className="d">ponto de partida</div>
            </div>
            <div className="tile">
              <div className="k">Proteína por dia</div>
              <div className="v">
                {m.prot}
                <small>g</small>
              </div>
              <div className="d">mínimo {m.protMin} g</div>
            </div>
          </div>
          <div className="card">
            <h2>De onde vêm esses números</h2>
            <p className="small">
              Com {fmt(m.peso)} kg, {fmt(perfil.alturaCm / 100, 2)} m e {m.idade} anos, seu corpo gasta uns{' '}
              <b>{fmt(m.tmb, 0)} kcal</b> parado. Somando trabalho {TIPOS_TRABALHO[perfil.tipoTrabalho]} e{' '}
              {perfil.metaSemanal} treino{perfil.metaSemanal > 1 ? 's' : ''} por semana, o gasto fica perto de{' '}
              <b>{fmt(m.gasto, 0)} kcal</b>. {textoAjuste}
            </p>
            <p className="muted small">
              É uma estimativa. As metas se atualizam com o último peso registrado em Medidas; quem decide os ajustes é a
              tendência das medidas.
            </p>
          </div>
        </>
      ) : (
        <p className="aviso">Registre seu peso em Medidas para ver as metas de calorias e proteína.</p>
      )}

      <div className="card">
        <h2>Sua ficha</h2>
        <table className="plan">
          <tbody>
            {ficha.treinos.map((t) => (
              <tr key={t.id}>
                <th>{t.ordem}</th>
                <td>
                  <b>{t.nome}</b>
                  <br />
                  <span className="muted">
                    {[
                      t.foco,
                      `${t.exercicios.length} exercício${t.exercicios.length > 1 ? 's' : ''}`,
                      t.cardio.replace('Depois: ', '').replace('Cardio opcional: ', 'opcional: '),
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="muted small">
          O app sempre abre no próximo treino da sequência, em qualquer dia. Descanse quando precisar: nos dias de folga,
          uma caminhada leve de 30 a 60 minutos ajuda a recuperar.
        </p>
        {acesso.personal && !ficha.podeEditar && (
          <p className="muted small">
            Quem monta a sua ficha é o seu personal (<b>{acesso.personal}</b>).
          </p>
        )}
        <div className="btn-row">
          <a className="btn ghost small" href={href({ v: 'ficha' })}>
            {ficha.podeEditar ? 'Editar ficha' : 'Ver ficha completa'}
          </a>
        </div>
      </div>

      <div className="card">
        <h2>Regras do treino</h2>
        <ul className="rules">
          <li><b>Aquecimento:</b> 5 min de esteira + 1–2 séries leves do primeiro exercício (não anote).</li>
          <li><b>Intensidade:</b> termine cada série com 1–2 repetições sobrando. Em máquina e polia, a última série pode ir até a falha.</li>
          <li><b>Progressão:</b> mantenha a carga e vá somando repetições. Quando todas as séries chegarem no topo da faixa, o app avisa: suba a carga e volte para perto do mínimo.</li>
          <li><b>Quanto subir:</b> halteres +1 a 2 kg; barra e máquinas de tronco +2,5 a 5 kg; pernas +5 a 10 kg.</li>
          <li><b>Técnica:</b> desça o peso em 2–3 segundos, sem deixar cair. Carga com técnica ruim não conta.</li>
          <li><b>Semana leve:</b> a cada 8 semanas (ou antes, se o cansaço acumular), faça metade das séries com a mesma carga.</li>
        </ul>
      </div>

      <div className="card">
        <h2>Fora da academia</h2>
        <ul className="rules">
          <li><b>Passos:</b> 8.000–10.000 por dia. Se passa muito tempo sentado, levante a cada hora e caminhe depois do almoço.</li>
          <li><b>Proteína em toda refeição:</b> ovos no café, ~150 g de carne ou frango no almoço e no jantar, e um lanche com iogurte, whey ou atum.</li>
          {perfil.objetivo === 'perder' && (
            <li><b>Dois carboidratos no prato:</b> arroz + macarrão ou batata juntos somam muito. Escolher um e completar com salada corta ~150–200 kcal.</li>
          )}
          {perfil.objetivo === 'ganhar' && (
            <li><b>Um lanche a mais:</b> pão com ovos, banana com aveia ou um sanduíche entre as refeições ajuda a fechar as calorias.</li>
          )}
          <li><b>Sono:</b> 7–8 horas. É no descanso que o músculo cresce.</li>
        </ul>
      </div>

      <div className="card">
        <h2>Seu perfil</h2>
        <p className="small">
          {perfil.sexo === 'M' ? 'Homem' : 'Mulher'} · {m ? `${m.idade} anos · ` : ''}
          {fmt(perfil.alturaCm / 100, 2)} m · trabalho {TIPOS_TRABALHO[perfil.tipoTrabalho]} · {OBJETIVOS[perfil.objetivo]} ·{' '}
          {perfil.metaSemanal} treino{perfil.metaSemanal > 1 ? 's' : ''} por semana
        </p>
        <p className="muted small">{usuario.email}</p>
        {confirmarSaida !== null && (
          <p className="aviso">
            {confirmarSaida} alteraç{confirmarSaida > 1 ? 'ões ainda não foram enviadas' : 'ão ainda não foi enviada'}. Se sair
            agora, elas ficam guardadas neste aparelho e sobem quando você entrar de novo com a mesma conta.
          </p>
        )}
        <div className="btn-row">
          <button type="button" className="btn ghost small" onClick={() => setEditando(true)}>
            Editar perfil
          </button>
          <button type="button" className={`btn ${confirmarSaida !== null ? 'danger' : 'ghost'} small`} onClick={() => void pedirSaida()}>
            {confirmarSaida !== null ? 'Sair mesmo assim' : 'Sair'}
          </button>
        </div>
      </div>
    </div>
  );
}
