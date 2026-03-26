### Regla bloqueante de service role

El runtime normal del MVP debe operar exclusivamente con cliente anonimo/publico acotado, cliente autenticado SSR y RLS.

Cualquier uso activo de `SUPABASE_SERVICE_ROLE_KEY` en:
- route handlers del MVP
- acciones server del flujo normal
- lectura/escritura de negocios, productos o pedidos
- ownership
- storefront publico
- dashboard, pedidos o metricas

convierte automaticamente el cambio en `NO APTO TODAVIA`, salvo que exista una excepcion explicitamente documentada, justificada y aprobada en `lib/supabase/service-role.ts`.

Si aparece un uso nuevo de service role sin esa excepcion, el guardian debe:
1. reportarlo como Critico
2. pedir su eliminacion o reemplazo antes de cerrar
3. no aprobar el cambio aunque lint, typecheck y build pasen

Guardrail tecnico actual:
- `lib/supabase/server.ts` es solo para clientes `anon/public` y `auth`
- cualquier helper privilegiado debe vivir aislado en `lib/supabase/internal/service-role-client.ts`
- `tests/service-role-guardrails.test.cjs` debe fallar si una ruta operativa vuelve a importar service role o si `SUPABASE_SERVICE_ROLE_KEY` aparece fuera del inventario permitido

### Regla bloqueante de ownership

Ningun negocio es operable si `created_by_user_id` es null o no coincide con el usuario autenticado esperado.

El guardian debe verificar que:
- ningun negocio sin owner pueda abrir workspace privado
- ningun negocio sin owner pueda exponerse en storefront publico
- ningun pedido pueda leerse o mutarse fuera del owner real del negocio
- toda transicion `ownerless -> owned` pase por remediacion auditable con estados persistidos y claim controlado para el usuario correcto

Si existe cualquier ruta, helper, mapper o consulta que permita operar un negocio sin owner verificable, el veredicto es `NO APTO TODAVIA`.

### Regla bloqueante de cobertura minima para cambios criticos

Si la tarea toca:
- ownership
- auth
- service role
- storefront publico
- creacion de pedidos
- lectura privada de pedidos
- mutacion de pedidos

el cambio no puede cerrarse solo con `lint`, `typecheck` y `build`.

Debe existir al menos una prueba automatizada nueva o actualizada que cubra el riesgo principal introducido o corregido.

Cobertura minima exigida para seguridad del MVP:
- lectura privada permitida para owner correcto
- lectura privada denegada para usuario no owner
- mutacion permitida para owner correcto
- mutacion denegada para usuario no owner
- ausencia de dependencia operativa de service role en flujo normal

Si la cobertura no existe, el veredicto minimo es `APTO CON ALERTAS`.
Si el cambio afirma cerrar una brecha critica sin prueba automatizada, el veredicto es `NO APTO TODAVIA`.

### Regla bloqueante de congruencia de entorno

Las variables de entorno documentadas en:
- `AGENTS.md`
- `README.md`
- `.env.example`
- `lib/env.ts`

deben ser congruentes entre si.

El guardian debe verificar que:
- no exista una variable usada en `lib/env.ts` que no este documentada
- no exista una variable documentada que ya no se use realmente
- no haya lecturas directas de `process.env` fuera de `lib/env.ts`

Si hay contradiccion entre documentacion y codigo:
- gana el codigo real
- debe corregirse la documentacion en el mismo cambio si el alcance es directo
- si la tarea introduce una variable nueva sin actualizar las tres fronteras documentales, el veredicto no puede ser `APTO PARA REVISAR`

Frontera canonica actual de variables del repo:

- `NEXT_PUBLIC_SUPABASE_URL`
  - obligatoria
  - debe existir en `AGENTS.md`, `README.md`, `.env.example` y `lib/env.ts`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
  - obligatoria
  - debe existir en `AGENTS.md`, `README.md`, `.env.example` y `lib/env.ts`
- `NEXT_PUBLIC_SITE_URL`
  - obligatoria en produccion y con fallback local en desarrollo
  - debe existir en `AGENTS.md`, `README.md`, `.env.example` y `lib/env.ts`
- `SUPABASE_SERVICE_ROLE_KEY`
  - opcional y sin uso operativo activo en runtime normal del MVP
  - debe existir en `AGENTS.md`, `README.md`, `.env.example` y `lib/env.ts`

Excepcion temporal y justificada:

- `NODE_ENV`
  - puede ser leida en `lib/env.ts` por ser variable base del runtime de Node/Next
  - no exige presencia en `.env.example`
  - si se documenta, debe quedar claro que no forma parte de la configuracion operativa manual del MVP

El guardian debe bloquear cierre si:
- falta cualquiera de las cuatro variables canonicas en una de las fronteras documentales
- sobra una variable documentada que ya no vive en `lib/env.ts`
- aparece una lectura directa nueva de `process.env` fuera de `lib/env.ts` sin excepcion temporal, acotada y justificada en test o documentacion
- se intenta aprobar una brecha de entorno o seguridad critica solo con evidencia manual

### Regla bloqueante de fuente de verdad y fronteras client/server

Contrato verificable actual:
- Supabase es la fuente de verdad para negocios, productos y pedidos del MVP.
- `localStorage` solo puede guardar estado de UI no critico.
- El server debe resolver ownership desde sesion/contexto confiable y no confiar en `owner_id`, `created_by_user_id` ni `business_id` enviados por cliente para autorizar o mutar recursos.
- Los negocios legacy sin owner solo salen de `ownerless_*` mediante remediacion auditable y siguen inaccesibles hasta persistir `businesses.created_by_user_id`.
- La creacion de pedidos debe tomar solo datos editables; cualquier `status`, `paymentStatus`, `history` o metadato derivable enviado por cliente se ignora y el server deriva estado e historial segun medio de pago y origen, dejando `history` append-only bajo control server-side.
- `README.md` y `AGENTS.md` deben describir solo flujos realmente activos en el repo.

### 3. Validacion tecnica minima

Siempre ejecutar:

- `npm run lint`
- `npm run typecheck`
- `npm run build`
- `npm test`
- tests existentes relacionados con el area tocada
- test de congruencia de variables y fronteras de entorno
- test de veto a lecturas directas de `process.env` fuera de `lib/env.ts`
- test de guardia documental sobre source of truth, ownership, service role y fronteras client/server

Si la tarea toca seguridad critica, ownership o entorno y no existe un test de congruencia/documentacion, debe agregarse en la misma ronda si el alcance es directo.
