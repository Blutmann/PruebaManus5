

## Extensión aprobada — Dashboard visual de demanda

### Alcance

Implementar exclusivamente en Preview un dashboard visual dentro del panel ADMIN, reemplazando la tabla simple de `Estadísticas de turnos`. Production (`vmhxwxxidgfbczxtkqge`) no se modifica ni se publica; no se activa la publicación automática.

### Fuente de datos y definiciones

- Turnos: reutilizar `readRealAppointments()` y su aislamiento RLS existente. El dashboard nunca renderiza nombres, emails ni teléfonos de clientes.
- Disponibilidad: consultar `barber_availability_slots` con las columnas públicas de estado, fecha, hora y barbero; la consulta queda sujeta a las RLS actuales y al barbero propio cuando el perfil sea BARBER.
- Turnos solicitados: todos los registros de `appointments` cuyo `booking_date` cae en el período, sin duplicar por estado.
- Confirmados, pendientes y cancelados: conteo por el estado persistido de cada turno dentro del período.
- Tasa de confirmación: `CONFIRMED / (CONFIRMED + CANCELLED + COMPLETED)`. Si no hay turnos resueltos, se muestra `—` y no se inventa un porcentaje.
- Comparación: solo se muestra frente al período equivalente anterior cuando ambos períodos tienen datos resueltos suficientes; en caso contrario se omite.
- Ocupación: cada slot se clasifica como confirmado o pendiente si se solapa con un turno no cancelado; si no, conserva `AVAILABLE` o `UNAVAILABLE`. La disponibilidad no se cuenta como reserva y un bloqueo no se interpreta como falta de demanda.

### Implementación

- `src/lib/kani-dashboard.ts`: rangos de período, agregaciones deterministas, métricas, demanda por día y celdas de ocupación.
- `src/lib/kani-availability.ts`: lectura acotada de slots de disponibilidad para el período seleccionado.
- `src/components/kani/admin-demand-dashboard.tsx`: filtros Esta semana / Últimos 30 días / Este mes / rango personalizado, tarjetas de KPI, gráfico de barras Recharts, selector por barbero ADMIN, heatmap de día/franja y oportunidades potenciales.
- `src/components/kani/admin.tsx`: montaje del dashboard en las vistas de turnos, conservando los filtros y acciones existentes.
- `src/styles.css`: tarjetas, leyenda, gráfico, heatmap, estados vacíos y responsive en desktop/mobile con tokens existentes.

### Dirección visual

Dashboard editorial japonés contemporáneo: tarjetas de superficie sobria con acentos dorados, bordó y verde semántico; cifras grandes pero contenidas; gráfico de barras legible; heatmap compacto con leyenda redundante por color, texto y etiquetas; Zen Antique se conserva globalmente. El layout prioriza una lectura vertical clara en mobile y dos columnas equilibradas en desktop.

### Restricciones

- No crear migraciones: el esquema y las consultas existentes son suficientes.
- No crear turnos ni datos ficticios para completar gráficos.
- No modificar reservas, disponibilidad, depósitos, notificaciones, Resend, autenticación, roles o RLS.
- No modificar `/reservar` ni publicar Production.


## Corrección estructural de la NavBar de reservas (Preview)

La NavBar inferior de `/reservar` se corrige como una superficie fija e independiente del flujo, reemplazando el `sticky` que la hacía depender del ancho y la altura de la sección de contenido. El fondo ocupa todo el viewport y el interior queda centrado dentro del ancho de la página. El documento reserva espacio en la página y en el footer para que ningún contenido o enlace quede debajo de la barra. La superficie es opaca y usa `var(--chrome)` para conservar los temas claro y oscuro. El alcance se limita a `src/styles.css`; no se modifican el flujo de reservas, Supabase, autenticación, RLS, RPCs, Resend ni Production.


## Corrección definitiva de jerarquía NavBar-footer en desktop (Preview)

