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
- `productId` significa UUID interno de producto; no existe un alias publico alterno para ese identificador.
- `orderId` significa UUID interno del pedido y `orderCode` significa identificador visible/operativo del pedido.
- Los negocios legacy sin owner son casos invalidos/no soportados del MVP: permanecen inaccesibles en workspace, storefront y pedidos operativos, y cualquier saneamiento debe ocurrir fuera del runtime antes de persistir `businesses.created_by_user_id`.
- `status`, `paymentStatus`, `history` y cualquier metadato derivable del pedido no son verdad cruda confiable del cliente; el server y la DB los derivan, validan o bloquean.
- El runtime normal del MVP usa solo cliente publico/anon acotado, cliente autenticado SSR y RLS; `SUPABASE_SERVICE_ROLE_KEY` queda aislada fuera de esa frontera.
- Una garantia no se considera cerrada si vive solo en UI, solo en handlers HTTP o solo en documentacion; cuando corresponde al dominio, tambien debe existir en runtime, DB y tests automatizados.
- `README.md` y `AGENTS.md` no pueden declarar mas de lo que garantizan runtime + DB + tests.

### Invariantes adicionales

- La administracion centralizada de la cuenta y los negocios vive en `/ajustes`; no mezcla metricas de plataforma.
- `/dashboard` redirige a `/ajustes` o resuelve directo al workspace del negocio activo si corresponde.
- `/ajustes` permite listar negocios, crear nuevos, editar nombres, desactivar negocios (logicamente) y gestionar el perfil de usuario.
- Un negocio desactivado no es operable publicamente ni aparece como opcion activa, pero conserva sus pedidos e historicos.
- `/admin` es el panel interno de plataforma y existe solo para `platform_admin`.
- `public.user_profiles.role` respaldado por `public.app_role` es la fuente canonica del rol autenticado.
- Los roles validos del sistema son `platform_admin`, `business_owner` y `customer`; el MVP actual solo habilita operativamente `platform_admin` y `business_owner`.
- `user` no es un rol valido para representar al dueno de negocio.
- `localStorage` solo puede guardar estado de UI no critico.
- `lib/supabase/server.ts` y `lib/supabase/client.ts` pertenecen al runtime normal; no deben mezclar borde privilegiado.
- Si una regla sensible existe en DB, el runtime no debe contradecirla ni duplicarla con otro contrato.
- `Transferencia` es el unico metodo generico para pagos por transferencia del MVP; aliases como `Nequi`, `Daviplata`, `Bre-B` y similares viven solo dentro de `businesses.transfer_instructions`, no como metodos distintos del dominio.
- `businesses.transfer_instructions` es la fuente oficial editable por negocio para indicar como transferir y como enviar el comprobante por WhatsApp.
- Los metodos publicos visibles al cliente se gobiernan por flags persistidos del negocio (`accepts_cash`, `accepts_transfer`, `accepts_card`); `allows_fiado` no expone una opcion publica nueva.
- Un producto que ya aparece en pedidos historicos persistidos no puede borrarse bajo ningun carril operativo del MVP; solo puede desactivarse.

### Estado real auditado del repo

