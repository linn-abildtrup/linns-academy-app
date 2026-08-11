# Handover til næste chat — v21

Status efter session 21 (10.-11. maj 2026). **29 commits siden v20.** Sessionen handler primært om at gøre app'en KOMPLET for både basis- og premium-abonnenter — ikke kun forløbskunder. Tre store områder:

1. **Abo-flow for vaner, mikrotræning og udvikling** — basis/premium-brugere har nu deres egen vanetracker, 14-dages mikrotræning (dato-baseret), udvidet Udvikling-tab og personlig udvikling-graf
2. **Admin-klient-mode udvidet til 3 typer** — Linn kan teste appen som basis-app / premium-app / forløb
3. **Linn AI** — premium-feature med chat-UI, redigerbar persona, videnbase fra uploadede PDFs, Anthropic Claude som backend

Plus en lang række UI-rettelser, gating af premium-features (scanner, udvidet næring), 4 nye test-klienter, og opskrift-søgning der nu også matcher ingredienser.

**Vigtige åbne tråde (i prioritet):**
1. Auto-eksport af besvarede klient-spørgsmål til Linn AI-videnbasen — fysisk script eksisterer ikke endnu, alle videnbase-uploads er manuelle via admin-UI
2. Simplero cancel- og refund-trigger er stadig ikke oprettet (åbent siden v20)
3. Persona-prompten til Linn AI er pt en default-tekst — Linn skal selv tilpasse den til hendes egen stemme

---

## Status quo

**Live URL:** `https://linns-academy-app.pages.dev`
**Deploy:** Auto fra `main` på Cloudflare Pages, 2-4 min pr commit
**Tests:** 365 tests passerer, 0 type-fejl, 0 svelte-warnings (var 298 før v21, +67 nye tests)

### Test-brugere (5 nye fra v21)

Alle med password `test1234`:
- `forlob@linnsacademy.dk` — Maria, forløbskunde, Kickstart maj 2026 (uændret)
- `modul@linnsacademy.dk` — Anne, modulbruger (uændret)
- `udlobet@linnsacademy.dk` — Sofia, udløbet (uændret)
- `linnabildtrup00@gmail.com` — Linn, admin (uændret)
- `bo_andersen1@icloud.com` — Bo, Simplero-test-kunde (uændret)
- **`basis_app@linnsacademy.dk`** — BasisApp, modulbruger, basis-abo
- **`premium_app@linnsacademy.dk`** — PremiumApp, modulbruger, premium-abo
- **`kickstart@linnsacademy.dk`** — Kickstart, forløbskunde, Kickstart maj 2026
- **`premium_forlob@linnsacademy.dk`** — PremiumForlob, forløbskunde, Premium-forløb test
- Et nyt forløb `premium_forlob_test` er oprettet til premium-forløbs-brugeren

### Vigtige scripts

- `scripts/seed-test-klienter.ts` — opretter eller opdaterer de 4 nye test-brugere
- `scripts/seed-abo-vaneliste.ts` — seeder kurateret vaneliste til abo (14 vaner, kørt)
- `scripts/seed-abo-bonus.ts` — seeder 50 bonus-spørgsmål til abo-vanetrackeren (kørt)

---

## ⚠️ Linn AI — premium-feature med Anthropic Claude

### Hvad det er

Chat-assistent på `/app/moduler/linn-ai` der er tilgængelig for premium-app + premium-forløb-brugere. Bygger på Linns videnbase (PDFs/slides/Q&A) plus Claude's almene viden. Multi-turn samtaler, persistent på tværs af sessioner, navngives automatisk fra første spørgsmål.

### Arkitektur

