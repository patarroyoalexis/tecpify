# Tecpify

## 1. Qué es Tecpify

Tecpify es un MVP para pequeños negocios que concentra en una sola app:

- un link público por negocio para recibir pedidos
- un espacio operativo privado para revisar y actualizar pedidos
- un catálogo básico administrado desde la app
- una capa simple de métricas calculadas sobre pedidos reales

La validación central del producto sigue siendo este circuito:

`negocio -> catalogo -> link publico -> pedido -> operacion interna -> metricas basicas`

## 2. Objetivo del MVP

Validar si un negocio pequeño puede correr un flujo operativo real sin depender de hojas de cálculo, chats sueltos o formularios desconectados.

El MVP hoy apunta a comprobar que un operador pueda:

- crear una cuenta operativa básica
- crear un negocio real desde la app
- cargar un catálogo mínimo
- compartir un formulario público propio
- recibir pedidos reales en Supabase
- gestionarlos desde una vista interna protegida
- leer métricas operativas simples sobre esos mismos pedidos

## 3. Estado actual del MVP

El MVP ya tiene persistencia real en Supabase para:

- `businesses`
- `products`
- `orders`

También tiene autenticación básica para el espacio operativo, con dos capas hoy conviviendo de forma explícita:

- Supabase Auth se usa para registro, confirmación por email y login
- `/auth/callback` completa la confirmación del email y el intercambio de sesión
- una cookie operativa firmada es la sesión canónica del workspace privado

El storefront público sigue funcionando sin autenticación:

- `/pedido/[negocioSlug]` es público
- `POST /api/orders` acepta pedidos reales desde el link público

El espacio operativo ya trabaja server-first sobre APIs reales:

- dashboard, pedidos y métricas cargan datos iniciales desde servidor
- después el cliente resincroniza con la API en hidratación, focus, visibility change y polling
- la UI no confirma éxito si una mutación real falla

Además, ya existe una política explícita de acceso por negocio:

- los negocios nuevos quedan asociados al usuario que los crea por `created_by_user_id`
- el workspace privado resuelve negocios por `slug`
- un usuario solo puede operar negocios propios o negocios legacy permitidos explícitamente en código
- los negocios legacy sin owner quedan bloqueados por defecto

## 4. Flujo que hoy sí funciona

### Flujo operativo principal

1. Un usuario se registra o inicia sesión.
2. Si el registro requiere confirmación por email, el usuario entra por `/auth/callback` y queda listo para continuar al espacio operativo.
3. Desde `/`, crea un negocio real con `name` y `slug`.
4. La API crea el negocio en Supabase y lo asocia al usuario autenticado por `created_by_user_id`.
5. La app redirige a `/dashboard/[negocioSlug]?onboarding=create-product`.
6. Desde el dashboard, el usuario crea el primer producto o abre la gestión de catálogo.
7. Cuando existe al menos un producto activo, el dashboard prioriza compartir el link público en `/pedido/[negocioSlug]`.
8. Desde ese formulario público se crea un pedido real por `POST /api/orders`.
9. El pedido aparece en el espacio interno y puede revisarse desde:
   - `/dashboard/[negocioSlug]`
   - `/pedidos/[negocioSlug]`
10. El operador puede editar el pedido, cambiar estado, cambiar estado de pago, marcar revisado y seguir su historial persistido.
11. `/metricas/[negocioSlug]` lee pedidos reales del negocio y calcula métricas operativas básicas sobre ese historial persistido.

### Flujo de activación comercial

El dashboard ya guía el onboarding operativo del negocio recién creado con estados visibles:

- negocio creado
- catálogo incompleto
- sin productos activos
- listo para compartir link
- primer pedido recibido

Cuando el negocio todavía no tiene pedidos:

- el dashboard resalta un siguiente paso recomendado
- el onboarding prioriza crear el primer producto y luego abrir o copiar el link público
- el catálogo muestra mejor el estado activo o inactivo y la posición real en el storefront

Cuando entra el primer pedido:

- el dashboard deja de insistir en la activación inicial
- pasa a marcar el negocio como operativo
- prioriza operación y seguimiento

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
- `name` con máximo de 80 caracteres
- `slug` obligatorio después de normalizar
- `slug` con máximo de 60 caracteres
- validación de unicidad por `slug`
- requiere sesión operativa autenticada

