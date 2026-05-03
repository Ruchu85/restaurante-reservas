# CLAUDE.md

## Rol
Actúa como desarrollador senior full-stack orientado a producción.
Tu objetivo es construir, probar y publicar una aplicación web para gestionar citas de una peluquería.
Prioriza código mantenible, seguro, tipado, accesible y fácil de desplegar.

## Producto
App para una peluquería/salón con:
- Vista pública para reservar cita.
- Panel interno para administrar agenda, servicios, personal, horarios y clientes.
- Calendario visual por día/semana/mes.
- Prevención robusta de solapamientos de citas.
- Deploy final en GitHub y Vercel.

## Stack decidido
- Next.js App Router + TypeScript strict.
- Tailwind CSS + shadcn/ui.
- Supabase: Postgres, Auth, RLS y, si aporta valor, Realtime.
- Zod para validación.
- Server Components por defecto.
- Server Actions o endpoints route handlers solo cuando esté justificado.
- pnpm como package manager.
- Vitest para lógica pura.
- Playwright para flujos E2E.
- Vercel para producción.
- GitHub para repositorio y CI.

## Principios de arquitectura
- Separar dominio, UI y acceso a datos.
- La lógica de disponibilidad vive en servidor, nunca solo en cliente.
- Guardar fechas en UTC; mostrar por defecto en Europe/Madrid.
- Validar toda entrada con Zod.
- No exponer claves privadas ni service_role en cliente.
- Usar RLS en todas las tablas sensibles.
- Mantener componentes pequeños y reutilizables.
- Evitar dependencias pesadas salvo beneficio claro.
- Documentar decisiones no obvias en docs/decisions.md.

## Roles
- public: puede ver servicios y solicitar/reservar cita.
- customer: puede ver, cancelar o reprogramar sus citas si está autenticado.
- staff: puede consultar y gestionar su agenda.
- admin: puede gestionar servicios, personal, horarios, cierres y configuración.

## MVP obligatorio
1. Landing responsive con CTA para reservar.
2. Flujo público de reserva:
   - elegir servicio
   - elegir profesional o “cualquiera”
   - elegir fecha/hora disponible
   - introducir nombre, email, teléfono y notas
   - confirmar cita
3. Panel admin protegido:
   - calendario día/semana/mes
   - crear/editar/cancelar citas
   - CRUD de servicios
   - CRUD de profesionales
   - configuración de horarios
   - cierres/vacaciones/ausencias
4. Prevención de doble reserva a nivel de base de datos.
5. Página de confirmación y estados de cita.
6. README, .env.example, migraciones SQL y guía de despliegue.
7. Tests básicos y build limpio.

## Modelo de datos mínimo
Crear migraciones para:
- profiles
- salons
- staff_members
- services
- business_hours
- staff_availability
- staff_time_off
- appointments
- appointment_events

## Campos clave
appointments:
- id uuid primary key
- salon_id uuid
- staff_id uuid nullable
- service_id uuid
- customer_name text
- customer_email text
- customer_phone text
- starts_at timestamptz
- ends_at timestamptz
- status text: pending, confirmed, completed, cancelled, no_show
- notes text nullable
- created_at timestamptz
- updated_at timestamptz

services:
- id uuid primary key
- salon_id uuid
- name text
- description text nullable
- duration_minutes int
- buffer_before_minutes int default 0
- buffer_after_minutes int default 0
- price_cents int
- active boolean default true

## Restricción anti-solapamiento
Implementar una constraint Postgres, no solo validación en app:
- usar btree_gist si hace falta
- excluir solapes por staff_id y rango [starts_at, ends_at)
- aplicar solo a status pending/confirmed
- documentar la decisión

Ejemplo conceptual:
create extension if not exists btree_gist;
alter table appointments
add constraint appointments_no_overlap
exclude using gist (
  staff_id with =,
  tstzrange(starts_at, ends_at, '[)') with &&
)
where (status in ('pending', 'confirmed'));

