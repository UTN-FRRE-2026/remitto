import { useEffect, useMemo, useRef, useState } from 'react';
import { pesos } from '../lib/numeros.js';
import './GraficoPrecios.css';

// HU20 · Gráfico de evolución de precios: una línea por proveedor, un punto por
// compra, ordenados por fecha. SVG propio, sin bibliotecas.
// Colores categóricos en orden fijo (validados contra el fondo de la app);
// el color sigue al proveedor, no a su posición por precio.
export const COLORES_SERIE = ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4', '#008300', '#6250d6', '#e34948'];

const ANCHO_INICIAL = 640;
const ALTO = 240;
const M = { arriba: 12, derecha: 16, abajo: 28, izquierda: 64 };
const DIA = 24 * 60 * 60 * 1000;

const ms = (f) => new Date(f).getTime();
const fechaCorta = (t) => new Date(t).toLocaleDateString('es-AR', { timeZone: 'UTC', day: '2-digit', month: '2-digit', year: '2-digit' });
const precioCorto = (v) => `$ ${Math.round(v).toLocaleString('es-AR')}`;

// Valores «redondos» que cubren de min a max, para las líneas guía.
function marcas(min, max) {
  const paso0 = (max - min) / 3 || max || 1;
  const potencia = 10 ** Math.floor(Math.log10(paso0));
  const paso = [1, 2, 2.5, 5, 10].map((m) => m * potencia).find((p) => p >= paso0);
  const desde = Math.floor(min / paso) * paso;
  const hasta = Math.ceil(max / paso) * paso; // el tope cubre el precio más alto
  const lista = [];
  for (let v = desde; v <= hasta + paso * 0.001; v += paso) lista.push(v);
  return lista;
}

