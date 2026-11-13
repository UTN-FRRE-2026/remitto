import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useSearchParams } from 'react-router-dom';
import { api } from '../lib/api.js';
import { IconoRemitto, IconoBuscar, IconoCodigo, IconoMas, IconoRecuento, IconoEditar } from '../components/iconos.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import EstadoBadge from '../components/EstadoBadge.jsx';
import { unidadCorta } from '../lib/unidades.js';
import './Productos.css';
import './Catalogo.css';

export default function Productos() {
  const { esPropietario } = useAuth();
  const [searchParams] = useSearchParams();
  const [filtro, setFiltro] = useState(searchParams.get('estado') || 'TODOS');
  const [busqueda, setBusqueda] = useState('');
  const [productos, setProductos] = useState([]);
  const [resumen, setResumen] = useState(null);
  const [cargando, setCargando] = useState(true);
  // Aviso que deja el formulario al guardar (HU4).
  const aviso = useLocation().state?.aviso;

  useEffect(() => {
    api.get('/productos/resumen').then(setResumen).catch(() => {});
  }, []);

  // Recarga al cambiar el filtro (debounce simple para la búsqueda).
  useEffect(() => {
    const t = setTimeout(() => {
      setCargando(true);
      const params = new URLSearchParams();
      // HU4: los desactivados no aparecen en las búsquedas; el propietario los
      // ve aparte para poder reactivarlos.
      const inactivos = filtro === 'INACTIVOS';
      if (inactivos) params.set('incluirInactivos', 'true');
      else if (filtro !== 'TODOS') params.set('estado', filtro);
      if (busqueda.trim()) params.set('q', busqueda.trim());
      api
        .get(`/productos?${params.toString()}`)
        .then((lista) => setProductos(inactivos ? lista.filter((p) => !p.activo) : lista))
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
      ...(esPropietario ? [{ id: 'INACTIVOS', texto: 'Desactivados' }] : []),
    ],
    [resumen, esPropietario],
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
          <Link to="/productos/nuevo" className="topbar__accion" aria-label="Nuevo producto">
            <IconoMas size={20} />
          </Link>
        )}
      </header>

      <div className="productos__encabezado">
        <h1 className="productos__titulo">
          Productos <span>{resumen?.totalProductos ?? ''}</span>
        </h1>
        <div className="productos__acciones">
          {/* HU14: en el celular el recuento se abre desde acá (la barra inferior está completa). */}
          <Link to="/recuento" className="btn btn--secundario productos__recuento">
            <IconoRecuento size={18} /> Recuento
          </Link>
          {/* HU4: en escritorio la barra superior no se muestra. */}
          {esPropietario && (
            <Link to="/productos/nuevo" className="btn btn--primario productos__recuento productos__nuevo">
              <IconoMas size={18} /> Nuevo producto
            </Link>
          )}
        </div>
      </div>

      {aviso && <p className="catalogo__aviso">{aviso}</p>}

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
              {/* HU12: cada producto abre su historial de movimientos. */}
              <Link to={`/movimientos?productoId=${p.id}`} className="producto__enlace">
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
                    <small>{unidadCorta(p.unidadMedida)}</small>
                  </span>
                  {p.activo ? (
                    <EstadoBadge estado={p.estadoStock} />
                  ) : (
                    <span className="badge badge--inactivo">Desactivado</span>
                  )}
                </div>
              </Link>
              {/* HU4: el propietario edita o desactiva el producto. */}
              {esPropietario && (
                <Link to={`/productos/${p.id}/editar`} className="producto__editar" aria-label={`Editar ${p.nombre}`}>
                  <IconoEditar size={18} />
                </Link>
              )}
            </div>
          ))}
      </div>
    </div>
  );
}
