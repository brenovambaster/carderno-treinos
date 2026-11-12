// Gráfico de atividade dos últimos 30 dias, no estilo do GitHub: um quadrado por dia,
// colunas por semana, cor mais forte quanto mais séries naquele dia.
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import type { Theme } from '@mui/material/styles';
import { useMemo } from 'react';
import { atividade, type Nivel } from '../lib/atividade';
import { ddmm, hojeISO, parseISO } from '../lib/datas';
import { fmt } from '../lib/formato';
import type { ResumoSessao } from '../lib/tipos';
import { FONTE_DISPLAY, NUMEROS } from '../tema';
import { Secao } from './Pagina';

const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
const DIAS_CURTOS = ['Seg', '', 'Qua', '', 'Sex', '', 'Dom'];
const DIAS_TOOLTIP = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];
const OPACIDADE: Record<Nivel, number> = { 0: 0, 1: 0.3, 2: 0.5, 3: 0.75, 4: 1 };

const corDoNivel = (n: Nivel) => (t: Theme) =>
  n === 0 ? t.vars!.palette.action.hover : `rgba(${t.vars!.palette.success.mainChannel} / ${OPACIDADE[n]})`;

function Numero({ valor, rotulo }: { valor: string; rotulo: string }) {
  return (
    <Box>
      <Typography sx={{ fontFamily: FONTE_DISPLAY, fontWeight: 700, fontSize: 30, lineHeight: 1, ...NUMEROS }}>
        {valor}
      </Typography>
      <Typography variant="caption" sx={{ color: 'text.secondary' }}>
        {rotulo}
      </Typography>
    </Box>
  );
}

type Props = {
  resumos: ResumoSessao[];
  nomeTreino: (id: string) => string;
  metaSemanal?: number;
  dias?: number;
};

export function Atividade({ resumos, nomeTreino, metaSemanal, dias = 30 }: Props) {
  const hoje = hojeISO();
  const a = useMemo(() => atividade(resumos, hoje, dias), [resumos, hoje, dias]);

  const rotuloDoMes = (semana: (typeof a.semanas)[number], i: number) => {
    const dentro = semana.filter((d) => !d.foraDoPeriodo);
    const primeiroDoMes = dentro.find((d) => d.data.endsWith('-01'));
    if (i === 0 && dentro.length) return MESES[parseISO(dentro[0].data).getMonth()];
    return primeiroDoMes ? MESES[parseISO(primeiroDoMes.data).getMonth()] : '';
  };

  return (
    <Secao titulo={`Últimos ${dias} dias`} subtitulo="Cada quadrado é um dia. Quanto mais forte a cor, mais séries.">
      <Stack direction="row" spacing={3} sx={{ mb: 2 }}>
        <Numero valor={String(a.diasTreinados)} rotulo={a.diasTreinados === 1 ? 'dia treinado' : 'dias treinados'} />
        <Numero
          valor={fmt(a.mediaPorSemana, 1)}
          rotulo={metaSemanal ? `por semana · meta ${metaSemanal}` : 'por semana'}
        />
        <Numero valor={String(a.series)} rotulo="séries" />
      </Stack>

      <Box
        role="img"
        aria-label={`${a.diasTreinados} dias treinados nos últimos ${dias} dias`}
        sx={{
          display: 'grid',
          gridTemplateColumns: `28px repeat(${a.semanas.length}, minmax(0, 40px))`,
          gridAutoFlow: 'column',
          gridTemplateRows: 'auto repeat(7, auto)',
          gap: '5px',
          justifyContent: 'center',
        }}
      >
        <Box />
        {DIAS_CURTOS.map((d, i) => (
          <Typography key={i} variant="caption" sx={{ color: 'text.secondary', alignSelf: 'center', lineHeight: 1 }}>
            {d}
          </Typography>
        ))}
        {a.semanas.flatMap((semana, i) => [
          <Typography key={`m${i}`} variant="caption" sx={{ color: 'text.secondary', lineHeight: 1.6 }}>
            {rotuloDoMes(semana, i)}
          </Typography>,
          ...semana.map((d) => {
            if (d.foraDoPeriodo) return <Box key={d.data} sx={{ aspectRatio: '1' }} />;
            const dia = `${DIAS_TOOLTIP[parseISO(d.data).getDay()]}, ${ddmm(d.data)}`;
            const texto = d.sessoes.length
              ? `${dia} · ${d.sessoes.map((s) => nomeTreino(s.treinoId)).join(' + ')} · ${d.series} série${d.series === 1 ? '' : 's'}`
              : `${dia} · sem treino`;
            return (
              <Tooltip key={d.data} title={texto}>
                <Box
                  tabIndex={0}
                  aria-label={texto}
                  sx={{
                    aspectRatio: '1',
                    borderRadius: '6px',
                    bgcolor: corDoNivel(d.nivel),
                    outline: d.data === hoje ? 2 : 0,
                    outlineColor: 'text.primary',
                    outlineOffset: 1,
                    cursor: 'default',
                    '&:focus-visible': { outline: 2, outlineColor: 'primary.main' },
                  }}
                />
              </Tooltip>
            );
          }),
        ])}
      </Box>

      <Stack direction="row" spacing={0.5} sx={{ mt: 1.5, alignItems: 'center', justifyContent: 'flex-end' }}>
        <Typography variant="caption" sx={{ color: 'text.secondary', mr: 0.5 }}>
          Menos
        </Typography>
        {([0, 1, 2, 3, 4] as Nivel[]).map((n) => (
          <Box key={n} sx={{ width: 12, height: 12, borderRadius: '3px', bgcolor: corDoNivel(n) }} />
        ))}
        <Typography variant="caption" sx={{ color: 'text.secondary', ml: 0.5 }}>
          Mais
        </Typography>
      </Stack>
    </Secao>
  );
}
