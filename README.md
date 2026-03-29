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

`login -> negocio con owner -> catalogo activo -> storefront publico -> pedido persistido -> operacion privada`

Ese es el circuito hoy validado con mayor evidencia automatizada y usa Supabase como base real para auth, datos y reglas de acceso.

El login por email/password si forma parte de ese carril oficial. El registro manual permanece accesible solo como carril secundario/no garantizado y no debe venderse como frente cerrado del MVP.

## 5. Estado funcional actual

- Login y sesion del operador con Supabase Auth SSR por email/password; este es el carril oficial validado con evidencia automatizada fuerte mediante fixtures dedicadas.
- El registro manual por email/password sigue accesible en runtime solo como carril secundario/no garantizado; puede requerir confirmacion de correo y configuracion real de Supabase Auth antes de dejar operativo el login.
- Google OAuth opcional puede aparecer solo como carril secundario en `/login` cuando el proveedor esta configurado, pero no reemplaza el login por email/password ni forma parte del circuito cerrado del MVP.
- Proteccion temprana de rutas privadas con `proxy.ts`, conservando `redirectTo` hacia `/login`.
- Creacion de negocios con ownership persistido en `created_by_user_id` y expuesto en runtime como `createdByUserId`.
- Catalogo por negocio con alta, edicion, activacion, destacado y reordenamiento.
- Storefront publico por `businessSlug`, con solo productos activos y solo negocios con owner verificable.
- Creacion de pedidos desde el formulario publico y tambien desde el workspace privado.
- Lectura y mutacion privada de pedidos por el owner correcto.
- Pagos por transferencia modelados con un unico metodo `Transferencia`; variantes como Nequi o Daviplata viven como instrucciones configurables del negocio y no como metodos separados del sistema.
- Configuracion operativa por negocio con flags publicos (`acceptsCash`, `acceptsTransfer`, `acceptsCard`) y `allowsFiado` solo para operacion interna.
- Fiado interno manual por pedido, con observacion obligatoria, estado binario (`pending` o `paid`) y sin calculos de deuda, saldo ni cartera.
- Metricas operativas basicas calculadas sobre pedidos persistidos, con evidencia E2E real sobre el Supabase enlazado para ownership, aislamiento por negocio, regla de fiado y ausencia de dependencia de `localStorage`.
- El borrado de productos usados queda bloqueado de forma canonica en runtime y DB; un producto ya referenciado en pedidos historicos persistidos no puede eliminarse.
- Negocios legacy sin owner tratados como casos no operativos/no soportados en runtime, UI y definicion final efectiva de migraciones SQL; el repo no expone panel, rutas runtime ni funciones SQL activas de remediacion/claim legacy.

## 6. Garantias tecnicas activas

Las garantias activas del MVP hoy no viven solo en UI ni solo en handlers HTTP: cuando el dominio lo requiere, tambien estan reforzadas en DB y tests.

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

### Garantias operativas hoy activas

- En DB, el ownership canonico del negocio vive en `public.businesses.created_by_user_id`; en el runtime TypeScript se expone como `createdByUserId`.
- El ownership se resuelve server-side desde sesion/contexto confiable; el cliente no autoriza recursos enviando aliases de ownership ni `business_id`.
- El flujo normal no usa `SUPABASE_SERVICE_ROLE_KEY`; opera con cliente publico/anon acotado, cliente autenticado SSR y RLS.
- La creacion de pedidos ignora `status`, `paymentStatus`, `history` y cualquier campo derivable enviado por cliente.
- `Transferencia` es el unico metodo generico de transferencia del MVP y las instrucciones reales del negocio para pagar/comprobar viven en `businesses.transfer_instructions`.
- Los metodos publicos visibles al cliente se derivan de flags por negocio; Fiado no es un metodo publico y nunca aparece en checkout ni formularios del cliente.
- El estado inicial del pedido se deriva en servidor segun `paymentMethod`, y la DB rederiva y valida inserts/updates directos sobre `public.orders`.
- El flujo operativo principal del pedido hoy vive en `Nuevo -> Confirmado -> Preparación -> Listo -> Entregado`; `Cancelado` es una salida excepcional separada, con motivo obligatorio, estado previo persistido y reactivacion exacta al punto anterior.
- La compuerta financiera vive dentro de `Nuevo`: solo `paymentStatus=verificado`, `Contra entrega` o `Fiado` habilitan `Nuevo -> Confirmado`; `Pendiente`, `Por verificar` y `Con novedad` no abren esa transicion.
- `Contra entrega` solo es valido para pedidos a domicilio, y esa regla existe en server y en DB.
- El board desktop de pedidos usa columnas por estado operativo y mantiene `Cancelado` fuera del flujo principal; la semantica visual y los CTAs quedan centralizados para reutilizarse despues en movil sin duplicar logica.
- El historial inicial del pedido se genera en servidor/DB segun el origen real (`public_form` o `workspace_manual`).
- El historial del pedido es append-only bajo control server-side y DB; el cliente no puede reemplazar snapshots completos de `history`.
- Un producto ya referenciado en pedidos historicos persistidos no puede borrarse: el veto vive en runtime y tambien en DB, incluso ante deletes directos sobre `public.products`.
- Mientras un pedido este en fiado pendiente no entra a ingresos efectivos; solo vuelve a contarse cuando el negocio lo marca manualmente como `paid`.
- `localStorage` queda limitado a estado visual no critico del workspace.

