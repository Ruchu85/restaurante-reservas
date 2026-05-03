# Skill: Gestionar Clientes

## Descripción
Skill para el CRUD de clientes, historial de visitas, preferencias y fidelización.

## Cuándo usar
- El usuario trabaja con el módulo de clientes (alta, baja, modificación)
- Se necesita consultar historial de visitas o servicios previos
- Se implementan funciones de búsqueda o filtrado de clientes

## Contexto relevante
- Modelo: `backend/src/models/Cliente.ts`
- Controlador: `backend/src/controllers/clienteController.ts`
- Componentes: `frontend/src/components/clientes/`

## Reglas de negocio
- Un cliente se identifica por su email (único) o teléfono
- El historial incluye todas las citas completadas con sus servicios y precio pagado
- Los clientes pueden tener preferencias guardadas: empleado favorito, servicios habituales
- Se puede etiquetar clientes: `vip`, `nuevo`, `recurrente`, `inactivo`
- Un cliente es `inactivo` si no ha visitado en los últimos 90 días

## Campos del modelo Cliente
- `nombre`, `apellidos`, `email`, `telefono`
- `fecha_alta`, `ultima_visita`, `total_visitas`
- `notas` (texto libre para el peluquero)
- `etiquetas[]`, `preferencias{}`
