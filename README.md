# Tecpify

## 1. Que es Tecpify hoy

Tecpify es un MVP operativo para pequenos negocios con un circuito central ya implementado:

`auth -> negocio -> catalogo -> link publico -> pedido -> workspace -> metricas`

Hoy el producto no es un ERP ni un backoffice completo. El estado real del repo muestra una app enfocada en:

- crear y operar negocios propios autenticados
- publicar un catalogo minimo
- recibir pedidos reales desde un link publico
- operar esos pedidos desde un workspace privado
- persistir negocios, productos y pedidos en Supabase
- calcular metricas operativas simples sobre pedidos persistidos

No hay multiusuario por negocio, pagos automaticos, integraciones externas, inventario formal ni BI historico.

## 2. Objetivo actual del MVP

El objetivo actual del MVP es validar que un negocio pequeno pueda:

1. crear su negocio
2. cargar al menos un producto activo
3. compartir un link publico real
4. recibir un pedido persistido en Supabase
5. leerlo y operarlo desde el workspace privado
6. actualizar estado y pago con reglas de negocio minimas
7. ver metricas operativas basicas salidas de datos reales

El MVP solo se considera util si ese circuito funciona sin depender de mocks ni de `localStorage` como fuente de verdad.

## 3. Alcance real implementado

Implementado hoy:

- registro, login y callback de auth con Supabase Auth SSR
- creacion de negocios reales por usuario autenticado
- ownership por `created_by_user_id`
- catalogo real por negocio con creacion, edicion, activacion, destacado y reordenamiento
- bloqueo de borrado si el producto ya fue usado en pedidos persistidos
- storefront publico por slug de negocio con productos activos
- creacion publica de pedidos con validacion de total y productos
- lectura privada de pedidos por owner autenticado
- actualizacion real de pedido, pago, historial e `isReviewed`
- dashboard, pedidos y metricas alimentados por pedidos persistidos

Fuera de alcance hoy:

- roles o colaboracion multiusuario
- conciliacion o pasarela de pagos
- clientes persistidos como modulo propio
- inventario, variantes, categorias o imagenes
- webhooks, integraciones o automatizaciones externas
- soporte offline o cola de reintentos
- auditoria formal o reporting historico persistido

## 4. Estado funcional por modulos

### Autenticacion / sesion

- Estado: verde
- Que hace hoy realmente:
  - `POST /api/auth/register` crea cuenta y puede requerir confirmacion por email
  - `POST /api/auth/login` inicia sesion contra Supabase
  - `/auth/callback` confirma signup o intercambio de codigo y deja sesion SSR
  - `requireAuthenticatedUser`, `requireBusinessContext` y `requireBusinessApiContext` protegen pages y APIs privadas
  - `middleware.ts` redirige a login para rutas privadas
- Limitaciones:
  - no hay roles ni colaboracion
  - el middleware es un guard de UX; la autorizacion real sigue en server
  - Next 16 ya marca `middleware.ts` como convencion deprecada frente a `proxy`
- Archivos dominantes:
  - `lib/auth/server.ts`
  - `lib/auth/operator-auth.ts`
  - `app/api/auth/register/route.ts`
  - `app/api/auth/login/route.ts`
  - `app/auth/callback/route.ts`
  - `middleware.ts`
- Dependencia principal:
  - Supabase Auth SSR
  - server routes

### Negocios

- Estado: amarillo
- Que hace hoy realmente:
  - crea negocios con `name`, `slug` y `created_by_user_id`
  - lista negocios visibles del operador autenticado en `/dashboard`
  - resuelve ownership por slug o por order id antes de abrir workspace o mutar pedidos
  - el dominio canonico usa `businessSlug`
- Limitaciones:
  - negocios legacy sin owner quedan bloqueados en privado y tambien en publico
  - no existe flujo de migracion o reclamo de ownership dentro de la UI
  - `getHomeBusinesses` degrada a lista vacia si falla la consulta, asi que el home no siempre distingue entre "sin negocios" y "error al cargar"
