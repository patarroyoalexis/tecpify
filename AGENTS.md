## Agente automatico de consistencia post-tarea

Cada vez que se termine cualquier tarea solicitada, antes de darla por finalizada, ejecutar una revision obligatoria de consistencia del MVP.

### Objetivo del agente

Verificar que el cambio recien hecho no rompa contratos, naming, acceso, persistencia ni separacion client/server.

No cerrar una tarea solo porque compila o porque el cambio visual funciona. Antes de cerrar, revisar consistencia funcional y contractual segun este archivo.

### Cuando se ejecuta

Ejecutar siempre al final de cada tarea que modifique:
- contratos
- rutas API
- componentes client
- acceso a Supabase
- auth
- mappers
- variables de entorno
- persistencia
- flujos del storefront
- dashboard, pedidos, catalogo o metricas

Si una tarea toca solo copy o estilos muy aislados, igual hacer una revision minima de imports, contratos y efectos colaterales.

### Protocolo obligatorio de cierre

Antes de responder "terminado", hacer estas verificaciones:

1. Revisar archivos modificados y detectar si el cambio toco:
   - naming canonico
   - payloads publicos
   - mappers
   - uso de Supabase
   - reglas client/server
   - variables de entorno
   - uso de mocks o localStorage
   - flujos criticos del MVP

2. Revisar si el cambio introdujo alguna de estas regresiones:
   - exito visual sin persistencia real
   - lectura o escritura que vuelve a depender de localStorage como fuente de verdad
   - mezcla de snake_case y camelCase en una misma frontera publica
   - import de helpers server-only dentro de componentes client
   - lectura directa de process.env fuera de lib/env.ts
   - uso nuevo o encubierto de variables de entorno no documentadas
   - dependencia nueva de service role sin documentacion
   - perdida silenciosa de datos o fallback silencioso
   - flujo publico roto por cambios en ownership, auth o lectura de negocio

3. Ejecutar validacion tecnica minima:
   - lint
   - typecheck
   - build
   - y cualquier test existente relacionado con el area tocada

4. Si la tarea toca circuito critico, revisar tambien:
   - negocio
   - catalogo
   - link publico
   - creacion de pedido
   - lectura en workspace
   - actualizacion de estado o pago
   - metricas basicas si dependen de ese cambio

5. Entregar siempre un informe de cierre con este formato:
   - Archivos modificados
   - Verificaciones ejecutadas
   - Hallazgos
   - Riesgos detectados
   - Inconsistencias corregidas
   - Pendientes no bloqueantes
   - Veredicto final

### Regla de severidad

Clasificar hallazgos asi:
- Critico: rompe persistencia, seguridad, ownership o contratos base
- Alto: rompe un flujo funcional real o deja una regresion probable
- Medio: inconsistencia de naming, mapper, warning funcional o deuda cercana
- Bajo: deuda documental, copy, limpieza, detalles menores

### Regla de honestidad

Nunca afirmar que un cambio esta listo solo porque compilo.
Nunca afirmar que un flujo esta estable si no fue revisado contra contratos y persistencia.
Si algo no pudo verificarse, decirlo explicitamente.

### Veredicto final permitido

Solo se puede cerrar con una de estas frases:
- APTO PARA REVISAR
- APTO CON ALERTAS
- NO APTO TODAVIA

### Regla de correccion inmediata

Si durante la revision aparece una inconsistencia clara introducida por el mismo cambio recien hecho, corregirla antes de cerrar, siempre que el alcance sea pequeno y directo.
Si la correccion requiere una refactorizacion mayor, no improvisarla: reportarla como riesgo o pendiente bloqueante.