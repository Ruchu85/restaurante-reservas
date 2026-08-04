/**
 * seed-demo.mjs — Datos de demostración del restaurante demo.
 *
 * Genera reservas y fichas de comensal de agosto a diciembre de 2026, con la
 * variedad necesaria para poder enseñar la app entera: clientes habituales,
 * no-shows, alergias, grupos grandes con mesas juntadas, servicios llenos y
 * servicios flojos.
 *
 *   node demo/seed-demo.mjs            # genera lo que falte
 *   node demo/seed-demo.mjs --limpiar  # borra antes lo que generó este script
 *
 * Respeta las reglas reales del sistema:
 *  - solo días abiertos (cerrado lunes y martes)
 *  - una reserva por mesa y turno: con 90 minutos de duración todos los huecos
 *    de un turno se solapan, así que la restricción de exclusión de Postgres
 *    solo admite una reserva por mesa en cada servicio
 *  - el grupo cabe en la mesa asignada
 *  - los grupos que no caben en una sola mesa ocupan dos, registradas en
 *    `reservation_tables` como haría la propia aplicación
 *
 * Solo toca el restaurante con slug `restaurante-demo`.
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";

const RESTAURANT_ID = "00000000-0000-0000-0000-000000000001";

// Dos ventanas. El historial pasado no es un capricho: sin él, todos los
// comensales aparecen con "0 visitas" y el CRM —que es la función que más
// vende— se ve vacío. Con historial hay clientes que han venido diez veces,
// otros con no-shows acumulados, y las señales de sala tienen sentido.
const HISTORIA_DESDE = "2026-03-01";
const HISTORIA_HASTA = "2026-07-31";
const DESDE = "2026-08-01";
const HASTA = "2026-12-31";
const MARCA = "seed-demo"; // queda en internal_notes para poder limpiarlo luego

function env(clave) {
  const linea = readFileSync(new URL("../.env.local", import.meta.url), "utf8")
    .split(/\r?\n/)
    .find((l) => l.startsWith(clave + "="));
  if (!linea) throw new Error(`Falta ${clave} en .env.local`);
  return linea.slice(clave.length + 1).trim();
}

const db = createClient(env("NEXT_PUBLIC_SUPABASE_URL"), env("SUPABASE_SERVICE_ROLE_KEY"), {
  auth: { autoRefreshToken: false, persistSession: false },
});

// Semilla fija: relanzar el script da el mismo reparto y la demo no "baila".
let semilla = 20260801;
const rnd = () => ((semilla = (semilla * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
const entre = (a, b) => a + Math.floor(rnd() * (b - a + 1));
const elige = (xs) => xs[Math.floor(rnd() * xs.length)];
const chance = (p) => rnd() < p;

const NOMBRES = [
  "Lucía", "Martín", "Sofía", "Hugo", "Paula", "Mateo", "Carmen", "Pablo", "Julia", "Álvaro",
  "Marta", "Diego", "Elena", "Adrián", "Sara", "Javier", "Laura", "Sergio", "Ana", "Daniel",
  "Irene", "Rubén", "Nuria", "Óscar", "Beatriz", "Andrés", "Clara", "Iván", "Rocío", "Gonzalo",
  "Patricia", "Ignacio", "Alicia", "Manuel", "Cristina", "Jorge", "Silvia", "Raúl", "Teresa", "Víctor",
];
const APELLIDOS = [
  "García", "Fernández", "Rodríguez", "Martínez", "López", "Sánchez", "Pérez", "Gómez",
  "Martín", "Jiménez", "Ruiz", "Hernández", "Díaz", "Moreno", "Muñoz", "Álvarez",
  "Romero", "Alonso", "Gutiérrez", "Navarro", "Torres", "Domínguez", "Vázquez", "Ramos",
  "Gil", "Serrano", "Blanco", "Molina", "Castro", "Ortega", "Rubio", "Marín",
];
const ALERGIAS = [
  "Marisco", "Gluten", "Frutos secos", "Lactosa",
  "Marisco y frutos secos", "Huevo", "Pescado azul",
];
const NOTAS_SALA = [
  "Prefiere mesa junto a la ventana.",
  "Viene con carrito, necesita espacio al lado.",
  "Siempre pide la misma mesa de la terraza.",
  "Cliente de empresa, suele pedir factura.",
  "Le gusta el Bierzo, recomendarle novedades.",
  "Celebra su aniversario cada octubre.",
  "Muy puntual con la temperatura de la carne.",
];
const PETICIONES = [
  "Celebramos un cumpleaños, ¿podéis traer una vela?",
  "Si es posible, mesa tranquila.",
  "Venimos con un bebé, necesitamos trona.",
  "Alergia al marisco en un comensal.",
  "Preferimos terraza si hace buen tiempo.",
  "Cena de empresa, necesitamos factura.",
  "Uno de los comensales es celíaco.",
  null, null, null, null, null, null, // la mayoría no deja nota
];

/** Móvil español válido (6xx/7xx): son los únicos que admiten WhatsApp. */
function telefono() {
  let n = String(chance(0.75) ? 6 : 7);
  for (let i = 0; i < 8; i++) n += entre(0, 9);
  return "+34" + n;
}

