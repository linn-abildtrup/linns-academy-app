# Handover til næste chat — v17

Status efter session 18 (8. maj 2026). **Vimeo opsat, Cloudflare Pages live på `linns-academy-app.pages.dev`, PWA-mode aktiveret, indkøbsliste-funktion bygget, klientspørgsmål-flow med svar bygget.** Appen kan nu testes "rigtigt" på iPhone som standalone-app.

**Næste skridt:** Linn vil tilføje custom domain `app2.linnsacademy.dk` (besluttet, men ikke koblet på endnu), uploade resten af lektion-videoer til Vimeo, og udfylde lektioner for dag 15-21 i Kickstart-forløbet.

---

## TL;DR — hvad der blev bygget

- **Vimeo Standard-abonnement** oprettet med domain-låsning, "Hide from Vimeo"-privacy og brand-preset (Linns Academy farver, Vimeo-logo skjult). Test-video uploadet og verificeret afspilning på den nye app.
- **Cloudflare Pages** auto-deploy fra GitHub `main` til `linns-academy-app.pages.dev`. SvelteKit-adapter skiftet til `@sveltejs/adapter-cloudflare`. Alle 6 `PUBLIC_FIREBASE_*`-env-vars sat.
- **PWA-mode aktiveret** — manifest.webmanifest, apple-meta-tags, safe-area-padding på Header og TabBar. Når brugeren føjer siden til hjemmeskærmen kører den fullscreen uden Safari-chrome. Placeholder LA-cirkel-logo (terra) som ikon.
- **Global Header** "Linn's Academy" + dynamisk modul-navn på alle app-sider via `src/lib/components/Header.svelte`.
- **Indkøbsliste-funktion** på 30-30-3 opskrifter-tab: vælg flere opskrifter med portionsantal, auto-genereret indkøbsliste grupperet i butikssektioner, manuel-tilføjelser, tjek af, tekst- og PDF-eksport (branded design).
- **Klientspørgsmål-flow:** klienter på forløb kan stille spørgsmål via `/app/spoergsmaal`. Admin svarer på `/app/admin/spoergsmaal` med tekstfelt pr spørgsmål. Svar vises tilbage til klienten på forsiden ("Nyt svar fra Linn"-card mellem dagens lektion og dagens små skridt) plus i "Mine spørgsmål"-listen.
- **Coaching-knap** på alle forsider (forløbskunde/modulbruger/udløbet) → linker til `https://linn.simplero.com/coaching-1-1-45-min`.
- **Loading-komponent** (animeret terra-progress-bar) erstatter statisk "Henter data..."-tekst overalt.
- **Mindre fixes:** baseline (dag 0) øverst i admin-liste, baseline-skydere defaulter til 5 ved gem, close-overlay går tilbage til forrige side, indkøbsliste-overlay fixed scroll/safe-area/z-index på mobil.
- **0 type-fejl, 298 tests passerer** (var 274 før — 24 nye for indkøbsliste-helpers).

---

## ⚠️ Vigtigt: Manuel opsætning der ikke er automatisk

### 1. Firestore-rules

`firestore.rules` har ny regel for `klientspoergsmaal` (klienter kan oprette + læse egne, admin kan læse alle og opdatere). Skal copy-pastes til Firebase Console → Firestore → Rules → Publish.

### 2. Cloudflare Pages — custom domain

Pages-projektet er sat op og auto-deployer fra `main`. Custom domain `app2.linnsacademy.dk` er **endnu ikke** koblet på. Linn har valgt subdomænet men afventer. Når det skal aktiveres:
- Cloudflare Pages → linns-academy-app → Custom domains → Add `app2.linnsacademy.dk`
- Tilføj `app2.linnsacademy.dk` til Firebase Auth Authorized domains
- Tilføj `app2.linnsacademy.dk` til Vimeo embed-whitelist (pr video eller via "Manage defaults")

### 3. Vimeo