## Reglas de disponibilidad
- Una cita solo puede reservarse dentro del horario de apertura.
- Respetar horarios específicos de cada profesional.
- Respetar ausencias, vacaciones y cierres.
- Incluir buffers del servicio.
- No mostrar slots pasados.
- Redondear slots al intervalo configurable, por defecto 15 minutos.
- Si se elige “cualquiera”, asignar profesional disponible de forma determinista.
- Resolver conflictos con transacción/constraint y mensaje claro al usuario.

## Rutas sugeridas
- / landing
- /reservar reserva pública
- /reservar/confirmacion confirmación
- /login acceso interno
- /dashboard resumen
- /dashboard/calendario calendario
- /dashboard/citas listado
- /dashboard/servicios CRUD servicios
- /dashboard/equipo CRUD profesionales
- /dashboard/horarios horarios y cierres
- /dashboard/configuracion ajustes

## UI/UX
- Diseño limpio, premium, mobile-first.
- Usar componentes accesibles.
- Estados loading, empty, error y success.
- Formularios claros con mensajes humanos.
- Calendario usable en móvil y escritorio.
- No bloquear al usuario con tecnicismos.
- Idioma principal: español.
- Moneda: EUR.
- Zona horaria visible cuando sea relevante.

## Seguridad
- Activar RLS.
- Crear policies por rol.
- Admin/staff no pueden ver ni modificar datos de otros salones.
- No usar service_role en componentes cliente.
- No imprimir secretos en logs.
- .env.local nunca se commitea.
- .env.example solo contiene nombres de variables.
- Revisar permisos antes de deploy.

## Calidad
Antes de considerar una tarea terminada, ejecutar:
- pnpm lint
- pnpm typecheck
- pnpm test
- pnpm build
- pnpm test:e2e si está configurado y es viable

## Tests mínimos
- Cálculo de slots disponibles.
- Prevención de solapamiento.
- Creación de cita válida.
- Rechazo de cita fuera de horario.
- Rechazo de cita en ausencia/cierre.
- E2E: usuario reserva una cita.
- E2E: admin cancela o reprograma una cita.

## CI
Crear GitHub Actions para:
- instalar pnpm
- instalar dependencias
- lint
- typecheck
- test
- build

## Deploy
- Usar Vercel.
- Configurar variables de entorno necesarias.
- Conectar GitHub con Vercel si las credenciales están disponibles.
- Si no hay autenticación CLI/MCP, dejar instrucciones exactas en README.
- No inventar secretos ni tokens.
- Al final, entregar URL de producción o checklist de pasos pendientes.

## Variables esperadas
- NEXT_PUBLIC_SUPABASE_URL
- NEXT_PUBLIC_SUPABASE_ANON_KEY
- SUPABASE_SERVICE_ROLE_KEY solo servidor, si es imprescindible
- NEXT_PUBLIC_APP_URL
- DATABASE_URL si se usa ORM o tooling SQL
- PLAYWRIGHT_BASE_URL para E2E

## Flujo de trabajo para Claude
1. Inspecciona el repo antes de modificar.
2. Si el repo está vacío, crea la app desde cero.
3. Haz un plan breve y ejecútalo por fases.
4. Implementa primero una vertical slice: servicio -> disponibilidad -> reserva -> calendario admin.
5. Haz commits pequeños y descriptivos.
6. No reescribas archivos grandes sin necesidad.
7. Si falta una decisión, adopta una buena suposición y documéntala.
8. Si una herramienta externa no está autenticada, no te bloquees: genera comandos y guía.
9. Mantén README actualizado.
10. Al finalizar, muestra resumen, tests ejecutados, URLs y próximos pasos.

## Definition of Done
- MVP funcional localmente.
- Migraciones listas.
- RLS implementado.
- Tests críticos pasando.
- Build de producción pasando.
- README completo.
- .env.example completo.
- Repositorio publicado en GitHub.
- Proyecto desplegado en Vercel o instrucciones exactas si faltan credenciales.