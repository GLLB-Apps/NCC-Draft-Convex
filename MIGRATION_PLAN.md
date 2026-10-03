# Migrationsplan — Rögleskogen: React + Appwrite → React-build + Convex

Fork av `NCC-Draft-RS`. Målet är att pröva Convex (reaktiv databas + inbyggd
auth + filstorage i ett moln-projekt) som tredje alternativ vid sidan av
Appwrite-originalet och den PHP-baserade varianten (`NCC-Draft-PHP`), inte att
ersätta något av dem.

---

## 1. Varför Convex, och vad det ändrar

Convex eliminerar hela PHP-spårets SQL+JSON-fil-uppdelning (en enda reaktiv
databas för allt), har inbyggd filstorage och inbyggd auth — men funktionerna
exponeras som **statiskt namngivna funktioner** (`api.posts.list`), inte en
generisk `/data/{table}`-rutt som PHP:s `DataController`. Det påverkar hur
kompat-lagret är byggt (se §4).

Convex har heller ingen lokal-utan-konto-variant: `npx convex dev` kopplar
alltid upp mot ett riktigt molnprojekt. Kontot skapas av användaren själv på
`raddarogleskogen@gmail.com` när det är tid att köra — allt som går att skriva
utan ett levande projekt är skrivet i Fas 0 nedan.

## 2. Datamodell och behörigheter

27 innehållstabeller, mappade 1:1 från Appwrites kollektioner (se `convex/schema.ts`).
Behörighetsklass per tabell är ärvd rakt av från PHP-spårets redan korrekta
matris (`d:\Programmering\NCC-Draft-PHP\server\api\data.php`: `TABLES`/
`ADMIN_ONLY_READ`/`MEMBER_TABLES`/`PUBLIC_CREATE`), inte återhärledd från
Appwrite:

| Grupp | Tabeller | Läsning | Skrivning |
|---|---|---|---|
| Alltid publik | siteSettings, pages, navigationItems, faqCategories, contacts, customIcons, changelogEntries, sponsors | Publik, ingen grind | admin |
| Status-grindad (`published`) | topics, posts, documents, mediaItems, timelineEvents, customPages, mapLocations, mapAreas | Publik bara när `published` | admin |
| Status-grindad + publik skapelse | faqItems (`published`), testimonies (`approved`) | Publik bara när publicerad/godkänd | admin skriver, vem som helst kan skapa (status tvingas server-side) |
| Admin-läsning enbart + publik skapelse | testimonyContacts, contactMessages | Admin bara | admin skriver, vem som helst kan skapa |
| Intranät | intranetNotices, intranetNotes, intranetTasks, internalDocCategories, internalDocuments | Intranätmedlem | intranät-skrivbehörig |
| Admin-läsning enbart, systemskrivning | auditLog | Admin bara | aldrig klient-skrivbar |

`user_roles`/`intranet_members`/`profiles` är INTE egna Convex-tabeller — de
är fält direkt på Convex Auths `users`-dokument (samma knep som PHP:s
`UserCollections.php`, bara utan SQL-vynivån). Detta förenklade
`AdminAdmins.tsx` avsevärt: tre tabeller + ett separat e-postanrop
(`/api/list-users`) blev EN query (`users.ts: listAll`).

`ContentBlock`/`layout_columns` lagras som `v.any()` — Appwrite validerade
heller aldrig detta server-side, så det är paritet, inte en regression.

**Konkret förbättring utöver paritet:** `testimonies.submit` skriver
vittnesmålet + kontaktuppgifterna atomiskt i EN transaktion. Både Appwrite-
och PHP-versionerna gjorde två sekventiella inserts, med en risk för en
vittnesmål-post utan kontaktpost om det andra anropet misslyckades.

## 3. Autentisering

Convex Auth (`@convex-dev/auth`) med `Password`-providern. Självregistrering
ger ingen `role`/`intranet_member` — matchar originalets "kontot väntar på en
superadmins godkännande".

**Beteendeskillnad värd att känna till:** Appwrites `account.create()` loggar
INTE in kontot automatiskt; Convex Auths Password-provider gör det
sannolikt direkt. Påverkar inte behörigheten (role/intranet_member är
fortfarande osatta oavsett), bara ett ögonblicks UX efter självregistrering.
Verifieras i Fas 1.

Lösenordsåterställning använder INTE Convex Auths inbyggda flöde —
`AdminResetPassword.tsx` förväntar sig en token-i-länk-form, så
`convex/passwordReset.ts` porterar PHP:s exakta design: SHA-256-hash av
token, 30 min TTL, max 3 förfrågningar/15 min, loggar ut alla sessioner vid
lyckad återställning. URL-formen ändrades därför från Appwrites
`?userId=...&secret=...` till `?token=...` — `AdminResetPassword.tsx` är
justerad därefter.

Rate limiting på inloggningsförsök (PHP: 5/15 min per e-post) saknas —
accepterad lucka för en liten lågtrafik-sajt, se §8.

## 4. Kompat-shim vs. native hooks

