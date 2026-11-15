# 🧾 Remitto

Sistema de gestión de stock para comercios minoristas de cercanía, con carga
automática de comprobantes de compra mediante Inteligencia Artificial.

> Trabajo Final Integrador 2026 — Tecnicatura Universitaria en Programación,
> UTN Facultad Regional Resistencia.
> Agostina Jara · Ivan Sanchez · Maximiliano Stabile.

---

## Estado actual

Están implementadas las historias del Sprint 1 (HU1 a HU14) y, del
Sprint 2, HU15 a HU29. La aplicación está desplegada en producción con Coolify, a partir
de `main`. El equipo probó la instalación de la PWA en un Android real (HU7) y funciona.

Ya implementado:

| Requerimiento | Historias | Estado |
|---|---|---|
| **RF1** Usuarios y acceso | HU1 (login), HU2 (roles), HU3 (admin usuarios) | ✅ Backend y pantallas |
| **RF2** Catálogo | HU4 (productos), HU5 (categorías), HU6 (proveedores) | ✅ Backend y pantallas |
| **RNF4** PWA móvil | HU7 (instalable) | ✅ Base |
| **RF3** Ingesta de comprobantes | HU8 (carga), HU9 (lectura con IA), HU10 (revisión), HU11 (entradas de stock), HU15 (asociación automática), HU16 (equivalencias por proveedor), HU17 (revisión obligatoria), HU18 (comprobantes archivados), HU19 (precisión de la lectura) | ✅ Backend y pantallas M3/M4/M5, Comprobantes y Precisión |
| **Existencias** | HU12 (movimientos y existencias) | ✅ Backend y pantalla Movimientos |
| **Salidas** | HU13 (carrito de salida) | ✅ Backend y pantalla Nueva salida |
| **Recuento** | HU14 (ajuste por recuento) | ✅ Backend y pantalla Recuento |
| **RF5** Integración | HU21 (claves de integración), HU22 (salidas desde un sistema externo, con contrato OpenAPI), HU23 (simulador de ventas) | ✅ Backend, pantalla Integraciones y simulador |
| **RF6** Alertas y reposición | HU24 (alertas de stock), HU27 (sugerencia de reposición) | ✅ Backend, pantalla Alertas (campana del Inicio) y Precios y reportes |
| **RF8** Reportes | HU20 (evolución de precios), HU28 (valorización de existencias), HU29 (productos sin movimiento) | ✅ Backend y pantalla Precios y reportes |
| Frontend | Login, Tablero, Comprobantes, Precisión de la lectura, Productos (alta y edición), Proveedores, Categorías, Usuarios, Cargar remito, Lectura con IA, Revisar remito, Movimientos, Nueva salida, Recuento, Precios y reportes, Integraciones, Alertas | ✅ Vistas base |

Están completos el flujo de ingreso (cargar → leer con IA → revisar →
confirmar), el de salida (carrito → confirmar) y el recuento (contar →
ajustar). Cada movimiento queda en el historial de Movimientos.
Están implementadas todas las historias obligatorias (HU1 a HU29).

Documentación del proyecto en [`docs/`](docs/README.md): [estado y continuidad](docs/estado-proyecto.md),
[plan de trabajo con las HU](docs/plan-de-trabajo.md) y [guía de maquetación](docs/maquetacion.md).

---

## Arquitectura

