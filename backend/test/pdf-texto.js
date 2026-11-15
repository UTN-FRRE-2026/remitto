// Extrae el texto de un PDF sin comprimir generado con pdfkit (para pruebas):
// por página, cada línea con su posición { x, y, texto }. y crece hacia arriba.
export function textoPdf(buffer) {
  const s = buffer.toString('latin1');
  const paginas = [];
  for (const m of s.matchAll(/stream\r?\n([\s\S]*?)\r?\nendstream/g)) {
    const items = [];
    for (const t of m[1].matchAll(/1 0 0 1 ([\d.-]+) ([\d.-]+) Tm\s*\/F\d+ [\d.]+ Tf\s*\[(.*?)\] TJ/gs)) {
      const texto = [...t[3].matchAll(/<([0-9a-fA-F]*)>/g)].map((h) => Buffer.from(h[1], 'hex').toString('latin1')).join('');
      items.push({ x: Number(t[1]), y: Number(t[2]), texto });
    }
    if (items.length) paginas.push(items);
  }
  return paginas;
}

// Todo el texto en orden, en una sola cadena con espacios normalizados.
export const textoPlano = (paginas) =>
  paginas
    .flat()
    .map((i) => i.texto)
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();
