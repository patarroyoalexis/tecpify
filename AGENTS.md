# AGENTS.md

## Propósito

Este repo usa este archivo como base de vigilancia de consistencia. La prioridad no es inventar abstracciones nuevas, sino evitar que el MVP siga acumulando nombres, payloads y validaciones incompatibles entre capas.

## Principios

- Una idea debe tener un nombre canónico por capa.
- El nombre de la UI puede diferir del nombre de base de datos, pero la conversión debe ser explícita y localizada.
- No mezclar `snake_case` y `camelCase` dentro del mismo contrato público.
- No agregar nuevas variables de entorno fuera del módulo central de entorno.
- No leer `process.env` directamente fuera del módulo central de entorno.

## Nombres canónicos actuales

### Negocio

- En dominio, props, hooks, payloads internos y tipos de frontend usar `businessSlug`.
- En parámetros de ruta de App Router se permite `negocioId` por compatibilidad con la estructura actual de carpetas.
- No introducir `negocioSlug` como nuevo nombre de variable. Si aparece, renombrar a `businessSlug` al tocar esa zona.

### Pedidos

- En dominio y frontend usar `status`, `paymentStatus`, `deliveryType`.
- En base de datos o payloads crudos de Supabase usar `payment_status`, `delivery_type`.
- La traducción entre ambas formas debe vivir en mappers o adaptadores, no repartida por componentes.

### Productos

- Usar `productId` en dominio, formularios, payloads API y tipos TypeScript.
- Reservar `id` para el identificador persistido del registro cuando ya se está trabajando con una entidad completa.

## Reglas para payloads y mappers

- Los componentes no deben conocer columnas de Supabase como `payment_status` o `delivery_type`.
- Las rutas API pueden aceptar payloads de compatibilidad solo si un mapper los normaliza de inmediato.
- Si una API expone `camelCase`, mantener `camelCase` en todo el contrato.
- Si se necesita compatibilidad temporal con `snake_case`, documentarla en el mapper y no expandirla a nuevas capas.

## Reglas para tipos y props

- Si un tipo representa estado de UI o dominio, usar `camelCase`.
- Si un tipo representa una fila cruda de base de datos, puede usar nombres reales de la tabla.
- Si una prop recibe un slug de negocio, el nombre preferido es `businessSlug`.
- Si una prop recibe una fila o entidad completa, usar un nombre semántico como `business`, `order` o `product`.

## Variables de entorno

- Toda lectura de entorno debe pasar por `lib/env.ts`.
- Variables públicas permitidas:
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
  - `NEXT_PUBLIC_SITE_URL`
- Variables de servidor permitidas:
  - `SUPABASE_SERVICE_ROLE_KEY`
- Si una nueva variable es necesaria:
  1. declararla en `lib/env.ts`
  2. validarla allí
  3. documentarla en `README.md`
  4. usarla desde el módulo central, no con `process.env` directo

## Qué hacer antes de tocar contratos

- Revisar si ya existe un mapper para esa frontera.
- Revisar si el nombre nuevo choca con una convención ya fijada aquí.
- Preferir protección y normalización local antes que refactor masivo.
- Si hace falta una migración de nombres amplia, dejarla como tarea separada y no mezclarla con cambios funcionales.

## Checklist rápido al abrir un cambio

- ¿La prop usa el nombre canónico de esta capa?
- ¿El payload usa una sola convención de nombres?
- ¿La conversión a nombres de base de datos ocurre en un punto claro?
- ¿El tipo refleja dominio o fila cruda?
- ¿La variable de entorno sale de `lib/env.ts`?
- ¿El cambio agrega una inconsistencia nueva aunque arregle otra?
