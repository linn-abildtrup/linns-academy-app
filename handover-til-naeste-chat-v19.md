# Handover til næste chat — v19

Status efter session 19 (9. maj 2026, fortsættelse). **51 commits siden v18.** En stor session med mange tilføjelser. Hovedtemaerne:

1. **Brand-logo som system** — Logo.svelte komponent, ægte Playfair-PWA-ikon, integration overalt
2. **Stregkode-scanner med community-fødevarer** og voting-system
3. **Audio Player** — fullscreen lydafspiller med position-persistence og Media Session
4. **Tekstskalering** — 3 niveauer (Normal/Stor/Ekstra stor) der rammer alle 661 font-sizes
5. **Udvidet næringsdata** (kulhydrater/fedt/kalorier) + automatisk mål-wizard
6. **Udvikling-tab** med 7-dage søjler / 30-dage linje / mål-streaks
7. **Spørgsmål per forløb** + flyttet til Beskeder-tab
8. **Klient-mode for admin** — scoped firestore-paths så Linn kan teste appen som klient
9. Plus en stribe UX-fixes, omdøbninger og data-migreringer

**Klient-typologien** er bekræftet (4 typer: app basis, app premium, forløb Kickstart, forløb premium). Maria er Kickstart-forløb. Adgangs-niveauerne defineres senere.

---

## Status quo (Linns POV)

**Live URL:** `https://linns-academy-app.pages.dev`
**Deploy:** Auto fra `main` på Cloudflare Pages, 2-4 min pr commit
**Tests:** 298 tests passerer, 0 type-fejl, 0 svelte-warnings
**Test-brugere uændret:**
- `forlob@linnsacademy.dk` — Maria, forløbskunde, Kickstart maj 2026
- `modul@linnsacademy.dk` — Anne, modulbruger
- `udlobet@linnsacademy.dk` — Sofia, udløbet
- `linnabildtrup00@gmail.com` — Linn, admin

---

## Større features tilføjet i denne session

### 1. Brand-logo som system

Tre lag bygget op:

