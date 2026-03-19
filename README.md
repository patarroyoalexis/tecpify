# Tecpify

Tecpify es un MVP para centralizar la toma de pedidos y la operación básica de pequeños negocios desde una experiencia simple. Combina un formulario público para registrar pedidos con un espacio interno para revisar operación diaria, métricas iniciales y catálogo por negocio.

El proyecto ya tiene integración parcial con Supabase, pero todavía convive con mocks y persistencia local en algunos flujos. El README refleja ese estado real del código actual.

## Estado actual del MVP

### Ya funciona

- Formulario público por negocio en `/pedido/[negocioId]`.
- Creación de pedidos vía API en `POST /api/orders` cuando el negocio existe en Supabase.
- Consulta de pedidos por negocio desde Supabase en `GET /api/orders`.
- Vista operativa de pedidos con búsqueda, filtros, agrupación y actualización de estados/pagos.
- Edición de pedidos desde drawer con persistencia vía `PATCH /api/orders/[orderId]`.
- Dashboard privado con resumen operativo y accesos rápidos.
- Vista de métricas con indicadores derivados del historial disponible.
- Gestión de productos por negocio desde drawer interno en dashboard/pedidos.
- API de productos para listar, crear y actualizar productos en Supabase.

### Parcialmente implementado

- Persistencia de pedidos end-to-end: existe backend real, pero el frontend todavía usa `localStorage` como respaldo temporal.
- Carga de negocios: el home y parte del flujo siguen dependiendo de `mockBusinesses`, aunque ya existe resolución de slug en tabla `businesses`.
- Toma de pedido pública: intenta guardar en Supabase, pero si falla puede caer a persistencia local del navegador.
- Edición de pedidos: el flujo principal existe, pero la experiencia sigue siendo una mezcla de actualización optimista y fallback local.
- Productos por negocio: el CRUD base está conectado a Supabase, pero su integración total con todos los flujos del producto aún está en desarrollo.

### Pendiente

- Alta básica de negocios desde la propia app.
- Eliminar dependencia del catálogo y slugs mockeados para onboarding de negocios.
- Cerrar la persistencia real sin depender de `localStorage` como red de seguridad.
- Completar endurecimiento de permisos, validaciones y documentación de esquema/migraciones.
- Formalizar despliegue documentado y variables de entorno de referencia en un `.env.example`.

## Prioridades actuales del MVP

1. Persistencia completa de pedidos
2. Edición y actualización real de pedidos
3. Alta básica de negocios
4. Productos por negocio desde la app

## Stack tecnológico

- Next.js 16 con App Router
- React 19
- TypeScript 5
- Supabase (`@supabase/supabase-js`) para lectura y escritura de datos
- Tailwind CSS 4 para estilos
- ESLint 9 con `eslint-config-next`
- `lucide-react` para iconografía puntual en UI interna

## Estructura funcional del producto

### Vista pública / toma de pedido

- Ruta: `/pedido/[negocioId]`
- Presenta un wizard para seleccionar productos, capturar datos del cliente, definir entrega, pago y observaciones.
- Intenta persistir el pedido por API y, si falla, guarda temporalmente en el navegador para no bloquear la operación.

### Dashboard del negocio

- Ruta: `/dashboard/[negocioId]`
- Resume actividad reciente, pedidos sin revisar, urgencias y accesos rápidos hacia pedidos, métricas y productos.

### Pedidos

- Ruta: `/pedidos/[negocioId]`
- Muestra métricas operativas, filtros, búsqueda, listado agrupado y drawers para detalle/edición.
- Incluye acción secundaria para abrir la gestión de productos dentro de la misma vista.

### Productos

- Gestión interna mediante drawer reutilizable.
- Permite listar, crear, editar, activar/desactivar, destacar y reordenar productos por negocio.

### Métricas

- Ruta: `/metricas/[negocioId]`
- Expone indicadores agregados de pedidos, ticket promedio, top productos, ingresos recientes e insights básicos calculados desde el historial cargado.

## Estado real por módulos

### Pedidos

Lo real hoy:

- Existe API para listar, crear y actualizar pedidos.
- El storefront intenta persistir pedidos en Supabase.
- El dashboard y la vista de pedidos consumen datos remotos cuando están disponibles.
- La edición de estados, pagos y varios datos principales ya dispara `PATCH` real contra la API.

Lo incompleto:

- El flujo sigue usando `localStorage` como fallback y respaldo temporal.
- La creación manual desde el drawer interno de pedidos hoy actualiza estado local, pero no persiste todavía por API.
- La convivencia entre datos remotos, mocks y fallback local puede producir comportamientos de transición en pruebas.

### Productos

Lo real hoy:

- Hay lectura y escritura en Supabase para productos.
- Existen endpoints para listar, crear y actualizar productos.
- El drawer de gestión ya permite administrar catálogo por negocio desde la app interna.
- El storefront solo muestra productos activos.

Lo incompleto:

- No hay eliminación; el enfoque actual es desactivar productos para no afectar historial.
- La experiencia de productos todavía está concentrada en drawer interno y no en un módulo más amplio de administración.

### Negocios

Lo real hoy:

- Existe consulta de `businesses` en Supabase para resolver slugs y mapear UUIDs.
- El storefront puede advertir cuando un negocio existe en demo pero aún no está mapeado en base de datos.

Lo incompleto:

- La fuente principal visible en home sigue siendo `mockBusinesses`.
- No existe alta básica de negocios desde UI.
- La configuración inicial del negocio todavía depende de datos mockeados y/o configuración manual.

### Dashboard

Lo real hoy:

