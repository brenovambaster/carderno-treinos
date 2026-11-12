import { createContext, useContext } from 'react';
import type { Servidor } from './dados/servidor';
import type { EstadoSync, Sincronizador } from './dados/sincronizador';
import type { Acesso, Exercicio, Ficha, Grupo, Medicao, Perfil, ResumoSessao, Usuario } from './lib/tipos';
import type { Rota } from './rotas';

export type Catalogo = { grupos: Grupo[]; exercicios: Exercicio[] };

export type Contexto = {
  servidor: Servidor;
  usuario: Usuario;
  acesso: Acesso;
  ficha: Ficha;
  /** Busca a própria ficha de novo (depois de editar) e guarda a cópia local. */
  recarregarFicha: () => Promise<void>;
  catalogo: Catalogo;
  alterarCatalogo: (c: Catalogo) => void;
  perfil: Perfil;
  salvarPerfil: (p: Perfil) => Promise<void>;
  resumos: ResumoSessao[];
  alterarResumos: (f: (r: ResumoSessao[]) => ResumoSessao[]) => void;
  medicoes: Medicao[];
  alterarMedicoes: (m: Medicao[]) => void;
  sync: Sincronizador;
  estadoSync: EstadoSync;
  online: boolean;
  rota: Rota;
  iniciarDescanso: (segundos: number, rotulo: string) => void;
  pedidoAbrir: { data: string; treinoId: string; n: number } | null;
  abrirSessao: (data: string, treinoId: string) => void;
  sair: () => Promise<void>;
};

export const AppCtx = createContext<Contexto | null>(null);

export function useApp(): Contexto {
  const c = useContext(AppCtx);
  if (!c) throw new Error('useApp fora do AppCtx');
  return c;
}
