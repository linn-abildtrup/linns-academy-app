# Handover til næste chat — v16

Status efter session 17 (8. maj 2026). **Bibliotek (FAQ + Guides), Mit forløb-modul, og forsidens dato-strip er bygget.** Lektioner er migreret fra vanetracker. Forløbet bruger nu 0-baseret dagsindeksering så startDato matcher baseline-dagen.

**Næste skridt:** Linn vil kigge på video-hosting (Vimeo Pro vs Mux). YouTube-links virker, men en mere professionel afspilnings-oplevelse er ønsket.

---

## TL;DR — hvad der blev bygget

- **Bibliotek-modulet** (FAQ + Guides) er forløbs-specifikt. Klient-side på `/app/moduler/bibliotek` med tabs. Admin-side på `/app/admin/forlob/[id]/bibliotek` ditto med tabs. Modulbrugere er låst ude.
- **Guides** understøtter video (YouTube/Vimeo iframe-embed), PDF (ny fane), link (ny fane) og lyd (audio-player). Auto-genererede thumbnails pr type.
- **Mit forløb-modulet** på `/app/moduler/forlob` — dagens lektion, tidslinje med alle 21 dage, baseline-genvej, klik åbner overlay med video/lyd.
- **Forsiden** læser nu rigtig data (ingen mock). Horizontal dato-strip øverst med alle 22 dage (baseline + 21 program). Klik på dag = se den dags lektion. "Dagens små skridt" tilpasses valgt dag.
- **22 lektioner migreret** fra vanetracker til Kickstart maj 2026 via `npm run migrate:lektioner`.
- **Forløbets startDato rettet** fra 4. maj til 26. april 2026 så lektion-titlerne matcher dagNumrene. Konvention: dag 0 = baseline, dag 1-21 = programdage.
- **3 mindre fejlrettelser:** auto-afspilning af dagens lektion, "30-30 beregner" i stedet for "30-30-3", Træning-action peger på dagens næste session, vanedage med 0 udfyldte ja har nu en distinkt look.
- **274 tests passerer**, 0 type-fejl.

---

## ⚠️ Vigtigt: Firestore-rules skal opdateres

`firestore.rules` har nye regler for tre nye sub-collections under forlob/{forlobId}/. Copy-paste til Firebase Console:

```
match /faqKategorier/{kategoriId} { ... }
match /faqItems/{itemId} { ... }
match /guideKategorier/{kategoriId} { ... }
match /guideItems/{itemId} { ... }
match /forlobsdage/{dagId} { ... }
```

Alle følger samme mønster: alle autentificerede kan læse, kun admin kan skrive.

---

## Hvad der er bygget i denne session

### Bibliotek (FAQ + Guides) — etape A

Forløbs-specifik datamodel under `forlob/{id}/`:

- `faqKategorier/{id}` — { navn, orden, oprettet }
- `faqItems/{id}` — { kategoriId, spoergsmaal, svar, orden, udgivet, oprettet, opdateret }
- `guideKategorier/{id}` — { navn, orden, oprettet }
- `guideItems/{id}` — { kategoriId, type, titel, beskrivelse, url, dato, orden, udgivet, oprettet, opdateret }

Klient: `/app/moduler/bibliotek` med tabs FAQ / Guides. FAQ-tab viser foldbare spørgsmål grupperet efter kategori. Guides-tab viser kort grupperet efter kategori med auto-thumbs pr type (terra-gradient til video, lyserød til PDF, sage til link, terra til lyd). Klik åbner: video/lyd i overlay-iframe/audio-player, PDF/link i ny fane.

Admin: `/app/admin/forlob/[id]/bibliotek` med tabs. CRUD for kategorier (omdøb inline, slet med to-trins-bekræftelse) og items. Guide-dialog har URL-felt med auto-detekt af type ved blur, type-chips (Video/PDF/Link/Lyd), valgfri dato (bruges til sortering — nyeste øverst).

URL-helpers i `src/lib/content/bibliotek.ts`:
- `detekterGuideType(url)` — gætter type ud fra URL
- `youtubeId(url)` / `vimeoId(url)` — udtrækker video-id
- `videoEmbedUrl(url)` — bygger iframe-embed-URL
- `sorterGuides(items)` — nyeste dato øverst, items uden dato falder nederst og sorteres efter orden indbyrdes

Modulbrugere er låst ude — bibliotek er fjernet fra deres koebt-liste i `moduler.ts`.

### Mit forløb-modulet — etape B

