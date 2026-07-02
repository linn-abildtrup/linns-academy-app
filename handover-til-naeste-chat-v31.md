# Handover til næste chat — v31

**Dato:** 2. juli 2026
**Session-tema:** **App-abonnementer: købs-/slutdato fanges fra Simplero, adgang udløber automatisk, "Dit abonnement"-visning + udløbs-banner** · **samlet dato-styret abo↔forløb-adgangsmodel** (kunde kan have begge; forløb i sit vindue, app før/efter) · **manuel oprettelse af gratis app-kunde (admin)** · **"Få adgang igen" → app-køb** · **Feature-adgang: "Fleksibelt forløb"-kolonne + "Beskeder til Linn"-række** · **symptomcheck-kadence følger aktivt forløb** · **SommerRo-forløb sat op** · diverse.

Denne handover er selvstændig. Memory-filerne loades også automatisk (se især `project_abo_datoer`, `project_symptomcheck_kadence`, `project_feature_adgang_plan`, `feedback_diagnose_foerst`). Tidligere handovers: v30 (udvikling-dashboard 4 faner), v27 (Linns Academy 2.0-rearkitektur, IKKE implementeret).

> ## ⚠ VIGTIGSTE REGEL: DIAGNOSE FØRST — KOD ALDRIG UDEN GO
> Lav ALTID en grundig diagnose før du skriver eller ændrer kode: forstå årsagen, læs den relevante kode, og verificér mod live-data (tør audit / dry-run) hvor der er kunde-påvirkning. Præsentér fundene + løsningsforslag, og **vent på et klart "ja/kør/ret det"** fra Bo/Linn før du koder — også på "er det muligt?"-spørgsmål (svar først, kod ikke). Læse-only undersøgelse (læse filer, dumpe Firestore via midlertidige scripts der ryddes op) er en del af diagnosen og er OK. ~760 kunder i drift, så forkerte/forhastede ændringer er dyre. (Se memory `feedback_diagnose_foerst`.)

---

## 0. Arbejdsgang — læs FØRST

- **Stack:** SvelteKit (Svelte 5 runes), Firestore, Cloudflare Pages (auto-deployer fra `main`), Firebase Auth + Storage. Alt UI/kommentarer på **dansk** (ingen em-dash/semikolon i tekst til Linn).
- **Før commit:** `npx svelte-check --threshold error` (0 errors) + `npm test` ved logik-ændringer.
- **Deployment:** push til `main` → Cloudflare bygger automatisk. `firestore.rules`/`storage.rules` deployes MANUELT via Console.
- **Data-scripts:** `firebase-admin` + `scripts/service-account-key.json` (lokal, IKKE i git). Skriv midlertidigt `scripts/_navn.ts`, kør `npx tsx`, slet bagefter. Firestore-REST-klienten (`src/lib/server/firestoreRest.ts`) bruges server-side (firebase-admin virker ikke på Cloudflare Workers).
- **~600-760 kunder i drift.** Verificér ALTID risikable ændringer mod live FØR kodning (tør audit/dry-run). Vælg mindst risikable løsning.
- **Arbejdsstil (Linn/Bo):** DIAGNOSE FØRST, kod ALDRIG før eksplicit "ja/kør". List ændringer + verificér mod live før commit. Én ting ad gangen. Screenshots ligger i `screenshots/` (nyeste fil). Testkonti at ekskludere fra live-tal: alle `@linnsacademy.dk`, `bo_andersen1@…`.
- **Denne session blev drevet af Bo (udvikler) på Linns vegne.**

---

## 0b. Projektstruktur — hvor tingene ligger

