import { test, expect } from '@playwright/test'
import { loginAsAdmin, TEST_ADMIN_EMAIL, convexInlineQuery, convexDeleteRow } from './helpers'

test('admin: fel lösenord nekas, visar felmeddelande', async ({ page }) => {
  await page.goto('/admin/login')
  await page.locator('#email').fill(TEST_ADMIN_EMAIL)
  await page.locator('#password').fill('helt-fel-losenord')
  await page.locator('form').getByRole('button', { name: 'Logga in' }).click()
  await expect(page).not.toHaveURL(/\/admin$/)
  // Ett toast-/felmeddelande ska synas, inte en tyst omdirigering.
  await expect(page.locator('body')).toContainText(/fel|ogiltig|misslyckades/i, { timeout: 10_000 })
})

test('admin: korrekt inloggning leder till adminpanelen', async ({ page }) => {
  await loginAsAdmin(page)
  await expect(page).toHaveURL(/\/admin$/)
  await expect(page.locator('.spinner')).toHaveCount(0, { timeout: 15_000 })
})

test('admin: utloggad användare nekas adminsidor (redirect till login)', async ({ page }) => {
  await page.goto('/admin/nyheter')
  await page.waitForURL(/\/admin\/login/, { timeout: 10_000 })
})

test('admin: självregistrering skapar ett väntande konto (ingen direkt åtkomst)', async ({ page }) => {
  const email = `pw-selfsignup-${Date.now()}@example.com`
  await page.goto('/admin/login')
  await page.getByRole('button', { name: 'Skapa konto' }).click()
  await page.locator('#displayName').fill('Playwright Test')
  await page.locator('#email').fill(email)
  await page.locator('#password').fill('NyttKonto1234!')
  await page.locator('#intro').fill('Jag är ett automatiserat Playwright-test som verifierar självregistreringsflödet för adminpanelen, inget mänskligt konto.')
  await page.locator('form').getByRole('button', { name: 'Skapa konto' }).click()
  // Självregistrering ger inget role/intranet_member — väntar på superadmin,
  // ska alltså INTE hamna i /admin (Convex Auth loggar dock in sessionen
  // direkt, så man hamnar i /internt med ett "väntar på åtkomst"-läge där).
  await expect(page).not.toHaveURL(/\/admin$/, { timeout: 10_000 })

  const created = convexInlineQuery(
    `const rows = await ctx.db.query("users").collect(); return rows.find(r => r.email === ${JSON.stringify(email)})`,
  ) as { _id: string } | null
  if (created) convexDeleteRow('users', created._id)
})
