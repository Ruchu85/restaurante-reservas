# Skill: Gestionar Servicios y Precios

## Descripción
Skill para administrar el catálogo de servicios del salón: tipos de servicio, precios, duración y asignación a empleados.

## Cuándo usar
- El usuario trabaja con el catálogo de servicios
- Se necesita calcular precios o duraciones
- Se configuran los servicios que puede ofrecer cada empleado

## Contexto relevante
- Modelo: `backend/src/models/Servicio.ts`
- Controlador: `backend/src/controllers/servicioController.ts`
- Componentes: `frontend/src/components/servicios/`

## Reglas de negocio
- Cada servicio tiene: nombre, descripción, precio base, duración estimada (minutos), categoría
- Categorías típicas: `corte`, `color`, `tratamiento`, `manicura`, `pedicura`, `barba`, `otros`
- Un empleado solo puede realizar los servicios asignados a su perfil
- El precio puede variar por empleado (tarifa senior vs junior)
- Los servicios pueden estar activos o inactivos (no se eliminan para preservar historial)
