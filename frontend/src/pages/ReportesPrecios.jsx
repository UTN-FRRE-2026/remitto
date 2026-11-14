import { useEffect, useMemo, useState } from 'react';
import { api, mensajeDeError } from '../lib/api.js';
import { mostrarNumero, pesos } from '../lib/numeros.js';
import { unidadCorta } from '../lib/unidades.js';
import GraficoPrecios, { COLORES_SERIE } from '../components/GraficoPrecios.jsx';
import { IconoBuscar } from '../components/iconos.jsx';

const ZONA = 'America/Argentina/Buenos_Aires';
const hoy = () => new Date().toLocaleDateString('sv-SE', { timeZone: ZONA });
const restarDias = (dia, n) => {
  const d = new Date(`${dia}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - n);
  return d.toISOString().slice(0, 10);
};
// La fecha de vigencia es un día calendario: se muestra sin correr la zona.
const fecha = (f) => new Date(f).toLocaleDateString('es-AR', { timeZone: 'UTC', day: '2-digit', month: '2-digit', year: 'numeric' });
const PERIODOS = [
  { dias: 90, texto: 'Últimos 3 meses' },
  { dias: 180, texto: 'Últimos 6 meses' },
  { dias: 365, texto: 'Último año' },
];

// Variación con flecha y texto (nunca solo color).
function Variacion({ valor }) {
  if (valor == null) return <small className="reportes__variacion">sin variación medible</small>;
  if (valor === 0) return <span className="badge badge--inactivo">= 0 %</span>;
  return (
    <span className={`badge ${valor > 0 ? 'badge--stock-bajo' : 'badge--en-stock'}`}>
      {valor > 0 ? '▲ +' : '▼ '}
      {mostrarNumero(valor, 1)} %
    </span>
  );
}

// HU20 · Evolución de los precios de compra: productos que más aumentaron y,
// al elegir uno, su historial por proveedor y la comparación del último precio.
export default function ReportesPrecios() {
  const [periodo, setPeriodo] = useState(() => ({ desde: restarDias(hoy(), 364), hasta: hoy() }));
  const [datos, setDatos] = useState(null);
  const [error, setError] = useState('');
  const [busqueda, setBusqueda] = useState('');
  const [elegido, setElegido] = useState(null);

  useEffect(() => {
    if (!periodo.desde || !periodo.hasta) return;
    setError('');
    api
      .get(`/reportes/precios?desde=${periodo.desde}&hasta=${periodo.hasta}`)
      .then(setDatos)
      .catch((err) => setError(mensajeDeError(err)));
  }, [periodo]);

  const ultimos = (n) => setPeriodo({ desde: restarDias(hoy(), n - 1), hasta: hoy() });
  const activo = (n) => periodo.hasta === hoy() && periodo.desde === restarDias(hoy(), n - 1);

  const lista = useMemo(() => {
    const q = busqueda.trim().toLocaleLowerCase('es');
    return (datos?.productos ?? []).filter((p) => !q || p.nombre.toLocaleLowerCase('es').includes(q));
  }, [datos, busqueda]);
  const aumentaron = (datos?.productos ?? []).filter((p) => p.variacion > 0).length;

  return (
    <>
      <section className="card reportes__total" aria-labelledby="precios-titulo">
        <h2 id="precios-titulo">Evolución de precios de compra</h2>
        <p>Precios registrados al confirmar remitos, por proveedor y fecha del comprobante.</p>
        <div className="chips reportes__periodos">
          {PERIODOS.map((p) => (
            <button key={p.dias} className={`chip ${activo(p.dias) ? 'chip--activo' : ''}`} onClick={() => ultimos(p.dias)}>
              {p.texto}
            </button>
          ))}
        </div>
        <div className="reportes__fechas">
          <label>
            <span>Desde</span>
            <input type="date" value={periodo.desde} max={periodo.hasta} onChange={(e) => setPeriodo((p) => ({ ...p, desde: e.target.value }))} />
          </label>
          <label>
            <span>Hasta</span>
            <input type="date" value={periodo.hasta} min={periodo.desde} onChange={(e) => setPeriodo((p) => ({ ...p, hasta: e.target.value }))} />
          </label>
        </div>
      </section>

      {error && <p className="error-texto">{error}</p>}
      {!datos && !error && <p className="card reportes__vacio">Calculando…</p>}

      {datos && elegido && <DetallePrecios productoId={elegido} periodo={periodo} onVolver={() => setElegido(null)} />}

      {datos && !elegido && (
        <>
          {datos.productos.length === 0 ? (
            <p className="card reportes__vacio">No hay precios de compra registrados en el período.</p>
          ) : (
            <section className="card reportes__categorias" aria-label="Productos con precios en el período">
              <p className="reportes__aviso-lista">
                {datos.productos.length} {datos.productos.length === 1 ? 'producto' : 'productos'} con precios en el período ·{' '}
                {aumentaron} {aumentaron === 1 ? 'aumentó' : 'aumentaron'}. Los que más aumentaron, primero.
              </p>
              <div className="input reportes__buscar">
                <IconoBuscar size={18} color="var(--texto-suave)" />
                <input placeholder="Buscar producto" value={busqueda} onChange={(e) => setBusqueda(e.target.value)} aria-label="Buscar producto" />
              </div>
              <ul className="reportes__productos reportes__pedido">
                {lista.map((p) => (
                  <li key={p.id}>
                    <button className="reportes__producto-boton" onClick={() => setElegido(p.id)}>
                      <span>
                        <strong>{p.nombre}</strong>
                        <small>
                          {pesos(p.ultimo.precio)} · {p.ultimo.proveedor} · {fecha(p.ultimo.fecha)}
                        </small>
                        <small>
                          {p.precios} {p.precios === 1 ? 'precio' : 'precios'}
                          {p.proveedores > 1 ? ` de ${p.proveedores} proveedores` : ''}
                        </small>
                      </span>
                      <Variacion valor={p.variacion} />
                    </button>
                  </li>
                ))}
                {lista.length === 0 && <li className="reportes__vacio">Ningún producto coincide con la búsqueda.</li>}
              </ul>
            </section>
          )}
        </>
      )}
    </>
  );
}

function DetallePrecios({ productoId, periodo, onVolver }) {
  const [datos, setDatos] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    setError('');
    api
      .get(`/reportes/precios/${productoId}?desde=${periodo.desde}&hasta=${periodo.hasta}`)
      .then(setDatos)
      .catch((err) => setError(mensajeDeError(err)));
  }, [productoId, periodo]);

  // El color sigue al proveedor (orden por id), no a su posición por precio.
  const series = useMemo(
    () =>
      [...(datos?.proveedores ?? [])]
        .sort((a, b) => a.id - b.id)
        .map((p, i) => ({ ...p, color: COLORES_SERIE[i % COLORES_SERIE.length] })),
    [datos],
  );
  const color = Object.fromEntries(series.map((s) => [s.id, s.color]));

  return (
    <>
      <button className="reportes__volver" onClick={onVolver}>
        ← Volver a la lista
      </button>
      {error && <p className="error-texto">{error}</p>}
      {!datos && !error && <p className="card reportes__vacio">Cargando…</p>}
      {datos && (
        <>
          <section className="card reportes__total" aria-labelledby="producto-precio-titulo">
            <h2 id="producto-precio-titulo">{datos.producto.nombre}</h2>
            {datos.ultimo ? (
              <>
                <strong className="reportes__monto">{pesos(datos.ultimo.precio)}</strong>
                <p>
                  Último precio de compra por {unidadCorta(datos.producto.unidadMedida)} · {datos.ultimo.proveedor} ·{' '}
                  {fecha(datos.ultimo.fecha)}
                </p>
              </>
            ) : (
              <p>No tiene precios de compra registrados en el período.</p>
            )}
          </section>

          {series.length > 0 && (
            <section className="card reportes__grafico" aria-label="Gráfico de evolución">
              <GraficoPrecios series={series} />
            </section>
          )}

          {datos.proveedores.length > 0 && (
            <section className="card reportes__categorias" aria-labelledby="comparacion-titulo">
              <h3 id="comparacion-titulo" className="reportes__proveedor-cabeza">
                Último precio por proveedor
              </h3>
              <ul className="reportes__productos reportes__pedido">
                {datos.proveedores.map((p) => (
                  <li key={p.id}>
                    <span>
                      <strong className="reportes__serie">
                        <span className="reportes__serie-clave" style={{ background: color[p.id] }} aria-hidden />
                        {p.nombre}
                      </strong>
                      <small>
                        {fecha(p.ultimo.fecha)} · {p.puntos.length} {p.puntos.length === 1 ? 'compra' : 'compras'}
                        {p.variacion != null ? ` · desde ${pesos(p.primero.precio)}` : ''}
                      </small>
                      {p.sobreMejor != null && (
                        <small>{p.sobreMejor === 0 ? 'El más barato' : `${mostrarNumero(p.sobreMejor, 1)} % más caro que el más barato`}</small>
                      )}
                    </span>
                    <span className="reportes__pedir">
                      <strong>{pesos(p.ultimo.precio)}</strong>
                      <Variacion valor={p.variacion} />
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {datos.proveedores.length > 0 && (
            <details className="card reportes__tabla">
              <summary>Ver todos los precios ({datos.precios})</summary>
              <table>
                <thead>
                  <tr>
                    <th scope="col">Fecha</th>
                    <th scope="col">Proveedor</th>
                    <th scope="col">Precio</th>
                  </tr>
                </thead>
                <tbody>
                  {datos.proveedores
                    .flatMap((p) => p.puntos.map((pt) => ({ ...pt, proveedor: p.nombre })))
                    .sort((a, b) => new Date(a.fecha) - new Date(b.fecha))
                    .map((pt, i) => (
                      <tr key={i}>
                        <td>{fecha(pt.fecha)}</td>
                        <td>{pt.proveedor}</td>
                        <td>{pesos(pt.precio)}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </details>
          )}
        </>
      )}
    </>
  );
}
