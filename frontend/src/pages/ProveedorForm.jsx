import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api, mensajeDeError } from '../lib/api.js';
import { IconoVolver } from '../components/iconos.jsx';
import { formatearCuit } from '../lib/cuit.js';
import './Catalogo.css';

const VACIO = { razonSocial: '', cuit: '', telefono: '', email: '', contacto: '', direccion: '' };

const CAMPOS_OPCIONALES = [
  { campo: 'contacto', etiqueta: 'Persona de contacto', tipo: 'text' },
  { campo: 'telefono', etiqueta: 'Teléfono', tipo: 'tel' },
  { campo: 'email', etiqueta: 'Correo electrónico', tipo: 'email' },
  { campo: 'direccion', etiqueta: 'Dirección', tipo: 'text' },
];

// Mismo criterio que el backend: 11 dígitos, con o sin guiones.
const cuitValido = (texto) => texto.trim() === '' || /^\d{2}-?\d{8}-?\d$/.test(texto.trim());

// HU6 · Alta y modificación de un proveedor (solo propietario).
export default function ProveedorForm() {
  const { id } = useParams();
  const editando = Boolean(id);
  const navegar = useNavigate();
  const [form, setForm] = useState(VACIO);
  const [proveedor, setProveedor] = useState(null);
  const [cargando, setCargando] = useState(editando);
  const [errorCarga, setErrorCarga] = useState('');
  const [error, setError] = useState('');
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    if (!editando) return;
    api
      .get(`/proveedores/${id}`)
      .then((p) => {
        setProveedor(p);
        setForm({
          razonSocial: p.razonSocial,
          cuit: formatearCuit(p.cuit),
          telefono: p.telefono ?? '',
          email: p.email ?? '',
          contacto: p.contacto ?? '',
          direccion: p.direccion ?? '',
        });
      })
      .catch((err) => setErrorCarga(mensajeDeError(err)))
      .finally(() => setCargando(false));
  }, [editando, id]);

  const cambiar = (campo) => (e) => setForm((f) => ({ ...f, [campo]: e.target.value }));
  const errorCuit = cuitValido(form.cuit) ? '' : 'El CUIT debe tener 11 dígitos, por ejemplo 30-71234567-1.';
  const valido = form.razonSocial.trim() && !errorCuit;

  async function guardar(e) {
    e.preventDefault();
    if (!valido || enviando) return;
    setEnviando(true);
    setError('');
    // Vacío se envía como null: en una modificación borra el dato.
    const datos = Object.fromEntries(Object.entries(form).map(([k, v]) => [k, v.trim() || null]));
    try {
      if (editando) {
        await api.patch(`/proveedores/${id}`, datos);
        navegar('/proveedores', { state: { aviso: `Se guardaron los cambios de «${datos.razonSocial}».` } });
      } else {
        await api.post('/proveedores', datos);
        navegar('/proveedores', { state: { aviso: `Se agregó «${datos.razonSocial}».` } });
      }
    } catch (err) {
      setError(mensajeDeError(err));
      setEnviando(false);
    }
  }

  async function cambiarActivo(activo) {
    if (
      !activo &&
      !window.confirm(
        `¿Desactivar «${proveedor.razonSocial}»? No se borra: conserva sus comprobantes, pero deja de aparecer al cargar un comprobante.`,
      )
    ) {
      return;
    }
    setEnviando(true);
    setError('');
    try {
      const actualizado = activo
        ? await api.patch(`/proveedores/${id}`, { activo: true })
        : await api.del(`/proveedores/${id}`);
      setProveedor(actualizado);
    } catch (err) {
      setError(mensajeDeError(err));
    } finally {
      setEnviando(false);
    }
  }

  if (cargando) return <p className="catalogo__estado">Cargando…</p>;
  if (errorCarga) {
    return (
      <div>
        <p className="error-texto">{errorCarga}</p>
        <Link to="/proveedores" className="btn btn--secundario" style={{ marginTop: 16 }}>
          Volver a proveedores
        </Link>
      </div>
    );
  }

  return (
    <div className="catalogo">
      <header className="catalogo__cabecera">
        <button type="button" className="catalogo__volver" onClick={() => navegar('/proveedores')} aria-label="Volver">
          <IconoVolver size={20} />
        </button>
        <h1 className="catalogo__titulo">{editando ? 'Editar proveedor' : 'Nuevo proveedor'}</h1>
        {proveedor && !proveedor.activo && <span className="badge badge--inactivo">Desactivado</span>}
      </header>

      <form className="card formulario" onSubmit={guardar} noValidate>
        <div className="campo">
          <label htmlFor="razonSocial">Razón social</label>
          <div className="input">
            <input
              id="razonSocial"
              value={form.razonSocial}
              onChange={cambiar('razonSocial')}
              maxLength={255}
              required
              autoFocus={!editando}
            />
          </div>
        </div>

        <div className="campo">
          <label htmlFor="cuit">CUIT (opcional)</label>
          <div className="input">
            <input id="cuit" value={form.cuit} onChange={cambiar('cuit')} inputMode="numeric" placeholder="30-71234567-1" maxLength={13} />
          </div>
          {errorCuit ? (
            <span className="formulario__error-campo">{errorCuit}</span>
          ) : (
            <span className="formulario__ayuda">No puede repetirse entre proveedores.</span>
          )}
        </div>

        {CAMPOS_OPCIONALES.map(({ campo, etiqueta, tipo }) => (
          <div className="campo" key={campo}>
            <label htmlFor={campo}>{etiqueta} (opcional)</label>
            <div className="input">
              <input id={campo} type={tipo} value={form[campo]} onChange={cambiar(campo)} maxLength={255} />
            </div>
          </div>
        ))}

        {editando && (
          <div className="formulario__dato">
            <span>Comprobantes cargados de este proveedor</span>
            <Link to={`/comprobantes?proveedorId=${proveedor.id}`}>Ver comprobantes</Link>
          </div>
        )}

        {error && <p className="error-texto">{error}</p>}

        <div className="formulario__acciones">
          <button type="submit" className="btn btn--primario" disabled={!valido || enviando}>
            {enviando ? 'Guardando…' : editando ? 'Guardar cambios' : 'Agregar proveedor'}
          </button>
          <button type="button" className="btn btn--secundario" onClick={() => navegar('/proveedores')}>
            Cancelar
          </button>
        </div>
      </form>

      {editando && (
        <div className="card catalogo__estado-registro">
          {proveedor.activo ? (
            <>
              <p>Un proveedor no se elimina: se desactiva. Conserva sus comprobantes, pero deja de aparecer al cargar uno nuevo.</p>
              <button type="button" className="btn btn--peligro" onClick={() => cambiarActivo(false)} disabled={enviando}>
                Desactivar proveedor
              </button>
            </>
          ) : (
            <>
              <p>Este proveedor está desactivado y no aparece al cargar un comprobante.</p>
              <button type="button" className="btn btn--secundario" onClick={() => cambiarActivo(true)} disabled={enviando}>
                Reactivar proveedor
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
