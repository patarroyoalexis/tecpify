# Tecpify

## 1. Qué es Tecpify

Tecpify es un MVP para pequeños negocios que concentra en una sola app:

- un link público por negocio para recibir pedidos
- un espacio operativo privado para revisar y actualizar pedidos
- un catálogo básico administrado desde la app
- una capa simple de métricas operativas calculadas sobre pedidos reales

El alcance actual sigue siendo deliberadamente corto. No es un ERP ni un backoffice completo. Hoy busca validar si un negocio pequeño puede operar un flujo real de pedidos sin depender de hojas de cálculo, chats sueltos o formularios desconectados.

## 2. Objetivo del MVP

La validación principal del MVP sigue siendo este circuito:

`negocio -> catalogo -> link publico -> pedido -> operacion interna -> metricas basicas`

Hoy el producto apunta a comprobar que un operador pueda:

- registrarse o iniciar sesión
- crear un negocio real desde la app
- cargar un catálogo mínimo
- compartir un link público propio
- recibir pedidos reales en Supabase
- gestionarlos desde un espacio privado protegido
- leer métricas operativas simples sobre esos mismos pedidos

## 3. Estado actual del MVP

El MVP ya tiene una base operativa real sobre Supabase para:

- `businesses`
- `products`
- `orders`

También tiene autenticación básica para el espacio operativo:

- Supabase Auth se usa para registro, confirmación por email y login
- `/auth/callback` completa la confirmación por `code` o `token_hash`
- las cookies SSR de Supabase Auth son la sesión canónica del workspace privado

El storefront público ya funciona con datos reales cuando el negocio existe en base de datos y tiene productos activos:

- `/pedido/[negocioSlug]` es público
- `POST /api/orders` persiste pedidos reales
- el formulario valida productos, total, tipo de entrega y método de pago
- el formulario puede reutilizar nombre y dirección a partir de pedidos previos del mismo WhatsApp

El espacio privado ya trabaja server-first sobre APIs reales:

- dashboard, pedidos y métricas cargan datos iniciales desde servidor
- después el cliente vuelve a consultar `GET /api/orders?businessSlug=...`
- la resincronización ocurre al hidratar, al enfocar la ventana, al volver la pestaña visible y cada 15 segundos
- la UI no confirma éxito si la mutación real falla

Lo que todavía no está cerrado:

- la base de autenticación ya está consolidada en Supabase Auth SSR, pero todavía no hay roles ni colaboración avanzada
- no hay roles ni multiusuario avanzado
- la estrategia para negocios legacy sin owner sigue siendo temporal
- las métricas ya son útiles para operación, pero no son un módulo analítico formal

## 4. Flujo operativo que hoy sí funciona

### Flujo principal validable hoy

1. Un usuario se registra o inicia sesión.
2. Si el registro requiere confirmación por email, el usuario confirma por `/auth/callback`.
3. Desde `/`, crea un negocio real con `name` y `slug`.
4. La API crea el negocio en Supabase y lo asocia al usuario autenticado por `created_by_user_id`.
5. La app redirige a `/dashboard/[negocioSlug]?onboarding=create-product`.
6. Desde el dashboard, el usuario abre el drawer de catálogo y crea el primer producto.
7. Cuando existe al menos un producto activo, el negocio queda listo para compartir `/pedido/[negocioSlug]`.
8. Desde ese formulario público se crea un pedido real por `POST /api/orders`.
9. El pedido aparece en el espacio interno y puede revisarse desde:
   - `/dashboard/[negocioSlug]`
   - `/pedidos/[negocioSlug]`
10. El operador puede editar datos del pedido, cambiar estado, cambiar estado de pago, marcar revisado y persistir historial.
11. `/metricas/[negocioSlug]` calcula señales operativas sobre pedidos persistidos del negocio.

### Flujo de activación ya visible en UI

El dashboard ya distingue estos estados del negocio:

- negocio creado
- catálogo sin productos
- catálogo con productos, pero sin activos
- negocio listo para compartir link público
- negocio con primer pedido recibido

Cuando todavía no hay pedidos:

- el dashboard resalta un siguiente paso recomendado
- la activación prioriza crear el primer producto y luego abrir o copiar el link público

Cuando ya entró el primer pedido:

- el dashboard deja de insistir en activación inicial
- prioriza operación diaria y seguimiento

## 5. Qué ya persiste realmente

### Negocios

Se crean por `POST /api/businesses`.

Persisten realmente:

- `id`
- `name`
- `slug`
- `created_at`
- `updated_at`
- `created_by_user_id`

Validaciones verificadas en código:

- `name` obligatorio
- `name` con máximo de 80 caracteres
- `slug` obligatorio después de normalizar
- `slug` con máximo de 60 caracteres
- unicidad por `slug`
- requiere usuario autenticado por Supabase Auth SSR

Resolución actual:

- el workspace privado resuelve negocios por `slug`
- el `business_id` real queda interno para consultas a Supabase

### Productos

La gestión de productos ya persiste realmente en Supabase por negocio.

Ya existe:

