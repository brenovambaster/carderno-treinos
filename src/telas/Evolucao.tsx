import Button from '@mui/material/Button';
import Divider from '@mui/material/Divider';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemText from '@mui/material/ListItemText';
import ListSubheader from '@mui/material/ListSubheader';
import MenuItem from '@mui/material/MenuItem';
import Skeleton from '@mui/material/Skeleton';
import Alert from '@mui/material/Alert';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { Fragment, useEffect, useMemo, useState } from 'react';
import { useApp, type Catalogo } from '../contexto';
import { Grafico } from '../componentes/Grafico';
import { Cabecalho, Secao, Vazio } from '../componentes/Pagina';
import type { Servidor } from '../dados/servidor';
import { ddmm, diaDaSemana } from '../lib/datas';
import { fmt } from '../lib/formato';
import { sessaoMaisRecente } from '../lib/sequencia';
import type { Cardio, Ficha, ResumoSessao, Serie } from '../lib/tipos';
import { FONTE_DISPLAY, NUMEROS } from '../tema';

type Props = {
  servidor: Servidor;
  uid: string;
  ficha: Ficha;
  catalogo: Catalogo;
  resumos: ResumoSessao[];
  online: boolean;
  /** Só na própria evolução: abre a sessão na tela de treino. */
  abrirSessao?: (data: string, treinoId: string) => void;
};

