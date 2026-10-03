import { defineConfig } from '@playwright/test'

// Körs mot den separata dev-deploymenten (coordinated-coyote-775), aldrig
// produktion — se .env.local: VITE_CONVEX_URL pekar redan på dev.
// Antar att `npm run dev -- --port 5174` och `npx convex dev` redan körs
// (startas manuellt innan testkörning, inte via webServer här, eftersom
// convex dev är en egen långlivad process utanför Playwrights ansvar).
export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  fullyParallel: false,
  workers: 1,
  reporter: [['list']],
  use: {
    baseURL: 'http://localhost:5174',
    trace: 'retain-on-failure',
  },
})