- listado administrativo por negocio
- creación
- edición
- activación y desactivación
- destacar y quitar destacado
- reordenamiento
- borrado con validación de uso en pedidos

Campos y comportamiento relevantes:

- `name`
- `description`
- `price`
- `is_available`
- `is_featured`
- `sort_order`

Validaciones verificadas:

- la API operativa exige `businessSlug`
- `name` obligatorio
- `name` con máximo de 120 caracteres
- `price` mayor o igual a 0
- `sortOrder` válido cuando se envía
- `PATCH` exige al menos un campo editable real
- `DELETE` se bloquea si el producto ya fue usado en pedidos persistidos

Compatibilidad actual con storefront y pedidos:

- el storefront público solo publica productos activos
- el formulario público liga productos reales por `productId`
- la API de pedidos valida que cada `productId` exista dentro del negocio
- la API de pedidos también valida que el producto siga activo para nuevos pedidos públicos

### Pedidos

Supabase ya es la fuente de verdad de pedidos.

Flujos ya conectados a API real:

- creación pública desde `/pedido/[negocioSlug]`
- creación manual desde el espacio interno
- lectura por negocio
- actualización de pedidos existentes
- persistencia de `is_reviewed`
- persistencia de `history`
- generación y persistencia de `order_code`

Campos que hoy se guardan y actualizan:

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

Validaciones verificadas en creación:

- el negocio debe existir
- `customerName` obligatorio
- `customerWhatsApp` obligatorio
- `paymentMethod` obligatorio
- `deliveryType` válido
- `products` con al menos un item válido
- `total` mayor que 0
- `deliveryAddress` obligatoria para `delivery_type = domicilio`
- los `productId` deben existir dentro del negocio
- los `productId` deben seguir activos para nuevos pedidos públicos
- no se permiten `productId` repetidos dentro del mismo pedido
- el total debe coincidir con la suma real de los productos
- `history` debe tener eventos válidos cuando se envía

Validaciones verificadas en actualización:

- el pedido debe existir
- el payload solo puede incluir campos editables permitidos
- debe incluir al menos un campo editable
- `customerName` no puede quedar vacío
- la dirección sigue siendo obligatoria para `delivery_type = domicilio`
- el total no puede ser negativo
- los productos siguen siendo validados
- si cambian productos o total, el total persistido vuelve a validarse contra la suma real
- `history` no puede vaciarse y sus eventos deben seguir siendo válidos

### Sincronización de datos

Las rutas privadas cargan pedidos iniciales desde servidor en:

- `/dashboard/[negocioSlug]`
- `/pedidos/[negocioSlug]`
- `/metricas/[negocioSlug]`

Luego el cliente vuelve a consultar `GET /api/orders?businessSlug=...`:

- al hidratar
- al enfocar la ventana
- al volver la pestaña visible
- cada 15 segundos

Después de mutaciones críticas:

- la UI no confirma como éxito si la API real falla
- se muestra error visible
- se intenta resincronizar contra API para mantener a Supabase como fuente de verdad
- si la persistencia sí ocurre pero falla la resincronización, la UI intenta hidratar el pedido guardado y muestra un aviso claro

`localStorage` ya no es fuente de verdad para pedidos. Solo se usa en la vista de pedidos para recordar:

- filtro seleccionado
- texto de búsqueda
- grupos expandidos

### Métricas

`/metricas/[negocioSlug]` ya no depende de estado suelto del frontend.

Hoy existe una capa compartida de agregados operativos calculada sobre pedidos persistidos del negocio, reutilizada entre dashboard y pantalla de métricas.

La capa actual cubre:

- pedidos del corte operativo
- venta del corte
- pendientes de atención
- cobros por revisar
- carga en operación
- ingresos entregados
- cancelaciones
- ticket promedio
- top productos

## 6. Qué sigue siendo básico, parcial o incompleto

- No hay sistema de roles.
- No hay multiusuario avanzado por negocio.
- La estrategia legacy es mínima: los negocios sin owner quedan bloqueados por defecto y solo podrían habilitarse por allowlist en código.
- La allowlist de legacy hoy está vacía, así que no existe un flujo completo de reclamación o migración de negocios antiguos.
- El home sigue mezclando negocios reales con negocios demo para soporte visual y showcase.
- `mockBusinesses` sigue existiendo para demos y fallback visual.
- `mockOrders` sigue existiendo en `data/orders.ts`, aunque los flujos privados ya operan con pedidos reales.
- El storefront no tiene categorías, variantes, imágenes ni inventario.
- No existe módulo independiente de clientes.
- No existe sistema de pagos automáticos.
- No existen notificaciones, webhooks ni integraciones externas.
- No hay reporting persistido ni tablas agregadas para métricas.
- No hay cola de reintentos ni modo offline.
- No hay suite de tests automatizados; el proyecto hoy expone `lint`, pero no scripts de test.

## 7. Limitaciones o riesgos actuales

