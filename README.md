# 🧾 Remitto

Sistema de gestión de stock para comercios minoristas de cercanía, con carga
automática de comprobantes de compra mediante Inteligencia Artificial.

> Trabajo Final Integrador 2026 — Tecnicatura Universitaria en Programación,
> UTN Facultad Regional Resistencia.
> Agostina Jara · Ivan Sanchez · Maximiliano Stabile.

---

## Estado actual

Arranque del proyecto (Sprint 1 en curso). Ya implementado:

| Requerimiento | Historias | Estado |
|---|---|---|
| **RF1** Usuarios y acceso | HU1 (login), HU2 (roles), HU3 (admin usuarios) | ✅ Backend |
| **RF2** Catálogo | HU4 (productos), HU5 (categorías), HU6 (proveedores) | ✅ Backend |
| **RNF4** PWA móvil | HU7 (instalable) | ✅ Base |
| **RF3** Ingesta de comprobantes | HU8 (carga), HU9 (lectura con IA), HU10 (revisión) | ✅ Backend y pantallas M3/M4/M5 |
| Frontend | Login, Tablero, Productos, Cargar remito, Lectura con IA, Revisar remito | ✅ Vistas base |

Pendiente del flujo de ingreso: **HU11** (confirmar el ingreso y generar las
entradas de stock). El resto del backlog (salidas, integración,
alertas, agente, reportes) se incorpora en las historias siguientes.

---

## Arquitectura

Cliente-servidor en capas (ver Plan de Trabajo):

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
  La edición y la confirmación llegan con HU10.
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
  posible duplicado). Si está todo, muestra "Datos completos. La confirmación
  del ingreso estará disponible en la próxima entrega". **No marca el
  comprobante como CONFIRMADO ni modifica el stock.**

**Pendiente para HU11:** endpoint de confirmación en una sola transacción
(re-validar, `EN_REVISION → CONFIRMADO` de forma idempotente, líneas
`CONFIRMADO`, `MovimientoStock` de entrada con bloqueo `FOR UPDATE`,
`PrecioCompra` para las líneas con precio, `confirmadoPor`/`confirmadoEn`),
CHECK de RNF5 para líneas confirmadas, el botón "Confirmar ingreso" y la
corrección del seed (stock = suma de movimientos).

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
- No hay asociación automática al catálogo (HU15). La confirmación del ingreso es HU11.

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
| `GET` | `/api/comprobantes/:id` · `/api/comprobantes/:id/archivo` | autenticado |
| `POST` | `/api/comprobantes/:id/procesar` (202; lectura con IA) | autenticado |
| `GET` | `/api/comprobantes/:id/estado` (progreso de la lectura) | autenticado |
| `PATCH` | `/api/comprobantes/:id/cabecera` · `/api/comprobantes/:id/detalles/:detalleId` (borrador de revisión) | autenticado |
| `POST` | `/api/comprobantes/:id/detalles` (línea manual) · `/api/comprobantes/:id/validar` (no confirma) | autenticado |

---

## Sistema de diseño

Definido en `frontend/src/styles/tokens.css` a partir de la Guía de estilo
de la maqueta. Tipografía **Plus Jakarta Sans**. Paleta:

| Color | Hex | Uso |
|---|---|---|
| Crema | `#F2E9D8` | Fondo general |
| Oscuro | `#2E2528` | Textos y menú lateral |
| Verde salvia | `#A7B6A0` | Estados positivos |
| Verde salvia oscuro | `#4E6A4B` | Botones y navegación activa |
| Dorado | `#D4B56A` | Advertencias / para revisar |
| Rojo | `#A60321` | Sin stock, errores |
| Azul grisáceo | `#8298A3` | Inteligencia Artificial |
