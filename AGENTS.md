# AGENTS

## 1. Proposito

Este archivo es el contrato operativo de consistencia del MVP. Su funcion no es describir aspiraciones sino impedir regresiones: cualquier cambio debe mantener alineados runtime, DB, tests y documentacion.

## 2. Principios obligatorios

- El repo se evalua por garantias reales, no por intencion, UI agradable ni build verde.
- Ningun contrato sensible puede depender de que el cliente sea honesto.
- Ningun naming puede mentir sobre el valor real que transporta.
- Ninguna garantia se declara cerrada si solo vive en UI, solo en handlers HTTP o solo en documentacion.
- Si README y AGENTS sobredeclaran, gana el codigo real y la documentacion debe corregirse en la misma ronda.

## 3. Invariantes de arquitectura

### Definiciones canonicas del MVP

- Supabase es la fuente de verdad de negocios, productos y pedidos del MVP.
- `businessId` significa UUID de base de datos y `businessSlug` significa slug de URL; rutas, params y helpers deben respetar esa frontera.
- Los negocios legacy sin owner son casos invalidos/no soportados del MVP: permanecen inaccesibles en workspace, storefront y pedidos operativos, y cualquier saneamiento debe ocurrir fuera del runtime antes de persistir `businesses.created_by_user_id`.
- `status`, `paymentStatus`, `history` y cualquier metadato derivable del pedido no son verdad cruda confiable del cliente; el server y la DB los derivan, validan o bloquean.
- El runtime normal del MVP usa solo cliente publico/anon acotado, cliente autenticado SSR y RLS; `SUPABASE_SERVICE_ROLE_KEY` queda aislada fuera de esa frontera.
- Una garantia no se considera cerrada si vive solo en UI, solo en handlers HTTP o solo en documentacion; cuando corresponde al dominio, tambien debe existir en runtime, DB y tests automatizados.
- `README.md` y `AGENTS.md` no pueden declarar mas de lo que garantizan runtime + DB + tests.

### Invariantes adicionales

- `localStorage` solo puede guardar estado de UI no critico.
- `lib/supabase/server.ts` y `lib/supabase/client.ts` pertenecen al runtime normal; no deben mezclar borde privilegiado.
- Si una regla sensible existe en DB, el runtime no debe contradecirla ni duplicarla con otro contrato.

## 4. Reglas de contratos y naming

- `businessId` solo puede significar UUID de base de datos.
- `businessSlug` solo puede significar slug de URL.
- No se aceptan nombres publicos heredados o ambiguos que mezclen slug de URL con UUID de base de datos.
- Un helper `byId` debe consultar por id real; un helper `bySlug` debe consultar por slug real.
- Variables, params, helpers, payloads y docs deben usar el mismo naming canonicamente.
- No se dejan aliases ambiguos para compatibilidad si conservan una mentira contractual.

## 5. Reglas de ownership y acceso

- Ningun negocio es operable si `created_by_user_id` es `null` o no coincide con el usuario autenticado esperado.
- El server resuelve ownership desde sesion/contexto confiable; no acepta `owner_id`, `created_by_user_id` ni `business_id` del cliente como autoridad.
- Un negocio ownerless no puede abrir workspace privado.
- Un negocio ownerless no puede exponerse en storefront publico.
- Un negocio ownerless no puede recibir ni operar pedidos normales.
- Ownerless no debe volver a quedar operativo en runtime. No existe claim ni remediacion dentro del producto.
- Cualquier saneamiento de un negocio ownerless ocurre fuera del runtime del MVP y solo antes de persistir un owner valido.

## 6. Reglas de pedidos, pagos e historial

- `status`, `paymentStatus` y `history` no son verdad cruda confiable del cliente.
- El POST de pedidos solo acepta datos editables; cualquier campo derivable enviado por cliente se ignora.
- El estado inicial del pedido se deriva en servidor y la DB debe rederivar/validar inserts directos cuando corresponda.
- El PATCH de pedidos solo puede persistir estados coherentes y transiciones permitidas.
- `Contra entrega` no puede existir como regla solo de UI; debe validarse tambien en server o DB.
- El historial inicial no puede nacer desde cliente.
- El cliente no puede reemplazar snapshots completos de `history`.
- Si el historial es append-only, la DB debe impedir writes directos y obligar una funcion o frontera controlada.
- Un frente de pedidos/pagos/historial no se considera cerrado si la garantia vive solo en handlers HTTP.

## 7. Reglas sobre entorno y service role

- El runtime normal del MVP opera solo con cliente publico/anon acotado, cliente autenticado SSR y RLS.
- `SUPABASE_SERVICE_ROLE_KEY` no puede leerse, tiparse ni transportarse desde `lib/env.ts`.
- El unico helper autorizado para leer `SUPABASE_SERVICE_ROLE_KEY` es `lib/supabase/internal/service-role-client.ts`.
- Cualquier uso activo de service role en rutas, acciones server o acceso operativo a negocios, productos o pedidos vuelve el cambio `NO APTO TODAVIA`, salvo excepcion documentada y aprobada en `lib/supabase/service-role.ts`.
- Las variables canonicas del repo son `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_SITE_URL` y `SUPABASE_SERVICE_ROLE_KEY`.
- Variables de test-only para Playwright/CI (`PLAYWRIGHT_BASE_URL`, `PLAYWRIGHT_OWNER_EMAIL`, `PLAYWRIGHT_OWNER_PASSWORD`, `PLAYWRIGHT_INTRUDER_EMAIL`, `PLAYWRIGHT_INTRUDER_PASSWORD`, `PLAYWRIGHT_SKIP_WEBSERVER`, `CI`) no forman parte del runtime normal del MVP ni autorizan acceso operativo; solo parametrizan la ejecucion automatizada de la suite E2E.
- `AGENTS.md`, `README.md`, `.env.example` y `lib/env.ts` no pueden divergir sobre variables operativas.
- No deben aparecer lecturas directas nuevas de `process.env` fuera de `lib/env.ts`, salvo la excepcion privilegiada aislada.

## 8. Auditoria obligatoria antes de cerrar cambios

- Auditar runtime, DB, tests y documentacion del frente tocado.
- Buscar bypass por escritura directa, por rutas secundarias y por contratos de cliente.
- Ejecutar `npm run lint`.
- Ejecutar `npm run typecheck`.
- Ejecutar `npm test`.
- Ejecutar `npm run build`.
- Ejecutar tests especificos del area tocada y los guardrails de documentacion/entorno si el cambio toca contratos, ownership, pedidos, naming o service role.
- Actualizar README y AGENTS en la misma ronda si cambia el contrato real del sistema.

## 9. Criterio estricto para declarar un frente como cerrado

- Un frente solo puede declararse cerrado si la garantia existe simultaneamente en runtime, DB cuando corresponde, tests automatizados y documentacion alineada.
- Un frente no esta cerrado si la garantia vive solo en UI.
- Un frente no esta cerrado si la garantia vive solo en handlers HTTP.
- Un frente no esta cerrado si la DB permite bypass directo de la regla relevante.
- Un frente no esta cerrado si README o AGENTS prometen mas de lo que garantizan runtime + DB + tests.
- Un frente no esta cerrado si reintroduce ownerless operativo, service role en flujo normal, naming enganoso o confianza en `status`, `paymentStatus` o `history` enviados por cliente.
