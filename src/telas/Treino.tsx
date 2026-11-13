import { keyframes } from '@emotion/react';
import CheckRounded from '@mui/icons-material/CheckRounded';
import DirectionsRunRounded from '@mui/icons-material/DirectionsRunRounded';
import ExpandMoreRounded from '@mui/icons-material/ExpandMoreRounded';
import HistoryRounded from '@mui/icons-material/HistoryRounded';
import LightbulbOutlined from '@mui/icons-material/LightbulbOutlined';
import TrendingUpRounded from '@mui/icons-material/TrendingUpRounded';
import Accordion from '@mui/material/Accordion';
import AccordionDetails from '@mui/material/AccordionDetails';
import AccordionSummary from '@mui/material/AccordionSummary';
import Alert from '@mui/material/Alert';
import Avatar from '@mui/material/Avatar';
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import CardHeader from '@mui/material/CardHeader';
import Chip from '@mui/material/Chip';
import InputAdornment from '@mui/material/InputAdornment';
import LinearProgress from '@mui/material/LinearProgress';
import Skeleton from '@mui/material/Skeleton';
import Stack from '@mui/material/Stack';
import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';
import TextField from '@mui/material/TextField';
import ToggleButton from '@mui/material/ToggleButton';
import Typography from '@mui/material/Typography';
import { useEffect, useMemo, useState } from 'react';
import { CampoData } from '../componentes/CampoData';
import { Secao } from '../componentes/Pagina';
import { useApp } from '../contexto';
import { chaveSerie, enfileirar, gravarCache, lerCache, pendentes, type ItemFila } from '../dados/armazem';
import { listaDoDia, montarDia, type Dia } from '../dados/dia';
import { ddmm, hojeISO } from '../lib/datas';
import { fmt, LIMITE_CARGA, LIMITE_REPS, num, textoDescanso } from '../lib/formato';
import { atualizarResumo, proximoTreino, serieRegistrada, sessoesNaSemana, treinoAoAbrir } from '../lib/sequencia';
import { sugerir, type Sugestao } from '../lib/sugestao';
import type { Cardio, ExercicioDoTreino, Serie, UltimaVez } from '../lib/tipos';
import { FONTE_DISPLAY, NUMEROS } from '../tema';

const tremer = keyframes`25% { transform: translateX(-4px); } 75% { transform: translateX(4px); }`;

/** Campo grande de número, para digitar entre as séries. */
const campoNumero = (unidade: string, id: string, rotulo: string, inputMode: 'decimal' | 'numeric') => ({
  slotProps: {
    htmlInput: {
      id,
      inputMode,
      'aria-label': rotulo,
      autoComplete: 'off',
      style: {
        textAlign: 'center' as const,
        fontFamily: FONTE_DISPLAY,
        fontSize: 24,
        fontWeight: 600,
        padding: '10px 4px',
        ...NUMEROS,
      },
    },
    input: {
      endAdornment: (
        <InputAdornment position="end" sx={{ ml: -1 }}>
          <Typography variant="caption" sx={{ color: 'text.secondary' }}>
            {unidade}
          </Typography>
        </InputAdornment>
      ),
    },
  },
});

const campo = (n: number | null) =>
  n == null ? '' : n.toLocaleString('pt-BR', { maximumFractionDigits: 2, useGrouping: false });
const inteiro = (v: string, max: number) => {
  const n = num(v, max);
  return n == null ? null : Math.round(n);
};

