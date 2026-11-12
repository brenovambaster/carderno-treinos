// Tema do app (MUI). Mantém a identidade do caderno: azul de anilha como acento,
// títulos em Barlow Condensed e texto em Source Sans 3. Claro, escuro ou automático (igual ao aparelho).
import { createTheme } from '@mui/material/styles';

const DISPLAY = "'Barlow Condensed', 'Arial Narrow', system-ui, sans-serif";
const CORPO = "'Source Sans 3', 'Segoe UI', system-ui, -apple-system, sans-serif";

const titulo = (tamanho: string, peso = 700) => ({
  fontFamily: DISPLAY,
  fontWeight: peso,
  fontSize: tamanho,
  lineHeight: 1.05,
  letterSpacing: '0.01em',
});

const CLARO = {
  primary: { main: '#1E4FD6', contrastText: '#ffffff' },
  secondary: { main: '#0F766E' },
  success: { main: '#167A3A' },
  warning: { main: '#B45309' },
  error: { main: '#B42318' },
  background: { default: '#F2F4F7', paper: '#FFFFFF' },
  text: { primary: '#14181D', secondary: '#5A6570' },
  divider: '#E1E5EA',
};

// No escuro, os botões cheios têm texto escuro. O MUI escurece a cor no hover (variante "dark"),
// o que derrubaria o contraste do texto; aqui o hover clareia um pouco em vez de escurecer.
const ESCURO = {
  primary: { main: '#7398FF', dark: '#8FADFF', contrastText: '#0B1020' },
  secondary: { main: '#5EEAD4', dark: '#86F0DF' },
  success: { main: '#5BD58A', dark: '#7DE0A3' },
  warning: { main: '#F0A55A', dark: '#F5BA7E' },
  error: { main: '#FF7A6B', dark: '#FF978B' },
  background: { default: '#0E1114', paper: '#171B20' },
  text: { primary: '#E7EAEE', secondary: '#97A1AC' },
  divider: '#2A3139',
};

export const tema = createTheme({
  // O esquema em uso vai no atributo data-tema do <html>, para a pessoa poder escolher
  // claro ou escuro no Perfil. No automático, o MUI segue a preferência do aparelho.
  cssVariables: { colorSchemeSelector: 'data-tema' },
  colorSchemes: {
    // Placeholder (como a carga sugerida na série) mais forte que o padrão do MUI (0,42 e 0,5),
    // para ler bem nos dois temas (contraste ≥ 4,5:1), mas ainda mais claro que o valor digitado.
    light: { palette: CLARO, opacity: { inputPlaceholder: 0.62 } },
    dark: { palette: ESCURO, opacity: { inputPlaceholder: 0.55 } },
  },
  shape: { borderRadius: 12 },
  typography: {
    fontFamily: CORPO,
    h1: { ...titulo('2.75rem'), textTransform: 'uppercase' },
    h2: { ...titulo('2.25rem'), textTransform: 'uppercase' },
    h3: { ...titulo('1.5rem', 600) },
    h4: { ...titulo('1.375rem', 600) },
    h5: { ...titulo('1.2rem', 600) },
    h6: { ...titulo('1.1rem', 600) },
    subtitle2: { fontWeight: 700 },
    button: { textTransform: 'none', fontWeight: 700, letterSpacing: 0 },
    overline: { fontWeight: 700, letterSpacing: '0.08em' },
  },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        body: { WebkitTextSizeAdjust: '100%' },
        '@media (prefers-reduced-motion: reduce)': {
          '*': { animation: 'none !important', transition: 'none !important' },
        },
      },
    },
    MuiButton: {
      defaultProps: { disableElevation: true },
      styleOverrides: { root: { borderRadius: 10, minHeight: 40 }, sizeLarge: { minHeight: 48 } },
    },
    MuiCard: { defaultProps: { variant: 'outlined' } },
    MuiCardHeader: {
      styleOverrides: { root: { paddingBottom: 4 }, title: { fontWeight: 700 } },
    },
    MuiPaper: { styleOverrides: { rounded: { borderRadius: 16 } } },
    MuiTextField: { defaultProps: { fullWidth: true, size: 'small' } },
    MuiChip: { styleOverrides: { root: { fontWeight: 600 } } },
    MuiAlert: { styleOverrides: { root: { borderRadius: 10 } } },
    MuiTooltip: { defaultProps: { arrow: true, enterTouchDelay: 0 } },
    MuiBottomNavigationAction: {
      styleOverrides: { root: { minWidth: 0, paddingLeft: 4, paddingRight: 4 }, label: { fontWeight: 600 } },
    },
    MuiListSubheader: { styleOverrides: { root: { fontWeight: 700, lineHeight: '36px' } } },
  },
});

/** Números com largura fixa, para as cargas e repetições não "dançarem". */
export const NUMEROS = { fontVariantNumeric: 'tabular-nums' } as const;
export const FONTE_DISPLAY = DISPLAY;

/**
 * Cores do esquema em uso (claro ou escuro), em hexadecimal. Para quem precisa do valor
 * e não da variável CSS, como os gráficos em SVG.
 */
export function coresDoEsquema(escuro: boolean) {
  const p = escuro ? ESCURO : CLARO;
  return { primaria: p.primary.main, sucesso: p.success.main, divisor: p.divider, fundo: p.background.paper };
}
