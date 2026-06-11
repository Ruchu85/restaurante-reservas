# Implementación de mejoras — registro de cambios

Resumen de lo realmente implementado a partir de [PROPUESTA-MEJORAS.md](./PROPUESTA-MEJORAS.md).
Todo verificado con: `typecheck` ✅ · `lint` ✅ (0 errores) · `test` ✅ (14/14) · `build` ✅.

> ⚠️ **IMPORTANTE — aplicar migraciones antes de desplegar.** Hay dos migraciones nuevas:
> - `009_capacity_and_salon.sql` — capacidad por tramo, datos del salón, teléfono/notas de cliente, trigger de capacidad.
> - `010_split_shift.sql` — turno partido (segundo tramo horario).
>
> Aplicar con `supabase db push` (o el flujo de migraciones del proyecto). El código es
> resiliente a columnas ausentes en lectura (capacidad cae a 1 por defecto), pero las
> pantallas de Ajustes / Ficha de cliente / Horarios necesitan las columnas para **guardar**.

---

## FASE 1 — Capacidad multi-cliente + quick wins

- **Capacidad por tramo (1–N)** configurable en Ajustes. Retrocompatible: por defecto 1.
- **Trigger de BD** (`check_slot_capacity`) que garantiza la capacidad a nivel de base de
  datos calculando la concurrencia máxima real dentro del rango de la cita.
- **`availability.ts`** reescrito a conteo vs capacidad; expone `remaining` (huecos libres).
- **Colores por ocupación** en el calendario (día/semana): 🟢 libre · 🟡 parcial · 🔴 completo
  · ⬜ cerrado · 🚫 bloqueado. Etiqueta "+ Añadir cliente · queda 1 hueco" en tramos parciales.
- **Resumen del día** en la cabecera del calendario (ocupación %, citas, huecos libres).
- **Nueva cita**: el selector de hora muestra los huecos restantes según capacidad.
- **Inicio**: resumen del día (citas, pendientes, ingreso previsto) + próxima cita.
- **Recordatorio por WhatsApp** en el detalle de cita (`wa.me`, sin integración externa).
- **Identidad del salón en BD**: se eliminó el hardcode de `salonConfig.ts` como única fuente;
  ahora los datos fiscales se leen de la tabla `salons` (con `salonConfig` como respaldo) y se
  editan en Ajustes. Tickets, citas, calendario y detalle usan los datos del salón.

## FASE 2 — Valor comercial

- **Ficha de cliente** (`/dashboard/clientes/[id]`): teléfono, notas/preferencias, historial de
  citas, nº de visitas, gasto total, etiqueta VIP, accesos a WhatsApp y nueva cita.
- **Teléfono y notas** de cliente (alta rápida con teléfono, edición en la ficha).
- **Informes** (`/dashboard/informes`): ingresos, nº de citas, ticket medio, servicios más
  solicitados y mejores clientes, con filtro de fechas (mes en curso por defecto).
- **Turno partido** (mañana/tarde): segundo tramo horario opcional por día en Horarios,
  respetado por el calendario y por el cálculo de huecos.
- **Buscador** por nombre de cliente en Citas (server-side), compatible con el filtro
  activas/canceladas.

## FASE 3 — Producto / multi-salón

- **Módulo de profesionales**: gestión (alta/baja) en Horarios, asignación de profesional al
  crear/editar cita, y **filtro por profesional** en el calendario.
- **Cierre de caja diario** (`/dashboard/caja`): total del día, desglose por servicio, detalle
  de citas e impresión de tickets del día. Enlazado desde Informes.
- **Multi-salón (base)**: toda la identidad del salón es ya DB-driven y editable, dejando el
  sistema listo para varios salones. El alta self-service completa (signup + alta de salón +
  asociación usuario↔salón) queda como siguiente paso, porque requiere decisiones de producto
  (flujo de registro, planes) y un cambio de la resolución de salón por `env` a por usuario.

---

## Archivos nuevos
- `supabase/migrations/009_capacity_and_salon.sql`, `010_split_shift.sql`
- `src/lib/salon.ts` — loader de salón + helpers de capacidad y ticket
- `src/actions/salon.ts` — actualizar datos del salón y capacidad
- `src/components/dashboard/WhatsAppReminder.tsx`
- `src/components/dashboard/StaffManager.tsx`
- `src/app/dashboard/informes/page.tsx`
- `src/app/dashboard/caja/page.tsx`
- `src/app/dashboard/clientes/[id]/page.tsx` + `CustomerDetailClient.tsx`

## Notas de diseño
- La capacidad se aplica en tres capas: cálculo de huecos (UI), validación del server action y
  trigger de BD (garantía final). Con capacidad 1 el comportamiento es idéntico al anterior.
- El no-solapamiento por profesional sigue garantizado por el `EXCLUDE` existente cuando se
  asigna `staff_id`; la capacidad gobierna las citas a nivel de salón.
