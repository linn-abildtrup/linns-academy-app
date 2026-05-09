# Handover til næste chat — v18

Status efter session 19 (8.-9. maj 2026). **22 commits siden v17.** De
tre store leverancer i sessionen:

1. **HTML-filer** kan nu uploades som lektioner og guides — vises i fullscreen-iframe på klienten med "Gem som PDF"-knap
2. **Mikrotræning er flyttet ind under hvert forløb** som sub-collection. Top-level admin-routen "Mikrotræning" er erstattet med "Træningsmodul" (øvelsesbank med fuld CRUD)
3. **Træning-spilleren forbedret væsentligt**: PIP-styling under øvelses-skift, fuldskærm-tilstand, autoplay-retry-loop, low-CSS-quirks fixet (sorte bjælker, video-størrelse, scroll-isolation, øvelses-preview)

Plus en lang stribe små rettelser (CSV-filupload, søgning i tilmeldte emails, slet-duplikat-script, lektionsplural, m.m.).

**Næste skridt:** Linn vil teste flowet på iPhone PWA i dybden, evt. tilføje content for dag 15-21, og se om der er flere small UX-issues at slibe.

---

## TL;DR — hvad der blev bygget

### Klient-side

- **Strip-chips på forsiden bevarer valg via URL** (`?dag=N`). Når klienten klikker på dagens lektion → ser video → lukker → kommer tilbage med samme dag valgt
- **Lektion-overskrift pluraliseres dynamisk** — "Dagens lektion" / "Dagens lektioner", "Lektion for 27. april" / "Lektioner for 27. april" — én sektion pr dag uanset antal lektioner
- **Slider-default 5** ved gem på alle check-ins (ikke kun baseline). Slider viser "5" i talkolonnen fra start
- **Bibliotek har Lektioner-fane** med alle lektioner kronologisk (dag 0 → dag N)
- **Mikrotræning-genvej fra forsiden følger valgt dag** — vælger du dag 1 mens du er på dag 13, lander du på dag 1's træning
- **Fremtidige dage er nu låst** i mikrotræning-grid'et med dæmpet baggrund og `cursor: not-allowed` — kun dage til og med i dag kan vælges

### Træning-spiller (mikrotræning/[dag]/spil)

- **Fuldskærm-tilstand** — `⛶`-ikon øverst venstre + stor "Fuldskærm"-knap nederst. Skjuler global Header og TabBar via `html-fullscreen-aktiv`-body-klassen. Video fylder hele skærmen, øvelsesnavn-overlay i bunden
- **Video-rammer**: 16:9 aspect-ratio (fjernet sorte letterbox-bjælker), `object-fit: contain` (intet zoom-in på landscape-videoer)
- **PIP-effekt under switch-fase** — hovedvideoen skaleres til 65% med hvid kant og skygge så det ligner et lille preview-kort. Implementeret som ren CSS-styling på det eksisterende video-element (iOS Safari klarer ikke to videoer der spiller samtidig)
- **Hovedvideoen skifter til NÆSTE øvelse allerede ved switch-fase-start** (samme mønster som ref-appen) — så ingen src-skift sker når switch slutter, ingen pause-glitch
- **iOS Safari play-retry-loop** — hvis `.play()` afvises retry vi op til 10 gange over ~2 sek. Plus auto-resume hvis videoen pauser uventet i en aktiv fase
- **Force re-mount af video via `{#key}`** ved url-skift — supplerer retry-loopet
- **`object-fit: contain`** også på hovedvideo og PIP-video så hele videoen vises uden kropning

### Øvelses-preview (mikrotræning/[dag])

- **Lille `▶︎`-knap pr øvelse** der åbner et fullscreen-overlay med:
  - Demo-video (autoplay + loop + muted, ingen controls — looper i baggrunden)
  - Beskrivelse (`Exercise.desc`)
  - "Sådan udfører du øvelsen" med nummereret how-to-liste (`Exercise.how[]`)
  - Tags som små pille
  - Video bliver i fast position øverst — kun teksten scroller
