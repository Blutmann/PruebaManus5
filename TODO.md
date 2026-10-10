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