Test-videoen der bruges i Kickstart har `linnsacademy.dk`, `localhost:3` og `linns-academy-app.pages.dev` på sin specific-domains-liste. **Resten af lektion-videoerne skal også opdateres** når de uploades — eller Linn kan sætte default-domænerne via "Manage defaults"-linket i Share-panelets Privacy-fane.

---

## Hvad der er bygget i denne session

### Vimeo + Cloudflare Pages — etape A

Linn oprettede Vimeo Standard-abonnement og fik sat domain-låsning op via Share → Embed → "Where can this be embedded?" → Specific domains. Vi ramte to mindre snublestene:
- Anvendte først forkert privacy-side (account-privacy i stedet for video-privacy) — afklaret via Vimeos help-doc om "domain-level privacy"
- "Manage defaults"-linket i Share-panelet (Privacy-fane) lader Linn sætte default-domæner for fremtidige uploads

Cloudflare Pages-projekt eksisterede allerede (oprettet tidligere fra adapter-auto). Vi skiftede SvelteKit-adapter til `@sveltejs/adapter-cloudflare`, merged 104 commits fra `etape-9-mikrotraening` til `main` (fast-forward), pushede, og buildet kørte automatisk. Live på `linns-academy-app.pages.dev`.

### Global Header — etape B

`src/lib/components/Header.svelte` viser "Linn's" italic terra + "ACADEMY" uppercase + et lille modul-navn under (fx "MIT FORLØB", "BIBLIOTEK") på alle app-sider via `app/+layout.svelte`. Klik på brandet går til forsiden. Tom højre-side (Linn ville ikke have notifikations-ikon der). Modul-navn-mapping ligger som en simpel switch på pathname i Header-komponenten.

Eksisterende duplikerede brand-overskrifter og bell-buttons fjernet fra +page.svelte for alle tre forside-varianter (A1/B1/C1).

### PWA-mode — etape C

`static/manifest.webmanifest` med name, short_name, theme-color (terra), background-color (creme), display: standalone, ikoner. `apple-mobile-web-app-capable=yes`, `apple-touch-icon`, viewport-fit=cover.

`scripts/generer-pwa-ikoner.ts` (sharp-baseret) renderer en SVG-cirkel med "LA"-tekst til PNG i størrelser 180/192/512/1024 plus en SVG-fallback. Placeholder indtil Linn har et rigtigt logo — så er det blot at erstatte SVG-template'en og kør `npx tsx scripts/generer-pwa-ikoner.ts` igen.

Header og TabBar fik `env(safe-area-inset-*)` så indhold ikke skjules bag iPhone notch eller home-indicator i fullscreen-mode.

### Indkøbsliste — etape D

Største feature i sessionen — port af ref-appens "vælg opskrifter → indkøbsliste + PDF"-flow til 30-30-3 opskrifter-tab.

**Pure logic** i `src/lib/content/indkoebsliste.ts`:
- `byggIndkoebsliste(opskrifter, valgte, tidligereManuelle)` — summerer identiske ingredienser (samme navn+enhed)
- `grupperIndkoebsliste(items)` — fordeler i seks butikssektioner (grønt, kød, mejeri, kolonial, frost, andet)
- `gaetGruppe(navn)` — regelbaseret, porteret 1:1 fra ref-appens `laPdfGuessGroup` (inkl. specialhåndtering af forarbejdede grøntsagsprodukter som "tomatpuré" der hører i kolonial)
- `tilfoejManuel`, `teksteksport`, `skaler`, `formaterMaengde`
- 24 tests dækker skalering, summering, gruppering, manuel-håndtering

**PDF-generator** i `src/lib/content/indkoebsliste-pdf.ts` (jspdf-baseret) producerer en branded A4-PDF: forside ("Min uge i køkkenet"), grupperet indkøbsliste med checkboxes, og hver valgt opskrift med skalerede ingredienser + fremgangsmåde. Terra-accenter, italic Playfair-look (times-italic), fact-bokse, sidefod med sidenummer.

