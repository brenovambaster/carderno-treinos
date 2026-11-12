// Editor da Ficha de treino: treinos em abas, exercícios em cartões, busca no catálogo para adicionar.
import AddCircleOutlineRounded from '@mui/icons-material/AddCircleOutlineRounded';
import AddRounded from '@mui/icons-material/AddRounded';
import ArrowBackRounded from '@mui/icons-material/ArrowBackRounded';
import ArrowDownwardRounded from '@mui/icons-material/ArrowDownwardRounded';
import ArrowForwardRounded from '@mui/icons-material/ArrowForwardRounded';
import ArrowUpwardRounded from '@mui/icons-material/ArrowUpwardRounded';
import ContentCopyRounded from '@mui/icons-material/ContentCopyRounded';
import DeleteOutlineRounded from '@mui/icons-material/DeleteOutlineRounded';
import SearchRounded from '@mui/icons-material/SearchRounded';
import Alert from '@mui/material/Alert';
import Avatar from '@mui/material/Avatar';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import CardHeader from '@mui/material/CardHeader';
import Chip from '@mui/material/Chip';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import Divider from '@mui/material/Divider';
import Grid from '@mui/material/Grid';
import IconButton from '@mui/material/IconButton';
import InputAdornment from '@mui/material/InputAdornment';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemText from '@mui/material/ListItemText';
import MenuItem from '@mui/material/MenuItem';
import Paper from '@mui/material/Paper';
import Snackbar from '@mui/material/Snackbar';
import Stack from '@mui/material/Stack';
import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';
import TextField from '@mui/material/TextField';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import useMediaQuery from '@mui/material/useMediaQuery';
import { Fragment, useEffect, useMemo, useState } from 'react';
import type { Catalogo } from '../contexto';
import {
  adicionarExercicio,
  adicionarTreino,
  alterarExercicio,
  alterarTreino,
  copiarTreinos,
  LIMITE_APELIDO,
  LIMITE_NOME,
  MAX_TREINOS,
  moverExercicio,
  moverTreino,
  mudou as diferente,
  paraSalvar,
  problemas as verificar,
  removerExercicio,
  removerTreino,
  type Rascunho,
} from '../lib/ficha';
import { DESCANSOS, normalizar, textoDescanso } from '../lib/formato';
import type { Exercicio, Ficha, Treino, TreinoParaSalvar } from '../lib/tipos';
import { FONTE_DISPLAY } from '../tema';
import { DialogoExercicio } from './FormExercicio';
import { ALTURA_ABAS } from './Moldura';
import { Secao, Vazio } from './Pagina';

/** De onde dá para copiar os treinos ao montar uma ficha. */
export type FonteCopia = { id: string; rotulo: string; carregar: () => Promise<Treino[]> };

type Props = {
  ficha: Ficha;
  catalogo: Catalogo;
  podeCadastrar: boolean;
  fontes: FonteCopia[];
  online: boolean;
  aoSalvar: (treinos: TreinoParaSalvar[]) => Promise<void>;
  aoCadastrar: (e: Omit<Exercicio, 'id'>) => Promise<Exercicio>;
};

const faixa = (a: number, b: number) => Array.from({ length: b - a + 1 }, (_, i) => a + i);
const comAtual = (lista: number[], v: number) => (lista.includes(v) ? lista : [...lista, v].sort((x, y) => x - y));
const textoFaixa = (min: number, max: number) => (min === max ? String(min) : `${min}–${max}`);

/** A ficha só para ler: quem não pode editar vê tudo o que está nela. */
function FichaSoLeitura({ ficha, catalogo }: { ficha: Ficha; catalogo: Catalogo }) {
  const grupo = (id: string) => catalogo.grupos.find((g) => g.id === id)?.nome ?? '';
  return (
    <>
      {ficha.treinos.map((t) => (
        <Secao key={t.id} titulo={`${t.ordem} · ${t.nome}`} subtitulo={t.foco || undefined}>
          <List disablePadding>
            {t.exercicios.map((e, i) => (
              <Fragment key={e.id}>
                {i > 0 && <Divider component="li" />}
                <ListItem
                  disableGutters
                  secondaryAction={
                    <Typography variant="body2" sx={{ color: 'text.secondary', textAlign: 'right' }}>
                      {e.series} × {textoFaixa(e.repsMin, e.repsMax)}
                      <br />
                      {textoDescanso(e.descansoSeg)}
                    </Typography>
                  }
                >
                  <ListItemText
                    primary={e.nome}
                    secondary={grupo(e.grupo)}
                    sx={{ pr: 9 }}
                    slotProps={{ primary: { sx: { fontWeight: 600 } } }}
                  />
                </ListItem>
              </Fragment>
            ))}
          </List>
        </Secao>
      ))}
    </>
  );
}