- **Backend:** Cloudflare Worker på `/api/linn-ai/+server.ts`
- **Model:** Claude Sonnet 4.6 (`claude-sonnet-4-5-20250929`), max 1024 output tokens
- **Token-verifikation:** Firebase ID-token sendes som Bearer i Authorization-header. Worker'en verificerer via `identitytoolkit.googleapis.com/v1/accounts:lookup`. Bruger `PUBLIC_FIREBASE_API_KEY` fra `$env/static/public` (IKKE `$env/dynamic/private` — det var den oprindelige bug)
- **Adgangs-tjek:** Worker tjekker `userDoc.accessLevel === 'premium'` ELLER admin-klient-mode er `premiumapp`/`forlob`
- **Rate-limit:** 20 queries/dag pr bruger. Tæller gemt i `users/{uid}/linnAiQuotaer/{YYYY-MM-DD}`. Øges først efter SUCCESFULDT Anthropic-svar (fejl-kald tæller ikke)
- **Token-håndtering:** `firestoreRest.ts` (samme som Simplero) — får OAuth-access-token via service-account JWT

### Datamodel

```
linnAiVidenbase/{id}                      ← admin uploader: PDFs/slides/manual
  navn, kilde (pdf|slide|klient_spoergsmaal|manual), tekst, oprettetAt

linnAiKonfiguration/aktiv                 ← admin redigerer system-prompt
  systemPrompt: string                       (overrider DEFAULT_SYSTEM_PROMPT i kode)
  opdateretAt: Timestamp

users/{uid}/linnAiSamtaler/{samtaleId}    ← brugerens chat-samtaler
  titel, beskeder[], oprettetAt, opdateretAt
  beskeder: [{ rolle: 'user'|'assistant', indhold, tidspunkt }]

users/{uid}/linnAiQuotaer/{YYYY-MM-DD}    ← daglig rate-limit-tæller
  antal: number, sidste: number
```

### System-prompt + scope

Default-promptet er defineret i `src/lib/content/linnAi.ts` som `DEFAULT_SYSTEM_PROMPT`. Persona: "Du er Linn AI...". Scope inkluderer:
- **Tilladt:** kost/træning/motivation/livsstil, overgangsalder/hormoner, mental sundhed/stress/søvn
- **Henvises til læge:** medicinske diagnoser, symptomer, medicin
- **Henvises til professionel:** psykiske kriser

Linn kan ALTID redigere promptet via `/app/admin/linn-ai`. Den gemmes i `linnAiKonfiguration/aktiv` og læses dynamisk af worker'en. "Nulstil til standard"-knap ruller tilbage til `DEFAULT_SYSTEM_PROMPT`.

### Kontekst-strategi

For nu: ingen RAG/embeddings. `byggKontekst()` i `linnAi.ts` sorterer dokumenter efter keyword-match (simpelt scoring: antal forekomster af bruger-besked-ord i dokument), tager top dokumenter indtil 100k tegn er fyldt. Hvis videnbasen vokser >100 dokumenter eller >100k tegn pr forespørgsel skal vi implementere ekte vector search (fx Voyage AI embeddings).

### Admin-UI (`/app/admin/linn-ai`)

- **Drag-drop upload:** PDF eller .txt. PDF parses klient-side med `pdfjs-dist` (dynamisk import — kun loades ved upload). Auto-chunker filer >4000 tegn til flere docs
- **Persona/system-prompt:** stor textarea med default pre-udfyldt + "Nulstil til standard"-knap
- **Liste:** indekserede dokumenter sorteret som de gemmes. Slet-knap pr dokument
- **Total-tæller:** antal docs + samlede tegn

### Klient-UI (`/app/moduler/linn-ai`)

- Chat-grænseflade. Adgang gated på `harPremium(userDoc)`. Modulbruger uden premium ser "kræver premium"-besked
- Multi-turn: alle tidligere beskeder i samtalen sendes som `samtaleHistorik` til worker'en
- Persistent: samtaler gemmes i Firestore og kan vendes tilbage til senere
- Auto-navngivning: første spørgsmål → samtale-titel (truncated til 50 tegn). "Ny samtale" → overskrives når første besked sendes
- Disclaimer i bunden: "Linn AI er en AI-assistent inspireret af Linns viden. Ved sygdomme, symptomer eller medicin: kontakt din læge."

### Hvad du SKAL gøre i Cloudflare/Firebase

