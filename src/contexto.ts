import { createContext, useContext } from 'react';
import type { Servidor } from './dados/servidor';
import type { EstadoSync, Sincronizador } from './dados/sincronizador';
import type { Medicao, Perfil, ResumoSessao, Rotina, Usuario } from './lib/tipos';

export type Contexto = {
  servidor: Servidor;
  usuario: Usuario;
  rotina: Rotina;
  perfil: Perfil;
  salvarPerfil: (p: Perfil) => Promise<void>;
  resumos: ResumoSessao[];
  alterarResumos: (f: (r: ResumoSessao[]) => ResumoSessao[]) => void;
  medicoes: Medicao[];
  alterarMedicoes: (m: Medicao[]) => void;
  sync: Sincronizador;
  estadoSync: EstadoSync;
  online: boolean;
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