### Estado real auditado del repo

- El frente con mayor cierre tecnico hoy es pedidos/pagos/historial: runtime, funciones SQL, triggers, policies y tests automatizados coinciden.
- El frente de naming canonico (`businessId`, `businessSlug`, `productId`, `orderId`, `orderCode`) tiene guardrails activos en tipos, rutas, helpers y tests.
- El borde privilegiado del runtime normal sigue aislado: `SUPABASE_SERVICE_ROLE_KEY` no participa en el flujo productivo y queda reservada para el helper interno autorizado y el bootstrap test-only de Playwright.
- El login por email/password sigue siendo el unico carril de acceso respaldado hoy por evidencia E2E fuerte.
- El registro manual permanece visible solo como carril secundario/no garantizado; no forma parte del frente cerrado del MVP mientras dependa de confirmacion de correo o configuracion incierta del entorno.
- Metricas privadas quedan cerradas: runtime, base Supabase enlazada, spec E2E dedicada y documentacion ya estan alineados con la misma definicion efectiva.
- El veto de borrado de productos historicos queda cerrado con trigger en Supabase, runtime alineado y evidencia automatizada de guardrails + integracion real de DB.
- El frente ownerless queda cerrado tambien en la definicion final efectiva: runtime, UI, migraciones SQL finales y guardrails automatizados coinciden en retirar `request/grant/claim/list` y mantener bloqueado `ownerless -> owned` dentro del MVP.

### Variables de entorno vigentes

- `NEXT_PUBLIC_SUPABASE_URL`: obligatoria.
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`: obligatoria.
- `NEXT_PUBLIC_GOOGLE_AUTH_ENABLED`: opcional. Usa `1` o `true` solo cuando Google OAuth ya esta configurado en Supabase y debe exponerse como opcion secundaria solo en `/login`.
- `NEXT_PUBLIC_SITE_URL`: obligatoria en produccion y con fallback local en desarrollo.
- `SUPABASE_SERVICE_ROLE_KEY`: opcional y aislada del runtime normal; solo puede leerse desde `lib/supabase/internal/service-role-client.ts`.

### Google OAuth opcional

- Google OAuth no reemplaza el login por email/password: ese acceso sigue siendo el camino base validado del MVP y el circuito E2E estable sigue entrando por credenciales controladas.
- Google OAuth no vive en `/register`: si esta habilitado, se intenta solo desde `/login` y `/register` sigue reservado para el carril manual secundario.
- Para activarlo en runtime, define `NEXT_PUBLIC_GOOGLE_AUTH_ENABLED=1` solo despues de habilitar Google como provider en Supabase Auth y cargar ahi el client ID/client secret de Google.
- En Supabase Auth debes permitir los redirects del callback app-level que usa Tecpify: `http://localhost:3000/auth/callback` para desarrollo y `https://tu-dominio/auth/callback` para produccion; `NEXT_PUBLIC_SITE_URL` debe coincidir con el dominio real que vas a usar.
- En Google Cloud Console, el redirect URI autorizado del provider debe ser el callback de Supabase Auth del proyecto: `https://<project-ref>.supabase.co/auth/v1/callback`.
- Si la flag no existe o queda en `0`/`false`, el sistema oculta Google en la UI, no inicia el flujo desde `/api/auth/oauth/google` y tambien rechaza callbacks OAuth directos con `code`; email/password sigue operativo sin cambiar tests ni ownership.

## 7. Limites actuales del producto

