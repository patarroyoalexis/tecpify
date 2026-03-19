# Tecpify

## Que es Tecpify

Tecpify es un MVP para pequeños negocios que centraliza tres cosas en una misma base:

- recepcion de pedidos desde un formulario publico por negocio
- gestion operativa interna de esos pedidos
- catalogo y metricas basicas por negocio

El proyecto esta construido sobre Next.js con App Router y usa Supabase como persistencia principal para negocios, pedidos y productos.

## Objetivo del MVP

Validar un flujo simple para negocios pequeños que hoy reciben pedidos por canales dispersos y necesitan:

- compartir un link publico por negocio para tomar pedidos
- ver y actualizar el estado operativo desde una vista interna
- tener una base minima de catalogo y metricas sin montar un ERP ni un backoffice grande

## Estado actual del MVP

El MVP ya permite operar negocios reales con datos persistidos en Supabase. La creacion de pedidos, su lectura por negocio, la edicion desde el drawer interno, la alta basica de negocios y la gestion basica de productos ya usan APIs reales.

La operacion principal de pedidos ya no depende de `localStorage` como fuente de verdad. El estado local que queda en el frontend es de interfaz: drawers, filtros, busqueda, expansion de grupos y feedback visual mientras se espera la respuesta remota.

Todavia hay partes basicas o incompletas, sobre todo alrededor de onboarding de negocio, cobertura del catalogo y refinamiento del manejo operativo, pero el flujo principal ya esta montado sobre persistencia real.

## Que ya funciona

- Home en `/` con separacion entre negocios reales y escenarios demo.
- Alta basica de negocios desde la app interna.
- Resolucion de negocios reales desde Supabase por `slug`.
- Formulario publico por negocio en `/pedido/[negocioId]`.
- Creacion real de pedidos por `POST /api/orders`.
- Lectura real de pedidos por negocio por `GET /api/orders`.
- Dashboard del negocio en `/dashboard/[negocioId]`.
- Vista operativa de pedidos en `/pedidos/[negocioId]`.
- Vista de metricas en `/metricas/[negocioId]`.
- Edicion real de pedidos desde drawer por `PATCH /api/orders/[orderId]`.
- Cambios rapidos de estado y pago desde la UI operativa.
- Marcado operativo de revisado y marcado masivo de revisado.
- Gestion basica de productos por negocio desde drawer interno.
- Empty states para negocios nuevos sin productos o sin pedidos.

## Que ya persiste de verdad

### Negocios

Ya persiste en Supabase:

- `id`
- `slug`
- `name`
- `createdAt`
- `updatedAt`

La creacion de negocio usa `POST /api/businesses`, normaliza el slug y valida unicidad antes de insertar.

### Pedidos

La fuente principal de verdad para pedidos es Supabase.

Ya persiste por API y base de datos:

- creacion publica de pedidos
- creacion manual desde la app interna
- lectura de pedidos por negocio
- rehidratacion de pedidos en dashboard, pedidos y metricas
- edicion de pedidos desde drawer
- cambios rapidos de estado del pedido
- cambios rapidos de estado del pago
- marcado de `isReviewed`
- actualizacion de `history`

Campos de pedido que ya se actualizan por persistencia real:

- `status`
- `paymentStatus`
- `customerName`
- `customerWhatsApp`
- `deliveryType`
- `deliveryAddress`
- `paymentMethod`
- `notes`
- `total`
- `products`
- `isReviewed`
- `history`

Comportamiento actual:

- el frontend dispara la mutacion por API
- si la mutacion funciona, refresca pedidos desde servidor
- si falla, muestra error claro
- no simula un exito falso ni deja la UI como si hubiera quedado persistido

### Productos

La gestion de productos ya usa Supabase para negocios con `business_id` real.

Ya persiste:

- listado administrativo por negocio
- creacion de producto
- edicion de producto
- activar o desactivar disponibilidad
- marcar o quitar destacado
- reordenar productos

El storefront solo muestra productos activos.

## Que sigue siendo basico o parcial

- La alta de negocios es minima: solo `name` y `slug`. No incluye branding, logo, horarios ni configuraciones operativas.
- La home sigue mostrando escenarios demo en paralelo a negocios reales. Los demos estan aislados como respaldo visual, no como flujo principal.
- El catalogo se gestiona desde un drawer interno; no existe todavia un modulo mas amplio o una vista dedicada de administracion.
- No existe eliminacion de productos. El enfoque actual es desactivarlos.
- La vista publica del pedido depende de que el negocio ya tenga productos activos. Si no los tiene, muestra un empty state en lugar de un onboarding de catalogo.
- Sigue existiendo estado optimista de interfaz en acciones del dashboard, pero ya no es la fuente de verdad. La persistencia y la reconciliacion final dependen del servidor.
- `localStorage` sigue existiendo solo para preferencias visuales de la vista de pedidos, no para persistencia operativa.
- Los mocks siguen presentes como soporte de demo para negocios y datos de referencia, pero no gobiernan la operacion real.

## Flujo actual del producto

1. Desde `/`, el operador puede crear un negocio real con nombre y slug.
2. El negocio queda registrado en Supabase y la app redirige a `/dashboard/[slug]`.
3. Si el negocio ya tiene productos activos, puede compartir `/pedido/[negocioId]` para recibir pedidos publicos.
4. Cada pedido nuevo se guarda en Supabase por API.
5. El negocio revisa y gestiona esos pedidos desde `/dashboard/[negocioId]` y `/pedidos/[negocioId]`.
6. Las metricas en `/metricas/[negocioId]` se calculan sobre los pedidos reales cargados desde servidor.
7. Si hace falta, el negocio administra productos desde el drawer interno conectado a la API de productos.