Datamodel: `forlob/{id}/forlobsdage/dag{N}` med `{ dagNummer, uge, lektioner: LektionItem[], noteFraLinn }`. LektionItem har klient-genereret id (crypto.randomUUID), titel, beskrivelse, varighedMin, format og valgfri url.

Klient: `/app/moduler/forlob` viser dagens lektion-card, en baseline-genvej og en tidslinje med alle 21 dage. Tidslinjen viser status (fortid / aktiv / fremtid) og lektion-forhåndsvisning. Klik på en lektion åbner overlay med video-iframe (YouTube/Vimeo via `videoEmbedUrl`) eller audio-player. PDF og link åbner i ny fane.

Auto-åbn af lektion: forsiden linker med `?lektion={id}` til Mit forløb-siden så overlay'et popper op direkte ved load. Lukker man overlay'et ryddes query-param via `replaceState`.

Admin: `/app/admin/forlob/[id]/lektioner` med oversigt over alle dage. Pr-dag-side på `/app/admin/forlob/[id]/lektioner/[dag]` med textarea til note fra Linn og dynamisk lektion-array (titel, beskrivelse, varighed, format, valgfri URL). Plus `+ Tilføj lektion`, fjern-kryds pr lektion, gem-knap, slet-alt-knap med to-trins-bekræftelse.

### Forsidens omlægning — etape C

`src/lib/content/forlob.ts` blev refaktoreret fra mock-data (`aktivtForlob`, `dagensIndhold`) til rigtige typer (LektionItem, ForlobDag) plus pure helpers:
- `getCurrentDay(forlob, now)` — returnerer 0 på startdagen, 1 dagen efter, osv. (0-baseret konvention der matcher vaneprogram)
- `ugeForDag(dagNummer)` — beregner ugenummer
- `dagStatus(dagNummer, aktivDag)` — returnerer fortid/aktiv/fremtid
- `nyLektion()` / `tomForlobDag(n)` — skabeloner
- `formatDato(date)` — "Tirsdag, 4. juni"

Forsidens `/app/+page.svelte` læser nu fra Firestore. Centrale ændringer:
- Forløbs-badge med rigtig forløbsnavn + dagnummer (linker til Mit forløb)
- Horizontal **dato-strip** øverst i body med alle 22 dage. Auto-scroll til aktiv dag ved load. Hver chip: ugedag (kort), dato i `dag/måned`-format (fx 27/4), dagnummer (Start/D1/D2/...).
- Klik på en chip vælger en historisk dag → lektion-card opdateres til at vise den dags lektion, "Lektion for tirsdag, 4. maj"-overskrift, "Tilbage til i dag"-knap øverst i strip-sektionen.
- "Dagens små skridt" (tidligere "Dagens action") tilpasses valgt dag:
  - Dag 0 (baseline): kun ét kort under Vaner — "Baseline check-in" som linker til /app/moduler/vaner/0
  - Dag 1-21: tre kort (Kost, Træning, Vaner). Vaner-href peger på den valgte dag.
  - Efter dag 21 eller intet forløb: hele sektionen skjules.
- Træning-card peger på dagens næste mikrotræning-session via `naesteDag(fremgang, antalDage)` — ikke kalenderbundet.

### Migration af lektioner — etape D

`scripts/migrate-lektioner.ts` læser `programConfig/global.days[YYYY-MM-DD].lessons[]` fra det gamle vanetracker-projekt og mapper hver lektion til en dagNummer = (lektionsdato - forløbets startDato) i dage. 0-baseret: dag 0 = startDato.

`scripts/_set-forlob-startdato.ts` er en lille engangs-helper til at sætte et forløbs startDato uden at gå gennem admin-UI'et.

Forløbets startDato blev sat til 26. april 2026 så Linn's eksisterende lektion-titler ("Dag 1, Protein til morgenmad") matcher dagNumrene perfekt. Resultat: 15 forløbsdage og 22 lektioner (inklusive en "Velkommen"-lektion på baseline).

Endelig fordeling:
```
Dag  0 (26. apr)       Velkommen (baseline)
Dag  1 (27. apr)       Dag 1, Protein til morgenmad
Dag  2 (28. apr)       Dag 2, Fibre til morgenmad + Q&A #1
Dag  3 (29. apr)       Dag 3, Mikrotræning + Mavegener
Dag  4 (30. apr)       Dag 4, Hvorfor morgenmad?
Dag  5 (1. maj)        Dag 5, Få øje på dine #wins
Dag  6 (2. maj)        Dag 6, Holdets morgenmadsopskrifter + Weekend
Dag  7 (3. maj)        Dag 7-lektioner + Live Q&A-reminder
Dag  8 (4. maj)        Dag 8, Protein til frokost + Q&A #2
Dag  9 (5. maj)        Dag 9, Lydfil: Fibre til frokost
Dag 10 (6. maj)        Dag 10-lektioner
Dag 11 (7. maj)        Dag 11, Cravings
Dag 12 (8. maj)        Dag 12, Tilføj lidt ekstra bevægelse  ← I dag
Dag 13 (9. maj)        Dag 13, Når tankerne dukker op igen
Dag 14 (10. maj)       Dag 14, Det du ikke kunne se i uge 1
```

