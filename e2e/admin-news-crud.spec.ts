import { test, expect } from '@playwright/test'
import { loginAsAdmin } from './helpers'

// Regressionstest för de två buggarna som fixades i detta arbetspass:
// 1. Redigeringsformuläret var tomt när man öppnade en befintlig nyhet
//    (supabase.ts: .eq('id', x).select() matchade aldrig server-side).
// 2. "Nyast först" tappade sin andra sorteringsnyckel (bara this.orders[0]
//    skickades till Convex).
test('admin: skapa, lista i rätt ordning, redigera (formuläret ska INTE vara tomt), spara, ta bort', async ({ page }) => {
  const stamp = Date.now()
  const titleA = `Playwright A ${stamp}`
  const titleB = `Playwright B ${stamp}`

  await loginAsAdmin(page)

  // --- Skapa post A, sedan B (B skapas/publiceras strax efter A) ---
  for (const [title, excerpt] of [[titleA, 'Ingress A'], [titleB, 'Ingress B']] as const) {
    await page.goto('/admin/nyheter/ny')
    await page.locator('.editor-title-input').fill(title)
    await page.locator('.editor-excerpt-input').fill(excerpt)
    await page.getByRole('button', { name: 'Publicera' }).click()
    await page.waitForURL('**/admin/nyheter')
  }

  // --- Sortering: B (senast uppdaterad) ska stå ÖVER A, inte i skapandeordning ---
  await page.goto('/admin/nyheter')
  await expect(page.locator('.admin-list-item-title').first()).toBeVisible()
  const titles = await page.locator('.admin-list-item-title').allTextContents()
  const indexA = titles.findIndex(t => t.includes(titleA))
  const indexB = titles.findIndex(t => t.includes(titleB))
  expect(indexA, `${titleA} saknas i listan`).toBeGreaterThanOrEqual(0)
  expect(indexB, `${titleB} saknas i listan`).toBeGreaterThanOrEqual(0)
  expect(indexB, 'B (senast uppdaterad) ska ligga före A i listan').toBeLessThan(indexA)

  // --- Öppna B för redigering: formuläret ska vara förifyllt, INTE tomt ---
  const rowB = page.locator('.admin-list-item', { hasText: titleB })
  await rowB.getByRole('link', { name: 'Redigera' }).click()
  await page.waitForURL(/\/admin\/nyheter\/[a-z0-9]+$/)
  await expect(page.locator('.editor-title-input')).toHaveValue(titleB)
  await expect(page.locator('.editor-excerpt-input')).toHaveValue('Ingress B')

  // --- Redigera och spara, ladda om sidan, verifiera att ändringen hölls ---
  const titleBEdited = `${titleB} (redigerad)`
  await page.locator('.editor-title-input').fill(titleBEdited)
  await page.getByRole('button', { name: 'Spara' }).click()
  await expect(page.locator('body')).toContainText('Sparat')
  await page.reload()
  await expect(page.locator('.editor-title-input')).toHaveValue(titleBEdited)

  // --- Städa upp: ta bort båda testposterna ---
  await page.goto('/admin/nyheter')
  for (const title of [titleBEdited, titleA]) {
    const row = page.locator('.admin-list-item', { hasText: title })
    await row.getByRole('button', { name: 'Ta bort' }).click()
    await page.getByRole('alertdialog').getByRole('button', { name: 'Ta bort' }).click()
    await expect(page.locator('.admin-list-item', { hasText: title })).toHaveCount(0)
  }
})
