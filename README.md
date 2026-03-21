# Tecpify

## 1. Qué es Tecpify

Tecpify es un MVP para pequenos negocios que concentra en una sola app:

- un link publico por negocio para recibir pedidos
- un espacio operativo privado para revisar y actualizar pedidos
- un catalogo basico administrado desde la app
- una capa simple de metricas calculadas sobre pedidos reales

La validacion central del producto sigue siendo este circuito:

`negocio -> catalogo -> link publico -> pedido -> operacion interna -> metricas basicas`

## 2. Objetivo del MVP

Validar si un negocio pequeno puede correr un flujo operativo real sin depender de hojas de calculo, chats sueltos o formularios desconectados.

El MVP hoy apunta a comprobar que un operador pueda:

- crear una cuenta operativa basica
- crear o acceder a un negocio real
- cargar un catalogo minimo
- compartir un formulario publico propio
- recibir pedidos reales en Supabase
- gestionarlos desde una vista interna protegida
- leer metricas operativas simples sobre esos mismos pedidos

## 3. Estado actual del MVP

El MVP ya tiene persistencia real en Supabase para:

- `businesses`
- `products`
- `orders`

Tambien tiene autenticacion basica con Supabase Auth para el espacio operativo:

- registro con email y password
- login
- logout
- proteccion de dashboard, pedidos y metricas
- ownership inicial de negocios via `created_by_user_id`

El storefront publico no se rompio con auth:

- `/pedido/[negocioId]` sigue siendo publico
- `POST /api/orders` sigue aceptando pedidos reales desde el link publico

El circuito operativo ya no depende de `localStorage` como fuente de verdad para pedidos. La app trabaja server-first y re-sincroniza contra API despues de mutaciones y durante la operacion normal.

## 4. Flujo que hoy sí funciona

### Flujo operativo principal

1. Un usuario se registra o inicia sesion.
2. Desde `/`, crea un negocio real con `name` y `slug`.
3. La API crea el negocio en Supabase y lo asocia al usuario autenticado por `created_by_user_id`.
4. La app redirige a `/dashboard/[slug]?onboarding=create-product`.
5. Desde el dashboard, el usuario crea el primer producto o abre la gestion de catalogo.
6. Cuando existe al menos un producto activo, el negocio queda listo para compartir su link publico en `/pedido/[negocioId]`.
7. Desde ese formulario publico se crea un pedido real por `POST /api/orders`.
8. El pedido aparece en el espacio interno y puede revisarse desde:
   - `/dashboard/[negocioSlug]`
   - `/pedidos/[negocioSlug]`
9. El operador puede editar el pedido, cambiar estado, cambiar estado de pago, marcar revisado y seguir su historial.
10. `/metricas/[negocioSlug]` lee esos pedidos reales y calcula metricas basicas sobre el historial cargado.

### Flujo de activacion comercial

El dashboard ya guia el onboarding operativo del negocio recien creado con estados visibles:

- negocio creado
- catalogo incompleto
- sin productos activos
- listo para compartir link
- primer pedido recibido

Cuando el negocio ya tiene al menos un producto activo y todavia no tiene pedidos:

- muestra el link publico de forma visible
- ofrece CTA para copiar link
- ofrece CTA para abrir el formulario publico
- empuja a validar el primer pedido real

Cuando entra el primer pedido:

- el dashboard deja de insistir en onboarding inicial
- pasa a marcar el negocio como operativo
- prioriza operacion y seguimiento

## 5. Persistencia real implementada

### Negocios

Se crean por `POST /api/businesses`.

Persisten realmente:

- `id`
- `name`
- `slug`
- `created_at`
- `updated_at`
- `created_by_user_id`

Validaciones actuales:

- `name` obligatorio
- `name` con maximo de 80 caracteres
- `slug` obligatorio despues de normalizar
- `slug` con maximo de 60 caracteres
- validacion de unicidad por slug
- requiere sesion operativa autenticada

### Productos

La gestion de productos persiste realmente en Supabase por negocio.

