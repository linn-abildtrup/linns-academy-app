# Handover til næste chat — v12

Status efter session 13 (7. maj 2026). **Etape 10 forløb-fundament er færdigt.** Linn kan nu oprette nye Kickstart-runder, uploade Simplero-CSV som whitelist, og brugere matches automatisk til deres forløb ved login.

---

## TL;DR

**Etape 10 er færdig.** Forløb-fundamentet ligger på plads:

- `forlob/{id}` Firestore-collection med navn, startDato, antalDage, vaneProgramId, aktiv
- `allowedEmails/{email-lc}` whitelist importeret fra Simplero-CSV
- Admin-UI på `/app/admin/forlob` til at oprette, redigere og slette forløb
- CSV-upload på forløb-detalje-side med preview og batch-import
- Login-flow: synkroniserer brugere mod whitelisten — sætter `forlobskunde`-state og `forlobId` på userProduct automatisk
- Firestore-rules opdateret (skal manuelt copy-pastes til Console)
- Seed-script `npm run seed:forlob` opretter eksempel-forløb og tilknytter Maria

**Næste skridt:** Etape 11 — vanetracker (klient + admin), bygger ovenpå forløb-konceptet.

---

## ⚠️ Vigtigt: Firestore-rules skal opdateres i Console

`firestore.rules` er opdateret med regler for `forlob` og `allowedEmails`, men dem skal manuelt copy-pastes ind i Firebase Console før de tager effekt:

1. Åbn Firebase Console → Firestore Database → Rules-fanen
2. Erstat indholdet med `firestore.rules` fra repoet
3. Tryk Publish

Indtil det er gjort, vil CSV-upload og login-flow fejle med "Missing or insufficient permissions". Maria er allerede tilknyttet via seed-scriptet (admin-rettigheder), så hun virker — men nye whitelistede brugere vil først kunne logge ind når reglerne er live.

---

## Hvad der er bygget i denne session

### Datalag — `src/lib/content/forlobAdgang.ts`

Holdt adskilt fra eksisterende `src/lib/content/forlob.ts` (mock til "Mit forløb"-modulet på forsiden) for at undgå type-kollision.

**Typer:**

- `Forlob` — id, navn, startDato (Timestamp), antalDage, vaneProgramId, aktiv, oprettet
- `AllowedEmail` — email, firstName, lastName, forlobId, status ('invited' | 'registered'), oprettet, registreret
- `CsvRow` + `CsvParseResult` — for parser-output

**Pure-funktioner (40 nye unit tests):**

- `detectSeparator(headerLine)` — auto-detekt af tab/semikolon/komma
- `parseCsvLine(line, sep)` — CSV med escape af quotes
- `splitFullName(full)` + `capitalizeName(s)` — navn-helpers
- `parseSimpleroCsv(raw)` — main parser, returnerer rows + skipped + fejl
- `dageSidenStart(start, idag)` — diff i hele dage (0 = startdag)
- `unlockedDays(start, antalDage, idag)` — hvor mange dage er åbne
- `dagDato(start, dagNummer)` — beregn datoen for dag N

### Firestore-helpers — `src/lib/firestore/forlob.ts`

- `hentAlleForlob()`, `hentForlob(id)`, `opretForlob(id, data)`, `gemForlob(id, data)`, `sletForlob(id)`
- `hentAllowedEmail(email)`, `hentAllowedEmailsForForlob(forlobId)`, `markerAllowedEmailRegistreret(email)`
- `gemAllowedEmailsBatch(rows, forlobId)` — idempotent batch-import i 400-chunks (Firestore-grænse 500). Returnerer `ImportResultat` med tilfoejet/opdateret/uaendret/fejl-tællere

### Admin-UI

**`/app/admin/forlob/+page.svelte`** — Forløb-liste:
- Inline opret-form med id-auto-generering fra navnet (æ→ae, ø→oe, å→aa)
- Hvert forløb vises som række med Aktiv/Inaktiv-badge

