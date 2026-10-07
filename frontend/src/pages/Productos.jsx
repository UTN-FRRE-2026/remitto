import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api } from '../lib/api.js';
import { IconoRemitto, IconoBuscar, IconoCodigo, IconoMas } from '../components/iconos.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import EstadoBadge from '../components/EstadoBadge.jsx';
import './Productos.css';

const UNIDAD_CORTA = {
  UNIDAD: 'u.',
  KILOGRAMO: 'kg',
  GRAMO: 'g',
  LITRO: 'l',
  MILILITRO: 'ml',
  METRO: 'm',
  PAQUETE: 'paq.',
};

export default function Productos() {
  const { esPropietario } = useAuth();
  const [searchParams] = useSearchParams();
  const [filtro, setFiltro] = useState(searchParams.get('estado') || 'TODOS');
  const [busqueda, setBusqueda] = useState('');
  const [productos, setProductos] = useState([]);
  const [resumen, setResumen] = useState(null);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    api.get('/productos/resumen').then(setResumen).catch(() => {});
  }, []);

  // Recarga al cambiar el filtro (debounce simple para la búsqueda).
  useEffect(() => {
    const t = setTimeout(() => {
      setCargando(true);
      const params = new URLSearchParams();
      if (filtro !== 'TODOS') params.set('estado', filtro);
      if (busqueda.trim()) params.set('q', busqueda.trim());
      api
        .get(`/productos?${params.toString()}`)
        .then(setProductos)
        .catch(() => setProductos([]))
        .finally(() => setCargando(false));
    }, 250);
    return () => clearTimeout(t);
  }, [filtro, busqueda]);

  const chips = useMemo(
    () => [
      { id: 'TODOS', texto: 'Todos' },
      { id: 'STOCK_BAJO', texto: `Stock bajo ${resumen?.stockBajo ?? ''}`.trim() },
      { id: 'SIN_STOCK', texto: `Sin stock ${resumen?.sinStock ?? ''}`.trim() },
    ],
    [resumen],
  );

  return (
    <div className="productos">
      <header className="topbar">
        <div className="topbar__marca">
          <span className="topbar__logo">
            <IconoRemitto size={20} />
          </span>
          <div>
            <strong>Remitto</strong>
            <span className="topbar__sub">Almacén Don Carlos</span>
          </div>
        </div>
        {esPropietario && (
          <button className="topbar__accion" aria-label="Nuevo producto">
            <IconoMas size={20} />
          </button>
        )}
      </header>

      <h1 className="productos__titulo">
        Productos <span>{resumen?.totalProductos ?? ''}</span>
      </h1>

      <div className="input productos__buscar">
        <IconoBuscar size={20} color="var(--texto-suave)" />
        <input
          placeholder="Buscar por nombre o código"
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
        />
        <IconoCodigo size={20} color="var(--texto-suave)" />
      </div>

      <div className="chips">
        {chips.map((c) => (
          <button
            key={c.id}
            className={`chip ${filtro === c.id ? 'chip--activo' : ''}`}
            onClick={() => setFiltro(c.id)}
          >
            {c.texto}
          </button>
        ))}
      </div>

      <div className="card lista">
        {cargando && <p className="lista__estado">Cargando…</p>}
        {!cargando && productos.length === 0 && (
          <p className="lista__estado">No se encontraron productos.</p>
        )}
        {!cargando &&
          productos.map((p) => (
            <div key={p.id} className="producto">
              <span className="producto__icono" aria-hidden />
              <div className="producto__datos">
                <strong>{p.nombre}</strong>
                <span>{p.categoria?.nombre ?? 'Sin categoría'}</span>
              </div>
              <div className="producto__stock">
                <span
                  className={`producto__cant ${p.estadoStock === 'SIN_STOCK' ? 'producto__cant--cero' : ''}`}
                >
                  {p.stockActual}
                  <small>{UNIDAD_CORTA[p.unidadMedida] ?? 'u.'}</small>
                </span>
                <EstadoBadge estado={p.estadoStock} />
              </div>
            </div>
          ))}
      </div>
    </div>
  );
}
