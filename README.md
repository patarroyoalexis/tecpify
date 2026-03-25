# Tecpify

## 1. Que es Tecpify hoy

Tecpify es un MVP para pequenos negocios que concentra cuatro piezas conectadas:

- un link publico por negocio para recibir pedidos
- un workspace privado para operar pedidos y catalogo
- persistencia real en Supabase para negocios, productos y pedidos
- metricas operativas simples calculadas sobre pedidos persistidos

Hoy no es un ERP ni un backoffice completo. El producto esta evaluando si un negocio pequeno puede crear su negocio, publicar productos, recibir pedidos reales y operarlos desde una sola app sin depender de hojas de calculo o chat manual como fuente de verdad.

## 2. Objetivo actual del MVP

El objetivo actual del MVP es cerrar este circuito real:

`negocio -> catalogo -> link publico -> pedido -> operacion interna -> metricas basicas`

El MVP se considera valioso solo si ese circuito funciona con datos persistidos y sin depender de mocks o estado local para la operacion critica.

## 3. Alcance real implementado

- Registro, login y confirmacion por email con Supabase Auth SSR.
- Creacion de negocios reales por usuario autenticado.
- Catalogo real por negocio con activacion, destacado, reordenamiento y borrado validado.
- Link publico por negocio para crear pedidos reales.
- Persistencia real de pedidos en Supabase.
- Lectura server-first de pedidos en dashboard, pedidos y metricas.
- Actualizacion real de estado de pedido, estado de pago, historial e indicador de revision.
- Metricas operativas basicas calculadas desde pedidos persistidos.

Fuera del alcance real actual:

- roles y multiusuario por negocio
- sistema formal de clientes
- pagos automaticos
- webhooks e integraciones externas
- inventario, variantes, imagenes y categorias
- reporting historico o BI formal
- modo offline o cola de reintentos

## 4. Estado funcional por modulos

### Autenticacion / sesion

- Estado: verde
- Que hace hoy realmente:
  - registro y login con Supabase Auth
  - confirmacion por email por `/auth/callback`
  - sesion SSR con cookies de Supabase
  - proteccion de pages y APIs privadas
- Limitaciones:
  - no hay roles
  - no hay colaboracion multiusuario por negocio
  - el middleware es una ayuda de UX, no la validacion final
- Archivos dominantes:
  - [lib/auth/server.ts](C:/Users/Alexis/Documents/tecpify/lib/auth/server.ts)
  - [lib/auth/operator-auth.ts](C:/Users/Alexis/Documents/tecpify/lib/auth/operator-auth.ts)
  - [app/auth/callback/route.ts](C:/Users/Alexis/Documents/tecpify/app/auth/callback/route.ts)
  - [middleware.ts](C:/Users/Alexis/Documents/tecpify/middleware.ts)
- Dependencias:
  - Supabase Auth SSR
  - rutas server

### Negocios

- Estado: amarillo
- Que hace hoy realmente:
  - crea negocios reales con `name`, `slug` y `created_by_user_id`
  - resuelve acceso del workspace por owner autenticado
  - usa `businessSlug` como nombre canonico en dominio y frontend
- Limitaciones:
  - los negocios legacy sin owner quedan bloqueados por completo hasta migrarlos
  - no existe flujo completo de reclamo o migracion de ownership
- Archivos dominantes:
  - [app/api/businesses/route.ts](C:/Users/Alexis/Documents/tecpify/app/api/businesses/route.ts)
  - [data/businesses.ts](C:/Users/Alexis/Documents/tecpify/data/businesses.ts)
  - [lib/auth/business-access.ts](C:/Users/Alexis/Documents/tecpify/lib/auth/business-access.ts)
- Dependencias:
  - Supabase
  - rutas server

### Catalogo / productos

- Estado: verde
- Que hace hoy realmente:
  - lista productos por negocio
  - crea, edita, activa, destaca y reordena
  - bloquea borrado si el producto ya fue usado en pedidos reales
  - el storefront solo publica productos activos
- Limitaciones:
  - no hay categorias, variantes ni inventario
  - la gestion vive en drawers; no hay backoffice mas profundo
- Archivos dominantes:
  - [lib/data/products.ts](C:/Users/Alexis/Documents/tecpify/lib/data/products.ts)
  - [app/api/products/route.ts](C:/Users/Alexis/Documents/tecpify/app/api/products/route.ts)
  - [app/api/products/[productId]/route.ts](C:/Users/Alexis/Documents/tecpify/app/api/products/[productId]/route.ts)
  - [components/dashboard/products-management-drawer.tsx](C:/Users/Alexis/Documents/tecpify/components/dashboard/products-management-drawer.tsx)