- **Anthropic API-key:** Sat som `ANTHROPIC_API_KEY` secret i Cloudflare Pages env-vars. Aktiv for både Production OG Preview environments. Re-deploy kræves når key sættes
- **Firestore rules:** 4 nye match-blokke (linnAiVidenbase, linnAiKonfiguration, linnAiSamtaler, linnAiQuotaer). Skal kopieres manuelt til Firebase Console

### Hvad mangler stadig

- **Auto-eksport af besvarede klient-spørgsmål:** Tidligere klient-spørgsmål (`klientspoergsmaal`-collection) der er besvaret af Linn, skal automatisk tilføjes til videnbasen. Pt manuelt via admin-UI
- **Persona-tilpasning:** Default-promptet er generisk. Linn skal selv skrive sin "stemme" ind i `/app/admin/linn-ai`
- **Vector embeddings/RAG:** Hvis videnbasen vokser stort skal vi skifte til ekte similarity search
- **Streaming responses:** Klienten venter på hele svaret før den vises. Streaming ville give bedre UX for lange svar

---

## Abo-vanetracker for basis/premium

### Datamodel

```
aboVaneskabelon/{produktType}             ← admin: kurateret vaneliste (basis/premium)
  vaner: [{ id, label, kategori }]

aboBonusPulje/{produktType}                ← admin: 50 bonus-spørgsmål med 3-svar
  bonus: [{ id, label, kategori, svarmuligheder: [positiv, neutral, negativ] }]

users/{uid}/aboVaneOpsaetning/aktiv        ← brugerens valgte vaner
  valgteVaner: [{ id, label, kilde: 'kurateret'|'egen' }]
  produktType: 'basis'|'premium'
  baselineNulstilletAt?: Timestamp           (ny v21 — bruger kan resette baseline)
  oprettetAt, opdateretAt

users/{uid}/aboVanedage/{YYYY-MM-DD}       ← daglige svar (ingen ændring fra v20)
  checks, bonus: { id, svar: 0|1|2, note? }, checkin, note
```

**Bemærk:** Bonus-svar er nu et number (0=positiv, 1=neutral, 2=negativ) pr **konvention** at svarmuligheder[0] altid er det positive svar — også for negativt formulerede spørgsmål. Det gør at trend-score kan beregnes ensartet på tværs af alle 50 spørgsmål.

### Vigtige beslutninger truffet i v21

- **21-dages lock er FJERNET.** Brugeren kan ændre vaner når som helst (`kanSkifteVaner`, `beregnLockUdloeb` og `LOCK_PERIODE_DAGE` er væk)
- **Bonus-pulje er separate puljer for basis/premium** (ikke fælles)
- **Cyklisk uden slut.** Ingen 21-dages "program" — brugeren tjekker ind dag for dag
- **Brugeren selv vælger 3 (basis) eller op til 7 (premium) vaner.** Hun kan vælge fra kurateret liste ELLER skrive egne tekster
- **Ugentlig 5-slider check-in om søndagen.** Energi/mave/cravings/humør/søvn — bruges til "Din udvikling"-visning
- **Baseline = første komplette check-in.** Hvis brugeren har trænet længe og synes baseline er forældet, kan hun trykke "Nulstil baseline" — så bliver næste check-in den nye baseline

### Klient-UI

- **`/app/moduler/vaner`** brancher: forlobskunde → eksisterende, modulbruger → ny abo-flow
- **Forsiden viser:**
  - Sidste 7 dage som farvet kalender-grid
  - "Vaner opnået"-procent over alle indtastede dage
  - "Din udvikling" — baseline vs seneste 5-slider med delta-pile + linje-graf med periode-vælger (1m/3m/6m/12m/Alt) + "Nulstil baseline"-knap
  - "Velvære-trend" — % positive bonus-svar over sidste 7/30 dage
  - "Tidligere dage" — månedsvist accordion-arkiv (klik en måned åbner mini-grid)
  - "Dine vaner" — liste over valgte + link til `/opsaetning`
- **`/app/moduler/vaner/abo/[dato]`** — daglig indtjekning. Note-felt øverst er fjernet (bonus har sit eget). Auto-redirect til `/app/moduler/vaner` efter gem

