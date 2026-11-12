import { useState, type ReactNode } from 'react';

function Moldura({ children }: { children: ReactNode }) {
  return (
    <div className="entrada">
      <div className="stack">{children}</div>
    </div>
  );
}

export function TelaLogin({ entrar }: { entrar: () => Promise<void> }) {
  const [erro, setErro] = useState('');
  const [indo, setIndo] = useState(false);
  return (
    <Moldura>
      <h1>Caderno de treino</h1>
      <p className="muted">Registre suas séries, veja a sugestão de carga para o próximo treino e acompanhe a evolução das medidas.</p>
      <button
        type="button"
        className="btn"
        disabled={indo}
        onClick={async () => {
          setIndo(true);
          setErro('');
          try {
            await entrar();
          } catch {
            setErro(navigator.onLine ? 'Não consegui abrir o login do Google. Tente de novo.' : 'Sem conexão: o primeiro acesso precisa de internet.');
            setIndo(false);
          }
        }}
      >
        {indo ? 'Abrindo…' : 'Entrar com Google'}
      </button>
      {erro && (
        <p className="erro small" role="alert">
          {erro}
        </p>
      )}
      <p className="note">O acesso é por convite: entre com o e-mail que foi liberado.</p>
    </Moldura>
  );
}

export function TelaSemConvite({ email, sair, tentarDeNovo }: { email: string; sair: () => void; tentarDeNovo: () => void }) {
  return (
    <Moldura>
      <h1>Falta o convite</h1>
      <p>
        O e-mail <b>{email}</b> ainda não foi liberado. Peça a quem administra o app para adicionar este e-mail e toque em
        “Tentar de novo”.
      </p>
      <div className="btn-row">
        <button type="button" className="btn" onClick={tentarDeNovo}>
          Tentar de novo
        </button>
        <button type="button" className="btn ghost" onClick={sair}>
          Entrar com outra conta
        </button>
      </div>
    </Moldura>
  );
}

export function TelaPrimeiroAcesso({ children }: { children: ReactNode }) {
  return (
    <Moldura>
      <h1>Seu perfil</h1>
      <p className="muted">
        Com esses dados o app calcula suas metas de calorias e proteína. Dá para mudar depois na aba Plano.
      </p>
      {children}
    </Moldura>
  );
}

export function TelaInativo({ email, sair, tentarDeNovo }: { email: string; sair: () => void; tentarDeNovo: () => void }) {
  return (
    <Moldura>
      <h1>Acesso desativado</h1>
      <p>
        O acesso de <b>{email}</b> está desativado. Seus treinos e medidas continuam guardados e voltam quando o acesso for
        reativado. Fale com quem administra o app.
      </p>
      <div className="btn-row">
        <button type="button" className="btn" onClick={tentarDeNovo}>
          Tentar de novo
        </button>
        <button type="button" className="btn ghost" onClick={sair}>
          Entrar com outra conta
        </button>
      </div>
    </Moldura>
  );
}

/** Não deu para carregar e não há cópia no aparelho. `erro` só vem quando há internet. */
export function TelaSemDados({ erro, tentarDeNovo }: { erro?: string; tentarDeNovo: () => void }) {
  return (
    <Moldura>
      {erro ? (
        <>
          <h1>Algo deu errado</h1>
          <p>Não consegui carregar sua ficha e seu perfil. O servidor respondeu:</p>
          <p className="aviso">{erro}</p>
        </>
      ) : (
        <>
          <h1>Sem conexão</h1>
          <p>
            Na primeira vez, o app precisa de internet para baixar a ficha de treino e o seu perfil. Depois disso, a tela de
            treino funciona sem sinal.
          </p>
        </>
      )}
      <button type="button" className="btn" onClick={tentarDeNovo}>
        Tentar de novo
      </button>
    </Moldura>
  );
}
