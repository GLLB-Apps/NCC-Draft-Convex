# Rögleskogen

Webbplats och redaktionsverktyg för initiativet kring den planerade bergtäkten
mellan Södra Sandby och Dalby. Sidan samlar bakgrund, dokument, nyheter,
vittnesmål och kartmaterial om hur området och närboende kan påverkas.

Allt innehåll redigeras i en inbyggd adminpanel — inget behöver ändras i koden
för att publicera.

---

## Innehåll

- [Så hänger det ihop](#så-hänger-det-ihop)
- [Publika sidan](#publika-sidan)
- [Adminpanelen](#adminpanelen)
- [Datamodell](#datamodell)
- [Komma igång](#komma-igång)
- [Skript](#skript)
- [Driftsättning](#driftsättning)

---

## Så hänger det ihop

| Del | Teknik |
| --- | --- |
| Frontend | React 19 + TypeScript, byggt med Vite |
| Routing | React Router |
| Kartor | Leaflet med OpenStreetMap som underlag |
| Ikoner | Lucide |
| Backend | Appwrite Cloud (databas, inloggning, fillagring) |
| Hosting | Vercel |

Det finns ingen egen server. Webbläsaren pratar direkt med Appwrite, och
behörigheter styrs av Appwrites egna regler per kollektion. Två serverlösa
funktioner under `api/` sköter det som kräver en hemlig nyckel: byte av
lösenord åt andra användare och synk av namninsamlingens räknare.

### En detalj värd att känna till

`src/lib/supabase.ts` heter så av historiska skäl. Projektet migrerade från
Supabase till Appwrite, och filen är ett tunt kompatibilitetslager som
efterliknar Supabase-klientens API (`supabase.from('x').select().eq(...)`) mot
Appwrite. Det finns alltså ingen Supabase i drift — men namnet gjorde att
resten av kodbasen slapp skrivas om.

Lagret hanterar också fält som lagras som JSON-strängar i Appwrite men används
som objekt i appen (`JSON_FIELDS` överst i filen).

---

## Publika sidan

| Route | Sida |
| --- | --- |
| `/` | Start med hero, nyheter och namninsamling |
| `/bakgrund` | Bakgrund om täktplanerna |
| `/amnen`, `/amnen/:slug` | Ämnesområden — buller, vatten, natur, trafik m.m. |
| `/nyheter`, `/nyheter/:slug` | Nyheter och uppdateringar |
| `/vittnesmal` | Berättelser från närboende, med inskickningsformulär |
| `/karta` | Karta över området (se nedan) |
| `/tidslinje` | Händelser i ärendets gång |
| `/dokument` | Handlingar från NCC, kommun och myndigheter |
| `/media` | Bild- och videoarkiv |
| `/press` | Pressmaterial |
| `/fragor-och-svar` | Vanliga frågor |
| `/kontakt` | Kontaktuppgifter och kontaktformulär |

### Headern

Logotypbrickan hänger ned över heron högst upp på en sida och fälls ihop när man
rullar. Både höjden och bredden den lämnar efter sig är konstant — brickan växer
utanför sin plats i stället för att knuffa menyn — så ingenting i sidan flyttar
sig när läget växlar. Talen står som kommentarer vid `.site-logo-slot` och
`.site-logo-badge` i `public.css` och måste räknas om om logotypen byts mot en
med annat höjd/bredd-förhållande.

Menyn är redigerbar och kan bli lång. Under 1500 px döljs menyikonerna och
posterna dras ihop; under 1200 px tar mobilmenyn över. Utan det sköt menyn ut
genom fönsterkanten och gav en horisontell rullningslist.

### Kartan

Kartan har två flikar.

**Området** visar verksamhets- och brytområden som polygoner, plus enskilda
kartpunkter som naturvärden, transportvägar och avstånd till närmaste bostad.
Varje område och punkttyp är ett eget lager som går att tända och släcka.
Kartan zoomar automatiskt så att alla områden syns.

**Vittnesmål** visar berättelser utplacerade på kartan. Här hamnar både
inskickade vittnesmål — droppformade markörer — och kartpunkter av typen
Vittnesmålspunkt som redaktionen lagt in, som ritas som cirklar. Båda flikarna
använder samma utsnitt så att man ser samma plats när man växlar.

---

## Adminpanelen

Nås på `/admin` och kräver inloggning. Byggd för desktop; på mobil visas en
uppmaning att byta enhet.

### Roller

| Roll | Behörighet |
| --- | --- |
| Superadmin | Allt, inklusive inställningar och användarhantering |
| Redaktör | Allt innehåll och all kommunikation |
| Skribent | Nyheter, ämnen, dokument och media |

Rollen ligger i kollektionen `user_roles`. Skrivbehörighet i databasen styrs
dessutom av att kontot har etiketten `admin` i Appwrite — båda behövs.

Den som registrerar sig får presentera sig i formuläret — vem de är och hur de
hänger ihop med initiativet. Texten sparas på profilen och visas under
**Användare**, både för dem som väntar på behörighet och för dem som redan har
en, så att den som tilldelar nivå vet vem personen är.

### Översikt och utkast

Startsidan visar nyckeltal och de senaste redigeringarna. Korten för
vittnesmål, meddelanden och utkast är klickbara och visar en badge när något
tillkommit sedan sist.

**Utkast** samlar allt opublicerat innehåll från alla innehållstyper på ett
ställe, med filtren "Alla utkast" och "Mina utkast", sortering, och möjlighet
att publicera eller ta bort direkt. Registret ligger i `src/lib/drafts.ts` —
en ny innehållstyp behöver bara en rad där för att komma med.

### Notiser

Klockan i topbaren samlar vad som kommit in: meddelanden från
kontaktformuläret, nya vittnesmål och nya utkast. Samma siffror visas som
badges i vänstermenyn och på översiktskorten.

Läsläget sparas per person och per kategori på användarens profil, så att
öppna en sektion nollställer bara den. Markeringen sker när sidan visats en
kort stund, inte vid klicket — en felklick döljer alltså inte att något var
nytt. "Rensa lästa" gömmer det man redan sett utan att röra olästa poster.

### Innehåll

| Sektion | Vad man gör |
| --- | --- |
| Sidor | Redigerar rubriker, ingresser och fria innehållsblock på de publika sidorna |
| Nyheter | Skriver och publicerar nyheter |
| Ämnesområden | Fördjupningar per sakfråga, med mallar för vanliga ämnen |
| Dokument | Laddar upp handlingar och märker avsändare |
| Media | Bild- och videoarkiv med rättighetsinformation |
| Karta | Två flikar: **Polygoner** för områdesgränser, **Punkter** för enskilda platser |
| Tidslinje | Händelser i ärendet |
| FAQ | Frågor och svar, grupperade i kategorier |
| Ändringslogg | Datumsorterad historik över vad som byggts, ändrats och rättats i systemet |

Sidorna konfigureras i `src/lib/pages.ts`, som kopplar varje publik route till
sina redigerbara texter och genvägar. Startsidans texter — statusrutan, de tre
blocken under sammanfattningen och uppmaningarna — ligger under Sidor →
Startsida, och den flytande "Redigera sidan"-knappen på webbplatsen leder dit.

**Viktiga datum** är en lista i webbplatsinställningarna i stället för ett enda
fält. Startsidan visar det närmast kommande och går vidare till nästa av sig
själv när dagen passerat — passerade datum ligger kvar i listan men visas inte.

**Ändringsloggen** sorteras på det datum man anger, inte på när posten skrevs,
så historiken går att fylla på i efterhand. Den läses bara av admin-labeln och
syns aldrig publikt.

Knappen **Hämta från GitHub** listar de commits på `main` som inte redan
importerats. Bara rubriken följer med — commit-texten, versioner och typ
lämnas därhän — och rubrikerna översätts till svenska på vägen, eftersom
commits skrivs på engelska för utvecklare men loggen läses av redaktionen.
Man bockar för vad som ska med och kan skriva om texten innan den sparas.
Commitens sha sparas på posten, så samma commit inte kan importeras två gånger.

Hämtningen sker direkt från webbläsaren mot GitHubs API — repot är publikt, så
varken token eller serverfunktion behövs för den delen. Utan token är taket 60
anrop per timme och IP, vilket räcker för en knapp som gör ett anrop per import.
Blir repot privat igen slutar hämtningen att fungera och måste flyttas
server-side.

Översättningen går däremot via `api/translate-commits`, som anropar Claude med
`ANTHROPIC_API_KEY`. Hela listan översätts i ett anrop. Anroparen måste ha
admin-labeln — annars vore det en öppen endpoint som kostar pengar per anrop,
och repots adress är numera publik. Saknas nyckeln, eller körs appen lokalt där
`api/`-funktionerna inte finns, visas originalrubrikerna på engelska i stället
och man får skriva om dem för hand. Inget blockeras.

### Ikoner

Ikonerna är Lucide-namn i kebab-case. `src/lib/lucide.tsx` håller en kurerad
uppsättning för väljaren, men hela biblioteket går att rendera. I ikonväljaren
kan man därför skriva ett ikonnamn rakt av eller klistra in en adress från
lucide.dev — och spara träffen i **egna ikoner** (kollektionen `custom_icons`),
som då ligger överst i väljaren nästa gång. Bara namnet lagras; ritningen kommer
som vanligt från `lucide-react`.

### Kartredigeraren

Områdesgränser ritas på två sätt: genom att klistra in koordinater som
`latitud, longitud` — formatet man får när man kopierar en punkt i Google Maps
— eller genom att klicka ut hörn direkt på kartan. Hörn går att dra för att
flytta och klicka för att ta bort, med ångra i femtio steg. Rader som inte kan
tolkas pekas ut med radnummer, och en latitud utanför giltigt intervall ger en
varning om att lat och long kan vara omkastade.

Färg, linjestil och fyllning ställs in per område, så att två områden med
liknande färg går att skilja åt.

### Kommunikation

Vittnesmål granskas innan publicering. Godkänner man ett vittnesmål vars
avsändare tillåtit marknadsföring läggs bilden automatiskt till i mediearkivet
som utkast. Avslagna vittnesmål går att ta bort permanent; väntande och
godkända hanteras via status i stället.

Här finns också meddelanden från kontaktformuläret, kontaktpersoner och
sponsorer.

---

## Datamodell

Kollektioner i Appwrite:

| Kollektion | Innehåll |
| --- | --- |
| `site_settings` | Webbplatsens namn, hero, namninsamling, sociala länkar |
| `pages` | Redigerbara texter och innehållsblock per sida |
| `navigation_items` | Menystruktur |
| `posts` | Nyheter |
| `topics` | Ämnesområden |
| `documents` | Handlingar |
| `media_items` | Bilder och video |
| `map_areas` | Områdespolygoner med färg, linjestil och fyllning |
| `map_locations` | Enskilda kartpunkter |
| `timeline_events` | Tidslinjen |
| `faq_categories`, `faq_items` | Frågor och svar |
| `testimonies` | Vittnesmål (det som visas publikt) |
| `testimony_contacts` | Vittnesmålens e-post, riktiga namn och interna anteckningar — admin only |
| `contact_messages` | Kontaktformuläret |
| `contacts` | Kontaktpersoner |
| `user_roles`, `profiles` | Roller och användarprofiler (inkl. presentationen från registreringen) |
| `changelog_entries` | Systemets ändringslogg — bara läsbar för admin |
| `custom_icons` | Sparade Lucide-ikoner utanför den kurerade uppsättningen |
| `audit_log` | Loggade ändringar |

Innehåll har genomgående en `status`: `draft`, `published` och `archived`,
och för nyheter och ämnen dessutom `review`. Publika sidor hämtar bara
`published`. Utkastsidan räknar `draft` och `review` som opublicerat.

### Behörigheter på innehåll

Statusfiltret i klienten är ingen säkerhetsgräns — det avgör bara vad sidan
*visar*. Gränsen sitter i behörigheterna, och den ligger på **dokumentet**, inte
på kollektionen: innehållskollektionerna har `documentSecurity` påslaget och
släpper bara in admin-labeln för läsning, medan varje publicerat dokument bär
sin egen `read("any")`.

`permissionsFor()` i `src/lib/supabase.ts` sätter den rätten vid varje skrivning
som nämner `status`, och tar aktivt bort den vid avpublicering. Skrivningar utan
`status` lämnar rättigheterna orörda, så att ändra en rubrik inte kan publicera
något av misstag. Listan över kollektioner och deras publika tillstånd måste
hållas i synk med `PUBLIC_WHEN` i `scripts/appwrite-lock-drafts.mjs`.

`profiles` är stängd för gäster (`read("users")`) eftersom presentationstexten
är personlig. `create("any")` är kvar där och på `testimonies`, så registrering
och det publika vittnesmålsformuläret fungerar utan inloggning.

Appwrite har ingen behörighet per fält, och ett godkänt vittnesmål är läsbart
i sin helhet. Därför ligger inskickarens e-post, riktiga namn och redaktionens
interna anteckning i **`testimony_contacts`** i stället — en kollektion som
utloggade besökare får skapa i (formuläret skickas utan inloggning) men bara
admin läsa. Det publika dokumentet bär namnet enbart när vittnesmålet *inte* är
anonymt.

Granskningsvyn slår ihop de två och visar det uppgivna namnet separat märkt när
vittnesmålet publiceras anonymt, så redaktionen ser vem som skrivit utan att
uppgiften ligger öppet. Äldre rader läses fortfarande ur de gamla fälten på
`testimonies`, som reserv.

---

## Komma igång

Kräver Node 20.19 eller senare (eller 22.12+), enligt Vites krav.

```bash
npm install
npm run dev
```

Skapa `.env.local` i projektroten:

```
VITE_APPWRITE_ENDPOINT=https://fra.cloud.appwrite.io/v1
VITE_APPWRITE_PROJECT_ID=...
VITE_APPWRITE_DATABASE_ID=...
VITE_APPWRITE_BUCKET_ID=...

# Bara för skripten nedan — används aldrig av frontend
APPWRITE_API_KEY=...
APPWRITE_SUPERUSER_EMAIL=...
APPWRITE_SUPERUSER_PASSWORD=...
APPWRITE_SUPERUSER_NAME=...
```

Filen är gitignorerad via `*.local` och ska aldrig committas. `VITE_`-prefixet
betyder att värdet bakas in i klientbygget och är publikt — lägg därför aldrig
API-nyckeln bakom det prefixet.

Kommandon:

```bash
npm run dev       # utvecklingsserver
npm run build     # typkontroll + produktionsbygge
npm run lint      # oxlint
npm run preview   # förhandsgranska bygget
```

---

## Skript

Under `scripts/` finns engångsskript som körs lokalt mot Appwrite. De läser
`.env.local` och kräver `APPWRITE_API_KEY`.

```bash
node scripts/appwrite-setup.mjs             # skapar databas, kollektioner och superanvändare
node scripts/appwrite-add-map-areas.mjs     # kollektionen för områdespolygoner
node scripts/appwrite-add-notifications.mjs # notisfälten på profiler
node scripts/appwrite-seed-content.mjs      # exempelinnehåll
node scripts/appwrite-verify.mjs            # kontrollerar att schemat stämmer
```

Tillägg som körs en gång vid uppgradering:

```bash
node scripts/appwrite-add-profile-intro.mjs    # presentationen på profiles
node scripts/appwrite-add-important-dates.mjs  # listan med kommande datum
node scripts/appwrite-add-consult-dialog.mjs   # texterna i mejlrutan
node scripts/appwrite-add-changelog.mjs        # kollektionen för ändringsloggen
node scripts/appwrite-add-custom-icons.mjs     # kollektionen för egna ikoner
node scripts/appwrite-add-changelog-commit.mjs # commit_sha på ändringsloggen
node scripts/appwrite-lock-drafts.mjs          # flyttar läsrätten till dokumentnivå
node scripts/appwrite-split-testimony-contacts.mjs  # skiljer av vittnesmålens kontaktuppgifter
```

Skripten är skrivna för att kunna köras om: befintliga kollektioner och fält
hoppas över i stället för att skrivas över, och seed körs bara mot en tom
kollektion.

`sync-signatures.mjs` hämtar antalet underskrifter från namninsamlingen och
uppdaterar räknaren. `sync-signatures.bat` schemalägger den lokalt.

---

## Driftsättning

Vercel bygger och publicerar automatiskt från `main`. Miljövariablerna med
`VITE_`-prefix måste finnas i Vercels projektinställningar. `vercel.json`
sköter routingen så att djuplänkar fungerar i en single-page-app.

Funktionerna under `api/` körs som serverlösa endpoints och behöver
`APPWRITE_API_KEY` satt i Vercel — den ska aldrig ligga i klientbygget. Samma
sak gäller `RESEND_API_KEY` (kontaktformulärets e-postutskick) och
`ANTHROPIC_API_KEY` (översättningen av commit-rubriker till ändringsloggen).
Ingen av dem får `VITE_`-prefix.
