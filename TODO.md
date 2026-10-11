# TODO — Mantenimiento en Preview

## Implementar la sección Mantenimiento protegida por ADMIN

Agregar una ruta y sección `Mantenimiento` visible exclusivamente para usuarios autenticados con perfil activo `ADMIN`; los usuarios `BARBER` y no autenticados no deben verla ni acceder a ella mediante URL o llamada directa. Mantener el diseño actual, temas claro/oscuro, tipografía Zen Antique, navegación y flujo normal de reservas.

## Implementar selección, reautenticación y confirmación irreversible

Permitir seleccionar individualmente `PENDING`, `CONFIRMED`, `COMPLETED` y `CANCELLED`, uno, varios o todos; impedir la ejecución sin estados seleccionados; explicar el alcance y las entidades que se conservarán; solicitar la contraseña actual del administrador sin almacenarla ni enviarla a servicios propios; volver a verificar sesión y perfil ADMIN; mostrar una confirmación final explícita; cancelar cualquier paso sin modificar datos; usar la etiqueta `Eliminar registros`.

## Implementar RPC transaccional y auditoría append-only en Preview

Crear exclusivamente en el proyecto Supabase Preview `iockpxtkflyjfagkvgnr` una función controlada `admin_cleanup_appointment_records` que verifique `auth.uid()`, perfil activo ADMIN y rechace BARBER/no autenticados incluso por invocación directa; revocar ejecución a PUBLIC y anon y concederla solo a authenticated; usar `SECURITY DEFINER` con `search_path` seguro, lock de concurrencia y rollback completo ante errores; eliminar solo los estados recibidos, sus notificaciones administrativas vinculadas y sus eventos de email; conservar clientes, Auth, perfiles, roles, barberos, servicios, disponibilidad y notas, datos de transferencia, notificaciones de disponibilidad, secuencia, configuración, RLS, triggers y funciones existentes; no usar TRUNCATE ni reiniciar la secuencia; registrar actor, fechas, estados, resultado y cantidades sin datos personales en una tabla protegida contra cambios desde el cliente.

## Actualizar tipos, rutas y manifest sin alterar reservas

Agregar los tipos Supabase de la tabla y RPC, integrar la sección en el panel ADMIN, declarar `/admin/mantenimiento` en `public/manus-routes.json` y no modificar `/reservar`, el envío de emails ni la configuración de Production.

## Validar exclusivamente en Preview

Probar con datos sintéticos controlados en `iockpxtkflyjfagkvgnr`: acceso ADMIN, rechazo BARBER/no autenticado, contraseña incorrecta, cancelación, selección individual/múltiple/todos, eliminación de notificaciones y eventos relacionados, preservación de entidades maestras y disponibilidad, secuencia no reiniciada, rollback ante errores, exclusión mutua, auditoría sin PII y ausencia de envíos reales; no publicar Production ni ejecutar migraciones allí.


## Implementar historial de disponibilidad independiente

Agregar en `/admin/mantenimiento` una sección titulada `Historial de disponibilidad` con el texto `Eliminá las notificaciones históricas de horarios bloqueados y liberados. Esta acción no modifica la disponibilidad actual de los barberos`, contador actualizado, botón `Eliminar notificaciones de disponibilidad`, confirmación con cantidad e irreversibilidad, resultado de cantidad eliminada o error, y estado vacío con botón deshabilitado cuando el contador es cero. La acción solo podrá ejecutarse tras confirmación explícita de un ADMIN; no se ejecutará automáticamente.

Crear en Preview una operación backend transaccional y protegida que verifique perfil ADMIN activo, rechace anónimos/BARBER, utilice `SECURITY DEFINER`, `search_path` seguro, privilegios explícitos y lock de concurrencia, y elimine únicamente eventos `AVAILABILITY_UNAVAILABLE` y `AVAILABILITY_AVAILABLE`. Mantener intactos horarios reales, reservas, clientes, usuarios, perfiles, barberos, servicios, transferencias, notificaciones de turnos, secuencias, RLS ajenas, funciones ajenas y Resend. Registrar únicamente metadatos mínimos de la operación. No usar `TRUNCATE`, no borrar la tabla completa, no modificar Production ni publicar.


## Dashboard visual de demanda y estadísticas

Implementar exclusivamente en Preview un dashboard visual, moderno y útil dentro del panel ADMIN, sin publicar ni desplegar a Production ni activar publicación automática.

