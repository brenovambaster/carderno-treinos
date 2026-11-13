// Campo de data do app. O <input type="date"> nativo mostra a data no formato do navegador
// (num Chrome em inglês, MM/DD/AAAA) e abre um calendário diferente em cada aparelho.
// Este campo usa o DatePicker do MUI X (em SeletorData): sempre DD/MM/AAAA, calendário em
// português e com a cara do tema. No celular, tocar abre o calendário; com mouse, dá para
// digitar ou abrir pelo ícone.
//
// Por fora o valor continua sendo texto "AAAA-MM-DD" (o mesmo do banco e de src/lib/datas.ts).
//
// O DatePicker pesa uns 50 kB (gzip). Para a tela de treino continuar abrindo rápido (ADR 0004),
// ele é carregado à parte; até chegar, aparece um campo comum com a mesma data.
import type { SxProps, Theme } from '@mui/material/styles';
import TextField from '@mui/material/TextField';
import { lazy, Suspense } from 'react';
import { ddmmaaaa } from '../lib/datas';

export interface PropsCampoData {
  label: string;
  /** "AAAA-MM-DD", ou "" quando vazio. */
  value: string;
  /**
   * Recebe "AAAA-MM-DD" quando a data fica completa e válida, e "" quando o campo fica vazio,
   * pela metade ou com uma data que não vale (no futuro, por exemplo).
   */
  onChange: (iso: string) => void;
  /** "ano" para datas longe de hoje, como o nascimento: o calendário abre na lista de anos. */
  abrirEm?: 'dia' | 'ano';
  disabled?: boolean;
  sx?: SxProps<Theme>;
}

const SeletorData = lazy(() => import('./SeletorData'));

/** Campo de data em DD/MM/AAAA. Não aceita datas no futuro: no app, toda data é de algo que já aconteceu. */
export function CampoData(props: PropsCampoData) {
  const reserva = (
    <TextField
      label={props.label}
      value={props.value ? ddmmaaaa(props.value) : ''}
      disabled={props.disabled}
      sx={props.sx}
      slotProps={{ htmlInput: { readOnly: true } }}
    />
  );
  return (
    <Suspense fallback={reserva}>
      <SeletorData {...props} />
    </Suspense>
  );
}
