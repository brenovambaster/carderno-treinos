// Gráfico de linha (MUI X Charts) para carga, repetições, peso e cintura ao longo do tempo.
import useMediaQuery from '@mui/material/useMediaQuery';
import { LineChart, lineClasses } from '@mui/x-charts/LineChart';
import { ddmm } from '../lib/datas';
import { fmt } from '../lib/formato';
import { coresDoEsquema } from '../tema';

import type { Ponto } from './Grafico';

export default function GraficoLinha({
  pontos,
  unidade,
  sufixo = '',
}: {
  pontos: Ponto[];
  unidade: string;
  sufixo?: string;
}) {
  const cores = coresDoEsquema(useMediaQuery('(prefers-color-scheme: dark)'));
  const ys = pontos.map((p) => p.y);
  const lo = Math.min(...ys);
  const hi = Math.max(...ys);
  const folga = Math.max((hi - lo) * 0.2, 1);
  return (
    <LineChart
      height={190}
      margin={{ top: 16, right: 22, bottom: 4, left: 4 }}
      grid={{ horizontal: true }}
      hideLegend
      aria-label={`Gráfico de ${unidade} ao longo do tempo`}
      xAxis={[{ scaleType: 'point', data: pontos.map((p) => ddmm(p.data)), tickLabelStyle: { fontSize: 11 } }]}
      yAxis={[
        {
          min: Math.floor(lo - folga),
          max: Math.ceil(hi + folga),
          width: 40,
          tickLabelStyle: { fontSize: 11 },
          valueFormatter: (v: number) => fmt(v),
        },
      ]}
      series={[
        {
          data: ys,
          label: unidade,
          area: true,
          curve: 'monotoneX',
          color: cores.primaria,
          valueFormatter: (v) => (v == null ? '' : `${fmt(v)}${sufixo}`),
        },
      ]}
      sx={{ [`& .${lineClasses.area}`]: { fillOpacity: 0.14 }, [`& .${lineClasses.line}`]: { strokeWidth: 2.5 } }}
    />
  );
}
