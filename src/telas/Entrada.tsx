// Telas antes do app: login, sem convite, acesso desativado, primeiro acesso e falha ao carregar.
import CloudOffRounded from '@mui/icons-material/CloudOffRounded';
import ErrorOutlineRounded from '@mui/icons-material/ErrorOutlineRounded';
import FitnessCenterRounded from '@mui/icons-material/FitnessCenterRounded';
import GoogleIcon from '@mui/icons-material/Google';
import LockOutlined from '@mui/icons-material/LockOutlined';
import MailOutlineRounded from '@mui/icons-material/MailOutlineRounded';
import PersonOutlineRounded from '@mui/icons-material/PersonOutlineRounded';
import Alert from '@mui/material/Alert';
import Avatar from '@mui/material/Avatar';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { useState, type ReactElement, type ReactNode } from 'react';

function Moldura({ icone, titulo, children }: { icone: ReactElement; titulo: string; children: ReactNode }) {
  return (
    <Box
      sx={{
        minHeight: '100dvh',
        display: 'grid',
        placeItems: 'center',
        px: 2,
        py: 3,
        pb: 'calc(24px + env(safe-area-inset-bottom))',
        background: (t) =>
          `radial-gradient(1200px 500px at 50% -10%, rgba(${t.vars!.palette.primary.mainChannel} / 0.14), transparent)`,
      }}
    >
      <Card sx={{ width: '100%', maxWidth: 440 }} elevation={0}>
        <CardContent sx={{ p: 3, '&:last-child': { pb: 3 } }}>
          <Stack spacing={2}>
            <Avatar sx={{ bgcolor: 'primary.main', color: 'primary.contrastText', width: 52, height: 52 }}>
              {icone}
            </Avatar>
            <Typography variant="h2" component="h1">
              {titulo}
            </Typography>
            {children}
          </Stack>
        </CardContent>
      </Card>
    </Box>
  );
}

export function TelaLogin({ entrar }: { entrar: () => Promise<void> }) {
  const [erro, setErro] = useState('');
  const [indo, setIndo] = useState(false);
  return (
    <Moldura icone={<FitnessCenterRounded />} titulo="Caderno de treino">
      <Typography sx={{ color: 'text.secondary' }}>
        Registre suas séries, veja a sugestão de carga para o próximo treino e acompanhe a evolução das medidas.
      </Typography>
      <Button
        size="large"
        variant="contained"
        startIcon={<GoogleIcon />}
        loading={indo}
        loadingPosition="start"
        onClick={async () => {
          setIndo(true);
          setErro('');
          try {
            await entrar();
          } catch {
            setErro(
              navigator.onLine
                ? 'Não consegui abrir o login do Google. Tente de novo.'
                : 'Sem conexão: o primeiro acesso precisa de internet.',
            );
            setIndo(false);
          }
        }}
      >
        Entrar com Google
      </Button>
      {erro && (
        <Alert severity="error" role="alert">
          {erro}
        </Alert>
      )}
      <Typography variant="caption" sx={{ color: 'text.secondary' }}>
        O acesso é por convite: entre com o e-mail que foi liberado.
      </Typography>
    </Moldura>
  );
}

function Botoes({ sair, tentarDeNovo }: { sair: () => void; tentarDeNovo: () => void }) {
  return (
    <Stack direction="row" spacing={1}>
      <Button variant="contained" onClick={tentarDeNovo}>
        Tentar de novo
      </Button>
      <Button variant="outlined" onClick={sair}>
        Entrar com outra conta
      </Button>
    </Stack>
  );
}

export function TelaSemConvite({
  email,
  sair,
  tentarDeNovo,
}: {
  email: string;
  sair: () => void;
  tentarDeNovo: () => void;
}) {
  return (
    <Moldura icone={<MailOutlineRounded />} titulo="Falta o convite">
      <Typography>
        O e-mail <b>{email}</b> ainda não foi liberado. Peça a quem administra o app para adicionar este e-mail e toque
        em “Tentar de novo”.
      </Typography>
      <Botoes sair={sair} tentarDeNovo={tentarDeNovo} />
    </Moldura>
  );
}

export function TelaInativo({
  email,
  sair,
  tentarDeNovo,
}: {
  email: string;
  sair: () => void;
  tentarDeNovo: () => void;
}) {
  return (
    <Moldura icone={<LockOutlined />} titulo="Acesso desativado">
      <Typography>
        O acesso de <b>{email}</b> está desativado. Seus treinos e medidas continuam guardados e voltam quando o acesso
        for reativado. Fale com quem administra o app.
      </Typography>
      <Botoes sair={sair} tentarDeNovo={tentarDeNovo} />
    </Moldura>
  );
}

export function TelaPrimeiroAcesso({ children }: { children: ReactNode }) {
  return (
    <Moldura icone={<PersonOutlineRounded />} titulo="Seu perfil">
      <Typography sx={{ color: 'text.secondary' }}>
        Com esses dados o app calcula suas metas de calorias e proteína. Dá para mudar depois na aba Perfil.
      </Typography>
      {children}
    </Moldura>
  );
}

/** Não deu para carregar e não há cópia no aparelho. `erro` só vem quando há internet. */
export function TelaSemDados({ erro, tentarDeNovo }: { erro?: string; tentarDeNovo: () => void }) {
  return (
    <Moldura
      icone={erro ? <ErrorOutlineRounded /> : <CloudOffRounded />}
      titulo={erro ? 'Algo deu errado' : 'Sem conexão'}
    >
      {erro ? (
        <>
          <Typography>Não consegui carregar sua ficha e seu perfil. O servidor respondeu:</Typography>
          <Alert severity="error">{erro}</Alert>
        </>
      ) : (
        <Typography>
          Na primeira vez, o app precisa de internet para baixar a ficha de treino e o seu perfil. Depois disso, a tela
          de treino funciona sem sinal.
        </Typography>
      )}
      <Button variant="contained" onClick={tentarDeNovo} sx={{ alignSelf: 'flex-start' }}>
        Tentar de novo
      </Button>
    </Moldura>
  );
}