- Archivos dominantes:
  - `app/api/businesses/route.ts`
  - `data/businesses.ts`
  - `lib/auth/business-access.ts`
  - `lib/auth/legacy-business-access.ts`
- Dependencia principal:
  - Supabase
  - RLS / ownership por owner

### Catalogo / productos

- Estado: verde
- Que hace hoy realmente:
  - lista productos por negocio
  - crea, edita, activa, destaca y reordena productos
  - el storefront solo publica productos `is_available = true`
  - bloquea borrado si el producto aparece referenciado en pedidos persistidos
  - da feedback de readiness del negocio segun productos totales y activos
- Limitaciones:
  - no hay categorias, variantes, inventario ni imagenes
  - la experiencia de gestion esta concentrada en un drawer
  - la logica de reorder hace varias escrituras consecutivas
- Archivos dominantes:
  - `lib/data/products.ts`
  - `app/api/products/route.ts`
  - `app/api/products/[productId]/route.ts`
  - `components/dashboard/products-management-drawer.tsx`
  - `lib/businesses/readiness.ts`
- Dependencia principal:
  - Supabase
  - server routes

### Link publico de pedidos

- Estado: verde
- Que hace hoy realmente:
  - expone `/pedido/[negocioId]`
  - el parametro `negocioId` contiene realmente un slug, no un UUID
  - resuelve negocio por RPC publica `get_storefront_business_by_slug`
  - solo muestra negocios con owner real
  - solo publica productos activos
  - muestra estados claros de "negocio no encontrado" o "sin catalogo activo"
- Limitaciones:
  - el nombre del segmento de ruta sigue heredado y puede inducir errores si alguien lo trata como id de base de datos
- Archivos dominantes:
  - `app/pedido/[negocioId]/page.tsx`
  - `data/businesses.ts`
  - `components/storefront/order-wizard.tsx`
  - `supabase/migrations/20260325_enable_public_owned_business_lookup.sql`
  - `supabase/migrations/20260325_block_ownerless_legacy_businesses_public_access.sql`
- Dependencia principal:
  - Supabase
  - RPC publica acotada
  - RLS publica sobre `products` y `orders`

### Creacion de pedidos

- Estado: verde
- Que hace hoy realmente:
  - valida nombre, WhatsApp, entrega, pago, productos y total
  - normaliza `businessSlug`
  - traduce `businessSlug -> business_id`
  - valida productos activos y recalcula el total real antes de insertar
  - genera `order_code`
  - persiste el pedido publico en Supabase sin service role
  - tambien permite crear pedidos manuales desde el workspace
- Limitaciones:
  - el historial inicial puede venir desde cliente y hoy el servidor solo lo valida y normaliza; no lo reconstruye siempre desde cero
  - no hay reintento diferido ni idempotencia formal
- Archivos dominantes:
  - `components/storefront/order-wizard.tsx`
  - `app/api/orders/route.ts`
  - `lib/data/orders-server.ts`
  - `lib/orders/mappers.ts`
- Dependencia principal:
  - Supabase
  - route handler server

### Persistencia en Supabase

- Estado: verde
- Que hace hoy realmente:
  - negocios, productos y pedidos persisten en Supabase
  - las rutas publicas usan `anon key` y politicas publicas restringidas
  - las rutas privadas usan cliente autenticado SSR
  - `SUPABASE_SERVICE_ROLE_KEY` queda deshabilitada para el MVP normal
  - el helper admin existe, pero esta blindado por inventario vacio de usos activos
- Limitaciones:
  - depende de migraciones y RLS correctas; si se relajan, se rompen seguridad y ownership
- Archivos dominantes:
  - `lib/supabase/server.ts`
  - `lib/supabase/service-role.ts`
  - `lib/data/orders-server.ts`
  - `lib/data/products.ts`
  - `data/businesses.ts`
- Dependencia principal:
  - Supabase
  - RLS

### Dashboard operativo

- Estado: verde
- Que hace hoy realmente:
  - carga pedidos iniciales desde servidor
  - rehidrata, refresca en focus, visibility change y cada 15 segundos
  - permite abrir detalle, crear pedido manual y mutar pedidos reales
  - muestra onboarding de activacion del negocio si aun no hay primer pedido
  - separa mejor `estado del pedido` y `estado del pago` en cards y drawer
  - hace mas visible el siguiente paso operativo