- Dependencias:
  - Supabase
  - rutas server

### Link publico de pedidos

- Estado: verde
- Que hace hoy realmente:
  - expone `/pedido/[negocioId]`
  - resuelve negocio por slug real
  - muestra mensaje si el negocio no existe o no tiene productos activos
- Limitaciones:
  - el parametro de ruta sigue llamandose `negocioId` por compatibilidad, aunque en dominio es slug
  - no hay experiencia de catalogo avanzada
- Archivos dominantes:
  - [app/pedido/[negocioId]/page.tsx](C:/Users/Alexis/Documents/tecpify/app/pedido/[negocioId]/page.tsx)
  - [data/businesses.ts](C:/Users/Alexis/Documents/tecpify/data/businesses.ts)
  - [components/storefront/order-wizard.tsx](C:/Users/Alexis/Documents/tecpify/components/storefront/order-wizard.tsx)
- Dependencias:
  - Supabase

### Creacion de pedidos

- Estado: verde
- Que hace hoy realmente:
  - valida nombre, WhatsApp, productos, total, entrega y pago
  - traduce `businessSlug` a `business_id`
  - valida productos activos y total real antes de insertar
  - persiste pedidos reales en Supabase desde storefront y tambien desde el workspace
- Limitaciones:
  - el historial inicial depende parcialmente de lo que envie el cliente
- Archivos dominantes:
  - [components/storefront/order-wizard.tsx](C:/Users/Alexis/Documents/tecpify/components/storefront/order-wizard.tsx)
  - [app/api/orders/route.ts](C:/Users/Alexis/Documents/tecpify/app/api/orders/route.ts)
  - [lib/data/orders-server.ts](C:/Users/Alexis/Documents/tecpify/lib/data/orders-server.ts)
  - [lib/orders/mappers.ts](C:/Users/Alexis/Documents/tecpify/lib/orders/mappers.ts)
- Dependencias:
  - Supabase
  - rutas server

### Persistencia en Supabase

- Estado: verde
- Que hace hoy realmente:
  - negocios, productos y pedidos persisten en Supabase
  - pedidos usan columnas reales como `payment_status`, `delivery_type`, `history`, `is_reviewed` y `order_code`
  - Supabase es la fuente de verdad de la operacion
- Limitaciones:
  - storefront y creacion publica de pedidos dependen ahora de una RPC publica acotada y de RLS en `orders` y `products`
  - no quedan usos operativos activos de `SUPABASE_SERVICE_ROLE_KEY` en los flujos normales del MVP
- Archivos dominantes:
  - [lib/supabase/server.ts](C:/Users/Alexis/Documents/tecpify/lib/supabase/server.ts)
  - [lib/data/orders-server.ts](C:/Users/Alexis/Documents/tecpify/lib/data/orders-server.ts)
  - [lib/data/products.ts](C:/Users/Alexis/Documents/tecpify/lib/data/products.ts)
  - [data/businesses.ts](C:/Users/Alexis/Documents/tecpify/data/businesses.ts)
- Dependencias:
  - Supabase

### Dashboard operativo

- Estado: verde
- Que hace hoy realmente:
  - carga pedidos iniciales desde servidor
  - vuelve a consultar al hidratar, al enfocar, al volver visible la pestana y cada 15 segundos
  - puede abrir detalle, crear pedidos manuales y ejecutar mutaciones reales
- Limitaciones:
  - la experiencia visual es densa
  - no existe una cola de reintentos separada
- Archivos dominantes:
  - [app/dashboard/[negocioId]/page.tsx](C:/Users/Alexis/Documents/tecpify/app/dashboard/[negocioId]/page.tsx)
  - [components/dashboard/business-workspace-context.tsx](C:/Users/Alexis/Documents/tecpify/components/dashboard/business-workspace-context.tsx)
  - [components/dashboard/use-business-orders.ts](C:/Users/Alexis/Documents/tecpify/components/dashboard/use-business-orders.ts)
  - [components/dashboard/orders-workspace.tsx](C:/Users/Alexis/Documents/tecpify/components/dashboard/orders-workspace.tsx)
- Dependencias:
  - Supabase
  - rutas server
  - `localStorage` solo para filtros y grupos de UI

