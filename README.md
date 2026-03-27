# Tecpify

## 1. Que es Tecpify hoy

Tecpify es un MVP operativo para pequenos negocios que necesitan publicar un catalogo simple, recibir pedidos reales desde un link publico y operarlos desde un workspace privado. No es una idea en validacion conceptual ni un ERP: hoy resuelve un circuito acotado y funcional sobre una base persistida en Supabase.

## 2. Problema que resuelve

Muchos negocios pequenos venden por WhatsApp, Instagram o llamadas, pero administran catalogo, pedidos y seguimiento con mensajes dispersos o memoria operativa. Tecpify centraliza ese flujo minimo para que el negocio tenga una sola base real de productos, pedidos y estados operativos.

## 3. Objetivo actual del MVP

El objetivo actual del MVP es validar, de punta a punta, que un negocio pueda:

1. crear su espacio con ownership real
2. cargar y publicar productos activos
3. compartir un link publico por slug
4. recibir pedidos persistidos
5. operar esos pedidos desde el workspace privado
6. consultar metricas operativas simples

## 4. Circuito operativo validado

`registro/login -> negocio con owner -> catalogo activo -> storefront publico -> pedido persistido -> operacion privada -> metricas`

Ese circuito ya esta implementado y usa Supabase como base real para auth, datos y reglas de acceso.

## 5. Estado funcional actual

- Registro, login y sesion del operador con Supabase Auth SSR.
- Creacion de negocios con `created_by_user_id` y acceso privado resuelto por ownership.
- Catalogo por negocio con alta, edicion, activacion, destacado y reordenamiento.
- Storefront publico por `businessSlug`, con solo productos activos y solo negocios con owner verificable.
- Creacion de pedidos desde el formulario publico y tambien desde el workspace privado.
- Lectura y mutacion privada de pedidos por el owner correcto.
- Metricas operativas basicas calculadas sobre pedidos persistidos.
- Negocios legacy sin owner tratados como casos no operativos/no soportados en runtime; no existe remediacion ni claim dentro del producto.

## 6. Garantias tecnicas activas

Las garantias activas del MVP hoy no viven solo en UI ni solo en handlers HTTP: cuando el dominio lo requiere, tambien estan reforzadas en DB y tests.

### Definiciones canonicas del MVP

- Supabase es la fuente de verdad de negocios, productos y pedidos del MVP.
- `businessId` significa UUID de base de datos y `businessSlug` significa slug de URL; rutas, params y helpers deben respetar esa frontera.
- Los negocios legacy sin owner son casos invalidos/no soportados del MVP: permanecen inaccesibles en workspace, storefront y pedidos operativos, y cualquier saneamiento debe ocurrir fuera del runtime antes de persistir `businesses.created_by_user_id`.
- `status`, `paymentStatus`, `history` y cualquier metadato derivable del pedido no son verdad cruda confiable del cliente; el server y la DB los derivan, validan o bloquean.
- El runtime normal del MVP usa solo cliente publico/anon acotado, cliente autenticado SSR y RLS; `SUPABASE_SERVICE_ROLE_KEY` queda aislada fuera de esa frontera.
- Una garantia no se considera cerrada si vive solo en UI, solo en handlers HTTP o solo en documentacion; cuando corresponde al dominio, tambien debe existir en runtime, DB y tests automatizados.
- `README.md` y `AGENTS.md` no pueden declarar mas de lo que garantizan runtime + DB + tests.

### Garantias operativas hoy activas

- El ownership se resuelve server-side desde sesion/contexto confiable; el cliente no autoriza recursos enviando `owner_id`, `created_by_user_id` ni `business_id`.
- El flujo normal no usa `SUPABASE_SERVICE_ROLE_KEY`; opera con cliente publico/anon acotado, cliente autenticado SSR y RLS.
- La creacion de pedidos ignora `status`, `paymentStatus`, `history` y cualquier campo derivable enviado por cliente.
- El estado inicial del pedido se deriva en servidor segun `paymentMethod`, y la DB rederiva y valida inserts/updates directos sobre `public.orders`.
- `Contra entrega` solo es valido para pedidos a domicilio, y esa regla existe en server y en DB.
- El historial inicial del pedido se genera en servidor/DB segun el origen real (`public_form` o `workspace_manual`).
- El historial del pedido es append-only bajo control server-side y DB; el cliente no puede reemplazar snapshots completos de `history`.
- `localStorage` queda limitado a estado visual no critico del workspace.

