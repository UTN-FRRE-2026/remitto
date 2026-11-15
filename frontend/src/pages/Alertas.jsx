import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api, mensajeDeError } from '../lib/api.js';
import { useAuth } from '../context/AuthContext.jsx';
import { mostrarNumero } from '../lib/numeros.js';
import { unidadCorta } from '../lib/unidades.js';
import { fechaHora } from '../lib/comprobantes.js';
import { IconoVolver } from '../components/iconos.jsx';
import './Catalogo.css';
import './Alertas.css';

// HU24 · Alertas de stock: las genera el sistema con cada movimiento y se
// resuelven solas cuando el stock se recupera.
const TIPOS = {
  STOCK_NEGATIVO: { texto: 'Stock negativo', clase: 'badge--sin-stock', ayuda: 'Se registraron más salidas que entradas. Revisá con un recuento.' },
  SIN_STOCK: { texto: 'Sin stock', clase: 'badge--sin-stock', ayuda: 'No quedan unidades.' },
  STOCK_BAJO: { texto: 'Stock bajo', clase: 'badge--stock-bajo', ayuda: 'Llegó al mínimo o está por debajo.' },
};

function Alerta({ a, resuelta = false }) {
  const tipo = TIPOS[a.tipo];
  const u = unidadCorta(a.producto.unidadMedida);
  return (
    <Link to={`/movimientos?productoId=${a.producto.id}`} className={`alerta ${resuelta ? 'alerta--resuelta' : ''}`}>
      <div className="alerta__datos">
        <strong>{a.producto.nombre}</strong>
        <span>
          {resuelta
            ? `${tipo.texto} desde ${fechaHora(a.creadaEn)} (${mostrarNumero(a.stockAlGenerar)} ${u}) · resuelta ${fechaHora(a.resueltaEn)}`
            : `${mostrarNumero(a.producto.stockActual)} ${u}${a.producto.stockMinimo > 0 ? ` de ${mostrarNumero(a.producto.stockMinimo)} mínimo` : ''} · desde ${fechaHora(a.creadaEn)}`}
        </span>
        {!resuelta && <span className="alerta__ayuda">{a.producto.categoria ?? 'Sin categoría'} · {tipo.ayuda}</span>}
      </div>
      <span className={`badge ${resuelta ? 'badge--en-stock' : tipo.clase}`}>{resuelta ? 'Resuelta' : tipo.texto}</span>
    </Link>
  );
}

export default function Alertas() {
  const { esPropietario } = useAuth();
  const navegar = useNavigate();
  const [datos, setDatos] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api
      .get('/alertas')
      .then(setDatos)
      .catch((err) => setError(mensajeDeError(err)));
  }, []);

  const t = datos?.totales;

  return (
    <div className="catalogo alertas">
      <header className="catalogo__cabecera">
        <button type="button" className="catalogo__volver" onClick={() => navegar('/')} aria-label="Volver">
          <IconoVolver size={20} />
        </button>
        <h1 className="catalogo__titulo">
          Alertas de stock <span>{t ? t.total : ''}</span>
        </h1>
      </header>

      {error && <p className="error-texto">{error}</p>}
      {!datos && !error && <div className="spinner" aria-label="Cargando" />}

      {datos && (
        <>
          <div className="alertas__totales" aria-label="Alertas activas por tipo">
            <span className="badge badge--sin-stock">Negativo · {t.STOCK_NEGATIVO}</span>
            <span className="badge badge--sin-stock">Sin stock · {t.SIN_STOCK}</span>
            <span className="badge badge--stock-bajo">Stock bajo · {t.STOCK_BAJO}</span>
          </div>

          <section className="card alertas__lista" aria-label="Alertas activas">
            {datos.activas.length === 0 && (
              <p className="alertas__vacio">No hay alertas activas: todos los productos están por encima de su mínimo.</p>
            )}
            {datos.activas.map((a) => (
              <Alerta key={a.id} a={a} />
            ))}
          </section>

          {esPropietario && datos.activas.length > 0 && (
            <button className="btn btn--secundario btn--bloque alertas__reponer" onClick={() => navegar('/precios?vista=reposicion')}>
              Ver la sugerencia de reposición
            </button>
          )}

          {datos.resueltas.length > 0 && (
            <>
              <h2 className="alertas__subtitulo">Resueltas recientemente</h2>
              <section className="card alertas__lista" aria-label="Alertas resueltas">
                {datos.resueltas.map((a) => (
                  <Alerta key={a.id} a={a} resuelta />
                ))}
              </section>
            </>
          )}
        </>
      )}
    </div>
  );
}
