import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Grid from '@mui/material/Grid';
import InputAdornment from '@mui/material/InputAdornment';
import MenuItem from '@mui/material/MenuItem';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import { useState, type FormEvent } from 'react';
import { CampoData } from '../componentes/CampoData';
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
      setErro(
        navigator.onLine
          ? 'Não consegui salvar agora. Tente de novo.'
          : 'Sem conexão: o perfil precisa de internet para salvar.',
      );
      setSalvando(false);
    }
  }

  const maiuscula = (r: string) => r[0].toUpperCase() + r.slice(1);

  return (
    <Stack component="form" spacing={2} onSubmit={enviar} noValidate>
      <Grid container spacing={2}>
        <Grid size={6}>
          <TextField select label="Sexo" value={f.sexo} onChange={mudar('sexo')}>
            <MenuItem value="M">Homem</MenuItem>
            <MenuItem value="F">Mulher</MenuItem>
          </TextField>
        </Grid>
        <Grid size={6}>
          <CampoData
            label="Nascimento"
            value={f.nascimento}
            abrirEm="ano"
            onChange={(iso) => mudar('nascimento')({ target: { value: iso } })}
          />
        </Grid>
        <Grid size={6}>
          <TextField
            label="Altura"
            placeholder="171"
            value={f.altura}
            onChange={mudar('altura')}
            slotProps={{
              htmlInput: { inputMode: 'decimal', autoComplete: 'off' },
              input: { endAdornment: <InputAdornment position="end">cm</InputAdornment> },
            }}
          />
        </Grid>
        {comPeso && (
          <Grid size={6}>
            <TextField
              label="Peso hoje"
              placeholder="75,0"
              value={f.peso}
              onChange={mudar('peso')}
              slotProps={{
                htmlInput: { inputMode: 'decimal', autoComplete: 'off' },
                input: { endAdornment: <InputAdornment position="end">kg</InputAdornment> },
              }}
            />
          </Grid>
        )}
        <Grid size={6}>
          <TextField select label="Trabalho" value={f.tipoTrabalho} onChange={mudar('tipoTrabalho')}>
            {Object.entries(TIPOS_TRABALHO).map(([v, r]) => (
              <MenuItem key={v} value={v}>
                {maiuscula(r)}
              </MenuItem>
            ))}
          </TextField>
        </Grid>
        <Grid size={6}>
          <TextField select label="Objetivo" value={f.objetivo} onChange={mudar('objetivo')}>
            {Object.entries(OBJETIVOS).map(([v, r]) => (
              <MenuItem key={v} value={v}>
                {maiuscula(r)}
              </MenuItem>
            ))}
          </TextField>
        </Grid>
        <Grid size={comPeso ? 12 : 6}>
          <TextField select label="Treinos por semana" value={f.metaSemanal} onChange={mudar('metaSemanal')}>
            {[1, 2, 3, 4, 5, 6, 7].map((n) => (
              <MenuItem key={n} value={String(n)}>
                {n}
              </MenuItem>
            ))}
          </TextField>
        </Grid>
      </Grid>
      {erro && (
        <Alert severity="error" role="alert">
          {erro}
        </Alert>
      )}
      <Stack direction="row" spacing={1}>
        <Button type="submit" variant="contained" size="large" loading={salvando}>
          {rotuloBotao}
        </Button>
        {aoCancelar && (
          <Button variant="outlined" size="large" onClick={aoCancelar} disabled={salvando}>
            Cancelar
          </Button>
        )}
      </Stack>
    </Stack>
  );
}
