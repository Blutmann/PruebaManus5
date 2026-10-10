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