### Variables de entorno vigentes

- `NEXT_PUBLIC_SUPABASE_URL`: obligatoria.
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`: obligatoria.
- `NEXT_PUBLIC_SITE_URL`: obligatoria en produccion y con fallback local en desarrollo.
- `SUPABASE_SERVICE_ROLE_KEY`: opcional y aislada del runtime normal; solo puede leerse desde `lib/supabase/internal/service-role-client.ts`.

## 7. Limites actuales del producto

- No es un ERP ni un backoffice completo.
- No tiene multiusuario por negocio ni roles complejos.
- No tiene pagos automatizados, conciliacion ni pasarela integrada.
- No tiene inventario formal, variantes, categorias, imagenes ni logistica avanzada.
- No ofrece una remediacion runtime para negocios ownerless; si un caso legacy debe recuperarse, el saneamiento ocurre fuera del producto.
- No debe usarse como excusa para relajar naming, ownership o source of truth: el alcance es acotado, no ambiguo.

## 8. Siguiente etapa del proyecto

1. Migrar `middleware.ts` a `proxy` para cerrar la deuda de runtime pendiente de Next.
2. Extender los E2E hacia mas variantes del flujo operativo, como creacion manual de pedidos y metricas privadas.
3. Seguir simplificando el workspace sin abrir excepciones sobre ownership, naming ni source of truth.

## 9. E2E del circuito critico

La suite inicial de Playwright ya cubre el circuito base del MVP:

1. login de owner
2. creacion de negocio con owner
3. alta de un producto activo
4. acceso al storefront publico por `businessSlug`
5. creacion de pedido desde el formulario publico
6. verificacion de que el pedido aparece en `pedidos/[businessSlug]`
7. validacion de que otro usuario autenticado no puede abrir ni operar ese negocio

Ademas, la fase actual de E2E ya protege reglas criticas del dominio de pedidos:

1. pedidos digitales creados desde storefront nacen con `status` y `paymentStatus` derivados server-side
2. el POST publico ignora `status`, `paymentStatus`, `history` e `isReviewed` enviados por cliente
3. el historial inicial nace segun el origen real `public_form`
4. una mutacion valida desde workspace agrega eventos al historial sin reemplazar el snapshot previo
5. `Contra entrega` queda bloqueado para `recogida en tienda` en el formulario y tambien en el endpoint real
6. un pedido valido a domicilio con `Contra entrega` nace en el estado confirmado/verificado esperado

### Ejecucion

- `npm run test:e2e`
- `npm run test:e2e:headed`
- La base enlazada debe tener aplicadas las migraciones vigentes de `supabase/migrations`. Si el proyecto remoto queda atrasado respecto del repo, el owner puede quedar bloqueado por RLS al crear negocio o publicar productos y la suite E2E no cerrara el circuito real.

### Variables opcionales para E2E

- `PLAYWRIGHT_BASE_URL`: por defecto `http://localhost:3000`.
- `E2E_TEST_EMAIL_DOMAIN`: dominio opcional para los correos generados de owner/intruder E2E. Si no se define, la suite intenta derivar uno valido desde `NEXT_PUBLIC_SITE_URL` y, si sigue en `localhost`, usa un fallback sintacticamente aceptado por el runtime.
- `PLAYWRIGHT_OWNER_EMAIL` y `PLAYWRIGHT_OWNER_PASSWORD`: reutilizan un owner ya confirmado.
- `PLAYWRIGHT_INTRUDER_EMAIL` y `PLAYWRIGHT_INTRUDER_PASSWORD`: reutilizan un usuario autenticado distinto.
- Si esas credenciales no existen, la suite crea usuarios E2E confirmados en un bootstrap de tests aislado usando `SUPABASE_SERVICE_ROLE_KEY`. Ese uso queda fuera del runtime normal del MVP y solo existe para dejar el login E2E reproducible.
- `PLAYWRIGHT_SKIP_WEBSERVER=1`: desactiva el `webServer` de Playwright para correr contra una app ya levantada.
- `CI`: activa el perfil de reporter/retries pensado para runners automatizados.