Ya existe:

 - listado administrativo por `businessSlug` en API operativa
- creacion
- edicion
- activacion y desactivacion
- destacar y quitar destacado
- reordenamiento
- borrado con validacion de uso en pedidos

Campos y comportamiento relevantes:

- `name`
- `description`
- `price`
- `is_available`
- `is_featured`
- `sort_order`

Validaciones actuales:

- `businessSlug` obligatorio en la API operativa
- `name` obligatorio
- `name` con maximo de 120 caracteres
- `price` mayor o igual a 0
- `sortOrder` valido cuando se envia
- `PATCH` exige al menos un campo editable real
- `DELETE` se bloquea si el producto ya fue usado en pedidos persistidos

Compatibilidad actual:

- el storefront solo publica productos activos
- el formulario publico liga productos reales por `productId`
- la API de pedidos valida que el producto exista y que siga activo para nuevos pedidos

### Pedidos

Supabase es la fuente de verdad de pedidos.

Flujos que ya dependen de API real:

- creacion publica desde `/pedido/[negocioId]`
- creacion manual desde el espacio interno
- lectura por negocio
- actualizacion de pedidos existentes
- persistencia de `is_reviewed`
- persistencia de `history`
- generacion y persistencia de `order_code`

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

Validaciones actuales en creacion:

- el negocio debe existir
- `customerName` obligatorio
- `customerWhatsApp` obligatorio
- `paymentMethod` obligatorio
- `deliveryType` valido
- `products` con al menos un item valido
- `total` mayor que 0
- `deliveryAddress` obligatoria para `delivery_type = domicilio`
- los `productId` deben existir dentro del negocio
- los `productId` deben seguir activos para nuevos pedidos

Validaciones actuales en actualizacion:

- el pedido debe existir
- el payload solo puede incluir campos editables permitidos
- debe incluir al menos un campo editable
- la direccion sigue siendo obligatoria para `delivery_type = domicilio`
- el total no puede ser negativo
- los productos siguen siendo validados

### Sincronizacion server-first

Las rutas privadas cargan pedidos iniciales desde servidor en:

- `/dashboard/[negocioSlug]`
- `/pedidos/[negocioSlug]`
- `/metricas/[negocioSlug]`

Luego el cliente vuelve a consultar `GET /api/orders`:

- al hidratar
- al enfocar la ventana
- al volver la pestaña a visible
- cada 15 segundos

Despues de mutaciones criticas:

- la UI no confirma como exito si la API real falla
- se muestra error visible
- se intenta resincronizar contra API para mantener Supabase como fuente de verdad

`localStorage` ya no es fuente de verdad para pedidos. Solo se usa en la vista de pedidos para recordar:

- filtro seleccionado
- texto de busqueda
- grupos expandidos

## 6. Alcance actual y limitaciones

### Lo que ya cubre

- autenticacion basica con Supabase Auth
- proteccion de rutas operativas
- ownership inicial de negocios
- flujo real de negocio, catalogo, pedido y operacion
- storefront publico funcional por negocio
- onboarding operativo de activacion comercial
- gestion de productos suficiente para uso real basico
- edicion real de pedidos con persistencia
- metricas basicas calculadas sobre pedidos reales

### Lo que sigue siendo basico o parcial

- no hay sistema de roles
- no hay multiusuario avanzado
- la estrategia legacy sigue siendo minima: hoy solo se permite acceso a negocios sin owner si quedaron autorizados explicitamente en codigo
- el dashboard y la gestion de catalogo siguen viviendo sobre drawers y superficies compactas, no sobre un backoffice mas profundo
- no existen categorias, variantes, imagenes ni inventario
- no existe modulo independiente de clientes
- las metricas siguen siendo calculos de frontend sobre `ordersState`
- no hay tablas agregadas ni reporting persistido
- no hay automatizaciones, notificaciones, webhooks ni integraciones externas
- no hay modo offline ni cola de reintentos

### Rutas publicas y protegidas

