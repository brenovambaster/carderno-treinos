// Janela para cadastrar ou corrigir um exercício do catálogo.
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import MenuItem from '@mui/material/MenuItem';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import { useEffect, useState, type FormEvent } from 'react';
import { fmt } from '../lib/formato';
import type { Exercicio, Grupo } from '../lib/tipos';

const INCREMENTOS = [0, 1, 2, 2.5, 5, 10];

type Props = {
  aberto: boolean;
  titulo: string;
  grupos: Grupo[];
  inicial?: Exercicio;
  grupoInicial?: string;
  rotulo: string;
  aoSalvar: (e: Omit<Exercicio, 'id'>) => Promise<void>;
  aoFechar: () => void;
};

export function DialogoExercicio({ aberto, titulo, grupos, inicial, grupoInicial, rotulo, aoSalvar, aoFechar }: Props) {
  const [nome, setNome] = useState('');
  const [grupo, setGrupo] = useState('');
  const [incremento, setIncremento] = useState(2.5);
  const [dica, setDica] = useState('');
  const [erro, setErro] = useState('');
  const [salvando, setSalvando] = useState(false);

  // Cada vez que abre, começa do exercício escolhido (ou em branco).
  useEffect(() => {
    if (!aberto) return;
    setNome(inicial?.nome ?? '');
    setGrupo(inicial?.grupo ?? grupoInicial ?? grupos[0]?.id ?? '');
    setIncremento(inicial?.incremento ?? 2.5);
    setDica(inicial?.dica ?? '');
    setErro('');
    setSalvando(false);
  }, [aberto, inicial, grupoInicial, grupos]);

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
    <Dialog
      open={aberto}
      onClose={salvando ? undefined : aoFechar}
      fullWidth
      maxWidth="xs"
      slotProps={{ paper: { component: 'form', onSubmit: salvar } as object }}
    >
      <DialogTitle>{titulo}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ pt: 1 }}>
          <TextField
            autoFocus
            label="Nome do exercício"
            placeholder="Ex.: Remada cavalinho"
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            slotProps={{ htmlInput: { maxLength: 80 } }}
          />
          <Stack direction="row" spacing={2}>
            <TextField select label="Grupo" value={grupo} onChange={(e) => setGrupo(e.target.value)}>
              {grupos.map((g) => (
                <MenuItem key={g.id} value={g.id}>
                  {g.nome}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              select
              label="Progressão"
              value={incremento}
              onChange={(e) => setIncremento(Number(e.target.value))}
            >
              {opcoes.map((i) => (
                <MenuItem key={i} value={i}>
                  {i === 0 ? 'Peso do corpo' : `+${fmt(i)} kg`}
                </MenuItem>
              ))}
            </TextField>
          </Stack>
          <TextField
            label="Como fazer (opcional)"
            multiline
            minRows={3}
            value={dica}
            onChange={(e) => setDica(e.target.value)}
            slotProps={{ htmlInput: { maxLength: 600 } }}
          />
          {erro && (
            <Alert severity="error" role="alert">
              {erro}
            </Alert>
          )}
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={aoFechar} disabled={salvando}>
          Cancelar
        </Button>
        <Button type="submit" variant="contained" loading={salvando}>
          {rotulo}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
