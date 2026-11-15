import { useCallback, useEffect, useState } from 'react';
import { api } from '../lib/api.js';
import { mostrarNumero } from '../lib/numeros.js';
import { unidadCorta } from '../lib/unidades.js';
import { IconoBuscar, IconoCodigo } from './iconos.jsx';
import EscanerCodigo from './EscanerCodigo.jsx';
import './BuscadorProducto.css';

// Buscador de productos por nombre o código, con soporte para lectores de
// códigos que mandan Enter. Lo usan el carrito de salida (HU13), que solo
// admite productos con stock, y el recuento (HU14), que admite cualquiera.
// Con `escanear` (HU30, carrito) también lee el código con la cámara.
export default function BuscadorProducto({ onElegir, soloConStock = false, escanear = false }) {
  const [q, setQ] = useState('');
  const [resultados, setResultados] = useState([]);
  const [buscando, setBuscando] = useState(false);
  const [aviso, setAviso] = useState('');
  const [escaneando, setEscaneando] = useState(false);

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
  const cerrarEscaner = useCallback(() => setEscaneando(false), []);

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

  // HU30: el código leído se busca exacto; si no existe o no tiene stock, avisa.
  async function alLeerCodigo(codigo) {
    setEscaneando(false);
    setQ('');
    if (!codigo) return;
    try {
      const [p] = await api.get(`/productos?codigo=${encodeURIComponent(codigo)}`);
      if (!p) {
        setAviso(`No hay ningún producto con el código ${codigo}. Buscalo por nombre o cargá el código en su ficha.`);
        return;
      }
      if (sinStock(p)) {
        setAviso(`${p.nombre} no tiene stock.`);
        return;
      }
      onElegir(p);
      setAviso(`Se agregó ${p.nombre}.`);
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
        {escanear ? (
          <button
            type="button"
            className="buscador__escanear"
            onClick={() => {
              setAviso('');
              setEscaneando(true);
            }}
            aria-label="Escanear código de barras con la cámara"
            title="Escanear código de barras"
          >
            <IconoCodigo size={20} />
          </button>
        ) : (
          <IconoCodigo size={18} color="var(--texto-suave)" />
        )}
      </div>
      {aviso && (
        <p className="buscador__nota" role="status">
          {aviso}
        </p>
      )}
      {escaneando && <EscanerCodigo onLeer={alLeerCodigo} onCerrar={cerrarEscaner} />}
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
