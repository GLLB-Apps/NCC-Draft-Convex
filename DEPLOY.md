# Automatisk driftsättning (GitHub Actions) — Inleed, ingen Vercel

Push till `main` → GitHub bygger React-appen mot din Convex-produktionsdeployment
och laddar upp till Inleed via FTP. Samma mönster som `NCC-Draft-PHP` använder
(se dess DEPLOY.md), men enklare: ingen `server/`-mapp, ingen databas eller
`uploads/`-katalog att akta sig för att skriva över — allt innehåll bor i
Convex, inte på webbhotellet. Varje körning laddar upp HELA `dist/` på nytt;
det finns inget lokalt tillstånd på Inleed-sidan att förlora.

## Krav på webbhotellet

FTP eller FTPS (användarnamn, lösenord, värdnamn) — **inte** SFTP, det stödjer
inte den GitHub Action som används här. Inleed visar de här uppgifterna under
"FTP-konton" i kontrollpanelen.

## Engångsinställning

1. **Convex-sidan klar först:** kör `npx convex deploy` lokalt minst en gång så
   du har en riktig produktions-URL (`https://ditt-projekt.convex.cloud`), och
   sätt serverns miljövariabler (`RESEND_API_KEY` m.fl.) med `npx convex env set`.
2. Öppna repot på github.com → **Settings** → **Secrets and variables** → **Actions**.
3. Under fliken **Secrets**, lägg in fem hemligheter:

   | Namn | Värde |
   | --- | --- |
   | `VITE_CONVEX_URL` | Din Convex-produktions-URL från steg 1 |
   | `FTP_SERVER` | Värdnamnet till FTP-servern, t.ex. `ftp.din-domän.se` |
   | `FTP_USERNAME` | FTP-användarnamnet |
   | `FTP_PASSWORD` | FTP-lösenordet |
   | `FTP_SERVER_DIR` | Målmappen på servern, **måste sluta med `/`** — t.ex. `public_html/` |

4. Stödjer webbhotellet inte FTPS (bara vanlig FTP)? Under fliken **Variables**,
   lägg till `FTP_PROTOCOL` med värdet `ftp`. Annars används `ftps`
   (krypterat) som standard.
5. Just nu är `push`-triggern avstängd i `.github/workflows/deploy.yml` (en
   kommenterad rad). Kör manuellt under tiden: **Actions**-fliken → välj
   workflowen → **Run workflow**. När secrets är på plats, avkommentera
   `push: branches: [main]` så byggs och laddas det upp automatiskt vid varje push.

## Felsökning

| Symptom | Trolig orsak |
| --- | --- |
| Workflowen misslyckas på FTP-steget | Fel värde i någon av hemligheterna, eller fel protokoll (`ftp`/`ftps`) |
| "530 Login incorrect" | Fel användarnamn/lösenord, eller kontot kräver SFTP i stället |
| Sidan laddas men pratar inte med backend | `VITE_CONVEX_URL` saknas/fel i GitHub-secrets — bygget bakar in den vid kompileringstillfället, den går inte att ändra efteråt utan en ny build |
| Direktlänk till en undersida ger tom sida | `.htaccess` kom inte med, eller `mod_rewrite` är avstängt hos värden |
