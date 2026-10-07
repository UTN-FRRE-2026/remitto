import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import {
  IconoRemitto,
  IconoTablero,
  IconoComprobantes,
  IconoProductos,
  IconoMovimientos,
  IconoSalidas,
  IconoPrecios,
  IconoAsistente,
  IconoIntegraciones,
  IconoUsuarios,
  IconoSalir,
} from './iconos.jsx';
import './Sidebar.css';

// Secciones principales de la navegación de escritorio (maqueta).
const principales = [
  { to: '/', fin: true, label: 'Tablero', Icono: IconoTablero },
  { to: '/comprobantes', label: 'Comprobantes', Icono: IconoComprobantes },
  { to: '/productos', label: 'Productos', Icono: IconoProductos },
  { to: '/movimientos', label: 'Movimientos', Icono: IconoMovimientos },
  { to: '/salidas', label: 'Salidas', Icono: IconoSalidas },
  { to: '/precios', label: 'Precios y reportes', Icono: IconoPrecios },
  { to: '/asistente', label: 'Asistente', Icono: IconoAsistente },
];

// Sección de configuración, solo visible para el propietario.
const configuracion = [
  { to: '/integraciones', label: 'Integraciones', Icono: IconoIntegraciones },
  { to: '/usuarios', label: 'Usuarios', Icono: IconoUsuarios },
];

function iniciales(nombre = '') {
  return nombre
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0])
    .join('')
    .toUpperCase();
}

export default function Sidebar() {
  const { usuario, esPropietario, cerrarSesion } = useAuth();
  const navegar = useNavigate();

  function salir() {
    cerrarSesion();
    navegar('/login', { replace: true });
  }

  const item = ({ to, fin, label, Icono }) => (
    <NavLink
      key={to}
      to={to}
      end={fin}
      className={({ isActive }) => `sidebar__item ${isActive ? 'sidebar__item--activo' : ''}`}
    >
      <Icono size={20} />
      <span>{label}</span>
    </NavLink>
  );

  return (
    <aside className="sidebar">
      <div className="sidebar__marca">
        <span className="sidebar__logo">
          <IconoRemitto size={22} />
        </span>
        <div>
          <strong>Remitto</strong>
          <span>Almacén Don Carlos</span>
        </div>
      </div>

      <nav className="sidebar__nav">
        {principales.map(item)}

        {esPropietario && (
          <>
            <p className="sidebar__grupo">Configuración</p>
            {configuracion.map(item)}
          </>
        )}
      </nav>

      <div className="sidebar__usuario">
        <span className="sidebar__avatar">{iniciales(usuario?.nombre)}</span>
        <div className="sidebar__datos">
          <strong>{usuario?.nombre}</strong>
          <span>{usuario?.rol === 'PROPIETARIO' ? 'Propietario' : 'Empleado'}</span>
        </div>
        <button className="sidebar__salir" onClick={salir} aria-label="Cerrar sesión">
          <IconoSalir size={20} />
        </button>
      </div>
    </aside>
  );
}
