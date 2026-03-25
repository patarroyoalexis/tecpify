## Agente guardian de consistencia del MVP

Cada vez que se termine una tarea, ejecutar una auditoria obligatoria antes de cerrarla. El objetivo no es solo validar que compile: hay que revisar contratos, persistencia, ownership, naming y fronteras client/server segun el estado real del repo.

## 1. Objetivo del guardian

Verificar que el cambio recien hecho no rompa:

- contratos publicos
- naming canonico
- ownership y acceso
- persistencia real en Supabase
- separacion client/server
- reglas de negocio de pedidos, pagos, catalogo y dashboard

No cerrar una tarea solo porque "se ve bien" o porque `build` paso.

## 2. Alcance de auditoria obligatoria

Ejecutar siempre esta revision si la tarea toca:

- auth o sesion
- negocios u ownership
- catalogo / productos
- storefront publico
- pedidos
- dashboard, pedidos o metricas
- Supabase, RLS o migraciones
- contratos API
- mappers
- variables de entorno
- componentes client con acceso a datos o mutaciones

Si una tarea toca solo copy o estilos, igual revisar imports, contratos, efectos colaterales y si la UI sigue representando fielmente el estado real.

## 3. Estado real que el guardian debe asumir

Tecpify hoy funciona como MVP operativo con estas bases:

- Supabase es la fuente de verdad para negocios, productos y pedidos.
- `localStorage` solo se usa para estado visual del workspace de pedidos.
- `SUPABASE_SERVICE_ROLE_KEY` no tiene usos activos permitidos en runtime normal.
- el ownership real depende de `businesses.created_by_user_id`
- negocios legacy sin owner estan bloqueados en privado y en publico
- el parametro de ruta `[negocioId]` contiene un slug, no un UUID de base de datos
- `status` y `paymentStatus` son conceptos separados y no deben colapsarse en una sola frontera

## 4. Naming canonico vigente

### Negocios

- Canonico en dominio y frontend: `businessSlug`
- Canonico en base de datos: `business_id`
- Ownership en base: `created_by_user_id`
- `negocioId` en rutas App Router es compatibilidad heredada y debe tratarse como slug

### Pedidos

- Payload canonico de creacion:
  - `businessSlug`
  - `customerName`
  - `customerWhatsApp`
  - `deliveryType`
  - `deliveryAddress`
  - `paymentMethod`
  - `products`
  - `total`
  - `status`
  - `paymentStatus`
  - `dateLabel`
  - `notes`
  - `isReviewed`
  - `history`
- En dominio/frontend: `paymentStatus`
- En base: `payment_status`
- En dominio/frontend: `isReviewed`
- En base: `is_reviewed`
- En dominio/frontend: `orderCode`
- En base: `order_code`

Regla:

- no introducir nuevas fronteras publicas mezclando `snake_case` y `camelCase`
- `payment_status` solo se tolera hoy en normalizacion de update payload por compatibilidad; no es el canon para frontend nuevo

### Productos

- Canonico en dominio/API: `isAvailable`, `isFeatured`, `sortOrder`
- Canonico en base: `is_available`, `is_featured`, `sort_order`

## 5. Variables de entorno vigentes

Las variables reales del proyecto hoy son:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `NEXT_PUBLIC_SITE_URL`
- `SUPABASE_SERVICE_ROLE_KEY` opcional y desactivada para flujos normales

Reglas:

- toda lectura de `process.env` debe centralizarse en `lib/env.ts`
- para URLs absolutas de auth usar `lib/site-url.ts`
- `lib/runtime.ts` solo sirve para checks minimos de runtime, no para auth ni acceso a datos
- si aparece una variable nueva, debe documentarse en `README.md`, `.env.example` y este archivo

## 6. Reglas client/server

### Server-only

No importar dentro de componentes client:

- `lib/env.ts`
- `lib/supabase/server.ts`
- `lib/auth/server.ts`
- helpers que lean cookies, headers o `process.env`

### Client-safe

Se pueden usar en client:

- `lib/runtime.ts`
- helpers puros de UI
- clientes API del frontend como `lib/orders/api.ts` o `lib/products/api.ts`

### Fuente de verdad

- nunca reintroducir mocks o `localStorage` como fuente de verdad para pedidos, productos o negocios
- si hay estado local optimista o de UI, debe reconciliarse contra API / Supabase
- cualquier exito visual sin persistencia real es regresion

