import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api.js';
import { leerNumero, mostrarNumero } from '../lib/numeros.js';
import { unidadCorta } from '../lib/unidades.js';
import { nuevoIdOperacion } from '../lib/idOperacion.js';
import { IconoCheck } from '../components/iconos.jsx';
import BuscadorProducto from '../components/BuscadorProducto.jsx';
import './Salidas.css';

const MOTIVOS = [
  { id: 'VENTA', texto: 'Venta' },
  { id: 'CONSUMO_INTERNO', texto: 'Consumo interno' },
  { id: 'ROTURA', texto: 'Rotura' },
  { id: 'VENCIMIENTO', texto: 'Vencimiento' },
  { id: 'OTRO', texto: 'Otro' },
];

// Mismas reglas que el backend: unidades y paquetes no se fraccionan.
const ENTERAS = new Set(['UNIDAD', 'PAQUETE']);
const CLAVE_BORRADOR = 'remitto_salida_borrador';

function leerBorrador() {
  try {
    const b = JSON.parse(sessionStorage.getItem(CLAVE_BORRADOR) || 'null');
    if (b && Array.isArray(b.lineas)) return b;
  } catch {
    /* sin borrador */
  }
  return { motivo: 'VENTA', observacion: '', lineas: [] };
}

function guardarBorrador(b) {
  try {
    if (b.lineas.length === 0 && !b.observacion) sessionStorage.removeItem(CLAVE_BORRADOR);
    else sessionStorage.setItem(CLAVE_BORRADOR, JSON.stringify(b));
  } catch {
    /* almacenamiento no disponible */
  }
}

// Problema de una línea, revisado en el momento (el backend vuelve a validar).
function problemaLinea(l) {
  const n = leerNumero(l.texto);
  if (n === null) return 'Ingresá la cantidad.';
  if (Number.isNaN(n)) return 'Número no válido. Usá coma para los decimales, por ejemplo 1,5.';
  if (n <= 0) return 'La cantidad debe ser mayor a 0.';
  if (ENTERAS.has(l.producto.unidadMedida) && !Number.isInteger(n)) return 'Se cuenta en unidades enteras.';
  if (Math.round(n * 1000) !== n * 1000) return 'Hasta 3 decimales.';
  if (n > l.producto.stockActual) {
    return l.producto.stockActual <= 0
      ? 'No hay stock.'
      : `Supera el stock disponible: ${mostrarNumero(l.producto.stockActual)} ${unidadCorta(l.producto.unidadMedida)}`;
  }
  return null;
}

