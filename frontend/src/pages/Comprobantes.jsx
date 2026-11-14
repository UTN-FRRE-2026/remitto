import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { api, mensajeDeError } from '../lib/api.js';
import { pesos, mostrarNumero } from '../lib/numeros.js';
import {
  ESTADO_COMPROBANTE,
  fechaDia,
  fechaHora,
  rutaComprobante,
  tituloComprobante,
} from '../lib/comprobantes.js';
import { IconoBuscar, IconoComprobantes, IconoMas } from '../components/iconos.jsx';
import './Productos.css';
import './Catalogo.css';
import './Comprobantes.css';

const CHIPS = [
  { id: '', texto: 'Todos', clave: 'TODOS' },
  { id: 'EN_REVISION', texto: 'En revisión', clave: 'EN_REVISION' },
  { id: 'CONFIRMADO', texto: 'Confirmados', clave: 'CONFIRMADO' },
  { id: 'EN_PROCESO', texto: 'Sin leer o leyendo', clave: 'EN_PROCESO', soloSiHay: true },
  { id: 'ERROR', texto: 'Con error', clave: 'ERROR', soloSiHay: true },
];

// HU18 · Comprobantes archivados: todos los remitos y facturas cargados, con su
// estado y su archivo original. Uno en revisión se retoma desde acá.
export default function Comprobantes() {
  const navegar = useNavigate();
  const [params] = useSearchParams();
  const [filtros, setFiltros] = useState({
    estado: params.get('estado') ?? '',
    proveedorId: params.get('proveedorId') ?? '',
    desde: '',
    hasta: '',
    numero: '',
  });
  const [proveedores, setProveedores] = useState([]);
  const [datos, setDatos] = useState(null);
  const [pagina, setPagina] = useState(1);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get('/proveedores').then(setProveedores).catch(() => setProveedores([]));
  }, []);

  const consulta = useMemo(() => {
    const q = new URLSearchParams();
    for (const [k, v] of Object.entries(filtros)) if (v.trim()) q.set(k, v.trim());
    return q.toString();
  }, [filtros]);

  // Al cambiar un filtro se vuelve a la primera página (con un respiro para el número).
  useEffect(() => {
    const t = setTimeout(() => {
      setCargando(true);
      setError('');
      api
        .get(`/comprobantes?${consulta}&pagina=1`)
        .then((d) => {
          setDatos(d);
          setPagina(1);
        })
        .catch((err) => {
          setDatos(null);
          setError(mensajeDeError(err));
        })
        .finally(() => setCargando(false));
    }, 250);
    return () => clearTimeout(t);
  }, [consulta]);

  async function verMas() {
    setCargando(true);
    try {
      const d = await api.get(`/comprobantes?${consulta}&pagina=${pagina + 1}`);
      setDatos((prev) => ({ ...d, comprobantes: [...prev.comprobantes, ...d.comprobantes] }));
      setPagina(pagina + 1);
    } catch (err) {
      setError(mensajeDeError(err));
    } finally {
      setCargando(false);
    }
  }

  const cambiar = (campo) => (e) => setFiltros((f) => ({ ...f, [campo]: e.target.value }));
  const porEstado = datos?.porEstado ?? {};
  const hayFiltrosExtra = filtros.proveedorId || filtros.desde || filtros.hasta || filtros.numero;

  return (
    <div className="catalogo comprobantes">
      <header className="catalogo__cabecera">
        <h1 className="catalogo__titulo">
          Comprobantes <span>{datos ? datos.total : ''}</span>
        </h1>
        <Link to="/cargar" className="btn btn--primario catalogo__nuevo">
          <IconoMas size={18} /> Cargar
        </Link>
      </header>

      <div className="input productos__buscar">
        <IconoBuscar size={20} color="var(--texto-suave)" />
        <input placeholder="Buscar por número" value={filtros.numero} onChange={cambiar('numero')} aria-label="Buscar por número" />
      </div>

      <div className="chips">
        {CHIPS.filter((c) => !c.soloSiHay || porEstado[c.clave] > 0 || filtros.estado === c.id).map((c) => (
          <button
            key={c.id || 'todos'}
            className={`chip ${filtros.estado === c.id ? 'chip--activo' : ''}`}
            onClick={() => setFiltros((f) => ({ ...f, estado: c.id }))}
          >
            {c.texto} {porEstado[c.clave] ? porEstado[c.clave] : ''}
          </button>
        ))}
      </div>

      <div className="comprobantes__filtros">
        <label className="campo">
          <span>Proveedor</span>
          <div className="input">
            <select value={filtros.proveedorId} onChange={cambiar('proveedorId')} aria-label="Proveedor">
              <option value="">Todos los proveedores</option>
              {proveedores.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.razonSocial}
                  {p.activo ? '' : ' (desactivado)'}
                </option>
              ))}
            </select>
          </div>
        </label>
        <label className="campo">
          <span>Cargados desde</span>
          <div className="input">
            <input type="date" value={filtros.desde} onChange={cambiar('desde')} aria-label="Cargados desde" />
          </div>
        </label>
        <label className="campo">
          <span>Hasta</span>
          <div className="input">
            <input type="date" value={filtros.hasta} onChange={cambiar('hasta')} aria-label="Cargados hasta" />
          </div>
        </label>
      </div>
      {hayFiltrosExtra && (
        <button
          className="comprobantes__limpiar"
          onClick={() => setFiltros((f) => ({ ...f, proveedorId: '', desde: '', hasta: '', numero: '' }))}
        >
          Quitar filtros
        </button>
      )}

      {error && <p className="error-texto comprobantes__error">{error}</p>}

      <div className="card lista">
        {cargando && !datos && <p className="lista__estado">Cargando…</p>}
        {datos?.comprobantes.length === 0 && (
          <p className="lista__estado">
            {filtros.estado || hayFiltrosExtra ? 'No hay comprobantes con estos filtros.' : 'Todavía no se cargó ningún comprobante.'}
          </p>
        )}
        {datos?.comprobantes.map((c) => {
          const estado = ESTADO_COMPROBANTE[c.estado] ?? { texto: c.estado, clase: 'badge--inactivo' };
          return (
            <div
              key={c.id}
              className={`comprobante ${c.estado === 'EN_REVISION' ? 'comprobante--revisar' : ''}`}
              onClick={() => navegar(rutaComprobante(c))}
              role="link"
              tabIndex={0}
              onKeyDown={(e) => e.key === 'Enter' && navegar(rutaComprobante(c))}
            >
              <span className={`comprobante__icono ${c.esPdf ? 'comprobante__icono--pdf' : ''}`} aria-hidden>
                {c.esPdf ? 'PDF' : <IconoComprobantes size={20} />}
              </span>
              <div className="comprobante__datos">
                <strong>{tituloComprobante(c)}</strong>
                <span>
                  {c.proveedor.razonSocial}
                  {c.fechaEmision ? ` · emitido el ${fechaDia(c.fechaEmision)}` : ''}
                </span>
                <span className="comprobante__detalle">
                  Cargado {fechaHora(c.cargadoEn)} por {c.cargadoPor.nombre}
                  {c.estado === 'CONFIRMADO' && c.unidadesIngresadas != null
                    ? ` · ${mostrarNumero(c.unidadesIngresadas)} unidades ingresadas`
                    : c.lineas > 0
                      ? ` · ${c.lineas} ${c.lineas === 1 ? 'línea' : 'líneas'}`
                      : ''}
                </span>
                {c.requiereRevision && c.estado === 'EN_REVISION' && (
                  <span className="comprobante__aviso">Manuscrito o de baja calidad: revisar todas las líneas.</span>
                )}
              </div>
              <div className="comprobante__lado">
                <span className={`badge ${estado.clase}`}>{estado.texto}</span>
                {c.totalDeclarado != null && <span className="comprobante__total">{pesos(c.totalDeclarado)}</span>}
              </div>
              {c.estado === 'EN_REVISION' && (
                <Link
                  to={`/comprobantes/${c.id}/revisar`}
                  className="btn btn--primario comprobante__retomar"
                  onClick={(e) => e.stopPropagation()}
                >
                  Retomar revisión
                </Link>
              )}
            </div>
          );
        })}
      </div>

      {datos?.hayMas && (
        <button className="btn btn--secundario btn--bloque comprobantes__mas" onClick={verMas} disabled={cargando}>
          {cargando ? 'Cargando…' : 'Ver más'}
        </button>
      )}
    </div>
  );
}
