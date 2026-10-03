# Driftsättning (Vercel + Convex)

Ingen Inleed-hosting, ingen FTP — bara domänen är registrerad hos Inleed
(DNS). Frontend är helt statisk (ingen PHP, ingen `/api`-rutt) och deployas
av Vercel direkt från GitHub-repot vid varje push till `main`. Backenden är
Convex, ett helt separat moln-projekt som inte bor på Vercel alls.

## Engångsinställning

1. **Vercel-projektet** är redan skapat (`raddarogleskogen-convex` under
   `dawwe98dg-gmailcoms-projects`), kopplat till
   `GLLB-Apps/NCC-Draft-Convex`. Push till `main` bygger och deployar
   automatiskt — inget mer att göra där.
2. **`VITE_CONVEX_URL`** är satt som miljövariabel i Vercel-projektet,
   pekar på produktions-Convex (`https://joyous-robin-892.convex.cloud`).
   Byts den URL:en (t.ex. ett nytt Convex-projekt) måste den uppdateras i
   Vercels projektinställningar → Environment Variables, följt av en ny
   deploy.
3. **Domänen** `raddarogleskogen.nu` (+ `www.`) är flyttad från det gamla
   `ncc-draft-rs`-projektet till det här. DNS ligger kvar hos Inleed
   (nameservers `ns1–6.inleed.net`) — det är bara själva Vercel-kopplingen
   (en A-post/CNAME i Inleeds DNS-zon) som pekar om, inga nameserver-byten.

## Serversidans miljövariabler (Convex, INTE Vercel)

Sätts med `npx convex env set NAMN värde --prod`, aldrig i Vercel:
`JWT_PRIVATE_KEY`/`JWKS`/`SITE_URL` (satta av `npx @convex-dev/auth --prod`),
`RESEND_API_KEY`, `MAIL_FROM_ADDRESS`. Valfria: `PETITION_URL`,
`ANTHROPIC_API_KEY`.

## Vanlig arbetsgång efter detta

```bash
git push origin main      # Vercel bygger och deployar automatiskt
npx convex deploy          # om convex/-koden ändrats, pusha den separat
```

De två är helt oberoende — en kodändring i `src/` kräver bara `git push`,
en ändring i `convex/` kräver `npx convex deploy` (annars kör produktionen
kvar på den gamla backend-koden även om frontend-bygget är nytt).

## Felsökning

| Symptom | Trolig orsak |
| --- | --- |
| Sidan laddas men pratar inte med backend | `VITE_CONVEX_URL` i Vercel pekar på fel/gammal Convex-deployment |
| Ändringar i `convex/*.ts` syns inte | Glömt `npx convex deploy` — Vercel bygger bara frontend, aldrig Convex-koden |
| Domänen visar den gamla Appwrite-sajten | DNS-cache — vänta ut TTL, eller kontrollera att domänen verkligen flyttats till rätt Vercel-projekt (`vercel domains inspect raddarogleskogen.nu`) |