Resolución operativa actual:

- en el workspace privado el identificador canónico es el `slug`
- el `business_id` real queda interno para consultas a Supabase

### Productos

La gestión de productos persiste realmente en Supabase por negocio.

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

Validaciones actuales:

- la API operativa exige `businessSlug`
- `name` obligatorio
- `name` con máximo de 120 caracteres
- `price` mayor o igual a 0
- `sortOrder` válido cuando se envía
- `PATCH` exige al menos un campo editable real
- `DELETE` se bloquea si el producto ya fue usado en pedidos persistidos

Compatibilidad actual:

- el storefront solo publica productos activos
- el formulario público liga productos reales por `productId`
- la API de pedidos valida que el producto exista dentro del negocio
- la API de pedidos valida que un producto vinculado siga activo para nuevos pedidos públicos

### Pedidos

Supabase es la fuente de verdad de pedidos.

Flujos que ya dependen de API real:

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

Validaciones actuales en creación:

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

Validaciones actuales en actualización:

- el pedido debe existir
- el payload solo puede incluir campos editables permitidos
- debe incluir al menos un campo editable
- la dirección sigue siendo obligatoria para `delivery_type = domicilio`
- el total no puede ser negativo
- los productos siguen siendo validados
- si cambian productos o total, el total persistido vuelve a validarse contra la suma real
- `history` no puede vaciarse y sus eventos deben seguir siendo válidos

### Sincronización server-first

Las rutas privadas cargan pedidos iniciales desde servidor en:

- `/dashboard/[negocioSlug]`
- `/pedidos/[negocioSlug]`
- `/metricas/[negocioSlug]`

Luego el cliente vuelve a consultar `GET /api/orders?businessSlug=...`:

- al hidratar
- al enfocar la ventana
- al volver la pestaña a visible
- cada 15 segundos

Después de mutaciones críticas:

- la UI no confirma como éxito si la API real falla
- se muestra error visible
- se intenta resincronizar contra API para mantener Supabase como fuente de verdad
- si la persistencia sí ocurre pero falla la resincronización, la UI intenta hidratar el pedido guardado y muestra un aviso claro

`localStorage` ya no es fuente de verdad para pedidos. Solo se usa en la vista de pedidos para recordar:

- filtro seleccionado
- texto de búsqueda
- grupos expandidos

### Métricas

`/metricas/[negocioSlug]` ya no depende de cálculos sueltos repartidos en frontend.

Hoy existe una base común de agregados operativos construida sobre pedidos persistidos del negocio, reutilizada entre dashboard y pantalla de métricas.

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

Limitación actual:

- sigue siendo una capa operativa ligera calculada desde pedidos reales
- no hay tablas agregadas ni reporting persistido
- el corte mostrado responde al último día con actividad persistida, no a un BI histórico formal

## 6. Alcance actual y limitaciones

### Lo que ya cubre

- autenticación básica con Supabase Auth
- callback de confirmación por email en `/auth/callback`
- sesión operativa privada firmada para el workspace
- protección de rutas operativas
- ownership básico por negocio
- estrategia explícita para bloquear legacy sin owner por defecto
- flujo real de negocio, catálogo, pedido y operación
- storefront público funcional por negocio
- onboarding operativo de activación comercial
- gestión de productos suficiente para uso real básico
- edición real de pedidos con persistencia
- métricas básicas calculadas sobre pedidos reales

### Lo que sigue siendo básico o parcial

- no hay sistema de roles
- no hay multiusuario avanzado
- la estrategia legacy sigue siendo mínima: hoy solo se permite acceso a negocios sin owner si quedaron autorizados explícitamente en código
- la sesión operativa y la identidad de Supabase Auth todavía conviven en dos capas distintas
- el dashboard y la gestión de catálogo siguen viviendo sobre drawers y superficies compactas, no sobre un backoffice más profundo
- no existen categorías, variantes, imágenes ni inventario
- no existe módulo independiente de clientes
- las métricas siguen siendo operativas y acotadas, no BI formal
- no hay tablas agregadas ni reporting persistido
- no hay automatizaciones, notificaciones, webhooks ni integraciones externas
- no hay modo offline ni cola de reintentos