- Video hentes on-demand når brugeren klikker

### HTML-filer som indholdstype

- **`GuideType` udvidet med `'html'`** — `detekterGuideType` genkender `.html`/`.htm`
- **`uploadHtmlFil(forlobId, fil)`-helper** uploader til `/forlob/{id}/html/{timestamp}-{filnavn}` med `text/html` content-type
- **Drag-and-drop "📎 Upload HTML-fil"-knap** ved siden af URL-feltet i både lektion-editor og guide-dialog. URL'en udfyldes automatisk efter upload
- **Klient-overlay for HTML**: fullscreen iframe (z-index 100, hide-chrome via body-klasse), sticky topbar med ← Luk + titel, sticky bottom-bar med stor 📄 **Gem som PDF**-knap der åbner filen i ny fane så brugeren kan bruge browserens native Share/Print → Gem som PDF (cross-origin gør at iframens `print()` blokeres)
- **Lilla type-pille og thumb-gradient** for HTML i bibliotek

### Mikrotræning under forløb (refactor)

Stort refactor — fra globale top-level programmer til forløbs-specifikke:

- **Datamodel:** `forlob/{forlobId}/mikrotraeningProgrammer/{programId}/days/{dagId}` (top-level `trainingPrograms/` står stadig som backup, ikke ryddet endnu)
- **Migration kørt** — `mikrotraening_kettlebell` og `mikrotraening_no_kettlebell` flyttet til `kickstart_maj_2026` med samme ID. Maria's `programValg` virker stadig — klient slår op via `userProduct.forlobId`
- **Admin top-side**: "Mikrotræning"-link erstattet med **"Træningsmodul"** der peger på `/app/admin/traening` — øvelsesbank med fuld CRUD (opret, rediger, slet øvelser, søgning, kategori-filter)
- **Modul-row "Mikrotræning"** på `/app/admin/forlob/[id]` — fører til `mikrotraening`-listen for forløbet
- **Tre nye admin-sider** under forløb:
  - `/app/admin/forlob/[id]/mikrotraening` — liste af programmer + "Nyt program"-dialog
  - `/app/admin/forlob/[id]/mikrotraening/[programId]` — rediger metadata + dage
  - `/app/admin/forlob/[id]/mikrotraening/[programId]/[dag]` — rediger en dag
- **Onboarding** lister dynamisk programmer fra forløbet (i stedet for hardcoded kettlebell/no_kettlebell), så Linn kan have et hvilket som helst antal varianter
- **`kopierForlobIndhold` udvidet** — kopierer nu også mikrotraeningProgrammer + days til nye kohorte-forløb sammen med vaneprogram, FAQ og guides

### Øvrige rettelser

- **Sletning af duplikat-program** — `mikrotraening_kettlebell_21` (tomt 1-dages duplikat) slettet via one-off-script i `scripts/slet-duplikat-program.ts`
- **CSV-filupload på forløbs-detaljesiden** — drag-and-drop af Simplero-eksport (eksisterende paste-flow er bevaret som alternativ)
- **Søgning i Tilmeldte emails-listen** med real-time filtrering på email/fornavn/efternavn + tæller "5 af 23"

---

## ⚠️ Vigtigt: Manuel opsætning på production

### 1. Firestore-rules — mikrotraening-paths

`firestore.rules` har ny match-blok for `forlob/{forlobId}/mikrotraeningProgrammer/{programId}/days/{dagId}`. Skal copy-pastes til Firebase Console → Firestore → Rules → Publish.

### 2. Storage-rules

`storage.rules` (tidligere session) tillader admin-upload af HTML-filer på max 5MB med `text/html` content-type. Skal copy-pastes til Firebase Console → Storage → Rules → Publish hvis ikke allerede gjort.