function Dica({ ex, sg }: { ex: ExercicioDoTreino; sg: Sugestao }) {
  if (sg.tipo === 'primeira') {
    return (
      <Alert severity="info" icon={<LightbulbOutlined />}>
        Primeira vez: escolha uma carga em que você faça <strong>{ex.repsMin} reps</strong> com 1–2 sobrando.
      </Alert>
    );
  }
  const ls = sg.ultima.series;
  const mesma = ls.every((s) => s.carga === ls[0].carga);
  const corpo = mesma
    ? (ls[0].carga != null ? `${fmt(ls[0].carga)} kg × ` : '') + ls.map((s) => s.reps).join(' · ')
    : ls.map((s) => (s.carga != null ? `${fmt(s.carga)} kg × ` : '') + s.reps).join(' · ');
  const ultima = (
    <>
      Última vez ({ddmm(sg.ultima.data)}): <strong>{corpo}</strong>
    </>
  );
  if (sg.tipo === 'subir') {
    return (
      <Alert severity="success" icon={<TrendingUpRounded />}>
        {ultima}
        <br />
        Todas as séries bateram {ex.repsMax}. <strong>Suba a carga: tente {fmt(sg.carga)} kg</strong> (ou o peso mais
        próximo disponível).
      </Alert>
    );
  }
  if (sg.tipo === 'subir-corpo') {
    return (
      <Alert severity="success" icon={<TrendingUpRounded />}>
        {ultima}
        <br />
        Todas as séries bateram {ex.repsMax}. <strong>Dificulte:</strong> coloque peso extra ou diminua a ajuda do
        graviton.
      </Alert>
    );
  }
  return (
    <Alert
      severity="info"
      variant="outlined"
      icon={<HistoryRounded />}
      sx={{ color: 'text.secondary', borderColor: 'divider' }}
    >
      {ultima}
      <br />
      Mantenha a carga e tente fazer mais repetições.
    </Alert>
  );
}

