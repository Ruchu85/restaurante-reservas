# Dosier de mejoras — APP Peluquería ALI

> Documento de propuesta (no implementación). Objetivo doble:
> 1. Añadir **capacidad multi-cliente por tramo** + recálculo visual de huecos con colores.
> 2. Preparar el producto para **venderlo a otras peluquerías** del país, manteniendo la simplicidad.
>
> Acompaña al mockup visual: [`docs/mockups.html`](./mockups.html) (ábrelo en el navegador).

---

## 0. Resumen ejecutivo

La app está bien construida: mobile-first, limpia, server actions, Supabase. Para escalar a un producto vendible hay tres frentes:

| Frente | Estado hoy | Acción |
|---|---|---|
| **Capacidad por tramo** | 1 cita = tramo ocupado (binario, solo en UI) | Configurable 1–N + colores por ocupación |
| **Multi-salón real** | Todo apunta a 1 salón hardcodeado ("PELUQUERIA ALI") | Onboarding + datos por salón |
| **Funciones de mercado** | Faltan recordatorios, ficha de cliente, informes | Añadir las 5–6 imprescindibles |

---

## 1. Cambio solicitado: capacidad multi-cliente por tramo

### 1.1 Problema actual

- En [`appointments.ts:64`](../src/actions/appointments.ts#L64) toda cita se inserta con `staff_id = null`.
- La restricción anti-solapamiento de Postgres ([`002_create_tables.sql:93`](../supabase/migrations/002_create_tables.sql#L93)) solo actúa `where (status = 'active' and staff_id is not null)`.
- **Conclusión:** hoy la base de datos NO impide solapamientos; solo la UI marca el tramo como "ocupado" cuando hay ≥1 cita. Funciona porque el modelo asume **capacidad = 1**.

Para permitir "2 clientes a la vez" hay que sustituir ese modelo binario por uno basado en **conteo de citas solapadas vs. capacidad**.

### 1.2 Modelo propuesto

**Concepto:** cada tramo tiene una **capacidad** (clientes simultáneos). La ocupación de un tramo = nº de citas activas que lo solapan. El estado se deriva:

| Ocupación | Estado | Color |
|---|---|---|
| `0` | Libre | 🟢 Verde (emerald) |
| `0 < n < capacidad` | Parcial (quedan huecos) | 🟡 Ámbar |
| `n ≥ capacidad` | Completo | 🔴 Rojo (rose) |
| fuera de horario | Cerrado | ⬜ Gris (stone) |
| día bloqueado | Bloqueado | 🚫 Rojo rayado |

Con `capacidad = 1` no existe el estado ámbar → comportamiento idéntico al actual (retrocompatible).

### 1.3 Cambios de base de datos

Nueva migración `009_capacity.sql`:

```sql
-- Capacidad global del salón (por defecto 1 = comportamiento actual)
alter table salons add column if not exists slot_capacity int not null default 1;

-- (Opcional) capacidad distinta por día de la semana
alter table business_hours add column if not exists slot_capacity int;
-- null = hereda la del salón

-- La constraint EXCLUDE de no-solapamiento ya no sirve para capacidad > 1.
-- Se sustituye por validación de conteo en el server action (transaccional),
-- o por una función trigger que cuente solapamientos < capacidad antes de insertar.
```

> **Decisión técnica:** con capacidad variable no se puede usar `EXCLUDE USING gist` directamente. Dos opciones:
> - **(A) Validación en el server action** dentro de una transacción `SELECT ... FOR UPDATE` que cuente citas solapadas. Simple, suficiente para el volumen de una peluquería.
> - **(B) Trigger `BEFORE INSERT`** en Postgres que cuente y lance excepción si `count >= capacidad`. Más robusto ante inserciones concurrentes.
>
> Recomendado: **(B)** para mantener la garantía a nivel de BD (coherente con la filosofía actual del proyecto), con fallback de mensaje claro en el server action.

### 1.4 Cambios de lógica (huecos libres)

[`availability.ts`](../src/lib/availability.ts) — `computeAvailableSlots`: en vez de descartar el tramo con el primer conflicto (`hasConflict`), **contar** las citas solapadas y aceptar el hueco si `count < capacidad`. Devolver también `huecosLibres = capacidad - count` por tramo.

### 1.5 Cambios de UI

- **Ajustes** ([`SettingsClient.tsx`](../src/components/dashboard/SettingsClient.tsx)): nueva tarjeta "Clientes por tramo horario" con selector 1–4 (+ toggle "capacidad distinta según el día"). *Ver mockup pantalla 1.*
- **Calendario** ([`CalendarView.tsx`](../src/components/dashboard/CalendarView.tsx)): reemplazar la función `slotOccupied` (binaria) por `slotOccupancy → estado/color`. Añadir etiqueta "1 de 2 · queda 1 hueco" y botón "+ Añadir cliente" en tramos parciales. *Ver mockup pantalla 2.*
- **Nueva cita** ([`NewAppointmentForm.tsx`](../src/components/dashboard/NewAppointmentForm.tsx)): `computeSlots` debe contar y mostrar huecos restantes; el selector de hora muestra "10:30 ·1" (huecos libres) en vez de solo "ocupado/libre". *Ver mockup pantalla 3.*
- **Resumen del día**: en cabecera del calendario, "Ocupación 58% · 7 citas · 9 huecos libres".

### 1.6 Esfuerzo estimado

| Tarea | Esfuerzo |
|---|---|
| Migración + trigger | S |
| `availability.ts` conteo | S |
| Ajustes (UI capacidad) | S |
| Colores calendario (3 vistas) | M |
| Selector huecos en nueva cita | S |
| **Total** | **~1–2 días** |

---

## 2. Análisis página por página

Notación: ✅ bien · ⚠️ mejorable · 💡 propuesta.

### 2.1 Login (`/login`)
- ✅ Funcional, limpio.
- ⚠️ Sin marca configurable (logo/nombre del salón hardcodeado).
- 💡 Logo + nombre del salón dinámicos; mensaje "¿olvidaste tu contraseña?".

### 2.2 Inicio / Dashboard (`/dashboard`)
- ✅ Accesos grandes, ideales para móvil y para personal no técnico.
- ⚠️ Es solo un menú: no aporta información operativa.
- 💡 Añadir **resumen del día** (citas, huecos libres, ingreso previsto) y **próxima cita**. *Mockup pantalla 4.* Alto impacto, bajo coste.

### 2.3 Calendario (`/dashboard/calendario`)
- ✅ 3 vistas (día/semana/mes), navegación, strip móvil, FAB. Muy bien resuelto.
- ⚠️ Rango horario fijo 07:00–21:00 ([`CalendarView.tsx:25`](../src/components/dashboard/CalendarView.tsx#L25)) aunque el salón abra otras horas → mucho scroll vacío.
- ⚠️ Modelo de ocupación binario (objeto de la sección 1).
- 💡 Ajustar el rango de slots al horario real del negocio. Colores por capacidad. Leyenda de colores visible.

### 2.4 Citas (`/dashboard/citas`)
- ✅ Lista clara, filtro activas/canceladas, impresión.
- ⚠️ Sin buscador ni filtro por fecha/cliente; límite 100 sin paginación.
- 💡 Buscador por nombre + selector de rango de fechas. Agrupar por día ("Hoy", "Mañana").

### 2.5 Clientes (`/dashboard/clientes`)
- ✅ Alta rápida, se crean solos al reservar.
- ⚠️ Solo nombre + servicio preferido. Sin teléfono, sin historial, sin ficha.
- 💡 **Ficha de cliente** (teléfono, notas/alergias, historial de visitas, gasto total, etiqueta VIP). *Mockup pantalla 5.* Es la mejora de mayor valor comercial.

### 2.6 Tickets (`/dashboard/tickets`)
- ✅ Numeración mensual secuencial, PDF, resiliente a columnas faltantes.
- ⚠️ Específico de un negocio concreto (datos fiscales en [`salonConfig.ts`](../src/lib/salonConfig.ts) hardcodeados).
- 💡 Mover datos fiscales a la tabla `salons` y a Ajustes (imprescindible para multi-salón).

### 2.7 Horarios (`/dashboard/horarios`)
- ✅ Horario semanal + días bloqueados.
- ⚠️ Un solo tramo por día (no permite turno partido mañana/tarde con cierre a mediodía).
- 💡 Permitir 2 tramos por día (mañana/tarde). Capacidad por día (sección 1).

### 2.8 Ajustes (`/dashboard/ajustes`)
- ✅ Gestión de servicios con precio/duración.
- ⚠️ Solo servicios. Falta: datos del salón, capacidad, marca.
- 💡 Secciones: Datos del salón · Capacidad · Servicios · Equipo · Recordatorios.

### 2.9 Transversal
- ⚠️ "PELUQUERIA ALI" hardcodeado en nav, dashboard, layout, salonConfig → **bloquea la venta a terceros**.
- 💡 Centralizar identidad del salón (nombre, logo, datos fiscales, zona horaria) en BD + Ajustes.

---

## 3. Análisis de la competencia

Apps de referencia en gestión de peluquerías/salones (España e internacional): **Booksy**, **Fresha** (antes Shedul/Treatwell), **Treatwell Pro**, **Flowww**, **Mangomint**, **Agenda Pro**, **Bookitit/Nextlane**, **Square Appointments**.

### Funciones habituales en la competencia

| Función | Frecuencia | ¿Encaja con "simplicidad"? |
|---|---|---|
| Agenda visual día/semana | Todas | ✅ Ya lo tienes |
| **Recordatorios SMS/WhatsApp** | Casi todas | ✅ **Imprescindible** |
| **Ficha de cliente + historial** | Todas | ✅ **Imprescindible** |
| Reserva online por el cliente | Mayoría | ⚠️ Opcional (rompe "uso interno") |
| Pago / depósito anti no-show | Mayoría | ⚠️ Avanzado |
| Caja / TPV / cierre diario | Mayoría | ✅ Tienes tickets; falta cierre de caja |
| Informes (ingresos, ocupación) | Todas | ✅ **Recomendado** |
| Multi-profesional + comisiones | Mayoría | ⚠️ Tienes `staff_members` sin usar |
| Lista de espera / huecos | Algunas | 💡 Encaja con la capacidad |
| Inventario de productos | Mayoría | ❌ Fuera de alcance |
| Marketing / fidelización | Mayoría | ❌ Fuera de alcance (de momento) |
| Reseñas | Mayoría | ❌ Fuera de alcance |

### Qué SÍ añadir (sin perder simplicidad)

1. **Recordatorios por WhatsApp** — botón que abre WhatsApp con mensaje predefinido (`wa.me/`). Cero coste, cero integración compleja. *Mockup pantalla 6.* **Diferenciador clave en España.**
2. **Ficha de cliente con historial** — teléfono, notas, visitas, gasto. *Mockup pantalla 5.*
3. **Informes básicos** — ingresos del día/semana/mes, ocupación %, servicios top, ranking de clientes. Aprovecha datos que ya guardas.
4. **Cierre de caja diario** — total del día, desglose por servicio (extiende tickets).
5. **Activar el módulo de profesionales** — ya existe `staff_members`; falta asignar `staff_id` a las citas y filtrar la agenda por profesional. Habilita capacidad "real" por persona.

### Qué NO añadir (de momento)
Reserva pública online, pagos, inventario, marketing automatizado, reseñas. Rompen la promesa de "app interna simple"; se dejan para una edición "Pro" futura.

---

## 4. Roadmap priorizado

### Fase 1 — Lo pedido + quick wins (1 semana)
- [ ] Capacidad multi-cliente por tramo + colores (sección 1).
- [ ] Resumen del día en Inicio.
- [ ] Recordatorio WhatsApp (botón en detalle de cita).
- [ ] Centralizar identidad del salón (quitar hardcodes) → datos fiscales en Ajustes.

### Fase 2 — Valor comercial (1–2 semanas)
- [ ] Ficha de cliente con historial y teléfono.
- [ ] Informes básicos (ingresos + ocupación).
- [ ] Horario con turno partido (mañana/tarde).
- [ ] Buscador en Citas.

### Fase 3 — Producto vendible / multi-salón (2–3 semanas)
- [ ] Onboarding de salón nuevo (alta self-service).
- [ ] Módulo de profesionales activo (asignar y filtrar por staff).
- [ ] Cierre de caja diario.
- [ ] Landing + edición "Pro" (reserva online opcional).

---

## 5. Principios a mantener

- **Mobile-first** y usable con una mano: no añadir densidad innecesaria.
- **Cada función nueva = pantalla simple**, no formularios largos.
- **Retrocompatibilidad**: capacidad por defecto = 1; nada cambia para quien no la configure.
- **Servidor manda**: validación de capacidad en BD/trigger, no solo en UI.
- Las funciones "Pro" (reserva online, pagos) se aíslan para no ensuciar el flujo interno.

---

*Siguiente paso sugerido:* validar el mockup y decidir el alcance de la Fase 1 para empezar a implementar.
