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
  await expect(page.getByRole("heading", { name: "Welcome back." })).toBeVisible();
  await expect(page.getByRole("tab", { name: /Sign in/i })).toHaveAttribute("aria-selected", "true");
  await expect(page.getByRole("tab", { name: /Create account/i })).toBeVisible();
  await expect(page.getByLabel("Phone number")).toBeVisible();
  await expect(page.getByLabel("Password")).toBeVisible();
  await expect(page.getByRole("button", { name: /Open Telegram bot/i })).toHaveCount(0);
  await expect(page.getByRole("button", { name: /demo|simulate connection/i })).toHaveCount(0);
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
      body: JSON.stringify({ detail: { code: "INVALID_CREDENTIALS", message: "Incorrect phone number or password." } }),
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
  await page.getByLabel("Phone number").fill("7875551234");
  await page.getByLabel("Password").fill("ContraseñaSegura123");
  await page.getByRole("button", { name: "Sign in" }).click();

  await expect(page.getByRole("alert")).toContainText("Incorrect phone number or password.");
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
  await page.getByRole("tab", { name: /Create account/i }).click();
  await page.getByLabel("Phone number").fill("7875551234");
  await page.getByLabel("Create password").fill("ContraseñaSegura123");
  await page.getByLabel("Confirm password").fill("ContraseñaSegura123");
  await page.locator(".terms-check input").check();
  await page.getByRole("button", { name: "Continue with Telegram" }).click();

  await expect(page.getByRole("heading", { name: "Verify your number." })).toBeVisible();
  await expect(page.getByRole("link", { name: /Open Telegram bot/ })).toHaveAttribute(
    "href",
    "https://t.me/ftrade_test_bot?start=verify_challenge-token",
  );
  expect(postedPayload).toEqual({ phone: "+17875551234", password: "ContraseñaSegura123" });
});

test("Mi Plan y Soporte usan el contacto oficial de WhatsApp", async ({ page }) => {
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
          price_usdt: "10.000",
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
  await expect(page.getByRole("heading", { name: "Invest in a better perspective." })).toBeVisible();
  await expect(page.locator(".premium-plan .plan-price")).toContainText("10");
  await expect(page.locator(".premium-plan .plan-price")).not.toContainText("10.000");
  await expect(page.getByRole("heading", { name: "Your payment history" })).toBeVisible();
  const planWhatsapp = page.getByRole("link", { name: /Contact via WhatsApp/i });
  await expect(planWhatsapp).toHaveAttribute("href", "https://wa.me/5359494299");
  await expect(page.getByText("The administrator's WhatsApp contact has not been configured yet.")).toHaveCount(0);

  await page.goto("/soporte");
  const supportWhatsapp = page.getByRole("link", { name: /Administrator 1/i });
  await expect(supportWhatsapp).toHaveAttribute("href", "https://wa.me/5359494299");
  await expect(page.getByText("The administrator's WhatsApp contact has not been configured yet.")).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "This section could not be displayed" })).toHaveCount(0);
});



test("English is the default and the language selector persists Spanish across refreshes", async ({ page }) => {
  await page.goto("/login");
  await expect(page.getByRole("heading", { name: "Welcome back." })).toBeVisible();
  await expect(page.getByRole("button", { name: "English" })).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: "Spanish" }).click();
  await expect(page.getByRole("heading", { name: "Bienvenido de nuevo." })).toBeVisible();
  await expect(page.getByRole("button", { name: "Español" })).toHaveAttribute("aria-pressed", "true");
  await expect.poll(() => page.evaluate(() => localStorage.getItem("ftrade.language"))).toBe("es");
  await page.reload();
  await expect(page.getByRole("heading", { name: "Bienvenido de nuevo." })).toBeVisible();
});
