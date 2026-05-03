import { test, expect } from "@playwright/test";

test.describe("Flujo de reserva pública", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
  });

  test("landing page muestra el CTA de reserva", async ({ page }) => {
    await expect(page.locator("text=Reservar ahora")).toBeVisible();
    await expect(page.locator("text=Nuestros servicios")).toBeVisible();
  });

  test("el botón de reservar navega a /reservar", async ({ page }) => {
    await page.click("text=Reservar ahora");
    await expect(page).toHaveURL(/\/reservar/);
    await expect(page.locator("text=Reservar cita")).toBeVisible();
  });

  test("flujo de reserva muestra el wizard con pasos", async ({ page }) => {
    await page.goto("/reservar");
    // Should show step 1: service selection
    await expect(page.locator("text=¿Qué servicio deseas?")).toBeVisible();
  });
});

test.describe("Página de confirmación", () => {
  test("muestra mensaje de confirmación sin ID", async ({ page }) => {
    await page.goto("/reservar/confirmacion");
    await expect(page.locator("text=¡Cita confirmada!")).toBeVisible();
    await expect(page.locator("text=Volver al inicio")).toBeVisible();
  });
});
