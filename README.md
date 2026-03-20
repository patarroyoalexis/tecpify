# Tecpify

## Que es Tecpify

Tecpify es un MVP para pequenos negocios que concentra en una sola app:

- recepcion de pedidos desde un link publico por negocio
- operacion interna para revisar y actualizar pedidos
- catalogo basico por negocio
- metricas operativas calculadas sobre pedidos reales

## Objetivo del MVP

Validar un flujo simple para negocios que hoy reciben pedidos por canales dispersos y necesitan:

- crear un negocio basico dentro de la app
- publicar un formulario de pedido propio
- registrar y gestionar pedidos desde una vista interna
- consultar senales operativas sin depender de hojas de calculo o chats sueltos

## Estado actual del MVP

El MVP ya tiene persistencia real en Supabase para `businesses`, `orders` y `products`. El alta basica de negocios ya funciona, los pedidos publicos y manuales ya se crean por API, las vistas privadas cargan pedidos iniciales desde servidor y el catalogo ya se puede crear y editar por negocio.

La base operativa ya no depende de `localStorage` para pedidos. Lo que sigue mas basico no es la persistencia principal sino la profundidad del producto: no hay autenticacion, el alta de negocio sigue siendo minima, los productos todavia se gestionan desde un drawer y las metricas siguen siendo calculos de frontend sobre pedidos cargados.

## Que ya funciona

- Home en `/` con listado de negocios reales desde Supabase y demos separadas.
- Alta basica de negocios desde la app con `name` y `slug`.
- Redireccion al dashboard del negocio recien creado.
- Dashboard en `/dashboard/[negocioId]` con onboarding operativo y checklist de activacion.
- Formulario publico por negocio en `/pedido/[negocioId]`.
- Carga real de productos activos para el storefront.
- Creacion real de pedidos por `POST /api/orders`.
- Creacion manual de pedidos desde la app interna usando productos activos del catalogo.
- Lectura real de pedidos por negocio.
- Edicion real de pedidos desde el drawer de detalle.
- Cambios rapidos de estado del pedido y estado del pago.
- Marcado individual de revisado y marcado masivo de revisados.
- Estado visual de "pedido nuevo" basado en `isReviewed`.
- Vista de pedidos con busqueda, filtros y agrupacion operativa.
- Busqueda global de pedidos dentro del negocio actual.
- Vista de metricas en `/metricas/[negocioId]` usando pedidos rehidratados desde servidor.
- Gestion basica de productos por negocio desde la app.

## Que ya persiste de verdad

### Negocios

Ya persiste por `POST /api/businesses`:

- `id`
- `name`
- `slug`
- `created_at`
- `updated_at`

El slug se normaliza en codigo, se valida antes de insertar y se verifica unicidad contra la tabla `businesses`. La creacion actual solo cubre nombre y slug.

### Pedidos

Supabase ya es la fuente de verdad de pedidos.

Flujos que ya dependen de API real:

- creacion publica de pedidos
- creacion manual desde la operacion interna
- lectura de pedidos por negocio
- actualizacion de pedidos existentes
- persistencia de marcas operativas como `isReviewed` e `history`

Campos que hoy se guardan y actualizan realmente:

- `status`
- `payment_status`
- `customer_name`
- `customer_whatsapp`
- `delivery_type`
- `delivery_address`
- `payment_method`
- `notes`
- `total`
- `products`
- `is_reviewed`
- `history`
- `order_code`

La API de creacion valida que:

- el negocio exista en Supabase
- los productos ligados por `productId` existan dentro del negocio
- los productos ligados por `productId` esten activos para nuevos pedidos

La API de actualizacion valida que:

- el pedido exista
- el payload solo contenga campos editables permitidos
- la direccion sea obligatoria para `delivery_type = domicilio`
- el total no sea negativo
- los productos sigan siendo validos

La rehidratacion desde servidor ya existe en:

- `/dashboard/[negocioId]`
- `/pedidos/[negocioId]`
- `/metricas/[negocioId]`

