import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, mensajeDeError } from '../lib/api.js';
import { IconoEditar, IconoMas } from '../components/iconos.jsx';
import './Productos.css';
import './Catalogo.css';

const productosTexto = (n) => (n === 1 ? '1 producto' : `${n} productos`);

// HU5 · Categorías (solo propietario). Alta, renombrado y eliminación en la
// misma lista: una categoría es solo un nombre.
export default function Categorias() {
  const [categorias, setCategorias] = useState(null);
  const [nueva, setNueva] = useState('');
  const [editando, setEditando] = useState(null); // { id, nombre }
  const [error, setError] = useState('');
  const [aviso, setAviso] = useState('');
  const [enviando, setEnviando] = useState(false);

  const cargar = useCallback(
    () =>
      api
        .get('/categorias')
        .then(setCategorias)
        .catch((err) => {
          setCategorias([]);
          setError(mensajeDeError(err));
        }),
    [],
  );

  useEffect(() => {
    cargar();
  }, [cargar]);

  async function ejecutar(accion, mensajeOk) {
    setEnviando(true);
    setError('');
    setAviso('');
    try {
      await accion();
      setAviso(mensajeOk);
      await cargar();
      return true;
    } catch (err) {
      setError(mensajeDeError(err));
      return false;
    } finally {
      setEnviando(false);
    }
  }

  async function crear(e) {
    e.preventDefault();
    const nombre = nueva.trim();
    if (!nombre || enviando) return;
    if (await ejecutar(() => api.post('/categorias', { nombre }), `Se agregó «${nombre}».`)) setNueva('');
  }

  async function renombrar(e) {
    e.preventDefault();
    const nombre = editando.nombre.trim();
    if (!nombre || enviando) return;
    if (await ejecutar(() => api.patch(`/categorias/${editando.id}`, { nombre }), `Se renombró a «${nombre}».`)) {
      setEditando(null);
    }
  }

  async function eliminar(c) {
    const n = c._count.productos;
    const detalle = n > 0 ? ` ${productosTexto(n)} ${n === 1 ? 'queda' : 'quedan'} sin categoría; no se borra ninguno.` : '';
    if (!window.confirm(`¿Eliminar la categoría «${c.nombre}»?${detalle}`)) return;
    await ejecutar(() => api.del(`/categorias/${c.id}`), `Se eliminó «${c.nombre}».`);
  }

  return (
    <div className="catalogo">
      <header className="catalogo__cabecera">
        <h1 className="catalogo__titulo">
          Categorías <span>{categorias?.length ?? ''}</span>
        </h1>
      </header>

      <form className="input productos__buscar categoria__nueva" onSubmit={crear}>
        <input
          aria-label="Nueva categoría"
          placeholder="Nueva categoría, por ejemplo Bebidas"
          value={nueva}
          onChange={(e) => setNueva(e.target.value)}
          maxLength={60}
        />
        <button type="submit" className="btn btn--primario categoria__agregar" disabled={!nueva.trim() || enviando}>
          <IconoMas size={18} /> Agregar
        </button>
      </form>

      {aviso && <p className="catalogo__aviso">{aviso}</p>}
      {error && <p className="error-texto categoria__error">{error}</p>}

      <div className="card lista">
        {categorias === null && <p className="lista__estado">Cargando…</p>}
        {categorias?.length === 0 && !error && <p className="lista__estado">Todavía no hay categorías.</p>}
        {categorias?.map((c) =>
          editando?.id === c.id ? (
            <form key={c.id} className="proveedor categoria__edicion" onSubmit={renombrar}>
              <div className="input">
                <input
                  aria-label={`Nuevo nombre de ${c.nombre}`}
                  value={editando.nombre}
                  onChange={(e) => setEditando({ ...editando, nombre: e.target.value })}
                  maxLength={60}
                  autoFocus
                />
              </div>
              <div className="categoria__acciones">
                <button type="submit" className="btn btn--primario" disabled={!editando.nombre.trim() || enviando}>
                  Guardar
                </button>
                <button type="button" className="btn btn--secundario" onClick={() => setEditando(null)}>
                  Cancelar
                </button>
              </div>
            </form>
          ) : (
            <div key={c.id} className="proveedor">
              <div className="proveedor__datos">
                <strong>{c.nombre}</strong>
                {c._count.productos > 0 ? (
                  <Link to={`/productos?categoriaId=${c.id}`} className="categoria__productos">
                    {productosTexto(c._count.productos)}
                  </Link>
                ) : (
                  <span>Sin productos</span>
                )}
              </div>
              <button
                type="button"
                className="producto__editar"
                onClick={() => {
                  setEditando({ id: c.id, nombre: c.nombre });
                  setError('');
                  setAviso('');
                }}
                aria-label={`Renombrar ${c.nombre}`}
              >
                <IconoEditar size={18} />
              </button>
              <button
                type="button"
                className="categoria__eliminar"
                onClick={() => eliminar(c)}
                disabled={enviando}
                aria-label={`Eliminar ${c.nombre}`}
              >
                Eliminar
              </button>
            </div>
          ),
        )}
      </div>
    </div>
  );
}
