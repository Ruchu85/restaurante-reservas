// ============================================================
// SEED DEMO — Pobla el "Salón Demo" (slug: salon-demo) con datos
// ficticios atractivos para generar capturas de marketing.
//
// AISLADO: solo toca el salón con slug 'salon-demo'. NO toca tu
// salón real. Usa el SERVICE_ROLE_KEY de .env.local.
//
// Uso:  node demo/seed-demo.mjs
// ============================================================
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");

// --- Cargar .env.local sin dependencias ---
function loadEnv() {
  const raw = readFileSync(join(ROOT, ".env.local"), "utf8");
  const env = {};
  for (const line of raw.split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i);
    if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, "").trim();
  }
  return env;
}

const env = loadEnv();
const SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error("Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en .env.local");
  process.exit(1);
}

const db = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const DEMO_SLUG = "salon-demo";
const DEMO_USER_EMAIL = "demo@salondemo.es";
const DEMO_USER_PASSWORD = "DemoSalon2026!";

// --- Datos demo ---
const SALON = {
  name: "Peluquería Aurora",
  owner: "Laura Fernández",
  nif: "B-12345678",
  address: "Calle de la Luz 24",
  city: "28013 Madrid",
  phone: "+34 911 23 45 67",
  email: "hola@peluqueria-aurora.es",
  ticket_footer: "¡Gracias por tu visita! Reserva tu próxima cita.",
  slot_capacity: 2,
};

const STAFF = [
  { id: "10000000-0000-0000-0000-000000000001", name: "María García" },
  { id: "10000000-0000-0000-0000-000000000002", name: "Carlos López" },
  { id: "10000000-0000-0000-0000-000000000003", name: "Ana Martínez" },
];

const SERVICES = [
  { name: "Corte caballero", price: 14, duration_minutes: 30 },
  { name: "Corte señora", price: 20, duration_minutes: 45 },
  { name: "Corte + peinado", price: 28, duration_minutes: 60 },
  { name: "Tinte", price: 45, duration_minutes: 90 },
  { name: "Mechas / Balayage", price: 70, duration_minutes: 120 },
  { name: "Peinado", price: 18, duration_minutes: 30 },
  { name: "Recogido", price: 35, duration_minutes: 60 },
  { name: "Tratamiento hidratación", price: 25, duration_minutes: 45 },
  { name: "Arreglo de barba", price: 10, duration_minutes: 20 },
  { name: "Corte infantil", price: 12, duration_minutes: 30 },
];

const CUSTOMERS = [
  ["Lucía Romero", "+34 612 345 001", "Corte + peinado"],
  ["Javier Moreno", "+34 612 345 002", "Corte caballero"],
  ["Carmen Ortega", "+34 612 345 003", "Tinte"],
  ["Daniel Navarro", "+34 612 345 004", "Arreglo de barba"],
  ["Paula Gil", "+34 612 345 005", "Mechas / Balayage"],
  ["Sergio Díaz", "+34 612 345 006", "Corte caballero"],
  ["Marta Serrano", "+34 612 345 007", "Recogido"],
  ["Alberto Ramos", "+34 612 345 008", "Corte caballero"],
  ["Elena Castro", "+34 612 345 009", "Corte señora"],
  ["Pablo Herrera", "+34 612 345 010", "Corte + peinado"],
  ["Nuria Vega", "+34 612 345 011", "Tratamiento hidratación"],
  ["Rubén Molina", "+34 612 345 012", "Corte caballero"],
  ["Sara Iglesias", "+34 612 345 013", "Peinado"],
  ["Andrés Cano", "+34 612 345 014", "Corte caballero"],
  ["Cristina Prieto", "+34 612 345 015", "Tinte"],
  ["Diego Santos", "+34 612 345 016", "Corte infantil"],
  ["Beatriz Flores", "+34 612 345 017", "Corte señora"],
  ["Hugo Marín", "+34 612 345 018", "Arreglo de barba"],
  ["Patricia León", "+34 612 345 019", "Mechas / Balayage"],
  ["Adrián Rubio", "+34 612 345 020", "Corte caballero"],
  ["Silvia Campos", "+34 612 345 021", "Recogido"],
  ["Marcos Vidal", "+34 612 345 022", "Corte + peinado"],
  ["Laura Méndez", "+34 612 345 023", "Peinado"],
  ["Iván Garrido", "+34 612 345 024", "Corte caballero"],
];

