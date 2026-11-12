// Aba Usuários (admin) / Alunos (personal): lista, convite e a página de cada usuário.
import FitnessCenterRounded from '@mui/icons-material/FitnessCenterRounded';
import ListAltRounded from '@mui/icons-material/ListAltRounded';
import PersonAddAlt1Rounded from '@mui/icons-material/PersonAddAlt1Rounded';
import Alert from '@mui/material/Alert';
import Avatar from '@mui/material/Avatar';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import Chip from '@mui/material/Chip';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import Divider from '@mui/material/Divider';
import FormControlLabel from '@mui/material/FormControlLabel';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemAvatar from '@mui/material/ListItemAvatar';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemText from '@mui/material/ListItemText';
import MenuItem from '@mui/material/MenuItem';
import Skeleton from '@mui/material/Skeleton';
import Snackbar from '@mui/material/Snackbar';
import Stack from '@mui/material/Stack';
import Switch from '@mui/material/Switch';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { Fragment, useEffect, useState, type FormEvent } from 'react';
import { Atividade } from '../componentes/Atividade';
import { Grafico } from '../componentes/Grafico';
import { Cabecalho, Secao, Vazio } from '../componentes/Pagina';
import { useApp } from '../contexto';
import { ddmm, ddmmaaaa, hojeISO, idade } from '../lib/datas';
import { fmt } from '../lib/formato';
import type { Ficha, Medicao, Papel, Perfil, ResumoSessao, UsuarioPainel } from '../lib/tipos';
import { OBJETIVOS, PAPEIS, TIPOS_TRABALHO } from '../lib/tipos';
import { href } from '../rotas';
import { FONTE_DISPLAY, NUMEROS } from '../tema';
import { PainelEvolucao } from './Evolucao';

const EMAIL_OK = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
type PapelConvite = Exclude<Papel, 'admin'>;

const CORES_AVATAR = ['#1E4FD6', '#0F766E', '#7C3AED', '#B45309', '#BE185D', '#0369A1', '#4D7C0F'];
const corDe = (texto: string) =>
  CORES_AVATAR[[...texto].reduce((a, c) => a + c.charCodeAt(0), 0) % CORES_AVATAR.length];
