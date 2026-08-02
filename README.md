# Reservas — Gestión de sala para restaurantes

Aplicación de reservas y gestión de sala pensada para restaurantes españoles:
reserva pública para el cliente, panel de sala para el equipo y CRM de
comensales para reconocer al habitual.

**Demo:** https://reservas-restaurante-demo.vercel.app

---

## Stack

| Capa | Tecnología |
|------|-----------|
| Framework | Next.js 15 App Router + TypeScript strict |
| UI | Tailwind CSS v4 + Radix UI |
| Base de datos | Supabase (Postgres + Auth + RLS) |
| Validación | Zod |
| Tests unitarios | Vitest |
| Tests E2E | Playwright |
| Email | Resend |
| Deploy | Vercel |
| Paquetes | pnpm |

---

## Funcionalidades

### Reserva pública
- Asistente de reserva en 3 pasos, optimizado para móvil
- Huecos calculados en tiempo real según horario, mesas libres y aforo
- Email de confirmación con enlace para consultar o cancelar la reserva
- Rate limiting por IP

### Panel de sala
- Resumen del servicio del día: reservas, comensales, mesas ocupadas, no-shows
- Calendario mensual con ocupación por día y vista de servicio (turnos y franjas)
- Alta, edición, cambio de estado y cancelación de reservas, con revalidación
  completa de horario, aforo y pacing al mover una reserva
- Lista de espera con aviso por WhatsApp cuando se libera una mesa
- Informes de ocupación, origen de las reservas y tasa de no-show

### CRM de comensales
- Ficha automática por teléfono: se crea sola con cada reserva
- Historial completo de visitas, cancelaciones y no-shows
- Alergias, notas de sala y etiquetas (VIP, habitual, celebración…)
- Señales visibles en la propia reserva: el equipo sabe a quién tiene delante
- Autocompletado al crear una reserva: no se duplican clientes

### Gestión de sala avanzada
- **Anti-solapamiento garantizado en base de datos** (constraint de exclusión GiST)
- **Combinación automática de mesas** para grupos que no caben en una sola
- **Pacing**: límite de comensales por franja para no saturar la cocina
  (global o por día), con opción de forzarlo desde el panel
- **Última sentada configurable**: con cierre a las 16:00 puedes seguir sentando
  a las 15:15; lo que se cierra es la entrada, no la sobremesa
- **Duración por tamaño de grupo**: una pareja no ocupa la mesa lo mismo que diez
- **Protección frente a no-shows**: quien acumule N ausencias tiene que llamar
  en lugar de reservar online
- Turnos partidos (comida y cena) y cierres que cruzan medianoche
- Días bloqueados, con aviso si ya hay reservas confirmadas
- Registro de auditoría: quién cambió qué y cuándo

### Contacto por WhatsApp
- Botón de WhatsApp con mensaje redactado en reservas y lista de espera
- Solo aparece en móviles: los fijos españoles no pueden tener WhatsApp

---

## Instalación local

```bash
# 1. Clonar e instalar
git clone <repo>
cd "APP Restaurantes"
pnpm install

# 2. Variables de entorno
cp .env.example .env.local
# Edita .env.local con tus valores de Supabase

# 3. Ejecutar migraciones en Supabase
# En el SQL Editor de tu proyecto, ejecuta en orden los archivos de
# supabase/migrations/ (ver la sección "Migraciones SQL")

# 4. Crear el usuario administrador
# Dashboard → Authentication → Users → Invite user
# Luego, en el SQL Editor:
#   UPDATE profiles
#   SET role = 'admin', restaurant_id = '00000000-0000-0000-0000-000000000001'
#   WHERE id = '<uuid-del-usuario>';

# 5. Arrancar
pnpm dev
```

Abre http://localhost:3000 — la reserva pública está en `/reservar` y el panel
de sala en `/dashboard`.

---

## Variables de entorno

| Variable | Obligatoria | Descripción |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Sí | URL del proyecto Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Sí | Clave anónima (pública) |
| `SUPABASE_SERVICE_ROLE_KEY` | Sí | Clave de servicio. **Solo servidor** |
| `NEXT_PUBLIC_APP_URL` | Sí | URL base, sin barra final |
| `NEXT_PUBLIC_RESTAURANT_SLUG` | Sí | Slug del restaurante de la página pública |
| `RESEND_API_KEY` | No | Email transaccional. Vacío = sin emails |
| `RESEND_FROM_EMAIL` | No | Remitente de los emails |