// --- Utilidades de fecha (semana actual, Lun-Sáb, +02:00 Madrid verano) ---
function mondayOfThisWeek() {
  const now = new Date();
  const day = now.getDay(); // 0=Dom
  const diff = day === 0 ? -6 : 1 - day;
  const monday = new Date(now);
  monday.setDate(now.getDate() + diff);
  monday.setHours(0, 0, 0, 0);
  return monday;
}

function iso(dayOffset, hour, minute) {
  const monday = mondayOfThisWeek();
  const d = new Date(monday);
  d.setDate(monday.getDate() + dayOffset);
  const pad = (n) => String(n).padStart(2, "0");
  // +02:00 = horario de verano peninsular (junio)
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(hour)}:${pad(minute)}:00+02:00`;
}

function addMinutesIso(isoStr, minutes) {
  const d = new Date(isoStr);
  d.setMinutes(d.getMinutes() + minutes);
  return d.toISOString();
}

function pick(arr, i) {
  return arr[i % arr.length];
}

// Genera citas para la semana, repartidas entre staff sin solapar por staff.
function buildAppointments(salonId) {
  const appts = [];
  const todayOffset = (() => {
    const now = new Date();
    const day = now.getDay();
    return day === 0 ? 6 : day - 1; // 0=Lun ... 5=Sáb
  })();

  let custIdx = 0;
  let svcIdx = 0;
  let ticketCounter = 201;

  // Días Lun(0)..Sáb(5)
  for (let dayOffset = 0; dayOffset <= 5; dayOffset++) {
    const isSaturday = dayOffset === 5;
    const closeHour = isSaturday ? 14 : 20;
    const isPastOrToday = dayOffset <= todayOffset;

    // Para cada profesional, ir colocando citas con huecos
    for (const staff of STAFF) {
      let cursor = 9 * 60 + (STAFF.indexOf(staff) * 20); // arranque escalonado
      const closeMin = closeHour * 60;

      while (cursor < closeMin - 30) {
        const svc = pick(SERVICES, svcIdx++);
        const cust = pick(CUSTOMERS, custIdx++);
        const dur = svc.duration_minutes;
        if (cursor + dur > closeMin) break;

        const startH = Math.floor(cursor / 60);
        const startM = cursor % 60;
        const startsAt = iso(dayOffset, startH, startM);
        const endsAt = addMinutesIso(startsAt, dur);

        const appt = {
          salon_id: salonId,
          staff_id: staff.id,
          customer_name: cust[0],
          service: svc.name,
          starts_at: startsAt,
          ends_at: endsAt,
          price: svc.price,
          status: "active",
          notes: null,
        };

        // Citas de días pasados/hoy quedan "cobradas" con nº de ticket
        if (isPastOrToday) {
          appt.ticket_number = ticketCounter++;
          appt.ticket_printed = true;
        }

        appts.push(appt);

        // Hueco entre citas: la duración + 10-25 min de margen variable
        const gap = dur + (10 + ((custIdx * 7) % 20));
        cursor += gap;
      }
    }
  }
  return appts;
}

async function main() {
  console.log("→ Conectando a Supabase...");

  // 1. Salón demo
  const { data: salonRow, error: salonErr } = await db
    .from("salons")
    .upsert(
      { slug: DEMO_SLUG, timezone: "Europe/Madrid", ...SALON },
      { onConflict: "slug" }
    )
    .select("id")
    .single();
  if (salonErr) throw salonErr;
  const salonId = salonRow.id;
  console.log(`✓ Salón demo: ${SALON.name} (${salonId})`);

  // 2. Limpiar datos demo previos (solo de este salón)
  await db.from("appointments").delete().eq("salon_id", salonId);
  await db.from("customers").delete().eq("salon_id", salonId);
  await db.from("services").delete().eq("salon_id", salonId);
  console.log("✓ Datos demo previos limpiados");

  // 3. Horarios (Dom cerrado; Lun-Vie 9-20; Sáb 9-14)
  const HOURS = [
    { day_of_week: 0, opens_at: "09:00", closes_at: "20:00", is_open: false },
    { day_of_week: 1, opens_at: "09:00", closes_at: "20:00", is_open: true },
    { day_of_week: 2, opens_at: "09:00", closes_at: "20:00", is_open: true },
    { day_of_week: 3, opens_at: "09:00", closes_at: "20:00", is_open: true },
    { day_of_week: 4, opens_at: "09:00", closes_at: "20:00", is_open: true },
    { day_of_week: 5, opens_at: "09:00", closes_at: "20:00", is_open: true },
    { day_of_week: 6, opens_at: "09:00", closes_at: "14:00", is_open: true },
  ];
  for (const h of HOURS) {
    await db.from("business_hours").upsert(
      { salon_id: salonId, ...h },
      { onConflict: "salon_id,day_of_week" }
    );
  }
  console.log("✓ Horarios fijados (Lun-Sáb abierto, Dom cerrado)");

  // 4. Staff
  for (const s of STAFF) {
    await db.from("staff_members").upsert(
      { id: s.id, salon_id: salonId, name: s.name, active: true },
      { onConflict: "id" }
    );
  }
  console.log(`✓ ${STAFF.length} profesionales`);

  // 4. Servicios
  const { error: svcErr } = await db.from("services").insert(
    SERVICES.map((s) => ({ salon_id: salonId, ...s, active: true }))
  );
  if (svcErr) throw svcErr;
  console.log(`✓ ${SERVICES.length} servicios`);

  // 5. Clientes
  const { error: custErr } = await db.from("customers").insert(
    CUSTOMERS.map(([name, phone, pref]) => ({
      salon_id: salonId,
      name,
      phone,
      preferred_service: pref,
    }))
  );
  if (custErr) throw custErr;
  console.log(`✓ ${CUSTOMERS.length} clientes`);

  // 6. Citas
  const appts = buildAppointments(salonId);
  // Insertar en lotes para evitar choques con el constraint anti-solapamiento
  let inserted = 0;
  for (const appt of appts) {
    const { error } = await db.from("appointments").insert(appt);
    if (!error) inserted++;
    else if (!String(error.message).includes("appointments_no_overlap")) {
      console.warn("  cita omitida:", error.message);
    }
  }
  console.log(`✓ ${inserted} citas insertadas (semana actual)`);

  // 7. Usuario demo + profile admin
  let userId;
  const { data: created, error: createErr } = await db.auth.admin.createUser({
    email: DEMO_USER_EMAIL,
    password: DEMO_USER_PASSWORD,
    email_confirm: true,
  });
  if (createErr) {
    // Ya existe: buscarlo
    const { data: list } = await db.auth.admin.listUsers();
    const existing = list.users.find((u) => u.email === DEMO_USER_EMAIL);
    userId = existing?.id;
    if (userId) {
      await db.auth.admin.updateUserById(userId, { password: DEMO_USER_PASSWORD });
    }
    console.log("✓ Usuario demo ya existía (contraseña actualizada)");
  } else {
    userId = created.user.id;
    console.log("✓ Usuario demo creado");
  }

  if (userId) {
    await db.from("profiles").upsert(
      {
        id: userId,
        salon_id: salonId,
        role: "admin",
        full_name: "Laura (Demo)",
      },
      { onConflict: "id" }
    );
    console.log("✓ Profile admin asignado al salón demo");
  }

  console.log("\n========================================");
  console.log("  SEED DEMO COMPLETADO");
  console.log("========================================");
  console.log(`  Salón:    ${SALON.name}`);
  console.log(`  Login:    ${DEMO_USER_EMAIL}`);
  console.log(`  Password: ${DEMO_USER_PASSWORD}`);
  console.log(`  Slug:     ${DEMO_SLUG}`);
  console.log("========================================\n");
}

main().catch((e) => {
  console.error("ERROR:", e.message || e);
  process.exit(1);
});
