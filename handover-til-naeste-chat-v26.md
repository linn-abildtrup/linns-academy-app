# Handover til næste chat — v26

Status efter session 26 (15.–17. maj 2026). Stor migration-session hvor 320 klienter er flyttet fra den gamle HTML-app (`vanetracker`-projektet) over til den nye SvelteKit-app (`linns-academy-app`), inklusive deres login-koder og dele af deres data.

## Hovedtemaer i v26

1. **Bonusskridt og abo-mikrotræning** (tidlig session) — 50 reflektionsspørgsmål erstattet af 90 bonusskridt, abo-mikrotræning som uendeligt loop med kettlebell/no-kettlebell-variant, skift-i-profil. Maria's expiresAt korrigeret fra 17. maj 00:00 til 18. maj 00:00 (TIL OG MED Dag 21 kl 23:59).
2. **Selvbetjent password-flow** — Glemt-adgangskode på login + Skift-kode på profil.
3. **Abonnenter-admin-side** — viste 56 basis-abo som "(uden navn)" → Simplero-webhook udvidet til at gemme `firstName`/`lastName` + backfill-script kørt for 59 eksisterende.
4. **Migration fra gammel app** — 320 reelle kunder importeret med bevaret password + UID. Adgang konfigureret. Madlog + favoritter overført.

---

## Status quo

**Live URL:** `https://linns-academy-app.pages.dev`
**Deploy:** Auto fra `main` på Cloudflare Pages
**Sidste deploys:** Auth-import, kickstart-adgang, midnatovergang, allowedEmails-entries, pfMeals-migration.

### Brugere i Firestore
- **333 Auth-konti** total (13 testbrugere fra før + 320 importerede med gammel-app-UID bevaret)
- **332 allowedEmails-entries** (2 oprindelige test + 320 nye med `forlobId=kickstart_maj_2026`)
- **332 brugere med Kickstart-adgang** (12 oprindelige + 320 importerede)

### Test-brugere (uændrede fra v25)
Alle med password `test1234`:
- `forlob@linnsacademy.dk` — Maria, forløbskunde, Kickstart maj 2026
- `modul@linnsacademy.dk` — Anne, modulbruger
- `udlobet@linnsacademy.dk` — Sofia, udløbet
- `linnabildtrup00@gmail.com` — Linn, admin
- `bo_andersen1@icloud.com`, `bo_andersen1@mac.com` — Bo, Simplero-test
- `basis_app@linnsacademy.dk`, `premium_app@linnsacademy.dk` — abo-test
- `kickstart@linnsacademy.dk`, `premium_forlob@linnsacademy.dk` — forløb-test

---

## Migration fra gammel app — fuld kæde

### Trin 1: Auth-import (alle 320 kan logge ind med samme kode)

Brugere fra `vanetracker`-projektet eksporteret via `firebase auth:export` + hash-config fra Identity Toolkit API. Filtreret mod TEST-markeringer i `scripts/gamle-brugere_opdateret.csv` (kolonne G). 5 testbrugere udelukket (Linn selv, Bo-konti, kontakt@, familien_andersen@).

**Resultat:** 320 nye Firebase Auth-konti i ny app, UID bevaret 1:1 fra gammel app, passwords overført som SCRYPT-hash (kunderne kan logge ind med samme kode som i den gamle app).

**Scripts brugt:**
- `scripts/list-gamle-auth-brugere.ts` — eksport-CSV
- `scripts/hent-hash-config.ts` — Identity Toolkit hash-config
- `scripts/importer-auth-brugere.ts` — `firebase-admin` `importUsers` med SCRYPT-config

### Trin 2: Kickstart-adgang sat for alle 320

userDoc oprettet for hver med:
- `activeProduct: 'kickstart'`, `accessLevel: 'basis'`, `accessSource: 'forløb'`
- `forlobIds: ['kickstart_maj_2026']`, `state: 'forlobskunde'`
- `expiresAt: 2026-05-18 00:00 dansk tid` (midnat — overstyrer formel-beregnet 06:00)
- `bonusPeriodEndsAt: 2026-08-16 00:00` (90 dage efter expiresAt)
- `firstName`, `lastName` fra Auth-displayName
- Subdoc `users/{uid}/products/kickstart` med tom `programValg`+`fremgang`

**Script:** `scripts/giv-kickstart-adgang.ts`