### 3. Cloudflare Pages — auto-deployer

Auto-deployer ved hver push til `main`. Tager typisk 2-4 min. Verificer ved at polle `https://linns-academy-app.pages.dev/_app/version.json` — version-stamp ændrer sig ved ny build.

---

## Den tekniske tilstand

### Mappestruktur (relevant for denne session)

```
src/
├── lib/
│   ├── components/
│   │   └── Header.svelte                              ← +TRÆNINGSMODUL-label
│   ├── content/
│   │   ├── bibliotek.ts                               ← +'html' GuideType
│   │   ├── bibliotek.test.ts                          ← +HTML-detection-test
│   │   └── mikrotraening.ts                           ← +tommeDageSkelet
│   ├── firestore/
│   │   ├── forlob.ts                                  ← kopierForlobIndhold udvidet
│   │   └── mikrotraening.ts                           ← +hentForlobsProgrammer/Program/etc
│   └── utils/
│       └── storage.ts                                 ← +uploadHtmlFil
└── routes/app/
    ├── +page.svelte                                   ← URL-state for valgt dag, lektion-plural
    ├── +layout.svelte                                 ← (uændret)
    ├── admin/
    │   ├── +page.svelte                               ← 'Træningsmodul' i stedet for 'Mikrotræning'
    │   ├── traening/+page.svelte                      ← NY: øvelsesbank med fuld CRUD
    │   ├── forlob/[id]/
    │   │   ├── +page.svelte                           ← +Mikrotræning-modulrække, CSV-fil-upload, søgning
    │   │   ├── mikrotraening/+page.svelte             ← NY: liste af programmer i forløbet
    │   │   ├── mikrotraening/[programId]/+page.svelte ← NY: rediger program (flyttet fra top-level)
    │   │   └── mikrotraening/[programId]/[dag]/+page.svelte ← NY: rediger dag (flyttet fra top-level)
    │   └── mikrotraening/                             ← FJERNET (top-level admin-routes)
    └── moduler/
        ├── bibliotek/+page.svelte                     ← +Lektioner-fane, +HTML-overlay
        ├── forlob/+page.svelte                        ← +HTML-overlay
        └── traening/mikrotraening/
            ├── +page.svelte                           ← +låste fremtidige dage, hentForlobsProgram
            ├── [dag]/+page.svelte                     ← +preview-knap pr øvelse, hentForlobsProgram
            ├── [dag]/spil/+page.svelte                ← +fuldskærm, +PIP-styling, +retry-loop, hentForlobsProgram
            └── onboarding/+page.svelte                ← Dynamisk programliste fra forløbet

scripts/
├── migrer-mikrotraening-til-forlob.ts                 ← NY: kopierede programmer ind i forløbet
├── slet-duplikat-program.ts                           ← NY: slettede mikrotraening_kettlebell_21
└── migrate-faq.ts                                     ← NY: kopierede FAQ fra vanetracker

src/app.css                                            ← +html-fullscreen-aktiv body-klasse
firestore.rules                                        ← +mikrotraeningProgrammer-regel
storage.rules                                          ← (fra forrige session)
```

### Firestore-struktur (nye stier)

- `forlob/{forlobId}/mikrotraeningProgrammer/{programId}` — { navn, beskrivelse, treaningsform, antalDage, dagligTid, niveau, udstyr[], aktiv }
- `forlob/{forlobId}/mikrotraeningProgrammer/{programId}/days/{dagId}` — { dagNummer, titel, indledning, exercises[] }
- `forlob/{forlobId}/html/` — Storage-path for HTML-uploads

`trainingPrograms/{programId}` (gammel top-level path) står stadig — ikke slettet. Skal ryddes op senere når alt er bekræftet at virke i mindst en uge.

### Tests

**301 tests passerer** (var 298 før — 3 nye for HTML-detection + tommeDageSkelet). 0 type-fejl, 0 svelte-check-warnings.