Lektioner for dag 15-21 mangler — de eksisterede ikke i ref-app. Linn skal udfylde dem manuelt eller migrere fra et andet sted hvis hun har dem.

### Mindre fejlrettelser — etape E

1. **Dagens lektion på forsiden afspilles direkte** — `?lektion={id}` query-param på lektion-card på forsiden + auto-åbning af overlay i Mit forløb-siden.
2. **30-30-3 → 30-30 beregner** — h1 i kost-modulet og forsidens action-meta + modul-grid. URL'en (mappen `/30-30-3/`) er beholdt for ikke at brække dybt-links.
3. **Træning-action på forsiden hopper til dagens session** — `naesteDag(fremgang, antalDage)` bruges til at bygge `/app/moduler/traening/mikrotraening/{N}`.
4. **Vanedage med 0 udfyldte ja har nu distinkt look** — `.flower-none.status-partial` får bg2-baggrund + dæmpet tekst, så Linn kan se forskellen på "ikke udfyldt" og "udfyldt med alle nej" i sin fremgang.
5. **Indhold-prikken på dato-strippen er fjernet** — Linn syntes den så for rød ud.

### Stilrettelser

- "Dagens action" → "Dagens små skridt"
- Dato-strip viser nu `dag/måned` (27/4) i stedet for kun `dag` (27)
- Bibliotek-modulet er låst for modulbrugere (forløbs-specifikt indhold)

---

## Den tekniske tilstand

### Mappestruktur (relevant for denne session)

```
src/
├── lib/
│   ├── content/
│   │   ├── bibliotek.ts                              ← NY: FAQ + Guides typer + helpers
│   │   ├── bibliotek.test.ts                         ← NY: 32 tests
│   │   ├── forlob.ts                                 ← refactor: rigtig datamodel
│   │   └── forlob.test.ts                            ← opdateret til 0-baseret
│   └── firestore/
│       ├── bibliotek.ts                              ← NY: CRUD for FAQ + Guides
│       └── forlob.ts                                 ← +forlobsdage CRUD + udvidet kopiering
└── routes/app/
    ├── +page.svelte                                  ← rigtig data + dato-strip + dynamisk actions
    ├── moduler/
    │   ├── +page.svelte                              ← +RUTER for forlob + bibliotek
    │   ├── bibliotek/+page.svelte                    ← NY: klient FAQ + Guides
    │   ├── forlob/+page.svelte                       ← NY: Mit forløb-modul
    │   └── 30-30-3/+page.svelte                      ← h1 omdøbt
    └── admin/forlob/[id]/
        ├── +page.svelte                              ← +link til lektioner og bibliotek
        ├── bibliotek/+page.svelte                    ← NY: FAQ + Guides admin (tabs)
        └── lektioner/
            ├── +page.svelte                          ← NY: oversigt over alle dage
            └── [dag]/+page.svelte                    ← NY: redigér én dag

scripts/
├── migrate-lektioner.ts                              ← NY: vanetracker → forløb
└── _set-forlob-startdato.ts                          ← NY: engangs-helper
```

### Firestore-struktur (nye stier)

- `forlob/{id}/forlobsdage/dag{N}` — lektioner + note pr dagNummer (0 = baseline, 1-21 = programdage)
- `forlob/{id}/faqKategorier/{id}` + `faqItems/{id}`
- `forlob/{id}/guideKategorier/{id}` + `guideItems/{id}`

### Tests

**274 tests passerer** (var 228 før denne session — 46 nye for bibliotek, forlob-helpers, og opdateret moduler-test).

### Kommandoer

```bash
npm run dev                                # start dev-server
npm test                                   # 274 tests
npm run migrate:lektioner [-- --dry]       # vanetracker lessons → forløbsdage
npx tsx scripts/_set-forlob-startdato.ts <forlobId> <YYYY-MM-DD>
```

### Test-brugere (uændret)

