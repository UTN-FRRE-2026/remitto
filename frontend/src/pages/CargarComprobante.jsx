import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api.js';
import {
  IconoRemitto,
  IconoImagen,
  IconoComprobantes,
  IconoVolver,
  IconoDesplegar,
} from '../components/iconos.jsx';
import './CargarComprobante.css';

// Mismos formatos que valida el backend (HU8). El servidor revisa además
// el contenido real; esto solo evita enviar algo que seguro se rechaza.
const EXTENSIONES = ['jpg', 'jpeg', 'png', 'webp', 'heic', 'heif', 'pdf'];
const PREVISUALIZABLES = ['image/jpeg', 'image/png', 'image/webp'];

function extension(nombre) {
  const partes = nombre.toLowerCase().split('.');
  return partes.length > 1 ? partes.pop() : '';
}

function formatearTamano(bytes) {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1).replace('.', ',')} MB`;
}

// M3 · Cargar remito: elegir proveedor, sacar la foto (o elegir imagen/PDF) y enviar.
export default function CargarComprobante() {
  const navegar = useNavigate();
  const [proveedores, setProveedores] = useState(null);
  const [proveedorId, setProveedorId] = useState('');
  const [archivo, setArchivo] = useState(null);
  const [vistaPrevia, setVistaPrevia] = useState(null);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState('');

  // Bloquea un segundo envío antes de que React vuelva a renderizar.
  const enviandoRef = useRef(false);
  const camaraRef = useRef(null);
  const galeriaRef = useRef(null);
  const pdfRef = useRef(null);

  // HU6: solo proveedores activos.
  useEffect(() => {
    api
      .get('/proveedores?activo=true')
      .then(setProveedores)
      .catch((err) => {
        setProveedores([]);
        setError(err.message);
      });
  }, []);

  useEffect(() => {
    if (!archivo || !PREVISUALIZABLES.includes(archivo.type)) {
      setVistaPrevia(null);
      return undefined;
    }
    const url = URL.createObjectURL(archivo);
    setVistaPrevia(url);
    return () => URL.revokeObjectURL(url);
  }, [archivo]);

  function elegir(e) {
    const elegido = e.target.files?.[0];
    e.target.value = ''; // permite volver a elegir el mismo archivo
    if (!elegido) return;
    if (!EXTENSIONES.includes(extension(elegido.name))) {
      setError('Formato no admitido. Subí una foto JPG, PNG, WEBP o HEIC, o un PDF.');
      return;
    }
    setError('');
    setArchivo(elegido);
  }

  async function enviar() {
    if (enviandoRef.current || !archivo) return;
    if (!proveedorId) {
      setError('Elegí el proveedor del remito.');
      return;
    }
    enviandoRef.current = true;
    setEnviando(true);
    setError('');

    const datos = new FormData();
    datos.append('proveedorId', proveedorId);
    datos.append('archivo', archivo);
    try {
      const comprobante = await api.upload('/comprobantes', datos);
      // HU9: la pantalla M4 inicia la lectura con IA de este comprobante.
      navegar(`/comprobantes/${comprobante.id}/lectura`, { state: { iniciar: true } });
    } catch (err) {
      setError(err.message);
    } finally {
      enviandoRef.current = false;
      setEnviando(false);
    }
  }

  const sinProveedores = proveedores !== null && proveedores.length === 0;

  return (
    <div className="cargar">
      <header className="cargar__barra">
        <button className="cargar__circulo" onClick={() => navegar(-1)} aria-label="Volver">
          <IconoVolver size={20} />
        </button>
        <label className="cargar__proveedor">
          <span className="cargar__oculto">Proveedor</span>
          <select
            value={proveedorId}
            onChange={(e) => {
              setProveedorId(e.target.value);
              setError('');
            }}
            disabled={enviando || !proveedores?.length}
          >
            <option value="">{proveedores === null ? 'Cargando…' : 'Elegí el proveedor'}</option>
            {proveedores?.map((p) => (
              <option key={p.id} value={p.id}>
                {p.razonSocial}
              </option>
            ))}
          </select>
          <IconoDesplegar size={16} />
        </label>
        <span className="cargar__circulo cargar__circulo--vacio" aria-hidden />
      </header>

      <>
          <div className="cargar__marco">
            <span className="cargar__esquina cargar__esquina--si" />
            <span className="cargar__esquina cargar__esquina--sd" />
            <span className="cargar__esquina cargar__esquina--ii" />
            <span className="cargar__esquina cargar__esquina--id" />
            {vistaPrevia ? (
              <img className="cargar__previa" src={vistaPrevia} alt="Vista previa del comprobante" />
            ) : (
              <div className="cargar__vacio">
                {archivo ? <IconoComprobantes width={44} height={44} /> : <IconoRemitto size={40} />}
                {archivo && <span>{extension(archivo.name).toUpperCase()}</span>}
              </div>
            )}
          </div>

          <p className="cargar__ayuda">{archivo ? archivo.name : 'Encuadrá el remito completo'}</p>
          <p className="cargar__subayuda">
            {archivo
              ? formatearTamano(archivo.size)
              : 'Con buena luz y sin sombras sobre el papel'}
          </p>

          {error && (
            <p className="cargar__error" role="alert">
              {error}
            </p>
          )}
          {sinProveedores && !error && (
            <p className="cargar__error" role="alert">
              No hay proveedores activos. Pedile al propietario que dé de alta uno.
            </p>
          )}

          {archivo ? (
            <div className="cargar__acciones">
              <button
                className="btn btn--primario btn--bloque"
                onClick={enviar}
                disabled={enviando || !proveedorId}
              >
                {enviando ? (
                  <>
                    <span className="spinner" /> Enviando…
                  </>
                ) : (
                  'Enviar remito'
                )}
              </button>
              {!proveedorId && <p className="cargar__nota">Elegí el proveedor arriba para enviar.</p>}
              <button className="cargar__cambiar" onClick={() => setArchivo(null)} disabled={enviando}>
                Elegir otro archivo
              </button>
            </div>
          ) : (
            <div className="cargar__controles">
              <button className="cargar__opcion" onClick={() => galeriaRef.current?.click()}>
                <span className="cargar__opcion-icono">
                  <IconoImagen size={22} />
                </span>
                Galería
              </button>
              <button
                className="cargar__disparador"
                onClick={() => camaraRef.current?.click()}
                aria-label="Sacar foto"
              >
                <span />
              </button>
              <button className="cargar__opcion" onClick={() => pdfRef.current?.click()}>
                <span className="cargar__opcion-icono">
                  <IconoComprobantes width={22} height={22} />
                </span>
                PDF
              </button>
            </div>
          )}

          {/* capture="environment" abre la cámara trasera en el celular; en
              escritorio el navegador lo ignora y muestra el selector de archivos. */}
          <input ref={camaraRef} type="file" accept="image/*" capture="environment" hidden onChange={elegir} />
          <input ref={galeriaRef} type="file" accept="image/*" hidden onChange={elegir} />
          <input ref={pdfRef} type="file" accept="application/pdf,.pdf" hidden onChange={elegir} />
      </>
    </div>
  );
}