**UI-komponent** `src/lib/components/IndkoebsListeOverlay.svelte` — bottom-sheet overlay med listen, manuel-tilføjelse, eksport-knapper. Lukket bagved samtidig som side-scroll låses (iOS). Teleport via Svelte-action til `document.body` for at escape stacking-context-issues på iPhone.

**Multi-select** på 30-30-3 opskrifter-tab: terra +/✓-knap øverst på hvert kort, portions-justering ved valgt opskrift, sticky "Generer indkøbsliste"-knap nederst med antal-badge plus nulstil-knap. En subtil hint-boks øverst på fanen forklarer hvad +-ikonet betyder.

### Klientspørgsmål-flow — etape E

Klienter på forløb kan stille spørgsmål til Linn via `/app/spoergsmaal` (link fra forsidens "Har du et spørgsmål?"-card). Admin har egen side `/app/admin/spoergsmaal` med filter (alle/ny/læst/besvaret/brugt), CSV-eksport, og **svar-felt pr spørgsmål** (Linn kan skrive direkte i admin-fladen, status sættes automatisk til 'besvaret').

Datamodel: `klientspoergsmaal/{id}` med `{ uid, email, spoergsmaal, status, oprettet, svar?, besvaretAt? }`.

Klienten ser sine egne spørgsmål med Linns svar i en "Mine spørgsmål"-sektion under formularen på `/app/spoergsmaal`. Forsiden viser et "Nyt svar fra Linn"-card mellem dagens lektion og dagens små skridt når der er ubeskrivede svar (besvaretAt > userDoc.senestSpoergsmaalLaestAt). Cardet og prikken på spq-cardet forsvinder live via onSnapshot på userDoc når klienten besøger `/app/spoergsmaal` (som opdaterer `senestSpoergsmaalLaestAt`).

Composite index undgået ved at fjerne `orderBy` fra `where('uid', '==', uid)`-query'en og sortere klient-side i stedet — billigt nok eftersom hver klient har få spørgsmål.

### Coaching — etape F

Subtil "Personlig coaching"-sektion på alle tre forside-varianter. Terra-knap med 🎯-emoji-ikon, titel + sub, pil-knap til højre. Linker til `https://linn.simplero.com/coaching-1-1-45-min` i ny fane. Samme URL og design-mønster som ref-appen.

### Loading-komponent — etape G

`src/lib/components/Loading.svelte` — animeret terra-progress-bar der kører frem og tilbage kontinuerligt under en italic tekst. Kompakt-variant (kortere bar, mindre padding) til mindre områder. `prefers-reduced-motion` respekteret.

Erstatter statisk `<div class="status-besked">Henter X...</div>` i: layout, forside, mit forløb, 30-30-3 (hovedside og dagbog), opskrift-detaljer, vaner (oversigt og dagsside), bibliotek (FAQ og guides), mikrotræning (program/dag/spil/onboarding).

Procentvis progress fravalgt: vi kender ikke total-tiden på forhånd så en falsk procent ville være misvisende.

### Mindre fejlrettelser

- **Baseline (dag 0) som første række** i admin lektioner-liste, ikke et separat link nederst
- **Baseline-skydere defaulter til 5** ved gem hvis klienten ikke rykkede dem — nogle klienter efterlod ellers ingen måling så sammenligning med dag 21 var umulig
- **Close-overlay går tilbage til forrige side** hvis lektionen blev åbnet via query-param (typisk fra forsidens dagens-lektion-card). Klik direkte på Mit forløb-siden lukker stadig bare overlay'et som før
- **Indkøbsliste-overlay scrolling fix:** 92vh → 92dvh, safe-area-inset-bottom på body, scroll-lock på underlying side, teleport til body for at escape stacking context

---

## Den tekniske tilstand

### Mappestruktur (relevant for denne session)