- `forlob@linnsacademy.dk` (Maria) — forløbskunde, knyttet til kickstart_maj_2026
- `modul@linnsacademy.dk` (Anne) — modulbruger, ingen forløb, Bibliotek låst
- `udlobet@linnsacademy.dk` (Sofia) — udløbet
- `linnabildtrup00@gmail.com` (Linn, admin)

---

## Åbne tråde / kendte mangler

### Video-hosting (top-prioritet for næste session)

1. **YouTube-links er ikke professionelt** — Linn vil have en bedre afspilnings-oplevelse uden reklamer, "op næste"-anbefalinger og YouTube-branding. Diskussion sluttede med tre alternativer:
   - **Vimeo Pro** (~1.500 kr/år, drop-in nu) — ingen kode-ændringer, bare upload videoer og opdater URL'er i admin. Vores `videoEmbedUrl` understøtter allerede Vimeo.
   - **Mux** (pay-per-use, ~700 kr pr 100-personers forløb) — egen player, signed URLs, dybere analytics. Kræver 1-2 dages udvikler-arbejde til upload-pipeline + integration af `<mux-player>`.
   - **Firebase Storage + Plyr/video.js** (næsten gratis) — egen player, ingen adaptive streaming. Mest arbejde, mindst skalérbar.
   
   Min anbefaling var Vimeo Pro som første skridt. Linn skal beslutte. **Næste session bør starte med denne diskussion — det er den eneste reelle blocker for at "lukke" Kickstart-forløbet med kvalitet.**

### Indhold der mangler

2. **Lektioner for dag 15-21** — eksisterer ikke i vanetracker-data. Linn skal manuelt tilføje dem via `/app/admin/forlob/kickstart_maj_2026/lektioner/{N}`.
3. **Beskrivelser, varighed og format** på de migrerede lektioner — alle har titel + URL men beskrivelse er tom. Kan udfyldes via admin.
4. **FAQ og guides** for Kickstart maj 2026 — strukturen er klar men ingen indhold endnu. Linn skal selv udfylde, eller vi kan migrere fra ref-app hvis det findes der.

### Klient-side polering (åbne fra v15)

5. **Dagbog mangler edit-flow** (30-30-3) — slet-knap virker, men man kan ikke ændre et gemt måltid (skal slettes og gemmes igen)
6. **Dagbog viser kun én dag ad gangen** — uge/måned-visning kunne tilføjes
7. **Indkøbsliste fra opskrifter** — eksisterer i ref-app, ikke implementeret
8. **3 ingredienser kan ikke auto-matches** — jalapeño, flankesteak, sødkartoffel findes ikke i Frida eller ref-app's database

### Adgangskontrol (åbne fra etape 11)

9. **modulbrugere kan stadig klikke på Kickstart-moduler** — der er ingen tjek på `userDoc.state === 'forlobskunde'` før modul vises på `/app/moduler` eller før klient-sider loades. Bør tilføjes konsistent. Bibliotek er nu låst (gjort i denne session) men de andre forløbs-specifikke moduler er stadig åbne.
10. **Mikrotræning er ikke bundet til `forlobId`** — bruger stadig `userProduct.programValg.mikrotraening` direkte.
11. **Profilside viser ikke hvilket forløb brugeren er på**

### Andre moduler der mangler

12. **`/app/moduler/traening/+page.svelte`** viser kun Mikrotræning hardkodet — skal hente programmer dynamisk når der kommer flere træningsformer
13. **Live Q&A** — ref-app har lessons der hedder "Live Q&A" med Zoom-link e.l. Det fungerer som et almindeligt link i den nuværende model, men kunne have en bedre kalender-integration

### Kosmetiske

14. **B1 modul-grid på forsiden** ignorerer hvad brugeren har købt (åben fra etape 8)
15. **Wake Lock-knappen** vises selv på browsere uden API-support
16. **scripts/vanetracker-key.json** bør slettes når Linn er færdig med migration (giver fuld adgang til den gamle database)
17. **Strip-chips kunne være kortere på mobil** — pt 52px min-width × 22 chips = 1144px scroll, hvilket er fint men kan optimeres

---

## Commits fra denne session