const iniciais = (u: UsuarioPainel) =>
  (u.nome ?? u.email)
    .split(/[ @.]/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join('');

function AvatarUsuario({ u, tamanho = 40 }: { u: UsuarioPainel; tamanho?: number }) {
  return (
    <Avatar
      sx={{
        width: tamanho,
        height: tamanho,
        fontSize: tamanho * 0.4,
        fontWeight: 700,
        // Inativo fica cinza (em vez de transparente), para as iniciais continuarem legíveis.
        ...(u.ativo
          ? { bgcolor: corDe(u.email), color: '#fff' }
          : { bgcolor: 'background.default', color: 'text.secondary', border: 1, borderColor: 'divider' }),
      }}
    >
      {iniciais(u)}
    </Avatar>
  );
}

function Etiquetas({ u, comPapel = true }: { u: UsuarioPainel; comPapel?: boolean }) {
  return (
    <>
      {comPapel && u.papel !== 'aluno' && (
        <Chip size="small" color="primary" variant="outlined" label={PAPEIS[u.papel]} sx={{ ml: 1, height: 20 }} />
      )}
      {!u.ativo && <Chip size="small" color="error" variant="outlined" label="inativo" sx={{ ml: 1, height: 20 }} />}
    </>
  );
}

function DialogoConvite({
  aberto,
  personais,
  aoFechar,
  aoConvidar,
}: {
  aberto: boolean;
  personais: UsuarioPainel[];
  aoFechar: () => void;
  aoConvidar: (u: { email: string; papel: PapelConvite; personal: string | null }) => Promise<void>;
}) {
  const [email, setEmail] = useState('');
  const [papel, setPapel] = useState<PapelConvite>('aluno');
  const [personal, setPersonal] = useState('');
  const [erro, setErro] = useState('');
  const [indo, setIndo] = useState(false);

  useEffect(() => {
    if (!aberto) return;
    setEmail('');
    setPapel('aluno');
    setPersonal('');
    setErro('');
    setIndo(false);
  }, [aberto]);

  async function enviar(e: FormEvent) {
    e.preventDefault();
    const limpo = email.trim().toLowerCase();
    if (!EMAIL_OK.test(limpo)) {
      setErro('Escreva um e-mail válido.');
      return;
    }
    setIndo(true);
    setErro('');
    try {
      await aoConvidar({ email: limpo, papel, personal: papel === 'aluno' && personal ? personal : null });
    } catch (err) {
      setErro((err as Error).message || 'Não consegui convidar agora.');
      setIndo(false);
    }
  }

  return (
    <Dialog
      open={aberto}
      onClose={indo ? undefined : aoFechar}
      fullWidth
      maxWidth="xs"
      slotProps={{ paper: { component: 'form', onSubmit: enviar } as object }}
    >
      <DialogTitle>Convidar</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ pt: 1 }}>
          <TextField
            autoFocus
            type="email"
            label="E-mail da conta Google"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            slotProps={{ htmlInput: { inputMode: 'email', autoComplete: 'off' } }}
          />
          <TextField select label="Papel" value={papel} onChange={(e) => setPapel(e.target.value as PapelConvite)}>
            <MenuItem value="aluno">Aluno</MenuItem>
            <MenuItem value="personal">Personal</MenuItem>
          </TextField>
          {papel === 'aluno' && (
            <TextField
              select
              label="Personal"
              value={personal}
              onChange={(e) => setPersonal(e.target.value)}
              slotProps={{ select: { displayEmpty: true }, inputLabel: { shrink: true } }}
            >
              <MenuItem value="">Sem personal</MenuItem>
              {personais.map((p) => (
                <MenuItem key={p.email} value={p.email}>
                  {p.nome ?? p.email}
                </MenuItem>
              ))}
            </TextField>
          )}
          {erro && <Alert severity="error">{erro}</Alert>}
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={aoFechar} disabled={indo}>
          Cancelar
        </Button>
        <Button type="submit" variant="contained" loading={indo}>
          Convidar
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export function TelaUsuarios() {
  const { servidor, acesso, usuario, online } = useApp();
  const ehAdmin = acesso.papel === 'admin';
  const [lista, setLista] = useState<UsuarioPainel[] | null | 'erro'>(null);
  const [versao, setVersao] = useState(0);
  const [convidando, setConvidando] = useState(false);
  const [aviso, setAviso] = useState('');

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
    <>
      <Cabecalho
        titulo={ehAdmin ? 'Usuários' : 'Alunos'}
        subtitulo={
          Array.isArray(lista) ? `${mostrados.length} ${ehAdmin ? 'no app' : 'acompanhados por você'}` : undefined
        }
        acao={
          ehAdmin && (
            <Button variant="contained" startIcon={<PersonAddAlt1Rounded />} onClick={() => setConvidando(true)}>
              Convidar
            </Button>
          )
        }
      />
      <Stack direction="row" spacing={1}>
        {ehAdmin && (
          <Button variant="outlined" startIcon={<FitnessCenterRounded />} href={href({ v: 'padrao' })}>
            Ficha padrão
          </Button>
        )}
        <Button variant="outlined" startIcon={<ListAltRounded />} href={href({ v: 'catalogo' })}>
          Catálogo
        </Button>
      </Stack>

      <Card>
        {lista === 'erro' ? (
          <Alert severity="warning" sx={{ m: 2 }}>
            {online ? 'Não consegui carregar a lista agora.' : 'Sem conexão: a lista precisa de internet.'}
          </Alert>
        ) : lista === null ? (
          <Stack spacing={1} sx={{ p: 2 }}>
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} variant="rounded" height={56} />
            ))}
          </Stack>
        ) : mostrados.length === 0 ? (
          <Vazio>
            {ehAdmin ? 'Ninguém por aqui ainda.' : 'Nenhum aluno ligado a você ainda. Quem faz essa ligação é o admin.'}
          </Vazio>
        ) : (
          <List disablePadding>
            {mostrados.map((u, i) => (
              <Fragment key={u.email}>
                {i > 0 && <Divider component="li" variant="inset" />}
                <ListItemButton component="a" href={href({ v: 'usuario', email: u.email })} sx={{ py: 1.25 }}>
                  <ListItemAvatar>
                    <AvatarUsuario u={u} />
                  </ListItemAvatar>
                  <ListItemText
                    primary={
                      <>
                        {u.nome ?? u.email}
                        <Etiquetas u={u} />
                      </>
                    }
                    secondary={[
                      u.nome ? u.email : null,
                      ehAdmin && u.personal ? `personal: ${nomeDe(u.personal)}` : null,
                      u.ultimaSessao ? `último treino ${ddmm(u.ultimaSessao)}` : null,
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                    slotProps={{ primary: { sx: { fontWeight: 600 } }, secondary: { noWrap: true } }}
                    sx={{ minWidth: 0, pr: 1 }}
                  />
                  <Box sx={{ textAlign: 'right', flexShrink: 0 }}>
                    {u.userId ? (
                      <>
                        <Typography
                          sx={{ fontFamily: FONTE_DISPLAY, fontWeight: 700, fontSize: 22, lineHeight: 1, ...NUMEROS }}
                        >
                          {u.sessoes4Semanas}
                          {u.metaSemanal ? (
                            <Typography
                              component="span"
                              sx={{ fontSize: 15, color: 'text.secondary', fontFamily: 'inherit' }}
                            >
                              /{u.metaSemanal * 4}
                            </Typography>
                          ) : null}
                        </Typography>
                        <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                          em 4 semanas
                        </Typography>
                      </>
                    ) : (
                      <Chip size="small" label="ainda não entrou" />
                    )}
                  </Box>
                </ListItemButton>
              </Fragment>
            ))}
          </List>
        )}
      </Card>

      {ehAdmin && (
        <DialogoConvite
          aberto={convidando}
          personais={personais}
          aoFechar={() => setConvidando(false)}
          aoConvidar={async (u) => {
            await servidor.convidar(u);
            setConvidando(false);
            setVersao((v) => v + 1);
            setAviso(`${u.email} foi convidado. É só entrar no app com essa conta do Google.`);
          }}
        />
      )}
      <Snackbar
        open={!!aviso}
        autoHideDuration={5000}
        onClose={() => setAviso('')}
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
      >
        <Alert severity="success" variant="filled" onClose={() => setAviso('')}>
          {aviso}
        </Alert>
      </Snackbar>
    </>
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

  async function mudar(f: () => Promise<void>, depois?: () => void) {
    setIndo(true);
    setErro('');
    try {
      await f();
      setConfirmar(null);
      if (depois) depois();
      else aoMudar();
    } catch (e) {
      setErro((e as Error).message || 'Não consegui salvar agora.');
    } finally {
      setIndo(false);
    }
  }

  return (
    <Secao titulo="Acesso">
      <Stack spacing={2}>
        <Stack direction="row" spacing={2}>
          <TextField
            select
            label="Papel"
            value={u.papel}
            disabled={indo}
            onChange={(e) =>
              void mudar(() => servidor.alterarUsuario(u.email, { papel: e.target.value as PapelConvite }))
            }
          >
            <MenuItem value="aluno">Aluno</MenuItem>
            <MenuItem value="personal">Personal</MenuItem>
          </TextField>
          {u.papel === 'aluno' && (
            <TextField
              select
              label="Personal"
              value={u.personal ?? ''}
              disabled={indo}
              slotProps={{ select: { displayEmpty: true }, inputLabel: { shrink: true } }}
              onChange={(e) => void mudar(() => servidor.alterarUsuario(u.email, { personal: e.target.value || null }))}
            >
              <MenuItem value="">Sem personal</MenuItem>
              {personais
                .filter((p) => p.email !== u.email)
                .map((p) => (
                  <MenuItem key={p.email} value={p.email}>
                    {p.nome ?? p.email}
                  </MenuItem>
                ))}
            </TextField>
          )}
        </Stack>
        {u.papel === 'personal' && (
          <Typography variant="caption" sx={{ color: 'text.secondary' }}>
            Se deixar de ser personal, os alunos dele ficam sem personal e voltam a editar a própria ficha.
          </Typography>
        )}
        <FormControlLabel
          control={
            <Switch
              checked={u.ativo}
              disabled={indo}
              onChange={(_, ligado) =>
                ligado ? void mudar(() => servidor.alterarUsuario(u.email, { ativo: true })) : setConfirmar('desativar')
              }
            />
          }
          label={u.ativo ? 'Acesso ativo' : 'Acesso desativado'}
        />
        {!u.userId && (
          <Button
            color="error"
            variant="outlined"
            onClick={() => setConfirmar('cancelar')}
            sx={{ alignSelf: 'flex-start' }}
          >
            Cancelar convite
          </Button>
        )}
        {erro && <Alert severity="error">{erro}</Alert>}
      </Stack>

      <Dialog open={confirmar !== null} onClose={() => setConfirmar(null)}>
        <DialogTitle>{confirmar === 'desativar' ? 'Desativar o acesso?' : 'Cancelar o convite?'}</DialogTitle>
        <DialogContent>
          <Typography sx={{ color: 'text.secondary' }}>
            {confirmar === 'desativar'
              ? `${u.nome ?? u.email} não entra mais no app. Os treinos e medidas ficam guardados e voltam se reativar.`
              : `${u.email} deixa de ter convite. Dá para convidar de novo depois.`}
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmar(null)}>Voltar</Button>
          <Button
            color="error"
            variant="contained"
            loading={indo}
            onClick={() =>
              confirmar === 'desativar'
                ? void mudar(() => servidor.alterarUsuario(u.email, { ativo: false }))
                : void mudar(
                    () => servidor.cancelarConvite(u.email),
                    () => {
                      location.hash = href({ v: 'usuarios' });
                    },
                  )
            }
          >
            {confirmar === 'desativar' ? 'Desativar' : 'Cancelar convite'}
          </Button>
        </DialogActions>
      </Dialog>
    </Secao>
  );
}