- El flujo operativo base respaldado hoy por runtime + tests incluye login, proteccion temprana de rutas privadas con `proxy.ts`, creacion de negocio con owner, catalogo activo, storefront publico por `businessSlug`, pedido persistido y operacion privada del owner correcto.
- El dashboard general de seleccion deja de ser protagonista del flujo privado del MVP: el workspace del negocio es la unica entrada natural al trabajo operativo y el cambio de negocio queda dentro de la navbar privada.
- El frente de pedidos/pagos/historial esta reforzado simultaneamente en runtime, funciones SQL/trigger/policies y guardrails automatizados; hoy es el frente con mayor cierre tecnico verificable del repo.
- El frente de naming canonico (`businessId`, `businessSlug`, `productId`, `orderId`, `orderCode`) tiene guardrails activos en tipos, rutas, helpers y tests; no debe volver a mezclarse con slugs o ids genericos.
- El frente de service role del runtime normal esta cerrado a nivel operativo: el flujo productivo carga con anon + SSR auth + RLS, y la unica excepcion activa es test-only para bootstrap de fixtures E2E de Auth.
- El login por email/password con fixtures dedicadas por email/password es el unico carril oficial de acceso respaldado por evidencia fuerte del repo.
- El panel interno `/admin` ya queda separado del workspace del negocio, respaldado por `public.user_profiles.role`, guard server-side, capa de datos admin dedicada y spec E2E real de acceso permitido/denegado por rol.
- El registro manual por email/password puede seguir expuesto en runtime solo como carril secundario/no garantizado; mientras dependa de confirmacion de correo o configuracion incierta del entorno no debe venderse como parte cerrada del MVP.
- Google OAuth puede existir solo como opcion secundaria de login; `/register` permanece manual y el carril tampoco forma parte del circuito cerrado mientras no tenga evidencia E2E equivalente.
- Las metricas privadas quedan cerradas con la misma definicion efectiva en runtime, Supabase enlazado, spec E2E dedicada y documentacion; el frente no debe volver a depender de drift entre repo y proyecto remoto.
- La gestion de productos existe en runtime para crear, editar, activar, destacar, reordenar y borrar, y el veto de borrado por uso historico ya queda reforzado en runtime, trigger de DB y pruebas automatizadas; no debe volver a vivir solo en runtime.

## 4. Reglas de contratos y naming

- `businessId` solo puede significar UUID de base de datos.
- `businessSlug` solo puede significar slug de URL.
- `productId` solo puede significar UUID interno de producto.
- `orderId` solo puede significar UUID interno de pedido.
- `orderCode` solo puede significar identificador visible del pedido.
- No se aceptan nombres publicos heredados o ambiguos que mezclen slug de URL con UUID de base de datos.
- Un helper `byId` debe consultar por id real; un helper `bySlug` debe consultar por slug real.
- Un payload o response de pedidos/productos no puede exponer `id` generico cuando el contrato real es `orderId` o `productId`.
- Variables, params, helpers, payloads y docs deben usar el mismo naming canonicamente.
- No se dejan aliases ambiguos para compatibilidad si conservan una mentira contractual.

## 5. Reglas de ownership y acceso

- El rol autenticado canonico vive en `public.user_profiles.role` y usa el enum `public.app_role`.
- `platform_admin` puede entrar a `/admin` y consultar metricas globales de plataforma.
- `business_owner` opera negocios propios y no puede acceder a `/admin`.
- `customer` existe como contrato tipado/persistido, pero no habilita superficie operativa del MVP actual.
- `/admin` es solo para `platform_admin`; no existe `/admin/login` ni una elevacion de privilegios por UI.
- Ningun negocio es operable si `created_by_user_id` es `null` o no coincide con el usuario autenticado esperado.
- En DB, el ownership canonico del negocio vive en `public.businesses.created_by_user_id`; en el runtime TypeScript se expone como `createdByUserId`.
- El server resuelve ownership desde sesion/contexto confiable; no acepta aliases de ownership ni `business_id` del cliente como autoridad.
- Un negocio ownerless no puede abrir workspace privado.
- Un negocio ownerless no puede exponerse en storefront publico.
- Un negocio ownerless no puede recibir ni operar pedidos normales.
- Ownerless no debe volver a quedar operativo en runtime. No existe claim ni remediacion dentro del producto.
- Cualquier saneamiento de un negocio ownerless ocurre fuera del runtime del MVP y solo antes de persistir un owner valido.

### Estado real auditado del frente legacy ownerless

- Runtime, UI y tests vigentes tratan `ownerless` como caso bloqueado: no abre workspace, no expone storefront operativo y no acepta pedidos normales.
- La definicion final efectiva del arbol de migraciones tambien deja retiradas las tablas, funciones, triggers y GRANTs de `request/grant/claim/list` para ownerless legacy.
- El unico contrato SQL vigente para ese frente es el veto explicito `ownerless -> owned` dentro del MVP; cualquier migracion posterior que reabra esa superficie debe tratarse como regresion.

## 6. Reglas de pedidos, pagos e historial

