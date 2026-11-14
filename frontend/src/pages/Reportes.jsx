import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api } from '../lib/api.js';
import { useAuth } from '../context/AuthContext.jsx';
import { mostrarNumero, pesos } from '../lib/numeros.js';
import { unidadCorta } from '../lib/unidades.js';
import ReportesReposicion from './ReportesReposicion.jsx';
import ReportesSinMovimiento from './ReportesSinMovimiento.jsx';
import './Reportes.css';

// Vistas de la pantalla (HU27, HU28, HU29); la elegida queda en la URL (?vista=).
const VISTAS = [
  { id: 'valorizacion', texto: 'Valorización', Componente: Valorizacion },
  { id: 'reposicion', texto: 'Reposición', Componente: ReportesReposicion },
  { id: 'sin-movimiento', texto: 'Sin movimiento', Componente: ReportesSinMovimiento },
];

const ZONA = 'America/Argentina/Buenos_Aires';
const fecha = (f) => new Date(f).toLocaleDateString('es-AR', { timeZone: 'UTC', day: '2-digit', month: '2-digit', year: 'numeric' });
const momento = (f) =>
  new Date(f).toLocaleString('es-AR', { timeZone: ZONA, day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });

// Precios y reportes: valorización (HU28), sugerencia de reposición (HU27) y
// productos sin movimiento (HU29). Solo el propietario: los reportes muestran
// costos (el backend lo vuelve a comprobar en cada pedido).
export default function Reportes() {
  const { esPropietario } = useAuth();
  const [params, setParams] = useSearchParams();
  const vista = VISTAS.find((v) => v.id === params.get('vista')) ?? VISTAS[0];
  const { Componente } = vista;
  return (
    <div className="reportes">
      <h1 className="reportes__titulo">Precios y reportes</h1>
      {esPropietario ? (
        <>
          <div className="chips reportes__vistas" role="tablist" aria-label="Reportes">
            {VISTAS.map((v) => (
              <button
                key={v.id}
                role="tab"
                aria-selected={v.id === vista.id}
                className={`chip ${v.id === vista.id ? 'chip--activo' : ''}`}
                onClick={() => setParams(v.id === VISTAS[0].id ? {} : { vista: v.id }, { replace: true })}
              >
                {v.texto}
              </button>
            ))}
          </div>
          <Componente key={vista.id} />
        </>
      ) : (
        <p className="card reportes__vacio">Solo el propietario consulta los reportes con costos de compra.</p>
      )}
    </div>
  );
}

function Valorizacion() {
  const [datos, setDatos] = useState(null);
  const [error, setError] = useState('');
  const [abierta, setAbierta] = useState(null);

  useEffect(() => {
    api
      .get('/reportes/valorizacion')
      .then(setDatos)
      .catch((err) => setError(err.message));
  }, []);

  if (error) return <p className="error-texto">{error}</p>;
  if (!datos) return <p className="card reportes__vacio">Calculando…</p>;

  const { total, productosValorizados, categorias, sinPrecio, generadoEn } = datos;
  return (
    <>
      <section className="card reportes__total" aria-labelledby="valorizacion-titulo">
        <h2 id="valorizacion-titulo">Valorización de existencias</h2>
        <strong className="reportes__monto">{pesos(total)}</strong>
        <p>
          {productosValorizados} {productosValorizados === 1 ? 'producto valorizado' : 'productos valorizados'} a su último precio de
          compra · al {momento(generadoEn)}
        </p>
      </section>

      {categorias.length === 0 ? (
        <p className="card reportes__vacio">No hay productos con stock y precio de compra registrado.</p>
      ) : (
        <section className="card reportes__categorias" aria-label="Valor por categoría">
          <header className="reportes__encabezado">
            <span>Categoría</span>
            <span>Valor</span>
          </header>
          {categorias.map((c) => {
            const clave = c.id ?? 'sin';
            const expandida = abierta === clave;
            return (
              <div key={clave} className="reportes__categoria">
                <button
                  className="reportes__fila"
                  onClick={() => setAbierta(expandida ? null : clave)}
                  aria-expanded={expandida}
                >
                  <span className="reportes__nombre">
                    {c.nombre}
                    <small>
                      {c.productos.length} {c.productos.length === 1 ? 'producto' : 'productos'} · {mostrarNumero(c.porcentaje)} %
                    </small>
                  </span>
                  <strong>{pesos(c.valor)}</strong>
                  <span className="reportes__barra" aria-hidden>
                    <span style={{ width: `${Math.max(c.porcentaje, 1)}%` }} />
                  </span>
                </button>
                {expandida && (
                  <ul className="reportes__productos">
                    {c.productos.map((p) => (
                      <li key={p.id}>
                        <span>
                          <strong>{p.nombre}</strong>
                          <small>
                            {mostrarNumero(p.stockActual)} {unidadCorta(p.unidadMedida)} × {pesos(p.ultimoPrecio)} · {fecha(p.fechaPrecio)}
                            {p.proveedor ? ` · ${p.proveedor}` : ''}
                          </small>
                        </span>
                        <strong>{pesos(p.valor)}</strong>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            );
          })}
          <footer className="reportes__suma">
            <span>Total</span>
            <strong>{pesos(total)}</strong>
          </footer>
        </section>
      )}

      {sinPrecio.length > 0 && (
        <section className="card reportes__sin-precio" aria-labelledby="sin-precio-titulo">
          <h2 id="sin-precio-titulo">
            {sinPrecio.length} {sinPrecio.length === 1 ? 'producto' : 'productos'} con stock sin precio de compra
          </h2>
          <p>No se incluyen en el total. El precio se registra al confirmar un remito que lo traiga.</p>
          <ul>
            {sinPrecio.map((p) => (
              <li key={p.id}>
                <span>
                  {p.nombre} <small>· {p.categoria}</small>
                </span>
                <span>
                  {mostrarNumero(p.stockActual)} {unidadCorta(p.unidadMedida)}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <p className="reportes__pie">La evolución de los precios de compra (HU20) se agrega en una próxima entrega.</p>
    </>
  );
}
