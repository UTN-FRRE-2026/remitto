import { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api } from '../lib/api.js';
import { mostrarNumero } from '../lib/numeros.js';
import { unidadCorta } from '../lib/unidades.js';
import { useAuth } from '../context/AuthContext.jsx';
import EstadoBadge from '../components/EstadoBadge.jsx';
import { IconoBuscar, IconoCheck, IconoMovimientos } from '../components/iconos.jsx';
import './Movimientos.css';

const TIPOS = [
  { id: '', texto: 'Todos' },
  { id: 'ENTRADA', texto: 'Entradas' },
  { id: 'SALIDA', texto: 'Salidas' },
  { id: 'AJUSTE', texto: 'Ajustes' },
];

const MOTIVO = {
  COMPRA: 'Compra',
  VENTA: 'Venta',
  CONSUMO_INTERNO: 'Consumo interno',
  ROTURA: 'Rotura',
  VENCIMIENTO: 'Vencimiento',
  RECUENTO: 'Recuento',
  OTRO: 'Otro',
};

const TIPO_COMPROBANTE = { REMITO: 'Remito', FACTURA: 'Factura', OTRO: 'Comprobante' };

const ZONA = 'America/Argentina/Buenos_Aires';
const diaLocal = (fecha) => new Date(fecha).toLocaleDateString('en-CA', { timeZone: ZONA });
const hora = (fecha) => new Date(fecha).toLocaleTimeString('es-AR', { timeZone: ZONA, hour: '2-digit', minute: '2-digit' });

