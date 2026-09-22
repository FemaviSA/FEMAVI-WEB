import { useMemo, useState } from 'react';

// Barras verticales, una serie. Sin leyenda: el título de afuera la nombra.
// Valores negativos (años con más devoluciones que compras) van en gris, hacia abajo.

const COLOR = '#0067ac';          // azul del sitio; validado contra fondo claro
const COLOR_NEG = '#94a3b8';
const GRILLA = '#e2e8f0';
const TEXTO = '#94a3b8';

function pasoLindo(max: number): number {
  const bruto = max / 4;
  const mag = 10 ** Math.floor(Math.log10(bruto || 1));
  for (const m of [1, 2, 2.5, 5, 10]) if (m * mag >= bruto) return m * mag;
  return 10 * mag;
}

export default function BarrasPorAnio({
  datos: crudos, formato, etiqueta,
}: {
  datos: { anio: number; valor: number }[];
  formato: (n: number) => string;
  etiqueta: string;
}) {
  const [activo, setActivo] = useState<number | null>(null);
  // Los años sin compras van en cero: si se omiten, un cliente que dejó de
  // comprar dos años aparece "pegado", como si nunca hubiera parado.
  const datos = useMemo(() => {
    if (crudos.length === 0) return crudos;
    const m = new Map(crudos.map(d => [d.anio, d.valor]));
    const desde = Math.min(...crudos.map(d => d.anio)), hasta = Math.max(...crudos.map(d => d.anio));
    return Array.from({ length: hasta - desde + 1 }, (_, i) => ({ anio: desde + i, valor: m.get(desde + i) ?? 0 }));
  }, [crudos]);
  const W = 720, H = 220, IZQ = 52, DER = 8, ARR = 10, ABA = 26;
  const anchoPlot = W - IZQ - DER, altoPlot = H - ARR - ABA;

  const { escala, ticks, cero } = useMemo(() => {
    const max = Math.max(0, ...datos.map(d => d.valor));
    const min = Math.min(0, ...datos.map(d => d.valor));
    const paso = pasoLindo(Math.max(max, -min) || 1);
    const tope = Math.ceil(max / paso) * paso || paso;
    const piso = Math.floor(min / paso) * paso;
    const escala = (v: number) => ARR + ((tope - v) / (tope - piso)) * altoPlot;
    const ticks: number[] = [];
    for (let v = piso; v <= tope + 1e-9; v += paso) ticks.push(v);
    return { escala, ticks, cero: escala(0) };
  }, [datos, altoPlot]);

  if (datos.length === 0) return <div className="text-sm text-slate-400 py-8 text-center">Sin compras registradas.</div>;

  const columna = anchoPlot / datos.length;
  const ancho = Math.max(2, Math.min(28, columna - 2));      // 2px de separación entre barras
  const cadaCuanto = datos.length <= 12 ? 1 : datos.length <= 24 ? 2 : 5;
  const r = Math.min(4, ancho / 2);
  const d = activo != null ? datos[activo] : null;

  const barra = (x: number, y0: number, y1: number, positiva: boolean) => {
    // Punta redondeada del lado del dato; la base queda recta contra el cero.
    const top = Math.min(y0, y1), alto = Math.abs(y1 - y0);
    if (alto < r * 2) return <rect x={x} y={top} width={ancho} height={Math.max(alto, 1)} />;
    return positiva
      ? <path d={`M${x},${top + alto} V${top + r} Q${x},${top} ${x + r},${top} H${x + ancho - r} Q${x + ancho},${top} ${x + ancho},${top + r} V${top + alto} Z`} />
      : <path d={`M${x},${top} V${top + alto - r} Q${x},${top + alto} ${x + r},${top + alto} H${x + ancho - r} Q${x + ancho},${top + alto} ${x + ancho},${top + alto - r} V${top} Z`} />;
  };

  return (
    <div className="relative">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" role="img" aria-label={etiqueta}>
        {ticks.map(t => (
          <g key={t}>
            <line x1={IZQ} x2={W - DER} y1={escala(t)} y2={escala(t)} stroke={t === 0 ? '#cbd5e1' : GRILLA} strokeWidth={1} />
            <text x={IZQ - 6} y={escala(t) + 3} textAnchor="end" fontSize={10} fill={TEXTO}>{formato(t)}</text>
          </g>
        ))}
        {datos.map((p, i) => {
          const x = IZQ + i * columna + (columna - ancho) / 2;
          const pos = p.valor >= 0;
          return (
            <g key={p.anio}>
              <g fill={pos ? COLOR : COLOR_NEG} opacity={activo == null || activo === i ? 1 : 0.45}>
                {p.valor !== 0 && barra(x, cero, escala(p.valor), pos)}
              </g>
              {i === datos.length - 1 && (
                <text x={x + ancho / 2} y={pos ? escala(p.valor) - 5 : escala(p.valor) + 12}
                  textAnchor="middle" fontSize={10} fontWeight={600} fill="#475569">{formato(p.valor)}</text>
              )}
              {/* Cada N años más el último; se saltea la periódica si queda pegada al último. */}
              {((i % cadaCuanto === 0 && datos.length - 1 - i >= Math.ceil(cadaCuanto / 2)) || i === datos.length - 1) && (
                <text x={x + ancho / 2} y={H - 8} textAnchor="middle" fontSize={10} fill={TEXTO}>{p.anio}</text>
              )}
              {/* Zona de toque: toda la columna, más ancha que la barra */}
              <rect x={IZQ + i * columna} y={ARR} width={columna} height={altoPlot} fill="transparent"
                onMouseEnter={() => setActivo(i)} onMouseLeave={() => setActivo(null)} onClick={() => setActivo(i)} />
            </g>
          );
        })}
      </svg>
      {d && (
        <div className="absolute top-0 pointer-events-none rounded-lg bg-slate-900 text-white text-xs px-3 py-2 shadow-lg"
          style={{ left: `${((IZQ + (activo! + 0.5) * columna) / W) * 100}%`, transform: 'translateX(-50%)' }}>
          <div className="font-semibold">{d.anio}</div>
          <div>{formato(d.valor)} {etiqueta}</div>
        </div>
      )}
    </div>
  );
}
