// Gráfico de linha carregado sob demanda: a biblioteca de gráficos é grande e a tela de treino não precisa dela.
import Skeleton from '@mui/material/Skeleton';
import { lazy, Suspense } from 'react';
import { Vazio } from './Pagina';

export type Ponto = { data: string; y: number };

const GraficoLinha = lazy(() => import('./GraficoLinha'));

export function Grafico(props: { pontos: Ponto[]; unidade: string; sufixo?: string }) {
  if (props.pontos.length < 2) return <Vazio>Registre pelo menos 2 vezes para ver o gráfico.</Vazio>;
  return (
    <Suspense fallback={<Skeleton variant="rounded" height={190} />}>
      <GraficoLinha {...props} />
    </Suspense>
  );
}