`src/lib/supabase.ts` behåller sin exakta `.from().select().eq()...`-yta för
alla ~30 sidor, med `run()` omskriven mot Convex's **imperativa** klient
(`ConvexReactClient.query()/mutation()/action()`, inte React-hooken
`useQuery`, eftersom anropsplatserna gör `await supabase.from(...)` utanför
komponent-render). Tabellnamn → genererad Convex-funktion slås upp manuellt i
`src/lib/convexCompat.ts` (det enda stället som måste hårdkodas, eftersom
Convex-funktioner är statiskt namngivna).

Native Convex-hooks på bara två ställen:
- **`notifications.tsx`** — 10 separata `supabase.from(...)`-anrop + manuell
  `tick`/`refresh()` blev EN aggregerande query (`convex/notifications.ts:
  listForCurrentUser`) konsumerad via `useQuery` — riktig push-reaktivitet
  istället för manuell refresh.
- **`auth.tsx`** — byggd mot `useConvexAuth()`/`useAuthActions()`/
  `useQuery(api.users.me)`. `useAuth()`-kontraktet är byte-för-byte identiskt,
  så `AdminGuard.tsx` och alla andra konsumenter är oförändrade.

**`intranetNotifications.tsx` rördes INTE** (samma mönster som
`notifications.tsx`, men går kvar via den generiska shimmen) — en medveten
avgränsning, inte en miss: bara två filer fick den dyrare native-hook-
behandlingen, resten följer lågrisk-principen.

### Sex filer skrivna om helt (pratade direkt med Vercel-funktioner, eller fick ny logik)

- `AdminAdmins.tsx` — mot `convex/users.ts` direkt (`listAll`/`setAccess`/
  `deleteUser`/`setPassword`/`sendPassword`). Väsentligt FÖRENKLAD jämfört med
  originalet: ingen join av tre tabeller, inget separat e-postanrop.
- `ChangelogImport.tsx` — `translate()` mot `convex/changelog.ts: translateTitles`.
- `AdminSettings.tsx` — `syncSignatures()` mot `convex/signatures.ts: sync`.
- `ContactPage.tsx` — `handleSubmit()` mot `convex/contact.ts: submit`, ingen
  404-fallback-logik kvar (en action är alltid nåbar, till skillnad från en
  Vercel-funktion som kan saknas lokalt).
- `TestimoniesPage.tsx` — `handleSubmit()` mot `testimonies.submit` (atomisk,
  se §2).
- `FaqPage.tsx` — **nytt jämfört med PHP-spårets motsvarande lista** —
  `handleAsk()` mot `faqItems.submitQuestion`, av samma skäl som testimonies
  (en dedikerad publik mutation istället för dual-caller-grenar i den
  generiska `create`).

## 5. Filuppladdning

`generateUploadUrl` (mutation) → klienten POSTar direkt till den URL:en →
`finalize` (mutation) validerar MIME/storlek mot den lagrade metadatan EFTERÅT
(Convex kan inte granska innehållet innan det tagits emot) och returnerar en
färdig URL-sträng, sparad direkt på dokumentets `image_url`/`file_url`-fält —
samma mönster som Appwrites `storage.getFileView()`.

**Overifierat (Fas 1):** om `ctx.storage.getUrl()` ger en stabil URL eller en
utgående/signerad en — avgör om "spara URL-strängen direkt"-strategin håller,
eller om en "spara storageId, slå upp URL vid läsning"-strategi behövs istället.

## 6. Serverfunktioner (Vercel-motsvarigheter)

Samtliga som Convex actions med rå `fetch` (inget `"use node"` behövs):
`passwordReset.ts`, `contact.ts`, `signatures.ts` (manuellt triggad, **ingen
cron**, medvetet bevarat), `changelog.ts`, `users.ts` (`setPassword`/
`sendPassword`).

**Uppdaterat efter första riktiga `npx convex dev`-körningen:** den riktiga
`tsc`-körningen (inte bara mot `@convex-dev/auth`s egna typer, utan mot det
faktiska genererade projektschemat) hittade ett konkret, verkligt fel direkt:
`modifyAccountCredentials` kräver en `ActionCtx`, inte en `MutationCtx` — så
`setPassword` var fel deklarerad som `mutation`. Fixat genom att dela upp i:
`setPasswordCredential` (en ogrindad `internalAction` som faktiskt skriver
credentialen) + `setPassword` (publik `action`, superadmin-kontroll, anropar
den interna). Det avslöjade i sin tur en verklig auktoriseringsbugg som annars
hade nått produktion: `passwordReset.ts: reset` (den självbetjänade
"glömt lösenord"-återställningen, ingen inloggad användare alls) anropade
samma `setPassword` — vilket hade blockerat ALLA lösenordsåterställningar med
"Kräver superadmin". Fixat genom att låta `reset` anropa den ogrindade interna
funktionen direkt istället; giltig återställnings-token ÄR auktoriseringen
där, inte en roll.

Kvarstående, mindre overifierat: om `modifyAccountCredentials` är avsedd/
stödd för "sätt NÅGON ANNANS lösenord" specifikt (inte bara "byt ditt eget"),
och antagandet i `passwordReset.ts: consumeToken` om en `authSessions`-tabell
med fältet `userId`. Båda typchecker rent (`tsc -b` och `npm run build` är
gröna mot det riktiga schemat), men det slutgiltiga beteendetestet — att
verkligen köra flödet och bekräfta att lösenordet går att logga in med
efteråt — återstår.

