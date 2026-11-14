import { useEffect, useState } from 'react';
import { api, mensajeDeError } from '../lib/api.js';
import { mostrarNumero, pesos } from '../lib/numeros.js';
import { unidadCorta } from '../lib/unidades.js';

const ZONA = 'America/Argentina/Buenos_Aires';
const hoy = () => new Date().toLocaleDateString('sv-SE', { timeZone: ZONA });
const restarDias = (dia, n) => {
  const d = new Date(`${dia}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - n);
  return d.toISOString().slice(0, 10);
};
const fechaCorta = (f) => new Date(f).toLocaleDateString('es-AR', { timeZone: ZONA, day: '2-digit', month: '2-digit', year: 'numeric' });
const PERIODOS = [30, 60, 90];

// HU29 · Productos sin movimiento: con stock y sin salidas en el período elegido.
export default function ReportesSinMovimiento() {
  const [periodo, setPeriodo] = useState(() => ({ desde: restarDias(hoy(), 29), hasta: hoy() }));
  const [datos, setDatos] = useState(null);
  const [error, setError] = useState('');
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    if (!periodo.desde || !periodo.hasta) return;
    setCargando(true);
    setError('');
    api
      .get(`/reportes/sin-movimiento?desde=${periodo.desde}&hasta=${periodo.hasta}`)
      .then(setDatos)
      .catch((err) => setError(mensajeDeError(err)))
      .finally(() => setCargando(false));
  }, [periodo]);

  const ultimos = (n) => setPeriodo({ desde: restarDias(hoy(), n - 1), hasta: hoy() });
  const activo = (n) => periodo.hasta === hoy() && periodo.desde === restarDias(hoy(), n - 1);

  return (
    <>
      <section className="card reportes__total" aria-labelledby="sin-mov-titulo">
        <h2 id="sin-mov-titulo">Productos sin movimiento</h2>
        <p>Productos con stock que no tuvieron salidas (ventas, consumo, roturas ni vencimientos) en el período.</p>
        <div className="chips reportes__periodos">
          {PERIODOS.map((n) => (
            <button key={n} className={`chip ${activo(n) ? 'chip--activo' : ''}`} onClick={() => ultimos(n)}>
              Últimos {n} días
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

      {datos && (
        <>
          <section className="card reportes__total reportes__resumen-sin-mov">
            <strong className="reportes__monto">
              {datos.productos.length} {datos.productos.length === 1 ? 'producto' : 'productos'}
            </strong>
            <p>
              Capital inmovilizado a último precio de compra: <strong>{pesos(datos.valorTotal)}</strong>
              {datos.productosSinPrecio > 0
                ? ` (no incluye ${datos.productosSinPrecio === 1 ? '1 producto' : `${datos.productosSinPrecio} productos`} sin precio registrado)`
                : ''}
              {cargando ? ' · actualizando…' : ''}
            </p>
          </section>

          {datos.productos.length === 0 ? (
            <p className="card reportes__vacio">Todos los productos con stock tuvieron salidas en el período.</p>
          ) : (
            <section className="card reportes__categorias" aria-label="Productos sin salidas en el período">
              <ul className="reportes__productos reportes__pedido">
                {datos.productos.map((p) => (
                  <li key={p.id}>
                    <span>
                      <strong>{p.nombre}</strong>
                      <small>
                        {p.categoria} · {mostrarNumero(p.stockActual)} {unidadCorta(p.unidadMedida)} en stock
                      </small>
                      <small>
                        {p.ultimaSalida
                          ? `Última salida: ${fechaCorta(p.ultimaSalida)} (hace ${p.diasSinSalida} ${p.diasSinSalida === 1 ? 'día' : 'días'})`
                          : 'Nunca tuvo salidas'}
                      </small>
                    </span>
                    <span className="reportes__pedir">
                      <strong>{p.valor != null ? pesos(p.valor) : '—'}</strong>
                      {p.valor == null && <small>sin precio</small>}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </>
      )}
    </>
  );
}
