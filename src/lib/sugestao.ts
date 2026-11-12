import type { ExercicioDoTreino, UltimaSessao } from './tipos';

export type Sugestao =
  | { tipo: 'primeira'; carga: null; reps: number[] }
  | { tipo: 'subir'; ultima: UltimaSessao; carga: number; reps: number[] }
  | { tipo: 'subir-corpo'; ultima: UltimaSessao; carga: number | null; reps: number[] }
  | { tipo: 'manter'; ultima: UltimaSessao; carga: number | null; reps: number[] };

/**
 * Sugestão de carga: mantenha a carga e some repetições; quando todas as séries
 * chegarem ao topo da faixa, suba a carga.
 */
export function sugerir(
  ex: Pick<ExercicioDoTreino, 'series' | 'repsMax' | 'incremento'>,
  ultima: UltimaSessao | undefined,
): Sugestao {
  if (!ultima || ultima.series.length === 0) return { tipo: 'primeira', carga: null, reps: [] };

  const cargas = ultima.series.map((s) => s.carga).filter((c): c is number => c != null);
  const maior = cargas.length ? Math.max(...cargas) : null;
  const todasNoTopo =
    ultima.series.length >= ex.series &&
    ultima.series.slice(0, ex.series).every((s) => s.reps >= ex.repsMax);

  if (todasNoTopo) {
    if (ex.incremento > 0 && maior != null) {
      return { tipo: 'subir', ultima, carga: Math.round((maior + ex.incremento) * 10) / 10, reps: [] };
    }
    return { tipo: 'subir-corpo', ultima, carga: maior, reps: [] };
  }
  return { tipo: 'manter', ultima, carga: maior, reps: ultima.series.map((s) => s.reps) };
}
