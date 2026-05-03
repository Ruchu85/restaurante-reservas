# Peluquería App

Aplicación web de producción para gestionar el calendario de citas de una peluquería.

## Stack

| Capa | Tecnología |
|------|-----------|
| Framework | Next.js 15 App Router + TypeScript strict |
| UI | Tailwind CSS v4 + componentes custom (shadcn-inspired) |
| Base de datos | Supabase (Postgres + Auth + RLS) |
| Validación | Zod |
| Tests unitarios | Vitest |
| Tests E2E | Playwright |
| Deploy | Vercel |
| Paquetes | pnpm |

## Funcionalidades MVP

- **Landing pública** con información del salón y CTA de reserva
- **Flujo de reserva** en 4 pasos: servicio → profesional → fecha/hora → datos cliente
- **Prevención de solapamientos** via constraint EXCLUDE USING GIST a nivel de BD
- **Panel admin protegido** con login Supabase Auth
  - Calendario semana
  - Listado y gestión de citas (confirmar / completar / cancelar)
  - CRUD de servicios
  - CRUD de profesionales
  - Configuración de horarios por día
  - Ajustes del salón
- **Disponibilidad en tiempo real** calculada en el servidor
- **RLS** en todas las tablas

## Instalación local

```bash
# 1. Clonar
git clone https://github.com/TU_USUARIO/peluqueria-app.git
cd peluqueria-app

# 2. Variables de entorno
cp .env.example .env.local
# Edita .env.local con tus valores de Supabase

# 3. Instalar dependencias
pnpm install

# 4. Ejecutar migraciones en Supabase
# En el SQL Editor de tu proyecto Supabase, ejecuta en orden:
#   supabase/migrations/001_extensions.sql
#   supabase/migrations/002_create_tables.sql
#   supabase/migrations/003_rls_policies.sql
#   supabase/migrations/004_seed.sql

# 5. Crear usuario admin en Supabase
# Dashboard → Authentication → Users → Invite user
# Luego en SQL Editor:
#   UPDATE profiles SET role = 'admin', salon_id = '00000000-0000-0000-0000-000000000001'
#   WHERE id = '<uuid-del-usuario>';

# 6. Arrancar
pnpm dev
```

La app estará disponible en [http://localhost:3000](http://localhost:3000).

## Variables de entorno

| Variable | Descripción | Obligatoria |
|----------|-------------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` | URL del proyecto Supabase | ✅ |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Clave anon pública | ✅ |
| `SUPABASE_SERVICE_ROLE_KEY` | Clave service role (solo servidor) | ❌ |
| `NEXT_PUBLIC_APP_URL` | URL base de la app | ✅ |
| `NEXT_PUBLIC_SALON_SLUG` | Slug del salón (por defecto `salon-demo`) | ✅ |
| `PLAYWRIGHT_BASE_URL` | URL para tests E2E | ❌ |

## Scripts

```bash
pnpm dev          # Desarrollo en localhost:3000
pnpm build        # Build de producción
pnpm start        # Arranca el build de producción
pnpm lint         # ESLint
pnpm typecheck    # TypeScript sin emit
pnpm test         # Tests unitarios (Vitest)
pnpm test:watch   # Tests en modo watch
pnpm test:e2e     # Tests E2E (Playwright)
```

## Migraciones SQL

Las migraciones están en `supabase/migrations/` y deben ejecutarse en orden:

1. `001_extensions.sql` — extensiones Postgres (uuid-ossp, btree_gist)
2. `002_create_tables.sql` — tablas, constraint anti-solapamiento, índices, triggers
3. `003_rls_policies.sql` — RLS y políticas por rol
4. `004_seed.sql` — datos de demo (salón, servicios, profesionales, horarios)

> **Decisión de arquitectura:** El constraint anti-solapamiento usa `EXCLUDE USING GIST` con `btree_gist` para garantizar a nivel de base de datos que no existan dos citas con el mismo profesional en rangos solapados, cuando el estado es `pending` o `confirmed`. La validación en la aplicación es complementaria.

## Deploy en Vercel

### Automático (recomendado)

1. Crea un repositorio en GitHub y haz push del código
2. En [vercel.com](https://vercel.com), haz clic en **Add New Project** e importa el repo
3. Configura las variables de entorno en Vercel:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `NEXT_PUBLIC_APP_URL` (la URL de Vercel, ej. `https://tu-app.vercel.app`)
   - `NEXT_PUBLIC_SALON_SLUG`
4. Despliega

### Con Vercel CLI

```bash
npm i -g vercel
vercel login
vercel --prod
```

## Troubleshooting

**Error "relation does not exist"**
→ Ejecuta las migraciones en Supabase SQL Editor en el orden indicado.

**No aparecen slots disponibles**
→ Verifica que `business_hours` tiene filas para el salón (ejecuta el seed).

**Login redirige en bucle**
→ Comprueba que el usuario tiene un perfil en la tabla `profiles` con `salon_id` y `role = 'admin'`.

**RLS bloquea lecturas**
→ Verifica que las policies están activas (`SELECT * FROM pg_policies WHERE tablename = 'appointments'`).

## Estructura del proyecto

```
src/
├── app/                  # Rutas Next.js App Router
│   ├── page.tsx          # Landing
│   ├── reservar/         # Flujo de reserva pública
│   ├── login/            # Acceso interno
│   ├── dashboard/        # Panel admin (protegido)
│   └── api/auth/         # Auth callbacks
├── components/
│   ├── ui/               # Componentes base (shadcn-inspired)
│   ├── booking/          # Wizard de reserva
│   ├── dashboard/        # Componentes del panel admin
│   └── auth/             # Componentes de autenticación
├── lib/
│   ├── supabase/         # Clientes Supabase (cliente / servidor)
│   ├── availability.ts   # Cálculo de disponibilidad
│   └── utils.ts          # Utilidades compartidas
├── actions/              # Server Actions
├── types/                # Tipos TypeScript
└── tests/
    ├── unit/             # Vitest
    └── e2e/              # Playwright
supabase/
└── migrations/           # SQL migrations
```
