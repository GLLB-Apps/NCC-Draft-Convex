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

## Byggkommandot (viktigt — varför det inte är bara `npm run build`)

`vercel.json`s `buildCommand` är `npx convex deploy --cmd 'npm run build'`,
inte bara `npm run build`. Det beror på att `convex/_generated/` (de typer
`src/`-koden importerar från, t.ex. `../../convex/_generated/api`) är
medvetet gitignorad — det är genererad kod, inte något att committa. Utan
`npx convex deploy` först finns den katalogen helt enkelt inte i Vercels
build-miljö, och `tsc -b` floppar direkt på "Cannot find module".
`npx convex deploy`:
1. Genererar `convex/_generated/` (löser importfelet).
2. Pushar `convex/`-koden till produktion — samma körning deployar alltså
   BÅDE backend och frontend, inte bara frontend.
3. Kräver `CONVEX_DEPLOY_KEY` som miljövariabel i Vercel (satt, Secret-typ,
   genererad via `npx convex deployment token create <namn> --prod`).

Det betyder: `git push origin main` räcker för EN helt komplett
driftsättning av både `convex/`-kod och `src/`-kod i samma körning — inget
separat `npx convex deploy`-steg behövs längre.

## Felsökning

| Symptom | Trolig orsak |
| --- | --- |
| Build floppar på "Cannot find module '.../convex/_generated/...'" | `CONVEX_DEPLOY_KEY` saknas/ogiltig i Vercel, eller `buildCommand` har av misstag bytts till bara `npm run build` |
| Sidan laddas men pratar inte med backend | `VITE_CONVEX_URL` i Vercel pekar på fel/gammal Convex-deployment |
| Domänen visar den gamla Appwrite-sajten | DNS-cache — vänta ut TTL, eller kontrollera att domänen verkligen flyttats till rätt Vercel-projekt (`vercel domains inspect raddarogleskogen.nu`) |
| Vercel visar "Build failed" men ingen förklaring i mejlet | `vercel inspect <deployment-url> --logs` visar hela byggloggen |
