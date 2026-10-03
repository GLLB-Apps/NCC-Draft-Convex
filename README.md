# Rögleskogen — Convex-version (React-build + Convex)

Fork av det Appwrite-baserade projektet, byggd mot [Convex](https://convex.dev) som
backend: en reaktiv databas, inbyggd autentisering och filstorage i ett, utan egen
server att driva.

Originalprojektet (`NCC-Draft-RS`, Appwrite) och den PHP-baserade varianten
(`NCC-Draft-PHP`) lämnas orörda — detta är en tredje, separat mapp.

## Stack

| Del | Teknik |
| --- | --- |
| Publik sida + admin + intranät | React 19 + TypeScript, byggt med Vite (statisk build) |
| Backend | Convex (databas, funktioner, filstorage, auth) — allt i ett moln-projekt |
| Autentisering | Convex Auth (`@convex-dev/auth`), e-post/lösenord |
| Uppladdningar | Convex Storage |
| E-post | Resend (via Convex actions) — **obligatoriskt**, Convex har ingen inbyggd mail()-motsvarighet |

## Struktur

```
├── src/            React-källkod, kopierad från NCC-Draft-RS (components/, pages/, lib/)
│                   + src/lib/convexClient.ts, convexCompat.ts (de enda nya API-filerna)
├── dist/           Byggd React-app
├── convex/         Convex-funktioner: schema.ts, auth.ts, + en fil per tabell
└── MIGRATION_PLAN.md   Fullständig analys, mappning från Appwrite/PHP och status
```

## Status

Se [MIGRATION_PLAN.md](MIGRATION_PLAN.md) för fullständig analys och fasordning.

**Fas 0 (skriven kod, inget Convex-konto krävs) är klar:** schema, samtliga
`convex/*.ts`-funktioner, den omskrivna kompat-shimmen (`src/lib/supabase.ts`),
`storage.ts`, `auth.tsx` (native Convex Auth-hooks), `notifications.tsx` (native
`useQuery`, ersätter 10 separata hämtningar + manuell refresh med en reaktiv
query), samt de sex filer som pratade direkt med Vercel-funktioner
(`AdminAdmins.tsx`, `ChangelogImport.tsx`, `AdminSettings.tsx`, `ContactPage.tsx`,
`TestimoniesPage.tsx`, `FaqPage.tsx`) skrivna om mot Convex-motsvarigheterna.

**Fas 1 (kräver inloggning) är INTE påbörjad** — ingen `npx convex dev` har körts
än, så koden är overifierad mot ett riktigt Convex-projekt. Se MIGRATION_PLAN.md
§6/§7 för de konkreta punkter som flaggats som osäkra tills den körningen skett
(framför allt: hur en superadmin sätter en annan användares lösenord, och
Convex Auths exakta schema för sessionstabellen).

## Utveckling

Kräver ett Convex-konto (skapas på [convex.dev](https://convex.dev), gärna med
`raddarogleskogen@gmail.com`):

```bash
npm install
npx convex dev      # loggar in, skapar/kopplar ett projekt, genererar convex/_generated/
                     # och skriver VITE_CONVEX_URL till .env.local automatiskt

npm run dev          # React-appen (Vite)
```

Första gången: skapa en superadmin via Convex-dashboardens datavy (eller ett
`npx convex run`-anrop till en egen engångsmutation) — self-signup ger
medvetet ingen åtkomst, se `convex/auth.ts`.

## Installation i produktion (Inleed, samma domän som idag)

Ingen Vercel inblandad — frontend laddas upp som rena statiska filer till det
befintliga Inleed-kontot, precis som webbhotellsvarianten, bara utan PHP/
SQLite/uploads-delen (allt det är Convex nu). Se [DEPLOY.md](DEPLOY.md) för
GitHub Actions-varianten (push → bygg → FTP), annars manuellt:

1. `npx convex deploy` — skapar/uppdaterar produktionsdeploymenten, ger en
   produktions-URL för `VITE_CONVEX_URL`.
2. Sätt serversidans miljövariabler (`RESEND_API_KEY` m.fl., se `.env.example`)
   via `npx convex env set` eller dashboarden — **inte** i en `.env`-fil.
3. `npm run build` med `VITE_CONVEX_URL` satt till produktions-URL:en → `dist/`.
4. Ladda upp `dist/*` + `.htaccess` till `public_html/` på Inleed. Inget annat
   behövs — ingen `server/`, ingen databas, inga rättigheter att sätta.
