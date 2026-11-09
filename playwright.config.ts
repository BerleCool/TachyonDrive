import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './e2e', timeout: 45000, retries: 0, workers: 1,
  use: { baseURL: 'http://127.0.0.1:8080', viewport: { width: 393, height: 852 }, deviceScaleFactor: 1, timezoneId: 'Europe/Copenhagen', screenshot: 'only-on-failure', trace: 'retain-on-failure' },
  webServer: { command: 'python3 -m http.server 8080 --directory dist-web', port: 8080, reuseExistingServer: false },
  reporter: [['list']],
});
