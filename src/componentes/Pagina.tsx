// Peças de layout repetidas nas telas: cabeçalho, cartão com título e estado vazio.
import ArrowBackRounded from '@mui/icons-material/ArrowBackRounded';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import type { ReactNode } from 'react';

export function Cabecalho({
  titulo,
  subtitulo,
  voltar,
  acao,
}: {
  titulo?: ReactNode;
  subtitulo?: ReactNode;
  voltar?: { href: string; rotulo: string };
  acao?: ReactNode;
}) {
  return (
    <Stack spacing={0.5}>
      {voltar && (
        <Button
          href={voltar.href}
          size="small"
          startIcon={<ArrowBackRounded />}
          sx={{ alignSelf: 'flex-start', ml: -1 }}
        >
          {voltar.rotulo}
        </Button>
      )}
      {(titulo || acao) && (
        <Stack direction="row" spacing={1} sx={{ alignItems: 'flex-end', justifyContent: 'space-between' }}>
          <Typography variant="h2" component="h1" sx={{ minWidth: 0, overflowWrap: 'anywhere' }}>
            {titulo}
          </Typography>
          {acao}
        </Stack>
      )}
      {subtitulo && (
        <Typography variant="body2" sx={{ color: 'text.secondary' }}>
          {subtitulo}
        </Typography>
      )}
    </Stack>
  );
}

/** Cartão com título opcional e ação à direita. */
export function Secao({
  titulo,
  subtitulo,
  acao,
  children,
  semPadding,
}: {
  titulo?: ReactNode;
  subtitulo?: ReactNode;
  acao?: ReactNode;
  children: ReactNode;
  semPadding?: boolean;
}) {
  return (
    <Card>
      {titulo && (
        <Stack
          direction="row"
          spacing={1}
          sx={{ px: 2, pt: 2, alignItems: 'flex-start', justifyContent: 'space-between' }}
        >
          <Box sx={{ minWidth: 0 }}>
            <Typography variant="h4" component="h2">
              {titulo}
            </Typography>
            {subtitulo && (
              <Typography variant="body2" sx={{ color: 'text.secondary', mt: 0.25 }}>
                {subtitulo}
              </Typography>
            )}
          </Box>
          {acao}
        </Stack>
      )}
      {semPadding ? children : <CardContent sx={{ '&:last-child': { pb: 2 } }}>{children}</CardContent>}
    </Card>
  );
}

export function Vazio({ children }: { children: ReactNode }) {
  return (
    <Typography variant="body2" sx={{ color: 'text.secondary', textAlign: 'center', py: 3, px: 2 }}>
      {children}
    </Typography>
  );
}