- El workspace privado ya depende de Supabase Auth SSR, pero todavía no existe un sistema de roles ni colaboración multiusuario avanzada por negocio.
- El middleware solo actúa como redirección temprana para UX. La validación real de acceso ocurre dentro de páginas y APIs en servidor.
- `SUPABASE_SERVICE_ROLE_KEY` sigue siendo necesaria en flujos concretos: storefront público, creación pública de pedidos y compatibilidad temporal con negocios legacy. En esos puntos la seguridad depende tanto de validaciones de app como de la configuración actual de RLS.
- La política temporal para negocios legacy todavía no resuelve migración, reclamación ni limpieza definitiva.
- Las métricas son operativas, no históricas ni contables. Sirven para seguimiento corto, no para BI formal.
- La prioridad operativa en `data/orders.ts` usa un `now` fijo (`2026-03-14T13:00:00.000Z`), así que esa lectura temporal todavía no está completamente desacoplada de una fecha estática.
- El storefront reutiliza datos de pedidos previos por WhatsApp para autocompletar nombre y dirección, pero no existe un modelo formal de clientes ni consentimiento más profundo que el checkbox operativo actual.
- El dashboard y la gestión de catálogo dependen de drawers y superficies compactas; todavía no existe un backoffice más profundo para operación compleja.

## 8. Prioridades inmediatas

Orden recomendado desde el estado actual del código:

1. Resolver la salida definitiva para negocios legacy sin owner.
   Reclamar, migrar a owner real o eliminar definitivamente la lógica temporal de allowlist.
2. Endurecer la seguridad operativa por negocio.
   Revisar mejor ownership, controles de acceso y dependencia de validaciones de app cuando el servidor usa service role.
3. Abrir la siguiente etapa de auth sobre esta base.
   Construir roles, colaboración y modelo de acceso más fino sin reintroducir una sesión paralela a Supabase.
4. Corregir dependencias temporales en métricas y prioridad operativa.
   Quitar la fecha fija en cálculos de tiempo y estabilizar mejor la lectura de operación.
5. Profundizar la gestión de catálogo sin abrir todavía inventario complejo.
   Mejorar mantenimiento diario, edición rápida y claridad del storefront real.
6. Evolucionar métricas solo en función del uso real.
   Mantener la capa operativa simple, pero volverla más estable si la validación comercial lo justifica.

## 9. Stack principal

- Next.js 16.1.6 con App Router
- React 19.2.3
- TypeScript 5
- Tailwind CSS 4
- Supabase:
  - `@supabase/supabase-js`
  - Auth
  - base de datos
- `lucide-react`
- ESLint 9 con `eslint-config-next`

## 10. Cómo ejecutar el proyecto localmente

### 1. Instalar dependencias

```bash
npm install
```

### 2. Configurar variables de entorno

Crea `.env.local` en la raíz con:

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

Notas:

- `NEXT_PUBLIC_SUPABASE_URL` es obligatoria.
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` es obligatoria.
- `SUPABASE_SERVICE_ROLE_KEY` se usa en servidor para operaciones privilegiadas que todavía no pueden resolverse solo con el cliente autenticado del usuario.
- `NEXT_PUBLIC_SITE_URL` se usa para construir el callback de auth y el redirect de confirmación por email
- en producción `NEXT_PUBLIC_SITE_URL` debe apuntar al dominio público real

### 3. Configurar Supabase Auth

En Supabase Auth, el proyecto necesita permitir:

- `Site URL` del entorno correspondiente
- `Redirect URL` para `http://localhost:3000/auth/callback`
- `Redirect URL` para el dominio público real, por ejemplo `https://tecpify.vercel.app/auth/callback`

### 4. Aplicar migraciones en Supabase

Migraciones relevantes del proyecto:

- `supabase/migrations/20260316_add_order_code_to_orders.sql`
- `supabase/migrations/20260319_enable_basic_business_creation.sql`
- `supabase/migrations/20260320_add_business_owner_user_id.sql`
- `supabase/migrations/20260320_enable_basic_auth_ownership_rls.sql`
- `supabase/migrations/20260320_restrict_legacy_business_access.sql`

### 5. Ejecutar en desarrollo

```bash
npm run dev
```

La app queda disponible en `http://localhost:3000`.

### Scripts disponibles

```bash
npm run dev
npm run build
npm run start
npm run lint
npm run typecheck
```

## 11. Criterio de avance del MVP

Tecpify no avanza por cantidad de pantallas, sino por cierre del flujo operativo real y consistencia de datos.

El MVP avanza cuando:

- un negocio nuevo puede crearse y quedar asociado a un owner real
- ese negocio puede cargar y mantener un catálogo mínimo sin depender de mocks
- el link público recibe pedidos válidos y esos pedidos quedan persistidos
- el espacio privado puede leer, editar y resincronizar esos pedidos sin desalinearse de la base
- las métricas visibles salen del historial real del negocio y no de estado inventado en frontend
- los errores de persistencia se muestran de forma explícita y no como falsos positivos de UI

En otras palabras, el criterio principal no es "tener más módulos", sino cerrar mejor este circuito:

`negocio -> catalogo -> link publico -> pedido -> operacion interna -> metricas basicas`

Mientras ese circuito gane consistencia, menos dependencias temporales y mejor control de acceso, el MVP realmente está avanzando.
