import { loadEnvConfig } from "@next/env";
import { defineConfig } from "@playwright/test";

import { getPlaywrightEnv } from "./lib/env";

loadEnvConfig(process.cwd());

const playwrightEnv = getPlaywrightEnv();
const baseUrl = new URL(playwrightEnv.baseUrl);
const serverPort = baseUrl.port || (baseUrl.protocol === "https:" ? "443" : "80");
const serverHost = baseUrl.hostname;

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  workers: 1,
  globalSetup: "./tests/helpers/playwright-global-setup.ts",
  reporter: playwrightEnv.isCi ? [["list"], ["html", { open: "never" }]] : "list",
  retries: playwrightEnv.isCi ? 2 : 0,
  use: {
    baseURL: playwrightEnv.baseUrl,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: {
        browserName: "chromium",
      },
    },
  ],
  webServer: playwrightEnv.skipWebServer
    ? undefined
    : {
        command: `npm run dev -- --hostname ${serverHost} --port ${serverPort}`,
        url: playwrightEnv.baseUrl,
        reuseExistingServer: !playwrightEnv.isCi,
        timeout: 120_000,
      },
});
