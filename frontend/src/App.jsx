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
import EnConstruccion from './pages/EnConstruccion.jsx';

// Protege las rutas privadas: sin sesión redirige al login.
function Privado({ children }) {
  const { usuario, cargando } = useAuth();
  if (cargando) return <div className="cargando-pantalla">Cargando…</div>;
  if (!usuario) return <Navigate to="/login" replace />;
  return <AppShell>{children}</AppShell>;
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
          <Route path="/cuenta" element={<Privado><Cuenta /></Privado>} />
          <Route path="/cargar" element={<Privado><CargarComprobante /></Privado>} />
          <Route path="/comprobantes/:id/lectura" element={<Privado><LecturaComprobante /></Privado>} />
          <Route path="/comprobantes/:id/revisar" element={<Privado><RevisarComprobante /></Privado>} />
          <Route path="/salidas" element={<Privado><Salidas /></Privado>} />
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
          <Route
            path="/usuarios"
            element={
              <Privado>
                <EnConstruccion
                  titulo="Usuarios"
                  descripcion="Alta, modificación y desactivación de quienes operan el sistema."
                  hu="HU3 (Sprint 1)"
                />
              </Privado>
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