- Mostrar tarjetas dependientes del período seleccionado para turnos solicitados, confirmados, pendientes, cancelados y tasa de confirmación.
- Definir y documentar la tasa de confirmación de forma consistente; evitar porcentajes engañosos cuando el denominador sea cero y mostrar estado sin dato cuando corresponda.
- Mostrar comparación con el período anterior equivalente únicamente cuando existan datos suficientes.
- Implementar un gráfico de barras por día de la semana, de lunes a sábado, diferenciando turnos solicitados y confirmados con etiquetas, valores, leyenda y tooltips; no inventar datos.
- Agregar filtros Esta semana, Últimos 30 días, Este mes y rango personalizado compatible con la estructura existente; actualizar indicadores y visualizaciones de forma coherente.
- Permitir desglose por barbero cuando corresponda, respetando que un BARBER solo vea sus propios datos y que un ADMIN pueda ver los barberos autorizados.
- Agregar una visualización secundaria por día y franja horaria que distinga turnos confirmados, pendientes, horarios disponibles y horarios bloqueados.
- No contar disponibilidad como reserva ni interpretar automáticamente un horario bloqueado como falta de demanda; las oportunidades comerciales deben presentarse como potenciales, sin descuentos automáticos ni cambios de precios.
- Utilizar datos reales de Supabase, respetar las fuentes existentes, fechas y zonas horarias, evitar duplicados y no exponer nombres, emails ni teléfonos de clientes en gráficos agregados.
- Mantener RLS, autenticación, permisos administrativos, lógica de reservas, disponibilidad, depósitos, notificaciones y Resend sin cambios.
- Verificar totales contra los registros de origen, filtros, estados vacíos, desktop/mobile y rechazo de acceso administrativo para usuarios sin permisos.
- Ejecutar TypeScript, tests y build; dejar identificado cualquier caso que no pueda probarse por falta de datos reales.


## Coordinar Header, NavBar y Footer en desktop

Implementar exclusivamente en Preview una composición donde Header, NavBar y Footer estén coordinados: Header fijo arriba; contenido con scroll normal; NavBar de reservas fija a ancho completo; Footer fijo inmediatamente debajo de la NavBar, sin solapamientos ni pérdidas de accesibilidad. Mantener la NavBar en `position: fixed`, sus botones y lógica sin cambios, conservar fondo opaco y temas claro/oscuro, evitar que el contenido principal quede oculto y preservar mobile. Verificar los seis pasos, desplazamiento, footer completo, enlaces, alturas variables y ausencia de cambios en reservas, disponibilidad, Supabase, autenticación o Resend. No publicar Production ni activar publicación automática.


## Simplificar y equilibrar el footer

Modificar exclusivamente el diseño y la distribución del footer. En desktop mostrar en el bloque izquierdo únicamente `San Isidro Labrador 7, Martínez, Provincia de Buenos Aires` y `Lunes a sábados de 10:00 a 20:00 hs`, preferentemente cada uno en un solo renglón cuando el ancho lo permita. En el bloque derecho mantener Contacto hacia `https://kanibarber.com/estudio`, Ver ubicación hacia el enlace exacto de Google Maps existente, Instagram hacia `https://www.instagram.com/kanibarberstudio/` y `© 2026 Kani Barber Studio`; preferir los tres enlaces en una sola fila y el copyright debajo, permitiendo wrapping seguro si el ancho no alcanza. Mantener dos columnas equilibradas, tipografía, colores, enlaces funcionales e identidad visual; no agregar información nueva. En mobile adaptar las columnas sin superposición ni scroll horizontal y mantener todos los enlaces accesibles. Verificar visualmente desktop/mobile, temas claro/oscuro, enlaces, TypeScript, tests y build. No modificar Header, NavBar, reservas, panel, Supabase, Auth, disponibilidad, notificaciones ni Resend. Publicar solo este cambio si todas las validaciones son satisfactorias.


## Panel móvil de gestión de turnos — Preview

Crear una ruta independiente para el panel móvil, accesible únicamente a usuarios autenticados y autorizados, sin modificar ni reemplazar el panel administrativo actual, `/reservar`, Supabase, RLS, autenticación, disponibilidad, notificaciones ni Resend; no duplicar tablas, reservas ni lógica de negocio.

- La interfaz debe ser mobile-first, de una sola columna, con desplazamiento exclusivamente vertical, sin scroll horizontal, tipografía legible, jerarquía clara y controles cómodos para usar con una mano.
- Mostrar la agenda del día, la fecha seleccionada y un resumen de turnos por estado.
- Permitir consultar y filtrar Pendientes, Confirmados, Cancelados y Completados; los cancelados deben permanecer visibles en el historial.
- Cada tarjeta debe mostrar horario, cliente, servicio y duración, estado y acciones correspondientes; teléfono, email y notas solo deben aparecer al abrir el detalle.
- Incluir selector de fecha y filtro por estado; el filtro por barbero solo debe estar disponible para ADMIN.
- Pendiente: permitir confirmar o cancelar/rechazar respetando las transiciones existentes. Confirmado: permitir consultar, marcar como completado y cancelar según las reglas actuales. Cancelado y Completado: permitir consultar el detalle sin acciones que reactiven o alteren accidentalmente el historial.
- Reutilizar la fuente de datos y operaciones existentes; los cambios deben reflejarse en el panel actual sin duplicar registros y sin agregar emails ni notificaciones nuevas.
- BARBER solo puede consultar y gestionar turnos de su propio `barber_id`, incluidos los cancelados. ADMIN puede consultar y gestionar los tres barberos. La separación debe depender de la autenticación/RLS además de los filtros visuales.
- Verificar en Preview el panel actual, autenticación, roles, cuatro estados, cancelados, acciones, fuente compartida y responsive en iPhone/Android; no crear datos destructivos o ficticios.