- `status`, `paymentStatus` y `history` no son verdad cruda confiable del cliente.
- `Transferencia` es el unico metodo digital generico del sistema; `Nequi`, `Daviplata`, `Bre-B` y similares no pueden reaparecer como opciones, enums ni payloads operativos separados.
- El POST de pedidos solo acepta datos editables; cualquier campo derivable enviado por cliente se ignora.
- El estado inicial del pedido se deriva en servidor y la DB debe rederivar/validar inserts directos cuando corresponda.
- El PATCH de pedidos solo puede persistir estados coherentes y transiciones permitidas.
- El flujo principal del pedido es `nuevo -> confirmado -> en preparación -> listo -> entregado`; `cancelado` es un estado excepcional separado del board principal, exige motivo obligatorio y solo puede volver al flujo por reactivacion exacta al estado previo guardado.
- La compuerta financiera vive dentro de `nuevo`: solo `paymentStatus=verificado`, `Contra entrega` o `fiado` habilitan `nuevo -> confirmado`; `pendiente`, `no verificado/por verificar` y `con novedad` no abren esa transicion.
- Fiado es una dimension interna separada del metodo de pago: solo puede activarse en superficie privada autorizada, exige `fiadoObservation` y no puede exponerse al cliente como metodo seleccionable.
- `Contra entrega` no puede existir como regla solo de UI; debe validarse tambien en server o DB.
- El historial inicial no puede nacer desde cliente.
- El cliente no puede reemplazar snapshots completos de `history`.
- Si el historial es append-only, la DB debe impedir writes directos y obligar una funcion o frontera controlada.
- Un frente de pedidos/pagos/historial no se considera cerrado si la garantia vive solo en handlers HTTP.

### Estado real auditado del frente de pedidos

- El POST publico y el POST privado de pedidos existen en runtime y persisten en Supabase con `origin` server-side (`public_form` y `workspace_manual`).
- El estado inicial del pedido, la compatibilidad entre `deliveryType` y `paymentMethod`, y el historial inicial se derivan server-side y tambien en DB.
- Las instrucciones de transferencia del negocio viven en `businesses.transfer_instructions`, se editan desde el workspace y alimentan el mensaje operativo de comprobante por WhatsApp.
- Los flags publicos de metodos por negocio y el fiado interno manual tambien viven en DB y runtime; `Fiado` no reabre el frente de `Transferencia` ni reaparece en checkout publico.
- El frente operativo de pedidos queda partido por breakpoint real: desktop vive como board por estados, movil vive como tabs por estado con lista vertical sin scroll horizontal, `cancelado` queda en vista secundaria y la revision de pago sigue resolviendose dentro de `nuevo`.
- El PATCH operativo usa la funcion controlada `public.update_order_with_server_history`; el cliente no fabrica ni reemplaza snapshots completos de `history`.
- La cancelacion excepcional y la reactivacion exacta tambien pasan por `public.update_order_with_server_history`; la DB guarda `previous_status_before_cancellation`, motivo canonico, actor, timestamp e historial legible.
- La cancelacion excepcional y su metadata (`previous_status_before_cancellation`, `cancellation_reason`, `cancellation_detail`) dependen de la definicion efectiva introducida en `20260329002_rework_order_operational_flow_and_cancellation.sql`; si el proyecto remoto queda atrasado respecto de esa migracion, ese frente vuelve a estado no cerrado aunque el repo local tenga runtime y tests alineados.
- Mientras un pedido este en fiado pendiente no debe entrar a ventas efectivas; solo vuelve a contarse cuando el negocio lo marca manualmente como pagado.
- El frente de pedidos si tiene evidencia automatizada en varios niveles: guardrails unitarios, auditorias de migraciones SQL, integracion real de DB y specs E2E del flujo publico + operacion privada.

## 7. Reglas sobre entorno y service role

