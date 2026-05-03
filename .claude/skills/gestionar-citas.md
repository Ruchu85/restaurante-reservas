# Skill: Gestionar Citas

## Descripción
Skill para crear, modificar, cancelar y consultar citas del salón. Incluye lógica de disponibilidad de empleados y servicios.

## Cuándo usar
- El usuario pide crear o modificar una cita
- Se necesita verificar disponibilidad de horarios
- Se quiere implementar lógica de recordatorios o notificaciones de citas

## Contexto relevante
- Modelo: `backend/src/models/Cita.ts`
- Controlador: `backend/src/controllers/citaController.ts`
- Rutas: `backend/src/routes/citas.ts`
- Componentes: `frontend/src/components/citas/`

## Reglas de negocio
- Una cita tiene: cliente, empleado, servicio(s), fecha/hora, duración estimada, estado
- Estados posibles: `pendiente`, `confirmada`, `en_curso`, `completada`, `cancelada`
- No se pueden solapar citas para el mismo empleado
- El cliente debe existir en el sistema antes de crear la cita
- Las citas canceladas con menos de 2 horas de antelación se marcan como `cancelacion_tardia`

## Pasos típicos de implementación
1. Validar disponibilidad del empleado en la franja horaria
2. Calcular duración total sumando los servicios seleccionados
3. Crear la cita y notificar al cliente (email/SMS si configurado)
4. Actualizar el calendario del empleado