### Actualizacion de estados de pedido

- Estado: verde
- Que hace hoy realmente:
  - actualiza estado, datos del pedido, revision e historial
  - persiste por `PATCH /api/orders/[orderId]`
  - refresca contra API despues de mutar
- Limitaciones:
  - las reglas de transicion viven en frontend y backend de forma coordinada, asi que cualquier cambio de flujo debe tocar ambas fronteras con cuidado
- Archivos dominantes:
  - [app/api/orders/[orderId]/route.ts](C:/Users/Alexis/Documents/tecpify/app/api/orders/[orderId]/route.ts)
  - [lib/data/orders-server.ts](C:/Users/Alexis/Documents/tecpify/lib/data/orders-server.ts)
  - [lib/orders/transitions.ts](C:/Users/Alexis/Documents/tecpify/lib/orders/transitions.ts)
  - [components/dashboard/order-detail-drawer.tsx](C:/Users/Alexis/Documents/tecpify/components/dashboard/order-detail-drawer.tsx)
- Dependencias:
  - Supabase
  - rutas server

### Estados de pago

- Estado: verde
- Que hace hoy realmente:
  - separa `status` de `paymentStatus`
  - valida transiciones de pago en el workspace
  - usa `payment_status` en base de datos y `paymentStatus` en dominio
- Limitaciones:
  - no hay conciliacion automatica ni pruebas de pago
  - parte de la UX depende de acciones manuales de WhatsApp
- Archivos dominantes:
  - [lib/orders/transitions.ts](C:/Users/Alexis/Documents/tecpify/lib/orders/transitions.ts)
  - [components/dashboard/payment-helpers.ts](C:/Users/Alexis/Documents/tecpify/components/dashboard/payment-helpers.ts)
  - [components/dashboard/order-detail-drawer.tsx](C:/Users/Alexis/Documents/tecpify/components/dashboard/order-detail-drawer.tsx)
- Dependencias:
  - Supabase

### Metricas

- Estado: amarillo
- Que hace hoy realmente:
  - calcula metricas operativas sobre pedidos persistidos
  - reutiliza la misma capa de agregados entre dashboard y pantalla de metricas
- Limitaciones:
  - no hay reporting historico persistido
  - no es BI formal
  - sigue siendo una lectura operativa corta
- Archivos dominantes:
  - [data/orders.ts](C:/Users/Alexis/Documents/tecpify/data/orders.ts)
  - [app/metricas/[negocioId]/page.tsx](C:/Users/Alexis/Documents/tecpify/app/metricas/[negocioId]/page.tsx)
  - [components/dashboard/metrics-overview.tsx](C:/Users/Alexis/Documents/tecpify/components/dashboard/metrics-overview.tsx)
- Dependencias:
  - Supabase
  - calculo en servidor y cliente

### Entorno / runtime / configuracion

- Estado: amarillo
- Que hace hoy realmente:
  - centraliza `process.env` en `lib/env.ts`
  - separa runtime client minimo en `lib/runtime.ts`
  - deja `SUPABASE_SERVICE_ROLE_KEY` como capacidad opcional y hoy desactivada para runtime normal
- Limitaciones:
  - `middleware.ts` sigue vigente aunque Next ya recomienda `proxy`
  - cualquier reintroduccion de service role debe pasar por el inventario central y una justificacion explicita
- Archivos dominantes:
  - [lib/env.ts](C:/Users/Alexis/Documents/tecpify/lib/env.ts)
  - [lib/runtime.ts](C:/Users/Alexis/Documents/tecpify/lib/runtime.ts)
  - [lib/supabase/server.ts](C:/Users/Alexis/Documents/tecpify/lib/supabase/server.ts)
  - [middleware.ts](C:/Users/Alexis/Documents/tecpify/middleware.ts)
- Dependencias:
  - variables de entorno
  - Supabase

## 5. Flujos end-to-end verificados

Estos flujos estan implementados y conectados a persistencia real:

1. Registro o login -> callback de auth -> sesion SSR -> acceso al workspace.
2. Creacion de negocio -> persistencia en `businesses` -> acceso a `/dashboard/[negocioSlug]`.
3. Creacion de producto -> persistencia en `products` -> visibilidad en storefront si esta activo.
4. Storefront publico -> `POST /api/orders` -> persistencia real en `orders` -> lectura posterior en dashboard.
5. Dashboard / pedidos -> `GET /api/orders?businessSlug=...` -> lista real por negocio.
6. Edicion de pedido -> `PATCH /api/orders/[orderId]` -> persistencia de estado, pago, historial e indicador de revision -> recarga consistente.
7. Metricas -> lectura de pedidos persistidos -> agregados operativos visibles.