## Rutas principales

- `/`: indice interno del MVP. Lista negocios reales, escenarios demo y permite crear negocios reales.
- `/pedido/[negocioId]`: formulario publico para tomar pedidos del negocio.
- `/dashboard/[negocioId]`: resumen operativo del negocio.
- `/pedidos/[negocioId]`: vista operativa completa con filtros, agrupacion, busqueda y drawer de detalle.
- `/metricas/[negocioId]`: metricas basicas del negocio calculadas sobre pedidos reales.
- `/api/businesses`: crea negocios reales.
- `/api/orders`: lista pedidos por negocio y crea pedidos.
- `/api/orders/[orderId]`: actualiza pedidos existentes.
- `/api/products`: lista y crea productos por negocio.
- `/api/products/[productId]`: actualiza productos existentes.

## APIs principales

- `POST /api/businesses`
  - crea un negocio real
  - valida `name` y `slug`
  - normaliza slug
  - valida unicidad

- `GET /api/orders?businessSlug=...`
  - lista pedidos reales del negocio
  - usa Supabase como fuente principal

- `POST /api/orders`
  - crea un pedido real
  - valida payload
  - resuelve el negocio por slug
  - inserta en Supabase

- `PATCH /api/orders/[orderId]`
  - actualiza pedido existente
  - persiste campos operativos, pago, cliente, entrega, notas, productos, total, `isReviewed` e `history`

- `GET /api/products?businessId=...`
  - lista productos del negocio para gestion interna

- `POST /api/products`
  - crea producto real del negocio

- `PATCH /api/products/[productId]`
  - actualiza producto existente

## Stack tecnologico

- Next.js 16.1.6
- React 19.2.3
- TypeScript 5
- Supabase con `@supabase/supabase-js`
- Tailwind CSS 4
- ESLint 9 con `eslint-config-next`
- `lucide-react` para iconografia puntual

## Arquitectura actual del MVP

### Frontend

- App Router de Next.js
- vistas server-first para cargar negocio y pedidos iniciales
- componentes client para operacion, drawers, formularios, filtros y mutaciones

### Persistencia

- Supabase como fuente principal para `businesses`, `orders` y `products`
- cliente de servidor en `lib/supabase/server.ts`
- APIs internas de Next.js para encapsular validacion y escritura

### Resolucion de negocio

- la resolucion real se concentra en `data/businesses.ts`
- los negocios persistidos se resuelven por `slug`
- los mocks siguen existiendo como demo visual y fallback controlado, no como alta real

### Estado local que aun existe

- estado de formularios
- aperturas y cierres de drawers
- feedback visual de carga y error
- filtros, busqueda y expansion de grupos en la vista de pedidos
- persistencia en `localStorage` solo para ese estado visual del tablero

## Modelo operativo actual del MVP

Hoy Tecpify se usa asi:

- se crea un negocio real desde la app
- se carga o administra su catalogo basico desde el workspace interno
- se comparte el formulario publico del negocio
- los pedidos entran a Supabase
- el operador los revisa, confirma, avanza, cancela o ajusta desde el dashboard interno
- las metricas se recalculan con esos pedidos reales

El modelo actual esta pensado para una operacion simple y manual, no para automatizaciones complejas ni configuraciones avanzadas por negocio.

## Siguiente prioridad recomendada

La siguiente prioridad real del MVP deberia pasar de la persistencia base a cerrar la capa operativa alrededor de lo ya persistido.

Foco recomendado:

1. endurecer experiencia operativa de pedidos ya persistidos
2. mejorar producto/catalogo como segundo paso del onboarding
3. ampliar configuracion inicial del negocio sin reintroducir mocks en el flujo principal

Justificacion breve:

La persistencia principal de pedidos y negocios ya existe. El mayor valor ahora no esta en abrir mas flujos nuevos, sino en completar el recorrido real despues de crear el negocio: dejar claro como se carga el primer catalogo, reducir fricciones operativas y hacer mas consistente la gestion diaria sobre los datos ya persistidos.

## Como ejecutar el proyecto

### 1. Instalar dependencias

```bash
npm install
```

### 2. Configurar variables de entorno

Crea `.env.local` en la raiz del proyecto con:

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
```

Notas:

- `NEXT_PUBLIC_SUPABASE_URL` es obligatoria.
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` es obligatoria para cliente web.
- `SUPABASE_SERVICE_ROLE_KEY` es recomendable para escritura server-side.

### 3. Ejecutar en desarrollo

```bash
npm run dev
```

La app queda disponible en:

```text
http://localhost:3000
```

### Scripts disponibles

```bash
npm run dev
npm run build
npm run start
npm run lint
```

## Notas

- `mockBusinesses` sigue existiendo en `data/businesses.ts` para escenarios demo y respaldo visual.
- `mockOrders` sigue existiendo en `data/orders.ts` como dataset de referencia, pero no alimenta el flujo operativo principal.
- La operacion real de pedidos ya no usa `localStorage` como fuente de verdad.
- El unico uso relevante de `localStorage` que sigue activo hoy es visual: preferencias del tablero de pedidos.
- La migracion de negocios para alta basica vive en `supabase/migrations/20260319_enable_basic_business_creation.sql`.
- El repositorio no documenta todavia un despliegue oficial ni un esquema completo versionado de todas las tablas fuera de las migraciones presentes.