- Limitaciones:
  - sigue siendo una UI densa en varias vistas del workspace
  - la resincronizacion depende de fetch posterior a la mutacion
  - usa `localStorage` para filtros y grupos de UI; no para persistencia critica
- Archivos dominantes:
  - `app/dashboard/[negocioId]/page.tsx`
  - `app/pedidos/[negocioId]/page.tsx`
  - `components/dashboard/business-workspace-context.tsx`
  - `components/dashboard/use-business-orders.ts`
  - `components/dashboard/orders-workspace.tsx`
  - `components/dashboard/order-card.tsx`
  - `components/dashboard/order-detail-drawer.tsx`
- Dependencia principal:
  - Supabase
  - server routes
  - `localStorage` solo para estado visual

### Actualizacion de estados de pedido

- Estado: verde
- Que hace hoy realmente:
  - actualiza estado, pago, datos principales, historial e `isReviewed`
  - persiste por `PATCH /api/orders/[orderId]`
  - aplica validacion de payload y guardas de transicion
  - recalcula total si cambian productos o total
  - refresca luego de mutar y muestra advertencia si falla la resincronizacion
- Limitaciones:
  - la transicion depende de coordinacion entre frontend, route handler y capa server
  - un cambio de flujo mal alineado puede romper UX o validacion contractual
- Archivos dominantes:
  - `app/api/orders/[orderId]/route.ts`
  - `lib/data/orders-server.ts`
  - `lib/orders/transitions.ts`
  - `lib/orders/update-guards.ts`
  - `components/dashboard/use-business-orders.ts`
  - `components/dashboard/order-detail-drawer.tsx`
- Dependencia principal:
  - Supabase
  - route handler server

### Estados de pago

- Estado: verde
- Que hace hoy realmente:
  - separa `status` y `paymentStatus`
  - usa `payment_status` en base y `paymentStatus` en dominio/frontend
  - bloquea avance operativo si el pago no esta verificado
  - soporta verificacion manual y acciones de WhatsApp
- Limitaciones:
  - no hay conciliacion automatica
  - no hay evidencia de pago persistida como archivo o modulo propio
  - parte del flujo sigue siendo manual por WhatsApp
- Archivos dominantes:
  - `lib/orders/transitions.ts`
  - `lib/orders/update-guards.ts`
  - `components/dashboard/payment-helpers.ts`
  - `components/dashboard/order-detail-drawer.tsx`
- Dependencia principal:
  - Supabase
  - reglas de dominio

### Metricas

- Estado: amarillo
- Que hace hoy realmente:
  - calcula metricas operativas desde pedidos persistidos
  - muestra resumen diario, pendientes, revenue entregado, actividad y top productos
  - reutiliza agregados entre dashboard y modulo de metricas
- Limitaciones:
  - no es BI formal
  - no hay snapshots ni historico persistido de metricas
  - varias metricas son derivadas en runtime a partir de `ordersState`
- Archivos dominantes:
  - `data/orders.ts`
  - `app/metricas/[negocioId]/page.tsx`
  - `components/dashboard/metrics-overview.tsx`
- Dependencia principal:
  - Supabase
  - calculo en runtime

### Entorno / runtime / configuracion

- Estado: amarillo
- Que hace hoy realmente:
  - centraliza lectura de entorno en `lib/env.ts`
  - expone `getPublicEnv`, `getServerEnv` y `getSiteUrlEnv`
  - deja `NEXT_PUBLIC_SITE_URL` con fallback local en desarrollo y obligatoria en produccion
  - expone `isProductionRuntime()` para checks livianos en cliente
- Limitaciones:
  - `lib/runtime.ts` es minima y no reemplaza checks server
  - `middleware.ts` esta deprecado por convencion en Next 16
- Archivos dominantes:
  - `lib/env.ts`
  - `lib/runtime.ts`
  - `lib/site-url.ts`
  - `middleware.ts`
