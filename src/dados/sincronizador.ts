// Envia a fila de pendências quando há sinal (ADR 0002).
import type { Cardio, Serie } from '../lib/tipos';
import { confirmar, pendentes, semTipo, type ItemFila } from './armazem';
import { ehSemRede, FalhaServidor, type Servidor } from './servidor';

export type EstadoSync = {
  estado: 'em-dia' | 'salvando' | 'pendente' | 'erro';
  pendentes: number;
  mensagem?: string;
};

export class Sincronizador {
  private timer: ReturnType<typeof setTimeout> | undefined;
  private intervalo: ReturnType<typeof setInterval> | undefined;
  private enviando = false;
  private denovo = false;
  private repeticoes = 0;
  private readonly aoVoltarSinal = () => void this.enviar();
  private readonly aoMostrar = () => {
    if (document.visibilityState === 'visible') void this.enviar();
  };

  constructor(
    private readonly uid: string,
    private readonly servidor: Servidor,
    private readonly aoMudar: (e: EstadoSync) => void,
  ) {}

  iniciar() {
    window.addEventListener('online', this.aoVoltarSinal);
    document.addEventListener('visibilitychange', this.aoMostrar);
    this.intervalo = setInterval(() => void this.enviar(), 20_000);
    void this.enviar();
  }

  parar() {
    window.removeEventListener('online', this.aoVoltarSinal);
    document.removeEventListener('visibilitychange', this.aoMostrar);
    clearInterval(this.intervalo);
    clearTimeout(this.timer);
  }

  /** Chame depois de pôr algo na fila. */
  agendar(ms = 700) {
    clearTimeout(this.timer);
    this.repeticoes = 0;
    this.aoMudar({ estado: 'salvando', pendentes: 0 });
    this.timer = setTimeout(() => void this.enviar(), ms);
  }

  async enviar(): Promise<void> {
    if (this.enviando) {
      this.denovo = true;
      return;
    }
    this.enviando = true;
    let descartou = false;
    try {
      const itens = await pendentes(this.uid);
      if (itens.length === 0) {
        this.aoMudar({ estado: 'em-dia', pendentes: 0 });
        return;
      }
      this.aoMudar({ estado: 'salvando', pendentes: itens.length });
      try {
        await this.mandar(itens);
        await confirmar(this.uid, itens);
      } catch (e) {
        if (e instanceof FalhaServidor && e.dadoInvalido) {
          descartou = await this.umPorUm(itens);
        } else {
          const resto = (await pendentes(this.uid)).length;
          this.aoMudar(
            ehSemRede(e)
              ? { estado: 'pendente', pendentes: resto }
              : { estado: 'erro', pendentes: resto, mensagem: (e as Error).message },
          );
          return;
        }
      }
      const resto = (await pendentes(this.uid)).length;
      if (descartou) this.aoMudar({ estado: 'erro', pendentes: resto, mensagem: 'Um valor inválido foi descartado.' });
      else if (resto === 0) {
        this.repeticoes = 0;
        this.aoMudar({ estado: 'em-dia', pendentes: 0 });
      } else if (this.repeticoes++ < 3) {
        this.denovo = true; // chegou coisa nova enquanto enviava
      } else {
        this.aoMudar({ estado: 'pendente', pendentes: resto });
      }
    } catch (e) {
      // falha lendo a fila ou um erro inesperado no envio individual
      const resto = (await pendentes(this.uid).catch(() => [])).length;
      this.aoMudar(
        ehSemRede(e)
          ? { estado: 'pendente', pendentes: resto }
          : { estado: 'erro', pendentes: resto, mensagem: (e as Error).message },
      );
    } finally {
      this.enviando = false;
      if (this.denovo) {
        this.denovo = false;
        void this.enviar();
      }
    }
  }

  private async mandar(itens: ItemFila[]) {
    const series = itens.filter((i) => i.tipo === 'serie').map((i) => semTipo(i) as Serie);
    const cardios = itens.filter((i) => i.tipo === 'cardio').map((i) => semTipo(i) as Cardio);
    if (series.length) await this.servidor.enviarSeries(this.uid, series);
    if (cardios.length) await this.servidor.enviarCardios(this.uid, cardios);
  }

  /** Quando o lote é recusado por um valor inválido: envia um por um e descarta só o ruim. */
  private async umPorUm(itens: ItemFila[]): Promise<boolean> {
    let descartou = false;
    for (const item of itens) {
      try {
        await this.mandar([item]);
      } catch (e) {
        if (!(e instanceof FalhaServidor && e.dadoInvalido)) throw e;
        descartou = true;
      }
      await confirmar(this.uid, [item]);
    }
    return descartou;
  }
}
