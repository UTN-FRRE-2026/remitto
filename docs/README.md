# Documentación — Remitto

| Archivo | Uso |
| --- | --- |
| [Primera entrega del TPI](entrega-tpi.md) | Consigna de la profesora para el 16/11/2026, puntaje y estado de cada entregable |
| [Estado y continuidad](estado-proyecto.md) | Última fotografía verificada, avance por historia y pendientes |
| [Lista de requerimientos](requerimientos.md) | RF, RNF y requerimientos técnicos con la HU que los implementa y su estado |
| [Diseño de la base de datos](base-de-datos.md) | Diagrama entidad-relación, tablas, relaciones y restricciones (generado con `npm run doc-bd`) |
| [Plan de trabajo](plan-de-trabajo.md) | Alcance, RF/RNF, arquitectura propuesta, proceso y las 31 HU con tareas y criterios de aceptación |
| [Guía de maquetación](maquetacion.md) | Sistema visual y mapa de pantallas |
| [Maquetación HTML](referencias/maquetacion.html) | Maqueta estática completa; abrir en un navegador |
| [Instrucciones para Claude Code](../CLAUDE.md) | Acuerdos compartidos y contexto estable |

El arranque, el detalle de cada HU implementada y la API están en el [README principal](../README.md). El modelo de datos efectivo (13 tablas) está en `backend/prisma/schema.prisma`; [base-de-datos.md](base-de-datos.md) se genera desde ahí.

Un plan, una maqueta o un resumen no prueban qué está implementado: comprobalo en el código y en Git.

## Documentación prevista

Todavía no existen:

- `openapi.yaml`: contrato del endpoint de integración con el punto de venta (RF5.2, HU22).
- Manual de usuario (etapa de cierre).
