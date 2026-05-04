# CLAUDE.md

## Rol
Actúa como desarrollador senior full-stack orientado a producción.  
Tu objetivo es construir una aplicación interna de gestión de agenda para un equipo (peluquería/salón), priorizando simplicidad, usabilidad en móvil y fiabilidad.

---

## Producto
Aplicación de uso interno (no pública) para gestionar citas:

- Acceso exclusivo para empleados (staff/admin)
- Gestión simple de citas
- Calendario visual por día / semana / mes
- Creación, edición y cancelación de citas
- Uso optimizado para móvil
- Prevención de solapamientos

No existe interfaz pública ni reservas por clientes.

---

## Stack decidido
- Next.js (App Router) + TypeScript strict  
- Tailwind CSS  
- Supabase (Postgres + Auth + RLS)  
- Zod para validación  
- Server Components por defecto  
- pnpm  
- Vitest (mínimo)  
- Vercel (deploy)  

---

## Principios de arquitectura
- Simplicidad > complejidad  
- Mobile-first  
- Lógica de citas en servidor  
- Fechas en UTC, mostrar en Europe/Madrid  
- Validación con Zod  
- Componentes pequeños y reutilizables  
- Evitar sobreingeniería  

---

## Roles
- staff: gestiona sus citas  
- admin: gestiona todas las citas y configuración  

---

## MVP obligatorio

### 1. Login interno
- Autenticación con Supabase  
- Protección de rutas  

### 2. Calendario principal
- Vista por:
  - día  
  - semana  
  - mes  
- Navegación rápida  
- Visualización clara de citas  
- Optimizado para móvil  

### 3. Gestión de citas
- Crear cita  
- Editar cita  
- Cancelar cita  

Campos mínimos:
- customer_name (texto)  
- service (texto)  
- starts_at  
- ends_at  
- notes (opcional)  
- staff_id  

### 4. Prevención de solapamientos
- Implementada en base de datos (Postgres)  
- No permitir citas simultáneas del mismo profesional  

### 5. Gestión de horarios
- Horario general del negocio  
- Bloqueo de días (cierres)  

### 6. Deploy
- README completo  
- .env.example  
- Deploy en Vercel  

---

## Modelo de datos mínimo

### appointments
- id uuid primary key  
- staff_id uuid  
- customer_name text  
- service text  
- starts_at timestamptz  
- ends_at timestamptz  
- notes text  
- status text (active, cancelled)  
- created_at timestamptz  

### staff_members
- id uuid  
- name text  

### business_hours
- id uuid  
- day_of_week int  
- opens_at time  
- closes_at time  

### blocked_days
- id uuid  
- date date  
- reason text  

---

## Restricción anti-solapamiento

create extension if not exists btree_gist;

alter table appointments
add constraint no_overlap
exclude using gist (
  staff_id with =,
  tstzrange(starts_at, ends_at, '[)') with &&
)
where (status = 'active');

---

## Reglas de negocio
- No permitir citas fuera de horario  
- No permitir citas en días bloqueados  
- No permitir solapamientos  
- Intervalos de 15 minutos  
- No mostrar horas pasadas  

---

## Rutas
- /login  
- /dashboard  
- /dashboard/calendario  
- /dashboard/citas  

---

## UI/UX
- Mobile-first  
- Calendario usable con una mano  
- Scroll vertical tipo agenda  
- Acciones rápidas (crear/editar en pocos pasos)  
- Diseño limpio y sin distracciones  
- Estados claros (loading, vacío, error)  

---

## Seguridad
- RLS activado en Supabase  
- Solo usuarios autenticados acceden  
- staff solo ve sus citas  
- admin ve todo  
- No exponer claves privadas  

---

## Tests mínimos
- Creación de cita válida  
- Rechazo por solapamiento  
- Rechazo fuera de horario  

---

## CI
- lint  
- typecheck  
- build  

---

## Deploy
- Vercel  
- Variables de entorno configuradas  
- README con instrucciones  

---

## Flujo de trabajo
1. Inicializar proyecto  
2. Implementar autenticación  
3. Crear modelo de datos  
4. Implementar calendario (día → semana → mes)  
5. Añadir gestión de citas  
6. Añadir validaciones  
7. Optimizar UX móvil  
8. Deploy  

---

## Definition of Done
- App usable desde móvil  
- Calendario funcional  
- Citas gestionables sin errores  
- Sin solapamientos  
- Build OK  
- Deploy OK  
- README claro  