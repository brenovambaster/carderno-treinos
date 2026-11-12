// Catálogo de exercícios: admin e personal cadastram; só o admin corrige ou apaga.
import AddRounded from '@mui/icons-material/AddRounded';
import DeleteOutlineRounded from '@mui/icons-material/DeleteOutlineRounded';
import EditRounded from '@mui/icons-material/EditRounded';
import SearchRounded from '@mui/icons-material/SearchRounded';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import Divider from '@mui/material/Divider';
import IconButton from '@mui/material/IconButton';
import InputAdornment from '@mui/material/InputAdornment';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemText from '@mui/material/ListItemText';
import Snackbar from '@mui/material/Snackbar';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { Fragment, useEffect, useMemo, useState } from 'react';
import { DialogoExercicio } from '../componentes/FormExercicio';
import { Cabecalho, Secao, Vazio } from '../componentes/Pagina';
import { useApp } from '../contexto';
import { normalizar, textoIncremento } from '../lib/formato';
import type { Exercicio } from '../lib/tipos';
import { href } from '../rotas';

const porNome = (a: Exercicio, b: Exercicio) => a.nome.localeCompare(b.nome, 'pt-BR');

export function TelaCatalogo() {
  const { servidor, catalogo, alterarCatalogo, acesso, online } = useApp();
  const ehAdmin = acesso.papel === 'admin';
  const [grupo, setGrupo] = useState('');
  const [busca, setBusca] = useState('');
  const [editando, setEditando] = useState<Exercicio | 'novo' | null>(null);
  const [apagando, setApagando] = useState<Exercicio | null>(null);
  const [aviso, setAviso] = useState<{ ok: boolean; texto: string } | null>(null);

  // Pega o que outros cadastraram desde que o app abriu.
  useEffect(() => {
    servidor.catalogo().then(alterarCatalogo, () => undefined);
  }, [servidor]); // eslint-disable-line react-hooks/exhaustive-deps

  const q = normalizar(busca);
  const porGrupo = useMemo(
    () =>
      catalogo.grupos
        .filter((g) => !grupo || g.id === grupo)
        .map((g) => ({
          grupo: g,
          exercicios: catalogo.exercicios
            .filter((e) => e.grupo === g.id && (!q || normalizar(e.nome).includes(q)))
            .sort(porNome),
        }))
        .filter((x) => x.exercicios.length > 0),
    [catalogo, grupo, q],
  );

  async function apagar(e: Exercicio) {
    setApagando(null);
    try {
      await servidor.apagarExercicio(e.id);
      alterarCatalogo({ ...catalogo, exercicios: catalogo.exercicios.filter((x) => x.id !== e.id) });
      setAviso({ ok: true, texto: `${e.nome} saiu do catálogo.` });
    } catch (err) {
      setAviso({ ok: false, texto: (err as Error).message || 'Não consegui apagar.' });
    }
  }

  return (
    <>
      <Cabecalho
        titulo="Catálogo"
        voltar={{ href: href({ v: 'usuarios' }), rotulo: ehAdmin ? 'Usuários' : 'Alunos' }}
        subtitulo={`${catalogo.exercicios.length} exercícios que podem entrar nas fichas. ${
          ehAdmin ? 'Só você corrige ou apaga; personais também cadastram.' : 'Só o admin corrige ou apaga.'
        }`}
        acao={
          <Button variant="contained" startIcon={<AddRounded />} onClick={() => setEditando('novo')} disabled={!online}>
            Novo
          </Button>
        }
      />
      {!online && <Alert severity="warning">Sem conexão: mudar o catálogo precisa de internet.</Alert>}

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
      <Stack direction="row" spacing={1} sx={{ overflowX: 'auto', pb: 0.5, mx: -2, px: 2 }}>
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

      {porGrupo.length === 0 && <Vazio>Nenhum exercício encontrado.</Vazio>}
      {porGrupo.map(({ grupo: g, exercicios }) => (
        <Secao key={g.id} titulo={g.nome} acao={<Chip size="small" label={exercicios.length} />}>
          <List disablePadding>
            {exercicios.map((e, i) => (
              <Fragment key={e.id}>
                {i > 0 && <Divider component="li" />}
                <ListItem
                  disableGutters
                  secondaryAction={
                    ehAdmin && (
                      <Stack direction="row">
                        <IconButton aria-label={`Editar ${e.nome}`} onClick={() => setEditando(e)} disabled={!online}>
                          <EditRounded fontSize="small" />
                        </IconButton>
                        <IconButton
                          edge="end"
                          color="error"
                          aria-label={`Apagar ${e.nome}`}
                          onClick={() => setApagando(e)}
                          disabled={!online}
                        >
                          <DeleteOutlineRounded fontSize="small" />
                        </IconButton>
                      </Stack>
                    )
                  }
                >
                  <ListItemText
                    primary={e.nome}
                    secondary={textoIncremento(e.incremento)}
                    sx={{ pr: ehAdmin ? 10 : 0 }}
                    slotProps={{ primary: { sx: { fontWeight: 600 } } }}
                  />
                </ListItem>
              </Fragment>
            ))}
          </List>
        </Secao>
      ))}

      <DialogoExercicio
        aberto={editando !== null}
        titulo={editando === 'novo' ? 'Cadastrar exercício' : 'Corrigir exercício'}
        grupos={catalogo.grupos}
        inicial={editando && editando !== 'novo' ? editando : undefined}
        grupoInicial={grupo || undefined}
        rotulo={editando === 'novo' ? 'Cadastrar' : 'Salvar'}
        aoFechar={() => setEditando(null)}
        aoSalvar={async (dados) => {
          if (editando === 'novo') {
            const novo = await servidor.cadastrarExercicio(dados);
            alterarCatalogo({ ...catalogo, exercicios: [...catalogo.exercicios, novo].sort(porNome) });
            setAviso({ ok: true, texto: `${novo.nome} entrou no catálogo.` });
          } else if (editando) {
            const novo = { ...dados, id: editando.id };
            await servidor.alterarExercicio(novo);
            alterarCatalogo({
              ...catalogo,
              exercicios: catalogo.exercicios.map((x) => (x.id === novo.id ? novo : x)).sort(porNome),
            });
            setAviso({ ok: true, texto: 'Exercício corrigido.' });
          }
          setEditando(null);
        }}
      />

      <Dialog open={apagando !== null} onClose={() => setApagando(null)}>
        <DialogTitle>Apagar {apagando?.nome}?</DialogTitle>
        <DialogContent>
          <Typography sx={{ color: 'text.secondary' }}>
            Só dá para apagar um exercício que não está em nenhuma ficha nem no histórico de ninguém.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setApagando(null)}>Cancelar</Button>
          <Button color="error" variant="contained" onClick={() => apagando && void apagar(apagando)}>
            Apagar
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={aviso !== null}
        autoHideDuration={aviso?.ok ? 3000 : 6000}
        onClose={() => setAviso(null)}
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
      >
        <Alert severity={aviso?.ok ? 'success' : 'error'} variant="filled" onClose={() => setAviso(null)}>
          {aviso?.texto}
        </Alert>
      </Snackbar>
    </>
  );
}