Cliente-servidor en capas (ver [Plan de trabajo](docs/plan-de-trabajo.md#arquitectura-de-software)):

```
frontend/   PWA en React (Vite) · instalable · mobile-first
backend/    API REST Node.js + Express + Prisma
  prisma/   Schema (13 tablas) y migraciones
docs/       Documentación técnica y OpenAPI (integración)
simulador/  Simulador de ventas para validar la integración (Sprint 2)
docker-compose.yml   PostgreSQL (+ Adminer)
```

- **Capa de persistencia:** PostgreSQL en Docker.
- **Acceso a datos:** Prisma (patrón Repository).
- **Autenticación:** JWT, contraseñas con bcrypt (RNF1).
- **Reglas de negocio** garantizadas en la base con restricciones `CHECK` (RNF5).

---

## Puesta en marcha

### 1. Base de datos (Docker)

```bash
cp .env.example .env
docker compose up -d db        # PostgreSQL en localhost:5433
```

> El puerto es **5433** para no chocar con un PostgreSQL ya instalado en el host.
> Para levantar también Adminer (cliente web en :8080): `docker compose up -d`.

### 2. Backend

```bash
cd backend
cp .env.example .env
npm install
npx prisma generate
npx prisma migrate dev         # crea las tablas + restricciones + corre el seed
npm run dev                    # API en http://localhost:4000/api
```

Si el seed no corrió solo: `npm run seed`.

### 3. Frontend

```bash
cd frontend
npm install
npm run dev                    # PWA en http://localhost:5173
```

El dev server redirige `/api` al backend (ver `vite.config.js`).

### Comprobantes subidos (HU8)

Los archivos se guardan en `backend/uploads/comprobantes/` con un nombre
generado por el servidor (Git solo versiona `backend/uploads/.gitkeep`).
No se publican como estáticos: se descargan con sesión en
`GET /api/comprobantes/:id/archivo`. Formatos admitidos: JPG, PNG, WEBP,
HEIC/HEIF y PDF; tamaño máximo `ARCHIVO_MAX_MB` (10 MB por defecto).

### Lectura con IA (HU9)

Después de cargar un comprobante, la pantalla M4 (`/comprobantes/:id/lectura`)
pide la lectura con Gemini. Corre en segundo plano y el estado queda en la base:
`PENDIENTE → PROCESANDO (en cola / leyendo) → EN_REVISION | ERROR`. Nada se
procesa solo: los comprobantes anteriores se leen tocando "Leer con IA".

- La clave va solo en `backend/.env` (`IA_API_KEY`) y el modelo en `IA_MODELO`
  (`gemini-3.8-flash`). Sin clave, `POST /procesar` responde 503.
- Capa gratuita: Google puede usar el contenido enviado para mejorar sus
  productos. Se usa `store: false`, sin `service_tier` ni cambio de modelo.
- Cada ejecución tiene un tope de `IA_PRESUPUESTO_MS` (30 s) para llamadas y
  esperas. Cada llamada real se registra antes de enviarse y el total por
  comprobante está limitado por `IA_MAX_INTENTOS` (3); el SDK no reintenta solo.
- Si un backend cae, sus lecturas pasan a `ERROR [INTERRUMPIDO]` cuando vence
  su vigencia (`IA_VIGENCIA_MS`) y se pueden reintentar.
- Lo leído se guarda sin inventar datos: lo ilegible queda en `null`, no se
  convierten bultos a unidades y las dudas quedan como motivos de revisión.
  La edición es de HU10 y la confirmación, de HU11.
- **Esquema de respuesta versión 3** (`backend/src/ia/esquemaComprobante.js`):
  JSON Schema con tipos simples (Gemini rechazó con 400 las uniones con `null`,
  `additionalProperties` y `maxItems`). La cantidad se pide solo como texto
  obligatorio `cantidadTexto`, copiado de la celda (`""` si está vacía o
  ilegible); el backend la interpreta en formato argentino y, si es ambigua o
  falta, queda en `null` con revisión. Nunca se deduce de importes ni precios.
  `unidad` solo se copia si está impresa. Zod valida la estructura y la
  respuesta original se conserva en `respuesta_ia`.
- Pruebas sin red: `npm test` (unitarias) y backend con `IA_SIMULACION=ok`.

### Revisión del comprobante (HU10)

Desde M4, "Revisar remito" abre M5/D2 (`/comprobantes/:id/revisar`): el archivo
original junto a las líneas leídas, para corregir antes de ingresar.

- Por línea: asociar un producto del catálogo (propietario y empleado), crear
  uno nuevo (solo el propietario, vía `POST /api/productos`), corregir cantidad
  y precio, descartar o restaurar. También se agregan líneas a mano.
- Cabecera: número definitivo, fecha, tipo y total impreso. El número no se
  repite por proveedor y tipo (`@@unique`): si ya existe responde 409. La
  fecha de emisión no puede ser posterior a hoy (hora de Argentina), igual que
  en la lectura de la IA: fija la vigencia del precio de compra y una fecha
  futura dominaría el «último precio» de la valorización (HU28).
- Las correcciones se guardan como borrador al salir de cada campo. Lo leído por
  la IA (columnas `*Extraido` y `respuesta_ia`) nunca se modifica.
- **"Validar datos"** informa si falta algo (producto, cantidad > 0, número,
  al menos una línea) y muestra avisos (sin precio, sin fecha, total distinto,
  posible duplicado). No modifica nada; si está todo, habilita "Confirmar ingreso".

### Revisión obligatoria en comprobantes dudosos (HU17)

Si la IA indica que el comprobante está **escrito a mano**, que la imagen es de
**baja calidad** o que **no se lee bien** (`respuesta_ia.lectura.documento`),
la revisión muestra el aviso «Revisión línea por línea obligatoria» con la
cuenta de líneas revisadas, y cada línea a ingresar tiene el botón **«Marcar
como revisada»** (se puede deshacer). Las líneas sin revisar quedan destacadas.

- «Validar datos» y «Confirmar ingreso» exigen que todas las líneas a ingresar
  estén revisadas (`detalles_comprobante.revisada`); la confirmación lo vuelve
  a comprobar dentro de su transacción. Las descartadas no cuentan y las
  agregadas a mano nacen revisadas.
- En un comprobante normal no se pide la marca. El listado de Comprobantes
  (HU18) señala los que exigen esta revisión.
- Migración `20261114120000_hu17_revision_lineas`: agrega la columna con valor
  `false`; producción la aplica al arrancar (`prisma migrate deploy`).

### Confirmación del ingreso y entradas de stock (HU11)

"Confirmar ingreso" (`POST /api/comprobantes/:id/confirmar`, propietario y
empleado) hace todo en **una sola transacción**; si algo falla, no cambia
ningún stock:

1. `EN_REVISION → CONFIRMADO` con `confirmadoPor`/`confirmadoEn`. Confirmar de
   nuevo (doble clic, otra pestaña, dos pedidos a la vez) responde 409 y no
   suma nada.
2. Vuelve a validar con lo guardado (las mismas reglas de "Validar datos").
3. Rechaza con 409 un remito ya ingresado: otro comprobante confirmado del
   mismo proveedor y tipo con el mismo número normalizado.
4. Por cada línea no descartada: línea `CONFIRMADO`, `MovimientoStock`
   ENTRADA/COMPRA (con `stock_anterior`) y, si tiene precio, `PrecioCompra`
   con fecha de vigencia = fecha de emisión o, si falta, la de hoy.

El stock solo cambia a través de `backend/src/modules/stock/stock.service.js`
(`registrarMovimiento`, que bloquea el producto con `FOR UPDATE`), así
`stock_actual` = suma de los movimientos. La base lo refuerza con CHECK: una
línea confirmada tiene producto y cantidad > 0, el precio no es negativo y un
comprobante confirmado tiene número, usuario y fecha de confirmación.

**Bases cargadas con el seed anterior** (stock sin movimientos):
`npm run conciliar-stock` lista los productos descuadrados y
`npm run conciliar-stock -- --aplicar` registra un AJUSTE/RECUENTO por la
diferencia, sin cambiar el stock. Repetirlo no duplica ajustes. El seed actual
ya carga el stock inicial como movimientos.

#### Iniciar el backend con la lectura real habilitada

La clave se toma de `backend/.env`. Una variable `IA_API_KEY` definida en la
terminal tiene prioridad sobre el archivo (incluso vacía o con un espacio, que
es como se deshabilita la IA en las pruebas). Por eso, en una terminal nueva:

```powershell
cd F:\Documentos\Remitto\remitto\backend
Remove-Item Env:IA_API_KEY, Env:IA_SIMULACION -ErrorAction SilentlyContinue
npm run dev        # GET /api/comprobantes/:id/estado → "iaDisponible": true
```

Para dejarla deshabilitada (sin llamadas reales): `$env:IA_API_KEY=' '; npm run dev`.
En Docker, el servicio `backend` toma `IA_API_KEY` de `backend/.env` (`env_file`).

#### Verificado (octubre de 2026)

- Pruebas unitarias (`npm test`): esquema y Zod, normalización (cantidades
  argentinas, vacías y ambiguas), errores del proveedor saneados, solicitud
  serializada al SDK sin reintentos ocultos.
- Simulación de punta a punta: cola, latido entre dos backends, recuperación
  tras la caída de un backend, límites de intentos y presupuesto de 30 s.
- Gemini real (`gemini-3.8-flash`, `low`) con dos remitos PDF ficticios: todas
  las filas, cantidades (incluida una decimal) y precios correctos; una celda de
  cantidad vacía quedó en `null` con revisión; unos 6,5 s por lectura.
- Docker con la IA deshabilitada: imagen con `@google/genai`, `/procesar`
  responde 503 y los archivos se sirven por el bind mount.

#### Limitaciones conocidas

- Probado solo con PDF ficticios generados por computadora; faltan fotos reales
  (manuscritas, borrosas, HEIC) y remitos de varias páginas.
- El aviso "puede haber filas sin leer" también aparece cuando la diferencia
  con el total se explica por una fila sin cantidad.
- El modelo puede devolver `"unidad": ""` en filas sin dato; se normaliza a `null`.
- Capa gratuita: cuotas bajas por minuto y por día; el contenido enviado puede
  usarse para mejorar los productos de Google.
- La asociación automática al catálogo (HU15) se calibró con las descripciones de
  la simulación y el catálogo del seed; falta probarla con remitos reales.

### Asociación automática al catálogo (HU15)

Al terminar la lectura, cada línea llega con un **producto propuesto y su
confianza** (0 a 1, columna `confianza`), calculados en
`backend/src/modules/comprobantes/comprobantes.asociacion.js` contra los
productos activos:

1. Si el código impreso coincide con un código de barras del catálogo (8 o
   más dígitos), la confianza es 1.
2. Si no, se compara la descripción con el nombre de cada producto, palabra por
   palabra: se normalizan mayúsculas, acentos, `C/` y `S/`, y se ignoran
   palabras de envase (`PACK`, `CAJA`, `BOT`…) y multiplicadores (`X6`). Una
   palabra igual vale 1; una abreviatura de la del producto («gall» →
   «galletitas»), 0,9; un error de tipeo leve, hasta 0,9. La abreviatura vale
   en ese sentido: «PAÑALES» no se explica por «Pan». Pesa 70 % cuánto de lo
   leído explica el producto y 30 % cuánto del nombre aparece en lo leído.
3. Las medidas se comparan por su valor: `500ML` = `500 ml`, `1500ML` =
   `1,5 l`, `1000G` = `1 kg`, `CC` y `C.C.` = `ml`, `1.000 GR` = 1000 g,
   `1/2 KG` = 0,5 kg, y un número sin unidad (`COLA 500`) coincide con cualquier
   medida de ese número. Dos números sueltos se comparan como texto (la
   harina «000» no es la «0000»). Si las medidas no coinciden, el puntaje se
   divide por 2.
4. La confianza se limita a 0,79 (siempre se destaca) si la propuesta es
   dudosa: otro producto queda casi empatado (diferencia menor a 0,05; ante un
   empate exacto se propone el de menor id); alguna palabra leída no aparece
   en el producto, lo que suele indicar otra variante («SIN palo» frente a
   «con palo», «LIGHT», otra marca); o lo leído cubre menos del 60 % del
   nombre del producto («COLA» frente a «Gaseosa cola 500 ml»).

Umbrales: desde **0,8** la propuesta es confiable; entre 0,5 y 0,8 se propone
pero la línea se **destaca** («Revisar · 74 %») y «Validar datos» lo avisa sin
impedir confirmar; por debajo de 0,5 no se propone producto (confianza 0) y
se **propone el alta** con el nombre leído (al propietario se le abre el
formulario; el empleado puede buscar otro producto).

- La persona puede cambiar cualquier asociación («Cambiar», o «Es correcto» en
  una dudosa). Al elegir o quitar un producto la confianza pasa a `null`
  («Asociado»): la elección es suya y nada vuelve a proponer sobre esa línea.
  La propuesta se calcula una sola vez, al leer; un comprobante en revisión no
  se puede volver a leer.
- El stock sigue entrando solo con «Confirmar ingreso» (HU11).
- Los comprobantes leídos antes de HU15 no tienen propuestas. Antes de este
  cálculo se consultan las equivalencias aprendidas del proveedor (HU16).
- Rendimiento medido con catálogos sintéticos y 40 líneas: 0,3 s con 1.000
  productos y 1,8 s con 5.000. El cálculo es síncrono y no entra en la medición
  de tiempo del RNF2.
- Al corregir una propuesta no se conserva cuál había sido (el producto y la
  confianza se reemplazan). Por eso HU19 mide la lectura de la IA y no los
  aciertos de la asociación; medirlos requeriría guardar la propuesta aparte.

### Equivalencias por proveedor (HU16)

Remitto recuerda cómo nombra cada proveedor a cada producto (tabla
`codigos_proveedor`, lógica en
`backend/src/modules/comprobantes/comprobantes.equivalencias.js`):

- **Dos tipos de fila:** por **código** (código impreso → producto, con la
  última descripción vista) y por **descripción** (descripción normalizada →
  producto, código nulo). Cada una tiene su contador de confirmaciones. Un
  código y una descripción tienen una sola fila cada uno (índices únicos; el de
  la descripción es parcial y vale para las filas sin código), así que nunca
  apuntan a dos productos.
- **Se aprenden al confirmar un ingreso.** Cada línea leída por la IA y no
  descartada actualiza la fila de su código (si tiene) y la de su descripción
  normalizada (`GAS, COLA 500 ML` → `gas cola 500ml`), apuntando al producto
  que confirmó la persona. Confirmar de nuevo lo mismo suma al contador; si la
  persona eligió otro producto, la fila pasa a ese y el contador vuelve a 1. Se
  registra en la misma transacción que la confirmación, con el proveedor
  bloqueado, así dos ingresos simultáneos del mismo proveedor no duplican
  filas. Un mismo código con otra descripción no borra la descripción anterior.
- **Se usan al leer el siguiente comprobante de ese proveedor**, antes de buscar
  productos parecidos:
  1. Si el código impreso ya se confirmó, manda el código: confianza 1.
  2. Si no, se mira la descripción: si todo lo confirmado con ella apunta al
     mismo producto, confianza 1. Si apunta a más de uno (dos códigos que se
     imprimen igual, como `LE01` y `LE02` con «LECHE 1 L»), o si la línea trae
     un código nuevo con una descripción ya vista, se propone el último
     producto confirmado con confianza 0,79: la línea se destaca para revisar.
  3. Una equivalencia dudosa (0,79) no tapa una coincidencia confiable del
     catálogo (HU15): si el código de barras impreso es el de un producto, o la
     descripción coincide con confianza 0,8 o más, se propone ese producto.

  Con confianza 1 la revisión muestra **«Recordado · 3 veces»**. Si la persona
  elige otro producto, la marca desaparece (pasa a «Asociado») y esa elección
  es la que se aprende al confirmar.
- Cada proveedor tiene sus propias equivalencias, y las que apuntan a un
  producto desactivado se ignoran (se vuelve al cálculo de HU15). Las líneas
  agregadas a mano o sin descripción leída no se registran.
- El stock sigue entrando solo con «Confirmar ingreso».

### Comprobantes archivados (HU18)

La pantalla **Comprobantes** (`/comprobantes`, propietario y empleado) lista
todos los comprobantes cargados, del más reciente al más antiguo, con su
estado, el proveedor, la fecha de emisión, quién lo cargó y cuándo, el total
impreso y las unidades ingresadas (si se confirmó).

- Filtros: estado (chips con la cantidad de cada uno: en revisión,
  confirmados, sin leer o leyendo, con error), proveedor, fecha de carga
  (desde/hasta, hora de Argentina) y número. Paginado con «Ver más».
- Cada comprobante abre la pantalla que corresponde: uno **en revisión** se
  retoma en la revisión («Retomar revisión»); uno **confirmado** se ve en
  solo lectura con el archivo original junto a las líneas confirmadas; uno
  sin leer, leyendo o con error abre la lectura con IA.
- Accesos: menú lateral, «Remitos por revisar» en el Inicio (también en el
  celular) y «Ver comprobantes» en la ficha del proveedor.
- `GET /api/comprobantes` devuelve además el conteo por estado (sin aplicar
  el filtro de estado) y el número leído por la IA mientras el definitivo no
  se cargó.

### Movimientos y existencias (HU12)

La pantalla **Movimientos** (`/movimientos`, propietario y empleado) muestra el
historial de entradas, salidas y ajustes, del más reciente al más antiguo y
agrupado por día. Cada movimiento indica el stock antes y después, quién lo
registró y su origen: el comprobante (con enlace a su revisión), la salida o
el ajuste.

- Filtros por producto, tipo (entradas, salidas, ajustes) y rango de fechas
  (días de Argentina, "hasta" inclusivo). Se guardan en la URL.
- Tocar un producto en **Productos** abre su historial. La ficha muestra el
  stock actual, los totales por tipo y si el stock coincide con la suma de
  sus movimientos (criterio de la HU12).
- El propietario ve además si algún producto está descuadrado
  (`GET /api/movimientos/conciliacion`). Se corrige con
  `npm run conciliar-stock -- --aplicar`.
- Es solo lectura: el stock sigue cambiando únicamente en `stock.service.js`.

### Salidas de stock con carrito (HU13)

La pantalla **Nueva salida** (`/salidas`, propietario y empleado) descuenta
varios productos en una sola operación: se buscan por nombre o código (un
lector de códigos que manda Enter los agrega directo), se ajustan las
cantidades y se elige el motivo (venta, consumo interno, rotura, vencimiento
u otro, que exige una observación).

`POST /api/salidas` hace todo en **una sola transacción**: bloquea los
productos, vuelve a validar y crea la `Salida` (origen `CARRITO`) con un
`MovimientoStock` SALIDA/motivo por producto. Si una línea no se puede
descontar, no se descuenta ninguna y responde 400 con el problema de cada
producto.

- No se saca más de lo que hay: el stock de una salida del carrito nunca
  queda negativo, ni con varias cajas vendiendo lo mismo a la vez.
- Unidades y paquetes no se fraccionan. Un producto va una sola vez por salida.
- La app manda un `idOperacion` por carrito. Si el pedido se reenvía (red
  lenta, doble toque), responde 200 con `"repetida": true` y no descuenta de
  nuevo (índice único parcial `uq_salida_carrito_operacion`).
- El carrito se guarda como borrador en la pestaña (`sessionStorage`) hasta
  confirmarlo.
- Las salidas aparecen en **Movimientos** (HU12).

### Ajuste de stock por recuento (HU14)

La pantalla **Recuento** (`/recuento`, propietario y empleado; en el celular se
abre desde **Productos**) registra lo que se contó en el comercio. Se buscan
los productos por nombre o código, se carga la cantidad contada (0 si no hay)
y se ve en el momento la diferencia con el stock del sistema y un resumen
(faltantes, sobrantes, sin diferencia).

`POST /api/recuentos` hace todo en **una sola transacción**: bloquea los
productos en orden de id (como las salidas y la confirmación de ingresos),
vuelve a validar y, por cada producto con diferencia, registra un
`MovimientoStock` AJUSTE/RECUENTO por `contado − registrado` mediante
`stock.service.js`.

- Sin diferencia no se registra movimiento. El movimiento guarda el stock
  anterior: lo contado es `stock_anterior + cantidad`.
- Al agregar un producto, la pantalla lee su stock y su **versión**
  (`GET /api/recuentos/producto/:id`): el id de su último movimiento. Cada
  línea envía ambos (`stockRegistrado`, `ultimoMovimientoId`). Al confirmar,
  con los productos ya bloqueados, si alguno tuvo **cualquier** movimiento
  desde que se leyó (una venta, un ingreso, otro recuento o el mismo recuento
  reenviado), responde 409 con el stock y la versión actuales y no ajusta
  ninguno. Como los ids solo crecen, esto vale aunque el stock haya vuelto al
  mismo valor (por ejemplo: 10 → recuento a 12 → venta de 2 → 10; reenviar el
  recuento no vuelve a sumar). La pantalla toma los valores nuevos para
  revisar el conteo y confirmar de nuevo.
- Garantías: un recuento se aplica una sola vez, nunca pisa movimientos
  posteriores a su lectura y es todo o nada. No hay idempotencia con
  respuesta: si se pierde la respuesta y se reintenta, se recibe el 409 (no
  el resumen original); los ajustes quedan en **Movimientos**.
- Responde 201 si registró algún ajuste y 200 si no había diferencias.
- Mismas reglas que el carrito: hasta 3 decimales y unidades y paquetes
  enteros. Los productos desactivados no se ajustan.
- Los ajustes aparecen en **Movimientos** con el motivo «Recuento» y la
  observación cargada. El borrador se guarda en la pestaña (`sessionStorage`).

### Catálogo: productos, categorías y proveedores (HU4 a HU6)

Solo el propietario administra el catálogo; el backend rechaza los pedidos del
empleado (403) y el frontend no le muestra estas pantallas.

- **Productos** (`/productos`): el + de la barra superior (celular) o «Nuevo
  producto» (escritorio) abre el alta; el lápiz de cada fila, la edición
  (`/productos/:id/editar`). Tocar el producto sigue abriendo sus movimientos.
  El formulario carga nombre, código de barras, categoría, unidad, stock
  mínimo, stock deseado y descripción. El stock actual no se edita: cambia solo
  con entradas, salidas y recuentos.
- **Proveedores** (`/proveedores`): en escritorio, en «Configuración» del menú
  lateral; en el celular, desde **Cuenta**. Listado con búsqueda y filtros
  Activos / Desactivados / Todos, alta y edición.
- No se eliminan: se desactivan y se pueden reactivar. Un producto desactivado
  no aparece en las búsquedas, las salidas ni los recuentos (el chip
  «Desactivados» los muestra); un proveedor desactivado no aparece al cargar
  un comprobante.
- El código de barras y el CUIT no se repiten (409 con un mensaje claro). El
  CUIT se acepta con o sin guiones y se guarda sin ellos. Un campo opcional
  vacío se guarda como `null`, así que dos productos sin código (o dos
  proveedores sin CUIT) no chocan, y vaciarlo en la edición borra el dato.
- La unidad de medida no se puede cambiar si el producto ya tiene movimientos
  (cambiaría el sentido del historial). Una categoría inexistente da 400.
- **Categorías** (`/categorias`, mismos accesos que Proveedores): alta,
  renombrado y eliminación en la misma lista, con la cantidad de productos de
  cada una (abre Productos filtrado). El nombre no se repite aunque cambien
  las mayúsculas («Bebidas» = «bebidas») y los espacios repetidos se reducen
  a uno. Al eliminar una categoría sus productos quedan sin categoría; no se
  borra ninguno. En **Productos**, todos los usuarios pueden filtrar por
  categoría.

### Usuarios (HU3)

La pantalla **Usuarios** (`/usuarios`, solo propietario; en escritorio en
«Configuración» y en el celular desde **Cuenta**) lista quién opera el sistema
con su rol y permite el alta, la edición y la desactivación.

- El correo no se repite y no distingue mayúsculas: se guarda en minúsculas y
  el inicio de sesión acepta «Carlos@…» igual que «carlos@…».
- La contraseña tiene entre 6 y 72 caracteres. Al editar, vacía no se cambia;
  así el propietario puede asignar una nueva si alguien la olvida.
- Un usuario no se elimina: se desactiva y se puede reactivar. Desactivado no
  puede iniciar sesión y, si tenía una sesión abierta, su siguiente pedido
  recibe 401 (el backend relee el usuario en cada pedido).
- El propietario no puede desactivarse ni quitarse el rol desde sus propios
  datos, así el comercio nunca queda sin propietario.

### Valorización de existencias (HU28)

La pantalla **Precios y reportes** (`/precios`, solo el propietario; en el
celular se abre desde **Cuenta**) muestra el valor del stock a precio de
compra (`GET /api/reportes/valorizacion`, lógica en
`backend/src/modules/reportes/reportes.service.js`):

- Se valorizan los productos **activos con stock positivo**: stock × **último
  precio de compra**, el de fecha de vigencia más reciente de cualquier
  proveedor (ante la misma fecha, el registrado último). Los precios se
  guardan al confirmar un remito (HU11).
- El resultado se agrupa **por categoría** (con «Sin categoría»), con su
  porcentaje del total; cada categoría se despliega para ver los productos con
  su stock, último precio, fecha y proveedor.
- Cada producto se redondea a centavos y los totales se suman en centavos: el
  **total coincide exactamente con la suma por categoría**.
- Los productos **con stock y sin precio registrado se informan aparte** y no
  entran en el total. Los productos **con stock negativo** (por ejemplo, ventas
  de la caja de mercadería todavía no ingresada, HU22) también se informan
  aparte y no suman. Los productos sin stock o desactivados no se valorizan.
- El empleado recibe 403: el reporte muestra costos de compra.
- **Lectura consistente:** stock y último precio se leen en una sola sentencia
  SQL, que en PostgreSQL ve una única foto de la base. Un ingreso que se
  confirma mientras tanto entra completo o no entra: nunca stock anterior con
  precio nuevo.


### Sugerencia de reposición y productos sin movimiento (HU27, HU29)

Dos vistas más en **Precios y reportes** (pestañas Valorización · Reposición ·
Sin movimiento; la elegida queda en la URL, `?vista=`). Solo el propietario;
en el Inicio, «Para reponer» → **Ver sugerencia** abre la reposición.

**Reposición** (`GET /api/reportes/reposicion`):
- Entran los productos activos con stock mínimo definido y el stock **en el
  mínimo o por debajo** (el mismo criterio de «stock bajo» del Inicio y
  Productos).
- **Cantidad sugerida = stock deseado − stock actual** (también si el stock es
  negativo); unidades y paquetes se redondean hacia arriba, kilos y litros a 3
  decimales.
- Se agrupa por el **proveedor del último precio de compra** (el mismo
  «último» que la valorización), con el costo estimado a ese precio. Sin
  compras registradas: «Sin proveedor registrado», sin costo.
- Sin stock deseado (o con un deseado que no supera el stock) se informan
  aparte, con un enlace para completarlo en el producto.

**Sin movimiento** (`GET /api/reportes/sin-movimiento?desde=&hasta=`):
- Productos activos con stock **sin ninguna salida** (venta, consumo interno,
  rotura, vencimiento, otro) en el período; los ingresos y los ajustes por
  recuento no cuentan. El período se elige con fechas o con «Últimos 30, 60 o
  90 días»; por defecto, los últimos 30 días con hoy incluido (hora de
  Argentina).
- Cada producto muestra su stock, su valor a último precio de compra (el
  capital inmovilizado) y la fecha de su última salida, o «Nunca tuvo
  salidas». Se ordena por valor; los sin precio van al final y no suman.
- Stock, precio y salidas se leen en una sola sentencia SQL, como la
  valorización.

### Precisión de la lectura (HU19)

**Comprobantes › Precisión de la lectura con IA** (`/comprobantes/precision`,
`GET /api/comprobantes/precision`) compara lo que leyó la IA (columnas
`*_extraido`, que no se modifican) con lo que se confirmó. Lo consultan los
dos roles.

- Solo cuentan los comprobantes **confirmados con lectura de IA**. Cada línea
  del comprobante es **correcta** (se confirmó con la cantidad y el precio
  leídos), **corregida** (cambió la cantidad o el precio), **descartada** (la
  IA leyó un renglón que se descartó) o **agregada a mano** (la IA no la leyó).
- **Precisión = líneas correctas / líneas contadas.** El general suma las
  líneas de todos los comprobantes (no promedia porcentajes).
- **Meta del plan:** 85 % sobre 20 comprobantes. Hasta tener 20 se informa
  cuántos faltan, sin veredicto.
- Las **lecturas simuladas** (`modelo_ia` = `simulado:…`) se listan, marcadas,
  pero no entran en el general ni en la meta.
- La revisión de un comprobante confirmado muestra su propio indicador
  (`precision` en `GET /api/comprobantes/:id`).
- La asociación con el catálogo (HU15) no entra: es local, no de la IA, y la
  propuesta original no se conserva al corregirla.

### Evolución de los precios de compra (HU20)

Pestaña **Evolución de precios** en Precios y reportes (`?vista=precios`).
Solo el propietario.

- **Lista** (`GET /api/reportes/precios?desde=&hasta=`): productos con precios
  de compra en el período, los que **más aumentaron primero**. La variación es
  del primer al último precio del período con el proveedor del último precio.
  Período por defecto: el último año (atajos de 3, 6 y 12 meses o fechas).
- **Detalle** (`GET /api/reportes/precios/:productoId`): gráfico con una línea
  por proveedor y un punto por compra, **ordenados por fecha de vigencia**
  (fecha de emisión del comprobante). El cursor (o las flechas del teclado)
  muestra el precio vigente de cada proveedor en esa fecha.
- **Comparación entre proveedores:** el último precio de cada uno, del más
  barato al más caro, con cuánto más caro es que el más barato y su variación
  en el período. Una tabla con todos los precios complementa el gráfico.
- Gráfico SVG propio (`components/GraficoPrecios.jsx`), sin bibliotecas; la
  variación se indica con flecha y texto, no solo con color.

### Claves de integración (HU21)

La pantalla **Integraciones** (`/integraciones`, solo el propietario; en el
celular se abre desde **Cuenta**) administra las claves con las que un sistema
externo, como la caja del comercio, se autentica ante la API de integración
(lógica en `backend/src/modules/claves/`):

- **Generar:** la clave (`rmt_live_` + 64 caracteres hexadecimales, 256 bits
  aleatorios) se muestra **completa una sola vez**, en la respuesta de
  `POST /api/claves-integracion`. En la base quedan solo su **prefijo** visible
  (`rmt_live_7a5bce`) y su **hash SHA-256** (RNF1). Con 256 bits aleatorios no
  hace falta un hash lento: no hay diccionario que probar, y el hash permite
  buscarla por índice.
- **Usar:** el sistema externo envía `Authorization: Bearer rmt_live_…`. El
  middleware `autenticarIntegracion` valida la clave y registra el **último
  uso** en una sola sentencia (`UPDATE … WHERE hash_clave = … AND activa`). Una
  clave inexistente o revocada recibe el mismo 401. La clave no sirve para la
  API de personas, ni el token de una persona para la de integración.
  `GET /api/v1/integracion/estado` permite comprobar una clave.
- **Revocar:** no se borra; queda con `activa = false` y la fecha de
  revocación, y desde ese momento se rechaza. Repetirlo no cambia la fecha. La
  migración `hu21_claves_integracion` agrega `CHECK chk_clave_revocada`
  (activa ⇔ sin fecha de revocación).
- El empleado recibe 403 en todas las operaciones y no ve la pantalla.

Las comprobaciones de punta a punta están en `backend/e2e/hu21-claves.mjs`
(ver [Pruebas de punta a punta](#pruebas-de-punta-a-punta)).

### Salidas desde un sistema externo (HU22)

La caja del comercio informa cada venta con
`POST /api/v1/integracion/salidas`, autenticada con una clave de HU21. El
**contrato OpenAPI** se publica en `GET /api/v1/integracion/openapi.json`
(público; fuente en `backend/src/modules/integracion/openapi.json`) y la
pantalla Integraciones lo enlaza con un ejemplo.

```json
{ "referencia": "CAJA1-0001-00004512", "fecha": "2026-11-14T18:32:05-03:00",
  "lineas": [{ "codigoBarras": "7790001000012", "cantidad": 2 }, { "productoId": 4, "cantidad": 1.25 }] }
```

- **Mismo servicio que el carrito:** `registrarSalida` (HU13) crea la
  cabecera `Salida` con origen `INTEGRACION`, la clave y la referencia, y un
  movimiento `SALIDA` por producto, sin usuario, en una transacción que bloquea
  los productos en orden de id. Las líneas del mismo producto se suman.
- **Reenvíos:** la referencia es única por clave
  (`@@unique [clave_integracion_id, referencia_externa]`). Cada venta guarda
  su petición normalizada en `salidas.pedido_externo` (migración
  `hu22_pedido_externo`, `CHECK chk_pedido_externo`). Para reconocer un
  reenvío se comparan **las líneas normalizadas con sus identificadores
  originales** (cada `productoId` o `codigoBarras` tal como se envió, con las
  cantidades sumadas y sin importar el orden); **`fecha` no participa**. No se
  consulta el catálogo: el reenvío exacto devuelve la venta original (200,
  `repetida: true`) sin descontar, aunque después se haya cambiado o borrado el
  código de barras o desactivado el producto. Con otras líneas, o con el mismo
  producto identificado de otra forma, 409. Dos envíos simultáneos de la misma
  venta: el segundo choca con el índice único y recibe la del primero. Si se
  cambia de clave, los reenvíos pendientes deben salir con la clave anterior.
- **Stock insuficiente:** la venta ya ocurrió, así que se registra igual; el
  stock queda negativo y la respuesta lo avisa en `advertencias`. La
  valorización (HU28) lista esos productos aparte. El carrito, en cambio, sigue
  rechazando la salida.
- **Atomicidad:** un código de barras desconocido, un producto inexistente o
  desactivado, o una fracción de algo que se vende por unidad rechazan la venta
  entera (400) sin descontar nada.
- **Revocación:** la clave se vuelve a comprobar dentro de la transacción con
  `FOR SHARE`. Una venta en curso termina antes de que la revocación se
  confirme, y ninguna venta entra después.
- **Carga:** las transacciones de salida esperan hasta 10 s una conexión libre
  (`maxWait`); con la espera por defecto (2 s) una ráfaga de ventas sobre los
  mismos productos terminaba en 500. Si aun así no hay conexión, la API
  responde 503 con `Retry-After` (antes, 500), documentado en el contrato.
  Un JSON mal formado ahora da 400, y un cuerpo demasiado grande, 413.
- Las ventas aparecen en Movimientos como «Punto de venta (nombre de la clave)».

### Simulador de ventas (HU23)

`simulador/simulador.mjs` actúa como la caja de un comercio:
- genera ventas aleatorias reproducibles (con semilla) y las informa por
  `POST /api/v1/integracion/salidas` con una clave de integración;
- incluye reenvíos duplicados intencionales, algunos en paralelo con la venta
  original;
- reintenta ante un 503 respetando `Retry-After`;
- al final compara el stock esperado con el registrado.

El esperado se calcula sin mirar las respuestas: enteros en milésimas, cada
referencia una sola vez y los códigos de barras resueltos con el catálogo de
prueba.

```bash
cd backend && npm run e2e -- hu23-simulador
```

Corre contra la base descartable del ejecutor de punta a punta. Con la
configuración por defecto (semilla 2026) son 150 operaciones de salida (120
ventas y 30 reenvíos) y 0 diferencias. Después, un **control negativo
separado** registra a propósito un descuento adicional y exige que el
comparador lo detecte. Detalle en [`simulador/README.md`](simulador/README.md).

### Alertas de stock (HU24)

Cada movimiento de stock avisa a los interesados (patrón Observer,
`src/modules/stock/stock.observadores.js`) dentro de su misma transacción. El
módulo de alertas (`src/modules/alertas/`) se suscribe al crear la app y
recalcula la alerta del producto:

- **Stock negativo** (menor a 0), **sin stock** (0) o **stock bajo** (en el
  mínimo o por debajo, si tiene mínimo). Son las mismas reglas que los
  indicadores del tablero, separando el negativo.
- Un producto tiene a lo sumo una alerta activa. Si cambia de situación, la
  anterior se resuelve y se abre la nueva; si se recupera, se resuelve sola y
  queda en la historia. El índice parcial `uq_alerta_activa` lo respalda en la base.
- Como todo pasa por `registrarMovimiento`, generan alertas los comprobantes,
  el carrito, el recuento y las ventas del endpoint de integración. Crear un
  producto, cambiar su mínimo, desactivarlo o reactivarlo también la recalcula.
- La migración `20261115120000_hu24_alertas_stock` abre las alertas del stock
  que ya estaba bajo; el seed hace lo mismo con sus productos.

Pantalla **Alertas** (campana del Inicio y menú lateral): activas por gravedad,
con su stock y mínimo, y las últimas resueltas. Tocar una abre los movimientos
del producto. La ven el propietario y el empleado.

### Asistente de consultas (HU25)

Pantalla **Asistente** (`/asistente`, solo el propietario; en el celular se
abre desde **Cuenta**). Responde preguntas en castellano sobre el stock
(módulo `backend/src/modules/asistente/` y `backend/src/ia/asistente.js`):

- **El modelo solo interpreta la pregunta.** Devuelve un plan JSON con una de
  las 8 herramientas de lectura habilitadas y sus argumentos. No ve datos del
  comercio. El backend valida la herramienta (otra se rechaza) y los argumentos
  (Zod), la ejecuta en una transacción de solo lectura y arma el texto y la
  tabla o el gráfico **con los datos reales**.
- **Los 8 tipos:**
  1. stock de un producto;
  2. faltantes y alertas;
  3. reposición;
  4. salidas de un producto en un período;
  5. productos con más salidas o más vendidos;
  6. productos sin ventas;
  7. evolución del precio de un producto;
  8. mayores aumentos.
- **Ventas frente a salidas:** «ventas» son solo las salidas con motivo VENTA;
  «salidas», todas (también roturas, vencimientos y consumo interno). Las
  consultas y sus títulos lo dicen. «Sin ventas» incluye productos que solo
  tuvieron otras salidas (a diferencia de HU29, que mira cualquier salida).
- **Períodos:** `{ dias }` o `{ desde, hasta }` en días de Argentina, de hasta
  365 días y sin fechas futuras. «En octubre» o «la semana pasada» se
  consultan tal cual; sin período, 30 días (90 en precios). Un período
  imposible se responde pidiendo precisión, nunca se cambia por otro.
- **Ambigüedad:** si el producto no se encuentra o hay varios, se ofrecen
  opciones. Al elegir, `POST /api/asistente/consultas/:id/eleccion` ejecuta la
  misma herramienta con los mismos argumentos y el mismo período, sin volver a
  llamar al modelo.
- **Límites:**
  - 2 intentos del modelo como máximo, sin reintentos automáticos del SDK, y una herramienta por consulta;
  - hasta 20 filas mostradas, con el total de resultados y los totales calculados sobre el conjunto completo;
  - un presupuesto global de 30 s, compartido entre los intentos y la ejecución. Es el límite de espera; el objetivo de RNF2 es 3 s y falta medirlo con Gemini.
- **Registro:** cada consulta, exitosa, de aclaración o fallida, queda en
  `consultas_agente`, con el planificador (intentos y milisegundos), la
  herramienta (argumentos, filas y milisegundos, o el rechazo) y la duración
  total. Sin migraciones.
- **Proveedor:** Gemini (`planificar` en `gemini.adapter.js`) y un adaptador
  simulado con palabras clave para las pruebas (`IA_SIMULACION`), que en
  producción queda deshabilitado.

### Tablero de situación (HU26)

El **Inicio** se arma con un solo pedido, `GET /api/tablero` (módulo
`backend/src/modules/tablero/`), que trae:
- el resumen de stock (productos en stock, con stock bajo y sin stock);
- las **alertas activas** por tipo y las más graves (HU24);
- los **comprobantes pendientes** por estado: sin leer, leyendo, en revisión y
  con error (los confirmados y anulados no cuentan), con los que esperan
  revisión;
- los productos **para reponer**;
- para el propietario, el **valor del stock** (el mismo cálculo de la
  valorización de HU28). Al empleado no le llega: son costos, y el permiso se
  aplica en el backend.

**Una sola foto de la base:** todo se lee en una transacción `REPEATABLE READ`
de solo lectura. La primera consulta toma la foto y las siguientes ven la
misma, aunque mientras tanto se confirmen movimientos. Por eso los servicios
reutilizados (`productos.resumen` y `productos.listar`, `valorizacion`)
reciben la transacción y las consultas van una detrás de otra. Un único
endpoint o un `Promise.all` de consultas sueltas no alcanzaría: en
`READ COMMITTED` cada consulta ve su propio momento. El escenario
`hu26-tablero` lo demuestra con un recuento confirmado entre dos lecturas.

### Pruebas de punta a punta

`npm test` no usa base de datos. Las comprobaciones contra PostgreSQL
(permisos, SQL, reenvíos y concurrencia) se corren con una base descartable:

```bash
cd backend && npm run e2e -- hu21-claves hu22-salidas hu23-simulador hu26-tablero hu25-asistente
cd backend && npm run e2e -- hu24-alertas   # en una corrida aparte
```

Requiere el PostgreSQL de desarrollo encendido (`docker compose up -d db`).
Crea una base `remitto_e2e_…` con nombre único en ese servidor (solo si
`DATABASE_URL` apunta a localhost), aplica migraciones y seed, levanta la API
en un puerto libre con la IA simulada y borra la base al terminar. No toca la
base de desarrollo.

Antes de enviar cualquier operación, comprueba que la API que responde usa su
base: escribe una marca aleatoria en la base y la busca por la API. Si no la
encuentra, o si el puerto pedido está ocupado, la API cae al arrancar o el nombre
de la base no es de prueba, aborta con código 2 sin correr escenarios. Solo
borra lo que creó. `npm run e2e:aislamiento` verifica estas garantías. Detalle
en [`backend/e2e/README.md`](backend/e2e/README.md).

### Backend en Docker (opcional)

El servicio `backend` usa el perfil `app`, así que `docker compose up -d`
no lo levanta. Monta `backend/uploads` del host en `/app/uploads`: el
backend local y el contenedor usan la misma base **y los mismos archivos**.

```bash
# con la base migrada; si npm run dev ocupa el :4000, usar otro puerto
BACKEND_PORT=4001 docker compose --profile app up -d --build backend
docker compose --profile app stop backend
```

En PowerShell: `$env:BACKEND_PORT='4001'; docker compose --profile app up -d --build backend`.
Para usar otra carpeta del host, definir `UPLOADS_HOST_DIR` en el `.env` de la raíz.

### Despliegue en producción (Coolify)

`docker-compose.prod.yml` levanta la base, el backend y el frontend. Solo el
frontend recibe tráfico: nginx (`frontend/nginx.conf`) sirve la PWA y reenvía
`/api` al backend por la red interna, así que no hace falta CORS entre dominios
ni publicar el puerto de la API. El backend aplica las migraciones al arrancar
(`prisma migrate deploy`); el seed no corre solo.

Requisitos: un VPS con Coolify, un dominio con un registro DNS `A` hacia la IP
del VPS (la PWA solo se instala con HTTPS) y acceso de Coolify al repositorio.

1. En Coolify: **New Resource** → el repositorio → Build Pack **Docker Compose**
   → archivo `docker-compose.prod.yml`.
2. Variables de entorno:

   | Variable | Valor |
   |---|---|
   | `POSTGRES_PASSWORD` | `openssl rand -hex 24` (solo letras y números: va dentro de `DATABASE_URL`) |
   | `JWT_SECRET` | `openssl rand -hex 48` |
   | `CORS_ORIGIN` | `https://<dominio>` |
   | `IA_API_KEY` | clave de Gemini (sin clave, la lectura con IA queda deshabilitada) |

3. Asignar el dominio al servicio **frontend** (puerto 80) y desplegar.
4. Primer usuario: desde la terminal del contenedor `backend` en Coolify,
   `npm run seed`. **Crea los usuarios de prueba con la contraseña
   `remitto123`**: cambiarla enseguida con `PATCH /api/usuarios/:id`
   (`{ "password": "..." }`, sesión de propietario); todavía no hay pantalla.

Datos persistentes en volúmenes: `remitto_pgdata` (base) y `remitto_uploads`
(comprobantes). Coolify no los respalda solo: hay que programar copias de
seguridad de los dos. Dejar una sola instancia del backend, porque los
archivos viven en el disco de ese servidor.

Prueba local de la imagen de producción (el puerto se publica con un archivo
extra, porque en Coolify lo maneja su proxy):

```bash
# override.yml:  services: { frontend: { ports: ["8088:80"] } }
POSTGRES_PASSWORD=prueba123 JWT_SECRET=prueba CORS_ORIGIN=http://localhost:8088 \
  docker compose -p remitto_prueba -f docker-compose.prod.yml -f override.yml up -d --build
```

### Usuarios de prueba (seed)

| Rol | Correo | Contraseña |
|---|---|---|
| Propietario | `carlos@doncarlos.com.ar` | `remitto123` |
| Empleado | `empleado@doncarlos.com.ar` | `remitto123` |

---

## API (endpoints disponibles)

| Método | Ruta | Acceso |
|---|---|---|
| `POST` | `/api/auth/login` | público |
| `GET` | `/api/auth/me` | autenticado |
| `GET/POST/PATCH/DELETE` | `/api/usuarios` | propietario |
| `GET` | `/api/categorias` | autenticado |
| `POST/PATCH/DELETE` | `/api/categorias/:id` | propietario |
| `GET` | `/api/proveedores` | autenticado |
| `POST/PATCH/DELETE` | `/api/proveedores/:id` | propietario |
| `GET` | `/api/productos` · `?q=&estado=&categoriaId=` | autenticado |
| `GET` | `/api/productos/resumen` | autenticado |
| `POST/PATCH/DELETE` | `/api/productos/:id` | propietario |
| `POST` | `/api/comprobantes` (multipart: `archivo`, `proveedorId`, `tipo?`) | autenticado |
| `GET` | `/api/comprobantes` · `?proveedorId=&estado=&desde=&hasta=&numero=&pagina=&limite=` (HU18) | autenticado |
| `GET` | `/api/comprobantes/precision` (lectura de la IA contra lo confirmado) (HU19) | autenticado |
| `GET` | `/api/comprobantes/:id` · `/api/comprobantes/:id/archivo` | autenticado |
| `POST` | `/api/comprobantes/:id/procesar` (202; lectura con IA) | autenticado |
| `GET` | `/api/comprobantes/:id/estado` (progreso de la lectura) | autenticado |
| `PATCH` | `/api/comprobantes/:id/cabecera` · `/api/comprobantes/:id/detalles/:detalleId` (borrador de revisión) | autenticado |
| `POST` | `/api/comprobantes/:id/detalles` (línea manual) · `/api/comprobantes/:id/validar` (no confirma) | autenticado |
| `POST` | `/api/comprobantes/:id/confirmar` (ingreso al stock; repetirlo da 409) | autenticado |
| `GET` | `/api/movimientos` · `?productoId=&tipo=&desde=&hasta=&pagina=&limite=` | autenticado |
| `GET` | `/api/movimientos/conciliacion` (productos con stock descuadrado) | propietario |
| `POST` | `/api/salidas` (carrito; 201, o 200 con `repetida` si se reenvía) | autenticado |
| `GET` | `/api/salidas` · `?limite=` · `/api/salidas/:id` | autenticado |
| `GET` | `/api/recuentos/producto/:id` (stock y versión para el recuento) | autenticado |
| `POST` | `/api/recuentos` (201 con ajustes, 200 sin diferencias, 409 si hubo movimientos desde la lectura) | autenticado |
| `GET` | `/api/reportes/valorizacion` (valor del stock a último precio de compra, por categoría) | propietario |
| `GET` | `/api/reportes/precios` · `?desde=&hasta=` · `/api/reportes/precios/:productoId` (evolución de precios de compra) (HU20) | propietario |
| `GET` | `/api/reportes/reposicion` (qué pedir y cuánto, por último proveedor) (HU27) | propietario |
| `GET` | `/api/reportes/sin-movimiento` · `?desde=&hasta=` (productos con stock sin salidas) (HU29) | propietario |
| `GET` | `/api/alertas` (activas por gravedad, totales por tipo y últimas resueltas) (HU24) | autenticado |
| `POST` | `/api/asistente/consultas` (pregunta en castellano; respuesta con tabla o gráfico, aclaración o error registrado) (HU25) | propietario |
| `POST` | `/api/asistente/consultas/:id/eleccion` (elige el producto de una aclaración; misma consulta, sin volver al modelo) (HU25) | propietario |
| `GET` | `/api/asistente/consultas` · `?limite=` (historial de consultas) (HU25) | propietario |
| `GET` | `/api/tablero` (resumen de stock, alertas activas, comprobantes pendientes, para reponer y, solo para el propietario, valor del stock; una sola foto de la base) (HU26) | autenticado |
| `GET/POST` | `/api/claves-integracion` (listado; alta con la clave completa una sola vez) (HU21) | propietario |
| `DELETE` | `/api/claves-integracion/:id` (revoca; no borra) (HU21) | propietario |
| `GET` | `/api/v1/integracion/estado` (comprueba la clave) (HU21) | clave de integración |
| `POST` | `/api/v1/integracion/salidas` (venta del punto de venta; 201, 200 si se reenvía, 409 si la referencia ya se usó con otro contenido) (HU22) | clave de integración |
| `GET` | `/api/v1/integracion/openapi.json` (contrato OpenAPI de la integración) (HU22) | público |

---

## Sistema de diseño

Definido en `frontend/src/styles/tokens.css` a partir de la Guía de estilo
de la maqueta. Tipografía **Plus Jakarta Sans**. La paleta, la escala
tipográfica y el mapa de pantallas están en la
[guía de maquetación](docs/maquetacion.md).