- Dependencia principal:
  - environment variables
  - Next runtime

## 5. Flujos end-to-end verificados

Implementados y verificados por codigo real:

1. Registro o login -> callback auth -> sesion SSR -> acceso a `/dashboard`.
2. Creacion de negocio -> persistencia en `businesses` -> aparicion en home autenticado.
3. Creacion de producto -> persistencia en `products` -> visibilidad publica solo si queda activo.
4. Formulario publico -> `POST /api/orders` -> persistencia en `orders` -> respuesta con `orderCode`.
5. Workspace privado -> `GET /api/orders?businessSlug=...` -> lectura de pedidos del negocio autenticado.
6. Workspace -> `PATCH /api/orders/[orderId]` -> actualizacion persistida de estado/pago/historial.
7. Dashboard y metricas -> lectura de pedidos persistidos -> agregados operativos.

Cobertura automatizada actual:

- si existe para `POST /api/orders`, `GET /api/orders`, `PATCH /api/orders/[orderId]`
- si existe para reglas de transicion en `lib/orders/transitions.ts`
- no existe E2E browser del circuito completo `storefront -> dashboard -> update`
- no existe suite automatizada equivalente para auth, negocios y catalogo

## 6. Flujos parciales o con riesgo

- Negocios legacy sin owner
  - estado: parcial por bloqueo controlado
  - el sistema no los deja operar en publico ni en privado
  - no hay UI de migracion

- Historial de pedido
  - estado: implementado con riesgo
  - el servidor valida `history`, pero parte del contenido sigue naciendo en cliente

- Home del operador
  - estado: implementado con riesgo
  - si falla la consulta de negocios, el home puede degradar a lista vacia sin una señal fuerte de error

- Metricas
  - estado: parcial
  - son utiles para operacion diaria, no para auditoria, finanzas ni historicos robustos

- Nombres heredados
  - estado: implementado con riesgo
  - `[negocioId]` en rutas sigue siendo slug
  - `getBusinessByIdWithProducts()` resuelve realmente por slug y existe solo por compatibilidad
  - `payment_status` sigue tolerado en normalizacion de update payload, pero el canon para frontend/API es `paymentStatus`

## 7. Deuda tecnica actual

- migrar `middleware.ts` a `proxy`
- agregar E2E del circuito critico de pedidos y ownership
- decidir si el historial inicial del pedido debe generarse siempre en servidor
- corregir naming heredado que mezcla `negocioId`, slug y nombres de compatibilidad
- reducir complejidad visual restante en partes del workspace
- revisar degradaciones silenciosas o poco expresivas, por ejemplo en carga de negocios del home
- mantener documentado y sin usos activos el inventario de service role

## 8. Riesgos funcionales actuales

- relajar RLS de `businesses`, `products` u `orders` rompe ownership y lectura publica acotada
- cambiar transiciones de estado o pago en una sola capa rompe el flujo operativo
- tratar `negocioId` como si fuera id real de base de datos puede introducir bugs de acceso
- reintroducir `localStorage` en rutas criticas romperia la fuente de verdad en Supabase
- el historial del pedido puede derivar en inconsistencias si cliente y servidor dejan de alinear eventos
- la advertencia de Next sobre `middleware` puede posponerse demasiado y encarecer la siguiente migracion de runtime

## 9. Prioridades recomendadas

1. Agregar pruebas E2E del circuito `storefront -> pedido persistido -> workspace -> actualizacion`.
2. Resolver deuda de naming heredado para que slug e id no se mezclen en nuevas capas.
3. Mover la generacion minima del historial inicial del pedido completamente al servidor.
4. Definir proceso de migracion de negocios legacy sin owner.
5. Consolidar la simplificacion UX del workspace en las demas vistas operativas.

## 10. Como ejecutar el proyecto localmente

### Instalar dependencias

```bash
npm install
```

### Configurar variables de entorno

Crea `.env.local` con:

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

Notas:

- `SUPABASE_SERVICE_ROLE_KEY` hoy es opcional y no se usa en los flujos normales del MVP
- `NEXT_PUBLIC_SITE_URL` tiene fallback a `http://localhost:3000` en desarrollo, pero debe configurarse en produccion para auth y enlaces absolutos