### Admin

- **`/app/admin/abo-vaner`** — 4 tabs: vaneliste basis, vaneliste premium, bonus-pulje basis, bonus-pulje premium. CRUD pr vane/bonus

---

## Abo-mikrotræning for basis/premium

### Datamodel

```
aboMikrotraening/{produktType}             ← admin: program-metadata
  navn, beskrivelse, antalDage: 14, udstyr, dagligTid, niveau, aktiv
  genererConfig?: { antalOvelser, sets, workSec, restSec }

aboMikrotraening/{produktType}/days/{dagN} ← 14 TrainingDay docs (genbruger forløbs-typer)

users/{uid}/aboMikrotraeningFremgang/aktiv ← brugerens fremgang
  totalGennemforte: number                    (cumulativ — bruges til rotation)
  feedback: Record<string, Feedback>
  opdateretAt

users/{uid}/aboMikrotraeningTraeninger/{YYYY-MM-DD}  ← historik pr dato (v21)
  dato, programDag (1-14), runde, feedback?, savedAt
```

### Vigtige beslutninger

- **14 dages program der LOOPER.** Aktuel dag = `(totalGennemforte % 14) + 1`. Runde = `floor(totalGennemforte / 14) + 1`
- **Dato-baseret URL** (ikke programdag): `/abo/[dato]` (YYYY-MM-DD), IKKE `/abo/[dag]` (1-14). Linn ønskede det som vanetrackeren
- **ProgramDag bestemmes fra dato:**
  - Hvis trænet før (i historik-collection): brug stored programDag
  - Hvis i dag eller seneste 3 dage uden træning: brug `aktuelAboDag(fremgang)` (næste i rotation)
  - Ellers (langt tilbage uden træning): "Du trænede ikke denne dag"
  - Fremtid: kan ikke åbnes
- **Bagudtræning OK fra de seneste 3 dage.** Glemte du i går, kan du registrere det
- **Ingen tekst om "14 dage der looper".** Klient-UI viser bare datoer
- **Beskrivelse på admin og forside: "Daglig træning"** (ikke "Tre minutters daglig styrketræning i 21 dage")

### Klient-UI

- **`/app/moduler/traening/mikrotraening`** brancher: forlobskunde → eksisterende, modulbruger → ny abo-flow
- **Forside:** 7-dages kalender-grid med ugedag + dato-tal. I dag har terra-outline, klarede dage er grønne. "Start dagens træning"-knap → `/abo/{dagens-dato}`. Plus "Tidligere træninger"-liste (klikbar tilbage til dato)
- **`/abo/[dato]`** — viser dagens øvelser. Hvis trænet før: viser stored program-dag. Hvis aktiv dag: "Start træning"-knap → `/abo/[dato]/spil`
- **`/abo/[dato]/spil`** — fuld timer-baseret afspilning med video, lyd, prep/work/rest/switch-faser. Kopi af forløbs-spil-side med tilpasning til abo-data. Pause-state gemmes med konstant program-id `__abo_basis` / `__abo_premium` (så pauser ikke blandes med forløbs-pauser)

### Admin

- **`/app/admin/abo-traening`** — tabs for basis/premium. **Pre-config-inputs** (antal øvelser, sæt, arbejdstid, hviletid) gemmes med programmet og er default næste gang. **Auto-generér** bruger `genererProgramMedConfig` (parametriseret version af `genererStandardProgram`). Klikbar liste af 14 dage → editor
- **`/app/admin/abo-traening/[produktType]/[dag]`** — fuld dag-editor (genbruger samme mønster som forløbs-editoren)

---

## Admin-klient-mode med 3 typer (basis-app / premium-app / forløb)

### Datamodel

```
userDoc:
  adminKlientForlobId?: string        (eksisterende — nu også scope-id for app-modes)
  adminKlientMode?: 'forlob'|'basisapp'|'premiumapp'  (NY i v21)
```

### Hvordan det virker