```
src/
├── lib/
│   ├── components/
│   │   ├── Header.svelte                          ← NY: global app-header
│   │   ├── Loading.svelte                         ← NY: animeret progress-bar
│   │   ├── IndkoebsListeOverlay.svelte            ← NY: bottom-sheet med liste
│   │   └── (eksisterende)
│   ├── content/
│   │   ├── indkoebsliste.ts                       ← NY: pure helpers + types
│   │   ├── indkoebsliste.test.ts                  ← NY: 24 tests
│   │   ├── indkoebsliste-pdf.ts                   ← NY: branded PDF-generator
│   │   └── (eksisterende)
│   ├── firestore/
│   │   └── spoergsmaal.ts                         ← NY: CRUD + listener-helpers
│   ├── userDoc.ts                                 ← +lytTilUserDoc (onSnapshot)
│   └── types.ts                                   ← +senestSpoergsmaalLaestAt
└── routes/app/
    ├── +layout.svelte                             ← Header + Loading + onSnapshot på userDoc
    ├── +page.svelte                               ← coaching, spq, nyt-svar-card
    ├── spoergsmaal/+page.svelte                   ← NY: form + Mine spørgsmål
    ├── admin/+page.svelte                         ← +link til Spørgsmål
    ├── admin/spoergsmaal/+page.svelte             ← NY: liste + filter + svar + CSV
    ├── admin/forlob/[id]/lektioner/+page.svelte   ← baseline øverst
    ├── moduler/forlob/+page.svelte                ← close-overlay history.back()
    ├── moduler/30-30-3/+page.svelte               ← multi-select + indkøbsliste
    └── moduler/vaner/[dag]/+page.svelte           ← baseline default 5

scripts/
└── generer-pwa-ikoner.ts                          ← NY: sharp → PNG i 4 størrelser

static/
├── manifest.webmanifest                           ← NY: PWA-manifest
├── apple-touch-icon.png                           ← NY: 180×180
├── icon-192.png, icon-512.png, icon-1024.png      ← NY
└── icon.svg                                       ← NY: vector fallback

src/app.html                                       ← apple-meta-tags + manifest-link
firestore.rules                                    ← +klientspoergsmaal-regel
svelte.config.js                                   ← adapter-cloudflare
```

### Firestore-struktur (nye stier)

- `klientspoergsmaal/{id}` — { uid, email, spoergsmaal, status, oprettet, svar?, besvaretAt? }
- `users/{uid}.senestSpoergsmaalLaestAt` — Unix ms; bruges til at vise notifikations-prik på forsiden

### Tests

**298 tests passerer** (var 274 før — 24 nye for indkøbsliste-helpers). 0 type-fejl, 0 svelte-check-warnings.

### Kommandoer

```bash
npm run dev                                # start dev-server (også via host=0 for iPhone på samme WiFi)
npm test                                   # 298 tests
npm run build                              # production build (verificerer Cloudflare-adapter)
npx tsx scripts/generer-pwa-ikoner.ts      # regenér PWA-ikoner fra SVG-template
```

### Test-brugere (uændret)

- `forlob@linnsacademy.dk` (Maria) — forløbskunde, knyttet til kickstart_maj_2026
- `modul@linnsacademy.dk` (Anne) — modulbruger
- `udlobet@linnsacademy.dk` (Sofia) — udløbet
- `linnabildtrup00@gmail.com` (Linn, admin)

### Hosting + URL'er

- **Live URL:** https://linns-academy-app.pages.dev
- **Production branch:** `main` (auto-deploy via Cloudflare Pages)
- **Custom domain (planlagt):** `app2.linnsacademy.dk` — venter på Bo
- **Gammel app fortsætter:** `app.linnsacademy.dk` (vanetracker) indtil migration er færdig

---

## Åbne tråde / kendte mangler

### Skal gøres af Linn / Bo

