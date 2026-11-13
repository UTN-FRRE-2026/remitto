import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api.js';
import { leerNumero, mostrarNumero } from '../lib/numeros.js';
import { unidadCorta } from '../lib/unidades.js';
import { IconoCheck } from '../components/iconos.jsx';
import BuscadorProducto from '../components/BuscadorProducto.jsx';
import './Recuento.css';

// Mismas reglas que el backend: unidades y paquetes no se fraccionan.
const ENTERAS = new Set(['UNIDAD', 'PAQUETE']);
const CLAVE_BORRADOR = 'remitto_recuento_borrador';

function leerBorrador() {
  try {
    const b = JSON.parse(sessionStorage.getItem(CLAVE_BORRADOR) || 'null');
    if (b && Array.isArray(b.lineas)) return b;
  } catch {
    /* sin borrador */
  }
  return { observacion: '', lineas: [] };
}

function guardarBorrador(b) {
  try {
    if (b.lineas.length === 0 && !b.observacion) sessionStorage.removeItem(CLAVE_BORRADOR);
    else sessionStorage.setItem(CLAVE_BORRADOR, JSON.stringify(b));
  } catch {
    /* almacenamiento no disponible */
  }
}

// Problema de la cantidad contada (el backend vuelve a validar).
function problemaLinea(l) {
  const n = leerNumero(l.texto);
  if (n === null) return 'Ingresá lo que contaste (0 si no hay).';
  if (Number.isNaN(n)) return 'Número no válido. Usá coma para los decimales, por ejemplo 1,5.';
  if (ENTERAS.has(l.producto.unidadMedida) && !Number.isInteger(n)) return 'Se cuenta en unidades enteras.';
  if (Math.round(n * 1000) !== n * 1000) return 'Hasta 3 decimales.';
  return null;
}

// Contado - registrado, redondeado a la precisión de la base (3 decimales).
const diferenciaDe = (contado, registrado) => Math.round((contado - registrado) * 1000) / 1000;

function Diferencia({ valor, unidad }) {
  if (valor === 0) return <span className="recuento__igual">Sin diferencia</span>;
  return (
    <span className={`badge ${valor < 0 ? 'badge--sin-stock' : 'badge--en-stock'}`}>
      {valor < 0 ? `Faltan ${mostrarNumero(-valor)}` : `Sobran ${mostrarNumero(valor)}`} {unidad}
    </span>
  );
}