function ResumoPerfil({ perfil }: { perfil: Perfil | null }) {
  return (
    <Secao titulo="Perfil">
      {perfil ? (
        <Typography variant="body2">
          {perfil.sexo === 'M' ? 'Homem' : 'Mulher'} · {idade(perfil.nascimento, hojeISO())} anos ·{' '}
          {fmt(perfil.alturaCm / 100, 2)} m · trabalho {TIPOS_TRABALHO[perfil.tipoTrabalho]} ·{' '}
          {OBJETIVOS[perfil.objetivo]} · {perfil.metaSemanal} treino
          {perfil.metaSemanal > 1 ? 's' : ''} por semana
        </Typography>
      ) : (
        <Typography variant="body2" sx={{ color: 'text.secondary' }}>
          Ainda não preencheu o perfil.
        </Typography>
      )}
    </Secao>
  );
}

function ResumoMedicoes({ medicoes }: { medicoes: Medicao[] }) {
  const comPeso = medicoes.filter((m) => m.peso != null);
  return (
    <Secao titulo="Medidas" subtitulo={medicoes.length ? 'Peso ao longo do tempo' : undefined}>
      {medicoes.length === 0 ? (
        <Vazio>Nenhuma medição registrada.</Vazio>
      ) : (
        <>
          <Grafico pontos={comPeso.map((m) => ({ data: m.data, y: m.peso as number }))} unidade="peso" sufixo=" kg" />
          <List disablePadding>
            {[...medicoes]
              .reverse()
              .slice(0, 8)
              .map((m, i) => (
                <Fragment key={m.data}>
                  {i > 0 && <Divider component="li" />}
                  <ListItem disableGutters>
                    <ListItemText
                      primary={ddmm(m.data)}
                      secondary={[
                        m.peso != null ? `${fmt(m.peso)} kg` : null,
                        m.cintura != null ? `cintura ${fmt(m.cintura)} cm` : null,
                        m.passos != null ? `${fmt(m.passos, 0)} passos` : null,
                      ]
                        .filter(Boolean)
                        .join(' · ')}
                      slotProps={{ primary: { sx: { fontWeight: 600 } } }}
                    />
                  </ListItem>
                </Fragment>
              ))}
          </List>
        </>
      )}
    </Secao>
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
  const voltar = { href: href({ v: 'usuarios' }), rotulo: ehAdmin ? 'Usuários' : 'Alunos' };

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

  if (erro)
    return (
      <>
        <Cabecalho titulo="Usuário" voltar={voltar} />
        <Alert severity="warning">
          {online ? `Não consegui carregar: ${erro}` : 'Sem conexão: esta página precisa de internet.'}
        </Alert>
      </>
    );
  if (!lista)
    return (
      <>
        <Cabecalho titulo={<Skeleton width={200} />} voltar={voltar} />
        <Skeleton variant="rounded" height={200} />
      </>
    );
  if (!u)
    return (
      <>
        <Cabecalho titulo="Usuário" voltar={voltar} />
        <Alert severity="warning">Usuário não encontrado.</Alert>
      </>
    );

  const personais = lista.filter((x) => x.papel === 'personal' && x.ativo);
  const nomePersonal = u.personal ? (lista.find((x) => x.email === u.personal)?.nome ?? u.personal) : null;
  const nomeTreino = (id: string) =>
    dados?.ficha.treinos.find((t) => t.id === id)?.nome ??
    dados?.ficha.arquivados.find((t) => t.id === id)?.nome ??
    'treino';

  return (
    <>
      <Cabecalho voltar={voltar} />
      <Stack direction="row" spacing={2} sx={{ alignItems: 'center' }}>
        <AvatarUsuario u={u} tamanho={60} />
        <Box sx={{ minWidth: 0 }}>
          <Typography variant="h2" component="h1" sx={{ overflowWrap: 'anywhere' }}>
            {u.nome ?? u.email}
          </Typography>
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            {u.nome ? u.email : ''}
          </Typography>
        </Box>
      </Stack>
      <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', rowGap: 1 }}>
        <Chip size="small" color="primary" variant="outlined" label={PAPEIS[u.papel]} />
        {nomePersonal && <Chip size="small" variant="outlined" label={`personal: ${nomePersonal}`} />}
        <Chip size="small" variant="outlined" label={`convidado em ${ddmmaaaa(u.convidadoEm)}`} />
        {u.ultimoAcesso && <Chip size="small" variant="outlined" label={`último acesso ${ddmmaaaa(u.ultimoAcesso)}`} />}
        <Etiquetas u={u} comPapel={false} />
      </Stack>

      {ehAdmin && u.papel !== 'admin' && (
        <ControlesAdmin u={u} personais={personais} aoMudar={() => setVersao((v) => v + 1)} />
      )}

      {!u.userId ? (
        <Alert severity="info">Ainda não entrou no app. A ficha e os dados aparecem depois do primeiro acesso.</Alert>
      ) : !dados ? (
        <Stack spacing={2}>
          <Skeleton variant="rounded" height={280} />
          <Skeleton variant="rounded" height={200} />
        </Stack>
      ) : (
        <>
          <Atividade resumos={dados.resumos} nomeTreino={nomeTreino} metaSemanal={dados.perfil?.metaSemanal} />
          <Secao
            titulo="Ficha de treino"
            acao={
              <Button size="small" href={href({ v: 'ficha-usuario', email: u.email })}>
                {dados.ficha.podeEditar ? 'Editar' : 'Ver'}
              </Button>
            }
          >
            <List disablePadding>
              {dados.ficha.treinos.map((t, i) => (
                <Fragment key={t.id}>
                  {i > 0 && <Divider component="li" variant="inset" />}
                  <ListItem disableGutters>
                    <ListItemAvatar>
                      <Avatar
                        sx={{
                          bgcolor: 'action.selected',
                          color: 'text.primary',
                          fontFamily: FONTE_DISPLAY,
                          fontWeight: 700,
                        }}
                      >
                        {t.ordem}
                      </Avatar>
                    </ListItemAvatar>
                    <ListItemText
                      primary={t.nome}
                      secondary={`${t.exercicios.length} exercício${t.exercicios.length > 1 ? 's' : ''}`}
                      slotProps={{ primary: { sx: { fontWeight: 600 } } }}
                    />
                  </ListItem>
                </Fragment>
              ))}
            </List>
          </Secao>
          <ResumoPerfil perfil={dados.perfil} />
          <ResumoMedicoes medicoes={dados.medicoes} />
          <Typography variant="h3" component="h2" sx={{ pt: 1 }}>
            Evolução
          </Typography>
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
    </>
  );
}
