import { test, expect } from "@playwright/test";

/**
 * Panel de sala.
 *
 * Sin sesión no se puede llegar a ninguna pantalla del panel ni leer datos por
 * la API: es la garantía que sostiene todo el aislamiento entre restaurantes.
 */
const PROTECTED_ROUTES = [
  "/dashboard",
  "/dashboard/reservas",
  "/dashboard/comensales",
  "/dashboard/mesas",
  "/dashboard/calendario",
  "/dashboard/horarios",
  "/dashboard/informes",
  "/dashboard/lista-espera",
  "/dashboard/ajustes",
];

test.describe("Panel de administración", () => {
  for (const route of PROTECTED_ROUTES) {
    test(`${route} redirige a login sin sesión`, async ({ page }) => {
      await page.goto(route);
      await expect(page).toHaveURL(/\/login/);
    });
  }

  test("la página de login muestra el formulario", async ({ page }) => {
    await page.goto("/login");
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();
    await expect(page.locator('button[type="submit"]')).toBeVisible();
  });

  test("login con credenciales inválidas muestra error y no entra", async ({ page }) => {
    await page.goto("/login");
    await page.fill('input[type="email"]', "noexiste@test.com");
    await page.fill('input[type="password"]', "wrongpassword");
    await page.click('button[type="submit"]');

    await expect(page.locator("text=/credenciales|incorrect/i")).toBeVisible({ timeout: 10000 });
    await expect(page).toHaveURL(/\/login/);
  });
});

test.describe("API del panel", () => {
  test("no devuelve reservas sin sesión", async ({ request }) => {
    const res = await request.get("/api/dashboard/reservations?date=2030-01-01");
    expect(res.status()).toBe(401);
  });

  test("no filtra datos en el cuerpo del 401", async ({ request }) => {
    const res = await request.get("/api/dashboard/reservations");
    expect(res.status()).toBe(401);
    const body = await res.json();
    expect(body.reservations).toBeUndefined();
  });
});
