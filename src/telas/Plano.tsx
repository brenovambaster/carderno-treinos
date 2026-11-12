// Aba Perfil: atividade dos últimos 30 dias, metas de calorias e proteína, a ficha e as regras do treino.
import EditRounded from '@mui/icons-material/EditRounded';
import LogoutRounded from '@mui/icons-material/LogoutRounded';
import Alert from '@mui/material/Alert';
import Avatar from '@mui/material/Avatar';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import Grid from '@mui/material/Grid';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemAvatar from '@mui/material/ListItemAvatar';
import ListItemText from '@mui/material/ListItemText';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { Fragment, useEffect, useState, type ReactNode } from 'react';
import { Atividade } from '../componentes/Atividade';
import { Cabecalho, Secao } from '../componentes/Pagina';
import { useApp } from '../contexto';
import { pendentes } from '../dados/armazem';
import { hojeISO } from '../lib/datas';
import { fmt } from '../lib/formato';
import { calcularMetas, pesoAtual } from '../lib/metas';
import { OBJETIVOS, PAPEIS, TIPOS_TRABALHO } from '../lib/tipos';
import { href } from '../rotas';
import { FONTE_DISPLAY, NUMEROS } from '../tema';
import { FormPerfil } from './FormPerfil';

function Indicador({
  rotulo,
  valor,
  unidade,
  detalhe,
}: {
  rotulo: string;
  valor: string;
  unidade: string;
  detalhe: string;
}) {
  return (
    <Card sx={{ height: '100%' }}>
      <CardContent sx={{ '&:last-child': { pb: 2 } }}>
        <Typography variant="overline" sx={{ color: 'text.secondary', lineHeight: 1.4, display: 'block' }}>
          {rotulo}
        </Typography>
        <Typography sx={{ fontFamily: FONTE_DISPLAY, fontWeight: 700, fontSize: 38, lineHeight: 1.1, ...NUMEROS }}>
          {valor}
          <Typography component="span" sx={{ fontSize: 18, ml: 0.5, color: 'text.secondary', fontFamily: 'inherit' }}>
            {unidade}
          </Typography>
        </Typography>
        <Typography variant="caption" sx={{ color: 'text.secondary' }}>
          {detalhe}
        </Typography>
      </CardContent>
    </Card>
  );
}

/** Lista de regras: título em negrito e explicação. */
export function Regras({ itens }: { itens: [string, ReactNode][] }) {
  return (
    <List disablePadding>
      {itens.map(([t, d], i) => (
        <Fragment key={t}>
          {i > 0 && <Divider component="li" />}
          <ListItem disableGutters sx={{ py: 1 }}>
            <ListItemText primary={t} secondary={d} slotProps={{ primary: { sx: { fontWeight: 600 } } }} />
          </ListItem>
        </Fragment>
      ))}
    </List>
  );
}