- **`Logo.svelte`** ny komponent — C8-lockup fra Logo Exploration v5 (Linn's italic + ∞ hairline + Academy sperret). Tre størrelser (`sm`/`md`/`lg`) og to toner (`default`/`light`). Bruges i app-header (sm), login-velkomst (lg), loading-screen (lg) og audio-player-center (sm)
- **PWA-hjemmeskærm-ikon** — ægte Playfair italic "Linn's" + ∞ via `opentype.js` glyph-by-glyph path-konvertering. Frigør os fra librsvg's font-rendering. Viktigt: `@zxing/library` er pinnet til `0.21.3` (Node 22-kompatibel). `opentype.js@^1.3.4` (v2 har en bug med Playfair v40)
- **Header-layout** — logo til venstre, lodret divider, hilsen + dato til højre. Hilsen vises på alle sider, ikke kun forsiden

### 2. Stregkode-scanner og community-fødevarer

Klienter kan tilføje nye fødevarer via stregkode-scanning:

- **Komponent:** `BarcodeScanner.svelte` — fullscreen kamera-overlay med målramme og scan-linje (`@zxing/browser` + `@zxing/library`). Detecter EAN-13/EAN-8/UPC-A/UPC-E
- **Open Food Facts-lookup:** `lib/content/openFoodFacts.ts` — slår EAN op i OFF API, returnerer navn + næringsdata + kategori-forslag (auto-mappet til vores 11 kategorier)
- **`TilfoejFodevareDialog.svelte`** — formular hvor klient bekræfter/redigerer data før gem. Vises også når koden ikke findes i OFF (manuel oprettelse)
- **Community-felter på `Fodevare`:** `kilde='community'`, `barcode`, `addedBy`, `addedByName`, `okBy[]`, `ejBy[]`, `verificeret` (sat når okBy.length ≥ 3). Stregkode bruges som doc-id (`cf_{ean}`) så samme produkt deduplikeres på tværs af brugere
- **Voting:** små ✓/✗-knapper i picker-row på community-fødevarer (skjult for fødevarens egen oprettende bruger). Scanner = automatisk 1. ok-stem
- **Badges i picker:** "✓ Verificeret" (grøn), "Ny" (terra), "⚠" (rød) hvis flere ej end ok
- **Admin-side:** `/app/admin/fodevarer` — liste over alle community-fødevarer med filter (Alle/Pending/Verificeret/Mistænkelig), manuel verificér/slet
- **Knap-placering:** "Scan"-knap direkte på Byg måltid-siden ved siden af "+ Tilføj fødevare" (samme størrelse, terra-gradient med stregkode-ikon + tekst)

**Vigtigt:** Firestore-rules er udvidet til at tillade `create`/`update` på `fodevarer` med `cf_*`-prefix (kun voting-felter må ændres). Skal copy-pastes til Firebase Console.

### 3. Audio Player

`AudioPlayer.svelte` — fullscreen lyd-afspiller i terra-gradient:

- **Center:** stort hvidt cirkel med Logo-lockup, omgivet af 3 koncentriske ringe der pulserer i 3-sek takt under afspilning
- **Kontroller:** −15s / ← (30s tilbage) / Stort hvidt play-pause / → (30s frem) / +15s
- **Progress:** klik-bar bar med tider (current / -remaining)
- **Position-persistence:** localStorage-key `la_audio_pos:{url}`. Gemmes ved pause, hver 3 sek under playback, ved `visibilitychange→hidden`, ved `pagehide`, og ved component-unmount. Ryddes ved end. Genoptager automatisk på `loadedmetadata` hvis < 5 sek fra slutning
- **Media Session API:** title/artist/album metadata + action handlers (play/pause/seekbackward/seekforward) — viser kontroller på iOS lock-screen
- **Bruges i:** Bibliotek (audio-guides + audio-lektioner) og Mit forløb (audio-lektioner)

### 4. Tekstskalering (3 niveauer)

- **CSS-variabel `--fs-scale`** sat på `<html>` via `data-text-scale="large|xlarge"` (1 / 1.15 / 1.30)
- **Alle 661 font-sizes** i appen er konverteret til `font-size: calc(NNpx * var(--fs-scale, 1))` via Perl-regex
- **Profil-vælger:** "Tekststørrelse"-sektion med 3 knapper (Aa Normal / Aa Stor / Aa Ekstra stor) med visuelt skalerede preview-Aa
- **Persistens:** `localStorage.la_text_scale`, læses ved app-startup i root `+layout.svelte` via `initTextScale()`

### 5. Udvidet næringsdata

**Datamodel:**
- `Fodevare` udvidet: `kh?` (kulhydrater), `fedt?`, `kcal?` (alle pr 100g)
- `GemtMaaltid` udvidet: `totalKh?`, `totalFedt?`, `totalKcal?`
- `UserDoc` udvidet: `visUdvidetNaering?: boolean`, `dagligeMaal?: DagligeMaal`, `brugerProfil?: BrugerProfil`
- 1.381 Frida-fødevarer beriget med kh/fedt/kcal via `npm run berig:naering` (script: `scripts/berig-fodevarer-naering.ts`)
- Open Food Facts henter også de tre felter (med fallback for kJ→kcal-konvertering)

**Profil-side:** Toggle "Vis udvidet næringsdata" + daglige mål-felter (Protein/Fiber/Kulhydrater/Fedt/Kalorier) som ren liste (label venstre, input højre)

**30-30-3 + dagbog:** når toggle er ON vises ekstra rad med kh/fedt/kcal totaler

### 6. Beregn-mine-mål-wizard

`BeregnMaalWizard.svelte` — 5-step wizard på profil-siden:
1. Højde (cm) · 2. Vægt (kg) · 3. Alder · 4. Aktivitetsniveau (4 chips) · 5. Menopausal status (3 chips)

**Beregning** (`lib/content/naering.ts`):
- BMR via Mifflin-St Jeor: `(10 × vægt) + (6.25 × højde) − (5 × alder) − 161`
- TDEE = BMR × aktivitetsfaktor (1.2 / 1.375 / 1.55 / 1.725)
- Kalorier = `max(TDEE, 1200)` — sundhedsmæssig minimumsgrænse
- Protein = vægt × 1.5 g/kg (præ) eller × 1.6 g/kg (peri/post)
- Fedt = (kalorier × 0.30) / 9
- Kulhydrater = (kalorier − protein×4 − fedt×9) / 4
- Fiber = 30 g (fast)

**Resultat-side:** 5 mål med Playfair-typografi + tydelig disclaimer om at konsultere læge/kostvejleder. "Brug disse mål"-knap fylder ind i daglige mål + gemmer `brugerProfil` så wizarden er pre-udfyldt næste gang.

### 7. Udvikling-tab

5. ikon i tabbaren (`fire`-ikon, mellem Moduler og Beskeder) — `/app/udvikling`:

- **Metric-vælger** øverst (chips): Protein, Fiber + (kh, fedt, kcal hvis udvidet aktiveret)
- **Tab "7 dage":** søjlediagram med tal-værdi over hver søjle. Sage-grøn når dagens mål er nået, terra ellers. Dage uden data viser intet tal
- **Tab "30 dage":** SVG-linjegraf med stiplet sage-linje for daglig mål
- **Tab "Mål":** 4 statistik-kort — aktuel streak, bedste streak (30 dage), antal dage hvor mål er nået, gennemsnit pr dag med data
- **Streak-logik:** kun dage med mindst ét måltid tæller — dage uden data bryder ikke en streak

### 8. Spørgsmål per forløb + Beskeder-modul

- **`klientspoergsmaal`-dokumenter** udvidet: `forlobId`, `forlobNavn`, `kundeType` ('forlobskunde'/'modulbruger'/'udlobet') — fastfryses ved oprettelse. Migration `npm run migrate:spoergsmaal:forlob` bagudfyldte 5 eksisterende
- **Klient-side:** "Stil et spørgsmål"-flow er flyttet fra forsiden til `/app/beskeder` (5. tab — selve "Beskeder"-rubrikken er nu spørgsmål-modulet). Forsiden's "Har du et spørgsmål?"-sektion er fjernet
- **Admin top-level:** `/app/admin/spoergsmaal` har nu dropdown-filter pr forløb ("Alle / Kickstart maj 2026 (12, 3 ubesvarede) / Modulbrugere / Uden forløb")
- **Admin per-forløb:** `/app/admin/forlob/[id]/beskeder` — liste filtreret til kun spørgsmål for det forløb. Modulrækken på forløbs-detaljesiden har nu Beskeder ved siden af Lektioner/Vaneprogram/Mikrotræning/Bibliotek
- **Beskeder-tab på admin:** peger på `/app/admin/spoergsmaal` (top-level oversigt)

### 9. Klient-mode for admin (3 etaper)

Admin (Linn) kan teste appen som klient via knap i tabbaren:

- **Datamodel:** `userDoc.adminKlientForlobId?: string` — sat når Linn er i klient-mode
- **Scoped paths:** Klient-data lagres på `users/{linn_uid}/adminKlient/{forlobId}/...` så Linns admin-data forbliver intakte. Hver forløb har sin egen sandkasse
- **Helpers:** `lib/utils/adminKlient.ts` har `aktivBrugerBasisPath(uid)` der returnerer scoped path baseret på global state-singleton (`lib/state/adminKlientState.svelte.ts`). Den læses fra firestore-helpers (kost, mikrotraening, vaner) der ikke kan bruge Svelte-context
- **State-override:** `+layout.svelte` wrapper userDoc-context så `state` returneres som `'forlobskunde'` når i klient-mode → klient-modulerne reagerer korrekt
- **Auto-opret userProduct:** Når admin skifter til klient-mode oprettes `users/{uid}/adminKlient/{forlobId}/products/kickstart` automatisk så modulerne har data at læse
- **TabBar-toggle:** I admin-mode vises "Klient"-ikon (åbner forløbs-vælger). I klient-mode skifter ikonet til "Admin" (kører `ryAdminKlientMode` der sletter feltet)
- **Banner:** Når i klient-mode vises rød terra-banner øverst: *"Klient-mode: Kickstart maj 2026 · Skift tilbage"*
- **Adgang:** Kun ADMIN_EMAILS-brugere ser knappen. Almindelige klienter ser intet

**Refactored firestore-helpers:** kost.ts (måltider, favoritter), mikrotraening.ts (userProduct, fremgang, pauses), vaner.ts (vanedage). Spoergsmaal.ts er IKKE scoped (top-level collection — admin-klient-spørgsmål blandes med rigtige; håndteres via `kundeType` hvis nødvendigt senere).

**Firestore-rules:** Ny match-blok tilladelser ejer at læse/skrive `users/{uid}/adminKlient/{forlobId}/{document=**}`. Skal copy-pastes til Firebase Console.

---

## Mindre tilføjelser og fixes

- **Tekst-omdøbninger:** "Guides" → "Links" overalt (klient + admin + forsidens modulkort). Interne keys/CSS-klasser/Firestore-stier holdt uændret
- **"Mine køb"-listen:** Vanetracker fjernet for alle states — kun de relevante moduler vises
- **Loading-bar:** procent-tæller (0-99% over 2 min) i stedet for animeret stribe
- **Re-kategorisering:** 197 fødevarer flyttet fra "andet" til de korrekte kategorier (fisk, mejeri, bær, korn osv.) via `npm run rekategoriser`. Olivenolie-bug i regex undgået
- **Mikrotræning-program-vælger på profil:** klienter kan skifte fra Kickstart-onboarding til andet program via profilen. `flame`/`leaf`/`kettlebell`/`stretch`-ikoner i stedet for emojis (også på onboarding)
- **iOS-zoom-fix:** `.felt-input`/`.search`/`.dato-input` font-size 14 → 16px så Safari ikke zoomer ind ved input-fokus
- **`ignoreUndefinedProperties: true`** sat globalt på Firestore-init (forhindrer "unsupported field value: undefined"-fejl ved optional felter)
- **Edit-flow for dagbog-måltider:** ✎-ikon ved siden af slet-ikonet på hver måltid. Indlæser items i Byg måltid-tab med banner "Redigerer måltid", knap "Opdater" i stedet for "Gem"
- **Gem-måltid-dialog:** scroll-isolation, body-scroll-lock, sticky bottom Gem-knap, portalToBody (samme mønster som IndkoebsListeOverlay)
- **Dagens lektion-kort på forsiden:** højde reduceret ~40%, og hver lektion får sin egen tone (terra/sage/gold rotation) så flere lektioner pr dag er visuelt adskilte
- **Header på alle sider:** logo til venstre, lodret divider, hilsen+dato til højre. Modulnavn står stadig under logoet
- **PDF-eksport (indkøbsliste):** Header tegner ∞-tegnet mellem Linn's og ACADEMY for konsistens med brand-lockup
- **Fællesskab-tab:** Fjernet helt fra TabBar og `/app/faellesskab`-routen slettet
- **`migrate:faq`-script:** Migrerer FAQ-kategorier og items fra vanetracker til `kickstart_maj_2026` (kørt 9. maj — 7 kategorier, 25 spørgsmål)

---

## ⚠️ Vigtigt: Manuel opsætning før alt virker i prod

### 1. Firestore-rules — flere ændringer

`firestore.rules` har tre nye/ændrede match-blokke:

- **`fodevarer/{id}`** — community-fødevarer kan oprettes/voteres (kun `cf_*`-prefix, kun voting-felter må ændres ved update)
- **`users/{uid}/adminKlient/{forlobId}/{document=**}`** — admin-klient-mode data (ejer-only)

Skal copy-pastes til Firebase Console → Firestore → Rules → Publish. **Uden dette virker stregkode-flow og admin-klient-mode ikke.**

### 2. Storage-rules

Uændret siden v18.

### 3. Cloudflare Pages

Auto-deployer fra `main`. Nye dependencies:
- `@zxing/browser@^0.1.5` + `@zxing/library@^0.21.3` (Node 22-kompatibel — VIGTIGT: ikke 0.22+)
- `opentype.js@^1.3.4` (ikke v2 — den crasher på Playfair v40)

### 4. Logo-cache på iPhone PWA

Hvis det gamle LA-cirkel-ikon stadig vises på hjemmeskærmen: **fjern PWA-genvejen og tilføj den igen**. iOS cacher hjemmeskærms-ikonet aggressivt.

---

## Den tekniske tilstand

### Mappestruktur (relevant for denne session)

```
src/
├── lib/
│   ├── components/
│   │   ├── AdminKlientBanner.svelte        ← NY: rød banner ved klient-mode
│   │   ├── AdminKlientVaelger.svelte       ← NY: forløbs-vælger-modal
│   │   ├── AudioPlayer.svelte              ← NY: fullscreen lydafspiller
│   │   ├── BarcodeScanner.svelte           ← NY: kamera-overlay til scan
│   │   ├── BeregnMaalWizard.svelte         ← NY: 5-step næringsmål-wizard
│   │   ├── Header.svelte                   ← logo + hilsen-layout
│   │   ├── Icon.svelte                     ← +'kettlebell', +'stretch', +'barcode'
│   │   ├── Loading.svelte                  ← procent-tæller (0-99 over 2 min)
│   │   ├── Logo.svelte                     ← NY: brand-lockup-komponent
│   │   ├── TabBar.svelte                   ← klient/admin-toggle, dynamic href for admin
│   │   └── TilfoejFodevareDialog.svelte    ← NY: opret community-fødevare
│   ├── content/
│   │   ├── kost.ts                         ← +kh/fedt/kcal felter, ItemBeregning/MaaltidBeregning
│   │   ├── naering.ts                      ← NY: STANDARD_DAGLIGE_MAL, beregnDagligeMaal, labels
│   │   └── openFoodFacts.ts                ← NY: lookupBarcode + kategori-mapping
│   ├── firestore/
│   │   ├── kost.ts                         ← scoped paths via aktivBrugerBasisPath, +community-helpers
│   │   ├── mikrotraening.ts                ← scoped paths
│   │   ├── spoergsmaal.ts                  ← +forlobId/forlobNavn/kundeType-felter
│   │   └── vaner.ts                        ← scoped paths
│   ├── state/
│   │   └── adminKlientState.svelte.ts      ← NY: global singleton for klient-mode
│   ├── utils/
│   │   ├── adminKlient.ts                  ← NY: brugerBasisPath / aktivBrugerBasisPath
│   │   └── textScale.ts                    ← NY: tekstskalering med localStorage
│   ├── firebase.ts                         ← +ignoreUndefinedProperties
│   ├── types.ts                            ← +DagligeMaal, BrugerProfil, AdminKlientForlobId
│   └── userDoc.ts                          ← +gemNaeringsindstillinger, +gemBrugerProfilOgMaal,
│                                              +gemAdminKlientMode (auto-opretter userProduct), +ryAdminKlientMode
└── routes/
    ├── +layout.svelte                      ← +initTextScale ved app-start
    ├── login/+page.svelte                  ← Logo lg i welcome
    └── app/
        ├── +layout.svelte                  ← AdminKlientBanner + state-override + sync af klient-mode-singleton
        ├── +page.svelte                    ← spørgsmål-section fjernet, dagens lektion-kort med tone-varianter
        ├── admin/
        │   ├── +page.svelte                ← +Fodevarer-modul
        │   ├── fodevarer/+page.svelte      ← NY: community-fødevarer admin
        │   ├── spoergsmaal/+page.svelte    ← +forløbs-dropdown-filter
        │   └── forlob/[id]/
        │       ├── +page.svelte            ← +Beskeder-modulrække
        │       └── beskeder/+page.svelte   ← NY: spørgsmål filtreret pr forløb
        ├── beskeder/+page.svelte           ← KONVERTERET: nu spørgsmål-modulet
        ├── moduler/30-30-3/+page.svelte    ← Scan-knap, edit-flow, udvidet næring conditional
        ├── profil/+page.svelte             ← +tekstskalering, +udvidet næring-toggle, +mål-wizard,
        │                                      +mikrotræning-program-vælger
        ├── spoergsmaal/+page.svelte        ← REDIRECT til /app/beskeder
        └── udvikling/+page.svelte          ← NY: 7-dage / 30-dage / mål-streaks

scripts/
├── berig-fodevarer-naering.ts              ← NY: bagudfyld kh/fedt/kcal på Frida-items
├── fonts/PlayfairDisplay-Italic.ttf        ← NY: embedded font til PWA-ikon-script
├── generer-pwa-ikoner.ts                   ← REWRITE: opentype.js path-konvertering
├── migrate-faq.ts                          ← FAQ-import fra vanetracker
├── migrate-spoergsmaal-forlob.ts           ← NY: bagudfyld forlobId
├── re-kategoriser-fodevarer.ts             ← NY: regelbaseret omkategorisering
└── seed-frida.ts                           ← +kh/fedt/kcal-kolonner

firestore.rules                             ← +adminKlient + community-fødevarer
```

### Firestore-struktur (nye stier)

- `fodevarer/cf_{ean}` — community-fødevarer (samme collection som Frida, men med `kilde: 'community'`)
- `users/{uid}/adminKlient/{forlobId}/products/{productId}` — admin-klient-mode userProduct
- `users/{uid}/adminKlient/{forlobId}/maaltider/{id}` — admin-klient-mode måltider
- `users/{uid}/adminKlient/{forlobId}/favoritmaaltider/{id}`
- `users/{uid}/adminKlient/{forlobId}/products/{productId}/vanedage/{dagId}`
- `users/{uid}/adminKlient/{forlobId}/pauses/{pauseId}`

### Vigtige typer-udvidelser

```ts
// UserDoc
visUdvidetNaering?: boolean;
dagligeMaal?: DagligeMaal;
brugerProfil?: BrugerProfil;
adminKlientForlobId?: string;

// Fodevare
kh?: number; fedt?: number; kcal?: number;
barcode?: string; addedBy?: string; addedByName?: string;
okBy?: string[]; ejBy?: string[]; verificeret?: boolean;

// GemtMaaltid
totalKh?: number; totalFedt?: number; totalKcal?: number;

// KlientSpoergsmaal
forlobId?: string; forlobNavn?: string;
kundeType?: 'forlobskunde' | 'modulbruger' | 'udlobet';
```

### Tests

**298 tests passerer** (var 301 før — 3 Vanetracker-relaterede tests fjernet i forbindelse med "Mine køb"-oprydning). 0 type-fejl, 0 svelte-warnings.

### Kommandoer

```bash
npm run dev                                             # dev-server
npm test                                                # 298 tests
npm run build                                           # production build (Cloudflare-adapter)
npm run inspect:program                                 # liste træningsprogrammer
npm run migrate:lektioner                               # vanetracker → forløbs-lektioner
npm run migrate:faq                                     # vanetracker → FAQ
npm run seed:frida                                      # initial Frida-import (1.381 items)

# Engangsscripts (kørt i denne session — kør igen ved behov)
npx tsx scripts/berig-fodevarer-naering.ts --skriv      # tilføj kh/fedt/kcal til Frida-items
npx tsx scripts/re-kategoriser-fodevarer.ts --skriv     # ryd op i 'andet'-kategorien
npx tsx scripts/migrate-spoergsmaal-forlob.ts --skriv   # bagudfyld forlobId på spørgsmål
npx tsx scripts/generer-pwa-ikoner.ts                   # regenerer PWA-ikoner
```

### Hosting + URL'er

- **Live URL:** https://linns-academy-app.pages.dev
- **Production branch:** `main` (auto-deploy via Cloudflare Pages, 2-4 min)
- **Custom domain (planlagt, ikke koblet):** `app2.linnsacademy.dk` — er hos Simply.com med DNS hos Cloudflare
- **Gammel app fortsætter:** `app.linnsacademy.dk` (vanetracker) indtil migration er færdig

---

## Klient-typologien (vigtigt — bekræftet i denne session)

Linns Academy har **fire klient-typer**:

| Type | Forløb | App-niveau |
|---|---|---|
| App basis | Ingen | Basisapp |
| App premium | Ingen | Premiumapp |
| Forløb Kickstart | Kickstart | Basisapp + Kickstart-indhold |
| Forløb premium | Premium-forløb (navn ikke fastlagt) | Premiumapp + premium-forløb-indhold |

**Reglen:** Forløb arver app-niveauet. Maria er Kickstart + basisapp. Det er **ikke** kodet endnu — den nuværende `state: 'forlobskunde' | 'modulbruger' | 'udlobet'` er for simpel og skal udvides senere når Linn definerer hvad hver type ser præcist.

**Det er gemt i memory** under `project_kunde_typologi.md`.

---

## Designprincipper og mønstre der blev etableret

### Brand-identitet
- C8-lockup (Linn's italic + ∞ hairline + Academy sperret) er primær, defineret i `Logo.svelte`
- Farver: `--terra` #B87B6E (primær), `--sage` #6F9E7E (succes/grøn), `--gold` #B8956A (premium-aroma)
- Playfair Italic skal loades via Google Fonts-link i app.html (else falder browseren tilbage til Times)
- PWA-ikon kræver embedded glyph-paths via opentype.js — librsvg understøtter ikke `@font-face` data:URLs

### iOS-quirks der skal håndteres
1. **Auto-zoom ved input-fokus:** Inputs skal have `font-size ≥ 16px`
2. **Tastatur skubber viewport:** Modal-bag bruger `align-items: flex-end` + `max-height: 92dvh` (ikke 100vh)
3. **PWA-ikon-cache:** Fjern og tilføj genvej for at se nye ikoner
4. **Audio-baggrund:** Media Session API + `pagehide`-listener gemmer position før app dræbes
5. **Stregkode-scanner:** `@zxing/browser` virker i iOS Safari, kræver kamera-tilladelse

### Firestore-mønstre
- **`ignoreUndefinedProperties: true`** globalt — undgår "unsupported field value"-fejl
- **Scoped paths** via helper-funktion (`aktivBrugerBasisPath`) når sub-collections deles mellem admin-klient-mode og normal mode
- **Stregkode som doc-id** for community-fødevarer (`cf_{ean}`) sikrer dedup
- **Top-level rules** match på dokument-id-prefix (`cf_*`) for at differentiere skrivnings-tilladelser

### UI-mønstre
- **Bottom-sheet-modal:** `position: fixed; inset: 0; align-items: flex-end` + indre `.modal` med `max-height: 92dvh; overflow: hidden` + indre `.modal-body` med `flex: 1; min-height: 0; overflow-y: auto`. Sticky footer udenfor body
- **Body-scroll-lock:** `document.body.style.overflow = 'hidden'` ved modal-åbning, restored ved unmount
- **`portalToBody`-action** flytter elementer til document.body for at undgå app-shell stacking-context (især `.app-shell` har `overflow: hidden`)
- **Procent-loading:** lineær 0→99% over 2 min, fjernes når data ankommer (vi når aldrig 100% selv)

---

## Åbne tråde / kendte mangler

### Skal gøres af Linn
1. **Custom domain `app2.linnsacademy.dk`** — Cloudflare Pages → Custom domains → Add. Plus tilføj domænet til Firebase Auth Authorized domains og Vimeo embed-whitelist
2. **Upload resten af lektion-videoer til Vimeo** og opdater URL'erne i admin
3. **Lektioner for dag 15-21** i Kickstart — eksisterer ikke i ref-app, skal udfyldes manuelt
4. **Beskrivelser, varighed, format** på de migrerede lektioner — alle har titel + URL men beskrivelse er tom
5. **Guides for Kickstart maj 2026** — strukturen er klar men intet indhold endnu (FAQ er migreret)
6. **Rigtigt logo** til PWA-ikon — pt **NY** Linn's + ∞ symbol via opentype.js, men kan justeres
7. **Ryd top-level `trainingPrograms/`** — efter mindst en uge på production hvor alt virker
8. **Definér klient-typologi-adgang** — hvad ser app basis vs premium? Hvad ser Kickstart vs premium-forløb?
9. **Slet `scripts/vanetracker-key.json`** når migration er færdig (gitignored men ligger lokalt)

### Klient-side polering
10. **Dagbog mangler edit-flow på 30-30-3 ingredient-niveau** — selve måltids-edit virker (set i denne session), men single-item-edit ikke
11. **3 ingredienser kan ikke auto-matches** — jalapeño, flankesteak, sødkartoffel
12. **Modulbrugere kan stadig se Kickstart-moduler** undtagen Bibliotek (låst). De andre forløbs-specifikke moduler mangler `state==='forlobskunde'`-tjek
13. **Profilside viser ikke hvilket forløb brugeren er på** (åben fra v15)
14. **Lås fremtidige dage på direkte URL** i `mikrotraening/[dag]` — kun grid'et er låst
15. **Wake Lock-knappen** vises selv på browsere uden API-support
16. **B1 modul-grid på forsiden** ignorerer hvad brugeren har købt

### Andre features (lavere prioritet)
17. **`/app/moduler/traening/+page.svelte`** viser kun Mikrotræning hardkodet
18. **Live Q&A** — bedre kalender-integration kunne overvejes
19. **Adminliste over modul-kunder** — vi har ingen UI for at se hvem der har købt premium-app
20. **Rigtigt købsregister** (lovet i denne session) — datamodel udvides senere

---

## Til næste Claude-instans

1. **Linn taler dansk** — svar på dansk, ingen em-dashes/semikolons/lange tankestreger
2. **Hele filer, ikke linje-for-linje edits** ved større ændringer
3. **Små commits ofte** — denne session brugte etape-tilgang for store features (Foundation → Refactor → State-override). Gentag det
4. **Tjek altid `npx svelte-check` og `npm test`** efter ændringer (298 tests + 0 fejl-baseline)
5. **CSS-variabler** følger `--ff-d`, `--text2`, `--bg2`-konventionen
6. **Alle font-sizes** skal nu skrives som `font-size: calc(NNpx * var(--fs-scale, 1))` så tekstskalering virker. Ny CSS uden calc bryder skaleringen
7. **Bo håndterer terminalen** — antag intet om udvikler-kontekst. Linn håndterer Vimeo, Firebase Console, Cloudflare Pages-UI selv
8. **Reference-app i `reference/index.html`** — alle features kan slås op
9. **Firestore-rules + storage.rules** copy-pastes manuelt til Firebase Console når ændret. Denne session har 2 nye match-blokke
10. **Forløbs-modellen er førsteklasses** — alt forløbs-specifikt indhold ligger under `forlob/{id}/...` og kopieres automatisk via `kopierForlobIndhold`
11. **Forløbs-konvention er 0-baseret** — startDato = dag 0 = baseline. Dag 1-antalDage = programdage
12. **TabBar har Admin-tab kun for admin-brugere** (matcher ADMIN_EMAILS i src/lib/admin.ts)
13. **Klient-typologien har 4 typer** — basisapp/premium app, ingen forløb/Kickstart-forløb/premium-forløb. Forløb arver app-niveau. Maria er Kickstart-klient (basisapp)
14. **Admin-klient-mode bruger scoped paths** — alle nye firestore-helpers der gemmer per-bruger data SKAL bruge `aktivBrugerBasisPath(uid)` så de respekterer klient-mode
15. **iOS Safari video-quirks** — se v18 (`{#key}` + retry-loop + pause-event-resume)
16. **Audio-quirks på iOS** — Media Session API + position-persistence i localStorage med visibility-change events
17. **Open Food Facts** — gratis åben database for stregkode-lookup. Endpoint `world.openfoodfacts.org/api/v2/product/{ean}.json`. Dækker dansk-mærkede produkter rimeligt godt
18. **Mifflin-St Jeor-formlen** er industristandard for kvinder. Cap kalorier ved 1.200 (sundhedsmæssig grænse). Protein 1.5-1.6 g/kg afhængigt af menopaus-status

---

## Næste session — første handling

Spørg Linn hvilken af disse hun vil tage først:

1. **Definér klient-typologi-adgang** (4 typer × moduler) — det er løse tråde i appen. Vi har bekræftet de 4 typer men ikke kodet hvad hver ser
2. **Test admin-klient-mode i dybden** — kør hele klient-flowet (forside → moduler → 30-30-3 → vaner → mikrotræning) som klient på Kickstart maj 2026 og noter eventuelle bugs
3. **Indhold for dag 15-21** i Kickstart-forløbet (lektioner + vaner)
4. **Custom domain `app2.linnsacademy.dk`** opsætning hos Cloudflare Pages (kræver Linn manuelt)
5. **Rigtigt købsregister** — datamodel + admin-flow til at registrere/redigere kunders køb
6. **Adgangskontrol-fix** — tilføj `state==='forlobskunde'`-tjek på de øvrige forløbs-specifikke moduler så modulbrugere ikke kan tilgå dem
7. **Lås fremtidige dage på direkte URL** — `mikrotraening/[dag]/+page.svelte` skal selv tjekke kalender-dag

Held og lykke.
