# Tecpify

## Que es Tecpify

Tecpify es un MVP para pequenos negocios que concentra tres frentes en una sola app:

- recepcion de pedidos desde un link publico por negocio
- operacion interna para revisar y actualizar pedidos
- catalogo y metricas basicas conectadas a Supabase

Hoy el proyecto ya tiene flujo real de negocio -> catalogo -> pedido -> operacion, pero todavia con alcance acotado y varias piezas en modo basico.

## Objetivo del MVP

Validar una operacion simple para negocios pequenos que hoy reciben pedidos por canales dispersos y necesitan:

- compartir un formulario publico por negocio
- registrar y seguir pedidos desde una vista interna
- mantener un catalogo minimo sin depender de planillas o mensajes sueltos
- consultar metricas basicas sobre pedidos reales

## Estado actual del MVP

El nucleo del MVP ya esta conectado a Supabase para negocios, pedidos y productos. Los pedidos publicos se crean por API, el dashboard rehidrata pedidos desde servidor, las ediciones del drawer persisten en base de datos y la creacion basica de negocios ya es real.

Lo mas incompleto hoy no es la persistencia base, sino el onboarding del negocio despues del alta y la gestion de catalogo como modulo de producto mas completo. El MVP funciona, pero todavia depende de un flujo operativo manual, sin auth, sin configuracion avanzada y con partes de demo que siguen visibles en la home.

## Que ya funciona

- Home en `/` que lista negocios reales desde Supabase y escenarios demo por separado.
- Alta basica de negocios desde la app con nombre y slug.
- Redireccion al dashboard del negocio creado.
- Formulario publico por negocio en `/pedido/[negocioId]`.
- Carga de productos activos reales para el formulario publico.
- Creacion real de pedidos por `POST /api/orders`.
- Dashboard del negocio en `/dashboard/[negocioId]`.
- Vista operativa en `/pedidos/[negocioId]` con busqueda, filtros y agrupacion por estado.
- Drawer de detalle para revisar y editar pedidos.
- Cambios rapidos de estado del pedido y del pago.
- Marcado de pedido revisado y marcado masivo de revisados.
- Creacion manual de pedidos desde la app interna.
- Vista de metricas en `/metricas/[negocioId]` calculada sobre pedidos cargados desde Supabase.
- Gestion basica de productos por negocio desde un drawer interno.
- Busqueda global de pedidos dentro del negocio actual.
- Estados vacios para negocio sin catalogo activo o sin pedidos.

## Que ya persiste de verdad

### Negocios

Ya persiste en Supabase por `POST /api/businesses`:

- `id`
- `slug`
- `name`
- `created_at`
- `updated_at`

El slug se normaliza en codigo, se valida antes de insertar y tambien tiene indice unico en la migracion `supabase/migrations/20260319_enable_basic_business_creation.sql`.

### Pedidos

La fuente de verdad de pedidos ya es Supabase.

Ya persiste por API real:

- creacion publica de pedidos
- creacion manual desde el drawer interno
- lectura de pedidos por negocio
- actualizacion de pedidos existentes
- `isReviewed`
- `history`
- `order_code`

Campos de pedido que hoy se guardan y actualizan realmente:

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

La rehidratacion desde servidor ya existe en:

- `/dashboard/[negocioId]`
- `/pedidos/[negocioId]`
- `/metricas/[negocioId]`

Esas rutas cargan pedidos iniciales desde servidor y luego el cliente vuelve a consultar `GET /api/orders`, con refresh en hidratacion, foco de ventana, visibilidad y cada 15 segundos.

### Productos

La gestion de productos ya persiste en Supabase por negocio real:

- listado administrativo por `businessId`
- creacion
- edicion
- activacion y desactivacion
- marcado y desmarcado como destacado
- cambio de orden

El storefront solo publica productos activos.

## Que sigue siendo basico o parcial

- La alta de negocios sigue siendo minima: solo `name` y `slug`.
- No hay autenticacion, permisos ni separacion de roles.
- La home todavia muestra negocios demo junto a negocios reales.
- Los negocios demo siguen resolviendose como fallback visual, pero no operan con `business_id` real.
- Un negocio nuevo no queda listo para vender solo con crearse: necesita cargar y activar productos.
- La gestion de productos existe, pero vive en un drawer; no hay modulo dedicado ni borrado de productos.
- El formulario publico no tiene onboarding de catalogo: si no hay productos activos, solo muestra empty state.
- Las metricas ya usan pedidos reales, pero son calculos en frontend sobre pedidos cargados; no hay tablas agregadas ni reporting avanzado.
- No existe una tabla dedicada de clientes: el autocompletado del storefront reutiliza pedidos recientes del negocio actual.
- El manejo operativo sigue siendo manual. No hay automatizaciones, webhooks, notificaciones ni integraciones externas.

## Flujo actual del producto

