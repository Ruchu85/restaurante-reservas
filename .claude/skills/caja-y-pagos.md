# Skill: Caja y Pagos

## Descripción
Skill para gestionar el cobro de servicios, métodos de pago, cierres de caja y resúmenes financieros del día.

## Cuándo usar
- El usuario trabaja con el módulo de caja o pagos
- Se implementan tickets, facturas o resúmenes de venta
- Se calcula la comisión de empleados o el total del día

## Contexto relevante
- Modelo: `backend/src/models/Ticket.ts`, `backend/src/models/Pago.ts`
- Controlador: `backend/src/controllers/cajaController.ts`
- Componentes: `frontend/src/components/caja/`

## Reglas de negocio
- Métodos de pago aceptados: `efectivo`, `tarjeta`, `transferencia`, `bono`
- Un ticket se genera al completar una cita (puede tener múltiples servicios)
- El IVA por defecto es 21% (configurable por servicio)
- Cierre de caja diario: suma de todos los tickets del día por método de pago
- Las propinas se registran separadas del precio del servicio
