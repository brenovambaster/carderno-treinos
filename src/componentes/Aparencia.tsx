// Tema claro, escuro ou igual ao do aparelho. A escolha fica guardada neste aparelho
// (o MUI salva no localStorage) e vale também para a tela de entrada.
import DarkModeRounded from '@mui/icons-material/DarkModeRounded';
import LightModeRounded from '@mui/icons-material/LightModeRounded';
import SettingsBrightnessRounded from '@mui/icons-material/SettingsBrightnessRounded';
import { useColorScheme } from '@mui/material/styles';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import { useEffect, type ReactElement } from 'react';
import { coresDoEsquema } from '../tema';

type Modo = 'system' | 'light' | 'dark';

const OPCOES: { v: Modo; rotulo: string; icone: ReactElement }[] = [
  { v: 'system', rotulo: 'Automático', icone: <SettingsBrightnessRounded fontSize="small" /> },
  { v: 'light', rotulo: 'Claro', icone: <LightModeRounded fontSize="small" /> },
  { v: 'dark', rotulo: 'Escuro', icone: <DarkModeRounded fontSize="small" /> },
];

/** Se o app está escuro agora (pela escolha da pessoa ou, no automático, pelo aparelho). */
export function useEscuro() {
  return useColorScheme().colorScheme === 'dark';
}

export function EscolherTema() {
  const { mode, setMode } = useColorScheme();
  return (
    <ToggleButtonGroup
      exclusive
      fullWidth
      size="small"
      color="primary"
      aria-label="Tema do app"
      value={mode ?? 'system'}
      onChange={(_, v: Modo | null) => v && setMode(v)}
    >
      {OPCOES.map((o) => (
        <ToggleButton
          key={o.v}
          value={o.v}
          sx={{
            gap: 0.75,
            fontWeight: 600,
            textTransform: 'none',
            // Selecionado cheio, com a cor de texto do tema: lê bem até com o dedo/mouse em cima.
            '&.Mui-selected': { bgcolor: 'primary.main', color: 'primary.contrastText' },
            '&.Mui-selected:hover': { bgcolor: 'primary.dark' },
          }}
        >
          {o.icone}
          {o.rotulo}
        </ToggleButton>
      ))}
    </ToggleButtonGroup>
  );
}

/** Pinta a barra de status do celular com a mesma cor da barra do topo do app. */
export function CorDaBarra() {
  const escuro = useEscuro();
  useEffect(() => {
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', coresDoEsquema(escuro).fundo);
  }, [escuro]);
  return null;
}