Esas rutas cargan pedidos iniciales desde servidor. Luego el cliente vuelve a consultar `GET /api/orders`, refresca al hidratar, al enfocar ventana, al volver a visibilidad y cada 15 segundos.

`localStorage` ya no es fuente de verdad para pedidos. Actualmente solo se usa en la vista de pedidos para recordar:

- filtro seleccionado
- texto de busqueda
- grupos expandidos

Sobre el comportamiento ante error:

- las mutaciones de pedidos son server-first, no quedan confirmadas solo en UI
- si una accion falla, la UI muestra error
- despues se vuelve a sincronizar contra la API para mantener Supabase como fuente de verdad

### Productos

La gestion de productos tambien ya persiste en Supabase por negocio.

Ya existe:

- listado administrativo por `businessId`
- creacion de producto
- edicion de producto
- activacion y desactivacion
- destacado y quitar destacado
- cambio de orden

El storefront solo publica productos activos.

## Que sigue siendo basico o parcial

- La creacion de negocio sigue siendo minima: solo `name` y `slug`.
- No hay autenticacion, permisos ni separacion por roles.
- Las demos siguen existiendo en `data/businesses.ts` y conviven con el flujo real como soporte visual.
- Los negocios demo no operan con `business_id` real y no deben considerarse parte del flujo persistido.
- El storefront depende de que el negocio exista en Supabase y tenga al menos un producto activo; un negocio recien creado todavia no queda listo para vender.
- La gestion de productos existe, pero sigue concentrada en un drawer y no tiene `DELETE`.
- Para productos no hay categorias, variantes, imagenes ni inventario.
- El formulario publico reutiliza pedidos recientes del negocio para autocompletar nombre y direccion por WhatsApp; no existe una tabla de clientes independiente.
- Las metricas usan datos reales, pero siguen siendo calculos en frontend sobre `ordersState`; no hay tablas agregadas ni reporting persistido.
- No hay automatizaciones, notificaciones, webhooks ni integraciones externas.
- Si una carga a Supabase falla, la app muestra error, pero no tiene modo offline ni cola de reintentos.

## Flujo actual del producto

1. Desde `/`, el operador crea un negocio con nombre y slug.
2. La app guarda el negocio en Supabase y redirige a `/dashboard/[slug]?onboarding=create-product`.
3. Desde el dashboard, el negocio carga productos y activa al menos uno.
4. Cuando hay al menos un producto activo, el link `/pedido/[negocioId]` ya queda listo para compartirse.
5. El cliente crea un pedido desde el formulario publico y la app lo guarda por `POST /api/orders`.
6. El equipo gestiona esos pedidos desde `/dashboard/[negocioId]` o `/pedidos/[negocioId]`.
7. Las metricas en `/metricas/[negocioId]` se recalculan sobre los pedidos reales cargados desde Supabase.
8. El catalogo se sigue ajustando desde el drawer interno de productos.

## Rutas principales

- `/`: home del MVP, creacion de negocio y acceso a negocios reales y demos.
- `/dashboard/[negocioId]`: resumen operativo, onboarding y accesos rapidos.
- `/pedidos/[negocioId]`: operacion diaria de pedidos.
- `/metricas/[negocioId]`: metricas basadas en pedidos del negocio.
- `/pedido/[negocioId]`: formulario publico del negocio.

## APIs principales

- `POST /api/businesses`
  Crea un negocio real con `name` y `slug`, normaliza slug y valida unicidad.

- `GET /api/orders?businessSlug=...`
  Lista pedidos reales del negocio.

- `POST /api/orders`
  Crea un pedido real, resuelve el negocio por slug, valida productos y genera `order_code`.

- `PATCH /api/orders/[orderId]`
  Actualiza estado, pago, datos editables, `isReviewed` e `history`.

- `GET /api/products?businessId=...`
  Lista productos del negocio para gestion interna.

- `POST /api/products`
  Crea un producto del negocio.

