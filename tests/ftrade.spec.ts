import { test, expect } from "@playwright/test";

const apiBase = "http://127.0.0.1:8000";

test.beforeEach(async ({ page }) => {
  // The app still runs against the real API contract, but each test owns the
  // HTTP responses so the suite never needs a production account or secrets.
  await page.route(`${apiBase}/**`, async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === "/auth/refresh") {
      await route.fulfill({
        status: 401,
        contentType: "application/json",
        body: JSON.stringify({ detail: "No hay una sesión activa." }),
      });
      return;
    }
    await route.fulfill({
      status: 401,
      contentType: "application/json",
      body: JSON.stringify({ detail: "No autenticado en la prueba." }),
    });
  });
});

test("el inicio de sesión no ofrece accesos ni códigos de demostración", async ({ page }) => {
  await page.goto("/login");
  await expect(page.getByRole("heading", { name: "Tu mercado empieza aquí." })).toBeVisible();
  await expect(page.getByRole("button", { name: /demo|simular vinculación/i })).toHaveCount(0);
  await expect(page.getByText("123456", { exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: /rellenar wallet de prueba/i })).toHaveCount(0);
});

test("el login inicia una vinculación mediante la API y no salta la verificación", async ({ page }) => {
  let postedPhone = "";
  await page.route(`${apiBase}/auth/phone`, async (route) => {
    const payload = route.request().postDataJSON() as { phone?: string };
    postedPhone = String(payload.phone || "");
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        token: "challenge-token",
        phone: postedPhone,
        step: "awaiting_telegram",
        expires_at: "2099-10-25T23:00:00Z",
        resend_at: "2099-10-25T22:00:00Z",
      }),
    });
  });
  await page.route(`${apiBase}/auth/telegram-check**`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ linked: false }),
    });
  });

  await page.goto("/login");
  await page.getByLabel("Número de teléfono").fill("55123456");
  await page.locator(".terms-check input").check();
  await page.getByRole("button", { name: "Continuar con mi teléfono" }).click();

  await expect(page.getByRole("heading", { name: "Una verificación, nada más." })).toBeVisible();
  await expect(page.getByRole("link", { name: /Abrir bot de Telegram/ })).toHaveAttribute(
    "href",
    "https://t.me/ftrade_test_bot?start=verify_challenge-token",
  );
  expect(postedPhone).toBe("+5355123456");
  await expect(page.locator('input[aria-label^="Dígito "]')).toHaveCount(0);
});