Publicas:

- `/`
- `/login`
- `/register`
- `/pedido/[negocioSlug]`
- `POST /api/orders`
- `POST /api/auth/login`
- `POST /api/auth/register`
- `POST /api/auth/logout`

Protegidas:

- `/dashboard/[negocioSlug]`
- `/pedidos/[negocioSlug]`
- `/metricas/[negocioSlug]`
- `POST /api/businesses`
- `GET /api/orders`
- `GET /api/orders?businessSlug=...`
- `PATCH /api/orders/[orderId]`
- `GET /api/products?businessSlug=...`
- `POST /api/products`
- `PATCH /api/products/[productId]`
- `DELETE /api/products/[productId]?businessSlug=...`

### Supabase y seguridad

Ya existen migraciones para:

- `order_code` en `orders`
- alta basica de `businesses`
- ownership de negocios por `created_by_user_id`
- RLS minima sobre `businesses`, `products` y `orders`

La estrategia actual de ownership es:

- negocios nuevos quedan asociados al usuario autenticado que los crea
- negocios anteriores sin owner quedan bloqueados por defecto en el espacio operativo
- solo se habilitan si entran en una allowlist explicita definida en codigo
- en el workspace privado el identificador canonico del negocio es el `slug`; el `business_id` real queda interno para Supabase

## 7. Próximos pasos priorizados

Orden recomendado desde el estado actual del codigo:

1. Resolver migracion definitiva de negocios legacy sin owner:
   definir si se reclaman, se migran a owner real o se eliminan de la allowlist temporal.
2. Consolidar auth operativa:
   unificar mejor la capa de sesion propia con la sesion de Supabase si el producto sigue creciendo.
3. Profundizar gestion de catalogo:
   mejorar todavia mas la operacion diaria sin abrir aun inventario complejo.
4. Endurecer la operacion multi-negocio:
   revisar mejor ownership, accesos y flujos administrativos por usuario.
5. Evolucionar metricas:
   pasar de calculos de frontend a una capa mas estable si la validacion de uso lo justifica.

## 8. Stack

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

## 9. Ejecución local

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
AUTH_SESSION_SECRET=
```

Notas:

- `NEXT_PUBLIC_SUPABASE_URL` es obligatoria.
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` es obligatoria.
- `SUPABASE_SERVICE_ROLE_KEY` se usa en servidor para operaciones privilegiadas.
- `AUTH_SESSION_SECRET` es recomendable para firmar la cookie operativa propia.
- si `AUTH_SESSION_SECRET` no existe, la sesion operativa cae en una clave derivada de otras variables; para desarrollo puede funcionar, pero no es lo ideal para produccion.

### 3. Aplicar migraciones en Supabase

Las migraciones relevantes del proyecto son:

- `supabase/migrations/20260316_add_order_code_to_orders.sql`
- `supabase/migrations/20260319_enable_basic_business_creation.sql`
- `supabase/migrations/20260320_add_business_owner_user_id.sql`
- `supabase/migrations/20260320_enable_basic_auth_ownership_rls.sql`
- `supabase/migrations/20260320_restrict_legacy_business_access.sql`

### 4. Ejecutar en desarrollo

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

## Notas utiles

- `mockBusinesses` sigue existiendo para demos y fallback visual en home y resolucion de negocio.
- Los negocios demo no forman parte del flujo persistido.
- Los negocios legacy sin `created_by_user_id` ya no quedan compartidos por defecto en el espacio operativo; solo se habilitan si se autorizan explicitamente en codigo.
- El formulario publico puede reutilizar datos de pedidos recientes del mismo negocio para autocompletar nombre y direccion por WhatsApp.
- El storefront maneja estados distintos para:
  - negocio no encontrado
  - negocio demo sin catalogo real
  - catalogo vacio
  - catalogo sin productos activos
- La gestion de productos requiere `business_id` real.
- Las metricas siguen siendo deliberadamente acotadas: sirven para lectura operativa basica, no como BI formal.