```
93a19a0 Tilpas Dagens små skridt til den valgte dag
4cc55a9 Skift forløbets dagsindeksering til 0-baseret
3b2695d Omdøb 'Dagens action' til 'Dagens små skridt'
971f81a Fjern indhold-prikken fra strip-chips
99ecb85 Vis måned i dato-strip-chips
8a22c5e Tilføj horizontal dato-strip til forsiden
24b0280 Distinkt look for vanedage med 0 udfyldte vaner
8372b02 Omdøb modul-titlen 30-30-3 til 30-30 beregner
d1f877b Auto-afspil dagens lektion fra forsiden
4e90283 Migrer lektioner fra vanetracker til Kickstart maj 2026
5261fce Tilføj Firestore-rules for forlobsdage
858f012 Opdater forsiden til at læse forløb fra Firestore
f72bc69 Byg admin-side til lektioner pr forløb
d91582f Byg klient-side til Mit forløb-modulet
a15d1ac Tilføj Firestore-helpers for forløbsdage
8e2eae8 Erstat forlob.ts mock med rigtig datamodel
70aed43 Udvid kopierForlobIndhold til at kopiere guides
7868cbd Tilføj Firestore-rules for guide-collections
ac16708 Tilføj Guides-sektion til admin-bibliotek
9e61bee Erstat Guides-placeholder med rigtig liste
ff07942 Tilføj Firestore-helpers for Guides
6ff63f8 Tilføj datamodel for Guides
fa79e8c Udvid kopierForlobIndhold til at kopiere FAQ
9e03645 Tilføj Firestore-rules for FAQ-collections
c6abe44 Byg admin-side til FAQ pr forløb
d3acd61 Byg klient-side til Bibliotek (FAQ-tab)
e0a5248 Tilføj Firestore-helpers for FAQ
60d9bcf Tilføj datamodel for Bibliotek (FAQ + senere guides)
0312d5c Lås Bibliotek for modulbrugere
```

Branchen `etape-9-mikrotraening` er 28 commits foran `origin/etape-9-mikrotraening`. Skal pushes når Linn er klar.

---

## Til næste Claude-instans

1. **Linn taler dansk** — svar på dansk, ingen em-dashes/semikolons/lange tankestreger
2. **Hele filer, ikke linje-for-linje edits** ved større ændringer
3. **Små commits ofte** — hvert lag/skridt sin egen commit. v16 er nogle commits der dækker flere ting i én — kunne have været delt op bedre.
4. **Tjek altid `npx svelte-check` og `npm test`** efter ændringer
5. **CSS-variabler** følger `--ff-d`, `--text2`, `--bg2`-konventionen
6. **Bo håndterer terminalen** — antag intet om udvikler-kontekst
7. **Reference-app i `reference/index.html`** — alle features kan slås op
8. **Firestore-rules** copy-pastes manuelt til Firebase Console når ændret
9. **Forløbs-modellen er førsteklasses** — alt forløbs-specifikt indhold ligger under `forlob/{id}/...` og kopieres automatisk via `kopierForlobIndhold`
10. **Forløbs-konvention er nu 0-baseret** — startDato = dag 0 = baseline. Dag 1-antalDage = programdage. `getCurrentDay` returnerer 0 på startdagen.
11. **TabBar har Admin-tab kun for admin-brugere** (matcher ADMIN_EMAILS i src/lib/admin.ts)
12. **`kopierForlobIndhold` i `src/lib/firestore/forlob.ts`** kopierer nu vaneprogram, forlobsdage, faqKategorier, faqItems, guideKategorier og guideItems. Hvis nye sub-collections tilføjes, skal de også med her.
13. **Migrations-scripts** — alle kører lokalt med admin-SDK. xlsx/csv/key.json er gitignored
14. **Video-håndtering** — `videoEmbedUrl` i `src/lib/content/bibliotek.ts` understøtter YouTube + Vimeo. Hvis vi skifter til Mux, skal helperen udvides med `mux-player` web component eller `@mux/mux-player` npm-pakken.
15. **Vimeo-migration er en ren admin-opgave** — bare opdater URL'erne i `/app/admin/forlob/[id]/lektioner/[dag]` og `/app/admin/forlob/[id]/bibliotek?tab=guides`. Ingen kode-ændringer nødvendige.

---

## Næste session — første handling

Spørg Linn hvilken video-hosting hun har valgt:
- **Hvis Vimeo:** ingen kode fra os. Hun uploader videoer, opdaterer URL'er i admin. Færdig.
- **Hvis Mux:** vi designer upload-flow + integrerer mux-player. Plan: 1-2 dage. Plus MUX_TOKEN_ID + MUX_TOKEN_SECRET skal gemmes som env-vars.
- **Hvis Firebase Storage + Plyr:** vi bygger upload til Firebase Storage og integrerer Plyr-player. Plan: 1 dag. Bemærk at videoerne er ikke adaptive — overvej filstørrelse-grænse.

Held og lykke med video-etapen.