**Kode (`src/`):**
- `src/lib/content/` — REN logik + typer/modeller + `.test.ts`. Fx `forlobAdgang.ts` (Forlob/AllowedEmail-typer, `forlobAdgangFelter`, `forlobSlutMs`, `produktTypeForForlob`), `forlob.ts` (dag-beregning, `forlobErKickstart/Kropsro`), `adgangResolver.ts` (dato-styret adgang), `abonnement.ts` (abo-visning), `features.ts` (feature-matrix), `moduler.ts`, `mrs.ts`, `mikrotraening.ts`, `vaner.ts`, `smaaSkridt.ts`, `produkter.ts` (de 4 produkter + simplero-mapping).
- `src/lib/utils/` — helpers: `userAdgang.ts` (**`effektivState`** = kernen i al adgang), `traeningsvariant.ts`, `klientSoegning.ts`, `adminKlient.ts`.
- `src/lib/firestore/` — klient-side Firestore-læs/skriv: `forlob.ts` (`hentForlob`, `hentAktivtForlob`, `hentAllowedEmail`), `mikrotraening.ts`, `mrs.ts`, `vaner.ts`, `smaaSkridt.ts`, `tildelinger.ts`, `linnAi.ts`, `featureAdgang.ts`.
- `src/lib/server/` — server-side (kører på Cloudflare): `firestoreRest.ts` (custom Firestore REST-klient — firebase-admin virker IKKE på Workers), `simpleroWebhook.ts` (payload-parsing, `opdaterBrugerEllerWhitelist`), `authRest.ts`.
- `src/lib/userDoc.ts` — **login-sync** (`synkroniserForlobskundeStatus`), createUserDoc, admin-klient-mode.
- `src/lib/components/` — delte Svelte-komponenter (TabBar, Header, Icon, Loading, BekraeftModal, IngenAdgangScreen).
- `src/lib/admin.ts` — `ADMIN_EMAILS` + `isAdmin`.
- `src/routes/app/` — KUNDE-app: `+layout.svelte` (auth + sync + context), `+page.svelte` (forside, alle userState-varianter), `profil/`, `moduler/*` (traening, 30-30-3, linn-ai, symptomcheck, forlob…), `beskeder/`.
- `src/routes/app/admin/` — ADMIN: `forlob/[id]/*` (lektioner, smaa-skridt, traening, beskeder…), `abonnenter/`, `feature-adgang/`, `dashboard/`, `testere/`, `spoergsmaal/`, `kunde-tildeling/`, `nulstil-adgang/`.
- `src/routes/api/` — endpoints: `simplero-webhook/{koeb,fornyelse,afbrudt,betaling-fejlede}/`, `admin/{set-temp-password,opret-app-kunde,genberegn-mrs,…}/`, `linn-ai/`, `analyser-opskrift/`, `foreslaa-madplan/`.
- `scripts/` — data-scripts (`firebase-admin` + `scripts/service-account-key.json`, lokal, IKKE i git). Diagnose-/migrations-scripts skrives midlertidigt (`_navn.ts`), køres med `npx tsx`, og slettes bagefter.

**Firestore-datamodel (vigtigste):**
- `users/{uid}` — bruger + adgangs-felter (accessSource/accessLevel/activeProduct/activeSubscription/expiresAt, abo-felter, forlobIds, afsluttedeForlobIds). Undercollections: `userProducts/{produktId}`, `products/{produktId}/vanedage/{dagN}` (vane-svar + gamle sliders), `maaltider`, `mrs_scores`.
- `allowedEmails/{email}` — whitelist + adgangs-felter (webhook/CSV sætter; login-sync kopierer til userDoc).
- `forlob/{id}` — forløb (startDato, antalDage, type, adgangsNiveau, byggetForlob, produktNoegle, features). Undercollections: `forlobsdage/{dagN}` (lektioner), `mikrotraeningProgrammer/{id}/days/{dagN}`, `vaneprogram/{dagN}`, `smaaSkridt/{id}` (planer), (Kropsro også: challenges, faqItems, guideItems).
- `featureAdgang/aktiv` — feature-matrix. `webhookLog` — rå Simplero-payloads. `exercises`, `opskrifter`, `fodevarer`, `adminStats`, m.fl.

---

## 1. App-abonnementer: købs-/slutdato + automatisk udløb

**Baggrund:** App-abo er FAST-periode-køb (1/3/6 mdr), ikke evigt-løbende. Mange kunder skrev for at opsige (kan ikke — fast periode) → tidsrøver. Simplero-webhook-payloaden har `purchased_at` (købsdato) + `period_ends_at` (slutdato); `price_period_id` koder perioden (987964≈3 mdr, 987969≈7 mdr). Alle abo-køb er produkt **255519 = basisabo** (produkt-id skelner IKKE perioden).

**Felter på userDoc + AllowedEmail:** `aboKoebtAt`, `aboSlutterAt` (ms), `aboProdukt` (basisabo/premiumabo), `aboAccessLevel` (basis/premium). Sidste to bevarer abo-identiteten så vi kan skifte tilbage til app efter et forløb (activeProduct overskrives af forløbet).

- **Webhook** (`koeb` + `fornyelse`): gemmer alle fire felter for abo-køb. (commit 8411b1e + 3f70097)
- **Login-sync** kopierer dem videre.
- **Håndhævelse i `effektivState`** (`src/lib/utils/userAdgang.ts`): `accessSource='abonnement'` + `aboSlutterAt < nu` → `udlobet`. Konti UDEN `aboSlutterAt` (comp/manuel) = løbende adgang, upåvirket. Evalueres ved hvert load — kunden mister adgang automatisk ved næste app-åbning på/efter slutdatoen. (commit e40ea8e) **ER LIVE.**
- **Bagudfyldt:** 167 webhook-abo + 8 comp fik felterne (også dem der nu er på forløb).