/** Janela para escolher exercícios do catálogo, com busca e filtro por grupo. */
function EscolherExercicio({
  aberto,
  catalogo,
  jaNoTreino,
  podeCadastrar,
  aoEscolher,
  aoCadastrar,
  aoFechar,
}: {
  aberto: boolean;
  catalogo: Catalogo;
  jaNoTreino: Set<string>;
  podeCadastrar: boolean;
  aoEscolher: (e: Exercicio) => void;
  aoCadastrar: (e: Omit<Exercicio, 'id'>) => Promise<Exercicio>;
  aoFechar: () => void;
}) {
  const telaCheia = useMediaQuery('(max-width:600px)');
  const [busca, setBusca] = useState('');
  const [grupo, setGrupo] = useState('');
  const [cadastrando, setCadastrando] = useState(false);
  const nomeGrupo = (id: string) => catalogo.grupos.find((g) => g.id === id)?.nome ?? '';
  const q = normalizar(busca);
  const lista = catalogo.exercicios
    .filter((e) => !jaNoTreino.has(e.id) && (!grupo || e.grupo === grupo) && (!q || normalizar(e.nome).includes(q)))
    .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));

  return (
    <>
      <Dialog open={aberto} onClose={aoFechar} fullScreen={telaCheia} fullWidth maxWidth="sm">
        <DialogTitle sx={{ pb: 1 }}>Adicionar exercício</DialogTitle>
        <Box sx={{ px: 3, pb: 1 }}>
          <TextField
            placeholder="Buscar pelo nome"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            slotProps={{
              input: {
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchRounded />
                  </InputAdornment>
                ),
              },
            }}
          />
          <Stack direction="row" spacing={1} sx={{ mt: 1.5, overflowX: 'auto', pb: 0.5, mx: -3, px: 3 }}>
            <Chip label="Todos" color={grupo ? 'default' : 'primary'} onClick={() => setGrupo('')} />
            {catalogo.grupos.map((g) => (
              <Chip
                key={g.id}
                label={g.nome}
                color={grupo === g.id ? 'primary' : 'default'}
                variant={grupo === g.id ? 'filled' : 'outlined'}
                onClick={() => setGrupo(grupo === g.id ? '' : g.id)}
              />
            ))}
          </Stack>
        </Box>
        <DialogContent dividers sx={{ p: 0 }}>
          {lista.length ? (
            <List disablePadding>
              {lista.map((e) => (
                <ListItemButton key={e.id} onClick={() => aoEscolher(e)} divider>
                  <ListItemText primary={e.nome} secondary={nomeGrupo(e.grupo)} />
                  <AddCircleOutlineRounded sx={{ color: 'primary.main', ml: 1 }} />
                </ListItemButton>
              ))}
            </List>
          ) : (
            <Vazio>Nenhum exercício encontrado.</Vazio>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 1.5, justifyContent: podeCadastrar ? 'space-between' : 'flex-end' }}>
          {podeCadastrar && (
            <Button startIcon={<AddRounded />} onClick={() => setCadastrando(true)}>
              Cadastrar novo
            </Button>
          )}
          <Button variant="contained" onClick={aoFechar}>
            Concluído
          </Button>
        </DialogActions>
      </Dialog>
      <DialogoExercicio
        aberto={cadastrando}
        titulo="Cadastrar exercício"
        grupos={catalogo.grupos}
        grupoInicial={grupo || undefined}
        rotulo="Cadastrar e adicionar"
        aoFechar={() => setCadastrando(false)}
        aoSalvar={async (dados) => {
          const novo = await aoCadastrar(dados);
          aoEscolher(novo);
          setCadastrando(false);
        }}
      />
    </>
  );
}