// HU13 · Nueva salida: carrito para descontar varios productos en una sola
// operación. Todo o nada: si una línea no se puede descontar, no se descuenta
// ninguna. Un reintento del mismo carrito no descuenta dos veces.
export default function Salidas() {
  const [borrador, setBorrador] = useState(leerBorrador);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState('');
  const [problemasServidor, setProblemasServidor] = useState({});
  const [resultado, setResultado] = useState(null);
  const enviandoRef = useRef(false);
  // Mismo carrito → mismo idOperacion; cualquier cambio genera uno nuevo.
  const operacion = useRef({ firma: '', id: '' });

  const { motivo, observacion, lineas } = borrador;

  useEffect(() => guardarBorrador(borrador), [borrador]);

  function cambiar(cambios) {
    setBorrador((b) => ({ ...b, ...cambios }));
    setProblemasServidor({});
    setError('');
  }

  function agregar(producto) {
    setResultado(null);
    const existente = lineas.find((l) => l.producto.id === producto.id);
    if (existente) {
      const n = leerNumero(existente.texto);
      const siguiente = Number.isFinite(n) && n !== null ? n + 1 : 1;
      cambiarLinea(producto.id, { texto: mostrarNumero(siguiente) });
      return;
    }
    const { id, nombre, unidadMedida, stockActual } = producto;
    cambiar({ lineas: [...lineas, { producto: { id, nombre, unidadMedida, stockActual }, texto: '1' }] });
  }

  function cambiarLinea(productoId, cambios) {
    cambiar({ lineas: lineas.map((l) => (l.producto.id === productoId ? { ...l, ...cambios } : l)) });
  }

  function sumar(l, delta) {
    const n = leerNumero(l.texto);
    const base = Number.isFinite(n) && n !== null ? n : 0;
    cambiarLinea(l.producto.id, { texto: mostrarNumero(Math.max(1, base + delta)) });
  }

  function quitar(productoId) {
    cambiar({ lineas: lineas.filter((l) => l.producto.id !== productoId) });
  }

  // Tras un rechazo, el stock mostrado puede estar desactualizado.
  async function refrescarStock() {
    const frescos = await Promise.all(
      lineas.map((l) => api.get(`/productos/${l.producto.id}`).catch(() => null)),
    );
    setBorrador((b) => ({
      ...b,
      lineas: b.lineas.map((l) => {
        const f = frescos.find((p) => p?.id === l.producto.id);
        return f ? { ...l, producto: { ...l.producto, stockActual: f.stockActual } } : l;
      }),
    }));
  }

  const problemasLocales = lineas.map(problemaLinea);
  const faltaObservacion = motivo === 'OTRO' && !observacion.trim();
  const puedeConfirmar = lineas.length > 0 && problemasLocales.every((p) => !p) && !faltaObservacion;

  async function confirmar() {
    if (enviandoRef.current || !puedeConfirmar) return;
    enviandoRef.current = true;
    setEnviando(true);
    setError('');
    setProblemasServidor({});
    const cuerpo = {
      motivo,
      observacion: observacion.trim() || undefined,
      lineas: lineas.map((l) => ({ productoId: l.producto.id, cantidad: leerNumero(l.texto) })),
    };
    const firma = JSON.stringify(cuerpo);
    if (operacion.current.firma !== firma) operacion.current = { firma, id: nuevoIdOperacion() };
    try {
      const salida = await api.post('/salidas', { ...cuerpo, idOperacion: operacion.current.id });
      setResultado(salida);
      operacion.current = { firma: '', id: '' };
      setBorrador({ motivo: 'VENTA', observacion: '', lineas: [] });
    } catch (err) {
      const porProducto = {};
      for (const d of err.detalles ?? []) if (d.productoId) porProducto[d.productoId] = d.mensaje;
      setProblemasServidor(porProducto);
      const sinProducto = (err.detalles ?? []).filter((d) => !d.productoId).map((d) => d.mensaje);
      setError([err.message, ...sinProducto].join(' '));
      if (err.status === 400) await refrescarStock();
    } finally {
      enviandoRef.current = false;
      setEnviando(false);
    }
  }

  return (
    <div className="salidas">
      <h1 className="salidas__titulo">Nueva salida</h1>

      {resultado && <ResumenSalida salida={resultado} onCerrar={() => setResultado(null)} />}

      <div className="chips" role="radiogroup" aria-label="Motivo de la salida">
        {MOTIVOS.map((m) => (
          <button
            key={m.id}
            role="radio"
            aria-checked={motivo === m.id}
            className={`chip ${motivo === m.id ? 'chip--activo' : ''}`}
            onClick={() => cambiar({ motivo: m.id })}
          >
            {m.texto}
          </button>
        ))}
      </div>

      <BuscadorProducto onElegir={agregar} soloConStock />

      <div className="card carrito">
        {lineas.length === 0 ? (
          <p className="carrito__vacio">Buscá productos o escaneá su código para agregarlos.</p>
        ) : (
          lineas.map((l, i) => {
            const problema = problemasServidor[l.producto.id] || problemasLocales[i];
            const unidad = unidadCorta(l.producto.unidadMedida);
            return (
              <article key={l.producto.id} className={`carrito__linea ${problema ? 'carrito__linea--error' : ''}`}>
                <div className="carrito__datos">
                  <strong>{l.producto.nombre}</strong>
                  <span>
                    Hay {mostrarNumero(l.producto.stockActual)} {unidad}
                  </span>
                </div>
                <div className="carrito__cantidad">
                  <button aria-label={`Restar uno de ${l.producto.nombre}`} onClick={() => sumar(l, -1)}>
                    −
                  </button>
                  <input
                    inputMode={ENTERAS.has(l.producto.unidadMedida) ? 'numeric' : 'decimal'}
                    value={l.texto}
                    onChange={(e) => cambiarLinea(l.producto.id, { texto: e.target.value })}
                    aria-label={`Cantidad de ${l.producto.nombre}`}
                  />
                  <button aria-label={`Sumar uno de ${l.producto.nombre}`} onClick={() => sumar(l, 1)}>
                    +
                  </button>
                </div>
                <button className="carrito__quitar" onClick={() => quitar(l.producto.id)} aria-label={`Quitar ${l.producto.nombre}`}>
                  Quitar
                </button>
                {problema && <p className="carrito__problema">{problema}</p>}
              </article>
            );
          })
        )}
      </div>

      <label className="campo salidas__observacion">
        <span>Observación{motivo === 'OTRO' ? '' : ' (opcional)'}</span>
        <textarea
          rows={2}
          maxLength={500}
          value={observacion}
          placeholder={motivo === 'OTRO' ? 'Contá brevemente el motivo' : 'Por ejemplo: pedido de mostrador'}
          onChange={(e) => cambiar({ observacion: e.target.value })}
        />
      </label>

      {error && <p className="error-texto salidas__error">{error}</p>}

      <button className="btn btn--primario btn--bloque" onClick={confirmar} disabled={!puedeConfirmar || enviando}>
        {enviando
          ? 'Registrando…'
          : lineas.length === 0
            ? 'Confirmar salida'
            : `Confirmar salida (${lineas.length} ${lineas.length === 1 ? 'producto' : 'productos'})`}
      </button>
    </div>
  );
}

function ResumenSalida({ salida, onCerrar }) {
  return (
    <div className="card salidas__resultado" role="status">
      <h2>
        <IconoCheck size={18} /> Salida #{salida.id} registrada
      </h2>
      {salida.repetida && <p className="salidas__nota">Ya se había registrado: no se descontó de nuevo.</p>}
      <ul>
        {salida.lineas.map((l) => (
          <li key={l.producto.id}>
            <span>{l.producto.nombre}</span>
            <span>
              {mostrarNumero(l.stockAnterior)} − {mostrarNumero(l.cantidad)} → <strong>{mostrarNumero(l.stockNuevo)}</strong>
            </span>
          </li>
        ))}
      </ul>
      <div className="salidas__acciones">
        <button className="btn btn--secundario" onClick={onCerrar}>
          Cerrar
        </button>
        <Link className="btn btn--secundario" to="/movimientos?tipo=SALIDA">
          Ver movimientos
        </Link>
      </div>
    </div>
  );
}
