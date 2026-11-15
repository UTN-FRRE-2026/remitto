// HU24 (patrón Observer): cada movimiento de stock avisa a los interesados
// dentro de la misma transacción, sin que el módulo de stock dependa de ellos.
// Si un observador falla, la transacción entera se deshace: el movimiento y
// sus efectos (por ejemplo, la alerta) quedan juntos o no quedan.
const observadores = new Set();

export function observarMovimientos(fn) {
  observadores.add(fn);
  return () => observadores.delete(fn);
}

export async function notificarMovimiento(tx, evento) {
  for (const fn of observadores) await fn(tx, evento);
}
