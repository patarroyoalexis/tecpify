# Tecpify

## 1. Que es Tecpify

Tecpify es un MVP para pequenos negocios que necesitan publicar un catalogo simple, recibir pedidos reales desde un link publico y operarlos desde un espacio privado. Hoy su foco es resolver ese circuito operativo minimo con persistencia real, no convertirse en un ERP ni en un backoffice completo.

## 2. Problema que busca resolver

Muchos negocios pequenos toman pedidos por WhatsApp, Instagram o llamadas y terminan sin una base clara para catalogo, pedidos y seguimiento. Tecpify busca ordenar ese flujo con una sola fuente de verdad para el nucleo operativo del negocio.

## 3. Objetivo actual del MVP

El objetivo actual es validar que un negocio pueda crear su espacio, cargar productos, compartir un link publico, recibir pedidos persistidos en Supabase, operarlos desde el workspace privado y leer metricas operativas simples. La prioridad sigue siendo consolidar esa base tecnica antes de ampliar alcance.

## 4. Circuito principal validado

`negocio -> catalogo -> link publico -> pedido -> operacion interna -> metricas`

Hoy ese circuito incluye:

1. registro o login del operador
2. creacion del negocio con ownership real
3. publicacion de productos activos
4. pedido publico persistido en Supabase
5. lectura y actualizacion privada del pedido
6. lectura operativa en dashboard, pedidos y metricas

## 5. Que funciona hoy

- Supabase Auth SSR para registro, login y sesion del operador.
- Creacion de negocios con `created_by_user_id` y acceso privado resuelto por ownership.
- Catalogo por negocio con alta, edicion, activacion, destacado y reordenamiento.
- Storefront publico por slug, con solo productos activos y solo negocios con owner verificable.
- Creacion de pedidos desde el link publico y tambien desde el workspace privado.
- Creacion publica e interna de pedidos con `status`, `paymentStatus` e historial inicial autoritativos en servidor, y blindaje en `public.orders` para rederivar el estado inicial y rechazar combinaciones incoherentes de pago, incluida `Contra entrega` fuera de domicilio.
- Remediacion auditable de negocios legacy sin owner mediante solicitud autenticada, habilitacion controlada de claim y persistencia final de `created_by_user_id`.
- Lectura y mutacion privada de pedidos, con `status` y `paymentStatus` separados.
- Verificacion de pago todavia manual o asistida desde la operacion, no automatizada.
- Metricas operativas basicas calculadas sobre pedidos persistidos.
- Guardrails automatizados para ownership, service role, entorno y congruencia documental.

## 6. Que no es Tecpify hoy

- No es un ERP ni un backoffice completo.
- No tiene multiusuario por negocio ni roles complejos.
- No tiene pagos automatizados, conciliacion ni pasarela integrada.
- No tiene inventario formal, variantes, categorias, imagenes ni logistica.
- No ofrece multi-sucursal, analitica avanzada ni BI historico.
- No esta endurecido para escalar sin antes cerrar deuda tecnica del MVP.

## 7. Estado actual del proyecto

Tecpify ya es operativo en su circuito central, pero sigue en fase de consolidacion tecnica. El nucleo de negocios, productos y pedidos persiste en Supabase, el ownership se resuelve server-side, los negocios legacy ownerless pasan por una remediacion auditable antes de volver a operar y la creacion de pedidos deriva estado e historial en el servidor, mientras `localStorage` queda limitado a estado visual no critico del workspace.

Las deudas mas visibles hoy no son de feature count sino de consistencia y mantenimiento: migracion pendiente de `middleware.ts` a `proxy` y simplificacion pendiente de algunas vistas del workspace.

## 8. Stack o base tecnica

- Next.js 16, React 19 y TypeScript.
- Supabase como base operativa para auth, datos y RLS.
- Route handlers y modulos server como frontera principal de negocio.
- Pruebas automatizadas con `node:test` para ownership, entorno, service role y contratos del MVP.

### Variables de entorno vigentes

- `NEXT_PUBLIC_SUPABASE_URL`: obligatoria.
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`: obligatoria.
- `NEXT_PUBLIC_SITE_URL`: obligatoria en produccion, con fallback local en desarrollo.
- `SUPABASE_SERVICE_ROLE_KEY`: opcional y aislada del runtime normal; solo puede leerse desde `lib/supabase/internal/service-role-client.ts`.

Arranque local minimo: define esas variables, ejecuta `npm install` y luego `npm run dev`.

## 9. Principios actuales del proyecto

- Persistencia real antes que estados locales improvisados.
- Fronteras claras entre cliente, server y acceso a datos.
- Ownership resuelto del lado server para evitar acceso cruzado entre negocios.
- Catalogo y pedidos tratados como nucleo operativo del MVP.
- Cambios pequenos, testeables y compatibles con el estado real del repo.

## 10. Proximos pasos prioritarios

1. Migrar `middleware.ts` a `proxy` en la siguiente ronda de mantenimiento de runtime.
2. Sumar E2E browser del circuito critico, incluyendo la remediacion legacy con claim controlado.
3. Seguir simplificando el workspace sin abrir excepciones sobre ownership ni source of truth.

## 11.1 Contrato verificable del MVP

- Supabase es la fuente de verdad de negocios, productos y pedidos del MVP.
- `localStorage` solo puede guardar estado de UI no critico.
- `businessId` significa UUID de base de datos y `businessSlug` significa slug de URL; rutas, params y helpers deben respetar esa frontera.
- El canon server/API resuelve ownership desde sesion/contexto confiable; no acepta `owner_id`, `created_by_user_id` ni `business_id` del cliente como autoridad.
- Los negocios legacy sin owner solo salen de `ownerless_*` mediante remediacion auditable y siguen inaccesibles hasta persistir `businesses.created_by_user_id`.
- La creacion y mutacion sensible de pedidos no dependen solo de handlers HTTP: cualquier `status`, `paymentStatus`, `history` o metadato derivable enviado por cliente se ignora en servidor, y `public.orders` rederiva el estado inicial y rechaza combinaciones incoherentes de pago o `Contra entrega` fuera de domicilio mediante policies y triggers.
- `lib/supabase/server.ts` solo expone clientes `public` y `auth`.
- `SUPABASE_SERVICE_ROLE_KEY` no participa ni se transporta en el runtime normal del MVP; solo existe en el helper interno privilegiado.
- Toda lectura de `process.env` debe vivir en `lib/env.ts`, salvo `SUPABASE_SERVICE_ROLE_KEY` aislada dentro de `lib/supabase/internal/service-role-client.ts`.

## 12. Cierre breve sobre la vision del MVP

La vision de Tecpify en esta etapa no es abarcar todo el negocio de una vez. Es demostrar que un pequeno negocio puede centralizar catalogo, pedido y operacion diaria sobre una base real, con ownership claro y una ruta publica util. Cuando ese circuito sea mas simple, mantenible y consistente, el MVP estara listo para ampliar alcance sin perder foco.