function tituloDia(dia) {
  const hoy = diaLocal(new Date());
  const ayer = diaLocal(Date.now() - 24 * 60 * 60 * 1000);
  if (dia === hoy) return 'Hoy';
  if (dia === ayer) return 'Ayer';
  const texto = new Date(`${dia}T12:00:00Z`).toLocaleDateString('es-AR', {
    timeZone: 'UTC',
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: dia.slice(0, 4) === hoy.slice(0, 4) ? undefined : 'numeric',
  });
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

// Agrupa la lista (ya ordenada por fecha descendente) por día de Argentina.
function agruparPorDia(movimientos) {
  const grupos = [];
  for (const m of movimientos) {
    const dia = diaLocal(m.fecha);
    const ultimo = grupos[grupos.length - 1];
    if (ultimo?.dia === dia) ultimo.items.push(m);
    else grupos.push({ dia, items: [m] });
  }
  return grupos;
}

const conSigno = (n) => `${n > 0 ? '+' : n < 0 ? '−' : ''}${mostrarNumero(Math.abs(n))}`;

// HU12 · Movimientos: historial de entradas, salidas y ajustes, con el stock
// antes y después de cada uno. Filtrado por producto muestra sus existencias
// y si coinciden con la suma de sus movimientos.
export default function Movimientos() {
  const { esPropietario } = useAuth();
  const [params, setParams] = useSearchParams();
  const productoId = params.get('productoId') || '';
  const tipo = params.get('tipo') || '';
  const desde = params.get('desde') || '';
  const hasta = params.get('hasta') || '';

  const [datos, setDatos] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [cargandoMas, setCargandoMas] = useState(false);
  const [error, setError] = useState('');
  const [conciliacion, setConciliacion] = useState(null);
  // Descarta respuestas de filtros viejos si el usuario cambia rápido.
  const pedido = useRef(0);

  function cambiarFiltro(cambios) {
    const nuevos = new URLSearchParams(params);
    for (const [clave, valor] of Object.entries(cambios)) {
      if (valor) nuevos.set(clave, valor);
      else nuevos.delete(clave);
    }
    setParams(nuevos, { replace: true });
  }

  function consulta(pagina) {
    const q = new URLSearchParams({ pagina: String(pagina) });
    if (productoId) q.set('productoId', productoId);
    if (tipo) q.set('tipo', tipo);
    if (desde) q.set('desde', desde);
    if (hasta) q.set('hasta', hasta);
    return api.get(`/movimientos?${q.toString()}`);
  }

  useEffect(() => {
    const n = ++pedido.current;
    setCargando(true);
    setError('');
    consulta(1)
      .then((r) => n === pedido.current && setDatos(r))
      .catch((err) => {
        if (n !== pedido.current) return;
        setDatos(null);
        setError(err.detalles?.map?.((d) => d.mensaje).join(' ') || err.message);
      })
      .finally(() => n === pedido.current && setCargando(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productoId, tipo, desde, hasta]);

  useEffect(() => {
    if (!esPropietario) return;
    api.get('/movimientos/conciliacion').then(setConciliacion).catch(() => {});
  }, [esPropietario]);

  async function verMas() {
    const n = pedido.current;
    setCargandoMas(true);
    try {
      const r = await consulta(datos.pagina + 1);
      if (n === pedido.current) {
        setDatos((prev) => ({ ...r, movimientos: [...prev.movimientos, ...r.movimientos] }));
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setCargandoMas(false);
    }
  }

  const hayFiltroFecha = desde || hasta;

  return (
    <div className="movimientos">
      <h1 className="movimientos__titulo">Movimientos</h1>

      {esPropietario && !productoId && conciliacion && (
        <Conciliacion conciliacion={conciliacion} onElegir={(id) => cambiarFiltro({ productoId: String(id) })} />
      )}

      {productoId ? (
        datos?.producto && <FichaProducto producto={datos.producto} onQuitar={() => cambiarFiltro({ productoId: '' })} />
      ) : (
        <BuscadorProducto onElegir={(p) => cambiarFiltro({ productoId: String(p.id) })} />
      )}

      <div className="chips">
        {TIPOS.map((t) => (
          <button
            key={t.id || 'todos'}
            className={`chip ${tipo === t.id ? 'chip--activo' : ''}`}
            onClick={() => cambiarFiltro({ tipo: t.id })}
          >
            {t.texto}
          </button>
        ))}
      </div>

      <div className="movimientos__fechas">
        <label className="campo">
          <span>Desde</span>
          <input type="date" value={desde} max={hasta || undefined} onChange={(e) => cambiarFiltro({ desde: e.target.value })} />
        </label>
        <label className="campo">
          <span>Hasta</span>
          <input type="date" value={hasta} min={desde || undefined} onChange={(e) => cambiarFiltro({ hasta: e.target.value })} />
        </label>
        {hayFiltroFecha && (
          <button className="movimientos__limpiar" onClick={() => cambiarFiltro({ desde: '', hasta: '' })}>
            Quitar fechas
          </button>
        )}
      </div>

      {error && <p className="error-texto movimientos__error">{error}</p>}

      <div className="card movimientos__lista">
        {cargando && <p className="lista__estado">Cargando…</p>}
        {!cargando && datos?.movimientos.length === 0 && (
          <p className="lista__estado">No hay movimientos con estos filtros.</p>
        )}
        {!cargando &&
          datos &&
          agruparPorDia(datos.movimientos).map((g) => (
            <section key={g.dia} className="movimientos__dia">
              <h2>{tituloDia(g.dia)}</h2>
              {g.items.map((m) => (
                <Movimiento
                  key={m.id}
                  m={m}
                  mostrarProducto={!productoId}
                  onProducto={() => cambiarFiltro({ productoId: String(m.producto.id) })}
                />
              ))}
            </section>
          ))}
      </div>

      {!cargando && datos?.hayMas && (
        <button className="btn btn--secundario btn--bloque movimientos__mas" onClick={verMas} disabled={cargandoMas}>
          {cargandoMas ? 'Cargando…' : `Ver más (${datos.total - datos.movimientos.length} restantes)`}
        </button>
      )}
    </div>
  );
}

function Movimiento({ m, mostrarProducto, onProducto }) {
  const unidad = unidadCorta(m.producto?.unidadMedida);
  return (
    <article className="mov">
      <span className={`mov__icono mov__icono--${m.tipo.toLowerCase()}`} aria-hidden>
        <IconoMovimientos size={18} />
      </span>
      <div className="mov__datos">
        {mostrarProducto && (
          <button className="mov__producto" onClick={onProducto} title="Ver movimientos de este producto">
            {m.producto.nombre}
          </button>
        )}
        <span className="mov__motivo">
          {MOTIVO[m.motivo] ?? m.motivo} · <Origen m={m} />
        </span>
        <span className="mov__meta">
          {hora(m.fecha)}
          {m.usuario ? ` · ${m.usuario.nombre}` : ''}
        </span>
      </div>
      <div className="mov__cantidades">
        <strong className={`mov__cant mov__cant--${m.tipo.toLowerCase()}`}>
          {conSigno(m.cantidad)} <small>{unidad}</small>
        </strong>
        <span className="mov__stock">
          {mostrarNumero(m.stockAnterior)} → <b>{mostrarNumero(m.stockNuevo)}</b>
        </span>
      </div>
    </article>
  );
}

function Origen({ m }) {
  const o = m.origen;
  if (o.tipo === 'COMPROBANTE') {
    const nombre = `${TIPO_COMPROBANTE[o.tipoComprobante] ?? 'Comprobante'} ${o.numero ?? `#${o.id}`}`;
    return (
      <>
        <Link to={`/comprobantes/${o.id}/revisar`} className="mov__enlace">
          {nombre}
        </Link>
        {o.proveedor ? ` · ${o.proveedor}` : ''}
      </>
    );
  }
  if (o.tipo === 'SALIDA') {
    return o.origenSalida === 'INTEGRACION' ? `Punto de venta${o.integracion ? ` (${o.integracion})` : ''}` : `Salida #${o.id}`;
  }
  return m.observacion || 'Ajuste de stock';
}

function FichaProducto({ producto: p, onQuitar }) {
  const unidad = unidadCorta(p.unidadMedida);
  return (
    <div className="card ficha">
      <div className="ficha__cabecera">
        <div>
          <h2>{p.nombre}</h2>
          <span>
            {p.categoria ?? 'Sin categoría'}
            {p.activo ? '' : ' · Desactivado'}
          </span>
        </div>
        <button className="ficha__quitar" onClick={onQuitar}>
          Ver todos
        </button>
      </div>

      <div className="ficha__stock">
        <strong>
          {mostrarNumero(p.stockActual)} <small>{unidad}</small>
        </strong>
        <EstadoBadge estado={p.estadoStock} />
      </div>

      <dl className="ficha__totales">
        <div>
          <dt>Entradas</dt>
          <dd className="mov__cant--entrada">{conSigno(p.totales.entradas)}</dd>
        </div>
        <div>
          <dt>Salidas</dt>
          <dd className="mov__cant--salida">{conSigno(p.totales.salidas)}</dd>
        </div>
        <div>
          <dt>Ajustes</dt>
          <dd className="mov__cant--ajuste">{conSigno(p.totales.ajustes)}</dd>
        </div>
      </dl>

      {p.coherente ? (
        <p className="ficha__control ficha__control--ok">
          <IconoCheck size={16} /> El stock coincide con la suma de sus {p.cantidadMovimientos} movimientos.
        </p>
      ) : (
        <p className="ficha__control ficha__control--error">
          El stock registrado no coincide con la suma de sus movimientos ({mostrarNumero(p.sumaMovimientos)} {unidad}).
        </p>
      )}
    </div>
  );
}

function Conciliacion({ conciliacion, onElegir }) {
  if (conciliacion.coherente) {
    return (
      <p className="conciliacion conciliacion--ok">
        <IconoCheck size={16} /> El stock de todos los productos coincide con sus movimientos.
      </p>
    );
  }
  const n = conciliacion.descuadrados.length;
  return (
    <div className="conciliacion conciliacion--error">
      <p>
        <strong>
          {n === 1 ? 'Un producto tiene' : `${n} productos tienen`} un stock que no coincide con sus movimientos.
        </strong>{' '}
        Pedí a soporte que ejecute la conciliación de stock.
      </p>
      <ul>
        {conciliacion.descuadrados.slice(0, 5).map((p) => (
          <li key={p.id}>
            <button onClick={() => onElegir(p.id)}>{p.nombre}</button>: registrado {mostrarNumero(p.stockActual)}, movimientos{' '}
            {mostrarNumero(p.sumaMovimientos)}
          </li>
        ))}
      </ul>
    </div>
  );
}

function BuscadorProducto({ onElegir }) {
  const [q, setQ] = useState('');
  const [resultados, setResultados] = useState([]);
  const [buscando, setBuscando] = useState(false);

  useEffect(() => {
    if (q.trim().length < 2) {
      setResultados([]);
      return undefined;
    }
    const t = setTimeout(() => {
      setBuscando(true);
      api
        .get(`/productos?q=${encodeURIComponent(q.trim())}&incluirInactivos=true`)
        .then((r) => setResultados(r.slice(0, 8)))
        .catch(() => setResultados([]))
        .finally(() => setBuscando(false));
    }, 250);
    return () => clearTimeout(t);
  }, [q]);

  return (
    <div className="movimientos__buscador">
      <div className="input">
        <IconoBuscar size={18} color="var(--texto-suave)" />
        <input
          placeholder="Filtrar por producto"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          aria-label="Filtrar por producto"
        />
      </div>
      {q.trim().length >= 2 && (
        <ul className="movimientos__resultados">
          {buscando && <li className="movimientos__nota">Buscando…</li>}
          {!buscando && resultados.length === 0 && <li className="movimientos__nota">Sin resultados.</li>}
          {resultados.map((p) => (
            <li key={p.id}>
              <button onClick={() => onElegir(p)}>
                {p.nombre}
                <small>
                  {' '}
                  · {mostrarNumero(p.stockActual)} {unidadCorta(p.unidadMedida)}
                </small>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
