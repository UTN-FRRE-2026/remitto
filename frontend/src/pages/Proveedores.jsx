import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { api, mensajeDeError } from '../lib/api.js';
import { IconoBuscar, IconoMas, IconoEditar } from '../components/iconos.jsx';
import './Productos.css';
import './Catalogo.css';
import { formatearCuit } from '../lib/cuit.js';

const FILTROS = [
  { id: 'true', texto: 'Activos' },
  { id: 'false', texto: 'Desactivados' },
  { id: '', texto: 'Todos' },
];

// HU6 · Listado de proveedores (solo propietario).
export default function Proveedores() {
  const aviso = useLocation().state?.aviso;
  const [filtro, setFiltro] = useState('true');
  const [busqueda, setBusqueda] = useState('');
  const [proveedores, setProveedores] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const t = setTimeout(() => {
      setCargando(true);
      setError('');
      const params = new URLSearchParams();
      if (filtro) params.set('activo', filtro);
      if (busqueda.trim()) params.set('q', busqueda.trim());
      api
        .get(`/proveedores?${params.toString()}`)
        .then(setProveedores)
        .catch((err) => {
          setProveedores([]);
          setError(mensajeDeError(err));
        })
        .finally(() => setCargando(false));
    }, 250);
    return () => clearTimeout(t);
  }, [filtro, busqueda]);

  return (
    <div className="catalogo">
      <header className="catalogo__cabecera">
        <h1 className="catalogo__titulo">
          Proveedores <span>{cargando ? '' : proveedores.length}</span>
        </h1>
        <Link to="/proveedores/nuevo" className="btn btn--primario catalogo__nuevo">
          <IconoMas size={18} /> Nuevo
        </Link>
      </header>

      {aviso && <p className="catalogo__aviso">{aviso}</p>}

      <div className="input productos__buscar">
        <IconoBuscar size={20} color="var(--texto-suave)" />
        <input
          placeholder="Buscar por razón social, CUIT o contacto"
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
        />
      </div>

      <div className="chips">
        {FILTROS.map((f) => (
          <button key={f.id} className={`chip ${filtro === f.id ? 'chip--activo' : ''}`} onClick={() => setFiltro(f.id)}>
            {f.texto}
          </button>
        ))}
      </div>

      <div className="card lista">
        {cargando && <p className="lista__estado">Cargando…</p>}
        {!cargando && error && <p className="lista__estado error-texto">{error}</p>}
        {!cargando && !error && proveedores.length === 0 && (
          <p className="lista__estado">No se encontraron proveedores.</p>
        )}
        {!cargando &&
          proveedores.map((p) => (
            <Link key={p.id} to={`/proveedores/${p.id}/editar`} className="proveedor">
              <div className="proveedor__datos">
                <strong>{p.razonSocial}</strong>
                <span>{p.cuit ? `CUIT ${formatearCuit(p.cuit)}` : 'Sin CUIT'}</span>
                {(p.contacto || p.telefono) && (
                  <span>{[p.contacto, p.telefono].filter(Boolean).join(' · ')}</span>
                )}
              </div>
              {!p.activo && <span className="badge badge--inactivo">Desactivado</span>}
              <span className="producto__editar" aria-hidden>
                <IconoEditar size={18} />
              </span>
            </Link>
          ))}
      </div>
    </div>
  );
}