function sinAcentos(s) {
  return s.normalize("NFD").replace(/\p{Diacritic}/gu, "");
}

function crearComensales(cuantos) {
  const usados = new Set();
  const lista = [];
  while (lista.length < cuantos) {
    const nombre = `${elige(NOMBRES)} ${elige(APELLIDOS)}`;
    const phone = telefono();
    if (usados.has(phone)) continue;
    usados.add(phone);

    const tags = [];
    if (chance(0.08)) tags.push("vip");
    if (chance(0.06)) tags.push("celebracion");
    if (chance(0.03)) tags.push("prensa");
    const allergies = chance(0.18) ? elige(ALERGIAS) : null;
    if (allergies) tags.push("alergias");

    lista.push({
      id: randomUUID(),
      restaurant_id: RESTAURANT_ID,
      phone,
      name: nombre,
      email: chance(0.6) ? `${sinAcentos(nombre).toLowerCase().replace(/ /g, ".")}@example.com` : null,
      allergies,
      notes: chance(0.15) ? elige(NOTAS_SALA) : null,
      tags: [...new Set(tags)],
    });
  }
  return lista;
}

const TURNOS = {
  comida: ["13:30", "14:00", "14:30"],
  cena: ["20:30", "21:00", "21:30", "22:00"],
};

/** Fecha + hora local de Madrid → instante UTC. Correcto en cambios de hora. */
function aUtc(fecha, hora) {
  const [y, m, d] = fecha.split("-").map(Number);
  const [hh, mm] = hora.split(":").map(Number);
  const naive = Date.UTC(y, m - 1, d, hh, mm);
  const offset = (dt) => {
    const p = new Intl.DateTimeFormat("en-US", {
      timeZone: "Europe/Madrid", hour12: false,
      year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit", second: "2-digit",
    }).formatToParts(dt);
    const g = (t) => Number(p.find((x) => x.type === t).value);
    return (Date.UTC(g("year"), g("month") - 1, g("day"), g("hour") % 24, g("minute"), g("second")) - dt.getTime()) / 60000;
  };
  let o = offset(new Date(naive));
  let r = new Date(naive - o * 60000);
  const o2 = offset(r);
  if (o2 !== o) r = new Date(naive - o2 * 60000);
  return r;
}

function* dias(desde, hasta) {
  const d = new Date(desde + "T00:00:00Z");
  const fin = new Date(hasta + "T00:00:00Z");
  while (d <= fin) {
    yield d.toISOString().slice(0, 10);
    d.setUTCDate(d.getUTCDate() + 1);
  }
}