La NavBar ya estaba correctamente fijada a la ventana, con ancho completo y `z-index: 30`. El problema estructural era que el espacio de seguridad se agregaba dentro del footer (`padding-bottom`), haciendo que la barra pareciera ocupar parte de su layout. La solución es eliminar por completo ese padding del footer y reservar exactamente `70px` en `.site-shell`, después del contenido completo de la página. Así el footer conserva su altura natural y termina antes del borde superior de la NavBar, mientras la zona técnica queda cubierta por la propia barra fija.

El cambio se aplica únicamente desde `min-width: 768px`; mobile mantiene sus reglas existentes sin modificación. Se conserva `position: fixed`, ancho completo, opacidad, tokens de tema, espacio necesario para el contenido principal y el comportamiento del flujo. No se modifican reservas, autenticación, Supabase, Resend ni Production.


## Composición coordinada de chrome fijo en desktop (Preview)

El Header pasa a ser fijo en el borde superior y el Footer pasa a ser fijo en el borde inferior. La NavBar de reservas permanece fija, pero su `bottom` se calcula con la altura real del Footer, por lo que queda inmediatamente por encima de este. `ResizeObserver` publica `--site-footer-height` y `--booking-cta-height` en el documento para coordinar alturas variables sin márgenes arbitrarios.

El shell reserva el espacio de Header en la parte superior y la suma Footer + NavBar en la parte inferior; el Footer no recibe padding artificial para alojar la NavBar. Desktop conserva fondo opaco, tokens de tema y z-index ordenado: Header 120, NavBar 30, Footer 20. Mobile mantiene el Header relativo, Footer oculto en el flujo de reservas y NavBar al borde inferior.


## Ajuste aprobado — Footer compacto (Preview)

### Alcance

Modificar exclusivamente el footer visual. En desktop se mantienen dos columnas: izquierda con exactamente `San Isidro Labrador 7, Martínez, Provincia de Buenos Aires` y `Lunes a sábados de 10:00 a 20:00 hs`, sin saltos artificiales; derecha con Contacto, Ver ubicación, Instagram en una fila flexible y el copyright debajo. Se conservan los destinos existentes: `/estudio`, Google Maps e Instagram.

### Implementación

- `src/components/kani/site-header.tsx`: reemplazar únicamente el markup del footer para eliminar el título adicional y convertir dirección/horario en dos líneas semánticas.
- `src/styles.css`: reducir padding y gap, equilibrar columnas con grid, mantener wrapping seguro de enlaces y mostrar el footer en mobile en páginas que no contienen la NavBar de reservas; el footer de `/reservar` conserva su comportamiento mobile actual.
- No se modifican Header, NavBar, flujo de reservas, panel, Supabase, Auth, disponibilidad, notificaciones, Resend ni Production fuera del checkpoint de este ajuste.

### Dirección visual

Minimalismo editorial japonés: densidad vertical contenida, alineación serena, Zen Antique intacta, colores y fondos tomados de los tokens de tema existentes. El bloque derecho se alinea al extremo y el bloque izquierdo conserva aire suficiente para evitar compresión o desbordamiento.


## Panel móvil de gestión de turnos — Preview

### Alcance

Crear una ruta independiente `/admin/movil`, protegida por el layout administrativo existente. No se modificará ni reemplazará el panel actual, `/reservar`, Supabase, RLS, autenticación, disponibilidad, notificaciones ni Resend. No se crearán tablas ni reservas nuevas.

### Arquitectura

- `src/routes/admin.movil.tsx`: entrada de la nueva ruta, reutilizando el guard de `/admin` y el `AdminStaffProvider` del layout padre.
- `src/components/kani/admin-mobile-appointments.tsx`: interfaz mobile-first de una sola columna; filtros por fecha/estado y por barbero solo para ADMIN; tarjetas con detalle bajo demanda y acciones según estado.
- `src/lib/kani-appointments.ts`: fuente única existente para lectura y transiciones de estado; no duplicar consultas ni RPCs.
- `public/manus-routes.json`: declaración de la nueva ruta.
- `src/styles.css`: estilos aislados y responsive del panel móvil; el panel administrativo actual conserva sus clases y comportamiento.