### Trin 3: Automatisk overgang ved midnat (i nat 17.→18. maj)

**Beslutning fra Linn:** Alle 320 ser Kickstart i dag. Fra midnat (18. maj 00:00):
- 58 af de 320 er også basis-abonnenter på Simplero → overgår til basis-app
- 262 øvrige → overgår til 90 dages bibliotek-bonus

**Mekanik:**
- Nyt felt `adgangFra: number` på `AllowedEmail` (definitions i `src/lib/content/forlobAdgang.ts`)
- Sync-funktionen `synkroniserForlobskundeStatus` i `src/lib/userDoc.ts` respekterer `adgangFra` — abo-flag aktiveres først når tiden er passeret
- De 58 basis-abonnenters allowedEmails har fået `adgangFra = 2026-05-18 00:00`
- Backup af de 58s pre-state: `scripts/backup-basisabo-overlap.json` (gitignored)

**Script:** `scripts/justér-overgang-til-midnat.ts`

### Trin 4: allowedEmails-entries for admin-synlighed

Admin-siden `/app/admin/forlob/[id]` læser fra `allowedEmails`-collection. Mit Kickstart-adgang-script (trin 2) skrev direkte på `users`-tabellen, så de 320 var usynlige på admin-siden. Trin 4 retter dette:

Oprettet/merget allowedEmails-entries for alle 320 med `forlobId='kickstart_maj_2026'` + `status='registered'` (bevarer basisabo + adgangFra på de 58 overlap-entries).

**Script:** `scripts/opret-allowedemails-for-320.ts`

### Trin 5: Migration af pfMeals + pfMealFavorites

- **244 brugere** har madlog i gammel app → migreret til `users/{uid}/maaltider`
- **187 brugere** har favoritter → migreret til `users/{uid}/favoritmaaltider`
- **6.935 måltider** + **1.106 favoritter** flyttet
- **38.962 items (96%) genkendt** mod ny app's fodevarer-collection
- **1.626 items (4%) konverteret til manuel-items** (egne opskrifter `recipe_*` + custom-fødevarer fra gammel app)
- `totalP`/`totalF` bevaret på selve måltidet → korrekt sum vises selv for manuelle items
- Måltidstype mappet: `morgen→morgenmad`, `middag→aftensmad`, andre uændret
- Migration-flag: `migreretFraGammel: true` på alle migrerede docs

**Scripts:** `scripts/migrer-pfmeals.ts` (+ inspect-skripter)

### Hvad er IKKE migreret endnu

Følgende kunde-data fra den gamle app er stadig kun i `vanetracker`:
- **pfCustomFoods** (personlige fødevarer) — kun afspejlet som manuel-items i migrerede måltider
- **entries/{uid}/days** (vanetracking-historik / daglige check-ins)
- **dcEntries/{uid}/days** (DailyCheck: krop, søvn, sind, refleksion) — ingen tilsvarende plads i ny app
- **mtClientPrograms/{uid}/days** (kustomiserede træningsdage) — ingen tilsvarende plads
- **chats/{uid}/messages** (chat-historik) — ingen chat i ny app
- **mtLevel / mtCustom** (Kickstart-fase) — ingen brug af det i ny app

Linns beslutning: vente med disse. Den gamle app forbliver intakt som arkiv.

---

## Vigtige beslutninger fra Linn i denne session

1. **Tidspunkt for go-live er ikke kritisk** — hun sender selv email til kunderne når hun er klar. Ingen hård deadline kl 00:01.
2. **Kun reelle kunder migreres** — testbrugere ekskluderes via TEST-flag i CSV (5 stk).
3. **Alle kunder har password-login** i gammel app — ingen OAuth-bekymring.
4. **Den gamle app slettes aldrig** — vi kopierer kun, gamle data forbliver tilgængelige som backup/arkiv.
5. **Alle 320 får Kickstart-adgang i dag, 90 dages bibliotek bagefter** — uanset hvad de tidligere har købt.
6. **De 58 basisabonnenter** bliver først basis-app-kunder fra midnat — ingen overlap af "kickstart + abo" samtidig.
7. **Lektionsindhold er allerede 1:1** — Linn har manuelt oprettet alle lektioner i ny app, så vi skal kun flytte ADGANGEN, ikke indholdet.

---

## Åbne tråde

