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

**Live:** [raddarogleskogen.nu](https://raddarogleskogen.nu), på Vercel (projekt
`raddarogleskogen-convex`) + Convex produktion (`joyous-robin-892`). Allt
innehåll och alla konton migrerade från den levande Appwrite-installationen.

Se [MIGRATION_PLAN.md](MIGRATION_PLAN.md) för fullständig analys och fasordning
— samtliga tre faser (kodskrivning, kontoinloggning/verifiering,
datamigrering) är klara, både i dev- och produktionsdeploymenten.

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

## Installation i produktion (Vercel + Convex)

Inget Inleed-webbhotell inblandat — Inleed är bara domänregistrar/DNS här
(`ns1–6.inleed.net`). Frontend byggs och deployas automatiskt av Vercel vid
push till `main` (kopplat direkt mot `GLLB-Apps/NCC-Draft-Convex`), backend är
ett eget Convex-produktionsprojekt. Se [DEPLOY.md](DEPLOY.md) för detaljer och
felsökning.

Kort version:
1. `npx convex deploy` — pushar `convex/`-koden till produktion. Körs separat
   från frontend-deployen (Vercel rör aldrig Convex-koden).
2. `npx @convex-dev/auth --prod --web-server-url https://raddarogleskogen.nu`
   + `npx convex env set ... --prod` för `RESEND_API_KEY`/`MAIL_FROM_ADDRESS`
   — engångsinställning, redan gjord.
3. `VITE_CONVEX_URL` är satt som miljövariabel i Vercel-projektet, inte i en
   `.env`-fil i repot.
4. `git push origin main` → Vercel bygger och deployar `dist/` automatiskt.
