import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests",
  timeout: 40000,
  expect: { timeout: 8000 },
  workers: 1,
  reporter: "list",
  use: {
    baseURL: "http://127.0.0.1:5173",
    viewport: { width: 1440, height: 1000 },
    headless: true,
    screenshot: "only-on-failure",
  },
  webServer: {
    command: "npm run dev -- --host 0.0.0.0",
    url: "http://127.0.0.1:5173",
    reuseExistingServer: true,
    timeout: 60000,
    env: {
      VITE_API_URL: "http://127.0.0.1:8000",
      VITE_WS_URL: "ws://127.0.0.1:8000/ws/events",
      VITE_TELEGRAM_BOT_USERNAME: "ftrade_test_bot",
      VITE_ADMIN_WHATSAPP_1: "",
      VITE_ADMIN_WHATSAPP_2: "",
      VITE_ADMIN_WHATSAPP_3: "",
    },
  },
});