1. Desde `/`, el operador crea un negocio real con nombre y slug.
2. La app guarda el negocio en Supabase y redirige a `/dashboard/[slug]`.
3. Desde el dashboard, el negocio necesita crear y activar al menos un producto.
4. Cuando hay catalogo activo, ya puede compartir `/pedido/[negocioId]`.
5. El cliente envia el pedido desde el formulario publico y la app lo guarda por `POST /api/orders`.
6. El equipo revisa y gestiona esos pedidos desde `/dashboard/[negocioId]` o `/pedidos/[negocioId]`.
7. Las metricas en `/metricas/[negocioId]` se recalculan sobre los pedidos reales rehidratados desde Supabase.
8. El catalogo se puede seguir ajustando desde el drawer interno de productos.

## Rutas principales

- `/`: home del MVP. Lista negocios reales, muestra demos y permite crear negocios.
- `/dashboard/[negocioId]`: resumen operativo, readiness del negocio y accesos rapidos.
- `/pedidos/[negocioId]`: vista operativa completa de pedidos.
- `/metricas/[negocioId]`: metricas basicas calculadas sobre pedidos reales.
- `/pedido/[negocioId]`: formulario publico del negocio.
- `/api/businesses`: crea negocios.
- `/api/orders`: lista pedidos por negocio y crea pedidos.
- `/api/orders/[orderId]`: actualiza pedidos.
- `/api/products`: lista y crea productos.
- `/api/products/[productId]`: actualiza productos.

## APIs principales

- `POST /api/businesses`
  Crea un negocio real con `name` y `slug`, normaliza slug y valida unicidad.

- `GET /api/orders?businessSlug=...`
  Lista pedidos reales de un negocio por slug.

- `POST /api/orders`
  Crea un pedido real, resuelve el negocio por slug y valida productos contra el catalogo del negocio.

- `PATCH /api/orders/[orderId]`
  Actualiza estado, pago y datos editables del pedido. Tambien persiste `isReviewed` e `history`.

- `GET /api/products?businessId=...`
  Lista productos del negocio para gestion interna.

- `POST /api/products`
  Crea un producto del negocio y normaliza su orden.

- `PATCH /api/products/[productId]`
  Edita nombre, descripcion, precio, disponibilidad, destacado y orden.

## Stack tecnologico

- Next.js 16 con App Router
- React 19
- TypeScript 5
- Tailwind CSS 4
- Supabase con `@supabase/supabase-js`
- `lucide-react`
- ESLint 9 con `eslint-config-next`

## Arquitectura actual del MVP

### Frontend

- app router con rutas server-first para cargar negocio y pedidos iniciales
- componentes client para formularios, drawers, filtros, mutaciones y UX operativa

### Persistencia

- Supabase como persistencia de `businesses`, `orders` y `products`
- helper server en `lib/supabase/server.ts`
- helper client en `lib/supabase/client.ts`
- las API routes de Next.js concentran validacion y escritura

### Estado local que sigue existiendo

- apertura y cierre de drawers
- formularios
- feedback de carga y error
- filtros, busqueda y expansion de grupos
- `localStorage` solo para recordar preferencias visuales de la vista de pedidos

## Modelo operativo actual del MVP

Hoy Tecpify se usa asi:

- se crea un negocio real
- se carga un catalogo basico
- se comparte el formulario publico del negocio
- los pedidos entran a Supabase
- el operador revisa pedidos nuevos, cambia estados, valida pagos y edita detalles desde la app interna
- la capa de metricas lee ese mismo historial ya persistido

No es un sistema multiusuario completo ni un backoffice avanzado. Es una base operativa simple para correr pilotos reales con pocos negocios.

## Siguiente prioridad recomendada

La siguiente prioridad real ya no deberia ser "persistir pedidos" ni "crear negocios", porque esas bases ya existen. El cuello de botella actual esta en cerrar mejor el tramo negocio creado -> catalogo activo -> primer pedido real.

El foco recomendado es fortalecer productos por negocio y el onboarding posterior al alta: hoy un negocio puede crearse y persiste bien, pero todavia depende de un drawer basico para cargar catalogo y sin eso no puede usar el formulario publico. Despues de ese paso, la segunda prioridad deberia ser endurecer la experiencia operativa de pedidos sobre la base ya persistida.

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

La app queda en `http://localhost:3000`.

### Scripts disponibles

```bash
npm run dev
npm run build
npm run start
npm run lint
```

## Notas

- `mockBusinesses` sigue existiendo en `data/businesses.ts` para demos y fallback visual.
- `mockOrders` sigue existiendo en `data/orders.ts` como dataset de referencia para utilidades y UX, pero no es la fuente de verdad del flujo principal.
- La operacion real de pedidos ya no depende de `localStorage`.
- Las mutaciones de pedidos y productos son server-first: si fallan, la UI muestra error y conserva el estado persistido anterior.
- El panel de pedidos sigue guardando en `localStorage` solo filtros, busqueda y grupos expandidos.
- El storefront solo acepta pedidos cuando el negocio existe en Supabase y tiene productos activos.
- La migracion de `order_code` vive en `supabase/migrations/20260316_add_order_code_to_orders.sql`.
- La migracion de alta basica de negocios vive en `supabase/migrations/20260319_enable_basic_business_creation.sql`.
