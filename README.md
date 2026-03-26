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
- Creacion publica e interna de pedidos con estado inicial, historial e indicadores operativos derivados server-side segun el origen del pedido.
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

Tecpify ya es operativo en su circuito central, pero sigue en fase de consolidacion tecnica. El nucleo de negocios, productos y pedidos persiste en Supabase, el ownership se resuelve server-side y la creacion de pedidos deriva sus metadatos operativos en el servidor, mientras `localStorage` queda limitado a estado visual no critico del workspace.

Las deudas mas visibles hoy no son de feature count sino de consistencia y mantenimiento: naming heredado donde `[negocioId]` sigue representando un slug, migracion pendiente de `middleware.ts` a `proxy`, flujo faltante para migrar negocios legacy sin owner y simplificacion pendiente de algunas vistas del workspace.

## 8. Stack o base tecnica

- Next.js 16, React 19 y TypeScript.
- Supabase como base operativa para auth, datos y RLS.
- Route handlers y modulos server como frontera principal de negocio.
- Pruebas automatizadas con `node:test` para ownership, entorno, service role y contratos del MVP.

### Variables de entorno vigentes

- `NEXT_PUBLIC_SUPABASE_URL`: obligatoria.
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`: obligatoria.
- `NEXT_PUBLIC_SITE_URL`: obligatoria en produccion, con fallback local en desarrollo.
- `SUPABASE_SERVICE_ROLE_KEY`: opcional y sin uso operativo activo en el runtime normal del MVP.

Arranque local minimo: define esas variables, ejecuta `npm install` y luego `npm run dev`.

## 9. Principios actuales del proyecto

- Persistencia real antes que estados locales improvisados.
- Fronteras claras entre cliente, server y acceso a datos.
- Ownership resuelto del lado server para evitar acceso cruzado entre negocios.
- Catalogo y pedidos tratados como nucleo operativo del MVP.
- Cambios pequenos, testeables y compatibles con el estado real del repo.

## 10. Proximos pasos prioritarios

1. Reducir naming heredado para que slug e id no se mezclen en nuevas capas.
2. Migrar `middleware.ts` a `proxy` en la siguiente ronda de mantenimiento de runtime.
3. Definir una salida operativa para negocios legacy sin `created_by_user_id`.
4. Sumar E2E browser del circuito critico y seguir simplificando el workspace.

## 11.1 Contrato verificable del MVP

- Supabase es la fuente de verdad de negocios, productos y pedidos del MVP.
- `localStorage` solo puede guardar estado de UI no critico.
- El canon server/API resuelve ownership desde sesion/contexto confiable; no acepta `owner_id`, `created_by_user_id` ni `business_id` del cliente como autoridad.
- La creacion de pedidos solo acepta datos editables del pedido; estado inicial, historial e indicadores operativos se derivan en servidor segun el origen publico o autenticado.
- `lib/supabase/server.ts` solo expone clientes `public` y `auth`.
- `SUPABASE_SERVICE_ROLE_KEY` no participa en el runtime normal del MVP.
- Toda lectura de `process.env` debe vivir en `lib/env.ts`.

## 12. Cierre breve sobre la vision del MVP

La vision de Tecpify en esta etapa no es abarcar todo el negocio de una vez. Es demostrar que un pequeno negocio puede centralizar catalogo, pedido y operacion diaria sobre una base real, con ownership claro y una ruta publica util. Cuando ese circuito sea mas simple, mantenible y consistente, el MVP estara listo para ampliar alcance sin perder foco.
