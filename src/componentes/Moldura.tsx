// Barra do topo (marca e situação da sincronização) e navegação de baixo, por papel.
import CloudDoneRounded from '@mui/icons-material/CloudDoneRounded';
import CloudOffRounded from '@mui/icons-material/CloudOffRounded';
import CloudSyncRounded from '@mui/icons-material/CloudSyncRounded';
import CloudUploadRounded from '@mui/icons-material/CloudUploadRounded';
import ErrorOutlineRounded from '@mui/icons-material/ErrorOutlineRounded';
import FitnessCenterRounded from '@mui/icons-material/FitnessCenterRounded';
import GroupsRounded from '@mui/icons-material/GroupsRounded';
import InsightsRounded from '@mui/icons-material/InsightsRounded';
import PersonRounded from '@mui/icons-material/PersonRounded';
import StraightenRounded from '@mui/icons-material/StraightenRounded';
import AppBar from '@mui/material/AppBar';
import BottomNavigation from '@mui/material/BottomNavigation';
import BottomNavigationAction from '@mui/material/BottomNavigationAction';
import Chip from '@mui/material/Chip';
import Container from '@mui/material/Container';
import Paper from '@mui/material/Paper';
import Toolbar from '@mui/material/Toolbar';
import Typography from '@mui/material/Typography';
import type { ReactElement } from 'react';
import type { EstadoSync } from '../dados/sincronizador';
import type { Papel } from '../lib/tipos';
import { FONTE_DISPLAY } from '../tema';

export type Aba = 'treino' | 'evolucao' | 'medidas' | 'plano' | 'usuarios';

/** Altura da navegação de baixo, para o cronômetro e as barras fixas ficarem acima dela. */
export const ALTURA_ABAS = 56;

type Situacao = { texto: string; cor: 'success' | 'primary' | 'warning' | 'error' | 'default'; icone: ReactElement };

function situacao(e: EstadoSync | undefined, online: boolean): Situacao | null {
  if (!e) return online ? null : { texto: 'Sem conexão', cor: 'warning', icone: <CloudOffRounded /> };
  if (e.estado === 'salvando') return { texto: 'Salvando…', cor: 'primary', icone: <CloudSyncRounded /> };
  if (e.estado === 'erro') return { texto: 'Erro ao salvar', cor: 'error', icone: <ErrorOutlineRounded /> };
  if (e.pendentes > 0)
    return {
      texto: `${e.pendentes} pendente${e.pendentes > 1 ? 's' : ''}`,
      cor: 'warning',
      icone: <CloudUploadRounded />,
    };
  if (!online) return { texto: 'Sem conexão', cor: 'warning', icone: <CloudOffRounded /> };
  return { texto: 'Salvo', cor: 'success', icone: <CloudDoneRounded /> };
}

export function Topo({ estado, online }: { estado?: EstadoSync; online: boolean }) {
  const s = situacao(estado, online);
  return (
    <AppBar
      position="sticky"
      color="inherit"
      elevation={0}
      sx={{ bgcolor: 'background.paper', borderBottom: 1, borderColor: 'divider', pt: 'env(safe-area-inset-top)' }}
    >
      <Container maxWidth="sm" disableGutters>
        <Toolbar sx={{ minHeight: { xs: 52 }, px: 2, gap: 1 }}>
          <FitnessCenterRounded sx={{ color: 'primary.main' }} />
          <Typography
            sx={{
              flex: 1,
              fontFamily: FONTE_DISPLAY,
              fontWeight: 700,
              fontSize: 18,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
            }}
            noWrap
          >
            Caderno de treino
          </Typography>
          {s && (
            <Chip
              size="small"
              variant="outlined"
              color={s.cor}
              icon={s.icone}
              label={s.texto}
              title={estado?.mensagem}
              role="status"
            />
          )}
        </Toolbar>
      </Container>
    </AppBar>
  );
}

const ABAS: { v: Aba; rotulo: string; icone: ReactElement }[] = [
  { v: 'treino', rotulo: 'Treino', icone: <FitnessCenterRounded /> },
  { v: 'evolucao', rotulo: 'Evolução', icone: <InsightsRounded /> },
  { v: 'medidas', rotulo: 'Medidas', icone: <StraightenRounded /> },
  { v: 'plano', rotulo: 'Perfil', icone: <PersonRounded /> },
];

export function Abas({ atual, papel }: { atual: Aba; papel: Papel }) {
  const abas =
    papel === 'aluno'
      ? ABAS
      : [
          ...ABAS,
          { v: 'usuarios' as const, rotulo: papel === 'admin' ? 'Usuários' : 'Alunos', icone: <GroupsRounded /> },
        ];
  return (
    <Paper
      component="nav"
      aria-label="Seções"
      square
      elevation={0}
      sx={{
        position: 'fixed',
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: (t) => t.zIndex.appBar,
        borderTop: 1,
        borderColor: 'divider',
        pb: 'env(safe-area-inset-bottom)',
      }}
    >
      <Container maxWidth="sm" disableGutters>
        <BottomNavigation
          showLabels
          value={atual}
          sx={{ height: ALTURA_ABAS, bgcolor: 'transparent' }}
          onChange={(_, v: Aba) => {
            location.hash = v;
          }}
        >
          {abas.map((a) => (
            <BottomNavigationAction key={a.v} value={a.v} label={a.rotulo} icon={a.icone} />
          ))}
        </BottomNavigation>
      </Container>
    </Paper>
  );
}