1. **Custom domain `app2.linnsacademy.dk`** — Cloudflare Pages → Custom domains → Add. Plus tilføj domænet til Firebase Auth Authorized domains og Vimeo embed-whitelist
2. **Upload resten af lektion-videoer til Vimeo** og opdater URL'erne i admin (`/app/admin/forlob/kickstart_maj_2026/lektioner/{N}`) — de migrerede peger pt på YouTube
3. **Lektioner for dag 15-21** — eksisterer ikke i ref-app, skal udfyldes manuelt
4. **Beskrivelser, varighed, format** på de migrerede lektioner — alle har titel + URL men beskrivelse er tom
5. **FAQ og guides** for Kickstart maj 2026 — strukturen er klar men intet indhold endnu
6. **Rigtigt logo** til PWA-ikon — pt placeholder LA-cirkel. Når klar, erstat SVG i `scripts/generer-pwa-ikoner.ts` og kør scriptet

### Klient-side polering (åbne fra v15-v16)

7. **Dagbog mangler edit-flow** (30-30-3) — slet virker, edit ikke
8. **Dagbog viser kun én dag ad gangen** — uge/måned-visning kunne tilføjes
9. **3 ingredienser kan ikke auto-matches** — jalapeño, flankesteak, sødkartoffel
10. **Modulbrugere kan stadig se Kickstart-moduler** undtagen Bibliotek (nu låst). De andre forløbs-specifikke moduler mangler `state==='forlobskunde'`-tjek
11. **Mikrotræning er ikke bundet til `forlobId`** — bruger stadig `userProduct.programValg.mikrotraening` direkte
12. **Profilside viser ikke hvilket forløb brugeren er på**

### Andre moduler / features

13. **`/app/moduler/traening/+page.svelte`** viser kun Mikrotræning hardkodet
14. **Live Q&A** — ref-app havde lessons med Zoom-link, fungerer som almindeligt link i nuværende model. Bedre kalender-integration kunne overvejes
15. **`/app/beskeder` er placeholder** — mulig kommende features: chat med Linn, broadcast-beskeder

### Kosmetiske

16. **B1 modul-grid på forsiden** ignorerer hvad brugeren har købt
17. **Wake Lock-knappen** vises selv på browsere uden API-support
18. **`scripts/vanetracker-key.json`** bør slettes når Linn er færdig med migration
19. **Strip-chips kunne være kortere på mobil** — pt 52px × 22 chips = 1144px scroll

---

## Commits fra denne session (26 commits)

```
6f4f0e7 Vis animeret progress-bar i stedet for statisk 'Henter data...'
2aa944e Flyt 'Nyt svar fra Linn' op mellem dagens lektion og dagens små skridt
e6b2203 Lyt på userDoc-ændringer så 'Nyt svar'-cardet forsvinder live
33d65ac Fjern orderBy fra mine-spørgsmål-query (drop composite index)
f77633e Vis nye spørgsmål-svar fra Linn på forsiden
992f445 Tilføj svar-flow på klientspørgsmål
1ed4f34 Tilføj admin-side til håndtering af klientspørgsmål
b36057a Tilføj coaching og spørgsmål-cards på forsiden
62a9d6e Tilføj /app/spoergsmaal-side til at stille spørgsmål til Linn
8f9721c Tilføj Firestore-helper og rules for klientspørgsmål
de911cc Teleport indkøbsliste-overlay til body så den lægger sig over TabBar
c63f4f6 Flyt PDF-hint over knapperne i indkøbsliste-eksport
e3d1f78 Fix scroll og bund-knapper i indkøbsliste-overlay på mobil
2303f84 Aktiver PWA-mode med apple-meta-tags og safe-area-padding
a2d3eb6 Tilføj PWA-manifest og placeholder-ikoner
35499ed Tilføj script til generering af PWA-ikoner
30d4331 Tilføj forklarende hint-boks om +-knappen på opskrifter
c4a57ac Tilføj multi-select af opskrifter på 30-30-3-modulet
7a22769 Byg indkøbsliste-overlay-komponent
c06b73a Tilføj jspdf og PDF-eksport for indkøbsliste
1865402 Tilføj indkøbsliste-modul med helpers og tests
8b2010f Sæt manglende baseline-skydere til 5 ved gem
5b78b2e Returnér til forrige side når lektion-overlay lukkes
9be07b9 Vis baseline (dag 0) som øverste række i admin-lektion-liste
2cdb0d7 Skift til @sveltejs/adapter-cloudflare for hosting
7253054 Tilføj global header med Linn's Academy brand
```

