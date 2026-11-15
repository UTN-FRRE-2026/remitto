// HU9/HU10: control del total de un comprobante. En una factura con IVA
// discriminado o con una bonificación general, el total no es la suma de las
// líneas: es suma − descuentos + impuestos. La misma regla se usa al leer
// (normalizar.js) y al validar la revisión (comprobantes.revision.js).

const redondear = (n) => Math.round(n * 100) / 100;

// Tolerancia: $1 o el 1 % del total, lo que sea mayor (redondeos del papel).
export const tolerancia = (total) => Math.max(1, total * 0.01);

export function totalCalculado({ sumaLineas, descuento = null, impuestos = null }) {
  return redondear(sumaLineas - (descuento ?? 0) + (impuestos ?? 0));
}

// null si no hay total impreso para comparar.
export function coincideTotal({ sumaLineas, descuento, impuestos, total }) {
  if (total == null) return null;
  return Math.abs(totalCalculado({ sumaLineas, descuento, impuestos }) - total) <= tolerancia(total);
}

// Texto de la cuenta para los avisos: «72.000 − 3.600 + 14.364 = 82.764».
export function describirCuenta({ sumaLineas, descuento, impuestos }) {
  const f = (n) => n.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  let t = `$ ${f(redondear(sumaLineas))}`;
  if (descuento) t += ` − descuentos $ ${f(descuento)}`;
  if (impuestos) t += ` + impuestos $ ${f(impuestos)}`;
  if (descuento || impuestos) t += ` = $ ${f(totalCalculado({ sumaLineas, descuento, impuestos }))}`;
  return t;
}
