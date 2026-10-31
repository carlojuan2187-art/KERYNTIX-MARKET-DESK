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

test("la pantalla separa el inicio de sesión del registro", async ({ page }) => {
  await page.goto("/login");
  await expect(page.getByRole("heading", { name: "Bienvenido de nuevo." })).toBeVisible();
  await expect(page.getByRole("tab", { name: /Iniciar sesión/i })).toHaveAttribute("aria-selected", "true");
  await expect(page.getByRole("tab", { name: /Crear cuenta/i })).toBeVisible();
  await expect(page.getByLabel("Número de teléfono")).toBeVisible();
  await expect(page.getByLabel("Contraseña")).toBeVisible();
  await expect(page.getByRole("button", { name: /Abrir bot de Telegram/i })).toHaveCount(0);
  await expect(page.getByRole("button", { name: /demo|simular vinculación/i })).toHaveCount(0);
  await expect(page.getByText("123456", { exact: true })).toHaveCount(0);
});

test("el inicio de sesión usa teléfono y contraseña sin solicitar Telegram", async ({ page }) => {
  let postedPayload: { phone?: string; password?: string } | null = null;
  let telegramRequests = 0;
  await page.route(`${apiBase}/auth/login`, async (route) => {
    postedPayload = route.request().postDataJSON() as { phone?: string; password?: string };
    await route.fulfill({
      status: 401,
      contentType: "application/json",
      body: JSON.stringify({ detail: { code: "INVALID_CREDENTIALS", message: "Número o contraseña incorrectos." } }),
    });
  });
  await page.route(`${apiBase}/auth/telegram-check**`, async (route) => {
    telegramRequests += 1;
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ linked: false }) });
  });
  await page.route(`${apiBase}/auth/phone`, async (route) => {
    telegramRequests += 1;
    await route.fulfill({ status: 500, body: "No debería usarse para iniciar sesión" });
  });

  await page.goto("/login");
  await page.getByLabel("Número de teléfono").fill("7875551234");
  await page.getByLabel("Contraseña").fill("ContraseñaSegura123");
  await page.getByRole("button", { name: "Iniciar sesión" }).click();

  await expect(page.getByRole("alert")).toContainText("Número o contraseña incorrectos.");
  expect(postedPayload).toEqual({ phone: "+17875551234", password: "ContraseñaSegura123" });
  expect(telegramRequests).toBe(0);
});

test("crear cuenta solicita Telegram y envía una contraseña", async ({ page }) => {
  let postedPayload: { phone?: string; password?: string } | null = null;
  await page.route(`${apiBase}/auth/register`, async (route) => {
    postedPayload = route.request().postDataJSON() as { phone?: string; password?: string };
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        token: "challenge-token",
        phone: String(postedPayload?.phone || ""),
        step: "awaiting_telegram",
        expires_at: "2099-10-25T23:00:00Z",
        resend_at: "2099-10-25T22:00:00Z",
      }),
    });
  });
  await page.route(`${apiBase}/auth/telegram-check**`, async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ linked: false }) });
  });

  await page.goto("/login");
  await page.getByRole("tab", { name: /Crear cuenta/i }).click();
  await page.getByLabel("Número de teléfono").fill("7875551234");
  await page.getByLabel("Crear contraseña").fill("ContraseñaSegura123");
  await page.getByLabel("Confirmar contraseña").fill("ContraseñaSegura123");
  await page.locator(".terms-check input").check();
  await page.getByRole("button", { name: "Continuar con Telegram" }).click();

  await expect(page.getByRole("heading", { name: "Verifica tu número." })).toBeVisible();
  await expect(page.getByRole("link", { name: /Abrir bot de Telegram/ })).toHaveAttribute(
    "href",
    "https://t.me/ftrade_test_bot?start=verify_challenge-token",
  );
  expect(postedPayload).toEqual({ phone: "+17875551234", password: "ContraseñaSegura123" });
});

test("Mi Plan se muestra aunque no haya un teléfono de WhatsApp configurado", async ({ page }) => {
  await page.route(`${apiBase}/auth/refresh`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ access_token: "test-access-token" }),
    });
  });
  await page.route(`${apiBase}/auth/me`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        user_id: "test-user",
        phone: "+15550000000",
        plan: "free",
        trial_end: "2099-12-31T00:00:00Z",
        ref_code: "TESTREF",
        ref_premium_valid: false,
        risk_profile: { capital: 1000, risk_pct: 1 },
        watchlist: [{ symbol: "BTCUSDT", name: "Bitcoin" }],
        alert_prefs: { on: true, liq: true, mov: true, vol: true },
        tz: "America/Puerto_Rico",
        banned: false,
        created_at: "2026-10-01T00:00:00Z",
        last_activity: "2026-10-26T00:00:00Z",
      }),
    });
  });
  await page.route(`${apiBase}/billing/plans`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        plans: [{
          plan: "premium",
          price_usdt: "40.000",
          duration_days: 30,
          network: "BNB Smart Chain (BEP20)",
          token: "USDT",
          wallet: null,
          auto_verification: false,
        }],
        payment_configured: false,
      }),
    });
  });
  await page.route(`${apiBase}/payments/history**`, async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: "[]" });
  });
  await page.route(`${apiBase}/account/restriction`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ reason: "", allowed: true, ban_active: false }),
    });
  });

  await page.goto("/planes");
  await expect(page.getByRole("heading", { name: "Invierte en una mejor perspectiva." })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Tu historial de pagos" })).toBeVisible();
  await expect(page.getByText("El contacto de WhatsApp del administrador todavía no está configurado.")).toBeVisible();
  await expect(page.getByRole("heading", { name: "No se pudo mostrar esta sección" })).toHaveCount(0);
});