### Fra v25 (uændret)
1. Cancel-flow afklaring (Simplero sender 2 events ved cancel — hvorfor?)
2. End-to-end test af fornyelse + betaling-fejlede webhooks
3. Slet legacy `/api/simplero-webhook`-route når alle Simplero-konfigurationer er migreret
4. Persona-prompt til Linn AI
5. Firestore-rules skal opdateres MANUELT i Firebase Console — to nye collections (`modulbrugerLektioner` + `aiRatings`) har rules i `firestore.rules` der endnu ikke er pushed til Firebase.

### Nye i v26
6. **Test af migreret kunde-login**: Linn skal teste at en kunde kan logge ind i ny app med sin gamle kode + se sin migrerede madlog. Foreslåede testkandidater fra CSV: en kunde Linn har personlig kontakt til.
7. **Email til kunderne** — udsendes når Linn er klar (ingen automatisk trigger).
8. **Beslutning om resterende data-typer**: vanetracking-historik, DailyCheck, custom-fødevarer, chat — om/hvordan de skal migreres eller arkiveres. Linn parker beslutningen indtil videre.
9. **Forlobs-startDato afvigelse**: `forlob/kickstart_maj_2026.startDato` = 2026-04-26 06:00 dansk tid (ikke 00:00). Formlen `startMs + (antalDage+1)*dayMs` gav derfor expiresAt = 2026-05-18 06:00 oprindeligt. Vi overstyrede til midnat manuelt på alle 320 + Maria er stadig på 06:00. Hvis det skal være konsistent, skal startDato fixes (men det påvirker også lektionsfrigivelse).

---

## Nye filer (denne session)

### Kode-ændringer
- `src/lib/content/forlobAdgang.ts` — `adgangFra?: number` på `AllowedEmail`
- `src/lib/userDoc.ts` — sync respekterer `adgangFra`
- `src/lib/server/simpleroWebhook.ts` — `uddragNavn()` + `first_names`/`last_name` på payload-type
- `src/routes/api/simplero-webhook/+server.ts` + `koeb/+server.ts` — gemmer firstName/lastName

### Scripts (alle i `scripts/`)
- `backfill-navne-fra-webhooklog.ts` — backfill firstName fra Simplero-payload
- `list-gamle-auth-brugere.ts` — liste over gamle Auth-brugere + CSV-eksport
- `hent-hash-config.ts` — hent SCRYPT signer-key via Identity Toolkit
- `importer-auth-brugere.ts` — `auth.importUsers` med hash-config (henter signer fra `vanetracker-hash-config.json`, gitignored)
- `giv-kickstart-adgang.ts` — opret userDoc + products/kickstart for 320
- `justér-overgang-til-midnat.ts` — justér expiresAt til midnat + park 58 basisabonnenter
- `opret-allowedemails-for-320.ts` — allowedEmails-entries så admin-siden viser dem
- `inspect-pfmeals.ts` + `inspect-pfmeals-2.ts` — inventory af gammel madlog-data
- `migrer-pfmeals.ts` — flyt pfMeals + pfMealFavorites til ny app

### Gitignored lokale filer
- `scripts/vanetracker-key.json` — service account for gammel app
- `scripts/vanetracker-hash-config.json` — SCRYPT-signer-key for password-import
- `scripts/vanetracker-users-rå.json` — Auth-eksport (indeholder passwordHashes)
- `scripts/backup-basisabo-overlap.json` — backup af de 58s pre-park-data
- `scripts/gamle-brugere.csv` + `gamle-brugere_opdateret.csv` — kundedata med TEST-markeringer

---

## Næste skridt forslag

1. Test login med 1-2 kunder (incognito + deres mail+kode)
2. Tjek admin/forlob-siden for Kickstart maj 2026 — der bør stå 322 tilmeldte emails (2 test + 320 nye)
3. Tjek admin/abonnenter-siden — burde stadig vise basisabo'erne korrekt (de er parkeret indtil midnat, så de står teknisk uden accessLevel-flag på allowedEmails indtil i nat, men deres allowedEmails-entry har stadig `simpleroCustomerId` osv.)
4. Hvis test går godt: send email til kunderne

---

## Workflow-noter

- **Sprog**: dansk
- **Commit-stil**: korte titler, dansk, "Modul: ændring" pattern
- **Test-kommandoer**: `npm run check`, `npm test`
- **Deploy**: auto via push til main (Cloudflare Pages)
- **Workflow**: dry-run scripts → vis output → Linn siger OK → --apply