## 7. Cosas obsoletas o que no deben reintroducirse

- usos operativos nuevos de `SUPABASE_SERVICE_ROLE_KEY` sin inventario en `lib/supabase/service-role.ts`
- fallback admin para ownership o lecturas de acceso ya cubiertas por RLS
- tratar `negocioId` como id real de base de datos
- mezclar `paymentStatus` y `status` en una sola accion o badge
- leer `process.env` fuera de `lib/env.ts`
- usar `localStorage` para guardar pedidos, productos, auth o metricas como verdad del sistema
- afirmar que `getBusinessByIdWithProducts` trabaja por id real: hoy resuelve por slug y existe por compatibilidad

## 8. Checklist minimo antes de aceptar cambios

### 1. Revisar archivos modificados

Detectar si el cambio toco:

- naming canonico
- payloads publicos
- mappers
- Supabase o RLS
- auth / ownership
- reglas client/server
- variables de entorno
- uso de `localStorage`
- flujos criticos del MVP

### 2. Detectar regresiones tipicas

Buscar explicitamente:

- exito visual sin persistencia real
- fallback silencioso a estado local
- mezcla nueva de `snake_case` y `camelCase` en fronteras publicas
- import server-only dentro de componente client
- lectura directa de `process.env`
- nueva dependencia de service role
- ownership relajado o acceso indebido
- storefront publico roto por cambios en negocio o catalogo
- pedido que avanza sin respetar pago
- metricas leyendo datos no persistidos

### 3. Validacion tecnica minima

Siempre ejecutar:

- `npm run lint`
- `npm run typecheck`
- `npm run build`
- tests existentes relacionados con el area tocada

Hoy las pruebas existentes relevantes son:

- `tests/orders-api.test.cjs`
- `tests/order-transitions.test.cjs`

Si la tarea toca auth, negocios o catalogo y no hay tests dedicados, decirlo explicitamente en el cierre.

### 4. Revisión funcional minima por circuito

Si la tarea toca circuito critico, revisar tambien:

- negocio y ownership
- catalogo y activacion de productos
- link publico
- creacion de pedido
- lectura en workspace
- actualizacion de pedido y pago
- metricas si dependen del cambio

## 9. Criterios para clasificar hallazgos

- Critico: rompe persistencia, seguridad, ownership o contratos base
- Alto: rompe un flujo funcional real o deja una regresion muy probable
- Medio: inconsistencia de naming, mapper, client/server, warning funcional o deuda cercana
- Bajo: deuda documental, copy, limpieza, warning no bloqueante o detalle menor

## 10. Regla de honestidad

- nunca afirmar que algo esta listo solo porque compilo
- nunca afirmar que un flujo esta estable si no fue revisado contra persistencia y contratos
- si algo no pudo verificarse, decirlo
- si la documentacion y el codigo se contradicen, gana el codigo y debe corregirse la documentacion

## 11. Formato obligatorio del informe de cierre

Siempre cerrar con:

- Archivos modificados
- Verificaciones ejecutadas
- Hallazgos
- Riesgos detectados
- Inconsistencias corregidas
- Pendientes no bloqueantes
- Veredicto final

Veredictos permitidos:

- APTO PARA REVISAR
- APTO CON ALERTAS
- NO APTO TODAVIA

## 12. Regla de correccion inmediata

Si durante la auditoria aparece una inconsistencia clara introducida por el mismo cambio:

- corregirla antes de cerrar si el alcance es pequeno y directo
- si requiere refactor mayor, no improvisar: reportarla como riesgo o pendiente bloqueante

## 13. Recomendaciones accionables que el guardian debe seguir promoviendo

### UI

- seguir reduciendo densidad visual del workspace agrupando acciones secundarias
- reforzar separacion visual entre estado del pedido y estado del pago en cualquier vista nueva

### UX

- dejar claro el siguiente paso recomendado cuando el negocio aun no tiene primer pedido
- distinguir mejor error de persistencia vs error de resincronizacion

### Funcional

- mantener bloqueados los negocios sin owner hasta que exista migracion controlada
- evitar cualquier UI que sugiera capacidades no persistidas, como clientes recurrentes o pagos automatizados

### Tecnica

- migrar `middleware.ts` a `proxy`
- ampliar cobertura automatizada del circuito critico de pedidos
- mover cada vez mas trazabilidad minima del pedido al servidor cuando el cambio lo justifique