- `gemAdminKlientForlob(uid, forlobId)` — sætter mode='forlob' + adminKlientForlobId=forlobId
- `gemAdminKlientApp(uid, 'basisapp'|'premiumapp')` — sætter mode + adminKlientForlobId='__basisapp' eller '__premiumapp'
- `effektivUserDoc()` i `+layout.svelte` override'r baseret på mode:
  - forlob → forlobskunde + basis + Kickstart
  - basisapp → modulbruger + basis + basisabo + activeSubscription
  - premiumapp → modulbruger + premium + premiumabo + activeSubscription
- **Bagudkompatibel:** Hvis kun `adminKlientForlobId` er sat (gamle dokumenter), tolkes som forlob-mode
- **Sandkasse-paths:** Data scopes til `users/{uid}/adminKlient/{scope}/...` hvor scope = forløbsId eller `__basisapp`/`__premiumapp`. Den eksisterende firestore-rule `match /adminKlient/{forlobId}/{document=**}` fanger alle nye scopes via wildcard

### UI

- **TabBar "Klient"-knap → `AdminKlientVaelger.svelte`** — modal med 3 sektioner: Basis-app, Premium-app, Forløb (lister alle forløb fra `hentAlleForlob`)
- **`AdminKlientBanner.svelte`** — viser hvilken mode admin er i ("Basis-app" / "Premium-app" / forlobs-navn) med "Skift tilbage"-knap

---

## Premium-features gated

To moduler er nu kun for premium-brugere:

### Stregkode-scanner

- `/app/moduler/30-30-3` — "Scan stregkode"-knappen er skjult hvis !harPremium
- `aabnScanner()` returnerer tidligt hvis ikke premium (defense in depth)

### Udvidet næring (kh/fedt/kcal)

- `visUdvidet = harPremium(userDoc) && userDoc.visUdvidetNaering === true` overalt
- Profil-siden: hele "Næringsdata"-sektionen er skjult for ikke-premium
- 30-30-3 + Udvikling-tab: viser kun protein/fiber for basis. Hvis premium-bruger har slået toggle på, vises kh/fedt/kcal
- **Edge case:** Hvis premium-bruger downgrades, deaktiveres udvidet næring automatisk (toggle huskes på userDoc men gælder kun ved premium-niveau)

---

## Udvikling-tab udvidet med træning + vaner

Tab-vælgeren (7 dage / 30 dage / Mål) er øverst og styrer alle 3 sektioner globalt.

**3 sektioner for modulbrugere:**
1. **Næring** — protein/fiber (basis), eller udvidet (premium) — eksisterende
2. **Træning** (NY)
   - 7 dage: bjælker 0/1 pr dag (✓ hvis trænet)
   - 7 dage: bonus-graf "træningsdage pr uge" sidste 8 uger (opfyldt ved 5+)
   - 30 dage: linje-graf
   - Mål: aktuel streak, længste streak, X af 30 dage trænet
3. **Vaner** (NY — kun hvis brugeren har valgt vaner)
   - 7 dage: bjælker viser antal "ja" pr dag (mål: alle valgte vaner)
   - 30 dage: linjegraf med mål-streg
   - Mål: streak af dage med ALLE vaner ja

For forløbskunder: kun Næring-sektionen (træning/vaner kommer fra abo-flow).

---

## Andre UI-rettelser i v21

