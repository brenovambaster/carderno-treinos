// Rotas do app (no #hash da URL) e quais papéis podem abrir cada uma.
import type { Papel } from './lib/tipos';

export type Rota =
  | { v: 'treino' }
  | { v: 'evolucao' }
  | { v: 'medidas' }
  | { v: 'plano' }
  | { v: 'ficha' } // a própria ficha
  | { v: 'usuarios' }
  | { v: 'usuario'; email: string }
  | { v: 'ficha-usuario'; email: string }
  | { v: 'padrao' } // Ficha padrão
  | { v: 'catalogo' };

const SIMPLES = ['treino', 'evolucao', 'medidas', 'plano', 'ficha', 'usuarios', 'padrao', 'catalogo'] as const;

export function lerRota(hash = location.hash): Rota {
  const partes = hash.replace(/^#/, '').split('/');
  const [v, arg, sub] = partes;
  if (v === 'usuario' && arg) {
    const email = decodeURIComponent(arg);
    return sub === 'ficha' ? { v: 'ficha-usuario', email } : { v: 'usuario', email };
  }
  return (SIMPLES as readonly string[]).includes(v) ? ({ v } as Rota) : { v: 'treino' };
}

export function href(r: Rota): string {
  if (r.v === 'usuario') return `#usuario/${encodeURIComponent(r.email)}`;
  if (r.v === 'ficha-usuario') return `#usuario/${encodeURIComponent(r.email)}/ficha`;
  return `#${r.v}`;
}

/** Quem pode abrir cada rota. O servidor confere de novo o que cada um vê. */
export function permitida(r: Rota, papel: Papel): boolean {
  switch (r.v) {
    case 'usuarios':
    case 'usuario':
    case 'ficha-usuario':
    case 'catalogo':
      return papel === 'admin' || papel === 'personal';
    case 'padrao':
      return papel === 'admin';
    default:
      return true;
  }
}

/** A aba que fica acesa em cada rota. */
export function abaDe(r: Rota): 'treino' | 'evolucao' | 'medidas' | 'plano' | 'usuarios' {
  if (r.v === 'ficha') return 'plano';
  if (r.v === 'usuario' || r.v === 'ficha-usuario' || r.v === 'padrao' || r.v === 'catalogo') return 'usuarios';
  return r.v;
}
