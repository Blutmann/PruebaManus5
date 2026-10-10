# Kani Barber Studio — Mantenimiento en Preview

## Alcance aprobado

Implementar en Preview una sección `Mantenimiento`, visible únicamente para perfiles activos `ADMIN`, que permita seleccionar uno o varios estados de turnos (`PENDING`, `CONFIRMED`, `COMPLETED`, `CANCELLED`) y eliminar únicamente los turnos que correspondan a esos estados junto con sus registros derivados.

Production (`vmhxwxxidgfbczxtkqge`) no se modifica ni se publica.

## Diseño de implementación

- **Autorización doble:** la interfaz se muestra solo para `ADMIN`, pero la RPC vuelve a verificar `auth.uid()`, `staff_profiles.active` y `staff_profiles.role = ADMIN`.
- **Reautenticación:** antes de habilitar la confirmación final, el administrador ingresa nuevamente su contraseña actual mediante Supabase Auth. La contraseña vive únicamente en memoria del formulario y no se envía a servicios propios.
- **Confirmación explícita:** se informa el alcance, los estados elegidos, lo que se elimina y lo que se conserva. La acción final utiliza la etiqueta `Eliminar registros`.
- **Operación atómica:** una función SQL `SECURITY DEFINER` elimina primero notificaciones administrativas vinculadas a los turnos y eventos de email, luego los turnos. La función usa una única transacción lógica, no usa `TRUNCATE`, no reinicia la secuencia y mantiene un lock para impedir concurrencia.
- **Auditoría separada:** una tabla append-only `maintenance_operations` conserva actor, fechas, estados, resultado y cantidades, sin datos personales de clientes. RLS permite lectura únicamente a ADMIN; el cliente no puede insertar, actualizar ni borrar registros directamente.
- **Datos preservados:** clientes, Auth, staff_profiles, roles, barberos, servicios, disponibilidad y notas internas, datos de transferencia, notificaciones de disponibilidad, secuencia, políticas, triggers y funciones existentes.
- **Email:** Preview no recibe `RESEND_API_KEY` ni `RESEND_FROM_EMAIL`; las pruebas no deben enviar emails reales.

## Estructura del proyecto

- `supabase/migrations/20261010001100_kani_admin_maintenance.sql`: tabla de auditoría, RLS, privilegios y RPC transaccional.
- `src/lib/kani-maintenance.ts`: tipos y llamadas de reautenticación/limpieza.
- `src/components/kani/admin-maintenance.tsx`: selección de estados, reautenticación, confirmación y resultado.
- `src/components/kani/admin.tsx`: pestaña y montaje de la sección solo para ADMIN.
- `src/routes/admin.mantenimiento.tsx`: ruta protegida por el layout administrativo.
- `src/integrations/supabase/types.ts`: tipos de la tabla, función y resultado RPC.
- `public/manus-routes.json`: declaración de la nueva ruta.

## Dirección visual

- **Movimiento:** minimalismo japonés contemporáneo con carácter editorial de barbería premium.
- **Principios:** claridad antes que ornamentación; jerarquía sobria; confirmaciones pausadas; estados destructivos inequívocos.
- **Color:** conservar tokens claro/oscuro existentes; usar bordó/marca para la acción irreversible y dorado para el foco de marca, manteniendo contraste.
- **Layout:** sección contenida dentro del panel existente, con bloques apilados y resumen visible antes de los diálogos.
- **Motivos:** líneas finas, superficies sobrias, iconografía Lucide y acentos dorados.
- **Interacción:** progresión de selección → reautenticación → confirmación final; cancelar en cualquier etapa no ejecuta operaciones.
- **Animación:** transiciones discretas y breves; no usar animaciones que oculten el alcance o retrasen la acción destructiva.
- **Tipografía:** Zen Antique global, respetando escala y tokens actuales.
- **Esencia:** control operativo seguro para que Kani Barber Studio pueda probar el MVP sin tocar la configuración del negocio.
- **Voz:** clara, directa, cercana y explícita. Ejemplos: “Elegí qué estados querés eliminar.” / “Esta acción no se puede deshacer.”
- **Marca:** mantener el wordmark y logo existentes de Kani Barber Studio.
- **Color distintivo:** dorado de marca existente, reservado para foco y acciones positivas; la acción destructiva usa el token bordó correspondiente.

## Restricciones

- No modificar `/reservar` ni su lógica.
- No cambiar RLS existentes salvo agregar la protección específica de la nueva auditoría/RPC.
- No aplicar migraciones a Production.
- No publicar.
- No reiniciar ni modificar secuencias.


## Extensión aprobada — Historial de disponibilidad

- Agregar en `/admin/mantenimiento` una sección independiente con contador, estado vacío, confirmación irreversible y resultado de la operación.
- Crear en Preview una auditoría append-only separada para la operación, con actor, estado, fecha/hora, cantidad y error mínimo.
- Exponer únicamente dos RPC `SECURITY DEFINER` para `authenticated`: una de conteo y otra de eliminación; ambas verifican ADMIN activo, `search_path` seguro y privilegios explícitos.
- Eliminar exclusivamente `AVAILABILITY_UNAVAILABLE` y `AVAILABILITY_AVAILABLE` con lock advisory; conservar notificaciones de turnos, disponibilidad real, reservas, clientes, perfiles, configuraciones, secuencias y Resend.
- No ejecutar la eliminación automáticamente, no modificar Production y no publicar.