`main` er pushet og deployet. Branchen `etape-9-mikrotraening` ligger stadig på origin men er nu fast-forwarded ind i main — kan slettes hvis I vil rydde op.

---

## Til næste Claude-instans

1. **Linn taler dansk** — svar på dansk, ingen em-dashes/semikolons/lange tankestreger
2. **Hele filer, ikke linje-for-linje edits** ved større ændringer
3. **Små commits ofte** — denne session har gjort det godt, fortsæt
4. **Tjek altid `npx svelte-check` og `npm test`** efter ændringer
5. **CSS-variabler** følger `--ff-d`, `--text2`, `--bg2`-konventionen
6. **Bo håndterer terminalen** — antag intet om udvikler-kontekst. Linn håndterer Vimeo, Firebase Console, Cloudflare Pages-UI selv
7. **Reference-app i `reference/index.html`** — alle features kan slås op
8. **Firestore-rules** copy-pastes manuelt til Firebase Console når ændret
9. **Forløbs-modellen er førsteklasses** — alt forløbs-specifikt indhold ligger under `forlob/{id}/...` og kopieres automatisk via `kopierForlobIndhold`
10. **Forløbs-konvention er 0-baseret** — startDato = dag 0 = baseline. Dag 1-antalDage = programdage
11. **TabBar har Admin-tab kun for admin-brugere** (matcher ADMIN_EMAILS i src/lib/admin.ts)
12. **`kopierForlobIndhold`** kopierer vaneprogram, forlobsdage, FAQ og guides — udvid hvis nye sub-collections
13. **Migrations-scripts** kører lokalt med admin-SDK. xlsx/csv/key.json er gitignored
14. **Video-håndtering:** `videoEmbedUrl` i `src/lib/content/bibliotek.ts` understøtter YouTube + Vimeo. Vimeo er valgt — bare opdater URL'erne
15. **Cloudflare Pages auto-deployer fra `main`** ved hver push. Test-flow: ændring → `npx svelte-check` + `npm test` → commit → push → vent 2-4 min → tjek `linns-academy-app.pages.dev`
16. **`linns-academy-app.pages.dev` er midlertidig URL** — `app2.linnsacademy.dk` aktiveres når Linn er klar
17. **Klient-spørgsmål composite index** undgået ved at sortere klient-side. Hvis vi tilføjer flere where-filtre senere skal vi tjekke om det kræver et index
18. **Loading-komponent** bruges overalt for konsistens — `<Loading tekst="Henter X..." />` (kompakt-variant til mindre områder)
19. **PWA-ikoner** genereres af `scripts/generer-pwa-ikoner.ts`. Erstat SVG-template hvis Linn får et rigtigt logo

---

## Næste session — første handling

Spørg Linn hvilken af disse hun vil tage først:

1. **Koble app2.linnsacademy.dk på** (Cloudflare Pages → Custom domains, plus Firebase Auth + Vimeo whitelist) — kort og afsluttende
2. **Upload resten af lektion-videoer til Vimeo** og opdater URL'erne i admin — primært admin-arbejde, ingen kode-ændringer
3. **Bygge dag 15-21 lektioner** ind i Kickstart-forløbet — admin-arbejde
4. **Adgangskontrol-fixen** — tilføj `state==='forlobskunde'`-tjek på de øvrige forløbs-specifikke moduler (vaner, mit forløb) så modulbrugere ikke kan tilgå dem (samme mønster som vi brugte til Bibliotek)
5. **Dagbog edit-flow** i 30-30-3 (åben fra v15)
6. **Profilside med forløbsdetaljer** (åben fra v15)

Held og lykke.
