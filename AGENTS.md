# AGENTS.md

## Proposito

Este archivo existe para vigilar consistencia funcional y contractual del MVP.

La prioridad no es crear abstracciones nuevas. La prioridad es evitar que Tecpify vuelva a mezclar nombres, payloads, reglas de acceso y fuentes de verdad entre cliente, servidor y Supabase.

## Principios

- Una idea debe tener un nombre canonico por capa.
- Supabase es la fuente de verdad para negocios, productos y pedidos.
- `localStorage` solo puede guardar estado de UI no critico.
- No mezclar `snake_case` y `camelCase` dentro del mismo contrato publico.
- No agregar nuevas variables de entorno fuera del modulo central.
- No leer `process.env` directamente fuera de `lib/env.ts`.
- Un modulo client no debe importar un modulo que tambien contenga lecturas server de entorno o helpers server-only.

## Variables de entorno vigentes

### Publicas permitidas

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `NEXT_PUBLIC_SITE_URL`

### Servidor permitidas

- `SUPABASE_SERVICE_ROLE_KEY`

### Reglas

- Toda lectura de entorno vive en [lib/env.ts](C:/Users/Alexis/Documents/tecpify/lib/env.ts).
- Si un componente client necesita una comprobacion minima de runtime, usar [lib/runtime.ts](C:/Users/Alexis/Documents/tecpify/lib/runtime.ts) o un helper similar separado.
- No reintroducir `AUTH_SESSION_SECRET`. Hoy no existe como variable real del proyecto.
- Si aparece una variable nueva:
  1. declararla en `lib/env.ts`
  2. validarla alli
  3. documentarla en `README.md`
  4. agregarla a `.env.example`

## Nombres canonicos actuales

### Negocio

- En dominio, hooks, props y payloads internos usar `businessSlug`.
- En params de App Router se permite `negocioId` por compatibilidad con la estructura actual de carpetas.
- No introducir `negocioSlug` como nombre nuevo.
- `businessId` se reserva para el id persistido de base de datos.

### Pedidos

- En dominio y frontend usar `status`, `paymentStatus`, `deliveryType`.
- En base de datos y payloads crudos de Supabase usar `payment_status`, `delivery_type`, `is_reviewed`.
- La traduccion entre ambas formas debe vivir en mappers o adaptadores.
- En frontend y dominio usar `productId`.
- En entidades de pedido usar `client`, `customerPhone`, `address`, `observations`.
- En payloads API de pedidos usar `customerName`, `customerWhatsApp`, `deliveryAddress`, `notes`.

### Productos

- Usar `productId` en dominio, formularios y payloads API.
- Reservar `id` para el registro persistido completo.

## Reglas de mappers y payloads

- Los componentes no deben conocer columnas de Supabase como `payment_status` o `delivery_type`.
- Si una API expone `camelCase`, mantener `camelCase` en todo el contrato publico.
- Si una API necesita compatibilidad temporal con `snake_case`, normalizar de inmediato en el mapper y no expandir esa compatibilidad a mas capas.
- El punto actual de normalizacion principal para pedidos es [lib/orders/mappers.ts](C:/Users/Alexis/Documents/tecpify/lib/orders/mappers.ts).

## Reglas client / server

- Los componentes client no deben importar:
  - `lib/env.ts`
  - `lib/supabase/server.ts`
  - helpers server-only de auth
- Los componentes client pueden importar:
  - `lib/runtime.ts`
  - clientes API del browser
  - tipos y helpers puros sin lecturas de entorno
- Las rutas API deben validar acceso y normalizar payloads antes de tocar Supabase.
- Las pages privadas pueden usar middleware para UX, pero la validacion real debe seguir ocurriendo en servidor.

## Reglas funcionales vigentes

- Negocios, productos y pedidos deben persistirse en Supabase.
- El dashboard debe leer pedidos desde servidor o API real, no desde mocks ni `localStorage`.
- Si una mutacion persiste pero falla la resincronizacion, la UI debe comunicarlo como warning y no como perdida silenciosa.
- Si un flujo publico depende de `SUPABASE_SERVICE_ROLE_KEY`, esa dependencia debe quedar explicita en `README.md` y `lib/env.ts`.

## Criterios para detectar regresiones funcionales

Considera regresion cualquier cambio que haga una de estas cosas:

- Confirmar exito visual cuando la mutacion real fallo.
- Hacer que pedidos o productos vuelvan a depender de estado local como fuente de verdad.
- Exponer secretos o helpers server-only al cliente.
- Mezclar nombres de contrato dentro de la misma capa.
- Hacer que el workspace privado dependa solo de middleware y no de validacion server.
- Volver a introducir variables de entorno no documentadas o no centralizadas.

## Obsoletos o cosas que ya no se deben usar

- `AUTH_SESSION_SECRET`
- lectura directa de `process.env` fuera de `lib/env.ts`
- usar `localStorage` para guardar pedidos como fuente de verdad
- introducir `negocioSlug` como nombre nuevo
- importar `lib/env.ts` desde componentes client
- tratar `id` como sinonimo universal de `productId` en payloads

## Que revisar antes de tocar contratos o persistencia

- Revisar si ya existe un mapper para esa frontera.
- Revisar si la capa actual ya tiene un nombre canonico definido.
- Revisar si el cambio toca una ruta API, un mapper y una vista que deban evolucionar juntas.
- Preferir normalizacion local y explicita antes que refactor masivo.
- Si hace falta una migracion de naming amplia, separarla de los cambios funcionales.

## Checklist minimo antes de aceptar cambios

- La prop o variable usa el nombre canonico de esta capa.
- El payload usa una sola convencion de nombres.
- La conversion a nombres de base de datos ocurre en un punto claro.
- La funcionalidad critica sigue persistiendo en Supabase.
- `localStorage` no se usa como verdad principal.
- Ningun modulo client importa helpers server-only o entorno central.
- Las variables de entorno nuevas salen de `lib/env.ts` y estan documentadas.
- El cambio no agrega una inconsistencia nueva aunque arregle otra.