## 6. Flujos parciales o con riesgo

- Negocios legacy sin owner:
  - el workspace privado y el storefront publico los bloquean por completo
  - la salida operativa sigue siendo asignar owner mediante migracion controlada
  - estado: bloqueado de forma segura

- Seguridad de flujos con service role:
  - el inventario historico vive en [lib/supabase/service-role.ts](C:/Users/Cedhu IT/Documents/tecpify/lib/supabase/service-role.ts)
  - no hay usos activos permitidos en runtime del MVP
  - estado: endurecido y desactivado por defecto

- Metricas:
  - son utiles para operacion diaria
  - no resuelven historicos, contabilidad ni auditoria formal
  - estado: implementado con limites claros

## 7. Deuda tecnica actual

- `middleware.ts` sigue activo aunque Next 16 ya recomienda `proxy`.
- La estrategia elegida para legacy businesses es bloqueo total hasta migracion de owner.
- No hay tests automatizados del circuito critico.
- El historial de pedido depende parcialmente del payload cliente cuando el frontend envia `history`.
- Hay funciones con naming heredado que pueden inducir confusion, como `getBusinessByIdWithProducts` resolviendo por slug.
- El workspace concentra muchas acciones en drawers y paneles compactos, lo que complica lectura y mantenimiento.

## 8. Riesgos funcionales actuales

- Riesgo de seguridad operativa si se relajan politicas RLS de `businesses`, `products` u `orders` sin revisar storefront y workspace juntos.
- Riesgo de UX por densidad visual en pedidos y detalle de pedido.
- Riesgo de inconsistencia si se cambian transiciones de estado o pago en una sola capa.
- Riesgo de regresion en auth privada si se migra middleware sin cubrir pages y APIs server-first.

## 9. Prioridades recomendadas

1. Agregar pruebas automatizadas del circuito critico de pedidos y ownership.
2. Definir el procedimiento operativo para migrar ownership de negocios legacy ya bloqueados.
3. Mantener el storefront publico simple y sin promesas parciales de perfil reutilizable.
4. Simplificar la operacion diaria del workspace antes de abrir mas modulos.
5. Mantener el inventario de `service role` vacio salvo que aparezca un caso realmente indispensable y documentado.

## 10. Como ejecutar el proyecto localmente

### 1. Instalar dependencias

```bash
npm install
```

### 2. Configurar variables de entorno

Crea `.env.local` en la raiz con:

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
# opcional: hoy no se usa en los flujos normales del MVP
SUPABASE_SERVICE_ROLE_KEY=
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

Tambien existe [.env.example](C:/Users/Alexis/Documents/tecpify/.env.example) con el mismo inventario.

### 3. Configurar Supabase Auth

En Supabase Auth, el proyecto necesita permitir:

- `Site URL` del entorno correspondiente
- `Redirect URL` para `http://localhost:3000/auth/callback`
- `Redirect URL` para el dominio publico real, por ejemplo `https://tecpify.vercel.app/auth/callback`

### 4. Aplicar migraciones en Supabase

Migraciones relevantes del proyecto:

- `supabase/migrations/20260316_add_order_code_to_orders.sql`
- `supabase/migrations/20260319_enable_basic_business_creation.sql`
- `supabase/migrations/20260320_add_business_owner_user_id.sql`
- `supabase/migrations/20260320_enable_basic_auth_ownership_rls.sql`
- `supabase/migrations/20260320_restrict_legacy_business_access.sql`
- `supabase/migrations/20260325_block_ownerless_legacy_businesses_public_access.sql`
- `supabase/migrations/20260325_enable_public_owned_business_lookup.sql`

### 5. Ejecutar en desarrollo

```bash
npm run dev
```

Scripts disponibles:

```bash
npm run dev
npm run build
npm run start
npm run lint
npm run typecheck
npm test
```

## 11. Variables de entorno realmente requeridas

### Publicas

- `NEXT_PUBLIC_SUPABASE_URL`
  - obligatoria
  - usada por cliente, SSR auth y middleware
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
  - obligatoria
  - usada por cliente, SSR auth y middleware
- `NEXT_PUBLIC_SITE_URL`
  - obligatoria en produccion
  - usada para callback de auth y redirects absolutos de email