### Seguridad y datos

La lectura utiliza `readRealAppointments()`, que consulta `appointments` y sus entidades relacionadas bajo las RLS actuales. El frontend aplica además el alcance de `AuthenticatedStaff`: BARBER queda limitado a su `barber_id` y ADMIN puede seleccionar los barberos autorizados. Las acciones llaman a `updateRealAppointmentStatus()`, reutilizando la RPC existente y sus notificaciones actuales; no se agregan emails ni efectos secundarios nuevos.

### Diseño

Estética `editorial zen` coherente con Kani: fondo profundo/ivory según tema, Zen Antique, tarjetas verticales con horario y estado como anclas visuales, controles táctiles de 44px o mayores, acentos dorados sobrios, una sola columna y scroll vertical. Las animaciones serán discretas y no bloquearán la operación rápida desde una mano. Los datos sensibles del cliente (teléfono, email y observaciones) aparecen únicamente en el diálogo de detalle.

### Estructura del proyecto

La aplicación conserva el shell global y el árbol de rutas TanStack. La nueva ruta es hija de `/admin`; el componente móvil vive junto al componente administrativo existente, y la lógica de datos permanece en la capa `kani-appointments` compartida. No se introduce backend adicional ni una segunda agenda.


## Ajustes puntuales de navegación y UI del panel móvil — Preview

Se agrega una pestaña `Panel móvil de turnos` en el panel ADMIN existente únicamente cuando el perfil activo tiene rol `ADMIN`; la ruta destino es `/admin/movil` y conserva la protección del layout administrativo. El panel móvil existente se mantiene sin cambios funcionales: solo se compactan moderadamente las tarjetas de estados y se ajustan los paddings de los controles nativos de fecha y selección para equilibrar calendario y flechas sin cambiar sus opciones ni su lógica. No se modifica Production, autenticación, Supabase, RLS, reservas, disponibilidad, Resend ni notificaciones.


## Diagnóstico y corrección de turnos faltantes en `/admin/movil`

La consulta `readRealAppointments()` y el guard de autenticación son compartidos por ambos paneles; la discrepancia se originaba en `AdminMobileAppointments`, que inicializaba `selectedDate` con `demoToday` y exigía `appointment.date === selectedDate`. El panel `/admin`, en cambio, abre pendientes y confirmados sin completar el filtro de fecha. La corrección extrae `filterMobileAppointments` a `src/lib/kani-mobile-appointments.ts`, usa una fecha vacía como ausencia de filtro y conserva el selector para acotar por fecha. El mismo helper mantiene el alcance por `permittedBarberIds`, `barber_id`, estado y barbero, y se cubre con pruebas unitarias para ADMIN, BARBER, fechas y los cuatro estados. No se cambia Supabase, RLS, autenticación, reservas ni datos.


## Selector rápido de fechas para `/admin/movil` — Preview

La consulta de turnos seguirá siendo `readRealAppointments()` y continuará cargando los registros permitidos por la sesión; el filtrado por fecha ocurrirá en una única capa frontend reutilizable, sin una segunda fuente de verdad ni cambios de base de datos. `src/lib/kani-mobile-appointments.ts` será responsable de los modos `ALL`, `TODAY`, `TOMORROW`, `NEXT_10_DAYS`, `THIS_WEEK` y `SPECIFIC`, incluidos rangos inclusivos y aritmética de fechas calendario. La fecha de negocio se calculará con `America/Argentina/Buenos_Aires` mediante `Intl`, y se refrescará mientras el panel permanece abierto para que los rangos relativos avancen automáticamente. El selector rápido y el calendario actualizarán el mismo estado de filtro: al elegir una fecha puntual se activa `SPECIFIC`; al elegir un modo rápido se descarta la fecha puntual activa. Estado, barbero y alcance por rol se aplican después del rango, preservando ADMIN/BARBER y los cuatro estados.
