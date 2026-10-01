import process from 'node:process'

import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: 'http://127.0.0.1:4173',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: [
    {
      command: 'PORT=3100 DATABASE_PATH=:memory: AGENT_PROVIDER=mock FRONTEND_ORIGIN=http://127.0.0.1:4173 npm start --prefix ../backend',
      url: 'http://127.0.0.1:3100/api/health',
      reuseExistingServer: false,
      timeout: 30_000,
    },
    {
      command: 'VITE_API_BASE_URL=http://127.0.0.1:3100 VITE_PERSONALITY_ENABLED=false npm run dev -- --host 127.0.0.1 --port 4173',
      url: 'http://127.0.0.1:4173',
      reuseExistingServer: false,
      timeout: 30_000,
    },
  ],
})
