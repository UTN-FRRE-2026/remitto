import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { api, mensajeDeError } from '../lib/api.js';
import { useAuth } from '../context/AuthContext.jsx';
import { IconoMas, IconoEditar } from '../components/iconos.jsx';
import './Productos.css';
import './Catalogo.css';
import { ROLES } from '../lib/roles.js';

// HU3 · Usuarios (solo propietario): quién opera el sistema y con qué rol.
export default function Usuarios() {
  const { usuario: yo } = useAuth();
  const aviso = useLocation().state?.aviso;
  const [usuarios, setUsuarios] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api
      .get('/usuarios')
      .then(setUsuarios)
      .catch((err) => {
        setUsuarios([]);
        setError(mensajeDeError(err));
      });
  }, []);

  // Activos primero; el backend ya los ordena por nombre.
  const lista = usuarios ? [...usuarios].sort((a, b) => Number(b.activo) - Number(a.activo)) : [];

  return (
    <div className="catalogo">
      <header className="catalogo__cabecera">
        <h1 className="catalogo__titulo">
          Usuarios <span>{usuarios?.length ?? ''}</span>
        </h1>
        <Link to="/usuarios/nuevo" className="btn btn--primario catalogo__nuevo">
          <IconoMas size={18} /> Nuevo
        </Link>
      </header>

      {aviso && <p className="catalogo__aviso">{aviso}</p>}

      <div className="card lista">
        {usuarios === null && <p className="lista__estado">Cargando…</p>}
        {error && <p className="lista__estado error-texto">{error}</p>}
        {lista.map((u) => (
          <Link key={u.id} to={`/usuarios/${u.id}/editar`} className="proveedor">
            <div className="proveedor__datos">
              <strong>
                {u.nombre}
                {u.id === yo?.id && <span className="usuario__vos"> (vos)</span>}
              </strong>
              <span>{u.email}</span>
            </div>
            {u.activo ? (
              <span className={`badge ${u.rol === 'PROPIETARIO' ? 'badge--en-stock' : 'badge--ia'}`}>{ROLES[u.rol]}</span>
            ) : (
              <span className="badge badge--inactivo">Desactivado</span>
            )}
            <span className="producto__editar" aria-hidden>
              <IconoEditar size={18} />
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
