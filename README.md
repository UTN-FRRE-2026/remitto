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
| Frontend | Login, Tablero, Productos | ✅ Vistas base |

El resto del backlog (ingesta con IA, stock, salidas, integración, alertas,
agente, reportes) se incorpora en las historias siguientes.

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