### Configurar Supabase Auth

Debes permitir al menos:

- `Site URL` del entorno actual
- `Redirect URL` de `http://localhost:3000/auth/callback`
- `Redirect URL` del dominio publico real, por ejemplo `https://tu-dominio/auth/callback`

### Aplicar migraciones

Migraciones relevantes del repo:

- `supabase/migrations/20260316_add_order_code_to_orders.sql`
- `supabase/migrations/20260319_enable_basic_business_creation.sql`
- `supabase/migrations/20260320_add_business_owner_user_id.sql`
- `supabase/migrations/20260320_enable_basic_auth_ownership_rls.sql`
- `supabase/migrations/20260320_restrict_legacy_business_access.sql`
- `supabase/migrations/20260325_block_ownerless_legacy_businesses_public_access.sql`
- `supabase/migrations/20260325_enable_public_owned_business_lookup.sql`

### Ejecutar

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
  - usada por cliente, SSR auth, middleware y clientes server public/auth
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
  - obligatoria
  - usada por cliente, SSR auth, middleware y clientes server public/auth
- `NEXT_PUBLIC_SITE_URL`
  - requerida operativamente en produccion
  - en desarrollo cae a `http://localhost:3000`
  - usada por callback auth y URLs absolutas

### Servidor

- `SUPABASE_SERVICE_ROLE_KEY`
  - opcional
  - no activa ningun flujo del MVP por defecto
  - cualquier uso nuevo debe quedar inventariado en `lib/supabase/service-role.ts`

Regla canonica:

- toda lectura de `process.env` debe vivir en `lib/env.ts`
- utilidades client no deben importar modulos server que lean env
- `lib/runtime.ts` solo se usa para checks minimos de runtime, no para auth ni acceso a datos

## 12. Criterios minimos para considerar el MVP operable

Tecpify es operable si en un entorno real se cumple todo esto:

- un usuario puede registrarse o loguearse y obtener sesion valida
- puede crear un negocio y quedar como owner real
- puede crear al menos un producto activo
- el link publico del negocio abre correctamente
- un cliente puede crear un pedido valido y ese pedido queda en Supabase
- el workspace privado puede leer ese pedido al recargar
- el operador puede actualizar estado y pago con persistencia real
- dashboard y metricas leen pedidos persistidos y no estado local inventado
- los errores de persistencia se muestran como error y no como exito falso

## Recomendaciones

### UI

- Reducir aun mas el ruido del workspace consolidando acciones menos frecuentes en menus o drawers secundarios fuera del flujo principal.
- Unificar el lenguaje visual de alertas entre dashboard, pedidos y metricas para distinguir mejor "error", "warning operativo" y "estado informativo".
- Revisar cards y tablas donde aun convivan demasiados badges y textos de apoyo en el mismo plano visual.

### UX

- Hacer mas explicita la diferencia entre "pedido creado pero vista sin resincronizar" y "pedido no persistido".
- Mantener visible el siguiente paso recomendado en dashboard y pedidos para negocios sin primer pedido y para pedidos con pago pendiente.
- Evitar UI que sugiera reutilizacion de perfil, historial de cliente o automatizacion de pagos mientras no exista persistencia real para eso.

### Funcional

- Cerrar el caso de negocios legacy sin owner antes de abrir colaboracion o permisos adicionales.
- Generar el historial minimo del pedido siempre en servidor y dejar al cliente solo como emisor de contexto opcional.
- Agregar un test automatizado que cubra el circuito completo de negocio activo, producto activo, pedido publico y actualizacion privada.

### Tecnica

- Migrar `middleware.ts` a `proxy` en la siguiente ronda de mantenimiento de runtime.
- Eliminar nombres de compatibilidad peligrosos en nuevas capas y planear la salida controlada de `getBusinessByIdWithProducts`.
- Mantener `SUPABASE_SERVICE_ROLE_KEY` sin usos activos y documentar cualquier excepcion antes de implementarla.
