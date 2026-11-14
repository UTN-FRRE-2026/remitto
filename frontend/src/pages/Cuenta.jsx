import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { IconoSalir, IconoProveedores, IconoCategorias, IconoUsuarios, IconoPrecios } from '../components/iconos.jsx';
import './Cuenta.css';

function iniciales(nombre = '') {
  return nombre
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0])
    .join('')
    .toUpperCase();
}

export default function Cuenta() {
  const { usuario, esPropietario, cerrarSesion } = useAuth();
  const navegar = useNavigate();

  function salir() {
    cerrarSesion();
    navegar('/login', { replace: true });
  }

  return (
    <div className="cuenta">
      <h1 className="cuenta__titulo">Cuenta</h1>

      <div className="card cuenta__tarjeta">
        <span className="cuenta__avatar">{iniciales(usuario?.nombre)}</span>
        <div>
          <strong>{usuario?.nombre}</strong>
          <span className="cuenta__email">{usuario?.email}</span>
          <span className="cuenta__rol">
            {usuario?.rol === 'PROPIETARIO' ? 'Propietario' : 'Empleado'}
          </span>
        </div>
      </div>

      {/* En el celular no hay menú lateral: la administración se abre desde acá. */}
      {esPropietario && (
        <nav className="card cuenta__admin" aria-label="Administración">
          <p className="cuenta__admin-titulo">Administración</p>
          <Link to="/proveedores" className="cuenta__admin-item">
            <IconoProveedores size={20} />
            Proveedores
          </Link>
          <Link to="/categorias" className="cuenta__admin-item">
            <IconoCategorias size={20} />
            Categorías
          </Link>
          <Link to="/usuarios" className="cuenta__admin-item">
            <IconoUsuarios size={20} />
            Usuarios
          </Link>
          <Link to="/precios" className="cuenta__admin-item">
            <IconoPrecios size={20} />
            Precios y reportes
          </Link>
        </nav>
      )}

      <button className="btn btn--peligro btn--bloque cuenta__salir" onClick={salir}>
        <IconoSalir size={20} />
        Cerrar sesión
      </button>
    </div>
  );
}
