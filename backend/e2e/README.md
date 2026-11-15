# Pruebas de punta a punta

Comprobaciones contra PostgreSQL real: permisos, SQL, reenvíos y concurrencia. `npm test` no usa base de datos; estas sí, siempre con una base descartable.

```bash
npm run e2e -- hu21-claves
```

Se pueden pasar varios escenarios: `npm run e2e -- hu21-claves hu22-salidas hu23-simulador`.

## Qué hace `correr.mjs`

1. Lee `DATABASE_URL` de `backend/.env` y **se niega a seguir si no apunta a localhost**.
2. Crea una base con nombre único, `remitto_e2e_<fecha con milisegundos>_<proceso>_<6 caracteres aleatorios>`, en ese mismo servidor. La base de desarrollo no se toca.
3. Aplica las migraciones (`prisma migrate deploy`) y el seed.
4. Levanta la API en un puerto libre que asigna el sistema, con la IA simulada (`IA_SIMULACION=ok`, sin clave) y los archivos en una carpeta temporal.
5. **Comprueba que la API que responde es la suya** antes de enviar cualquier operación (ver Aislamiento).
6. Corre cada escenario (`e2e/<nombre>.mjs`), que imprime un renglón por control (`ok` o `MAL`).
7. Detiene su API y borra su base, aunque haya fallas.

Termina con código 0 si todos los controles pasaron, 1 si alguno falló y 2 si abortó por aislamiento (sin correr escenarios).

## Aislamiento

- **Base propia:**
  - el nombre lleva milisegundos, el número de proceso y 6 caracteres aleatorios;
  - si `CREATE DATABASE` falla, por ejemplo porque el nombre ya existe, aborta;
  - solo borra una base que creó él mismo.
- **Nombres permitidos:** solo `remitto_e2e_` seguido de minúsculas, dígitos y guiones bajos. Las bases habituales (`postgres`, `template0`, `template1`, `remitto` y la de `DATABASE_URL`) se rechazan antes de ejecutar SQL.
- **Puerto propio:** usa uno libre. Con `E2E_PUERTO`, si el puerto ya está ocupado, aborta antes de crear la base.
- **Proceso propio:** si su API termina al arrancar, aborta.
- **Marca en la base:** antes de cualquier operación, escribe una categoría con un nombre aleatorio directamente en su base y la busca a través de la API. Iniciar sesión no escribe nada. Si la marca no aparece, la API que responde no usa su base y aborta sin enviar operaciones.
- **Limpieza:** solo detiene su propio proceso, borra su base y borra su carpeta temporal.

`npm run e2e:aislamiento` (`verificar-aislamiento.mjs`) prueba todo esto:
- una API ajena en el puerto pedido;
- una API ajena que responde `health` y el inicio de sesión, pero no usa la base de prueba;
- la API propia que cae al arrancar;
- nombres de base no permitidos;
- un choque con una base existente, que no se borra;
- dos ejecuciones en paralelo.

## Variables

| Variable | Uso |
| --- | --- |
| `E2E_PUERTO` | Puerto fijo para la API de prueba; tiene que estar libre. |
| `E2E_CONSERVAR=1` | No borra la base al terminar, para inspeccionarla. |
| `E2E_VERBOSO=1` | Muestra los errores de la API. |
| `E2E_BASE` | Solo para verificar el aislamiento: nombre de la base (validado como arriba). |
| `E2E_URL_API` | Solo para verificar el aislamiento: dirección local a la que se envían los pedidos. |

## Requisitos

- El PostgreSQL de desarrollo encendido: `docker compose up -d db`, en `localhost:5433`.
- Dependencias instaladas (`npm install`) y el cliente de Prisma generado (`npm run prisma:generate`).

## Escenarios

