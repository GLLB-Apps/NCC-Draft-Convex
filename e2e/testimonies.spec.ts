import { test, expect } from '@playwright/test'
import { loginAsAdmin, convexInlineQuery, convexDeleteRow } from './helpers'

// Regressionstest för säkerhetsfixen i samma arbetspass: getById() saknade
// behörighetskontroll, så ett opublicerat (pending) vittnesmål kunde läsas
// av vem som helst som kände dess id via TestimonyDetailPage.tsx (publik
// sida). Verifierar nu att gated-flödet faktiskt håller i webbläsaren,
// inte bara i en enhetsnivåkontroll mot Convex direkt.
test('vittnesmål: publik inlämning är dold förrän admin godkänner den', async ({ page, browser }) => {
  const stamp = Date.now()
  const title = `Playwright testvittnesmål ${stamp}`
  const authorName = `PW Test ${stamp}`
  const story = `Playwright-teststory ${stamp} — automatiserad verifiering, ingen riktig inlämning.`
  const email = `pw-testimony-${stamp}@example.com`

  // --- Publik inlämning (anonym webbläsarkontext) ---
  const publicCtx = await browser.newContext()
  const publicPage = await publicCtx.newPage()
  await publicPage.goto('/vittnesmal')
  await publicPage.getByRole('tab').nth(1).click()

  await publicPage.locator('#author_name').fill(authorName)
  await publicPage.locator('#title').fill(title)
  await publicPage.locator('#story').fill(story)
  await publicPage.getByRole('button', { name: 'Nästa' }).click()
  await publicPage.getByRole('button', { name: 'Nästa' }).click()

  await publicPage.locator('#email').fill(email)
  await publicPage.locator('#consent_publish').check()
  await publicPage.locator('button[type="submit"]').click()
  // Formuläret återställs (story blir tom igen) först efter lyckad submit.
  await expect(publicPage.locator('#story')).toHaveValue('', { timeout: 10_000 })

  const row = convexInlineQuery(
    `const rows = await ctx.db.query("testimonies").order("desc").take(10); `
    + `return rows.find(r => r.story === ${JSON.stringify(story)})`,
  ) as { _id: string } | null
  expect(row, 'Hittade inte den nyss skapade testimony-raden').not.toBeNull()
  const id = row!._id

  // --- Fortfarande dold för anonyma besökare direkt via id (statusgrind) ---
  await publicPage.goto(`/vittnesmal/${id}`)
  await expect(publicPage.getByRole('heading', { name: 'Vittnesmålet hittades inte' })).toBeVisible()

  // --- Admin ser och kan godkänna den ---
  await loginAsAdmin(page)
  await page.goto('/admin/vittnesmal')
  await page.getByLabel('Filtrera på status').selectOption('pending')
  const adminRow = page.locator('.admin-list-item', { hasText: title })
  await expect(adminRow).toBeVisible()
  await adminRow.getByRole('button', { name: 'Granska' }).click()
  await expect(page.locator('.card')).toContainText(story)
  await page.getByRole('button', { name: 'Godkänn' }).click()
  await expect(page.locator('body')).toContainText(/godkänt|uppdaterad|sparad/i)

  // --- Nu synlig för samma anonyma besökare ---
  await publicPage.goto(`/vittnesmal/${id}`)
  await expect(publicPage.locator('body')).toContainText(story.slice(0, 40))

  await publicCtx.close()

  // --- Städa upp testdatan (dev-only) ---
  const contactRow = convexInlineQuery(
    `const rows = await ctx.db.query("testimonyContacts").order("desc").take(10); `
    + `return rows.find(r => r.testimony_id === ${JSON.stringify(id)})`,
  ) as { _id: string } | null
  convexDeleteRow('testimonies', id)
  if (contactRow) convexDeleteRow('testimonyContacts', contactRow._id)
})