**`/app/admin/forlob/[id]/+page.svelte`** — Forløb-detalje:
- Edit-formular til navn, startDato, antalDage, aktiv
- CSV-upload sektion med preview ("X gyldige · Y annullerede sprunget over")
- Liste over tilknyttede emails med Inviteret/Tilmeldt-badge
- Slet-knap med to-trins bekræftelse

**`/app/admin/+page.svelte`** opdateret — Forløb-rækken er øverst med terra-accent.

### Login-flow — `src/lib/userDoc.ts` + `src/routes/app/+layout.svelte`

Ny funktion `synkroniserForlobskundeStatus(uid, email, current)` der efter `getUserDoc`:

1. Slår brugerens email op i `allowedEmails`
2. Hvis match:
   - Sætter/opdaterer `users/{uid}/products/kickstart.forlobId`
   - Sætter `userDoc.state = 'forlobskunde'` hvis ikke allerede
   - Udfylder `firstName` fra whitelisten hvis det manglede
   - Markerer allowedEmails-status som `'registered'`
3. Hvis ikke match: gør ingenting (brugeren beholder sin nuværende state)

Fejl logges men blokerer ikke login (best-effort).

### Seed — `scripts/seed-forlob.ts`

`npm run seed:forlob` opretter:
- `forlob/kickstart_maj_2026` (start 4. maj 2026, 21 dage, aktiv)
- `allowedEmails/forlob@linnsacademy.dk` med Marias data, status='registered'
- Sætter `forlobId` på `users/{Maria-UID}/products/kickstart`

Idempotent — kan køres igen efter datamodel-ændringer.

### Firestore-rules

Tilføjet to regelsæt:
- `forlob/{id}` — alle autentificerede kan læse, kun admin skriver
- `allowedEmails/{email}` — brugeren kan læse + opdatere status/registreret for SIN egen email; admin har fuld adgang

---

## Den tekniske tilstand

### Mappestruktur (relevant for etape 10)

```
src/
├── lib/
│   ├── content/
│   │   ├── forlob.ts                       ← uændret mock til "Mit forløb"
│   │   ├── forlobAdgang.ts                 ← NY (typer + pure logik)
│   │   └── forlobAdgang.test.ts            ← NY (40 tests)
│   ├── firestore/
│   │   ├── mikrotraening.ts                ← uændret
│   │   └── forlob.ts                       ← NY
│   └── userDoc.ts                          ← + synkroniserForlobskundeStatus
└── routes/
    └── app/
        ├── +layout.svelte                  ← kalder synkronisering ved login
        └── admin/
            ├── +page.svelte                ← Forløb-rækken aktiveret
            ├── forlob/+page.svelte         ← NY (liste + opret-form)
            └── forlob/[id]/+page.svelte    ← NY (edit + CSV-upload)

scripts/
└── seed-forlob.ts                          ← NY (npm run seed:forlob)
```

### Firestore-struktur (nye stier)

- `forlob/{id}` — fx `forlob/kickstart_maj_2026`
- `allowedEmails/{email-lc}` — fx `allowedEmails/forlob@linnsacademy.dk`
- `users/{uid}/products/kickstart.forlobId` — peger på brugerens forløb

### Tests

**133 tests passerer** (var 93 — 40 nye for CSV-parser og dato-helpers).

### Test-brugere (status efter denne session)

- `forlob@linnsacademy.dk` (Maria) — på `kickstart_maj_2026`-whitelist, status='registered', forlobId sat
- `modul@linnsacademy.dk` (Anne) — IKKE på whitelist, forbliver modulbruger
- `udlobet@linnsacademy.dk` (Sofia) — IKKE på whitelist
- `linnabildtrup00@gmail.com` (Linn, admin) — IKKE på whitelist (admin har separat path)

### Kommandoer

