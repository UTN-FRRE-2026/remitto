import { useEffect, useState } from 'react';
import { api } from '../lib/api.js';
import { mostrarNumero } from '../lib/numeros.js';
import { unidadCorta } from '../lib/unidades.js';
import { IconoBuscar, IconoCodigo } from './iconos.jsx';
import './BuscadorProducto.css';

// Buscador de productos por nombre o código, con soporte para lectores de
// códigos que mandan Enter. Lo usan el carrito de salida (HU13), que solo
// admite productos con stock, y el recuento (HU14), que admite cualquiera.
export default function BuscadorProducto({ onElegir, soloConStock = false }) {
  const [q, setQ] = useState('');
  const [resultados, setResultados] = useState([]);
  const [buscando, setBuscando] = useState(false);
  const [aviso, setAviso] = useState('');

  useEffect(() => {
    if (q.trim().length < 2) {
      setResultados([]);
      return undefined;
    }
    const t = setTimeout(() => {
      setBuscando(true);
      api
        .get(`/productos?q=${encodeURIComponent(q.trim())}`)
        .then((r) => setResultados(r.slice(0, 8)))
        .catch(() => setResultados([]))
        .finally(() => setBuscando(false));
    }, 250);
    return () => clearTimeout(t);
  }, [q]);

  const sinStock = (p) => soloConStock && p.stockActual <= 0;

  function elegir(p) {
    onElegir(p);
    setQ('');
    setAviso('');
  }

  // Un lector de códigos escribe el código y manda Enter: si coincide
  // exactamente (o hay un solo resultado), se agrega directo.
  async function alEnter(e) {
    if (e.key !== 'Enter' || !q.trim()) return;
    e.preventDefault();
    const texto = q.trim();
    try {
      const r = await api.get(`/productos?q=${encodeURIComponent(texto)}`);
      const exacto = r.find((p) => p.codigoBarras === texto) ?? (r.length === 1 ? r[0] : null);
      if (!exacto) {
        setAviso(r.length === 0 ? 'No hay productos con ese nombre o código.' : 'Elegí el producto de la lista.');
        return;
      }
      if (sinStock(exacto)) {
        setAviso(`${exacto.nombre} no tiene stock.`);
        return;
      }
      elegir(exacto);
    } catch (err) {
      setAviso(err.message);
    }
  }

  return (
    <div className="buscador">
      <div className="input">
        <IconoBuscar size={18} color="var(--texto-suave)" />
        <input
          placeholder="Buscar por nombre o código"
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setAviso('');
          }}
          onKeyDown={alEnter}
          aria-label="Buscar producto"
          enterKeyHint="search"
        />
        <IconoCodigo size={18} color="var(--texto-suave)" />
      </div>
      {aviso && <p className="buscador__nota">{aviso}</p>}
      {q.trim().length >= 2 && (
        <ul className="buscador__resultados">
          {buscando && <li className="buscador__nota">Buscando…</li>}
          {!buscando && resultados.length === 0 && <li className="buscador__nota">Sin resultados.</li>}
          {resultados.map((p) => (
            <li key={p.id}>
              <button onClick={() => elegir(p)} disabled={sinStock(p)}>
                <span>{p.nombre}</span>
                <small>{sinStock(p) ? 'Sin stock' : `Hay ${mostrarNumero(p.stockActual)} ${unidadCorta(p.unidadMedida)}`}</small>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