export function TelaTreino() {
  const { servidor, usuario, ficha, perfil, resumos, alterarResumos, sync, iniciarDescanso, pedidoAbrir } = useApp();
  const treinos = ficha.treinos;
  const uid = usuario.id;
  const hoje = hojeISO();
  const [data, setData] = useState(hoje);
  const [treinoId, setTreinoId] = useState(() => treinoAoAbrir(treinos, resumos, hoje));
  const [dia, setDia] = useState<Dia | null>(null);
  const [uv, setUv] = useState<UltimaVez>({});
  const [textos, setTextos] = useState<Record<string, string>>({});
  const [tremendo, setTremendo] = useState<string | null>(null);

  // Pedido vindo da Evolução ("Abrir").
  useEffect(() => {
    if (!pedidoAbrir) return;
    setData(pedidoAbrir.data);
    setTreinoId(pedidoAbrir.treinoId);
    window.scrollTo(0, 0);
  }, [pedidoAbrir]);

  // Séries do dia: servidor (ou cópia local) + fila.
  useEffect(() => {
    let vivo = true;
    (async () => {
      let base: { series: Serie[]; cardios: Cardio[] } | undefined;
      try {
        base = await servidor.dia(uid, data);
      } catch {
        base = await lerCache(`dia:${uid}:${data}`);
      }
      const fila = await pendentes(uid);
      if (!vivo) return;
      setDia(montarDia(data, base ?? { series: [], cardios: [] }, fila));
      setTextos({});
    })();
    return () => {
      vivo = false;
    };
  }, [data, uid, servidor]);

  // Última vez de cada exercício antes desta data (base da sugestão).
  useEffect(() => {
    let vivo = true;
    (async () => {
      let v: UltimaVez | undefined;
      try {
        v = await servidor.ultimaVez(data);
        if (data === hojeISO()) void gravarCache(`uv:${uid}`, v);
      } catch {
        v = await lerCache(`uv:${uid}`);
      }
      if (vivo) setUv(v ?? {});
    })();
    return () => {
      vivo = false;
    };
  }, [data, uid, servidor]);

  // Guarda o dia no aparelho e atualiza o resumo da sessão (próximo treino, contador da semana).
  useEffect(() => {
    if (!dia) return;
    const t = setTimeout(() => void gravarCache(`dia:${uid}:${dia.data}`, listaDoDia(dia)), 400);
    alterarResumos((r) => atualizarResumo(r, dia.data, treinoId, Object.values(dia.series)));
    return () => clearTimeout(t);
  }, [dia, treinoId, uid, alterarResumos]);

  const treino = treinos.find((t) => t.id === treinoId) ?? treinos[0];
  const proximo = proximoTreino(treinos, resumos);
  const pronto = dia != null && dia.data === data;
  const sugestoes = useMemo(
    () => Object.fromEntries(treino.exercicios.map((e) => [e.id, sugerir(e, uv[e.id])])),
    [treino, uv],
  );

  const vazia = (ex: ExercicioDoTreino, i: number): Serie => ({
    data,
    treinoId: treino.id,
    exercicioId: ex.id,
    indice: i,
    carga: null,
    reps: null,
    feita: false,
    alteradoEm: '',
  });
  const seriesDe = (ex: ExercicioDoTreino): Serie[] =>
    Array.from(
      { length: ex.series },
      (_, i) => dia?.series[chaveSerie({ data, treinoId: treino.id, exercicioId: ex.id, indice: i })] ?? vazia(ex, i),
    );

  function gravar(novas: Serie[], cardio?: Cardio) {
    setDia((d) => {
      if (!d || d.data !== data) return d;
      const n: Dia = { ...d, series: { ...d.series }, cardios: { ...d.cardios } };
      for (const s of novas) n.series[chaveSerie(s)] = s;
      if (cardio) n.cardios[cardio.treinoId] = cardio;
      return n;
    });
    const itens: ItemFila[] = novas.map((s) => ({ tipo: 'serie' as const, ...s }));
    if (cardio) itens.push({ tipo: 'cardio', ...cardio });
    void enfileirar(uid, itens).then(() => sync.agendar());
  }

  function alterar(ex: ExercicioDoTreino, i: number, mudanca: Partial<Serie>) {
    const atual = seriesDe(ex)[i];
    gravar([{ ...atual, ...mudanca, alteradoEm: new Date().toISOString() }]);
  }

  function phCarga(ex: ExercicioDoTreino, series: Serie[], i: number, sg: Sugestao): string {
    const anterior = i > 0 ? series[i - 1] : null;
    if (anterior?.feita && anterior.carga != null) return campo(anterior.carga);
    if (sg.carga != null) return campo(sg.carga);
    return ex.incremento === 0 ? '—' : '';
  }
  function phReps(ex: ExercicioDoTreino, i: number, sg: Sugestao): string {
    if (sg.tipo === 'manter' && sg.reps[i] != null) return String(sg.reps[i]);
    if (sg.tipo === 'subir' || sg.tipo === 'subir-corpo') return '';
    return String(ex.repsMin);
  }

  function marcar(ex: ExercicioDoTreino, i: number) {
    const series = seriesDe(ex);
    const s = series[i];
    if (s.feita) {
      alterar(ex, i, { feita: false });
      return;
    }
    if (s.reps == null) {
      setTremendo(`${ex.id}-${i}`);
      setTimeout(() => setTremendo(null), 350);
      document.getElementById(`rp-${ex.id}-${i}`)?.focus();
      return;
    }
    let carga = s.carga;
    if (carga == null) {
      const ph = phCarga(ex, series, i, sugestoes[ex.id]);
      const n = num(ph, LIMITE_CARGA);
      if (n != null) {
        carga = n;
        setTextos((t) => ({ ...t, [`kg-${ex.id}-${i}`]: ph }));
      }
    }
    alterar(ex, i, { feita: true, carga });
    const completo = series.every((x, j) => (j === i ? true : x.feita));
    const seguinte = treino.exercicios[treino.exercicios.indexOf(ex) + 1];
    const rotulo = !completo
      ? `próxima: série ${i + 2}`
      : seguinte
        ? `próximo: ${seguinte.nome.split(' (')[0]}`
        : 'último exercício feito';
    if (!(completo && !seguinte)) iniciarDescanso(ex.descansoSeg, rotulo);
  }

  const todas = treino.exercicios.flatMap(seriesDe);
  const feitas = todas.filter((s) => s.feita).length;
  const semana = sessoesNaSemana(resumos, hoje);
  const cardio = dia?.cardios[treino.id];
  const textoCardio = textos.cardio ?? (cardio?.cardioMin != null ? String(cardio.cardioMin) : '');

  return (
    <Stack spacing={2}>
      <Tabs
        value={treino.id}
        onChange={(_, id: string) => {
          setTreinoId(id);
          window.scrollTo(0, 0);
        }}
        variant="scrollable"
        scrollButtons={false}
        aria-label="Escolha o treino"
        sx={{
          mx: -2,
          px: 1,
          borderBottom: 1,
          borderColor: 'divider',
          '& .MuiTab-root': { minWidth: 72, px: 1.5, py: 1 },
        }}
      >
        {treinos.map((t) => {
          const tem = pronto && Object.values(dia.series).some((s) => s.treinoId === t.id && serieRegistrada(s));
          const ehProximo = t.id === proximo.id;
          return (
            <Tab
              key={t.id}
              value={t.id}
              aria-label={`${t.nome}${ehProximo ? ' (próximo treino)' : ''}`}
              label={
                <Stack sx={{ alignItems: 'center' }}>
                  <Typography sx={{ fontFamily: FONTE_DISPLAY, fontWeight: 700, fontSize: 22, lineHeight: 1 }}>
                    {t.ordem}
                  </Typography>
                  <Typography variant="caption" noWrap sx={{ maxWidth: 80, textTransform: 'none' }}>
                    {t.apelido}
                  </Typography>
                  <Box
                    sx={{
                      mt: 0.5,
                      width: 6,
                      height: 6,
                      borderRadius: '50%',
                      bgcolor: tem ? 'success.main' : ehProximo ? 'primary.main' : 'transparent',
                    }}
                  />
                </Stack>
              }
            />
          );
        })}
      </Tabs>

      <Box>
        <Stack direction="row" spacing={1} sx={{ alignItems: 'center', flexWrap: 'wrap' }}>
          <Typography variant="h1">{treino.nome}</Typography>
          {treino.id === proximo.id && <Chip size="small" color="primary" label="próximo" />}
        </Stack>
        <Typography sx={{ color: 'text.secondary', mt: 0.5 }}>
          {treino.foco ? `${treino.foco} · ` : ''}
          {treino.ordem}º da sequência
        </Typography>
      </Box>

      <Stack direction="row" spacing={2} sx={{ alignItems: 'center', justifyContent: 'space-between' }}>
        <CampoData label="Data" value={data} sx={{ maxWidth: 180 }} onChange={(iso) => iso && setData(iso)} />
        <Box sx={{ textAlign: 'right' }}>
          <Typography sx={{ fontFamily: FONTE_DISPLAY, fontWeight: 700, fontSize: 26, lineHeight: 1, ...NUMEROS }}>
            {feitas}/{todas.length}
          </Typography>
          <Typography variant="caption" sx={{ color: 'text.secondary' }}>
            séries · semana: {semana} de {perfil.metaSemanal}
          </Typography>
        </Box>
      </Stack>
      <LinearProgress
        variant="determinate"
        color="success"
        value={todas.length ? (feitas / todas.length) * 100 : 0}
        sx={{ height: 8, borderRadius: 4, bgcolor: 'action.hover' }}
        aria-label="Séries feitas"
      />

      {!pronto ? (
        <Stack spacing={2}>
          <Skeleton variant="rounded" height={260} />
          <Skeleton variant="rounded" height={260} />
        </Stack>
      ) : (
        <>
          {treino.exercicios.map((ex, idx) => {
            const sg = sugestoes[ex.id];
            const series = seriesDe(ex);
            const completo = series.every((s) => s.feita);
            return (
              <Card
                key={ex.id}
                id={`ex-${ex.id}`}
                sx={{ borderColor: completo ? 'success.main' : 'divider', transition: 'border-color .2s' }}
              >
                <CardHeader
                  avatar={
                    <Avatar
                      sx={{
                        bgcolor: completo ? 'success.main' : 'action.selected',
                        color: completo ? 'success.contrastText' : 'text.primary',
                        fontFamily: FONTE_DISPLAY,
                        fontWeight: 700,
                      }}
                    >
                      {completo ? <CheckRounded /> : idx + 1}
                    </Avatar>
                  }
                  title={ex.nome}
                  subheader={`${ex.series} séries · ${ex.repsMin === ex.repsMax ? ex.repsMin : `${ex.repsMin}–${ex.repsMax}`} reps · descanso ${textoDescanso(ex.descansoSeg)}`}
                  slotProps={{ title: { variant: 'h5', component: 'h2' } }}
                />
                <CardContent
                  sx={{ pt: 1, display: 'flex', flexDirection: 'column', gap: 1.5, '&:last-child': { pb: 1 } }}
                >
                  <Dica ex={ex} sg={sg} />
                  {series.map((s, i) => {
                    const idKg = `kg-${ex.id}-${i}`;
                    const idRp = `rp-${ex.id}-${i}`;
                    const noTopo = s.reps != null && s.reps >= ex.repsMax;
                    const treme = tremendo === `${ex.id}-${i}`;
                    return (
                      <Stack key={i} direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                        <Typography
                          sx={{
                            width: 18,
                            textAlign: 'center',
                            fontFamily: FONTE_DISPLAY,
                            fontWeight: 600,
                            color: 'text.secondary',
                          }}
                        >
                          {i + 1}
                        </Typography>
                        <TextField
                          {...campoNumero('kg', idKg, `Série ${i + 1}, carga em kg`, 'decimal')}
                          placeholder={phCarga(ex, series, i, sg)}
                          value={textos[idKg] ?? campo(s.carga)}
                          onChange={(e) => {
                            const v = e.target.value;
                            setTextos((t) => ({ ...t, [idKg]: v }));
                            alterar(ex, i, { carga: num(v, LIMITE_CARGA) });
                          }}
                        />
                        <TextField
                          {...campoNumero('reps', idRp, `Série ${i + 1}, repetições`, 'numeric')}
                          error={treme}
                          color={noTopo ? 'success' : 'primary'}
                          focused={noTopo || undefined}
                          sx={{ animation: treme ? `${tremer} .3s` : undefined }}
                          placeholder={phReps(ex, i, sg)}
                          value={textos[idRp] ?? (s.reps == null ? '' : String(s.reps))}
                          onChange={(e) => {
                            const v = e.target.value;
                            setTextos((t) => ({ ...t, [idRp]: v }));
                            alterar(ex, i, { reps: inteiro(v, LIMITE_REPS) });
                          }}
                        />
                        <ToggleButton
                          value="feita"
                          selected={s.feita}
                          aria-label={`Marcar série ${i + 1} como feita`}
                          onChange={() => marcar(ex, i)}
                          sx={{
                            flexShrink: 0,
                            width: 52,
                            height: 52,
                            borderRadius: '12px',
                            '&.Mui-selected, &.Mui-selected:hover': {
                              bgcolor: 'success.main',
                              color: 'success.contrastText',
                            },
                          }}
                        >
                          <CheckRounded />
                        </ToggleButton>
                      </Stack>
                    );
                  })}
                  {ex.dica && (
                    <Accordion
                      disableGutters
                      elevation={0}
                      sx={{ bgcolor: 'transparent', '&::before': { display: 'none' } }}
                    >
                      <AccordionSummary
                        expandIcon={<ExpandMoreRounded />}
                        sx={{
                          px: 0,
                          minHeight: 36,
                          color: 'primary.main',
                          fontWeight: 600,
                          '& .MuiAccordionSummary-content': { my: 0.5 },
                        }}
                      >
                        Como fazer
                      </AccordionSummary>
                      <AccordionDetails sx={{ px: 0, pt: 0 }}>
                        <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                          {ex.dica}
                        </Typography>
                      </AccordionDetails>
                    </Accordion>
                  )}
                </CardContent>
              </Card>
            );
          })}

          <Secao
            titulo="Cardio"
            subtitulo={`${treino.cardio ? `${treino.cardio}. ` : ''}Esteira com 8–12% de inclinação, num ritmo em que dá para conversar com esforço.`}
            acao={<DirectionsRunRounded sx={{ color: 'text.secondary' }} />}
          >
            <TextField
              label="Minutos feitos"
              placeholder="20"
              value={textoCardio}
              sx={{ maxWidth: 200 }}
              slotProps={{
                htmlInput: { id: 'cardio', inputMode: 'numeric', autoComplete: 'off' },
                input: { endAdornment: <InputAdornment position="end">min</InputAdornment> },
              }}
              onChange={(e) => {
                const v = e.target.value;
                setTextos((t) => ({ ...t, cardio: v }));
                gravar([], {
                  data,
                  treinoId: treino.id,
                  cardioMin: inteiro(v, 600),
                  alteradoEm: new Date().toISOString(),
                });
              }}
            />
          </Secao>
          <Typography variant="caption" sx={{ color: 'text.secondary' }}>
            Tudo é salvo sozinho enquanto você digita, mesmo sem sinal: o que não subir fica guardado no aparelho e é
            enviado quando a conexão voltar. Ao marcar uma série, o descanso começa a contar.
          </Typography>
        </>
      )}
    </Stack>
  );
}