```bash
npm run dev                        # start dev-server
npm test                           # 133 tests
npm run seed:forlob                # opret forlob/kickstart_maj_2026 + tilknyt Maria
npm run seed:mikrotraening         # uændret
npm run reset:mikrotraening        # uændret
npm run inspect:program            # uændret
npm run generate:program           # uændret
```

---

## Åbne tråde / kendte mangler

### Etape 10 — næsten færdig, men:

1. **Firestore-rules skal copy-pastes til Console** — kritisk, ellers fejler nye flows
2. **Manuel test af CSV-upload** — vi har ikke testet en rigtig Simplero-eksport endnu
3. **Adgangsbegrænsning ikke implementeret** — `modulbruger`-state forhindrer ikke adgang til Kickstart-moduler. Linn har eksplicit sagt "Disse kunder skal kun have adgang til kickstarter programmet" — det kræver enten:
   - Tjek af `userDoc.state === 'forlobskunde'` på modul-niveau
   - Eller at hver Kickstart-rute redirecter modulbrugere til en "ingen adgang"-side
4. **Forløb-Vaneprogram-kobling** — `forlob.vaneProgramId` er null i seed. Når vanetracker bygges (etape 11) skal admin kunne vælge program ved oprettelse
5. **Profilside skal vise forløb** — brugeren skal kunne se hvilket forløb hun er på fra `/app/profil`

### Andre kendte huller

6. **B1 modul-grid på forsiden ignorerer hvad brugeren har købt** (åben tråd fra etape 8)
7. **`/app/moduler/traening/+page.svelte` viser kun Mikrotræning hardkodet**
8. **Modul-rækkerne for Kost, Vaner, Mit forløb, Bibliotek er ikke klikbare**
9. **handover-til-naeste-chat-v10.md kan slettes** — den er nu forældet

---

## Commits fra denne session

```
4dcac1f Aktiver Forløb-rækken på admin-landing-siden
a9233fe Tilføj Firestore-rules for forlob og allowedEmails
d848261 Synkroniser forløbskunde-status ved login
5e12739 Tilføj seed-script til Kickstart maj 2026 forløb
a9943ed Tilføj CSV-upload til forløb-detalje-siden
a091ebc Tilføj admin-UI til opret og rediger forløb
1237491 Tilføj datalag for forløb og whitelist
```

---

## Næste etape (11) — Vanetracker

Bygger ovenpå forløb-fundamentet:

- `vaneProgrammer/{id}` collection med versioneret VT-indhold
- `users/{uid}/products/kickstart/vanedage/{N}` for brugerens svar
- Klient: hjem-side med 21-dages grid, dag-side med checks/refleksion/check-in
- Admin: vaneprogram-editor (rediger spørgsmål pr dag)
- Låse-logik baseret på forlob.startDato

Detaljeret plan ligger ikke skrevet ned endnu — næste session skal kigge på `reference/index.html` linjer 8965+ (VT_PROGRAM, vtRenderHome, vtRenderDay) for ref-implementationen.

---

## Til næste Claude-instans

1. **Linn taler dansk** — svar på dansk, ingen em-dashes/semikolons/lange tankestreger
2. **Hele filer, ikke linje-for-linje edits**
3. **Små commits ofte** — hvert lag/skridt sin egen commit
4. **Tjek altid `npx svelte-check` og `npm test`** efter ændringer
5. **CSS-variabler** følger `--ff-d`, `--text2`, `--bg2`-konventionen
6. **Bo håndterer terminalen** — antag intet om udvikler-kontekst
7. **Reference-app i `reference/index.html`** — alle features kan slås op
8. **Service-account-key** ligger i `scripts/service-account-key.json` (gitignored)
9. **Firestore-rules** copy-pastes manuelt til Firebase Console når ændret
10. **Forløbs-modellen er førsteklasses** — alle nye Kickstart-features (vanetracker, 30-30, opskrifter, FAQ, Guides) skal binde sig til `forlobId` i klient-data og `vaneProgramId`/lignende i admin-data, så Linn kan versionere indhold pr forløb

Held og lykke med vanetracker.
