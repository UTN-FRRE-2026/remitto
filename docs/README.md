# Documentación — Remitto

| Archivo | Uso |
| --- | --- |
| [Estado y continuidad](estado-proyecto.md) | Última fotografía verificada, avance por historia y pendientes |
| [Plan de trabajo](plan-de-trabajo.md) | Alcance, RF/RNF, arquitectura propuesta, proceso y las 31 HU con tareas y criterios de aceptación |
| [Guía de maquetación](maquetacion.md) | Sistema visual y mapa de pantallas |
| [Maquetación HTML](referencias/maquetacion.html) | Maqueta estática completa; abrir en un navegador |
| [Instrucciones para Claude Code](../CLAUDE.md) | Acuerdos compartidos y contexto estable |

El arranque, el detalle de cada HU implementada y la API están en el [README principal](../README.md). El modelo de datos efectivo (13 tablas) está en `backend/prisma/schema.prisma`.

Un plan, una maqueta o un resumen no prueban qué está implementado: comprobalo en el código y en Git.

## Documentación prevista

Todavía no existen:

- `der-remitto.svg`: diagrama entidad-relación generado desde Prisma. El índice original proponía habilitar un `generator erd` en `schema.prisma` con `prisma-erd-generator` y `@mermaid-js/mermaid-cli`; evaluar esas dependencias cuando se haga.
- `openapi.yaml`: contrato del endpoint de integración con el punto de venta (RF5.2, HU22).
- Manual de usuario (etapa de cierre).