## Ajustes de navegación y UI del panel móvil — Preview

- Agregar en el panel ADMIN existente un acceso visible con texto `Panel móvil de turnos` hacia `/admin/movil`, únicamente para perfiles ADMIN; conservar el guard de autenticación existente y no reemplazar el panel actual.
- Reducir moderadamente padding, altura y espacios internos de las tarjetas Pendientes, Confirmados, Cancelados y Completados; conservar contadores, colores, jerarquía, legibilidad y responsive sin alterar cálculos.
- Alinear visualmente el calendario de Fecha y las flechas de Estado/Barbero; agregar espaciado interno adecuado en los controles sin cambiar opciones, lógica ni componentes.
- Mantener el alcance exclusivamente en Preview; no modificar autenticación, Supabase, RLS, estados, operaciones de negocio, reservas públicas, Resend ni notificaciones; no publicar Production.
- Validar acceso ADMIN, ausencia del enlace para perfiles no ADMIN, filtros intactos, menor ocupación visual, responsive y ausencia de scroll horizontal; ejecutar TypeScript, tests y build.


## Corregir turnos faltantes en el panel móvil — Preview

- Comparar consultas, tablas, filtros por fecha/estado/barbero, estados, zona horaria, permisos y postfiltrado entre `/admin` y `/admin/movil`, sin modificar la base sin evidencia.
- Corregir la causa exacta para que la fecha inicial no oculte turnos legítimos: una fecha vacía representa ausencia de filtro; el selector debe seguir permitiendo acotar por fecha.
- Mantener visibles los cuatro estados (`PENDING`, `CONFIRMED`, `CANCELLED`, `COMPLETED`), los filtros de estado y barbero y el aislamiento de BARBER por `barber_id` frente al acceso ADMIN.
- Añadir pruebas autónomas para múltiples fechas, los cuatro estados, filtro ADMIN por barbero y aislamiento BARBER; no crear ni modificar datos de Preview.
- Verificar TypeScript, tests, build, rutas y Preview; no publicar Production ni modificar reservas, autenticación, RLS, disponibilidad, Resend o notificaciones.


## Selector rápido de fechas del panel móvil — Preview

Implementar exclusivamente en `/admin/movil` y Preview un selector integrado con seis opciones: `Todos los días`, `Hoy`, `Mañana`, `Próximos 10 días`, `Esta semana` y `Fecha específica` mediante el calendario existente. `Todos los días` será la opción predeterminada, mostrará todos los turnos permitidos de cualquier fecha —incluidos anteriores si corresponden a los demás filtros— y conservará Estado y Barbero. `Hoy` y `Mañana` serán días calendario; `Próximos 10 días` incluirá hoy y los nueve días siguientes, incluidos fines de semana y cruces de semana; `Esta semana` será lunes a domingo inclusive incluso si hoy es sábado o domingo; `Fecha específica` mostrará exclusivamente el día elegido. El rango relativo se recalculará al cambiar el día mientras el panel permanece abierto y deberá usar la zona horaria del negocio (`America/Argentina/Buenos_Aires`) sin conversiones UTC incorrectas.

Presentar el selector de fechas dentro de un contenedor continuo, con indicador de despliegue integrado, más ancho que Estado y Barbero, sin etiquetas cortadas, superposición ni scroll horizontal. El calendario y el selector rápido compartirán un único estado: elegir una opción rápida abandonará la fecha puntual; elegir una fecha activará claramente `Fecha específica`; volver a `Todos los días` quitará la restricción. Combinar fecha, Estado y Barbero sin alterar los permisos: ADMIN ve los tres barberos y BARBER solo su `barber_id`. Mantener intactos `/admin`, `/reservar`, Supabase, RLS, autenticación, disponibilidad, estados, notificaciones, Resend y datos reales; no crear, modificar ni eliminar turnos. Agregar pruebas de rangos, sábado/domingo, diez fechas inclusivas, filtros combinados y ausencia de restricciones contradictorias. Ejecutar TypeScript, tests, build y validaciones de Preview; no publicar Production.
