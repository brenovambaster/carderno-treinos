// Aba Usuários (admin) / Alunos (personal): lista, convite e a página de cada usuário.
import { useEffect, useState, type FormEvent } from 'react';
import { useApp } from '../contexto';
import { Grafico } from '../componentes/Grafico';
import { ddmm, ddmmaaaa, hojeISO, idade } from '../lib/datas';
import { fmt } from '../lib/formato';
import type { Ficha, Medicao, Papel, Perfil, ResumoSessao, UsuarioPainel } from '../lib/tipos';
import { OBJETIVOS, PAPEIS, TIPOS_TRABALHO } from '../lib/tipos';
import { href } from '../rotas';
import { PainelEvolucao } from './Evolucao';

const EMAIL_OK = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function Etiquetas({ u }: { u: UsuarioPainel }) {
  return (
    <>
      {u.papel !== 'aluno' && <span className="tag">{PAPEIS[u.papel]}</span>}
      {!u.ativo && <span className="tag off">inativo</span>}
    </>
  );
}

function FormConvite({
  personais,
  aoConvidar,
}: {
  personais: UsuarioPainel[];
  aoConvidar: (u: { email: string; papel: Exclude<Papel, 'admin'>; personal: string | null }) => Promise<void>;
}) {
  const [email, setEmail] = useState('');
  const [papel, setPapel] = useState<Exclude<Papel, 'admin'>>('aluno');
  const [personal, setPersonal] = useState('');
  const [msg, setMsg] = useState<{ ok: boolean; texto: string } | null>(null);
  const [indo, setIndo] = useState(false);
  const [aberto, setAberto] = useState(false);

  async function enviar(e: FormEvent) {
    e.preventDefault();
    const limpo = email.trim().toLowerCase();
    if (!EMAIL_OK.test(limpo)) {
      setMsg({ ok: false, texto: 'Escreva um e-mail válido.' });
      return;
    }
    setIndo(true);
    setMsg(null);
    try {
      await aoConvidar({ email: limpo, papel, personal: papel === 'aluno' && personal ? personal : null });
      setEmail('');
      setAberto(false);
      setMsg({ ok: true, texto: `${limpo} foi convidado. É só entrar no app com essa conta do Google.` });
    } catch (err) {
      setMsg({ ok: false, texto: (err as Error).message || 'Não consegui convidar agora.' });
    } finally {
      setIndo(false);
    }
  }

  if (!aberto) {
    return (
      <>
        {msg?.ok && <p className="small ok">{msg.texto}</p>}
        <button type="button" className="btn" onClick={() => setAberto(true)}>
          Convidar alguém
        </button>
      </>
    );
  }

  return (
    <form className="card" onSubmit={enviar}>
      <h2>Convidar</h2>
      <label className="lbl">
        E-mail da conta Google
        <input
          type="email"
          inputMode="email"
          autoComplete="off"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </label>
      <div className="row2">
        <label className="lbl">
          Papel
          <select value={papel} onChange={(e) => setPapel(e.target.value as Exclude<Papel, 'admin'>)}>
            <option value="aluno">Aluno</option>
            <option value="personal">Personal</option>
          </select>
        </label>
        {papel === 'aluno' && (
          <label className="lbl">
            Personal
            <select value={personal} onChange={(e) => setPersonal(e.target.value)}>
              <option value="">Sem personal</option>
              {personais.map((p) => (
                <option key={p.email} value={p.email}>
                  {p.nome ?? p.email}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>
      {msg && <p className={`small ${msg.ok ? 'ok' : 'erro'}`}>{msg.texto}</p>}
      <div className="btn-row">
        <button type="submit" className="btn" disabled={indo}>
          {indo ? 'Convidando…' : 'Convidar'}
        </button>
        <button type="button" className="btn ghost" onClick={() => setAberto(false)}>
          Cancelar
        </button>
      </div>
    </form>
  );
}

export function TelaUsuarios() {
  const { servidor, acesso, usuario, online } = useApp();
  const ehAdmin = acesso.papel === 'admin';
  const [lista, setLista] = useState<UsuarioPainel[] | null | 'erro'>(null);
  const [versao, setVersao] = useState(0);

  useEffect(() => {
    let vivo = true;
    servidor.usuarios().then(
      (l) => vivo && setLista(l),
      () => vivo && setLista('erro'),
    );
    return () => {
      vivo = false;
    };
  }, [servidor, versao, online]);

  const meuEmail = usuario.email.toLowerCase();
  const mostrados = Array.isArray(lista)
    ? lista
        .filter((u) => ehAdmin || u.personal === meuEmail)
        .sort(
          (a, b) => Number(b.ativo) - Number(a.ativo) || (a.nome ?? a.email).localeCompare(b.nome ?? b.email, 'pt-BR'),
        )
    : [];
  const personais = Array.isArray(lista) ? lista.filter((u) => u.papel === 'personal' && u.ativo) : [];
  const nomeDe = (email: string | null) =>
    (Array.isArray(lista) && lista.find((u) => u.email === email)?.nome) || email;

  return (
    <div className="stack">
      <h1 className="titulo">{ehAdmin ? 'Usuários' : 'Alunos'}</h1>
      <div className="btn-row">
        {ehAdmin && (
          <a className="btn ghost small" href={href({ v: 'padrao' })}>
            Ficha padrão
          </a>
        )}
        <a className="btn ghost small" href={href({ v: 'catalogo' })}>
          Catálogo de exercícios
        </a>
      </div>

      {ehAdmin && Array.isArray(lista) && (
        <FormConvite
          personais={personais}
          aoConvidar={async (u) => {
            await servidor.convidar(u);
            setVersao((v) => v + 1);
          }}
        />
      )}

      <div className="card">
        {lista === 'erro' ? (
          <p className="aviso">
            {online ? 'Não consegui carregar a lista agora.' : 'Sem conexão: a lista precisa de internet.'}
          </p>
        ) : lista === null ? (
          <p className="empty">Carregando…</p>
        ) : mostrados.length === 0 ? (
          <p className="empty">
            {ehAdmin ? 'Ninguém por aqui ainda.' : 'Nenhum aluno ligado a você ainda. Quem faz essa ligação é o admin.'}
          </p>
        ) : (
          <div className="list">
            {mostrados.map((u) => (
              <a className="li li-link" key={u.email} href={href({ v: 'usuario', email: u.email })}>
                <div>
                  <div className="t">
                    {u.nome ?? u.email} <Etiquetas u={u} />
                  </div>
                  <div className="s">
                    {[
                      u.nome ? u.email : null,
                      ehAdmin && u.personal ? `personal: ${nomeDe(u.personal)}` : null,
                      u.ultimaSessao ? `último treino ${ddmm(u.ultimaSessao)}` : null,
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                  </div>
                </div>
                <div className="freq">
                  {u.userId ? (
                    <>
                      <b>
                        {u.sessoes4Semanas}
                        {u.metaSemanal ? <small>/{u.metaSemanal * 4}</small> : null}
                      </b>
                      <small>em 4 semanas</small>
                    </>
                  ) : (
                    <small>ainda não entrou</small>
                  )}
                </div>
              </a>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- página de um usuário

function ControlesAdmin({
  u,
  personais,
  aoMudar,
}: {
  u: UsuarioPainel;
  personais: UsuarioPainel[];
  aoMudar: () => void;
}) {
  const { servidor } = useApp();
  const [confirmar, setConfirmar] = useState<'desativar' | 'cancelar' | null>(null);
  const [erro, setErro] = useState('');
  const [indo, setIndo] = useState(false);

  async function mudar(f: () => Promise<void>) {
    setIndo(true);
    setErro('');
    try {
      await f();
      setConfirmar(null);
      aoMudar();
    } catch (e) {
      setErro((e as Error).message || 'Não consegui salvar agora.');
    } finally {
      setIndo(false);
    }
  }

  return (
    <div className="card">
      <h2>Acesso</h2>
      <div className="row2">
        <label className="lbl">
          Papel
          <select
            value={u.papel}
            disabled={indo}
            onChange={(e) =>
              void mudar(() => servidor.alterarUsuario(u.email, { papel: e.target.value as Exclude<Papel, 'admin'> }))
            }
          >
            <option value="aluno">Aluno</option>
            <option value="personal">Personal</option>
          </select>
        </label>
        {u.papel === 'aluno' && (
          <label className="lbl">
            Personal
            <select
              value={u.personal ?? ''}
              disabled={indo}
              onChange={(e) => void mudar(() => servidor.alterarUsuario(u.email, { personal: e.target.value || null }))}
            >
              <option value="">Sem personal</option>
              {personais
                .filter((p) => p.email !== u.email)
                .map((p) => (
                  <option key={p.email} value={p.email}>
                    {p.nome ?? p.email}
                  </option>
                ))}
            </select>
          </label>
        )}
      </div>
      {u.papel === 'personal' && (
        <p className="muted small">
          Se deixar de ser personal, os alunos dele ficam sem personal e voltam a editar a própria ficha.
        </p>
      )}
      <div className="btn-row">
        {u.ativo ? (
          <button
            type="button"
            className="btn danger small"
            disabled={indo}
            onClick={() =>
              confirmar === 'desativar'
                ? void mudar(() => servidor.alterarUsuario(u.email, { ativo: false }))
                : setConfirmar('desativar')
            }
          >
            {confirmar === 'desativar' ? 'Desativar mesmo' : 'Desativar acesso'}
          </button>
        ) : (
          <button
            type="button"
            className="btn small"
            disabled={indo}
            onClick={() => void mudar(() => servidor.alterarUsuario(u.email, { ativo: true }))}
          >
            Reativar acesso
          </button>
        )}
        {!u.userId && (
          <button
            type="button"
            className="btn danger small"
            disabled={indo}
            onClick={async () => {
              if (confirmar !== 'cancelar') {
                setConfirmar('cancelar');
                return;
              }
              await mudar(() => servidor.cancelarConvite(u.email));
              location.hash = href({ v: 'usuarios' });
            }}
          >
            {confirmar === 'cancelar' ? 'Cancelar mesmo' : 'Cancelar convite'}
          </button>
        )}
      </div>
      {confirmar === 'desativar' && (
        <p className="muted small">
          Desativado, não entra mais no app. Os treinos e medidas ficam guardados e voltam se reativar.
        </p>
      )}
      {erro && <p className="erro small">{erro}</p>}
    </div>
  );
}

function ResumoPerfil({ perfil }: { perfil: Perfil | null }) {
  return (
    <div className="card">
      <h2>Perfil</h2>
      {perfil ? (
        <p className="small">
          {perfil.sexo === 'M' ? 'Homem' : 'Mulher'} · {idade(perfil.nascimento, hojeISO())} anos ·{' '}
          {fmt(perfil.alturaCm / 100, 2)} m · trabalho {TIPOS_TRABALHO[perfil.tipoTrabalho]} ·{' '}
          {OBJETIVOS[perfil.objetivo]} · {perfil.metaSemanal} treino
          {perfil.metaSemanal > 1 ? 's' : ''} por semana
        </p>
      ) : (
        <p className="muted small">Ainda não preencheu o perfil.</p>
      )}
    </div>
  );
}

function ResumoMedicoes({ medicoes }: { medicoes: Medicao[] }) {
  const comPeso = medicoes.filter((m) => m.peso != null);
  return (
    <div className="card">
      <h2>Medidas</h2>
      {medicoes.length === 0 ? (
        <p className="empty">Nenhuma medição registrada.</p>
      ) : (
        <>
          <p className="muted small">Peso (kg)</p>
          <Grafico pontos={comPeso.map((m) => ({ data: m.data, y: m.peso as number }))} unidade="kg" />
          <div className="list">
            {[...medicoes]
              .reverse()
              .slice(0, 8)
              .map((m) => (
                <div className="li" key={m.data}>
                  <div className="t">{ddmm(m.data)}</div>
                  <div className="s num">
                    {[
                      m.peso != null ? `${fmt(m.peso)} kg` : null,
                      m.cintura != null ? `cintura ${fmt(m.cintura)} cm` : null,
                      m.passos != null ? `${fmt(m.passos, 0)} passos` : null,
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                  </div>
                </div>
              ))}
          </div>
        </>
      )}
    </div>
  );
}

type DadosUsuario = { perfil: Perfil | null; medicoes: Medicao[]; resumos: ResumoSessao[]; ficha: Ficha };

export function TelaUsuario({ email }: { email: string }) {
  const { servidor, acesso, catalogo, online } = useApp();
  const ehAdmin = acesso.papel === 'admin';
  const [lista, setLista] = useState<UsuarioPainel[] | null>(null);
  const [dados, setDados] = useState<DadosUsuario | null>(null);
  const [erro, setErro] = useState('');
  const [versao, setVersao] = useState(0);
  const u = lista?.find((x) => x.email === email);

  useEffect(() => {
    let vivo = true;
    servidor.usuarios().then(
      (l) => vivo && setLista(l),
      (e) => vivo && setErro((e as Error).message),
    );
    return () => {
      vivo = false;
    };
  }, [servidor, versao]);

  const uid = u?.userId;
  useEffect(() => {
    if (!uid) return;
    let vivo = true;
    Promise.all([servidor.perfil(uid), servidor.medicoes(uid), servidor.resumos(uid), servidor.ficha(uid)]).then(
      ([perfil, medicoes, resumos, ficha]) => vivo && setDados({ perfil, medicoes, resumos, ficha }),
      (e) => vivo && setErro((e as Error).message),
    );
    return () => {
      vivo = false;
    };
  }, [servidor, uid]);

  const voltar = (
    <a className="voltar" href={href({ v: 'usuarios' })}>
      ← {ehAdmin ? 'Usuários' : 'Alunos'}
    </a>
  );
  if (erro)
    return (
      <div className="stack">
        {voltar}
        <p className="aviso">
          {online ? `Não consegui carregar: ${erro}` : 'Sem conexão: esta página precisa de internet.'}
        </p>
      </div>
    );
  if (!lista)
    return (
      <div className="stack">
        {voltar}
        <p className="empty">Carregando…</p>
      </div>
    );
  if (!u)
    return (
      <div className="stack">
        {voltar}
        <p className="aviso">Usuário não encontrado.</p>
      </div>
    );

  const personais = lista.filter((x) => x.papel === 'personal' && x.ativo);
  const nomePersonal = u.personal ? (lista.find((x) => x.email === u.personal)?.nome ?? u.personal) : null;

  return (
    <div className="stack">
      {voltar}
      <div>
        <h1 className="titulo">{u.nome ?? u.email}</h1>
        <p className="muted small">
          {u.nome ? `${u.email} · ` : ''}
          {PAPEIS[u.papel]}
          {nomePersonal ? ` · personal: ${nomePersonal}` : ''} · convidado em {ddmmaaaa(u.convidadoEm)}
          {u.ultimoAcesso ? ` · último acesso ${ddmmaaaa(u.ultimoAcesso)}` : ''}{' '}
          <Etiquetas u={{ ...u, papel: 'aluno' }} />
        </p>
      </div>

      {ehAdmin && u.papel !== 'admin' && (
        <ControlesAdmin u={u} personais={personais} aoMudar={() => setVersao((v) => v + 1)} />
      )}

      {!u.userId ? (
        <p className="aviso">Ainda não entrou no app. A ficha e os dados aparecem depois do primeiro acesso.</p>
      ) : !dados ? (
        <p className="empty">Carregando…</p>
      ) : (
        <>
          <div className="card">
            <h2>Ficha de treino</h2>
            <table className="plan">
              <tbody>
                {dados.ficha.treinos.map((t) => (
                  <tr key={t.id}>
                    <th>{t.ordem}</th>
                    <td>
                      <b>{t.nome}</b>
                      <br />
                      <span className="muted">
                        {t.exercicios.length} exercício{t.exercicios.length > 1 ? 's' : ''}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="btn-row">
              <a className="btn small" href={href({ v: 'ficha-usuario', email: u.email })}>
                {dados.ficha.podeEditar ? 'Editar ficha' : 'Ver ficha'}
              </a>
            </div>
          </div>
          <ResumoPerfil perfil={dados.perfil} />
          <ResumoMedicoes medicoes={dados.medicoes} />
          <h2 className="secao">Evolução</h2>
          <PainelEvolucao
            servidor={servidor}
            uid={u.userId}
            ficha={dados.ficha}
            catalogo={catalogo}
            resumos={dados.resumos}
            online={online}
          />
        </>
      )}
    </div>
  );
}