- `PATCH /api/products/[productId]`
  Edita nombre, descripcion, precio, disponibilidad, destacado y orden.

## Stack tecnologico

- Next.js 16.1.6 con App Router
- React 19.2.3
- TypeScript 5
- Tailwind CSS 4
- Supabase con `@supabase/supabase-js`
- `lucide-react`
- ESLint 9 con `eslint-config-next`

## Arquitectura actual del MVP

### Frontend

- paginas server para resolver negocio y cargar datos iniciales
- componentes client para formularios, drawers, filtros, busquedas y mutaciones

### Rutas principales

- App Router en `app/`
- vistas publicas y privadas separadas por slug de negocio

### Persistencia en Supabase

- tabla `businesses` para alta basica de negocios
- tabla `orders` para pedidos y marcas operativas
- tabla `products` para catalogo por negocio
- helpers server en `lib/supabase/server.ts`
- helper client en `lib/supabase/client.ts`

### Estado local que aun existe solo para UI

- apertura y cierre de drawers
- formularios en edicion
- banners de carga o error
- busqueda, filtros y expansion de grupos en pedidos
- `localStorage` solo para preferencias visuales de la vista de pedidos

## Modelo operativo actual del MVP

Hoy Tecpify se usa asi:

- se crea un negocio real
- se carga un catalogo basico
- se activa al menos un producto
- se comparte el formulario publico
- los pedidos entran a Supabase
- el operador revisa pedidos nuevos, cambia estado y pago, y edita detalles desde la app interna
- la vista de metricas lee ese mismo historial de pedidos ya persistido

No es todavia un backoffice multiusuario completo. Es una base operativa simple para correr el flujo real de un negocio pequeno y validar si el circuito negocio -> catalogo -> pedido -> operacion se sostiene.

## Siguiente prioridad recomendada

La siguiente prioridad real ya no es crear negocios ni cerrar la persistencia principal de pedidos, porque esas bases ya existen. El foco recomendado pasa a cerrar mejor la activacion comercial del negocio recien creado: reducir la friccion entre crear negocio, cargar un catalogo minimo y conseguir el primer pedido real. En segundo lugar, conviene profundizar la gestion de productos dentro de la app, porque hoy ya existe pero sigue siendo basica y concentrada en un drawer sin borrado, sin categorias y sin inventario.

## Como ejecutar el proyecto

### 1. Instalar dependencias

```bash
npm install
```

### 2. Configurar variables de entorno

Crea `.env.local` en la raiz con:

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
```

Notas:

- `NEXT_PUBLIC_SUPABASE_URL` es obligatoria.
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` es obligatoria para el cliente web.
- En servidor, `lib/supabase/server.ts` usa `SUPABASE_SERVICE_ROLE_KEY` si existe; si no, cae a `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
- Si corres solo con anon key, la escritura dependera de las politicas configuradas en Supabase.

### 3. Ejecutar en desarrollo

```bash
npm run dev
```

La app queda disponible en `http://localhost:3000`.

### Scripts

```bash
npm run dev
npm run build
npm run start
npm run lint
```

## Notas

- `mockBusinesses` sigue existiendo para demos y fallback visual en home y resolucion de negocio.
- La operacion real de pedidos ya no depende de `data/order-storage.ts`; ese storage quedo para preferencias visuales del panel de pedidos.
- El formulario publico puede autocompletar datos a partir de pedidos recientes del mismo negocio, pero esa reutilizacion sale del historial de pedidos y no de un modulo de clientes.
- El storefront muestra estados distintos para negocio no encontrado, negocio demo sin catalogo real, catalogo vacio y catalogo sin productos activos.
- La gestion de productos solo funciona cuando el negocio tiene `business_id` real en base de datos.
- La migracion de `order_code` esta en `supabase/migrations/20260316_add_order_code_to_orders.sql`.
- La migracion para alta basica de negocios esta en `supabase/migrations/20260319_enable_basic_business_creation.sql`.
