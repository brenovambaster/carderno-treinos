// A parte pesada do campo de data (DatePicker do MUI X + dayjs). As telas usam CampoData,
// que carrega este arquivo só quando um campo de data aparece.
import Box from '@mui/material/Box';
import useMediaQuery from '@mui/material/useMediaQuery';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { ptBR } from '@mui/x-date-pickers/locales';
import type { DateValidationError } from '@mui/x-date-pickers/models';
import dayjs, { type Dayjs } from 'dayjs';
import 'dayjs/locale/pt-br';
import { useEffect, useRef, useState, type MouseEvent } from 'react';
import type { PropsCampoData } from './CampoData';

const FORMATO_DATA = 'DD/MM/YYYY';
const ISO = 'YYYY-MM-DD';
const TEXTOS = ptBR.components.MuiLocalizationProvider.defaultProps.localeText;
const AVISOS: Partial<Record<NonNullable<DateValidationError>, string>> = {
  disableFuture: 'Data no futuro.',
  minDate: 'Confira o ano.',
};

const paraDayjs = (iso: string) => (iso ? dayjs(iso) : null);
const aceita = (d: Dayjs | null): d is Dayjs =>
  d != null && d.isValid() && d.year() >= 1900 && !d.isAfter(dayjs(), 'day');

export default function SeletorData({ label, value, onChange, abrirEm = 'dia', disabled, sx }: PropsCampoData) {
  // O que está no campo agora, mesmo pela metade ("13/1M/AAAA").
  const [atual, setAtual] = useState<Dayjs | null>(() => paraDayjs(value));
  const [erro, setErro] = useState<DateValidationError>(null);
  // O último valor que este campo mandou para fora. Se `value` chegar diferente disso,
  // foi a tela que trocou a data (ex.: limpou o formulário depois de salvar) e o campo acompanha.
  const enviado = useRef(value);

  useEffect(() => {
    if (value !== enviado.current) {
      enviado.current = value;
      setAtual(paraDayjs(value));
    }
  }, [value]);

  function mudar(d: Dayjs | null) {
    setAtual(d);
    enviado.current = aceita(d) ? d.format(ISO) : '';
    onChange(enviado.current);
  }

  // Ao sair do campo: se a tela ficou com uma data diferente da que aparece (a tela de treino
  // nunca fica sem data), o campo volta a mostrar a data da tela.
  function sair() {
    if (value && !(aceita(atual) && atual.format(ISO) === value)) {
      enviado.current = value;
      setAtual(paraDayjs(value));
    }
  }

  const ano = abrirEm === 'ano';
  // Mesma regra que o DatePicker usa para escolher entre o modo computador e o modo celular.
  // No celular, tocar em qualquer parte do campo abre o calendário (em vez do teclado).
  const celular = !useMediaQuery('(pointer: fine)', { defaultMatches: true });
  const [aberto, setAberto] = useState(false);
  // O toque é ouvido na caixa em volta do campo, e não no campo: com o campo vazio, o rótulo
  // sobe no meio do toque e o "click" acaba caindo fora da parte editável.
  const caixa = useRef<HTMLDivElement>(null);
  function tocar(e: MouseEvent) {
    // O calendário fica num portal: um toque nele também sobe até aqui, mas não está dentro da caixa.
    if (celular && !disabled && caixa.current?.contains(e.target as Node)) setAberto(true);
  }

  return (
    <Box ref={caixa} onClick={tocar} sx={[{ width: 1 }, ...(Array.isArray(sx) ? sx : [sx])]}>
      <LocalizationProvider dateAdapter={AdapterDayjs} adapterLocale="pt-br" localeText={TEXTOS}>
        <DatePicker
          label={label}
          value={atual}
          onChange={mudar}
          onError={setErro}
          open={aberto}
          onOpen={() => setAberto(true)}
          onClose={() => setAberto(false)}
          format={FORMATO_DATA}
          disableFuture
          disabled={disabled}
          closeOnSelect
          views={ano ? ['year', 'month', 'day'] : ['day']}
          openTo={ano ? 'year' : 'day'}
          // Nascimento ainda vazio: a lista de anos abre perto de quem treina, não no ano atual.
          referenceDate={ano && !atual ? dayjs().subtract(30, 'year').startOf('year') : undefined}
          // Iniciais dos dias como nos calendários daqui: D S T Q Q S S.
          dayOfWeekFormatter={(d) => d.format('dddd').charAt(0).toUpperCase()}
          slotProps={{
            field: { readOnly: celular },
            textField: {
              fullWidth: true,
              size: 'small',
              helperText: erro ? AVISOS[erro] : undefined,
              onBlur: sair,
            },
            toolbar: { toolbarFormat: ano ? 'D [de] MMMM [de] YYYY' : 'ddd, D [de] MMMM' },
            actionBar: { actions: ano ? ['cancel'] : ['today', 'cancel'] },
            // No celular, ao fechar o calendário o foco não volta ao campo (senão o ano fica marcado em azul).
            dialog: { disableRestoreFocus: true },
          }}
        />
      </LocalizationProvider>
    </Box>
  );
}
