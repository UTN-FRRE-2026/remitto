import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, mensajeDeError } from '../lib/api.js';
import { mostrarNumero, pesos } from '../lib/numeros.js';
import { unidadCorta } from '../lib/unidades.js';

// HU27 · Sugerencia de reposición: qué comprar y cuánto, por proveedor.
export default function ReportesReposicion() {
  const [datos, setDatos] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api
      .get('/reportes/reposicion')
      .then(setDatos)
      .catch((err) => setError(mensajeDeError(err)));
  }, []);

  if (error) return <p className="error-texto">{error}</p>;
  if (!datos) return <p className="card reportes__vacio">Calculando…</p>;

  const { productos, costoEstimado, productosSinPrecio, proveedores, sinDeseado } = datos;
  return (
    <>
      <section className="card reportes__total" aria-labelledby="reposicion-titulo">
        <h2 id="reposicion-titulo">Sugerencia de reposición</h2>
        <strong className="reportes__monto">
          {productos} {productos === 1 ? 'producto' : 'productos'} para pedir
        </strong>
        <p>
          Productos en su stock mínimo o por debajo. La cantidad los lleva a su stock deseado.
          {productos > 0 && (
            <>
              {' '}
              Costo estimado al último precio: <strong>{pesos(costoEstimado)}</strong>
              {productosSinPrecio > 0
                ? ` (no incluye ${productosSinPrecio === 1 ? '1 producto' : `${productosSinPrecio} productos`} sin precio registrado)`
                : ''}
              .
            </>
          )}
        </p>
      </section>

      {productos === 0 && sinDeseado.length === 0 && (
        <p className="card reportes__vacio">No hay productos para reponer: todos están por encima de su stock mínimo.</p>
      )}

      {proveedores.map((g) => (
        <section key={g.id ?? 'sin'} className="card reportes__categorias reportes__proveedor" aria-label={`Pedido a ${g.nombre}`}>
          <header className="reportes__encabezado reportes__proveedor-cabeza">
            <span>{g.nombre}</span>
            <span>{g.conPrecio > 0 ? pesos(g.costo) : ''}</span>
          </header>
          <ul className="reportes__productos reportes__pedido">
            {g.productos.map((p) => (
              <li key={p.id}>
                <span>
                  <strong>{p.nombre}</strong>
                  <small>
                    Hay {mostrarNumero(p.stockActual)} · mínimo {mostrarNumero(p.stockMinimo)} · deseado {mostrarNumero(p.stockDeseado)}
                    {p.ultimoPrecio != null ? ` · ${pesos(p.ultimoPrecio)} c/u` : ' · sin precio registrado'}
                  </small>
                </span>
                <span className="reportes__pedir">
                  <strong>
                    {mostrarNumero(p.cantidad)} {unidadCorta(p.unidadMedida)}
                  </strong>
                  {p.costo != null && <small>{pesos(p.costo)}</small>}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ))}

      {sinDeseado.length > 0 && (
        <section className="card reportes__sin-precio" aria-labelledby="sin-deseado-titulo">
          <h2 id="sin-deseado-titulo">
            {sinDeseado.length} {sinDeseado.length === 1 ? 'producto' : 'productos'} para reponer sin stock deseado
          </h2>
          <p>Están en su mínimo o por debajo, pero sin un stock deseado mayor al actual no se puede calcular cuánto pedir.</p>
          <ul>
            {sinDeseado.map((p) => (
              <li key={p.id}>
                <span>
                  {p.nombre}{' '}
                  <small>
                    · hay {mostrarNumero(p.stockActual)} {unidadCorta(p.unidadMedida)}, mínimo {mostrarNumero(p.stockMinimo)}
                  </small>
                </span>
                <Link to={`/productos/${p.id}/editar`} className="reportes__enlace">
                  Definir deseado
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}