### Servidor

- `SUPABASE_SERVICE_ROLE_KEY`
  - opcional
  - hoy no es necesaria para los flujos normales del MVP
  - cualquier reintroduccion debe quedar registrada en [lib/supabase/service-role.ts](C:/Users/Cedhu IT/Documents/tecpify/lib/supabase/service-role.ts)

Resolucion canonica:

- toda lectura de entorno vive en [lib/env.ts](C:/Users/Alexis/Documents/tecpify/lib/env.ts)
- las utilidades client no deben importar `lib/env.ts` si ese modulo contiene lecturas server
- para checks client minimos usar [lib/runtime.ts](C:/Users/Alexis/Documents/tecpify/lib/runtime.ts)

## 11.1 Auditoria actual de service role

Inventario central en [lib/supabase/service-role.ts](C:/Users/Cedhu IT/Documents/tecpify/lib/supabase/service-role.ts).

- `public_business_lookup`
  - clasificacion: reemplazable
  - estado: deshabilitado
  - reemplazo: RPC `get_storefront_business_by_slug` que solo expone columnas publicas del negocio
- `public_order_business_lookup`
  - clasificacion: reemplazable
  - estado: deshabilitado
  - reemplazo: lookup publico de `businessSlug -> business_id` mediante la misma RPC acotada
- `public_order_code_precheck`
  - clasificacion: reemplazable
  - estado: deshabilitado
  - reemplazo: retry de insercion sobre constraint unica de `order_code`
- `public_order_read_after_write`
  - clasificacion: reemplazable
  - estado: deshabilitado
  - reemplazo: respuesta server-side basada en payload persistido y validado
- `authorization_fallback_reads`
  - clasificacion: mal justificado
  - estado: deshabilitado
  - reemplazo: ownership resuelto solo con cliente autenticado y RLS

Estado final:

- no hay usos operativos activos de `SUPABASE_SERVICE_ROLE_KEY`
- el helper privilegiado queda blindado y rechazara usos no inventariados
- storefront y pedidos publicos dependen ahora de RLS explicita en Supabase, no de bypass administrativo

## 12. Criterios minimos para considerar el MVP operable

Tecpify es operable si cumple todo esto en un entorno real:

- un usuario puede registrarse, confirmar correo e iniciar sesion
- puede crear un negocio y quedar como owner real
- puede crear al menos un producto activo
- puede compartir el link publico del negocio
- un cliente puede crear un pedido valido y ese pedido queda persistido en Supabase
- el workspace privado puede leer ese pedido al recargar
- el operador puede actualizar estado y pago con persistencia real
- las metricas visibles salen de pedidos reales, no de estado local
- los errores de persistencia se muestran como error y no como exito falso

## Recomendaciones

### UI

- Reducir densidad visual del workspace de pedidos agrupando acciones secundarias dentro de menu contextual o drawer secundario.
- Separar visualmente estado del pedido y estado del pago con jerarquia mas clara en cards y detalle.
- Hacer mas evidente cuando un pedido esta pendiente de pago versus pendiente de preparacion.

### UX

- Evitar reintroducir reutilizacion de perfil en storefront mientras no exista una fuente publica segura y minima para ese dato.
- Hacer mas explicita la diferencia entre error de persistencia y error de resincronizacion posterior.
- Mostrar mejor el siguiente paso recomendado cuando el negocio ya tiene catalogo pero aun no tiene primer pedido.

### Funcional

- Cerrar el caso de negocios legacy sin owner antes de abrir colaboracion multiusuario.
- Mantener bloqueado cualquier negocio sin owner tanto en workspace como en storefront hasta migrarlo.
- Agregar una verificacion automatizada del circuito `storefront -> pedido -> dashboard -> actualizacion`.
- Revisar si el historial inicial del pedido debe completarse siempre en servidor en lugar de depender del payload cliente.

### Tecnica

- Migrar `middleware.ts` a `proxy` cuando se planifique la siguiente ronda de mantenimiento de runtime.
- Agregar tests de integracion para `POST /api/orders` y `PATCH /api/orders/[orderId]`.
- Mantener `SUPABASE_SERVICE_ROLE_KEY` desactivada por defecto y documentar en [lib/supabase/service-role.ts](C:/Users/Cedhu IT/Documents/tecpify/lib/supabase/service-role.ts) y en este README cualquier uso nuevo realmente indispensable.