// HU14 · Recuento: se cargan las cantidades contadas y se registra un ajuste
// por cada producto con diferencia. Sin diferencia no se registra nada. Si el
// stock de algún producto cambió mientras se contaba, no se ajusta ninguno.
export default function Recuento() {
  const [borrador, setBorrador] = useState(leerBorrador);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState('');
  const [aviso, setAviso] = useState('');
  const [problemasServidor, setProblemasServidor] = useState({});
  const [resultado, setResultado] = useState(null);
  const [ultimoAgregado, setUltimoAgregado] = useState(null);
  const enviandoRef = useRef(false);

  const { observacion, lineas } = borrador;

  useEffect(() => guardarBorrador(borrador), [borrador]);

  function cambiar(cambios) {
    setBorrador((b) => ({ ...b, ...cambios }));
    setProblemasServidor({});
    setError('');
    setAviso('');
  }

  // Se lee el stock y la versión (último movimiento) del momento en que se
  // agrega: el backend no ajusta si el producto tuvo movimientos desde entonces.
  async function agregar(producto) {
    setResultado(null);
    if (lineas.some((l) => l.producto.id === producto.id)) {
      setAviso(`${producto.nombre} ya está en el recuento.`);
      return;
    }
    let estado;
    try {
      estado = await api.get(`/recuentos/producto/${producto.id}`);
    } catch (err) {
      setAviso(err.message);
      return;
    }
    const { id, nombre, unidadMedida, stockActual, ultimoMovimientoId } = estado;
    setBorrador((b) =>
      b.lineas.some((l) => l.producto.id === id)
        ? b
        : { ...b, lineas: [...b.lineas, { producto: { id, nombre, unidadMedida, stockActual, ultimoMovimientoId }, texto: '' }] },
    );
    setProblemasServidor({});
    setError('');
    setAviso('');
    setUltimoAgregado(id);
  }

  function cambiarLinea(productoId, cambios) {
    cambiar({ lineas: lineas.map((l) => (l.producto.id === productoId ? { ...l, ...cambios } : l)) });
  }

  function quitar(productoId) {
    cambiar({ lineas: lineas.filter((l) => l.producto.id !== productoId) });
  }

  const problemasLocales = lineas.map(problemaLinea);
  const diferencias = lineas.map((l, i) =>
    problemasLocales[i] ? null : diferenciaDe(leerNumero(l.texto), l.producto.stockActual),
  );
  const validas = diferencias.filter((d) => d !== null);
  const conDiferencia = validas.filter((d) => d !== 0);
  const faltantes = conDiferencia.filter((d) => d < 0).length;
  const sobrantes = conDiferencia.length - faltantes;
  const puedeConfirmar = lineas.length > 0 && problemasLocales.every((p) => !p);

  async function confirmar() {
    if (enviandoRef.current || !puedeConfirmar) return;
    enviandoRef.current = true;
    setEnviando(true);
    setError('');
    setProblemasServidor({});
    try {
      const recuento = await api.post('/recuentos', {
        observacion: observacion.trim() || undefined,
        lineas: lineas.map((l) => ({
          productoId: l.producto.id,
          contado: leerNumero(l.texto),
          stockRegistrado: l.producto.stockActual,
          ultimoMovimientoId: l.producto.ultimoMovimientoId ?? null,
        })),
      });
      setResultado(recuento);
      setBorrador({ observacion: '', lineas: [] });
    } catch (err) {
      const detalles = err.detalles ?? [];
      const porProducto = {};
      for (const d of detalles) if (d.productoId) porProducto[d.productoId] = d.mensaje;
      const sinProducto = detalles.filter((d) => !d.productoId).map((d) => d.mensaje);
      setError([err.message, ...sinProducto].join(' '));
      // 409: el producto tuvo movimientos mientras se contaba. Se toman el
      // stock y la versión actuales para que la persona revise el conteo
      // antes de confirmar de nuevo.
      const actuales = new Map(detalles.filter((d) => d.stockActual !== undefined).map((d) => [d.productoId, d]));
      if (actuales.size > 0) {
        setBorrador((b) => ({
          ...b,
          lineas: b.lineas.map((l) => {
            const d = actuales.get(l.producto.id);
            return d
              ? { ...l, producto: { ...l.producto, stockActual: d.stockActual, ultimoMovimientoId: d.ultimoMovimientoId } }
              : l;
          }),
        }));
      }
      setProblemasServidor(porProducto);
    } finally {
      enviandoRef.current = false;
      setEnviando(false);
    }
  }

  const textoBoton = enviando
    ? 'Registrando…'
    : !puedeConfirmar
      ? 'Registrar recuento'
      : conDiferencia.length === 0
        ? 'Registrar recuento (sin diferencias)'
        : `Registrar recuento (${conDiferencia.length} ${conDiferencia.length === 1 ? 'ajuste' : 'ajustes'})`;

  return (
    <div className="recuento">
      <h1 className="recuento__titulo">Recuento de stock</h1>
      <p className="recuento__ayuda">
        Contá los productos y cargá lo que hay. Se registra un ajuste por la diferencia con el stock del sistema.
      </p>

      {resultado && <ResultadoRecuento recuento={resultado} onCerrar={() => setResultado(null)} />}

      <BuscadorProducto onElegir={agregar} />
      {aviso && <p className="recuento__nota">{aviso}</p>}

      <div className="card recuento__lista">
        {lineas.length === 0 ? (
          <p className="recuento__vacio">Buscá productos o escaneá su código para contarlos.</p>
        ) : (
          lineas.map((l, i) => {
            const problema = problemasServidor[l.producto.id] || (l.texto.trim() ? problemasLocales[i] : null);
            const unidad = unidadCorta(l.producto.unidadMedida);
            return (
              <article key={l.producto.id} className={`recuento__linea ${problema ? 'recuento__linea--error' : ''}`}>
                <div className="recuento__datos">
                  <strong>{l.producto.nombre}</strong>
                  <span>
                    Sistema: {mostrarNumero(l.producto.stockActual)} {unidad}
                  </span>
                </div>
                <label className="recuento__contado">
                  <span>Contado</span>
                  <input
                    inputMode={ENTERAS.has(l.producto.unidadMedida) ? 'numeric' : 'decimal'}
                    value={l.texto}
                    placeholder="0"
                    autoFocus={l.producto.id === ultimoAgregado}
                    onChange={(e) => cambiarLinea(l.producto.id, { texto: e.target.value })}
                    aria-label={`Cantidad contada de ${l.producto.nombre}`}
                  />
                </label>
                <div className="recuento__diferencia">
                  {diferencias[i] !== null && <Diferencia valor={diferencias[i]} unidad={unidad} />}
                </div>
                <button className="recuento__quitar" onClick={() => quitar(l.producto.id)} aria-label={`Quitar ${l.producto.nombre}`}>
                  Quitar
                </button>
                {problema && <p className="recuento__problema">{problema}</p>}
              </article>
            );
          })
        )}
      </div>

      {lineas.length > 0 && (
        <p className="recuento__resumen" aria-live="polite">
          {validas.length} de {lineas.length} {lineas.length === 1 ? 'producto contado' : 'productos contados'}
          {conDiferencia.length === 0
            ? validas.length > 0
              ? ' · sin diferencias'
              : ''
            : ` · ${conDiferencia.length} con diferencia (faltantes en ${faltantes}, sobrantes en ${sobrantes})`}
        </p>
      )}

      <label className="campo recuento__observacion">
        <span>Observación (opcional)</span>
        <textarea
          rows={2}
          maxLength={500}
          value={observacion}
          placeholder="Por ejemplo: recuento de la góndola de bebidas"
          onChange={(e) => cambiar({ observacion: e.target.value })}
        />
      </label>

      {error && <p className="error-texto recuento__error">{error}</p>}

      <button className="btn btn--primario btn--bloque" onClick={confirmar} disabled={!puedeConfirmar || enviando}>
        {textoBoton}
      </button>
    </div>
  );
}