E-post har INGEN gratis-fallback i Convex (till skillnad från PHP:s
`mail()`) — `RESEND_API_KEY` är obligatorisk för varje mejlutskick, se
`convex/lib/mail.ts` och `.env.example`.

## 7. Fasordning och status

| # | Fas | Status |
|---|---|---|
| 0 | Repo-scaffold, schema, samtliga convex/*.ts-funktioner, omskriven supabase.ts/storage.ts/auth.tsx/notifications.tsx, App.tsx-wiring, sex omskrivna sidor | ✅ Klar (den här leveransen) |
| 1 | `npx convex login`/`dev`, `convex/_generated/*` genereras, verifiera/fixa typfel, skapa första superadmin, end-to-end-test | ✅ Klar — inloggning fungerar (både dev och prod), verklig bugg hittad+fixad (`setPasswordCredential` behövde ActionCtx, se §6), e-postleverans verifierad (Resend-domänen var fel (.se i stället för .nu) och overifierad — båda lösta) |
| 2 | Datamigrering från den levande Appwrite-installationen (TS-port av PHP-spårets `import-appwrite-data.php`) | ✅ Klar — körd mot BÅDE dev och produktion. 70/70 filer, alla innehållstabeller, 8/8 konton (roller/intranätsåtkomst korrekt mappade, ägarkontot redan superadmin). 3 testimony_contacts-rader utan matchande testimony hoppades medvetet över (se nedan) |
| 3 | Produktionsdriftsättning: Convex-produktion + Vercel (inte Inleed-hosting — användaren har bara domänen där, inte webbhotell) | ✅ Klar — `raddarogleskogen.nu` + `www.` flyttade från det gamla `ncc-draft-rs`-projektet till `raddarogleskogen-convex`, live och verifierad (`curl` bekräftar rätt innehåll). Se DEPLOY.md |

### Vad den riktiga importkörningen hittade (utöver planens kända osäkerheter)

Fyra verkliga buggar, ingen förutsedd i planeringen, alla hittade genom att
faktiskt köra mot produktionsdatan (inte genom granskning):

1. **`$createdAt`/`$updatedAt` mappades aldrig** till `created_at`/`updated_at`
   — ett rent förbiseende vid porteringen av PHP:s `fromAppwriteDoc()`.
2. **Olika tabeller har olika uppsättning tidsstämpelfält** i schema.ts
   (`navigationItems`/`faqCategories`/`contacts`/`internalDocCategories` har
   inga alls, `customIcons` bara `created_at`) — en blind "lägg till båda"
   hade kraschat på dessa.
3. **Äldre Appwrite-rader saknar attribut som lades till i kollektionen
   senare** (t.ex. `mediaItems.marketing_ok` utan backfill) — löst med en
   generell `DEFAULTS`-tabell istället för att patcha fält för fält varje gång
   schemavalideringen klagade på nästa tabell.
4. **Den LIVE Appwrite-kollektionen har ibland fler fält än både
   `src/lib/types.ts` och `schema.ts` kände till** (`timelineEvents.updated_by`,
   aldrig dokumenterat) — löst med en `ALLOWED_FIELDS`-vitlista per tabell,
   eftersom Convex (till skillnad från Appwrite) avvisar okända fält hårt.

Ett femte, strukturellt problem som INTE var ett fel utan en konsekvens av
själva migreringen: **alla korsreferenser mellan tabeller pekade på Appwrites
gamla `$id`**, men Convex ger varje importerad rad ett nytt, eget `_id` —
`testimony_contacts.testimony_id`, `faqItems.category_id`,
`internalDocuments.category_id`, `timelineEvents.related_document_id` och
`navigationItems.parent_id` (självrefererande) hade annars tyst pekat på
ingenting. Löst med `idMaps`/`CROSS_REF` (enda-passage för de förra) och en
andra-passage-patchning för den självrefererande menyhierarkin.

## 8. Uttryckligen uppskjutet

- Inloggnings-rate-limiting — accepterad lucka, liten lågtrafik-sajt. Framtida
  uppgradering: Convex's `@convex-dev/rate-limiter`-komponent.
- Bredare realtid utöver notifications.tsx/auth.tsx (t.ex. liveuppdaterande
  adminlistor) — naturlig framtida utbyggnad.
- GeoJSON-export för kartdata — samma uppskjutning som PHP-spåret.
- Uppstädning av redan-utfasade fält (`Testimony.email`/`internal_note`,
  `SiteSettings.next_important_date`) — `testimonies`-schemat utelämnar redan
  de två förstnämnda (Convex har inga gamla rader att vara bakåtkompatibel
  med), övrigt behålls för paritet tills vidare.
- Audit log: implementerat redan NU (inte uppskjutet) — billigt via den delade
  `convex/lib/collection.ts`-hjälparen, till skillnad från PHP-versionen där
  det fortfarande var en öppen post.