### Kommandoer

```bash
npm run dev                                             # dev-server
npm test                                                # 301 tests
npm run build                                           # production build (Cloudflare-adapter)
npm run inspect:program                                 # liste alle træningsprogrammer top-level
npm run inspect:program -- mikrotraening_kettlebell     # detaljer for ét program
npx tsx scripts/migrer-mikrotraening-til-forlob.ts      # DRY_RUN flytter programmer
DRY_RUN=false npx tsx scripts/migrer-mikrotraening-til-forlob.ts  # udfør
DRY_RUN=false npx tsx scripts/slet-duplikat-program.ts  # slet duplikater
npm run migrate:faq -- --dry                            # preview FAQ-migrering
npm run migrate:faq                                     # migrer FAQ fra vanetracker
```

### Test-brugere (uændret)

- `forlob@linnsacademy.dk` (Maria) — forløbskunde, kickstart_maj_2026, programValg.mikrotraening = 'mikrotraening_kettlebell'
- `modul@linnsacademy.dk` (Anne) — modulbruger
- `udlobet@linnsacademy.dk` (Sofia) — udløbet
- `linnabildtrup00@gmail.com` (Linn, admin)

### Hosting + URL'er

- **Live URL:** https://linns-academy-app.pages.dev
- **Production branch:** `main` (auto-deploy via Cloudflare Pages, 2-4 min)
- **Custom domain (planlagt):** `app2.linnsacademy.dk` — ikke koblet på endnu
- **Gammel app fortsætter:** `app.linnsacademy.dk` (vanetracker) indtil migration er færdig

---

## Designprincipper og mønstre der blev etableret

### iOS Safari video-håndtering

iOS Safari er notorisk om autoplay og src-skift. Disse mønstre virker:

