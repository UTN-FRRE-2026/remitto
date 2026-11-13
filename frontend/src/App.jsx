import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext.jsx';
import AppShell from './components/AppShell.jsx';
import Login from './pages/Login.jsx';
import Inicio from './pages/Inicio.jsx';
import Productos from './pages/Productos.jsx';
import Cuenta from './pages/Cuenta.jsx';
import CargarComprobante from './pages/CargarComprobante.jsx';
import LecturaComprobante from './pages/LecturaComprobante.jsx';
import RevisarComprobante from './pages/RevisarComprobante.jsx';
import Movimientos from './pages/Movimientos.jsx';
import Salidas from './pages/Salidas.jsx';
import Recuento from './pages/Recuento.jsx';
import ProductoForm from './pages/ProductoForm.jsx';
import Proveedores from './pages/Proveedores.jsx';
import Categorias from './pages/Categorias.jsx';
import Usuarios from './pages/Usuarios.jsx';
import UsuarioForm from './pages/UsuarioForm.jsx';
import ProveedorForm from './pages/ProveedorForm.jsx';
import EnConstruccion from './pages/EnConstruccion.jsx';

// Protege las rutas privadas: sin sesión redirige al login.
function Privado({ children }) {
  const { usuario, cargando } = useAuth();
  if (cargando) return <div className="cargando-pantalla">Cargando…</div>;
  if (!usuario) return <Navigate to="/login" replace />;
  return <AppShell>{children}</AppShell>;
}

// Pantallas de administración (HU2): el empleado vuelve al inicio. El backend
// rechaza igualmente sus pedidos; esto solo evita mostrarle formularios inútiles.
function Propietario({ children }) {
  const { esPropietario } = useAuth();
  return <Privado>{esPropietario ? children : <Navigate to="/" replace />}</Privado>;
}

function Publico({ children }) {
  const { usuario, cargando } = useAuth();
  if (cargando) return <div className="cargando-pantalla">Cargando…</div>;
  if (usuario) return <Navigate to="/" replace />;
  return children;
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route
            path="/login"
            element={
              <Publico>
                <Login />
              </Publico>
            }
          />
          <Route path="/" element={<Privado><Inicio /></Privado>} />
          <Route path="/productos" element={<Privado><Productos /></Privado>} />
          <Route path="/productos/nuevo" element={<Propietario><ProductoForm key="nuevo" /></Propietario>} />
          <Route path="/productos/:id/editar" element={<Propietario><ProductoForm /></Propietario>} />
          <Route path="/categorias" element={<Propietario><Categorias /></Propietario>} />
          <Route path="/proveedores" element={<Propietario><Proveedores /></Propietario>} />
          <Route path="/proveedores/nuevo" element={<Propietario><ProveedorForm key="nuevo" /></Propietario>} />
          <Route path="/proveedores/:id/editar" element={<Propietario><ProveedorForm /></Propietario>} />
          <Route path="/cuenta" element={<Privado><Cuenta /></Privado>} />
          <Route path="/cargar" element={<Privado><CargarComprobante /></Privado>} />
          <Route path="/comprobantes/:id/lectura" element={<Privado><LecturaComprobante /></Privado>} />
          <Route path="/comprobantes/:id/revisar" element={<Privado><RevisarComprobante /></Privado>} />
          <Route path="/salidas" element={<Privado><Salidas /></Privado>} />
          <Route path="/recuento" element={<Privado><Recuento /></Privado>} />
          <Route
            path="/asistente"
            element={
              <Privado>
                <EnConstruccion
                  titulo="Asistente"
                  descripcion="Preguntale a tu stock en lenguaje natural."
                  hu="HU25 (Sprint 2)"
                />
              </Privado>
            }
          />
          <Route
            path="/comprobantes"
            element={
              <Privado>
                <EnConstruccion
                  titulo="Comprobantes"
                  descripcion="Listado de remitos cargados, con su archivo original y las líneas confirmadas."
                  hu="HU18 (Sprint 2)"
                />
              </Privado>
            }
          />
          <Route path="/movimientos" element={<Privado><Movimientos /></Privado>} />
          <Route
            path="/precios"
            element={
              <Privado>
                <EnConstruccion
                  titulo="Precios y reportes"
                  descripcion="Evolución de precios de compra, valorización y productos sin movimiento."
                  hu="HU20, HU28, HU29 (Sprint 2)"
                />
              </Privado>
            }
          />
          <Route
            path="/integraciones"
            element={
              <Privado>
                <EnConstruccion
                  titulo="Integración con punto de venta"
                  descripcion="Claves de acceso para que la caja de tu comercio descuente el stock sola."
                  hu="HU21, HU22 (Sprint 2)"
                />
              </Privado>
            }
          />
          <Route path="/usuarios" element={<Propietario><Usuarios /></Propietario>} />
          <Route path="/usuarios/nuevo" element={<Propietario><UsuarioForm key="nuevo" /></Propietario>} />
          <Route path="/usuarios/:id/editar" element={<Propietario><UsuarioForm /></Propietario>} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