export function TelaPlano() {
  const { usuario, perfil, salvarPerfil, medicoes, ficha, acesso, resumos, sair, estadoSync } = useApp();
  const [editando, setEditando] = useState(false);
  const [confirmarSaida, setConfirmarSaida] = useState<number | null>(null);
  const peso = pesoAtual(medicoes);
  const m = peso != null ? calcularMetas(perfil, peso, hojeISO()) : null;
  const nomeTreino = (id: string) =>
    ficha.treinos.find((t) => t.id === id)?.nome ?? ficha.arquivados.find((t) => t.id === id)?.nome ?? 'treino';

  useEffect(() => setConfirmarSaida(null), [estadoSync.pendentes]);

  async function pedirSaida() {
    const n = (await pendentes(usuario.id)).length;
    if (n > 0 && confirmarSaida === null) {
      setConfirmarSaida(n);
      return;
    }
    await sair();
  }

  if (editando) {
    return (
      <>
        <Cabecalho
          titulo="Seu perfil"
          subtitulo="O peso fica em Medidas: as metas usam sempre o último peso registrado."
        />
        <Card>
          <CardContent>
            <FormPerfil
              inicial={perfil}
              comPeso={false}
              rotuloBotao="Salvar perfil"
              aoCancelar={() => setEditando(false)}
              aoSalvar={async (p) => {
                await salvarPerfil(p);
                setEditando(false);
              }}
            />
          </CardContent>
        </Card>
      </>
    );
  }

  const textoAjuste =
    perfil.objetivo === 'perder'
      ? 'Comendo ~400 kcal a menos que isso, o corpo tira a diferença da reserva de gordura. A proteína (2 g por kg) faz ele usar gordura, e não músculo.'
      : perfil.objetivo === 'ganhar'
        ? 'Comendo ~300 kcal a mais que isso, sobra energia para construir músculo sem acumular muita gordura. A proteína (2 g por kg) é a matéria-prima.'
        : 'Comendo perto disso, o peso fica estável. A proteína (2 g por kg) ajuda a trocar gordura por músculo aos poucos.';

  return (
    <>
      <Stack direction="row" spacing={2} sx={{ alignItems: 'center' }}>
        <Avatar
          sx={{
            width: 56,
            height: 56,
            bgcolor: 'primary.main',
            color: 'primary.contrastText',
            fontWeight: 700,
            fontSize: 24,
          }}
        >
          {usuario.email[0]?.toUpperCase()}
        </Avatar>
        <Box sx={{ minWidth: 0 }}>
          <Typography variant="h2" component="h1">
            Perfil
          </Typography>
          <Stack direction="row" spacing={1} sx={{ alignItems: 'center', minWidth: 0 }}>
            <Typography variant="body2" noWrap sx={{ color: 'text.secondary' }}>
              {usuario.email}
            </Typography>
            {acesso.papel !== 'aluno' && (
              <Chip size="small" color="primary" variant="outlined" label={PAPEIS[acesso.papel]} />
            )}
          </Stack>
        </Box>
      </Stack>

      <Atividade resumos={resumos} nomeTreino={nomeTreino} metaSemanal={perfil.metaSemanal} />

      {m ? (
        <>
          <Grid container spacing={2}>
            <Grid size={6}>
              <Indicador rotulo="Calorias por dia" valor={fmt(m.kcal, 0)} unidade="kcal" detalhe="ponto de partida" />
            </Grid>
            <Grid size={6}>
              <Indicador
                rotulo="Proteína por dia"
                valor={String(m.prot)}
                unidade="g"
                detalhe={`mínimo ${m.protMin} g`}
              />
            </Grid>
          </Grid>
          <Secao titulo="De onde vêm esses números">
            <Typography variant="body2">
              Com {fmt(m.peso)} kg, {fmt(perfil.alturaCm / 100, 2)} m e {m.idade} anos, seu corpo gasta uns{' '}
              <b>{fmt(m.tmb, 0)} kcal</b> parado. Somando trabalho {TIPOS_TRABALHO[perfil.tipoTrabalho]} e{' '}
              {perfil.metaSemanal} treino
              {perfil.metaSemanal > 1 ? 's' : ''} por semana, o gasto fica perto de <b>{fmt(m.gasto, 0)} kcal</b>.{' '}
              {textoAjuste}
            </Typography>
            <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mt: 1 }}>
              É uma estimativa. As metas se atualizam com o último peso registrado em Medidas; quem decide os ajustes é
              a tendência das medidas.
            </Typography>
          </Secao>
        </>
      ) : (
        <Alert severity="info">Registre seu peso em Medidas para ver as metas de calorias e proteína.</Alert>
      )}

      <Secao
        titulo="Sua ficha"
        subtitulo="O app sempre abre no próximo treino da sequência, em qualquer dia."
        acao={
          <Button size="small" href={href({ v: 'ficha' })} startIcon={ficha.podeEditar ? <EditRounded /> : undefined}>
            {ficha.podeEditar ? 'Editar' : 'Ver'}
          </Button>
        }
      >
        <List disablePadding>
          {ficha.treinos.map((t, i) => (
            <Fragment key={t.id}>
              {i > 0 && <Divider component="li" variant="inset" />}
              <ListItem disableGutters>
                <ListItemAvatar>
                  <Avatar
                    sx={{
                      bgcolor: 'action.selected',
                      color: 'text.primary',
                      fontFamily: FONTE_DISPLAY,
                      fontWeight: 700,
                    }}
                  >
                    {t.ordem}
                  </Avatar>
                </ListItemAvatar>
                <ListItemText
                  primary={t.nome}
                  secondary={[
                    t.foco,
                    `${t.exercicios.length} exercício${t.exercicios.length > 1 ? 's' : ''}`,
                    t.cardio.replace('Depois: ', '').replace('Cardio opcional: ', 'opcional: '),
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                  slotProps={{ primary: { sx: { fontWeight: 600 } } }}
                />
              </ListItem>
            </Fragment>
          ))}
        </List>
        {acesso.personal && !ficha.podeEditar && (
          <Typography variant="caption" sx={{ color: 'text.secondary' }}>
            Quem monta a sua ficha é o seu personal (<b>{acesso.personal}</b>).
          </Typography>
        )}
      </Secao>

      <Secao titulo="Regras do treino">
        <Regras
          itens={[
            ['Aquecimento', '5 min de esteira + 1–2 séries leves do primeiro exercício (não anote).'],
            [
              'Intensidade',
              'Termine cada série com 1–2 repetições sobrando. Em máquina e polia, a última série pode ir até a falha.',
            ],
            [
              'Progressão',
              'Mantenha a carga e vá somando repetições. Quando todas as séries chegarem no topo da faixa, o app avisa: suba a carga e volte para perto do mínimo.',
            ],
            ['Quanto subir', 'Halteres +1 a 2 kg; barra e máquinas de tronco +2,5 a 5 kg; pernas +5 a 10 kg.'],
            ['Técnica', 'Desça o peso em 2–3 segundos, sem deixar cair. Carga com técnica ruim não conta.'],
            [
              'Semana leve',
              'A cada 8 semanas (ou antes, se o cansaço acumular), faça metade das séries com a mesma carga.',
            ],
          ]}
        />
      </Secao>

      <Secao titulo="Fora da academia">
        <Regras
          itens={[
            [
              'Passos',
              '8.000–10.000 por dia. Se passa muito tempo sentado, levante a cada hora e caminhe depois do almoço.',
            ],
            [
              'Proteína em toda refeição',
              'Ovos no café, ~150 g de carne ou frango no almoço e no jantar, e um lanche com iogurte, whey ou atum.',
            ],
            ...(perfil.objetivo === 'perder'
              ? [
                  [
                    'Dois carboidratos no prato',
                    'Arroz + macarrão ou batata juntos somam muito. Escolher um e completar com salada corta ~150–200 kcal.',
                  ] as [string, string],
                ]
              : []),
            ...(perfil.objetivo === 'ganhar'
              ? [
                  [
                    'Um lanche a mais',
                    'Pão com ovos, banana com aveia ou um sanduíche entre as refeições ajuda a fechar as calorias.',
                  ] as [string, string],
                ]
              : []),
            ['Sono', '7–8 horas. É no descanso que o músculo cresce.'],
          ]}
        />
      </Secao>

      <Secao titulo="Seus dados">
        <Typography variant="body2">
          {perfil.sexo === 'M' ? 'Homem' : 'Mulher'} · {m ? `${m.idade} anos · ` : ''}
          {fmt(perfil.alturaCm / 100, 2)} m · trabalho {TIPOS_TRABALHO[perfil.tipoTrabalho]} ·{' '}
          {OBJETIVOS[perfil.objetivo]} · {perfil.metaSemanal} treino{perfil.metaSemanal > 1 ? 's' : ''} por semana
        </Typography>
        {confirmarSaida !== null && (
          <Alert severity="warning" sx={{ mt: 2 }}>
            {confirmarSaida} alteraç{confirmarSaida > 1 ? 'ões ainda não foram enviadas' : 'ão ainda não foi enviada'}.
            Se sair agora, elas ficam guardadas neste aparelho e sobem quando você entrar de novo com a mesma conta.
          </Alert>
        )}
        <Stack direction="row" spacing={1} sx={{ mt: 2 }}>
          <Button variant="outlined" startIcon={<EditRounded />} onClick={() => setEditando(true)}>
            Editar perfil
          </Button>
          <Button
            variant={confirmarSaida !== null ? 'contained' : 'text'}
            color={confirmarSaida !== null ? 'error' : 'inherit'}
            startIcon={<LogoutRounded />}
            onClick={() => void pedirSaida()}
          >
            {confirmarSaida !== null ? 'Sair mesmo assim' : 'Sair'}
          </Button>
        </Stack>
      </Secao>
    </>
  );
}
