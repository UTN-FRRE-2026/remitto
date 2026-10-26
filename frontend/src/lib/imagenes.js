// Achica las fotos antes de subirlas. Una foto de celular pesa 4–8 MB: tarda
// en subir con datos móviles y la lectura con IA se pasa del tope de 30 s
// (RNF2). A 2000 px el texto de un remito sigue siendo legible.
const LADO_MAXIMO = 2000;
const CALIDAD_JPEG = 0.82;
// Por debajo de este peso no vale la pena recomprimir.
const PESO_MINIMO = 700 * 1024;

function cargarImagen(archivo) {
  const url = URL.createObjectURL(archivo);
  const img = new Image();
  img.src = url;
  // decode() respeta la orientación EXIF al dibujar en el canvas.
  return img
    .decode()
    .then(() => img)
    .finally(() => URL.revokeObjectURL(url));
}

function aBlob(canvas) {
  return new Promise((resolver) => canvas.toBlob(resolver, 'image/jpeg', CALIDAD_JPEG));
}

// Devuelve un JPEG más liviano o, si no conviene o falla (PDF, HEIC que el
// navegador no decodifica, etc.), el archivo original: el backend acepta ambos.
export async function comprimirImagen(archivo) {
  if (!archivo.type.startsWith('image/')) return archivo;
  try {
    const img = await cargarImagen(archivo);
    const escala = Math.min(1, LADO_MAXIMO / Math.max(img.naturalWidth, img.naturalHeight));
    if (escala === 1 && archivo.size <= PESO_MINIMO) return archivo;

    const canvas = document.createElement('canvas');
    canvas.width = Math.round(img.naturalWidth * escala);
    canvas.height = Math.round(img.naturalHeight * escala);
    const ctx = canvas.getContext('2d');
    // Fondo blanco: un PNG con transparencia quedaría negro en JPEG.
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

    const blob = await aBlob(canvas);
    if (!blob || blob.size >= archivo.size) return archivo;
    // El backend exige que extensión, MIME y contenido coincidan.
    const nombre = archivo.name.replace(/\.[^.]*$/, '') + '.jpg';
    return new File([blob], nombre, { type: 'image/jpeg', lastModified: Date.now() });
  } catch {
    return archivo;
  }
}