/** Mesas ocupadas en ese turno. Fines de semana y diciembre llenan más. */
function ocupacion(fecha, turno) {
  const dow = new Date(fecha + "T00:00:00Z").getUTCDay();
  const mes = Number(fecha.slice(5, 7));
  const finde = dow === 5 || dow === 6 || dow === 0;

  let base = finde ? entre(6, 9) : entre(3, 6);
  if (turno === "cena" && !finde) base = Math.min(9, base + 1);
  if (mes === 8) base = Math.max(2, base - 2);       // agosto, vacaciones
  if (mes === 12) base = Math.min(9, base + 2);      // diciembre, comidas de empresa
  if (chance(0.08)) base = Math.max(1, base - 3);    // algún día flojo suelto
  return Math.min(base, 9);
}

async function main() {
  const limpiar = process.argv.includes("--limpiar");

  const { data: mesas } = await db
    .from("restaurant_tables")
    .select("id, name, capacity, min_capacity, section")
    .eq("restaurant_id", RESTAURANT_ID)
    .eq("active", true)
    .order("sort_order");
  if (!mesas?.length) throw new Error("No hay mesas activas");

  const { data: cerrados } = await db
    .from("blocked_days")
    .select("date")
    .eq("restaurant_id", RESTAURANT_ID);
  const bloqueados = new Set((cerrados ?? []).map((b) => b.date));

  if (limpiar) {
    const { error, count } = await db
      .from("reservations")
      .delete({ count: "exact" })
      .eq("restaurant_id", RESTAURANT_ID)
      .like("internal_notes", `%${MARCA}%`);
    if (error) throw new Error("limpieza: " + error.message);
    console.log(`Limpieza: ${count ?? 0} reservas de demo eliminadas.`);
  }

  const { count: yaHay } = await db
    .from("reservations")
    .select("id", { count: "exact", head: true })
    .eq("restaurant_id", RESTAURANT_ID)
    .like("internal_notes", `%${MARCA}%`);
  if ((yaHay ?? 0) > 0) {
    console.log(`Ya hay ${yaHay} reservas de demo. Usa --limpiar para regenerarlas.`);
    return;
  }

  // Mesas ya ocupadas por reservas que no ha creado este script (pruebas,
  // reservas reales…). Sin esto, el generador choca con la restricción de
  // exclusión de Postgres, que es justo la que impide doblar una mesa.
  const { data: previas } = await db
    .from("reservations")
    .select("starts_at, table_id, status")
    .eq("restaurant_id", RESTAURANT_ID)
    .gte("starts_at", HISTORIA_DESDE)
    .not("status", "in", "(cancelled,no_show)");

  const ocupadas = new Set();
  for (const r of previas ?? []) {
    if (!r.table_id) continue;
    const local = new Date(r.starts_at).toLocaleString("sv-SE", { timeZone: "Europe/Madrid" });
    const [fecha, hora] = local.split(" ");
    const turno = Number(hora.slice(0, 2)) < 17 ? "comida" : "cena";
    ocupadas.add(`${fecha}|${turno}|${r.table_id}`);
  }
  if (ocupadas.size > 0) {
    console.log(`Respetando ${ocupadas.size} mesa(s) ya reservadas de antes.`);
  }


  const comensales = crearComensales(220);
  console.log(`Creando ${comensales.length} fichas de comensal…`);
  for (let i = 0; i < comensales.length; i += 100) {
    const { error } = await db
      .from("guests")
      .upsert(comensales.slice(i, i + 100), { onConflict: "restaurant_id,phone" });
    if (error) throw new Error("guests: " + error.message);
  }

  // Unos pocos habituales concentran muchas visitas: es lo que hace que el CRM
  // se vea útil, porque el equipo reconoce al cliente que vuelve.
  const habituales = comensales.slice(0, 30);
  const ocasionales = comensales.slice(30);

  const hoy = new Date().toISOString().slice(0, 10);
  const reservas = [];
  const asignaciones = [];

  for (const fecha of dias(HISTORIA_DESDE, HASTA)) {
    const dow = new Date(fecha + "T00:00:00Z").getUTCDay();
    if (dow === 1 || dow === 2 || bloqueados.has(fecha)) continue;

    for (const [turno, horas] of Object.entries(TURNOS)) {
      const objetivo = ocupacion(fecha, turno);
      const libres = [...mesas]
        .filter((m) => !ocupadas.has(`${fecha}|${turno}|${m.id}`))
        .sort(() => rnd() - 0.5);
      let usadas = 0;

      while (usadas < objetivo && libres.length > 0) {
        const mesa = libres.shift();
        usadas++;

        // Grupo grande ocasional: junta con otra mesa de la misma sala.
        const mesasReserva = [mesa];
        let maxPax = mesa.capacity;
        if (mesa.capacity >= 6 && chance(0.12)) {
          const idx = libres.findIndex((m) => m.section === mesa.section);
          if (idx >= 0) {
            const extra = libres.splice(idx, 1)[0];
            mesasReserva.push(extra);
            maxPax += extra.capacity;
            usadas++;
          }
        }

        const pax =
          mesasReserva.length > 1
            ? entre(mesa.capacity + 1, maxPax)
            : entre(Math.max(1, mesa.min_capacity), mesa.capacity);

        const comensal = chance(0.45) ? elige(habituales) : elige(ocasionales);
        const inicio = aUtc(fecha, elige(horas));
        const fin = new Date(inicio.getTime() + 90 * 60000);

        // Pasado: la mayoría se completó, con algún no-show y alguna
        // cancelación. Futuro: casi todo confirmado.
        const status =
          fecha < hoy
            ? chance(0.86) ? "completed" : chance(0.55) ? "no_show" : "cancelled"
            : chance(0.94) ? "confirmed" : "cancelled";

        const id = randomUUID();
        reservas.push({
          id,
          restaurant_id: RESTAURANT_ID,
          table_id: mesasReserva[0].id,
          guest_id: comensal.id,
          guest_name: comensal.name,
          guest_phone: comensal.phone,
          guest_email: comensal.email,
          party_size: pax,
          starts_at: inicio.toISOString(),
          ends_at: fin.toISOString(),
          notes: elige(PETICIONES),
          internal_notes: MARCA,
          status,
          source: chance(0.55) ? "online" : chance(0.65) ? "phone" : "admin",
        });

        for (const m of mesasReserva) {
          asignaciones.push({
            reservation_id: id,
            table_id: m.id,
            starts_at: inicio.toISOString(),
            ends_at: fin.toISOString(),
            status,
          });
        }
      }
    }
  }

  console.log(`Insertando ${reservas.length} reservas…`);
  for (let i = 0; i < reservas.length; i += 200) {
    const { error } = await db.from("reservations").insert(reservas.slice(i, i + 200));
    if (error) throw new Error(`reservations (lote ${i}): ${error.message}`);
  }

  console.log(`Asignando ${asignaciones.length} mesas…`);
  for (let i = 0; i < asignaciones.length; i += 200) {
    const { error } = await db.from("reservation_tables").insert(asignaciones.slice(i, i + 200));
    if (error) throw new Error(`reservation_tables (lote ${i}): ${error.message}`);
  }

  const porEstado = reservas.reduce((a, r) => ((a[r.status] = (a[r.status] ?? 0) + 1), a), {});
  const juntadas = new Set(
    asignaciones
      .map((a) => a.reservation_id)
      .filter((id, _, arr) => arr.indexOf(id) !== arr.lastIndexOf(id)),
  );

  console.log("\nListo:");
  console.log(`  comensales      ${comensales.length}`);
  console.log(`  reservas        ${reservas.length}`);
  for (const [k, v] of Object.entries(porEstado)) console.log(`     ${k.padEnd(11)} ${v}`);
  console.log(`  mesas juntadas  ${juntadas.size} reservas de grupo grande`);
  console.log(`  historial       ${HISTORIA_DESDE} → ${HISTORIA_HASTA}`);
  console.log(`  agenda futura   ${DESDE} → ${HASTA}`);
}

main().catch((e) => {
  console.error("ERROR:", e.message);
  process.exit(1);
});
