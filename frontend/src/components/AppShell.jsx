import { NavLink, useNavigate } from 'react-router-dom';
import Sidebar from './Sidebar.jsx';
import {
  IconoInicio,
  IconoProductos,
  IconoCamara,
  IconoSalidas,
  IconoAsistente,
} from './iconos.jsx';
import './AppShell.css';

// Ítems de la barra inferior (móvil). "Cargar" es el botón central elevado.
const items = [
  { to: '/', fin: true, label: 'Inicio', Icono: IconoInicio },
  { to: '/productos', label: 'Productos', Icono: IconoProductos },
  { to: '/cargar', label: 'Cargar', Icono: IconoCamara, central: true },
  { to: '/salidas', label: 'Salidas', Icono: IconoSalidas },
  { to: '/asistente', label: 'Asistente', Icono: IconoAsistente },
];

export default function AppShell({ children }) {
  const navegar = useNavigate();

  return (
    <div className="shell">
      {/* Menú lateral (solo escritorio) */}
      <Sidebar />

      <main className="shell__contenido">
        <div className="shell__interior">{children}</div>
      </main>

      {/* Barra inferior (solo móvil) */}
      <nav className="navbar" aria-label="Navegación principal">
        {items.map(({ to, fin, label, Icono, central }) =>
          central ? (
            <button key={to} className="navbar__central" onClick={() => navegar(to)} aria-label={label}>
              <span className="navbar__fab">
                <Icono size={24} />
              </span>
              <span className="navbar__label">{label}</span>
            </button>
          ) : (
            <NavLink
              key={to}
              to={to}
              end={fin}
              className={({ isActive }) => `navbar__item ${isActive ? 'navbar__item--activo' : ''}`}
            >
              <Icono size={22} />
              <span className="navbar__label">{label}</span>
            </NavLink>
          ),
        )}
      </nav>
    </div>
  );
}