### Rutas públicas y protegidas

Públicas:

- `/`
- `/login`
- `/register`
- `/auth/callback`
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
- `GET /api/orders?businessSlug=...`
- `PATCH /api/orders/[orderId]`
- `GET /api/products?businessSlug=...`
- `POST /api/products`
- `PATCH /api/products/[productId]`
- `DELETE /api/products/[productId]?businessSlug=...`

### Supabase y seguridad

Ya existen migraciones para:

- `order_code` en `orders`
- alta básica de `businesses`
- ownership de negocios por `created_by_user_id`
- RLS mínima sobre `businesses`, `products` y `orders`
- restricción adicional para legacy sin owner

La estrategia actual de acceso es:

- negocios nuevos quedan asociados al usuario autenticado que los crea
- negocios anteriores sin owner quedan bloqueados por defecto en el espacio operativo
- solo se habilitan si entran en una allowlist explícita definida en código

Importante:

- el storefront público sigue siendo público
- la operación privada depende de chequeos de acceso en la app y de la política actual de Supabase
- hoy la cookie operativa firmada sigue siendo la sesión canónica del workspace

## 7. Próximos pasos priorizados

Orden recomendado desde el estado actual del código:

1. Resolver salida definitiva para negocios legacy sin owner:
   reclamar, migrar a owner real o eliminar la allowlist temporal.
2. Simplificar mejor la convivencia entre Supabase Auth y la sesión operativa propia:
   reducir duplicidad de responsabilidades si el producto sigue creciendo.
3. Profundizar la gestión de catálogo:
   seguir mejorando la carga y mantenimiento diario sin abrir aún inventario complejo.
4. Endurecer la operación multi-negocio:
   revisar mejor ownership, accesos y flujos administrativos por usuario.
5. Evolucionar métricas:
   mantener la capa operativa simple, pero con más estabilidad si la validación de uso lo justifica.

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

Crea `.env.local` en la raíz con:

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
AUTH_SESSION_SECRET=
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

Notas:

- `NEXT_PUBLIC_SUPABASE_URL` es obligatoria.
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` es obligatoria.
- `SUPABASE_SERVICE_ROLE_KEY` se usa en servidor para operaciones privilegiadas.
- `AUTH_SESSION_SECRET` es recomendable para firmar la cookie operativa propia.
- si `AUTH_SESSION_SECRET` no existe, la sesión operativa cae en una clave derivada de otras variables; para desarrollo puede funcionar, pero no es lo ideal para producción.
- `NEXT_PUBLIC_SITE_URL` se usa para construir el redirect de confirmación por email y el callback de auth.
- en producción `NEXT_PUBLIC_SITE_URL` debe existir y apuntar al dominio público real.

### 3. Configurar Supabase Auth

En Supabase Auth, el proyecto necesita permitir:

- `Site URL` del entorno correspondiente
- `Redirect URL` para `http://localhost:3000/auth/callback`
- `Redirect URL` para el dominio público real, por ejemplo `https://tecpify.vercel.app/auth/callback`

### 4. Aplicar migraciones en Supabase

Las migraciones relevantes del proyecto son:

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

### Scripts

```bash
npm run dev
npm run build
npm run start
npm run lint
```

## Notas útiles

- `mockBusinesses` sigue existiendo para demos y fallback visual en home y resolución de negocio.
- Los negocios demo no forman parte del flujo persistido.
- Los negocios legacy sin `created_by_user_id` ya no quedan compartidos por defecto en el espacio operativo; solo se habilitan si se autorizan explícitamente en código.
- El formulario público puede reutilizar datos de pedidos recientes del mismo negocio para autocompletar nombre y dirección por WhatsApp.
- El storefront maneja estados distintos para:
  - negocio no encontrado
  - negocio demo sin catálogo real
  - catálogo vacío
  - catálogo sin productos activos
- La gestión de productos y pedidos en el workspace privado se resuelve por `businessSlug`, aunque la persistencia en Supabase siga usando `business_id`.
- Las métricas siguen siendo deliberadamente acotadas: sirven para lectura operativa básica, no como BI formal.
