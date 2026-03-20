# Tecpify

## Que es Tecpify

Tecpify es un MVP para pequenos negocios que concentra tres frentes en una sola app:

- recepcion de pedidos desde un link publico por negocio
- operacion interna para revisar y actualizar pedidos
- catalogo y metricas basicas conectadas a Supabase

Hoy ya existe un flujo real de negocio -> catalogo -> pedido -> operacion, aunque todavia con alcance acotado y varias capas en modo piloto.

## Objetivo del MVP

Validar una operacion simple para negocios pequenos que hoy reciben pedidos por canales dispersos y necesitan:

- compartir un formulario publico por negocio
- registrar y seguir pedidos desde una vista interna
- mantener un catalogo minimo sin depender de planillas o mensajes sueltos
- consultar metricas basicas sobre pedidos reales

## Estado actual del MVP

El nucleo del MVP ya persiste en Supabase para `businesses`, `orders` y `products`. La alta basica de negocios ya es real, los pedidos publicos y manuales ya se guardan por API, las vistas privadas cargan pedidos iniciales desde servidor y la gestion de productos ya permite crear, editar, activar, desactivar, destacar y reordenar catalogo por negocio.

El cuello de botella principal ya no esta en persistencia base sino en activacion: negocio creado -> catalogo activo -> primer pedido real. El dashboard ya incluye un onboarding operativo con checklist y CTAs reales para ayudar a destrabar ese tramo, pero el MVP sigue dependiendo de un flujo manual, sin autenticacion, sin permisos y con demos todavia visibles en la home.

## Que ya funciona

- Home en `/` con prioridad visual para negocios reales y demos separadas como soporte.
- Alta basica de negocios desde la app con `name` y `slug`.
- Redireccion al dashboard del negocio creado.
- Dashboard del negocio en `/dashboard/[negocioId]`.
- Onboarding operativo dentro del dashboard con checklist de activacion, progreso, estado del negocio y CTAs para cargar producto, activar catalogo, copiar link y probar el formulario.
- Logica explicita de readiness del negocio basada en negocio creado + productos cargados + productos activos.
- Formulario publico por negocio en `/pedido/[negocioId]`.
- Empty states diferenciados en storefront para negocio no encontrado, negocio demo sin catalogo real, catalogo vacio y catalogo sin productos activos.
- Carga real de productos activos para el formulario publico.
- Creacion real de pedidos por `POST /api/orders`.
- Vista operativa en `/pedidos/[negocioId]` con busqueda, filtros y agrupacion.
- Drawer de detalle para revisar y editar pedidos.
- Cambios rapidos de estado del pedido y del pago.
- Marcado de pedido revisado y marcado masivo de revisados.
- Estado visual de pedido nuevo basado en `isReviewed`.
- Creacion manual de pedidos desde la app interna.
- Busqueda global de pedidos dentro del negocio actual.
- Vista de metricas en `/metricas/[negocioId]` calculada sobre pedidos reales.
- Gestion basica de productos por negocio desde un drawer interno.
- Feedback de activacion del catalogo dentro del dashboard y dentro del drawer de productos.

## Que ya persiste de verdad

### Negocios

Ya persiste en Supabase por `POST /api/businesses`:

- `id`
- `slug`
- `name`
- `created_at`
- `updated_at`

El slug se normaliza en codigo antes de crear el negocio, se valida y se verifica unicidad antes del insert. La alta actual sigue siendo minima: solo nombre y slug.

### Pedidos

La fuente de verdad de pedidos ya es Supabase.

Ya persiste por API real:

- creacion publica de pedidos
- creacion manual desde la app interna
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

La creacion publica valida que:

- el negocio exista en Supabase
- los productos referenciados existan dentro del catalogo del negocio
- los productos ligados por `productId` esten activos para nuevos pedidos

La actualizacion de pedidos valida:

- transiciones de estado y pago permitidas desde la UI
- direccion obligatoria para pedidos con `delivery_type = domicilio`
- productos validos y total no negativo

La rehidratacion desde servidor ya existe en:

- `/dashboard/[negocioId]`
- `/pedidos/[negocioId]`
- `/metricas/[negocioId]`

Esas rutas cargan pedidos iniciales desde servidor y luego el cliente vuelve a consultar `GET /api/orders`, con refresh al hidratar, al enfocar ventana, al volver a visibilidad y cada 15 segundos.

La operacion real de pedidos ya no depende de `localStorage`. `localStorage` sigue usandose solo para preferencias visuales de la vista de pedidos:

- filtro seleccionado
- busqueda
- grupos expandidos

Las mutaciones de pedidos son server-first. Si una mutacion falla:

- la UI muestra banner de error
- no consolida una fuente paralela local
- luego vuelve a refrescar contra la API para mantener Supabase como fuente de verdad

