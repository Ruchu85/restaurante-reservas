import { test, expect } from "@playwright/test";

/**
 * Flujo de reserva pública: date-party → time → contact → done.
 *
 * Estos tests no crean reservas reales: comprueban la navegación del asistente
 * y las defensas del endpoint público, que es justo lo que puede romperse sin
 * que los tests unitarios se enteren.
 */
test.describe("Reserva pública", () => {
  test("la página de reserva carga el asistente", async ({ page }) => {
    await page.goto("/reservar");
    await expect(page.locator('input[type="date"]')).toBeVisible();
  });

  test("el primer paso pide fecha y número de comensales", async ({ page }) => {
    await page.goto("/reservar");
    await expect(page.locator('input[type="date"]')).toBeVisible();
    // El tamaño de grupo se elige con botones.
    await expect(page.getByRole("button", { name: "2", exact: true })).toBeVisible();
  });

  test("el selector de fecha no permite elegir días pasados", async ({ page }) => {
    await page.goto("/reservar");
    const min = await page.locator('input[type="date"]').getAttribute("min");
    expect(min).toBeTruthy();

    // `min` debe ser hoy en la zona del restaurante, nunca ayer.
    const todayMadrid = new Date().toLocaleDateString("en-CA", { timeZone: "Europe/Madrid" });
    expect(min).toBe(todayMadrid);
  });

  test("el selector de fecha acota la antelación máxima", async ({ page }) => {
    await page.goto("/reservar");
    const input = page.locator('input[type="date"]');
    const min = await input.getAttribute("min");
    const max = await input.getAttribute("max");
    expect(max).toBeTruthy();
    expect(new Date(max!).getTime()).toBeGreaterThan(new Date(min!).getTime());
  });
});

test.describe("API pública de reservas", () => {
  test("GET exige date y party_size", async ({ request }) => {
    expect((await request.get("/api/reservations")).status()).toBe(400);
  });

  test("GET rechaza una fecha con formato inválido", async ({ request }) => {
    const res = await request.get("/api/reservations?date=ayer&party_size=2");
    expect(res.status()).toBe(400);
  });

  test("GET rechaza un party_size fuera de rango", async ({ request }) => {
    const res = await request.get("/api/reservations?date=2030-01-01&party_size=999");
    expect(res.status()).toBe(400);
  });

  test("GET no devuelve huecos para una fecha pasada", async ({ request }) => {
    const res = await request.get("/api/reservations?date=2020-01-01&party_size=2");
    expect(res.ok()).toBeTruthy();
    expect((await res.json()).slots).toEqual([]);
  });

  test("POST rechaza un cuerpo que no es JSON", async ({ request }) => {
    const res = await request.post("/api/reservations", {
      headers: { "content-type": "application/json" },
      data: "no-json",
    });
    expect(res.status()).toBe(400);
  });

  test("POST rechaza datos incompletos", async ({ request }) => {
    const res = await request.post("/api/reservations", { data: { party_size: 2 } });
    expect(res.status()).toBe(422);
  });

  test("POST rechaza reservas en el pasado", async ({ request }) => {
    const res = await request.post("/api/reservations", {
      data: {
        date: "2020-01-01",
        starts_at: "2020-01-01T20:00:00.000Z",
        party_size: 2,
        guest_name: "Test E2E",
        guest_phone: "600000000",
      },
    });
    expect(res.status()).toBe(422);
    expect((await res.json()).error).toMatch(/pasado/i);
  });

  test("un token inexistente devuelve 404, no un 500", async ({ request }) => {
    const res = await request.get("/api/reservations/00000000-0000-0000-0000-000000000000");
    expect(res.status()).toBe(404);
  });

  test("un token con formato inválido devuelve 404", async ({ request }) => {
    const res = await request.get("/api/reservations/no-es-un-uuid");
    expect(res.status()).toBe(404);
  });
});
