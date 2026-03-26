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
2. Sumar E2E del circuito critico de ownership, storefront, pedidos, pagos e historial.
3. Seguir simplificando el workspace sin abrir excepciones sobre ownership, naming ni source of truth.