1. **`{#key videoUrl}` blok** rundt om `<video>` så Svelte force-genmonterer ved url-skift (autoplay-attributtet honoreres på et frisk element)
2. **`bind:this` + manuel `.play()`** efter url-skift — supplement til {#key}
3. **Retry-loop** på `.play()` — hvis afvist, prøv igen hver 200ms op til 10 forsøg (~2 sek total). Reference-appens mønster
4. **Pause-event-listener** der auto-resumer hvis videoen pauser uventet i en aktiv fase
5. **Skift main-video tidligt** ved øvelses-skift (allerede i switch-fasen) — så ingen src-skift sker når switch slutter, ingen pause-glitch
6. **Aldrig to konkurrerende videoer samtidig** — i stedet styling på én video for at simulere PIP-effekt

### Fullscreen-overlay-mønster

Bruges til både HTML-overlay og fuldskærm-træning:

- `position: fixed; inset: 0; z-index: 100; display: flex; flex-direction: column`
- `padding-top: env(safe-area-inset-top); padding-bottom: env(safe-area-inset-bottom)` — håndterer iPhone-notch og home-indicator
- Sticky topbar (header med Luk-knap + titel)
- Sticky bottom-bar (hvis behov for handling — fx Gem som PDF-knap)
- Iframe/video imellem med `flex: 1`
- Aktiveres ved at sætte `document.body.classList.add('html-fullscreen-aktiv')` — global CSS-regel skjuler så `.app-header` og `.tabbar-wrap`. Klassen fjernes ved luk og ved component-destroy

### URL-state for filtre og valg

Brug query-params til at bevare state på tværs af navigation:

- `/app?dag=N` — valgt dag i strip-chips
- `/app/moduler/forlob?lektion=ID` — auto-åbn lektion-overlay
- `/app/moduler/bibliotek?tab=guides|lektioner` — aktiv tab

Læs på mount, opdater via `replaceState`. Så ender brugeren tilbage på samme tilstand når de navigerer tilbage.

### Fremtidige dage

Klienter må kun tilgå dage til og med i dag (kalender-baseret via `getCurrentDay`). Implementeret tre steder:

- Forsiden: strip-chips disabled for fremtid
- Mit forløb-tidslinjen: viser kun dage til og med aktivDagNr
- Mikrotræning-grid: dag-fremtid-klassen — opacity 0.55, cursor: not-allowed, ikke-klikbar

Samme dæmpede mønster på alle tre steder.

---

## Commits fra denne session (22 commits)

```
4165562 Lås fremtidige dage i mikrotræning-dag-griddet
49c9436 Lad Mikrotræning-genvejen følge valgt dag fra strip-chips
f2f60ba Tilføj PIP-effekt på hovedvideoen under switch-fase
0f02d76 Tilføj iOS Safari play-retry-loop og auto-resume ved uventet pause
a4d0c53 Skift main-video tidligt ved øvelses-skift, fjern PIP
9cadccd Flyt fuldskærm-knap til venstre + tving video-afspilning ved skift
886a6ab Tilføj fuldskærm-tilstand i træning-spilleren
18ee71c Force-genmonter video-element når øvelse skifter
23f97a1 Fjern sorte bjælker over og under video i træning-spilleren
609f4b2 Vis hele øvelses-videoen i træning-spilleren uden kropning
5dd493e Lad kun teksten scrolle i øvelses-preview, behold video i fuld størrelse
c9c4494 Redesign øvelses-preview så den matcher reference-appen
b4b1ae4 Tilføj preview-knap pr øvelse på dagens-øvelser-side
d513848 Vis kun én overskrift når der er flere lektioner samme dag
1d5f99f Flyt mikrotræning ind under forløb + ny øvelsesbank-admin
ae26e9a Tilføj script til at slette duplikat-træningsprogram
069a031 CSV-filupload og søgning i tilmeldte emails
31adb59 Bevar valgt dag i URL så strip-valget ikke nulstilles
271c94c Åbn HTML-fil i ny fane for at gemme som PDF
b12eb9c Skjul Header og TabBar mens HTML-overlay er åbent
51590cc Fullscreen-overlay for HTML-visning
0126586 HTML-filer som ny indholdstype i lektioner og guides
```

`main` er pushet og deployet.

---

## Åbne tråde / kendte mangler

### Skal gøres af Linn

1. **Custom domain `app2.linnsacademy.dk`** — Cloudflare Pages → Custom domains → Add. Plus tilføj domænet til Firebase Auth Authorized domains og Vimeo embed-whitelist
2. **Upload resten af lektion-videoer til Vimeo** og opdater URL'erne i admin
3. **Lektioner for dag 15-21** — eksisterer ikke i ref-app, skal udfyldes manuelt
4. **Beskrivelser, varighed, format** på de migrerede lektioner — alle har titel + URL men beskrivelse er tom
5. **Guides for Kickstart maj 2026** — strukturen er klar men intet indhold endnu (FAQ er migreret 9. maj 2026, se nedenfor)
6. **Rigtigt logo** til PWA-ikon — pt placeholder LA-cirkel
7. **Ryd top-level `trainingPrograms/`** — efter mindst en uge på production hvor alt virker

### Migreret 9. maj 2026

- **FAQ migreret** fra vanetracker (top-level `faqCategories` + `faqItems`) til `forlob/kickstart_maj_2026/faqKategorier` + `faqItems` via `npm run migrate:faq`. 7 kategorier og 25 spørgsmål. Original-ID'er bevaret så scriptet er idempotent (kør igen for at synce ændringer fra ref-app).

### Klient-side polering (åbne fra v17 og før)

8. **Dagbog mangler edit-flow** (30-30-3) — slet virker, edit ikke
9. **Dagbog viser kun én dag ad gangen** — uge/måned-visning kunne tilføjes
10. **3 ingredienser kan ikke auto-matches** — jalapeño, flankesteak, sødkartoffel
11. **Modulbrugere kan stadig se Kickstart-moduler** undtagen Bibliotek (nu låst). De andre forløbs-specifikke moduler mangler `state==='forlobskunde'`-tjek
12. **Profilside viser ikke hvilket forløb brugeren er på**
13. **Også lås fremtidige dage på direkte URL** (`/app/moduler/traening/mikrotraening/15` på dag 13) — pt kun grid'et er låst, dag-side selv tjekker ikke kalender

### Andre moduler / features

14. **`/app/moduler/traening/+page.svelte`** viser kun Mikrotræning hardkodet
15. **Live Q&A** — bedre kalender-integration kunne overvejes
16. **`/app/beskeder` er placeholder**

### Kosmetiske

17. **B1 modul-grid på forsiden** ignorerer hvad brugeren har købt
18. **Wake Lock-knappen** vises selv på browsere uden API-support
19. **`scripts/vanetracker-key.json`** bør slettes når Linn er færdig med migration

---

## Til næste Claude-instans

1. **Linn taler dansk** — svar på dansk, ingen em-dashes/semikolons/lange tankestreger
2. **Hele filer, ikke linje-for-linje edits** ved større ændringer
3. **Små commits ofte** — denne session har gjort det godt, fortsæt
4. **Tjek altid `npx svelte-check` og `npm test`** efter ændringer
5. **CSS-variabler** følger `--ff-d`, `--text2`, `--bg2`-konventionen
6. **Bo håndterer terminalen** — antag intet om udvikler-kontekst. Linn håndterer Vimeo, Firebase Console, Cloudflare Pages-UI selv
7. **Reference-app i `reference/index.html`** — alle features kan slås op
8. **Firestore-rules + storage.rules** copy-pastes manuelt til Firebase Console når ændret
9. **Forløbs-modellen er førsteklasses** — alt forløbs-specifikt indhold ligger under `forlob/{id}/...` og kopieres automatisk via `kopierForlobIndhold`
10. **Forløbs-konvention er 0-baseret** — startDato = dag 0 = baseline. Dag 1-antalDage = programdage
11. **TabBar har Admin-tab kun for admin-brugere** (matcher ADMIN_EMAILS i src/lib/admin.ts)
12. **Deploy-verifikation:** poll `https://linns-academy-app.pages.dev/_app/version.json` — version ændrer sig pr build (typisk 2-4 min)
13. **iOS Safari video-quirks** — se "iOS Safari video-håndtering" sektionen ovenfor. Brug `{#key}` + retry-loop + pause-event-resume
14. **Fullscreen-overlay-mønster** for ting der skal fylde hele skærmen (HTML-filer, fuldskærm-træning) — se mønster ovenfor
15. **iframe.contentWindow.print()** blokeres cross-origin (Firebase Storage er cross-origin) — åbn i ny fane så browser-native Share/Print kan bruges
16. **Migration-scripts** kører lokalt med admin-SDK. service-account-key.json er gitignored. DRY_RUN=true er default

---

## Næste session — første handling

Spørg Linn hvilken af disse hun vil tage først:

1. **Verificer på iPhone PWA i dybden** — gå et helt forløbs-flow igennem (login → forside → dagens lektion → mikrotræning fuldskærm → bibliotek → guides → HTML-fil → Mit forløb tidslinje → klientspørgsmål)
2. **Adgangskontrol-fixen** — tilføj `state==='forlobskunde'`-tjek på de øvrige forløbs-specifikke moduler så modulbrugere ikke kan tilgå dem
3. **Lås fremtidige dage på direkte URL** — `mikrotraening/[dag]/+page.svelte` skal selv tjekke kalender-dag
4. **Indhold for dag 15-21** i Kickstart-forløbet
5. **Ryd top-level `trainingPrograms/`** når production har kørt en uge stabilt
6. **Profilside med forløbsdetaljer** (åben fra v15)

Held og lykke.