- Muestra resumen operativo, pedidos recientes, accesos rápidos e indicadores derivados del estado actual de pedidos.
- Abre búsquedas globales, detalles de pedido, nuevo pedido y gestión de productos desde el workspace interno.

Lo incompleto:

- Es una capa operativa inicial, no un panel cerrado de negocio.
- Parte del valor mostrado depende de la consistencia del historial disponible y de la coexistencia temporal entre fuentes de datos.

## Instalación local

### 1. Clonar el repositorio

```bash
git clone <URL_DEL_REPOSITORIO>
cd tecpify
```

### 2. Instalar dependencias

```bash
npm install
```

### 3. Configurar variables de entorno

Crea un archivo `.env.local` en la raíz del proyecto con las variables necesarias.

```bash
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
```

### 4. Levantar el entorno local

```bash
npm run dev
```

La app quedará disponible en:

```text
http://localhost:3000
```

## Variables de entorno

No existe un `.env.example` en el repositorio al momento de escribir este README. Las variables detectables en el código son:

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
```

Notas:

- `NEXT_PUBLIC_SUPABASE_URL` es obligatoria.
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` es obligatoria para el cliente web y también sirve como fallback en servidor.
- `SUPABASE_SERVICE_ROLE_KEY` es opcional en el código, pero recomendable para operaciones server-side con permisos más amplios.

## Scripts disponibles

Los scripts actuales definidos en `package.json` son:

```bash
npm run dev
npm run build
npm run start
npm run lint
```

Descripción rápida:

- `npm run dev`: levanta el entorno de desarrollo.
- `npm run build`: genera el build de producción.
- `npm run start`: sirve el build compilado.
- `npm run lint`: ejecuta ESLint.

## Despliegue

El repositorio no documenta una URL de despliegue pública ni contiene una referencia explícita a un entorno productivo actual.

Si se va a desplegar hoy, la opción más natural por stack es Vercel, siempre que las variables de entorno y el acceso a Supabase estén configurados correctamente.

Espacio para documentar el despliegue activo:

- URL pública: pendiente
- Entorno principal: pendiente
- Estado de variables y tablas requeridas: pendiente

## Limitaciones actuales

- El MVP todavía mezcla Supabase, mocks y `localStorage` según el flujo y la disponibilidad remota.
- La creación manual de pedidos desde la app interna aún no cierra persistencia real end-to-end.
- La edición de pedidos ya existe, pero sigue apoyándose en actualizaciones optimistas con fallback local.
- El alta de negocios no está resuelta desde producto; depende de configuración manual y datos mockeados.
- La home pública actual funciona como demo de negocios disponibles más que como onboarding dinámico real.
- La gestión de productos ya existe, pero todavía vive como infraestructura interna en drawer, no como módulo completo de administración.
- Solo se observa una migración de Supabase versionada en el repo; la documentación completa del esquema aún está pendiente.

## Siguiente foco de desarrollo

El siguiente foco recomendado es cerrar la persistencia real de pedidos de punta a punta, luego completar la edición real sin depender de respaldo local para el flujo principal y, después de eso, avanzar en dos frentes: productos mejor integrados y alta básica de negocios desde la app.

## Consolidacion reciente de la base operativa

Estado consolidado:

- Pedidos ya operan con persistencia real por API y Supabase como fuente principal.
- La edición real de pedidos ya persiste cambios principales y reconcilia la UI con la respuesta del servidor.
- La home separa negocios reales de escenarios demo para no mezclar operación persistida con datos mockeados.
- La resolución de negocio ya puede partir de Supabase aunque el slug no exista en `mockBusinesses`.
- El storefront sigue mostrando solo productos activos y válidos.

Mocks que todavía existen:

- `mockBusinesses` en `data/businesses.ts`: quedan como catálogo demo y metadata visual de respaldo.
- `mockOrders` en `data/orders.ts`: quedan aislados como datos demo/históricos y ya no alimentan el flujo principal de pedidos.

## Requisitos minimos para alta basica de negocios

Para habilitar alta básica de negocios desde la app sin abrir todavía un módulo grande, la base mínima recomendada es:

1. Crear registro en tabla `businesses` con al menos:
   - `id`
   - `slug`
   - nombre visible o equivalente
   - timestamps básicos
2. Definir regla simple de unicidad para `slug`.
3. Resolver un estado inicial del negocio en producto:
   - negocio creado sin productos
   - negocio creado con catálogo vacío pero operativo
4. Permitir que el home liste automáticamente negocios reales recién creados.
5. Mantener el catálogo como paso posterior:
   - primero crear negocio
   - luego crear productos
6. Documentar permisos mínimos:
   - lectura de `businesses`
   - escritura server-side de `businesses`
   - relación segura entre `businesses`, `products` y `orders`

Propuesta mínima de implementación:

- Un formulario interno corto para crear negocio con nombre y slug.
- Un endpoint `POST /api/businesses`.
- Redirección inmediata al dashboard del nuevo negocio.
- Mensaje vacío de estado inicial cuando aún no existan productos ni pedidos.

Riesgos para el siguiente paso:

- La tabla `businesses` hoy se consume seguro por `id` y `slug`, pero el modelo visible del negocio todavía depende parcialmente de metadata demo si no existe una capa completa de branding en base de datos.
- Si se crea negocio sin catálogo inicial, el storefront debe seguir manejando correctamente el estado "sin productos" sin parecer error.
- Si el alta no define una política clara para slug, se puede romper navegación y resolución de negocio.
- Antes de abrir onboarding real conviene documentar mejor el esquema de `businesses` y las políticas de acceso asociadas.
