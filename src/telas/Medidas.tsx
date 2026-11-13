import DeleteOutlineRounded from '@mui/icons-material/DeleteOutlineRounded';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
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
import ListItemText from '@mui/material/ListItemText';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { Fragment, useState, type FormEvent } from 'react';
import { useApp } from '../contexto';
import { CampoData } from '../componentes/CampoData';
import { Grafico } from '../componentes/Grafico';
import { Cabecalho, Secao, Vazio } from '../componentes/Pagina';
import { FONTE_DISPLAY, NUMEROS } from '../tema';
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
    [
      'Cintura caindo e cargas subindo:',
      'está funcionando. Não mude nada, mesmo com o peso parado (é gordura virando músculo).',
    ],
    ['Peso caindo 0,3–0,5 kg por semana:', 'ritmo ideal para perder gordura sem perder músculo.'],
    [
      '3 semanas sem a cintura cair:',
      'corte ~200 kcal por dia (tire o macarrão ou a batata de uma refeição) ou some 2.000 passos por dia.',
    ],
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
    const peso = num(form.peso, 400),
      cintura = num(form.cintura, 250),
      passos = num(form.passos, 100000);
    if (!form.data) {
      setMsg('Confira a data.');
      return;
    }
    if (peso == null && cintura == null && passos == null) {
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
      setMsg(
        online
          ? 'Não consegui salvar agora. Tente de novo em instantes.'
          : 'Sem conexão: tente de novo quando tiver sinal.',
      );
    } finally {
      setSalvando(false);
    }
  }

  async function apagar(data: string) {
    setConfirmar(null);
    try {
      await servidor.apagarMedicao(usuario.id, data);
      atualizar(medicoes.filter((m) => m.data !== data));
    } catch {
      setMsg('Não consegui apagar agora. Tente de novo com conexão.');
    }
  }

  const tile = (rotulo: string, arr: Medicao[], campo: Campo, unidade: string) => {
    const ultimo = arr.length ? (arr[arr.length - 1][campo] as number) : null;
    const d = arr.length >= 2 ? ultimo! - (arr[0][campo] as number) : null;
    const bom = d == null ? null : direcao(perfil.objetivo, campo, d);
    return (
      <Card sx={{ height: '100%' }}>
        <CardContent sx={{ '&:last-child': { pb: 2 } }}>
          <Typography variant="overline" sx={{ color: 'text.secondary', lineHeight: 1.4, display: 'block' }}>
            {rotulo}
          </Typography>
          <Typography sx={{ fontFamily: FONTE_DISPLAY, fontWeight: 700, fontSize: 38, lineHeight: 1.1, ...NUMEROS }}>
            {ultimo == null ? '–' : fmt(ultimo)}
            {ultimo != null && (
              <Typography
                component="span"
                sx={{ fontSize: 18, ml: 0.5, color: 'text.secondary', fontFamily: 'inherit' }}
              >
                {unidade}
              </Typography>
            )}
          </Typography>
          {ultimo == null ? (
            <Typography variant="caption" sx={{ color: 'text.secondary' }}>
              sem registro
            </Typography>
          ) : d == null ? (
            <Typography variant="caption" sx={{ color: 'text.secondary' }}>
              primeiro registro
            </Typography>
          ) : (
            <Chip
              size="small"
              variant="outlined"
              color={bom === true ? 'success' : bom === false ? 'error' : 'default'}
              label={`${d > 0 ? '+' : ''}${fmt(d)} ${unidade} desde ${ddmm(arr[0].data)}`}
              sx={{ mt: 0.5, maxWidth: '100%' }}
            />
          )}
        </CardContent>
      </Card>
    );
  };

  const campoForm = (k: keyof typeof form, unidade?: string, inputMode?: 'decimal' | 'numeric') => ({
    value: form[k],
    onChange: (e: { target: { value: string } }) => setForm((f) => ({ ...f, [k]: e.target.value })),
    disabled: !online || salvando,
    slotProps: {
      htmlInput: { inputMode, autoComplete: 'off' },
      input: unidade ? { endAdornment: <InputAdornment position="end">{unidade}</InputAdornment> } : undefined,
    },
  });

  return (
    <>
      <Cabecalho titulo="Medidas" />
      <Grid container spacing={2}>
        <Grid size={6}>{tile('Cintura no umbigo', comCintura, 'cintura', 'cm')}</Grid>
        <Grid size={6}>{tile('Peso', comPeso, 'peso', 'kg')}</Grid>
      </Grid>

      <Secao
        titulo="Registrar a semana"
        subtitulo="1x por semana, no mesmo dia: ao acordar, depois do banheiro e antes de comer. Fita na altura do umbigo, sem apertar."
      >
        <Stack component="form" spacing={2} onSubmit={salvar}>
          {!online && <Alert severity="warning">Sem conexão: as medidas precisam de internet para salvar.</Alert>}
          <Grid container spacing={2}>
            <Grid size={6}>
              <CampoData
                label="Data"
                value={form.data}
                disabled={!online || salvando}
                onChange={(iso) => setForm((f) => ({ ...f, data: iso }))}
              />
            </Grid>
            <Grid size={6}>
              <TextField label="Peso" placeholder="75,0" {...campoForm('peso', 'kg', 'decimal')} />
            </Grid>
            <Grid size={6}>
              <TextField label="Cintura" placeholder="90,0" {...campoForm('cintura', 'cm', 'decimal')} />
            </Grid>
            <Grid size={6}>
              <TextField label="Passos/dia (média)" placeholder="8000" {...campoForm('passos', undefined, 'numeric')} />
            </Grid>
          </Grid>
          <Button type="submit" variant="contained" size="large" loading={salvando} disabled={!online}>
            Salvar medidas
          </Button>
          {msg && !salvando && (
            <Typography variant="body2" role="status" sx={{ color: 'text.secondary' }}>
              {msg}
            </Typography>
          )}
        </Stack>
      </Secao>

      <Secao titulo="Cintura">
        <Grafico
          pontos={comCintura.map((m) => ({ data: m.data, y: m.cintura as number }))}
          unidade="cintura"
          sufixo=" cm"
        />
      </Secao>
      <Secao titulo="Peso">
        <Grafico pontos={comPeso.map((m) => ({ data: m.data, y: m.peso as number }))} unidade="peso" sufixo=" kg" />
      </Secao>

      <Secao titulo="Como ler">
        <List disablePadding>
          {REGRAS[perfil.objetivo].map(([t, d], i) => (
            <Fragment key={t}>
              {i > 0 && <Divider component="li" />}
              <ListItem disableGutters>
                <ListItemText primary={t} secondary={d} slotProps={{ primary: { sx: { fontWeight: 600 } } }} />
              </ListItem>
            </Fragment>
          ))}
        </List>
      </Secao>

      <Secao titulo="Registros">
        {lista.length ? (
          <List disablePadding>
            {lista
              .slice()
              .reverse()
              .map((m, i) => (
                <Fragment key={m.data}>
                  {i > 0 && <Divider component="li" />}
                  <ListItem
                    disableGutters
                    secondaryAction={
                      <IconButton
                        edge="end"
                        aria-label={`Apagar medidas de ${ddmm(m.data)}`}
                        disabled={!online}
                        onClick={() => setConfirmar(m.data)}
                      >
                        <DeleteOutlineRounded />
                      </IconButton>
                    }
                  >
                    <ListItemText
                      primary={ddmm(m.data)}
                      secondary={[
                        m.peso != null ? `${fmt(m.peso)} kg` : null,
                        m.cintura != null ? `${fmt(m.cintura)} cm de cintura` : null,
                        m.passos != null ? `${fmt(m.passos, 0)} passos/dia` : null,
                      ]
                        .filter(Boolean)
                        .join(' · ')}
                      slotProps={{ primary: { sx: { fontWeight: 600 } } }}
                    />
                  </ListItem>
                </Fragment>
              ))}
          </List>
        ) : (
          <Vazio>Nenhuma medida ainda. Comece pela cintura: é o melhor sinal de como o corpo está mudando.</Vazio>
        )}
      </Secao>

      <Dialog open={confirmar !== null} onClose={() => setConfirmar(null)}>
        <DialogTitle>Apagar as medidas de {confirmar ? ddmm(confirmar) : ''}?</DialogTitle>
        <DialogContent>
          <Typography sx={{ color: 'text.secondary' }}>Peso, cintura e passos desse dia saem do histórico.</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmar(null)}>Cancelar</Button>
          <Button color="error" variant="contained" onClick={() => confirmar && void apagar(confirmar)}>
            Apagar
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