- **Forsiden:** modul-kort (Vaner/Træning/Kost/Bibliotek) viser kun ikon + navn, ingen undertekst. Hardcoded podcast "Når kroppen siger fra" fjernet
- **Bibliotek:** undertitel "FAQ, links og lektioner for dit forløb" fjernet
- **Opskrift-søgning:** matcher nu også ingrediens-navne (både i 30-30-3 og bibliotek). Søger på "havregryn" finder opskrifter med havregryn
- **formatGram:** "0g" → "0 gram" (med mellemrum). Alle protein/fiber/kh/fedt-totaler. Inline-meta-tekst i fødevareliste beholder kompakt "12g"
- **Global iOS auto-zoom-fix:** I `app.css` er alle text-inputs/textarea/select sat til `font-size: max(16px, calc(14px * scale))`. Komponenter med specifik styling (fx Linn AI's chat-input) skal selv sætte `max(16px, …)` for at undgå Svelte's auto-scope-class override
- **Auto-redirect efter gem:** Dagens vaner (abo) går automatisk tilbage til `/app/moduler/vaner` efter gem

---

## Tekniske gotchas at huske

- **`PUBLIC_FIREBASE_API_KEY`** i Cloudflare Workers SKAL importeres fra `$env/static/public` (bundles ind ved build-tid). `$env/dynamic/private` viser den IKKE. Det var bug'en i Linn AI ved første deploy
- **iOS auto-zoom på input fields:** Globale CSS i `app.css` dækker `input[type='text'/'email'/...]`, `textarea` og `select`. Men Svelte's komponent-scoped CSS har højere specificity end den globale regel, så hvis en komponent definerer `.input { font-size: calc(14px * scale) }`, vinder den. Løsningen: brug `max(16px, calc(14px * scale))` direkte i komponenten
- **`pdfjs-dist`** loades via dynamic import i admin-UI så den ikke pakkes med i klient-bundlen for almindelige brugere. WorkerSrc peges på CDN-version
- **Quota counter** for Linn AI øges KUN efter succesfuldt Anthropic-svar. Fejlede kald (timeout, network-fejl) tæller ikke
- **Anthropic API kostprøve:** Claude Sonnet 4.6 koster ca 0,02 kr pr svar med default 3-5k input + 500 output tokens. 20 queries × 100 premium-brugere = ~10 kr/dag

---

## Hvad du skal gøre lige nu

### Påkrævet for Linn AI

1. **Anthropic API-key:** Hvis ikke allerede gjort — opret konto på [console.anthropic.com](https://console.anthropic.com), generer API-key, og sæt som `ANTHROPIC_API_KEY` secret i Cloudflare Pages env-vars (Production + Preview). Re-deploy.
2. **Persona-prompt:** Gå til `/app/admin/linn-ai` og redigér system-promptet til din egen stemme. Test som premium-bruger ved at klikke "Klient" → Premium-app
3. **Upload videnbase:** Drag-drop dine PDFs til samme admin-side. Klient-spørgsmål kommer ikke automatisk endnu

### Påkrævet for nye Firestore-collections (v21)

Kopiér seneste `firestore.rules` til Firebase Console. Nye match-blokke siden v20:
- `aboVaneskabelon/{produktType}` (admin write, all read)
- `aboBonusPulje/{produktType}` (admin write, all read)
- `aboMikrotraening/{produktType}` + days (admin write, all read)
- `linnAiVidenbase/{docId}` (admin write, all read)
- `linnAiKonfiguration/{docId}` (admin write, all read)
- `users/{uid}/aboVaneOpsaetning/{docId}` (kun ejer)
- `users/{uid}/aboVanedage/{dato}` (kun ejer)
- `users/{uid}/aboMikrotraeningFremgang/{docId}` (kun ejer)
- `users/{uid}/aboMikrotraeningTraeninger/{dato}` (kun ejer)
- `users/{uid}/linnAiSamtaler/{samtaleId}` (kun ejer)
- `users/{uid}/linnAiQuotaer/{dato}` (kun ejer)

---

## Næste session — åbne tråde

### Højeste prioritet

1. **Auto-eksport af besvarede klient-spørgsmål til Linn AI-videnbasen.** Klientspoergsmaal med besvaret-status skal automatisk indekseres som videnbase-dokumenter med kilde='klient_spoergsmaal'. Enten via Cloud Function trigger eller manuelt script
2. **Simplero cancel- og refund-triggers** (åbent siden v20). Den vigtigste forretningsmæssige integration der mangler
3. **Persona-prompt for Linn AI.** Linn skal selv skrive sin stemme — vi kan ikke gøre det for hende, men kan tilbyde iterativ test/feedback

### Medium prioritet

4. **RAG/embeddings til Linn AI** når videnbasen vokser >100 dokumenter
5. **Streaming responses** i Linn AI-chat for længere svar
6. **Premium-bruger downgrades.** Hvad sker med deres aboVaneOpsaetning/aboMikrotraeningFremgang når de skifter fra premium til basis? Det er edge case der ikke er addresseret
7. **Mobil-test** alle nye flows — der er en del nye sider (abo-vaner, abo-mikrotræning, Linn AI) som kun er testet superficielt

### Lavere prioritet

8. **Premium-træning udvidet:** Linn kan måske vil have flere træningsformer (yoga, mobilitet) udover styrke
9. **Statistik-eksport:** Brugerne kan måske ville eksportere deres udvikling-data som PDF
10. **Push-notifikationer:** Daglig påmindelse om at indtaste vaner

---

## Filer der er ramt (v21)

**Nye filer:**
- `src/lib/content/aboVaner.ts` + `.test.ts`
- `src/lib/content/aboMikrotraening.ts` + `.test.ts`
- `src/lib/content/linnAi.ts` + `.test.ts`
- `src/lib/firestore/aboVaner.ts`
- `src/lib/firestore/aboMikrotraening.ts`
- `src/lib/firestore/linnAi.ts`
- `src/routes/api/linn-ai/+server.ts`
- `src/routes/app/admin/abo-vaner/+page.svelte`
- `src/routes/app/admin/abo-traening/+page.svelte` + `[produktType]/[dag]/+page.svelte`
- `src/routes/app/admin/linn-ai/+page.svelte`
- `src/routes/app/moduler/vaner/opsaetning/+page.svelte`
- `src/routes/app/moduler/vaner/abo/[dato]/+page.svelte`
- `src/routes/app/moduler/traening/mikrotraening/abo/[dato]/+page.svelte` + `spil/+page.svelte`
- `src/routes/app/moduler/linn-ai/+page.svelte`
- `scripts/seed-test-klienter.ts`
- `scripts/seed-abo-vaneliste.ts`
- `scripts/seed-abo-bonus.ts`

**Ændret væsentligt:**
- `src/lib/types.ts` — adminKlientMode tilføjet
- `src/lib/userDoc.ts` — gemAdminKlientForlob + gemAdminKlientApp + ryAdminKlientMode opdateret
- `src/lib/content/mikrotraening.ts` — genererProgramMedConfig tilføjet
- `src/lib/components/AdminKlientVaelger.svelte` + `AdminKlientBanner.svelte` — 3 modes
- `src/lib/components/TabBar.svelte` — erIKlientMode logik opdateret
- `src/routes/app/+page.svelte` — modul-grid uden meta, Linn AI tilføjet for premium, podcast fjernet
- `src/routes/app/+layout.svelte` — effektivUserDoc med 3 modes
- `src/routes/app/moduler/vaner/+page.svelte` — forløb/abo branch, baseline, trend-score, måneds-arkiv
- `src/routes/app/moduler/traening/+page.svelte` + `mikrotraening/+page.svelte` — abo-flow, datoer
- `src/routes/app/moduler/30-30-3/+page.svelte` — scanner-gating, formatGram
- `src/routes/app/moduler/bibliotek/+page.svelte` — ingrediens-søgning, undertitel fjernet
- `src/routes/app/profil/+page.svelte` — næringsdata-sektion skjult for ikke-premium
- `src/routes/app/udvikling/+page.svelte` — 3 sektioner, global tab-vælger
- `src/app.css` — global iOS-zoom-fix
- `firestore.rules` — 11 nye/ændrede match-blokke
- `src/lib/server/firestoreRest.ts` — hentAlleDocs tilføjet

---

## CLAUDE-instruktion: Læs IKKE handover v17/v18/v19/v20 inden du starter

v21 er den fulde aktuelle status. Tidligere handovers kan læses for historisk kontekst (Simplero-integration, FAQ-migration, vaneprogram-design), men hovedstrukturen er nu helt anderledes:
- Basis/premium-modulbrugere har deres egne flows (vaner, mikrotræning, udvikling)
- Linn AI er på plads som premium-feature
- Admin har 3 klient-modes til at teste alt
