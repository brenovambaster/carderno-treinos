import '@fontsource/barlow-condensed/latin-500.css';
import '@fontsource/barlow-condensed/latin-600.css';
import '@fontsource/barlow-condensed/latin-700.css';
import '@fontsource/source-sans-3/latin-400.css';
import '@fontsource/source-sans-3/latin-600.css';
import '@fontsource/source-sans-3/latin-700.css';
import './styles.css';

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import { App } from './App';
import { criarServidorSupabase } from './dados/servidorSupabase';
import type { Servidor } from './dados/servidor';

async function iniciar() {
  const servidor: Servidor =
    import.meta.env.VITE_DEMO === '1'
      ? (await import('./dados/demo/servidorDemo')).criarServidorDemo()
      : criarServidorSupabase();
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App servidor={servidor} />
    </StrictMode>,
  );
}

registerSW({ immediate: true });
void iniciar();
