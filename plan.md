

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