function ResultadoRecuento({ recuento, onCerrar }) {
  const { resumen } = recuento;
  return (
    <div className="card recuento__resultado" role="status">
      <h2>
        <IconoCheck size={18} /> Recuento registrado
      </h2>
      <p className="recuento__nota">
        {resumen.conDiferencia === 0
          ? 'No había diferencias: no se registró ningún ajuste.'
          : `${resumen.conDiferencia} ${resumen.conDiferencia === 1 ? 'ajuste registrado' : 'ajustes registrados'} · faltantes en ${resumen.faltantes}, sobrantes en ${resumen.sobrantes}, sin diferencia ${resumen.sinDiferencia}.`}
      </p>
      <ul>
        {recuento.lineas.map((l) => {
          const unidad = unidadCorta(l.producto.unidadMedida);
          return (
            <li key={l.producto.id}>
              <span>{l.producto.nombre}</span>
              <span>
                {mostrarNumero(l.stockAnterior)} → <strong>{mostrarNumero(l.contado)}</strong> {unidad}
              </span>
              <Diferencia valor={l.diferencia} unidad={unidad} />
            </li>
          );
        })}
      </ul>
      <div className="recuento__acciones">
        <button className="btn btn--secundario" onClick={onCerrar}>
          Cerrar
        </button>
        <Link className="btn btn--secundario" to="/movimientos?tipo=AJUSTE">
          Ver ajustes
        </Link>
      </div>
    </div>
  );
}
