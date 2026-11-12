import AddRounded from '@mui/icons-material/AddRounded';
import SkipNextRounded from '@mui/icons-material/SkipNextRounded';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Container from '@mui/material/Container';
import LinearProgress from '@mui/material/LinearProgress';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { useCallback, useEffect, useRef, useState } from 'react';
import { FONTE_DISPLAY, NUMEROS } from '../tema';
import { ALTURA_ABAS } from './Moldura';

function bipe(audio: AudioContext | null) {
  try {
    if (audio) {
      const t0 = audio.currentTime;
      [0, 0.25, 0.5].forEach((o) => {
        const g = audio.createGain();
        const os = audio.createOscillator();
        os.frequency.value = 880;
        os.connect(g);
        g.connect(audio.destination);
        g.gain.setValueAtTime(0.0001, t0 + o);
        g.gain.exponentialRampToValueAtTime(0.25, t0 + o + 0.02);
        g.gain.exponentialRampToValueAtTime(0.0001, t0 + o + 0.18);
        os.start(t0 + o);
        os.stop(t0 + o + 0.2);
      });
    }
  } catch {
    /* sem som */
  }
  try {
    navigator.vibrate?.([200, 100, 200]);
  } catch {
    /* sem vibração */
  }
}

/** Cronômetro de descanso: começa ao marcar uma série. */
export function useCronometro() {
  const [estado, setEstado] = useState<{ fim: number; total: number; rotulo: string } | null>(null);
  const [agora, setAgora] = useState(() => Date.now());
  const audio = useRef<AudioContext | null>(null);
  const tocou = useRef(false);

  useEffect(() => {
    if (!estado) return;
    const t = setInterval(() => setAgora(Date.now()), 250);
    return () => clearInterval(t);
  }, [estado]);

  const restante = estado ? Math.max(0, Math.round((estado.fim - agora) / 1000)) : 0;

  useEffect(() => {
    if (!estado || restante > 0 || tocou.current) return;
    tocou.current = true;
    bipe(audio.current);
    const t = setTimeout(() => setEstado(null), 5000);
    return () => clearTimeout(t);
  }, [estado, restante]);

  const iniciar = useCallback((segundos: number, rotulo: string) => {
    try {
      // O som precisa ser liberado num toque do usuário (iPhone).
      if (!audio.current) {
        const C =
          window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (C) audio.current = new C();
      }
      if (audio.current?.state === 'suspended') void audio.current.resume();
    } catch {
      /* sem som */
    }
    tocou.current = false;
    const t = Date.now();
    setAgora(t);
    setEstado({ fim: t + segundos * 1000, total: segundos * 1000, rotulo });
  }, []);

  const mais15 = useCallback(() => {
    tocou.current = false;
    setEstado((e) => e && { ...e, fim: Math.max(e.fim, Date.now()) + 15_000, total: e.total + 15_000 });
  }, []);

  const pular = useCallback(() => setEstado(null), []);

  return { estado, restante, iniciar, mais15, pular };
}

export function Cronometro({ c }: { c: ReturnType<typeof useCronometro> }) {
  if (!c.estado) return null;
  const fim = c.restante === 0;
  const progresso = Math.min(100, (c.restante * 1000 * 100) / c.estado.total);
  return (
    <Paper
      role="timer"
      aria-live="polite"
      square
      elevation={8}
      sx={{
        position: 'fixed',
        left: 0,
        right: 0,
        bottom: `calc(${ALTURA_ABAS}px + env(safe-area-inset-bottom))`,
        zIndex: (t) => t.zIndex.appBar + 1,
        bgcolor: fim ? 'success.main' : 'primary.main',
        color: fim ? 'success.contrastText' : 'primary.contrastText',
        transition: 'background-color .3s',
      }}
    >
      <LinearProgress
        variant="determinate"
        value={progresso}
        color="inherit"
        sx={{ height: 3, bgcolor: 'transparent', opacity: 0.6 }}
      />
      <Container maxWidth="sm">
        <Stack direction="row" spacing={1} sx={{ alignItems: 'center', height: 72 }}>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography variant="body2" noWrap sx={{ opacity: 0.9 }}>
              {fim ? 'Bora para a próxima série' : `Descanso · ${c.estado.rotulo}`}
            </Typography>
            <Typography sx={{ fontFamily: FONTE_DISPLAY, fontWeight: 700, fontSize: 44, lineHeight: 1, ...NUMEROS }}>
              {Math.floor(c.restante / 60)}:{String(c.restante % 60).padStart(2, '0')}
            </Typography>
          </Box>
          <Button variant="outlined" color="inherit" startIcon={<AddRounded />} onClick={c.mais15}>
            15s
          </Button>
          <Button variant="outlined" color="inherit" endIcon={<SkipNextRounded />} onClick={c.pular}>
            Pular
          </Button>
        </Stack>
      </Container>
    </Paper>
  );
}
