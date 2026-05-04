# Decisiones de arquitectura

## 1. Prevención de solapamiento de citas con EXCLUDE USING GIST

**Decisión:** Usamos una constraint `EXCLUDE USING GIST` con la extensión `btree_gist` para garantizar a nivel de base de datos que no existan dos citas con el mismo profesional en rangos de tiempo superpuestos cuando su estado es `pending` o `confirmed`.

**Razón:** La validación en la capa de aplicación no es suficiente bajo concurrencia. Dos peticiones simultáneas pueden pasar la validación al mismo tiempo y crear un solapamiento. La constraint a nivel de BD es atómica y previene este caso de forma definitiva.

**Constraint:**
```sql
create extension if not exists btree_gist;
alter table appointments
  add constraint appointments_no_overlap
  exclude using gist (
    staff_id with =,
    tstzrange(starts_at, ends_at, '[)') with &&
  )
  where (status in ('pending', 'confirmed') and staff_id is not null);
```

**Consecuencia:** El error de Postgres `23P01` (exclusion constraint violation) se captura en la capa de aplicación (`src/actions/appointments.ts`) y se traduce a un mensaje amigable para el usuario.

---

## 2. Server Components por defecto, Client Components solo cuando necesario

**Decisión:** Todos los componentes de página son Server Components que cargan datos directamente con el cliente de Supabase. Los componentes cliente (`"use client"`) se usan solo para interactividad: formularios, wizard de reserva, acciones optimistas.

**Razón:** Menor bundle de JavaScript en cliente, mejor tiempo de carga inicial, y los datos se cargan más cerca del origen sin exponer credenciales al navegador.

---

## 3. Fechas en UTC, display en Europe/Madrid

**Decisión:** Todas las fechas se almacenan en Postgres como `timestamptz` (UTC). El display se hace en la zona horaria `Europe/Madrid` usando `date-fns-tz`.

**Razón:** Evita ambigüedades con cambios de horario de verano/invierno. La BD es la fuente de verdad en UTC y cada cliente puede mostrar en su zona local si fuera necesario.

---

## 4. RLS en todas las tablas con helpers de función

**Decisión:** Activamos Row Level Security en todas las tablas y usamos funciones helper `auth_salon_id()` y `auth_role()` con `SECURITY DEFINER` para evitar repetición en las policies.

**Razón:** Las policies directas que llaman a subconsultas complejas tienen peor rendimiento. Las funciones helper se ejecutan una vez por sesión (gracias a `stable`) y simplifican el mantenimiento.

---

## 5. Flujo de reserva pública sin autenticación requerida

**Decisión:** El flujo de reserva en `/reservar` no requiere que el cliente esté autenticado. Solo pide nombre, email y teléfono.

**Razón:** Reducir fricción es crítico para la tasa de conversión en reservas online. La RLS permite `INSERT` público en `appointments`. El staff gestiona las citas desde el panel admin.

---

## 6. Slug de salón como identificador público

**Decisión:** Los salones tienen un `slug` único (ej. `salon-demo`) que se usa para identificar el salón en la landing y el flujo de reserva, en lugar de un UUID.

**Razón:** Las URLs con slugs son legibles y compartibles. Si la app escala a multi-tenant, cada salón tendrá su propio subdominio o ruta `/salones/:slug`.

---

## 7. pnpm como gestor de paquetes

**Decisión:** Usamos `pnpm` en lugar de `npm` o `yarn`.

**Razón:** pnpm es más rápido, usa menos espacio en disco con su store compartido, y tiene mejor gestión de dependencias fantasma. El CI también está configurado con `pnpm/action-setup`.

---

## 8. Vitest para tests unitarios, Playwright para E2E

**Decisión:** Tests unitarios con Vitest (rápido, compatible con el ecosistema Vite), E2E con Playwright (multi-browser, fiable en CI).

**Razón:** Jest es más lento en proyectos TypeScript modernos. Vitest tiene la misma API con configuración mínima. Playwright es el estándar de facto para E2E en 2024-2025.
