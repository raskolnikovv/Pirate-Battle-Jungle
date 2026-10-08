import { defineConfig, devices } from '@playwright/test';
export default defineConfig({
  testDir: './profiling', testMatch: '*.spec.ts', timeout: 360_000, workers: 1, retries: 0,
  outputDir: 'profiling-results/traces', reporter: [['list'], ['html', { outputFolder: 'profiling-results/html', open: 'never' }]],
  use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 900 },
    baseURL: 'http://127.0.0.1:4173', headless: process.env.PROFILE_HEADED !== '1', trace: 'retain-on-failure' },
  webServer: { command: 'npm run preview -- --host 127.0.0.1 --port 4173 --strictPort',
    url: 'http://127.0.0.1:4173', reuseExistingServer: false },
});
