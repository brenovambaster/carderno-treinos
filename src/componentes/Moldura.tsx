import type { ReactNode } from 'react';
import type { EstadoSync } from '../dados/sincronizador';

export type Vista = 'treino' | 'evolucao' | 'medidas' | 'plano';

function status(e: EstadoSync, online: boolean): [string, string] {
  if (e.estado === 'salvando') return ['saving', 'Salvando…'];
  if (e.estado === 'erro') return ['error', 'Erro ao salvar'];
  if (e.pendentes > 0) return ['local', `${e.pendentes} pendente${e.pendentes > 1 ? 's' : ''}`];
  if (!online) return ['local', 'Sem conexão'];
  return ['saved', 'Salvo'];
}

export function Topo({ estado, online }: { estado?: EstadoSync; online: boolean }) {
  const [s, texto] = estado ? status(estado, online) : online ? ['loading', ''] : ['local', 'Sem conexão'];
  return (
    <header className="top">
      <div className="wrap">
        <span className="brand">Caderno de treino</span>
        <span className="status" data-s={s} title={estado?.mensagem}>
          {texto}
        </span>
      </div>
    </header>
  );
}

const ABAS: { v: Vista; rotulo: string; icone: ReactNode }[] = [
  { v: 'treino', rotulo: 'Treino', icone: <path d="M3 10v4M6 7v10M18 7v10M21 10v4M6 12h12" /> },
  { v: 'evolucao', rotulo: 'Evolução', icone: <path d="M4 19V5M4 19h16M8 15l3-4 3 2 5-6" /> },
  {
    v: 'medidas',
    rotulo: 'Medidas',
    icone: (
      <>
        <rect x="3" y="8" width="18" height="8" rx="2" />
        <path d="M7 8v3M11 8v4M15 8v3M19 8v2" />
      </>
    ),
  },
  {
    v: 'plano',
    rotulo: 'Plano',
    icone: (
      <>
        <circle cx="12" cy="12" r="8" />
        <circle cx="12" cy="12" r="4" />
        <circle cx="12" cy="12" r="1" />
      </>
    ),
  },
];

export function Abas({ atual }: { atual: Vista }) {
  return (
    <nav className="tabs" aria-label="Seções">
      <div className="wrap">
        {ABAS.map((a) => (
          <a key={a.v} href={`#${a.v}`} aria-current={a.v === atual ? 'page' : undefined}>
            <svg viewBox="0 0 24 24">{a.icone}</svg>
            {a.rotulo}
          </a>
        ))}
      </div>
    </nav>
  );
}

export const CHECK = (
  <svg viewBox="0 0 24 24" fill="none" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round">
    <path d="M5 12.5l4.5 4.5L19 7.5" />
  </svg>
);