| Archivo | Historia | Qué comprueba |
| --- | --- | --- |
| `hu21-claves.mjs` | HU21 | Permisos, la clave completa solo en el alta, el hash SHA-256 en la base, el último uso, la revocación (incluso con pedidos en curso) y `CHECK chk_clave_revocada`. |
| `hu22-salidas.mjs` | HU22 | Contrato publicado, autenticación, validación y atomicidad, venta por código de barras e id, reenvíos (200 y 409), reenvíos con el catálogo cambiado (código cambiado, borrado o pasado a otro producto, producto desactivado, fecha distinta, 10 en paralelo), `CHECK chk_pedido_externo`, stock negativo y su aviso en la valorización, kilos, carrito sin cambios, 25 reenvíos simultáneos, 52 operaciones simultáneas de dos cajas y carritos, revocación con 120 ventas en curso y el orden determinístico venta → revocación. |
| `hu10-iva-descuentos.mjs` | HU10 | Factura A con bonificación, IVA y percepción, con la IA simulada (escenario `factura_iva`):
- **lectura:** guarda total, descuento e impuestos, precarga el tipo FACTURA y no marca la factura para revisar;
- **validación:** suma − descuentos + impuestos coincide con el total;
- **corrección:** al borrar los impuestos aparece un aviso con la cuenta, que no impide confirmar; 400 si el importe es negativo o tiene más de 2 decimales, y `CHECK` en la base;
- **confirmación:** el stock sube y el precio de compra es el de la línea;
- **un remito sin ajustes** sigue cuadrando. |
| `hu24-alertas.mjs` | HU24 | Permisos; las alertas del seed coinciden con los indicadores del tablero; ciclo de vida con producto nuevo, recuento, carrito y venta del endpoint (sin stock → resuelta → stock bajo → sin stock → negativo → resuelta) con su historia; reenvío sin alerta duplicada; mínimo, desactivación y reactivación; 30 ventas del endpoint y 10 carritos simultáneos con una sola alerta por situación; `uq_alerta_activa` rechaza una segunda activa; al final, las alertas activas de todos los productos coinciden con su stock. **Se corre en una ejecución aparte** (`npm run e2e -- hu24-alertas`): parte de los datos del seed sin cambios, y HU21 y HU22 esperan una base sin claves ni salidas previas. |
| `hu25-asistente.mjs` | HU25 | Con la IA simulada. Permisos (401; el empleado 403 sin registro; pregunta vacía o larga, 400). Los 8 tipos de preguntas, cada uno contra una fuente independiente (SQL propio, `/alertas`, `/reportes/reposicion`, `/reportes/precios` y `/reportes/precios/:id`). Salidas frente a ventas y «sin ventas» frente a HU29. Más de 20 resultados (muestra 20, informa el total y los totales del conjunto completo). Período nombrado («en octubre»). Aclaración con dos yerbas mate y elección con la misma herramienta y el mismo período (400 fuera de las opciones, 409 al repetir). Fallas registradas: proveedor, JSON inválido, herramienta no habilitada, argumentos inválidos y tiempo agotado (a los 30 s). Fuera de alcance, registro de todas las consultas e historial. |
| `hu30-codigo.mjs` | HU30 | Búsqueda por el código leído (`GET /productos?codigo=`): coincidencia exacta (ni el producto que lo nombra ni el código que lo contiene, ni una parte), espacios del lector, código desconocido (lista vacía), hasta 64 caracteres y 400 si está vacío o es más largo, producto desactivado fuera, ambos roles y 401 sin sesión; la búsqueda por nombre sigue igual. Crea sus propios productos. |
| `hu31-orden-compra.mjs` | HU31 | Orden de compra en PDF por proveedor: 200, `application/pdf`, descarga como archivo con el nombre esperado. El texto del PDF incluye el proveedor (con el CUIT con guiones) y cada producto con la cantidad y la unidad de `/reportes/reposicion`, sin los de otro proveedor ni precios. Cantidad decimal (2,375 kg); lista «a definir» para los productos sin compras; 404 para un proveedor sin pedido o inexistente; 400 sin parámetro o inválido; empleado 403 y sin sesión 401; la descarga no modifica stock ni movimientos. |
| `hu26-tablero.mjs` | HU26 | Permisos (401; el empleado sin valor ni precios); comprobantes en los cuatro estados pendientes; cada indicador contra un cálculo propio en SQL y el valor igual a HU28; cambios después de confirmar un comprobante, una salida y un recuento. **Foto única, determinística:** un recuento confirmado entre dos lecturas del tablero; con `REPEATABLE READ` todo corresponde a la foto inicial y la variante `READ COMMITTED` mezcla estados. **Complementaria:** una ráfaga de 4 lectores del endpoint mientras un escritor alterna un producto entre dos estados, sin respuestas mezcladas. Espera no tener comprobantes previos: correrlo aparte o después de `hu21` a `hu23`. |
| `hu23-simulador.mjs` | HU23 | El simulador de ventas (`simulador/simulador.mjs`). **Corrida válida:** 120 ventas y 30 reenvíos (`SIM_SEMILLA`, `SIM_VENTAS`, `SIM_REENVIOS`); un 201 por referencia y el resto 200 con `repetida`; ningún envío incompleto; 120 salidas en la base; 0 diferencias entre el stock esperado (en milésimas) y el registrado; stock igual a la suma de movimientos. **Control negativo separado:** un descuento adicional introducido a propósito tiene que aparecer como diferencia exacta. |

Para agregar uno, crear `e2e/<nombre>.mjs` con una función por defecto que recibe `{ api, check, db, login, dueño, empleado, base }`. `db` es un `PrismaClient` conectado a la base descartable.
