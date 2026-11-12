import { ddmm } from '../lib/datas';
import { fmt } from '../lib/formato';

export type Ponto = { data: string; y: number };

/** Linha simples com área; destaca o último valor. */
export function Grafico({ pontos, unidade }: { pontos: Ponto[]; unidade: string }) {
  if (pontos.length < 2) return <p className="empty">Registre pelo menos 2 vezes para ver o gráfico.</p>;
  const W = 320, H = 150, L = 34, R = 34, T = 14, B = 24;
  const ys = pontos.map((p) => p.y);
  let lo = Math.min(...ys), hi = Math.max(...ys);
  if (hi === lo) { hi += 1; lo -= 1; }
  const folga = (hi - lo) * 0.15;
  lo -= folga; hi += folga;
  const x = (i: number) => L + ((W - L - R) * i) / (pontos.length - 1);
  const y = (v: number) => T + (H - T - B) * (1 - (v - lo) / (hi - lo));
  const linha = pontos.map((p, i) => `${x(i).toFixed(1)},${y(p.y).toFixed(1)}`).join(' ');
  const area = `M${x(0)},${H - B} L${linha.replace(/ /g, ' L')} L${x(pontos.length - 1)},${H - B} Z`;
  const marcas = [Math.min(...ys), Math.max(...ys)];
  const ultimo = pontos[pontos.length - 1];
  const xu = x(pontos.length - 1);
  return (
    <div className="chart">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Gráfico de ${unidade} ao longo do tempo`}>
        {marcas.map((m, i) => (
          <g key={i}>
            <line className="grid" x1={L} x2={W - R} y1={y(m)} y2={y(m)} />
            <text x={L - 6} y={y(m) + 4} textAnchor="end">{fmt(m)}</text>
          </g>
        ))}
        <path className="area" d={area} />
        <polyline className="ln" points={linha} />
        {pontos.slice(0, -1).map((p, i) => (
          <circle key={i} className="dot" cx={x(i)} cy={y(p.y)} r={2.5} />
        ))}
        <circle className="end" cx={xu} cy={y(ultimo.y)} r={4.5} />
        <text className="endlbl" x={xu} y={y(ultimo.y) - 9} textAnchor="middle">{fmt(ultimo.y)}</text>
        <text x={L} y={H - 6}>{ddmm(pontos[0].data)}</text>
        <text x={W - R} y={H - 6} textAnchor="end">{ddmm(ultimo.data)}</text>
      </svg>
    </div>
  );
}
