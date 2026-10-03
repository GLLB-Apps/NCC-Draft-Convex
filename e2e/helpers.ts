import { execSync } from 'node:child_process'
import type { Page } from '@playwright/test'

export const TEST_ADMIN_EMAIL = 'pw-test-admin@example.com'
export const TEST_ADMIN_PASSWORD = 'PwTest1234!'

export async function loginAsAdmin(page: Page) {
  await page.goto('/admin/login')
  await page.locator('#email').fill(TEST_ADMIN_EMAIL)
  await page.locator('#password').fill(TEST_ADMIN_PASSWORD)
  await page.locator('form').getByRole('button', { name: 'Logga in' }).click()
  await page.waitForURL('**/admin')
}

/** Kör Convex CLI mot dev-deploymenten (aldrig --prod) för testdata-koll/städning. */
export function convexRun(fn: string, args: Record<string, unknown> = {}): unknown {
  const json = JSON.stringify(args).replace(/"/g, '\\"')
  const out = execSync(`npx convex run ${fn} "${json}"`, { encoding: 'utf8', cwd: process.cwd() })
  const trimmed = out.trim()
  if (!trimmed) return null
  try { return JSON.parse(trimmed) } catch { return trimmed }
}

export function convexDataLatest(table: string): Record<string, unknown> | null {
  const out = execSync(`npx convex data ${table} --limit 1 --order desc`, { encoding: 'utf8', cwd: process.cwd() })
  const lines = out.trim().split('\n')
  if (lines.length < 2) return null
  // CLI-tabellutskrift: rubrikrad, separatorrad, en datarad — plockar bara ut _id här.
  const idMatch = lines[2]?.match(/^"([^"]+)"/)
  return idMatch ? { _id: idMatch[1] } : null
}

/**
 * Rå, sandboxad läsning direkt mot databasen via CLI:ns --inline-query —
 * kringgår appens behörighetslager helt (kräver bara deploy-key-åtkomst),
 * praktiskt för att i tester hitta ett nyss publikt skapat dokuments _id
 * utan att behöva en inloggad admin-session i Node.
 */
export function convexInlineQuery(js: string): unknown {
  const out = execSync(
    `npx convex run --inline-query "${js.replace(/"/g, '\\"')}"`,
    { encoding: 'utf8', cwd: process.cwd() },
  )
  const trimmed = out.trim()
  try { return JSON.parse(trimmed) } catch { return trimmed }
}

export function convexDeleteRow(table: string, id: string) {
  execSync(`npx convex run migrateAppwriteDb:deleteRow "${JSON.stringify({ table, id }).replace(/"/g, '\\"')}"`, { cwd: process.cwd() })
}