### Productos

La gestion de productos ya persiste en Supabase por negocio real:

- listado administrativo por `businessId`
- creacion
- edicion
- activacion y desactivacion
- marcado y desmarcado como destacado
- cambio de orden

El storefront solo publica productos activos.

La gestion actual de productos permite:

- crear productos desde el dashboard
- editar nombre, descripcion, precio, disponibilidad, destacado y orden
- activar y desactivar productos en forma rapida
- reordenar productos cargados
- ver conteo de activos e inactivos
- recibir feedback cuando un cambio deja al negocio listo o no listo para vender

## Que sigue siendo basico o parcial

- La alta de negocios sigue siendo minima: solo `name` y `slug`.
- No hay autenticacion, permisos ni separacion de roles.
- La home todavia mantiene demos; estan separadas visualmente, pero siguen conviviendo con el flujo real.
- Los negocios demo siguen resolviendose como fallback visual y no operan con `business_id` real.
- Un negocio nuevo no queda listo para vender solo con crearse: necesita cargar y activar productos.
- La gestion de productos existe, pero sigue viviendo en un drawer; no hay modulo dedicado ni borrado de productos.
- No hay categorias, variantes, imagenes ni inventario.
- No existe una tabla dedicada de clientes; el storefront reutiliza pedidos recientes del negocio actual para autocompletado.
- Las metricas usan datos reales, pero siguen siendo calculos de frontend sobre pedidos cargados; no hay tablas agregadas ni reporting avanzado.
- El manejo operativo sigue siendo manual. No hay automatizaciones, webhooks, notificaciones ni integraciones externas.
- El storefront ya distingue mejor estados vacios, pero no hay un onboarding publico profundo para explicar al negocio como activar su catalogo desde esa ruta.
- La experiencia analitica sigue en modo piloto y todavia no separa series o comparativos persistidos.

## Flujo actual del producto

1. Desde `/`, el operador crea un negocio real con nombre y slug.
2. La app guarda el negocio en Supabase y redirige a `/dashboard/[slug]`.
3. Desde el dashboard, el negocio completa el onboarding operativo: crear al menos un producto, activar al menos uno y compartir el link publico.
4. Cuando hay catalogo activo, ya puede compartir `/pedido/[negocioId]`.
5. El cliente envia el pedido desde el formulario publico y la app lo guarda por `POST /api/orders`.
6. El equipo revisa y gestiona esos pedidos desde `/dashboard/[negocioId]` o `/pedidos/[negocioId]`.
7. Las metricas en `/metricas/[negocioId]` se recalculan sobre los pedidos reales rehidratados desde Supabase.
8. El catalogo se puede seguir ajustando desde el drawer interno de productos.

## Rutas principales

- `/`: home del MVP. Prioriza negocios reales, permite crear negocios y mantiene demos en un bloque secundario.
- `/dashboard/[negocioId]`: resumen operativo, readiness del negocio, checklist de onboarding, estado del catalogo y accesos rapidos.
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
  Crea un pedido real, resuelve el negocio por slug, genera `order_code` y valida productos contra el catalogo del negocio.

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

- App Router con rutas server-first para cargar negocio, pedidos iniciales y readiness basica
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
- se activa al menos un producto
- se comparte el formulario publico del negocio
- los pedidos entran a Supabase
- el operador revisa pedidos nuevos, cambia estados, valida pagos y edita detalles desde la app interna
- la capa de metricas lee ese mismo historial ya persistido

No es un sistema multiusuario completo ni un backoffice avanzado. Es una base operativa simple para correr pilotos reales con pocos negocios.

## Siguiente prioridad recomendada

La siguiente prioridad real ya no deberia ser persistir pedidos, editar pedidos o crear negocios, porque esas bases ya existen y ya estan conectadas a Supabase. El foco recomendado es seguir cerrando el tramo negocio creado -> catalogo activo -> primer pedido real: fortalecer la activacion del catalogo, reducir friccion para compartir el link publico y ayudar mejor a conseguir el primer pedido sin abrir todavia autenticacion, un modulo grande de ecommerce ni analitica avanzada.

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
- La vista de pedidos sigue guardando en `localStorage` solo filtros, busqueda y grupos expandidos.
- Las mutaciones de pedidos y productos son server-first: si fallan, la UI muestra error y luego vuelve a sincronizar contra la API.
- El storefront solo acepta pedidos cuando el negocio existe en Supabase y tiene productos activos.
- Los empty states del storefront ya distinguen entre negocio no encontrado, catalogo vacio y catalogo sin productos activos.
- La migracion de `order_code` vive en `supabase/migrations/20260316_add_order_code_to_orders.sql`.
- La migracion de alta basica de negocios vive en `supabase/migrations/20260319_enable_basic_business_creation.sql`.
