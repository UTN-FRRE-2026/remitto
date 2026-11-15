// HU30: búsqueda del producto por el código leído con la cámara en el carrito
// (criterios: un código leído agrega el producto; uno desconocido muestra un
// aviso). La pantalla decide con esta respuesta: un producto o ninguno.
// Crea sus propios productos, así no depende del seed ni de otros escenarios.
export default async function hu30({ api, check, dueño, empleado }) {
  const buscar = (codigo, token = empleado) => api('GET', `/productos?codigo=${encodeURIComponent(codigo)}`, { token });
  const crear = async (datos) => (await api('POST', '/productos', { token: dueño, cuerpo: datos })).body;

  const leche = await crear({ nombre: 'Leche HU30 1 l', codigoBarras: '7790030000016' });
  // Un nombre que contiene el código de otro y un código que lo contiene:
  // ninguno de los dos tiene que aparecer en la búsqueda exacta.
  await crear({ nombre: 'Promo 7790030000016', codigoBarras: '77900300000160' });
  const largo = 'X'.repeat(64);
  await crear({ nombre: 'Etiqueta propia HU30', codigoBarras: largo });

  check((await api('GET', '/productos?codigo=7790030000016')).status === 401, 'sin sesión: 401');
  const exacto = await buscar('7790030000016');
  check(
    exacto.status === 200 && exacto.body.length === 1 && exacto.body[0].id === leche.id,
    'criterio: el código leído devuelve solo ese producto (ni el que lo nombra ni el que lo contiene)',
  );
  check(exacto.body[0]?.stockActual === 0 && exacto.body[0]?.unidadMedida === 'UNIDAD', 'trae el stock y la unidad para el carrito');
  check((await buscar('7790030000016', dueño)).body.length === 1, 'el propietario también busca por código');
  check((await buscar(' 7790030000016 ')).body[0]?.id === leche.id, 'se ignoran los espacios del lector');
  check((await buscar('779003000001')).body.length === 0, 'una parte del código no coincide');
  check((await buscar('7790030999993')).status === 200 && (await buscar('7790030999993')).body.length === 0, 'criterio: un código desconocido devuelve una lista vacía (la pantalla avisa)');
  check((await buscar(largo)).body.length === 1, 'acepta códigos de hasta 64 caracteres (el máximo del catálogo)');
  check((await buscar('X'.repeat(65))).status === 400 && (await buscar('   ')).status === 400, 'vacío o de más de 64 caracteres: 400');

  await api('DELETE', `/productos/${leche.id}`, { token: dueño });
  check((await buscar('7790030000016')).body.length === 0, 'un producto desactivado no se agrega por código');
  // La búsqueda por texto sigue igual (alternativa por nombre).
  const porNombre = await api('GET', '/productos?q=HU30', { token: empleado });
  check(porNombre.body.some((p) => p.nombre === 'Etiqueta propia HU30'), 'la búsqueda por nombre sigue disponible');
}
