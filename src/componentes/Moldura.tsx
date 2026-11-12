import type { ReactNode } from 'react';
import type { EstadoSync } from '../dados/sincronizador';
import type { Papel } from '../lib/tipos';

export type Aba = 'treino' | 'evolucao' | 'medidas' | 'plano' | 'usuarios';

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

const ABAS: { v: Aba; rotulo: string; icone: ReactNode }[] = [
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

const ABA_USUARIOS = (papel: Papel) => ({
  v: 'usuarios' as const,
  rotulo: papel === 'admin' ? 'Usuários' : 'Alunos',
  icone: (
    <>
      <circle cx="9" cy="8" r="3.2" />
      <path d="M3 19c0-3.3 2.7-5.5 6-5.5s6 2.2 6 5.5" />
      <circle cx="17" cy="9" r="2.4" />
      <path d="M16 14c2.8 0 5 1.8 5 4.6" />
    </>
  ),
});

export function Abas({ atual, papel }: { atual: Aba; papel: Papel }) {
  const abas = papel === 'aluno' ? ABAS : [...ABAS, ABA_USUARIOS(papel)];
  return (
    <nav className="tabs" aria-label="Seções">
      <div className="wrap" style={{ gridTemplateColumns: `repeat(${abas.length}, 1fr)` }}>
        {abas.map((a) => (
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