> `SUPABASE_SERVICE_ROLE_KEY` salta todas las políticas RLS. Nunca debe
> exponerse al cliente ni llevar el prefijo `NEXT_PUBLIC_`.

---

## Scripts

```bash
pnpm dev          # servidor de desarrollo
pnpm build        # build de producción
pnpm start        # servir el build
pnpm lint         # ESLint
pnpm typecheck    # TypeScript sin emitir
pnpm test         # tests unitarios (Vitest)
pnpm test:e2e     # tests end-to-end (Playwright)
```

---

## Migraciones SQL

Se ejecutan **en orden** desde el SQL Editor de Supabase:

| Archivo | Contenido |
|---|---|
| `001`–`010` | Esquema original del salón (histórico) |
| `011_restaurant_schema.sql` | Esquema del restaurante: mesas, reservas, horarios |
| `012_fix_handle_new_user.sql` | Corrección del trigger de alta de usuarios |
| `013_restore_salon_schema.sql` | Convivencia con el esquema del salón |
| `014_fix_rls_multitenant.sql` | Políticas RLS filtradas por tenant |
| `015_security_and_crm.sql` | **Blindaje RLS + CRM + pacing + mesas juntadas + auditoría** |
| `016_service_rules.sql` | Última sentada, duración por grupo y bloqueo por no-shows |

La `015` es la importante: cierra las políticas abiertas de la `011` —que
permitían leer todas las reservas con la clave pública— y añade el CRM de
comensales, el pacing, la tabla de mesas juntadas y el registro de auditoría.
Es idempotente y migra los datos existentes.

---

## Arquitectura y decisiones

### Zona horaria
Todo se guarda en UTC, pero un **día de servicio** es un día natural en
`Europe/Madrid`. Consultar por el día UTC es incorrecto: en horario de verano
esa ventana incluye la madrugada del día siguiente y excluye la del propio día,
lo que colocaba las reservas de madrugada en el día equivocado y —peor— las
dejaba fuera del cálculo de solapamientos. `src/lib/dates.ts` centraliza estas
conversiones y está cubierto por tests, incluidos los días de cambio de hora.

### Anti-solapamiento
La garantía de «una mesa, una reserva» vive en Postgres, no en el código:

```sql
exclude using gist (
  table_id with =,
  tstzrange(starts_at, ends_at, '[)') with &&
) where (status not in ('cancelled', 'no_show'))
```

Las mesas juntadas tienen su propia restricción equivalente en
`reservation_tables`, así que un grupo grande tampoco puede duplicar mesa.

### Autorización
Las Server Actions de Next.js son endpoints POST accesibles públicamente: no
basta con proteger la ruta. Cada acción de `src/actions/` valida la sesión con
`requireStaff()` / `requireAdmin()` y toma el `restaurant_id` **del perfil del
usuario autenticado**, nunca de un parámetro del cliente ni de una variable de
entorno. Todas las mutaciones filtran además por `restaurant_id`.

---

## Deploy en Vercel

1. Importa el repositorio en Vercel.
2. Configura las variables de entorno de la tabla anterior.
3. Deploy. El `vercel.json` y el workflow de GitHub Actions ya están incluidos.

El workflow de CI ejecuta `lint`, `typecheck`, `test` y `build`; el paso de
deploy se omite si no existe el secreto `VERCEL_TOKEN`.

---

## Prospección comercial

`prospect-system/` es una herramienta aparte (Python) para captar restaurantes
como clientes: búsqueda por Google Places, enriquecimiento de datos, scoring y
contacto por email o **WhatsApp agrupado por provincia**.

Ver [`prospect-system/README.md`](prospect-system/README.md).

---

## Estructura del proyecto

```
src/
  actions/       Server Actions (con guard de sesión y scoping por tenant)
  app/
    api/         Endpoints públicos (reserva) y del panel
    dashboard/   Panel de sala
    reservar/    Reserva pública
  components/    UI reutilizable
  lib/
    auth.ts          Sesión del empleado y su restaurante
    availability.ts  Huecos, asignación de mesas, pacing
    dates.ts         Conversiones Europe/Madrid ↔ UTC
    guests.ts        CRM de comensales
    phone.ts         Normalización de teléfonos y enlaces WhatsApp
    reservations.ts  Acceso a datos de reservas
  tests/         Vitest (unitarios) y Playwright (e2e)
supabase/
  migrations/    Esquema SQL en orden de ejecución
prospect-system/ Herramienta de prospección comercial (Python)
```
