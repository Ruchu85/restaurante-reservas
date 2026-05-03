# Skill: Reportes y Estadísticas

## Descripción
Skill para generar informes de rendimiento: ingresos, servicios más populares, clientes frecuentes, ocupación de empleados.

## Cuándo usar
- El usuario pide un informe, gráfico o estadística del negocio
- Se implementan dashboards o KPIs
- Se necesita exportar datos a CSV/PDF

## Contexto relevante
- Servicio: `backend/src/services/reporteService.ts`
- Controlador: `backend/src/controllers/reporteController.ts`
- Componentes: `frontend/src/components/` (dashboard)

## KPIs principales
- **Ingresos**: diarios, semanales, mensuales — por servicio, por empleado
- **Ocupación**: % de horas trabajadas vs disponibles por empleado
- **Clientes nuevos vs recurrentes**: ratio y evolución
- **Servicio más vendido**: ranking por período
- **Ticket medio**: promedio de gasto por visita

## Filtros disponibles
- Rango de fechas
- Empleado específico
- Categoría de servicio
- Método de pago