/** Gráfico e histórico por exercício, mais os treinos registrados. Serve para a própria evolução e para a de um aluno. */
export function PainelEvolucao({ servidor, uid, ficha, catalogo, resumos, online, abrirSessao }: Props) {
  const nomeTreino = (id: string) =>
    ficha.treinos.find((t) => t.id === id)?.nome ??
    ficha.arquivados.find((t) => t.id === id)?.nome ??
    'Treino que saiu da ficha';
  const [feitos, setFeitos] = useState<string[]>([]);
  const [exId, setExId] = useState(() => {
    const ultima = sessaoMaisRecente(resumos);
    return (ficha.treinos.find((t) => t.id === ultima?.treinoId) ?? ficha.treinos[0])?.exercicios[0]?.id ?? '';
  });
  const [historico, setHistorico] = useState<Serie[] | null | 'erro'>(null);
  const [cardios, setCardios] = useState<Cardio[]>([]);

  const naFicha = useMemo(() => new Set(ficha.treinos.flatMap((t) => t.exercicios.map((e) => e.id))), [ficha]);
  const foraDaFicha = catalogo.exercicios.filter((e) => feitos.includes(e.id) && !naFicha.has(e.id));
  const ex =
    catalogo.exercicios.find((e) => e.id === exId) ??
    ficha.treinos.flatMap((t) => t.exercicios).find((e) => e.id === exId);
  const peloCorpo = ex?.incremento === 0;

  useEffect(() => {
    servidor.exerciciosFeitos(uid).then(setFeitos, () => undefined);
    servidor.cardiosRecentes(uid).then(setCardios, () => undefined);
  }, [servidor, uid]);

  useEffect(() => {
    if (!exId) return;
    let vivo = true;
    setHistorico(null);
    servidor
      .historico(uid, exId)
      .then((h) => vivo && setHistorico(h))
      .catch(() => vivo && setHistorico('erro'));
    return () => {
      vivo = false;
    };
  }, [exId, servidor, uid, online]);

  const linhas = useMemo(() => {
    if (!Array.isArray(historico)) return [];
    const porData = new Map<string, Serie[]>();
    for (const s of historico) porData.set(s.data, [...(porData.get(s.data) ?? []), s]);
    return [...porData.entries()]
      .sort((a, b) => (a[0] < b[0] ? 1 : -1))
      .map(([data, series]) => {
        const ordenadas = series.sort((a, b) => a.indice - b.indice);
        const cargas = ordenadas.map((s) => s.carga).filter((c): c is number => c != null);
        const y =
          peloCorpo || cargas.length === 0 ? Math.max(...ordenadas.map((s) => s.reps ?? 0)) : Math.max(...cargas);
        return { data, series: ordenadas, y };
      });
  }, [historico, peloCorpo]);

  const recentes = resumos.filter((r) => r.registradas > 0).slice(0, 20);
  const cardioDe = (data: string, treinoId: string) =>
    cardios.find((c) => c.data === data && c.treinoId === treinoId)?.cardioMin ?? null;

  const opcoes = [
    ...ficha.treinos.flatMap((t) => [
      <ListSubheader key={`g-${t.id}`}>{`${t.ordem} · ${t.nome}`}</ListSubheader>,
      ...t.exercicios.map((x) => (
        <MenuItem key={`${t.id}-${x.id}`} value={x.id}>
          {x.nome}
        </MenuItem>
      )),
    ]),
    ...(foraDaFicha.length
      ? [
          <ListSubheader key="fora">Fora da ficha (com histórico)</ListSubheader>,
          ...foraDaFicha.map((x) => (
            <MenuItem key={`fora-${x.id}`} value={x.id}>
              {x.nome}
            </MenuItem>
          )),
        ]
      : []),
  ];
  // O mesmo exercício pode estar em dois treinos: o Select precisa de uma opção só por valor.
  const vistos = new Set<string>();
  const opcoesUnicas = opcoes.filter((o) => {
    if (o.type !== MenuItem) return true;
    const v = (o.props as { value: string }).value;
    if (vistos.has(v)) return false;
    vistos.add(v);
    return true;
  });

  return (
    <>
      <Secao
        titulo="Por exercício"
        subtitulo={peloCorpo ? 'Maior número de repetições em cada treino.' : 'Maior carga usada em cada treino.'}
      >
        <TextField select label="Exercício" value={exId} onChange={(e) => setExId(e.target.value)} sx={{ mb: 1 }}>
          {opcoesUnicas}
        </TextField>
        {historico === 'erro' ? (
          <Alert severity="warning">
            {online
              ? 'Não consegui carregar agora. Tente de novo em instantes.'
              : 'Sem conexão: a evolução precisa de internet.'}
          </Alert>
        ) : historico === null ? (
          <Skeleton variant="rounded" height={190} />
        ) : (
          <>
            <Grafico
              pontos={linhas
                .slice()
                .reverse()
                .map((l) => ({ data: l.data, y: l.y }))}
              unidade={peloCorpo ? 'repetições' : 'carga'}
              sufixo={peloCorpo ? ' reps' : ' kg'}
            />
            {linhas.length ? (
              <List disablePadding>
                {linhas.slice(0, 12).map((l, i) => (
                  <Fragment key={l.data}>
                    {i > 0 && <Divider component="li" />}
                    <ListItem
                      disableGutters
                      secondaryAction={
                        <Typography sx={{ fontFamily: FONTE_DISPLAY, fontSize: 18, fontWeight: 600, ...NUMEROS }}>
                          {l.series.map((s) => (s.carga != null ? `${fmt(s.carga)}×` : '') + s.reps).join(' · ')}
                        </Typography>
                      }
                    >
                      <ListItemText primary={ddmm(l.data)} secondary={diaDaSemana(l.data)} />
                    </ListItem>
                  </Fragment>
                ))}
              </List>
            ) : (
              <Vazio>Ainda não há registros deste exercício.</Vazio>
            )}
          </>
        )}
      </Secao>

      <Secao titulo="Treinos registrados">
        {recentes.length ? (
          <List disablePadding>
            {recentes.map((r, i) => {
              const t = ficha.treinos.find((x) => x.id === r.treinoId);
              const total = t ? t.exercicios.reduce((a, e) => a + e.series, 0) : r.registradas;
              const c = cardioDe(r.data, r.treinoId);
              return (
                <Fragment key={`${r.data}|${r.treinoId}`}>
                  {i > 0 && <Divider component="li" />}
                  <ListItem
                    disableGutters
                    secondaryAction={
                      abrirSessao && t ? (
                        <Button size="small" variant="outlined" onClick={() => abrirSessao(r.data, r.treinoId)}>
                          Abrir
                        </Button>
                      ) : undefined
                    }
                  >
                    <ListItemText
                      primary={`${ddmm(r.data)} · ${nomeTreino(r.treinoId)}`}
                      secondary={`${r.feitas} de ${total} séries${c ? ` · ${c} min de cardio` : ''}`}
                      slotProps={{ primary: { sx: { fontWeight: 600 } } }}
                    />
                  </ListItem>
                </Fragment>
              );
            })}
          </List>
        ) : (
          <Vazio>Nenhum treino registrado ainda. Eles aparecem aqui assim que a primeira série for anotada.</Vazio>
        )}
      </Secao>
    </>
  );
}

export function TelaEvolucao() {
  const { servidor, usuario, ficha, catalogo, resumos, online, abrirSessao } = useApp();
  return (
    <>
      <Cabecalho titulo="Evolução" />
      <PainelEvolucao
        servidor={servidor}
        uid={usuario.id}
        ficha={ficha}
        catalogo={catalogo}
        resumos={resumos}
        online={online}
        abrirSessao={abrirSessao}
      />
    </>
  );
}
