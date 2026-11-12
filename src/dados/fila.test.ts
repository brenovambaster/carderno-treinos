import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import type { Cardio, Serie } from '../lib/tipos';
import { confirmar, enfileirar, pendentes, type ItemFila } from './armazem';
import { montarDia } from './dia';
import { FalhaServidor, type Servidor } from './servidor';
import { Sincronizador, type EstadoSync } from './sincronizador';

const item = (indice: number, alteradoEm: string, extra: Partial<Serie> = {}): ItemFila => ({
  tipo: 'serie',
  data: '2026-11-12',
  treinoId: 'peito-costas-a',
  exercicioId: 'supino-reto',
  indice,
  carga: 40,
  reps: 10,
  feita: true,
  alteradoEm,
  ...extra,
});

describe('Fila de pendências', () => {
  it('guarda só a alteração mais recente de cada série', async () => {
    await enfileirar('u1', [item(0, '2026-11-12T10:00:00.000Z', { reps: 8 })]);
    await enfileirar('u1', [item(0, '2026-11-12T10:01:00.000Z', { reps: 9 })]);
    await enfileirar('u1', [item(0, '2026-11-12T09:00:00.000Z', { reps: 1 })]);
    const fila = await pendentes('u1');
    expect(fila).toHaveLength(1);
    expect(fila[0]).toMatchObject({ reps: 9 });
  });

  it('não tira da fila uma série alterada de novo enquanto era enviada', async () => {
    const enviado = item(1, '2026-11-12T10:00:00.000Z');
    await enfileirar('u2', [enviado]);
    await enfileirar('u2', [item(1, '2026-11-12T10:00:05.000Z', { reps: 12 })]);
    await confirmar('u2', [enviado]);
    expect(await pendentes('u2')).toEqual([expect.objectContaining({ reps: 12 })]);
  });
});

describe('Juntar servidor e fila (vale o digitado por último)', () => {
  const doServidor = (alteradoEm: string, reps: number): Serie => ({ ...(item(0, alteradoEm) as Serie), reps });
  it('a fila vence quando foi digitada depois, mesmo com formatos de hora diferentes', () => {
    const dia = montarDia('2026-11-12', { series: [doServidor('2026-11-12T10:00:00+00:00', 8)], cardios: [] }, [item(0, '2026-11-12T10:00:01.000Z', { reps: 11 })]);
    expect(Object.values(dia.series)[0].reps).toBe(11);
  });
  it('o servidor vence quando a mudança dele é mais nova (ex.: corrigido no PC)', () => {
    const dia = montarDia('2026-11-12', { series: [doServidor('2026-11-12T20:00:00+00:00', 9)], cardios: [] }, [item(0, '2026-11-12T10:00:00.000Z', { reps: 11 })]);
    expect(Object.values(dia.series)[0].reps).toBe(9);
  });
  it('ignora itens de outras datas', () => {
    const dia = montarDia('2026-11-13', { series: [], cardios: [] }, [item(0, '2026-11-12T10:00:00.000Z')]);
    expect(Object.keys(dia.series)).toHaveLength(0);
  });
});

function servidorFalso(comportamento: (series: Serie[]) => void): Servidor {
  const recebidas: Serie[] = [];
  const s = {
    recebidas,
    async enviarSeries(_uid: string, series: Serie[]) {
      comportamento(series);
      recebidas.push(...series);
    },
    async enviarCardios(_uid: string, _c: Cardio[]) {},
  };
  return s as unknown as Servidor;
}

describe('Sincronizador', () => {
  it('envia a fila e fica em dia', async () => {
    const estados: EstadoSync[] = [];
    await enfileirar('u3', [item(0, '2026-11-12T10:00:00.000Z'), item(1, '2026-11-12T10:01:00.000Z')]);
    const srv = servidorFalso(() => {});
    await new Sincronizador('u3', srv, (e) => estados.push(e)).enviar();
    expect(await pendentes('u3')).toHaveLength(0);
    expect(estados.at(-1)).toEqual({ estado: 'em-dia', pendentes: 0 });
  });

  it('sem sinal, mantém tudo na fila e mostra quantas estão pendentes', async () => {
    const estados: EstadoSync[] = [];
    await enfileirar('u4', [item(0, '2026-11-12T10:00:00.000Z'), item(1, '2026-11-12T10:01:00.000Z')]);
    const srv = servidorFalso(() => {
      throw new FalhaServidor('Failed to fetch', true);
    });
    await new Sincronizador('u4', srv, (e) => estados.push(e)).enviar();
    expect(await pendentes('u4')).toHaveLength(2);
    expect(estados.at(-1)).toEqual({ estado: 'pendente', pendentes: 2 });
  });

  it('valor recusado pelo banco é descartado sem travar os outros', async () => {
    const estados: EstadoSync[] = [];
    await enfileirar('u5', [item(0, '2026-11-12T10:00:00.000Z'), item(1, '2026-11-12T10:01:00.000Z', { reps: 5000 })]);
    const srv = servidorFalso((series) => {
      if (series.some((s) => (s.reps ?? 0) > 999)) throw new FalhaServidor('check violation', false, true);
    });
    await new Sincronizador('u5', srv, (e) => estados.push(e)).enviar();
    expect(await pendentes('u5')).toHaveLength(0);
    expect((srv as unknown as { recebidas: Serie[] }).recebidas.map((s) => s.indice)).toEqual([0]);
    expect(estados.at(-1)?.estado).toBe('erro');
  });
});
