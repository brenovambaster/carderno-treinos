// Tudo o que fica guardado no aparelho (IndexedDB): cópias para abrir sem sinal
// e a fila de pendências (ADR 0002).
import { createStore, get, set, update, type UseStore } from 'idb-keyval';
import { instante } from '../lib/datas';
import type { Cardio, Serie } from '../lib/tipos';

let loja: UseStore | null = null;
const abrir = () => (loja ??= createStore('caderno-treino', 'kv'));

export async function lerCache<T>(chave: string): Promise<T | undefined> {
  try {
    return await get<T>(chave, abrir());
  } catch {
    return undefined;
  }
}

export async function gravarCache(chave: string, valor: unknown): Promise<void> {
  try {
    await set(chave, valor, abrir());
  } catch {
    /* sem espaço ou modo privado: o app segue só com a memória */
  }
}

// ---------------------------------------------------------------- fila

export type ItemFila = ({ tipo: 'serie' } & Serie) | ({ tipo: 'cardio' } & Cardio);
type Fila = Record<string, ItemFila>;

export const chaveSerie = (s: Pick<Serie, 'data' | 'treinoId' | 'exercicioId' | 'indice'>) =>
  `s|${s.data}|${s.treinoId}|${s.exercicioId}|${s.indice}`;
export const chaveCardio = (c: Pick<Cardio, 'data' | 'treinoId'>) => `c|${c.data}|${c.treinoId}`;
export const chaveItem = (i: ItemFila) => (i.tipo === 'serie' ? chaveSerie(i) : chaveCardio(i));

const chaveFila = (uid: string) => `fila:${uid}`;

/** Põe itens na fila; para a mesma série, fica só a alteração mais recente. */
export async function enfileirar(uid: string, itens: ItemFila[]): Promise<void> {
  await update<Fila>(
    chaveFila(uid),
    (atual) => {
      const fila = { ...(atual ?? {}) };
      for (const item of itens) {
        const k = chaveItem(item);
        if (!fila[k] || instante(fila[k].alteradoEm) <= instante(item.alteradoEm)) fila[k] = item;
      }
      return fila;
    },
    abrir(),
  );
}

export async function pendentes(uid: string): Promise<ItemFila[]> {
  return Object.values((await get<Fila>(chaveFila(uid), abrir())) ?? {});
}

/** Tira da fila o que foi enviado, a menos que tenha sido alterado de novo enquanto ia. */
export async function confirmar(uid: string, enviados: ItemFila[]): Promise<void> {
  await update<Fila>(
    chaveFila(uid),
    (atual) => {
      const fila = { ...(atual ?? {}) };
      for (const item of enviados) {
        const k = chaveItem(item);
        if (fila[k] && fila[k].alteradoEm === item.alteradoEm) delete fila[k];
      }
      return fila;
    },
    abrir(),
  );
}

export const semTipo = <T extends { tipo: string }>({ tipo: _tipo, ...resto }: T): Omit<T, 'tipo'> => resto;
