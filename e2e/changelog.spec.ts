import { test, expect } from '@playwright/test'
import { loginAsAdmin } from './helpers'

// Verifierar att GitHub-importen fungerar mot det nu sammanlänkade, publika
// NCC-Draft-Convex-repot (tidigare pekade GITHUB_REPO mot det gamla privata
// NCC-Draft-RS, vilket hade gett "Hittade inte ... Är repot privat igen?").
test('ändringslogg: GitHub-import når repot utan "privat repo"-fel', async ({ page }) => {
  await loginAsAdmin(page)
  await page.goto('/admin/andringslogg')
  await page.getByRole('button', { name: /Hämta från GitHub/ }).click()

  const panel = page.locator('.changelog-import')
  await expect(panel.locator('.spinner')).toHaveCount(0, { timeout: 20_000 })
  // Lyckat utfall är ANTINGEN en commit-lista eller "inga nya commits" —
  // aldrig github.ts's felmeddelanden ("privat"/"Hittade inte"/nätverksfel).
  await expect(panel).not.toContainText(/privat|hittade inte|kunde inte nå|svarade 4\d\d/i)
  await expect(panel.locator('.changelog-import-list, .empty-state')).toHaveCount(1)
})