**Første rigtige kunder der udløber:** fabersalle44@gmail.com (17/7), connielauridsen@gmail.com (20/7). Stor bølge: **midt dec 2026**. Se §9 overvågning.

## 2. "Dit abonnement" + udløbs-banner

Helpers: `src/lib/content/abonnement.ts` (`aboVisning`, `formaterDatoLang`, `PAAMIND_DAGE=14`, `APP_KOB_URL`).

- **Profil** (`/app/profil`): "Dit abonnement"-sektion (Købt + Adgang til + tekst om at det ikke kan opsiges). Vises kun for `modulbruger` med `aboSlutterAt`.
- **Forside** (`/app/+page.svelte`, modulbruger-gren): blødt banner "Din adgang udløber om X dage (dato). Forny her →" (link APP_KOB_URL) når ≤14 dage til.
- **Gating verificeret:** app-kunder ser det, forløbskunder + udløbne + comp-konti (uden dato) ser det IKKE. (commit e40ea8e)

## 3. Samlet dato-styret abo↔forløb-adgangsmodel (STØRSTE ændring)

En kunde kan have BÅDE en abo-periode OG et forløb. Ren resolver **`src/lib/content/adgangResolver.ts`** (`resolverAktuelAdgang(nu, forløbsvinduer[], abo)`, 10 tests):
- Aktivt forløb (start ≤ nu < slut) → **forløbskunde**
- Ellers gyldig abo (aboSlutterAt > nu, eller comp uden dato) → **app-kunde**
- Ellers → **udlobet**

**Wiret ind i login-sync** (`synkroniserForlobskundeStatus` i `src/lib/userDoc.ts`) som AUTORITATIV for accessSource/activeProduct/accessLevel/expiresAt. Kører ved hvert load. Ved `udlobet` rører den ikke felterne → 90-dages bibliotek-bonus (`bonusPeriodEndsAt`) bevares. (commit 3f70097)

**Resultatet (Bos krav):** app-kunde der køber forløb → bliver på app til forløbets startdag → forløbskunde i vinduet → tilbage til app efter forløbet (hvis abo stadig gyldig), ellers udlobet. Abo-uret forlænges IKKE af forløbet; udløber det midt i forløbet, sker det lydløst.

**Login-sync-frekvens** (`src/routes/app/+layout.svelte`): kører ved app-boot (onAuthStateChanged), ved foreground efter >**1 time** i baggrund (`SYNC_TAERSKEL_MS`, ændret fra 10 min), og ved allowedEmail-ændringer. Tilstrækkeligt til dato-overgange.

**adgangFra-parkeringen er FJERNET** (afløst af resolveren): parkerings-grenen i `koeb`-webhook + `aboAktivNu`-gaten + `parkeretTil` i login-sync + de døde funktioner `hentAktivtForlobSlut`/`parkerAboTilEfterForlob` er væk. (commits 4621ab6, 9497d8d). `adgangFra`-FELTET står stadig i `AllowedEmail`-typen (harmløst, intet læser det; kan fjernes ved en tidy-up + data-oprydning).

**Migrering + dobbelt-tør-audit:** kun 5 kunder skiftede tilstand — alle korrekte; 2 (info@kst-huset, ckurejepsen) fik fejlagtigt mistet adgang GENDANNET. 755 uændret.

## 4. Manuel oprettelse af gratis app-kunde (admin)

`Admin → Abonnenter → "+ Opret gratis app-kunde"`. Endpoint `src/routes/api/admin/opret-app-kunde/+server.ts` (admin-auth via Firebase-token + ADMIN_EMAILS). Skriver allowedEmail med premium-abo-felter (gratis, intet Simplero-abo, ingen fakturering). Blokerer hvis emailen allerede findes. Kunden opretter selv adgangskode på login-siden. (commit 96cd455)

## 5. "Få adgang igen" → app-køb

Afsluttede kunders "Få adgang igen"-knap i Moduler peger nu på app-abo-købet (`APP_KOB_URL` = `https://linn.simplero.com/cart/255519-Linns-Academy-App`) i stedet for Kickstart. `src/lib/content/moduler.ts` (`udlobetStatus`). Rammer kun udløbne. (commit b814d25)

## 6. Feature-adgang: Fleksibelt forløb + Beskeder til Linn