export function EditorFicha({ ficha, catalogo, podeCadastrar, fontes, online, aoSalvar, aoCadastrar }: Props) {
  const [rascunho, setRascunho] = useState<Rascunho>(ficha.treinos);
  const [selIdx, setSelIdx] = useState(0);
  const [escolhendo, setEscolhendo] = useState(false);
  const [fonte, setFonte] = useState(fontes[0]?.id ?? '');
  const [confirmar, setConfirmar] = useState<'copia' | 'remover' | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [aviso, setAviso] = useState<{ ok: boolean; texto: string } | null>(null);

  // Ficha nova vinda do servidor (depois de salvar): o rascunho recomeça dela, no mesmo treino.
  useEffect(() => {
    setRascunho(ficha.treinos);
    setSelIdx((i) => Math.min(i, Math.max(0, ficha.treinos.length - 1)));
  }, [ficha]);

  const mudou = diferente(rascunho, ficha.treinos);
  const problemas = useMemo(() => verificar(rascunho), [rascunho]);

  useEffect(() => {
    if (!mudou) return;
    const avisar = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener('beforeunload', avisar);
    return () => window.removeEventListener('beforeunload', avisar);
  }, [mudou]);

  if (!ficha.podeEditar) return <FichaSoLeitura ficha={ficha} catalogo={catalogo} />;

  const idx = Math.min(selIdx, rascunho.length - 1);
  const treino = rascunho[idx];
  const nomeGrupo = (id: string) => catalogo.grupos.find((g) => g.id === id)?.nome ?? '';

  async function copiar() {
    setConfirmar(null);
    const f = fontes.find((x) => x.id === fonte);
    if (!f) return;
    try {
      setRascunho(copiarTreinos(await f.carregar()));
      setSelIdx(0);
      setAviso({ ok: true, texto: `Treinos copiados de "${f.rotulo}". Ajuste o que quiser e salve.` });
    } catch (e) {
      setAviso({ ok: false, texto: (e as Error).message || 'Não consegui copiar agora.' });
    }
  }

  async function salvar() {
    setSalvando(true);
    try {
      await aoSalvar(paraSalvar(rascunho));
      setAviso({ ok: true, texto: 'Ficha salva. Vale a partir da próxima sessão.' });
    } catch (e) {
      setAviso({ ok: false, texto: (e as Error).message || 'Não consegui salvar. Tente de novo.' });
    } finally {
      setSalvando(false);
    }
  }

  const prescricao = (e: Treino['exercicios'][number]) => [
    { rotulo: 'Séries', valor: e.series, opcoes: faixa(1, 10), campo: 'series' as const, texto: String },
    {
      rotulo: 'Reps mín.',
      valor: e.repsMin,
      opcoes: comAtual(faixa(1, 30), e.repsMin),
      campo: 'repsMin' as const,
      texto: String,
    },
    {
      rotulo: 'Reps máx.',
      valor: e.repsMax,
      opcoes: comAtual(faixa(1, 50), e.repsMax),
      campo: 'repsMax' as const,
      texto: String,
    },
    {
      rotulo: 'Descanso',
      valor: e.descansoSeg,
      opcoes: comAtual(DESCANSOS, e.descansoSeg),
      campo: 'descansoSeg' as const,
      texto: textoDescanso,
    },
  ];

  return (
    <>
      {fontes.length > 0 && (
        <Secao
          titulo="Começar copiando"
          subtitulo="Troca todos os treinos abaixo pelos da ficha escolhida. Nada é gravado até você salvar."
        >
          <Stack direction="row" spacing={1}>
            <TextField select label="Copiar de" value={fonte} onChange={(e) => setFonte(e.target.value)}>
              {fontes.map((f) => (
                <MenuItem key={f.id} value={f.id}>
                  {f.rotulo}
                </MenuItem>
              ))}
            </TextField>
            <Button
              variant="outlined"
              startIcon={<ContentCopyRounded />}
              onClick={() => setConfirmar('copia')}
              sx={{ flexShrink: 0 }}
            >
              Copiar
            </Button>
          </Stack>
        </Secao>
      )}

      <Stack direction="row" sx={{ alignItems: 'center', borderBottom: 1, borderColor: 'divider', mx: -2 }}>
        <Tabs
          value={idx}
          onChange={(_, i: number) => setSelIdx(i)}
          variant="scrollable"
          scrollButtons={false}
          aria-label="Treinos da ficha"
          sx={{ flex: 1, minWidth: 0, pl: 1, '& .MuiTab-root': { minWidth: 64, px: 1.5 } }}
        >
          {rascunho.map((t, i) => (
            <Tab
              key={t.id}
              value={i}
              aria-label={t.nome || `Treino ${t.ordem}`}
              label={
                <Stack sx={{ alignItems: 'center' }}>
                  <Typography sx={{ fontFamily: FONTE_DISPLAY, fontWeight: 700, fontSize: 20, lineHeight: 1 }}>
                    {t.ordem}
                  </Typography>
                  <Typography variant="caption" noWrap sx={{ maxWidth: 76, textTransform: 'none' }}>
                    {t.apelido || '—'}
                  </Typography>
                </Stack>
              }
            />
          ))}
        </Tabs>
        {rascunho.length < MAX_TREINOS && (
          <Tooltip title="Adicionar treino">
            <IconButton
              color="primary"
              aria-label="Adicionar treino"
              sx={{ mx: 1 }}
              onClick={() => {
                setRascunho(adicionarTreino(rascunho));
                setSelIdx(rascunho.length);
              }}
            >
              <AddRounded />
            </IconButton>
          </Tooltip>
        )}
      </Stack>

      {treino && (
        <>
          <Secao
            titulo={`Treino ${treino.ordem}`}
            acao={
              <Stack direction="row">
                <Tooltip title="Mover para antes">
                  <span>
                    <IconButton
                      aria-label="Mover treino para antes"
                      disabled={idx === 0}
                      onClick={() => {
                        setRascunho(moverTreino(rascunho, treino.id, -1));
                        setSelIdx(idx - 1);
                      }}
                    >
                      <ArrowBackRounded />
                    </IconButton>
                  </span>
                </Tooltip>
                <Tooltip title="Mover para depois">
                  <span>
                    <IconButton
                      aria-label="Mover treino para depois"
                      disabled={idx === rascunho.length - 1}
                      onClick={() => {
                        setRascunho(moverTreino(rascunho, treino.id, 1));
                        setSelIdx(idx + 1);
                      }}
                    >
                      <ArrowForwardRounded />
                    </IconButton>
                  </span>
                </Tooltip>
                {rascunho.length > 1 && (
                  <Tooltip title="Remover treino">
                    <IconButton aria-label="Remover treino" color="error" onClick={() => setConfirmar('remover')}>
                      <DeleteOutlineRounded />
                    </IconButton>
                  </Tooltip>
                )}
              </Stack>
            }
          >
            <Grid container spacing={2}>
              <Grid size={{ xs: 7, sm: 8 }}>
                <TextField
                  label="Nome do treino"
                  value={treino.nome}
                  slotProps={{ htmlInput: { maxLength: LIMITE_NOME } }}
                  onChange={(e) => setRascunho(alterarTreino(rascunho, treino.id, { nome: e.target.value }))}
                />
              </Grid>
              <Grid size={{ xs: 5, sm: 4 }}>
                <TextField
                  label="Nome curto"
                  helperText="no botão"
                  value={treino.apelido}
                  slotProps={{ htmlInput: { maxLength: LIMITE_APELIDO } }}
                  onChange={(e) => setRascunho(alterarTreino(rascunho, treino.id, { apelido: e.target.value }))}
                />
              </Grid>
              <Grid size={12}>
                <TextField
                  label="Foco"
                  placeholder="Ex.: Peito e costas"
                  value={treino.foco}
                  onChange={(e) => setRascunho(alterarTreino(rascunho, treino.id, { foco: e.target.value }))}
                />
              </Grid>
              <Grid size={12}>
                <TextField
                  label="Cardio"
                  placeholder="Ex.: Depois: 20 min de caminhada inclinada"
                  value={treino.cardio}
                  onChange={(e) => setRascunho(alterarTreino(rascunho, treino.id, { cardio: e.target.value }))}
                />
              </Grid>
            </Grid>
          </Secao>

          {treino.exercicios.length === 0 && (
            <Alert severity="info">Este treino ainda não tem exercícios. Adicione pelo menos um para salvar.</Alert>
          )}
          {treino.exercicios.map((e, i) => (
            <Card key={e.id}>
              <CardHeader
                avatar={
                  <Avatar
                    sx={{
                      bgcolor: 'action.selected',
                      color: 'text.primary',
                      fontFamily: FONTE_DISPLAY,
                      fontWeight: 700,
                    }}
                  >
                    {i + 1}
                  </Avatar>
                }
                title={e.nome}
                subheader={nomeGrupo(e.grupo)}
                slotProps={{ title: { variant: 'h6', component: 'h3' } }}
                action={
                  <Stack direction="row">
                    <IconButton
                      size="small"
                      aria-label={`Subir ${e.nome}`}
                      disabled={i === 0}
                      onClick={() => setRascunho(moverExercicio(rascunho, treino.id, e.id, -1))}
                    >
                      <ArrowUpwardRounded fontSize="small" />
                    </IconButton>
                    <IconButton
                      size="small"
                      aria-label={`Descer ${e.nome}`}
                      disabled={i === treino.exercicios.length - 1}
                      onClick={() => setRascunho(moverExercicio(rascunho, treino.id, e.id, 1))}
                    >
                      <ArrowDownwardRounded fontSize="small" />
                    </IconButton>
                    <IconButton
                      size="small"
                      color="error"
                      aria-label={`Remover ${e.nome}`}
                      onClick={() => setRascunho(removerExercicio(rascunho, treino.id, e.id))}
                    >
                      <DeleteOutlineRounded fontSize="small" />
                    </IconButton>
                  </Stack>
                }
              />
              <CardContent sx={{ pt: 1, '&:last-child': { pb: 2 } }}>
                <Grid container spacing={1.5}>
                  {prescricao(e).map((p) => (
                    <Grid key={p.campo} size={{ xs: 6, sm: 3 }}>
                      <TextField
                        select
                        label={p.rotulo}
                        value={p.valor}
                        onChange={(ev) =>
                          setRascunho(
                            alterarExercicio(rascunho, treino.id, e.id, { [p.campo]: Number(ev.target.value) }),
                          )
                        }
                      >
                        {p.opcoes.map((v) => (
                          <MenuItem key={v} value={v}>
                            {p.texto(v)}
                          </MenuItem>
                        ))}
                      </TextField>
                    </Grid>
                  ))}
                </Grid>
              </CardContent>
            </Card>
          ))}

          <Button variant="outlined" size="large" startIcon={<AddRounded />} onClick={() => setEscolhendo(true)}>
            Adicionar exercício
          </Button>
          <EscolherExercicio
            aberto={escolhendo}
            catalogo={catalogo}
            jaNoTreino={new Set(treino.exercicios.map((e) => e.id))}
            podeCadastrar={podeCadastrar}
            aoFechar={() => setEscolhendo(false)}
            aoCadastrar={aoCadastrar}
            aoEscolher={(ex) => {
              setRascunho((r) => adicionarExercicio(r, treino.id, ex));
              setAviso({ ok: true, texto: `${ex.nome} entrou no ${treino.nome}.` });
            }}
          />
        </>
      )}

      {mudou && (
        <Paper
          elevation={6}
          sx={{
            position: 'sticky',
            bottom: `calc(${ALTURA_ABAS + 8}px + env(safe-area-inset-bottom))`,
            zIndex: (t) => t.zIndex.appBar - 1,
            p: 1.5,
          }}
        >
          <Stack spacing={1}>
            {problemas.length > 0 && (
              <Alert severity="warning" sx={{ py: 0 }}>
                {problemas[0]}
                {problemas.length > 1 ? ` (e mais ${problemas.length - 1})` : ''}
              </Alert>
            )}
            {!online && (
              <Alert severity="warning" sx={{ py: 0 }}>
                Sem conexão: salvar a ficha precisa de internet.
              </Alert>
            )}
            <Stack direction="row" spacing={1}>
              <Button fullWidth variant="outlined" disabled={salvando} onClick={() => setRascunho(ficha.treinos)}>
                Descartar
              </Button>
              <Button
                fullWidth
                variant="contained"
                loading={salvando}
                disabled={problemas.length > 0 || !online}
                onClick={() => void salvar()}
              >
                Salvar ficha
              </Button>
            </Stack>
          </Stack>
        </Paper>
      )}

      <Dialog open={confirmar !== null} onClose={() => setConfirmar(null)}>
        <DialogTitle>{confirmar === 'copia' ? 'Trocar todos os treinos?' : `Remover o ${treino?.nome}?`}</DialogTitle>
        <DialogContent>
          <Typography sx={{ color: 'text.secondary' }}>
            {confirmar === 'copia'
              ? 'Os treinos do rascunho serão trocados pelos da ficha escolhida. Nada é gravado até você salvar.'
              : 'O histórico desse treino não se perde: as sessões feitas continuam na Evolução.'}
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmar(null)}>Cancelar</Button>
          <Button
            variant="contained"
            color={confirmar === 'copia' ? 'primary' : 'error'}
            onClick={() => {
              if (confirmar === 'copia') void copiar();
              else if (treino) {
                setRascunho(removerTreino(rascunho, treino.id));
                setSelIdx(Math.max(0, idx - 1));
                setConfirmar(null);
              }
            }}
          >
            {confirmar === 'copia' ? 'Trocar' : 'Remover'}
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={aviso !== null}
        autoHideDuration={aviso?.ok ? 3000 : 6000}
        onClose={() => setAviso(null)}
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
      >
        <Alert
          severity={aviso?.ok ? 'success' : 'error'}
          variant="filled"
          onClose={() => setAviso(null)}
          sx={{ width: '100%' }}
        >
          {aviso?.texto}
        </Alert>
      </Snackbar>
    </>
  );
}