// series: [{ id, nombre, color, puntos: [{ fecha, precio }] }]
export default function GraficoPrecios({ series }) {
  const caja = useRef(null);
  const lienzo = useRef(null);
  const [activa, setActiva] = useState(null); // índice de la fecha señalada
  // Se dibuja al ancho real del contenedor: el texto conserva su tamaño en el celular.
  const [ANCHO, setAncho] = useState(ANCHO_INICIAL);
  useEffect(() => {
    const el = lienzo.current;
    if (!el || typeof ResizeObserver === 'undefined') return undefined;
    const ro = new ResizeObserver(([e]) => setAncho(Math.max(260, Math.round(e.contentRect.width))));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const g = useMemo(() => {
    const todos = series.flatMap((s) => s.puntos);
    let [x0, x1] = [Math.min(...todos.map((p) => ms(p.fecha))), Math.max(...todos.map((p) => ms(p.fecha)))];
    if (x0 === x1) [x0, x1] = [x0 - 15 * DIA, x1 + 15 * DIA];
    const precios = todos.map((p) => p.precio);
    const [pMin, pMax] = [Math.min(...precios), Math.max(...precios)];
    const margen = (pMax - pMin) * 0.1 || pMax * 0.1 || 1;
    const guias = marcas(Math.max(0, pMin - margen), pMax + margen);
    const [y0, y1] = [guias[0], guias[guias.length - 1]];
    const x = (t) => M.izquierda + ((t - x0) / (x1 - x0)) * (ANCHO - M.izquierda - M.derecha);
    const y = (v) => ALTO - M.abajo - ((v - y0) / (y1 - y0 || 1)) * (ALTO - M.arriba - M.abajo);
    // Fechas con compras (para el cursor), sin repetir.
    const fechas = [...new Set(todos.map((p) => ms(p.fecha)))].sort((a, b) => a - b);
    const ejeX = fechas.length <= 3 ? fechas : [0, 1, 2].map((i) => x0 + ((x1 - x0) * i) / 2);
    return { x, y, guias, fechas, ejeX };
  }, [series, ANCHO]);

  // Precio vigente de cada proveedor en una fecha: su última compra hasta ese día.
  const lectura = (t) =>
    series
      .map((s) => {
        const previos = s.puntos.filter((p) => ms(p.fecha) <= t);
        const p = previos[previos.length - 1];
        return p ? { ...s, precio: p.precio, compra: ms(p.fecha) === t } : null;
      })
      .filter(Boolean);

  function mover(e) {
    const r = caja.current.getBoundingClientRect();
    const px = e.clientX - r.left;
    let mejor = 0;
    g.fechas.forEach((t, i) => {
      if (Math.abs(g.x(t) - px) < Math.abs(g.x(g.fechas[mejor]) - px)) mejor = i;
    });
    setActiva(mejor);
  }

  function teclado(e) {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    e.preventDefault();
    const n = g.fechas.length;
    setActiva((a) => (a == null ? n - 1 : Math.min(n - 1, Math.max(0, a + (e.key === 'ArrowRight' ? 1 : -1)))));
  }

  const t = activa == null ? null : g.fechas[activa];
  const filas = t == null ? [] : lectura(t).sort((a, b) => b.precio - a.precio);
  const izquierda = t == null ? 0 : (g.x(t) / ANCHO) * 100;

  return (
    <div className="grafico-precios">
      {series.length > 1 && (
        <ul className="grafico-precios__leyenda" aria-label="Proveedores">
          {series.map((s) => (
            <li key={s.id}>
              <span className="grafico-precios__clave" style={{ background: s.color }} aria-hidden />
              {s.nombre}
            </li>
          ))}
        </ul>
      )}
      <div className="grafico-precios__lienzo" ref={lienzo}>
        <svg
          ref={caja}
          width={ANCHO}
          height={ALTO}
          viewBox={`0 0 ${ANCHO} ${ALTO}`}
          role="img"
          aria-label="Evolución del precio de compra por proveedor. Usá las flechas para recorrer las fechas."
          tabIndex={0}
          onPointerMove={mover}
          onPointerDown={mover}
          onPointerLeave={() => setActiva(null)}
          onFocus={() => setActiva((a) => a ?? g.fechas.length - 1)}
          onBlur={() => setActiva(null)}
          onKeyDown={teclado}
        >
          {g.guias.map((v) => (
            <g key={v}>
              <line className="grafico-precios__guia" x1={M.izquierda} x2={ANCHO - M.derecha} y1={g.y(v)} y2={g.y(v)} />
              <text className="grafico-precios__eje" x={M.izquierda - 8} y={g.y(v)} textAnchor="end" dominantBaseline="middle">
                {precioCorto(v)}
              </text>
            </g>
          ))}
          {g.ejeX.map((tx, i) => (
            <text
              key={tx}
              className="grafico-precios__eje"
              x={g.x(tx)}
              y={ALTO - 8}
              textAnchor={i === 0 && g.ejeX.length > 1 ? 'start' : i === g.ejeX.length - 1 && g.ejeX.length > 1 ? 'end' : 'middle'}
            >
              {fechaCorta(tx)}
            </text>
          ))}
          {t != null && <line className="grafico-precios__cursor" x1={g.x(t)} x2={g.x(t)} y1={M.arriba} y2={ALTO - M.abajo} />}
          {series.map((s) => (
            <g key={s.id}>
              {s.puntos.length > 1 && (
                <polyline
                  className="grafico-precios__linea"
                  stroke={s.color}
                  points={s.puntos.map((p) => `${g.x(ms(p.fecha))},${g.y(p.precio)}`).join(' ')}
                />
              )}
              {s.puntos.map((p, i) => (
                <circle
                  key={i}
                  className="grafico-precios__punto"
                  fill={s.color}
                  cx={g.x(ms(p.fecha))}
                  cy={g.y(p.precio)}
                  r={ms(p.fecha) === t ? 6 : 4}
                />
              ))}
            </g>
          ))}
        </svg>
        {t != null && filas.length > 0 && (
          <div
            className={`grafico-precios__tooltip ${izquierda > 60 ? 'grafico-precios__tooltip--izq' : ''}`}
            style={{ left: `${izquierda}%` }}
            role="status"
          >
            <span className="grafico-precios__tooltip-fecha">{fechaCorta(t)}</span>
            {filas.map((f) => (
              <span key={f.id} className="grafico-precios__tooltip-fila">
                <span className="grafico-precios__clave" style={{ background: f.color }} aria-hidden />
                <strong>{pesos(f.precio)}</strong>
                <small>
                  {f.nombre}
                  {f.compra ? '' : ' · vigente'}
                </small>
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