`src/lib/content/features.ts`. (commits 4135acf, 092af3b)
- Ny KOLONNE **'fleksibelt'** (kundetype) — byggede forløb (fx SommerRo) klassificeres hertil via `kundetypeFor` ud fra `activeProduct` (produktNøgle ≠ standard-produkt). Afløser det gamle pr-forløb `forlob.features`/`userDoc.forlobFeatures` (grenen fjernet fra `harFeatureAdgang`).
- Ny RÆKKE **'beskeder-til-linn'** — gater "skriv direkte til Linn" på beskeder-siden (Linn AI styres af 'linn-ai'). Kan stå alene / sammen med AI / AI alene. Default TIL for kickstart/kropsro, FRA for fleksibelt+app.
- Gemt skema (`featureAdgang/aktiv`) seedet: fleksibelt = linn-ai+udvidet-naering+ai-opskrift til, nul-dage+beskeder-til-linn fra.
- Beskeder-siden: når kun Linn AI (ingen beskeder-til-linn) er ALLE "send til Linn"-henvisninger skjult.

## 7. Symptomcheck-kadence + SommerRo (tidligere i sessionen)

- **Symptomcheck/MRS-kadence** følger nu det AKTIVE forløb via `hentAktivtForlob` + `forlobErKickstart/forlobErKropsro` (id-præfiks), ikke et udløbet kickstart_-id i forlobIds. Rettede 38 fler-forløbs-kunder der fik ugentlig i stedet for hver 4. søndag. Nyt felt `afsluttedeForlobIds` (29 kunder ryddet). (commit d243105) Se `project_symptomcheck_kadence`.
- **SommerRo-forløb** (`sommerro_ny`): Dag 0 = 21/6, 55 dage, optakt-uge tom, første lektion Dag 7 (28/6). Lektioner + Små skridt flyttet +6 (Små skridt oprettet som plan-docs så de kan styres i admin). Træning udvidet til dag 55. 11 kunder (10 fra Kickstart-juni + bo). Autogenerator tager nu begge sider (venstre/højre-øvelser) med, max ét par/dag (commit 2bac0ef).

## 8. Genbrugeligt tjek-script

`scripts/tjek-abo-udloeb.ts` (utracked lokalt): `npx tsx scripts/tjek-abo-udloeb.ts <email> …` → rapporterer effektivState + om aboSlutterAt er passeret. Bruges til at bekræfte udløbs-håndhævelse.

## 9. Åbne tråde / TODO

- **Overvågning (afventer):** bekræft at fabersalle44@gmail.com (18/7) og connielauridsen@gmail.com (21/7) flipper til `udlobet`. Cloud-scheduling kan IKKE (GitHub ikke forbundet + service-account-key kun lokal) — kør `scripts/tjek-abo-udloeb.ts` manuelt de dage, eller bed en session med lokal Firestore-adgang gøre det.
- **Deploy-status:** kan ikke tjekkes herfra (wrangler ikke logget ind, ingen prod-URL i repo). Bekræftet af Bo at seneste var deployet. Tjek Cloudflare-dashboard eller `wrangler login`.
- **Valgfri oprydning:** fjern `adgangFra`-feltet fra typen + ryd gamle `adgangFra`-værdier på whitelist. Fjern evt. `tjek-abo-udloeb.ts` fra utracked hvis den skal committes.
- **Forløbskunders udløb:** ingen samlet oversigt lavet (kun app-abo). Kan trækkes hvis nødvendigt.
- **Åben (fra memory `project_feature_adgang_plan`):** 3D — fjern premium-hacket på juni-Kickstart, ryd basis/premium-levn.

## 10. Fil-reference (denne session)
- `src/lib/content/adgangResolver.ts` (+.test) — dato-styret resolver
- `src/lib/content/abonnement.ts` (+.test) — abo-visning
- `src/lib/utils/userAdgang.ts` (+.test) — effektivState m. abo-udløb
- `src/lib/userDoc.ts` — login-sync m. resolver-wiring
- `src/lib/content/features.ts` (+.test) — fleksibelt-kolonne + beskeder-til-linn
- `src/lib/content/moduler.ts` — "Få adgang igen" → app-køb
- `src/routes/app/profil/+page.svelte` — Dit abonnement
- `src/routes/app/+page.svelte` — udløbs-banner
- `src/routes/app/+layout.svelte` — sync-frekvens
- `src/routes/app/admin/abonnenter/+page.svelte` + `src/routes/api/admin/opret-app-kunde/+server.ts` — opret app-kunde
- `src/routes/api/simplero-webhook/{koeb,fornyelse}/+server.ts` + `src/lib/server/simpleroWebhook.ts` — abo-felter, parkering fjernet
- `src/lib/types.ts` / `src/lib/content/forlobAdgang.ts` — nye abo-felter

**Commit-kæde (denne session, nyeste sidst):** 2bac0ef · d243105 · 4135acf · 092af3b · b814d25 · 96cd455 · 8411b1e · e40ea8e · c8ec047 · 3f70097 · 4621ab6 · 9497d8d
