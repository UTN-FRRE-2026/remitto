import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api, mensajeDeError } from '../lib/api.js';
import { leerNumero, mostrarNumero } from '../lib/numeros.js';
import { UNIDADES, unidadCorta } from '../lib/unidades.js';
import { IconoVolver } from '../components/iconos.jsx';
import './Catalogo.css';

const VACIO = {
  nombre: '',
  codigoBarras: '',
  categoriaId: '',
  unidadMedida: 'UNIDAD',
  stockMinimo: '',
  stockDeseado: '',
  descripcion: '',
};

const aTexto = (n) => (n === null || n === undefined ? '' : mostrarNumero(n));

// Valida un número del formulario. Devuelve { valor } o { error }.
function numero(texto, { obligatorio }) {
  const n = leerNumero(texto);
  if (n === null) return obligatorio ? { valor: 0 } : { valor: null };
  if (Number.isNaN(n)) return { error: 'Número no válido. Usá coma para los decimales, por ejemplo 1,5.' };
  return { valor: n };
}

// HU4 · Alta y modificación de un producto (solo propietario). El stock actual
// no se edita acá: cambia únicamente con entradas, salidas y recuentos.
export default function ProductoForm() {
  const { id } = useParams();
  const editando = Boolean(id);
  const navegar = useNavigate();
  const [form, setForm] = useState(VACIO);
  const [producto, setProducto] = useState(null);
  const [categorias, setCategorias] = useState([]);
  const [cargando, setCargando] = useState(editando);
  const [errorCarga, setErrorCarga] = useState('');
  const [error, setError] = useState('');
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    api.get('/categorias').then(setCategorias).catch(() => setCategorias([]));
  }, []);

  useEffect(() => {
    if (!editando) return;
    api
      .get(`/productos/${id}`)
      .then((p) => {
        setProducto(p);
        setForm({
          nombre: p.nombre,
          codigoBarras: p.codigoBarras ?? '',
          categoriaId: p.categoriaId ? String(p.categoriaId) : '',
          unidadMedida: p.unidadMedida,
          stockMinimo: aTexto(p.stockMinimo),
          stockDeseado: aTexto(p.stockDeseado),
          descripcion: p.descripcion ?? '',
        });
      })
      .catch((err) => setErrorCarga(mensajeDeError(err)))
      .finally(() => setCargando(false));
  }, [editando, id]);

  const cambiar = (campo) => (e) => setForm((f) => ({ ...f, [campo]: e.target.value }));

  const minimo = numero(form.stockMinimo, { obligatorio: true });
  const deseado = numero(form.stockDeseado, { obligatorio: false });
  const valido = form.nombre.trim() && !minimo.error && !deseado.error;

  async function guardar(e) {
    e.preventDefault();
    if (!valido || enviando) return;
    setEnviando(true);
    setError('');
    const datos = {
      nombre: form.nombre.trim(),
      codigoBarras: form.codigoBarras.trim() || null,
      categoriaId: form.categoriaId ? Number(form.categoriaId) : null,
      unidadMedida: form.unidadMedida,
      stockMinimo: minimo.valor,
      stockDeseado: deseado.valor,
      descripcion: form.descripcion.trim() || null,
    };
    try {
      if (editando) {
        await api.patch(`/productos/${id}`, datos);
        navegar('/productos', { state: { aviso: `Se guardaron los cambios de «${datos.nombre}».` } });
      } else {
        await api.post('/productos', datos);
        navegar('/productos', { state: { aviso: `Se agregó «${datos.nombre}» al catálogo.` } });
      }
    } catch (err) {
      setError(mensajeDeError(err));
      setEnviando(false);
    }
  }

  async function cambiarActivo(activo) {
    if (!activo) {
      const conStock = producto.stockActual !== 0
        ? ` Todavía tiene ${mostrarNumero(producto.stockActual)} ${unidadCorta(producto.unidadMedida)} en stock.`
        : '';
      const ok = window.confirm(
        `¿Desactivar «${producto.nombre}»?${conStock} No se borra: conserva su historial, pero deja de aparecer en las búsquedas, las salidas y los recuentos.`,
      );
      if (!ok) return;
    }
    setEnviando(true);
    setError('');
    try {
      const actualizado = activo
        ? await api.patch(`/productos/${id}`, { activo: true })
        : await api.del(`/productos/${id}`);
      setProducto(actualizado);
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
        <Link to="/productos" className="btn btn--secundario" style={{ marginTop: 16 }}>
          Volver a productos
        </Link>
      </div>
    );
  }

  return (
    <div className="catalogo">
      <header className="catalogo__cabecera">
        <button type="button" className="catalogo__volver" onClick={() => navegar('/productos')} aria-label="Volver">
          <IconoVolver size={20} />
        </button>
        <h1 className="catalogo__titulo">{editando ? 'Editar producto' : 'Nuevo producto'}</h1>
        {producto && !producto.activo && <span className="badge badge--inactivo">Desactivado</span>}
      </header>

      <form className="card formulario" onSubmit={guardar} noValidate>
        <div className="campo">
          <label htmlFor="nombre">Nombre</label>
          <div className="input">
            <input id="nombre" value={form.nombre} onChange={cambiar('nombre')} maxLength={200} required autoFocus={!editando} />
          </div>
        </div>

        <div className="campo">
          <label htmlFor="codigo">Código de barras (opcional)</label>
          <div className="input">
            <input id="codigo" value={form.codigoBarras} onChange={cambiar('codigoBarras')} inputMode="numeric" maxLength={64} />
          </div>
          <span className="formulario__ayuda">No puede repetirse entre productos.</span>
        </div>

        <div className="formulario__fila">
          <div className="campo">
            <label htmlFor="categoria">Categoría</label>
            <div className="input">
              <select id="categoria" value={form.categoriaId} onChange={cambiar('categoriaId')}>
                <option value="">Sin categoría</option>
                {categorias.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nombre}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="campo">
            <label htmlFor="unidad">Unidad de medida</label>
            <div className="input">
              <select id="unidad" value={form.unidadMedida} onChange={cambiar('unidadMedida')}>
                {UNIDADES.map(([v, t]) => (
                  <option key={v} value={v}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
        {editando && form.unidadMedida !== producto.unidadMedida && (
          <span className="formulario__ayuda">
            La unidad solo se puede cambiar si el producto todavía no tiene movimientos.
          </span>
        )}

        <div className="formulario__fila">
          <div className="campo">
            <label htmlFor="minimo">Stock mínimo</label>
            <div className="input">
              <input id="minimo" value={form.stockMinimo} onChange={cambiar('stockMinimo')} inputMode="decimal" placeholder="0" />
            </div>
            {minimo.error && <span className="formulario__error-campo">{minimo.error}</span>}
          </div>
          <div className="campo">
            <label htmlFor="deseado">Stock deseado (opcional)</label>
            <div className="input">
              <input id="deseado" value={form.stockDeseado} onChange={cambiar('stockDeseado')} inputMode="decimal" />
            </div>
            {deseado.error && <span className="formulario__error-campo">{deseado.error}</span>}
          </div>
        </div>
        <span className="formulario__ayuda">
          Con el stock en el mínimo o por debajo, el producto figura con stock bajo. El deseado es el nivel al que se
          quiere llegar al reponer.
        </span>

        <div className="campo">
          <label htmlFor="descripcion">Descripción (opcional)</label>
          <div className="input">
            <textarea id="descripcion" value={form.descripcion} onChange={cambiar('descripcion')} maxLength={500} rows={2} />
          </div>
        </div>

        {editando && (
          <div className="formulario__dato">
            <span>
              Stock actual: <strong>{mostrarNumero(producto.stockActual)} {unidadCorta(producto.unidadMedida)}</strong>
            </span>
            <Link to={`/movimientos?productoId=${producto.id}`}>Ver movimientos</Link>
          </div>
        )}

        {error && <p className="error-texto">{error}</p>}

        <div className="formulario__acciones">
          <button type="submit" className="btn btn--primario" disabled={!valido || enviando}>
            {enviando ? 'Guardando…' : editando ? 'Guardar cambios' : 'Agregar producto'}
          </button>
          <button type="button" className="btn btn--secundario" onClick={() => navegar('/productos')}>
            Cancelar
          </button>
        </div>
      </form>

      {editando && (
        <div className="card catalogo__estado-registro">
          {producto.activo ? (
            <>
              <p>
                Un producto no se elimina: se desactiva. Conserva su historial, pero deja de aparecer en las búsquedas,
                las salidas y los recuentos.
              </p>
              <button type="button" className="btn btn--peligro" onClick={() => cambiarActivo(false)} disabled={enviando}>
                Desactivar producto
              </button>
            </>
          ) : (
            <>
              <p>Este producto está desactivado y no aparece en las búsquedas.</p>
              <button type="button" className="btn btn--secundario" onClick={() => cambiarActivo(true)} disabled={enviando}>
                Reactivar producto
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
