# 🧾 Remitto

Sistema de gestión de stock para comercios minoristas de cercanía, con carga
automática de comprobantes de compra mediante Inteligencia Artificial.

> Trabajo Final Integrador 2026 — Tecnicatura Universitaria en Programación,
> UTN Facultad Regional Resistencia.
> Agostina Jara · Ivan Sanchez · Maximiliano Stabile.

---

## Estado actual

Están implementadas las historias del Sprint 1 (HU1 a HU14) y, del
Sprint 2, HU15 y HU18. La aplicación está desplegada en producción con Coolify, a partir
de `main`. La instalación de la PWA en Android (HU7) todavía no se probó.

Ya implementado:

| Requerimiento | Historias | Estado |
|---|---|---|
| **RF1** Usuarios y acceso | HU1 (login), HU2 (roles), HU3 (admin usuarios) | ✅ Backend y pantallas |
| **RF2** Catálogo | HU4 (productos), HU5 (categorías), HU6 (proveedores) | ✅ Backend y pantallas |
| **RNF4** PWA móvil | HU7 (instalable) | ✅ Base |
| **RF3** Ingesta de comprobantes | HU8 (carga), HU9 (lectura con IA), HU10 (revisión), HU11 (entradas de stock), HU15 (asociación automática), HU18 (comprobantes archivados) | ✅ Backend y pantallas M3/M4/M5 y Comprobantes |
| **Existencias** | HU12 (movimientos y existencias) | ✅ Backend y pantalla Movimientos |
| **Salidas** | HU13 (carrito de salida) | ✅ Backend y pantalla Nueva salida |
| **Recuento** | HU14 (ajuste por recuento) | ✅ Backend y pantalla Recuento |
| Frontend | Login, Tablero, Comprobantes, Productos (alta y edición), Proveedores, Categorías, Usuarios, Cargar remito, Lectura con IA, Revisar remito, Movimientos, Nueva salida, Recuento | ✅ Vistas base |

Están completos el flujo de ingreso (cargar → leer con IA → revisar →
confirmar), el de salida (carrito → confirmar) y el recuento (contar →
ajustar). Cada movimiento queda en el historial de Movimientos.
El resto del backlog (integración, alertas, agente, reportes) se incorpora en las historias siguientes.

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
  repite por proveedor y tipo (`@@unique`): si ya existe responde 409.
- Las correcciones se guardan como borrador al salir de cada campo. Lo leído por
  la IA (columnas `*Extraido` y `respuesta_ia`) nunca se modifica.
- **"Validar datos"** informa si falta algo (producto, cantidad > 0, número,
  al menos una línea) y muestra avisos (sin precio, sin fecha, total distinto,
  posible duplicado). No modifica nada; si está todo, habilita "Confirmar ingreso".

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
- Los comprobantes leídos antes de HU15 no tienen propuestas. Las equivalencias
  aprendidas por proveedor son de HU16.
- Rendimiento medido con catálogos sintéticos y 40 líneas: 0,3 s con 1.000
  productos y 1,8 s con 5.000. El cálculo es síncrono y no entra en la medición
  de tiempo del RNF2.
- Al corregir una propuesta no se conserva cuál había sido (el producto y la
  confianza se reemplazan). Si HU19 necesita medir los aciertos de la
  asociación, hará falta guardarla aparte.

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

---

## Sistema de diseño

Definido en `frontend/src/styles/tokens.css` a partir de la Guía de estilo
de la maqueta. Tipografía **Plus Jakarta Sans**. La paleta, la escala
tipográfica y el mapa de pantallas están en la
[guía de maquetación](docs/maquetacion.md).
