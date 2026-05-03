import { test, expect } from "@playwright/test";

test.describe("Panel de administración", () => {
  test("redirige a login cuando no está autenticado", async ({ page }) => {
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/login/);
  });

  test("la página de login muestra formulario", async ({ page }) => {
    await page.goto("/login");
    await expect(page.locator("text=Acceso interno")).toBeVisible();
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();
  });

  test("login con credenciales inválidas muestra error", async ({ page }) => {
    await page.goto("/login");
    await page.fill('input[type="email"]', "noexiste@test.com");
    await page.fill('input[type="password"]', "wrongpassword");
    await page.click('button[type="submit"]');
    // Toast de error
    await expect(page.locator("text=Credenciales incorrectas")).toBeVisible({ timeout: 5000 });
  });
});
