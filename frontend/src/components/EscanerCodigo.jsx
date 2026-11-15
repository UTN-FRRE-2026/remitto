import { useEffect, useRef, useState } from 'react';
import './EscanerCodigo.css';

// Formatos de los códigos de producto habituales en un comercio (EAN y UPC de
// los envases, Code 128/39 e ITF de etiquetas propias). Limitar los formatos
// hace la lectura más rápida y evita falsos positivos.
const FORMATOS = ['EAN_13', 'EAN_8', 'UPC_A', 'UPC_E', 'CODE_128', 'CODE_39', 'ITF'];

function mensajeCamara(err) {
  switch (err?.name) {
    case 'NotAllowedError':
    case 'SecurityError':
      return 'No hay permiso para usar la cámara. Habilitalo en el navegador o escribí el código.';
    case 'NotFoundError':
    case 'OverconstrainedError':
      return 'No se encontró una cámara en este dispositivo. Escribí el código o usá un lector.';
    case 'NotReadableError':
      return 'La cámara está en uso por otra aplicación. Cerrala y probá de nuevo.';
    default:
      return 'No se pudo abrir la cámara. Escribí el código o usá un lector.';
  }
}

// HU30 · Lee un código de barras con la cámara trasera. La librería (ZXing)
// se carga recién al abrir el escáner para no agrandar el resto de la app.
// Devuelve el primer código leído con onLeer y se cierra.
export default function EscanerCodigo({ onLeer, onCerrar }) {
  const videoRef = useRef(null);
  const [error, setError] = useState('');
  const [listo, setListo] = useState(false);
  // Referencias estables: el efecto no se reinicia si cambian las funciones.
  const alLeer = useRef(onLeer);
  alLeer.current = onLeer;

  useEffect(() => {
    let cancelado = false;
    let controles = null;

    async function iniciar() {
      if (!navigator.mediaDevices?.getUserMedia) {
        setError('La cámara solo está disponible con una conexión segura (HTTPS). Escribí el código o usá un lector.');
        return;
      }
      try {
        const [{ BrowserMultiFormatReader }, { BarcodeFormat, DecodeHintType }] = await Promise.all([
          import('@zxing/browser'),
          import('@zxing/library'),
        ]);
        if (cancelado) return;
        const pistas = new Map([[DecodeHintType.POSSIBLE_FORMATS, FORMATOS.map((f) => BarcodeFormat[f])]]);
        const lector = new BrowserMultiFormatReader(pistas, { delayBetweenScanAttempts: 150 });
        const c = await lector.decodeFromConstraints(
          { audio: false, video: { facingMode: 'environment' } },
          videoRef.current,
          (resultado, _error, ctrl) => {
            if (!resultado || cancelado) return;
            cancelado = true;
            ctrl.stop();
            alLeer.current(resultado.getText().trim());
          },
        );
        if (cancelado) c.stop();
        else {
          controles = c;
          setListo(true);
        }
      } catch (err) {
        if (!cancelado) setError(mensajeCamara(err));
      }
    }

    iniciar();
    return () => {
      cancelado = true;
      controles?.stop();
    };
  }, []);

  useEffect(() => {
    const alTeclado = (e) => e.key === 'Escape' && onCerrar();
    window.addEventListener('keydown', alTeclado);
    return () => window.removeEventListener('keydown', alTeclado);
  }, [onCerrar]);

  return (
    <div className="escaner" role="dialog" aria-modal="true" aria-label="Escanear código de barras">
      <div className="escaner__visor">
        <video ref={videoRef} className="escaner__video" muted playsInline />
        {!error && <div className="escaner__guia" aria-hidden="true" />}
        {error && <p className="escaner__error" role="alert">{error}</p>}
      </div>
      <p className="escaner__ayuda" aria-live="polite">
        {error ? '' : listo ? 'Apuntá al código de barras del producto.' : 'Abriendo la cámara…'}
      </p>
      <button type="button" className="btn btn--secundario btn--bloque escaner__cancelar" onClick={onCerrar}>
        {error ? 'Volver' : 'Cancelar'}
      </button>
    </div>
  );
}