- El runtime normal del MVP opera solo con cliente publico/anon acotado, cliente autenticado SSR y RLS.
- `SUPABASE_SERVICE_ROLE_KEY` no puede leerse, tiparse ni transportarse desde `lib/env.ts`.
- El unico helper autorizado para leer `SUPABASE_SERVICE_ROLE_KEY` es `lib/supabase/internal/service-role-client.ts`.
- Cualquier uso activo de service role en rutas, acciones server o acceso operativo a negocios, productos o pedidos vuelve el cambio `NO APTO TODAVIA`, salvo excepcion documentada y aprobada en `lib/supabase/service-role.ts`.
- Las variables canonicas del repo son `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_GOOGLE_AUTH_ENABLED`, `NEXT_PUBLIC_SITE_URL` y `SUPABASE_SERVICE_ROLE_KEY`.
- Si `NEXT_PUBLIC_GOOGLE_AUTH_ENABLED` falta o esta apagada, Google no se expone en `/login` ni se admite el callback OAuth con `code` dentro del runtime normal.
- Variables de test-only para Playwright/CI (`PLAYWRIGHT_BASE_URL`, `PLAYWRIGHT_E2E_PASSWORD`, `PLAYWRIGHT_E2E_NAMESPACE`, `PLAYWRIGHT_SKIP_WEBSERVER`, `CI`) no forman parte del runtime normal del MVP ni autorizan acceso operativo; solo parametrizan la ejecucion automatizada de la suite E2E.
- La suite E2E de Playwright bootstrapea fixtures de Auth dedicadas y no humanas al inicio; usa service role aislada de test solo en `tests/helpers/playwright-global-setup.ts`, confirma esas cuentas (`admin`, `owner`, `intruder`) sin correo y falla cerrado si faltan prerequisitos o si el login real no queda operativo.
- `AGENTS.md`, `README.md`, `.env.example` y `lib/env.ts` no pueden divergir sobre variables operativas.
- No deben aparecer lecturas directas nuevas de `process.env` fuera de `lib/env.ts`, salvo la excepcion privilegiada aislada.

## 8. Auditoria obligatoria antes de cerrar cambios

- Auditar runtime, DB, tests y documentacion del frente tocado.
- Buscar bypass por escritura directa, por rutas secundarias y por contratos de cliente.
- Auditar la ultima definicion efectiva de funciones SQL, triggers, policies y grants por orden de migraciones; una migracion vieja no vale como evidencia si otra posterior la contradice.
- Si una migracion posterior reabre una superficie previamente retirada, el frente vuelve a estado no cerrado aunque runtime, tests parciales o docs sigan afirmando la estrategia final.
- Distinguir cobertura por nivel: unitario, integracion real de DB y E2E. No declarar "validado de punta a punta" un flujo que solo tiene pruebas unitarias o lectura documental.
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

### Frentes hoy respaldados con evidencia fuerte

- Login real con Supabase Auth SSR y proteccion temprana de rutas privadas con `proxy.ts`.
- Creacion de negocios con owner resuelto desde sesion y acceso privado por ownership real.
- Panel interno `/admin` con roles persistidos (`platform_admin`, `business_owner`, `customer`), guard server-side, queries globales separadas y spec E2E real de acceso por rol.
- Catalogo operativo basico por negocio con lectura privada, mutacion autenticada y storefront publico por `businessSlug`.
- Borrado seguro de productos historicos: un producto ya usado en pedidos persistidos no puede eliminarse ni desde runtime ni desde deletes directos sobre DB.
- Metricas privadas respaldadas por runtime, base Supabase enlazada y spec E2E real para ownership, aislamiento por negocio, regla de fiado y ausencia de dependencia de `localStorage`.
- Pedido publico y pedido manual persistidos en Supabase con estado, pago e historial bajo control server-side + DB.
- Aislamiento del borde privilegiado: sin service role en runtime normal y con bootstrap E2E aislado solo para test.
- Cierre legacy ownerless: runtime, UI, definicion final efectiva de migraciones SQL y guardrails automatizados coinciden en retirar `request/grant/claim/list` y bloquear `ownerless -> owned` dentro del MVP.

### Frentes hoy parciales o abiertos

- Google OAuth opcional: puede existir en runtime solo como salida secundaria de `/login`, pero no tiene la misma evidencia E2E del login por email/password y puede depender de configuracion real del provider segun el entorno.