- No es un ERP ni un backoffice completo.
- No tiene multiusuario por negocio ni roles complejos.
- No tiene pagos automatizados, conciliacion ni pasarela integrada.
- No tiene inventario formal, variantes, categorias, imagenes ni logistica avanzada.
- No ofrece remediacion runtime ni SQL para negocios ownerless; `request/grant/claim/list` quedan retirados en la definicion final efectiva y cualquier saneamiento ocurre fuera del runtime del MVP.
- No debe usarse como excusa para relajar naming, ownership o source of truth: el alcance es acotado, no ambiguo.

## 8. Siguiente etapa del proyecto

1. Mantener alineado el proyecto Supabase apuntado por Playwright con las migraciones vigentes para no reabrir la evidencia E2E real de metricas privadas.
2. Solo si se decide volver a promover el registro manual como carril oficial, cubrirlo de punta a punta con confirmacion real y evidencia E2E equivalente al login.
3. Mantener alineados runtime, migraciones y tests cuando el catalogo evolucione, para no reabrir el veto de borrado sobre productos historicos.
4. Seguir simplificando el workspace sin abrir excepciones sobre ownership, naming ni source of truth.
5. Mantener acotada la capa de `proxy.ts` y no moverle responsabilidades de dominio que deben vivir en runtime, DB y tests.

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
6. un pedido valido a domicilio con `Contra entrega` nace en `Nuevo` con condicion financiera `Contra entrega`, sin abrir una columna paralela de pago
7. la revision de pago se resuelve dentro de `Nuevo` mediante una superficie dedicada y luego habilita `Confirmado` sin mezclar pago con columnas del board

### Ejecucion

- `npm run test:e2e`
- `npm run test:e2e:headed`
- La base enlazada debe tener aplicadas las migraciones vigentes de `supabase/migrations`. Si el proyecto remoto queda atrasado respecto del repo, el owner puede quedar bloqueado por RLS al crear negocio o publicar productos y la suite E2E no cerrara el circuito real.
- La migracion `20260329002_rework_order_operational_flow_and_cancellation.sql` agrega `previous_status_before_cancellation`, `cancellation_reason`, `cancellation_detail` y la funcion controlada `public.update_order_with_server_history`. Si el remoto enlazado no la tiene aplicada, la cancelacion/reactivacion excepcional no queda cerrada y reaparece drift entre runtime y esquema.
- Antes de correr specs, Playwright bootstrapea fixtures dedicadas de Auth con `tests/helpers/playwright-global-setup.ts`. Ese bootstrap usa service role aislada de test para crear o corregir dos cuentas no humanas, las confirma sin correo y luego verifica login real con password.
- La suite E2E falla cerrado si faltan prerequisitos del bootstrap, si Supabase Auth no puede dejar operativas esas fixtures o si el proyecto remoto no acepta login real con ellas.
- La suite E2E no llama `/api/auth/register`, no usa `signUp`, no dispara correos de confirmacion, OTP, magic link, reset ni resend, no toca Google OAuth real y no depende de cuentas humanas ni de estados manuales inciertos.
- La suite E2E ya incluye una spec dedicada para metricas privadas y hoy si cuenta como cierre efectivo: corre contra el Supabase enlazado real, valida ownership, aislamiento, regla de fiado y demuestra que el resultado no depende de `localStorage`.
- El registro manual/confirmacion y Google OAuth real quedan fuera del carril E2E estable; el runtime solo los expone como superficies secundarias/no garantizadas y no como parte cerrada del MVP.

### Variables para E2E

- Playwright lee `PLAYWRIGHT_*` desde el entorno del proceso o desde `.env.local` antes de evaluar las specs.
- `PLAYWRIGHT_BASE_URL`: por defecto `http://localhost:3000`.
- `PLAYWRIGHT_E2E_PASSWORD`: obligatoria. Es el unico secreto de test para bootstrapear las dos fixtures de Auth (`owner` e `intruder`) con emails dedicados y deterministas bajo `example.com`.
- `PLAYWRIGHT_E2E_NAMESPACE`: opcional. Si no se define, el namespace se deriva del project ref de `NEXT_PUBLIC_SUPABASE_URL`; sirve para aislar fixtures cuando varios entornos comparten el mismo proyecto de Supabase.
- `PLAYWRIGHT_SKIP_WEBSERVER=1`: desactiva el `webServer` de Playwright para correr contra una app ya levantada.
- `CI`: activa el perfil de reporter/retries pensado para runners automatizados.
- `SUPABASE_SERVICE_ROLE_KEY`: sigue fuera del runtime normal, pero es requisito test-only para el bootstrap E2E aislado. No viaja al bundle cliente ni habilita acceso operativo dentro de la app.
