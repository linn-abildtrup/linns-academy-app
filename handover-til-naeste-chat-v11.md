# Handover til næste chat — v11

Status efter session 12 (7. maj 2026). **Etape 9 mikrotræning er nu komplet** — onboarding, dag-side, workout-spiller med video, lyd, wake lock og pause-på-tværs-af-session er alle bygget og testet.

---

## TL;DR

**Etape 9 fase 3 og 4 er færdige.** Brugeren kan nu:

- Lande på onboarding-flowet ved første mikrotræning-besøg og vælge med/uden kettlebell
- Åbne en dag og se øvelser
- Trykke Start træning og køre en hel workout med:
  - Stor video pr øvelse
  - Cirkel-timer med fase-farve (grøn arbejd, terra hvil, mørk prep)
  - Switch-overlay med PiP af næste øvelse i 15 sek
  - Baggrundsmusik der pauser med træningen
  - Talt nedtælling 3-2-1 + GO/PAUSE ved fase-skift (musik duckes til 0)
  - Wake lock så skærmen ikke slukker
  - Pause-på-tværs-af-session via Firestore
- Gennemføre træningen, vælge feedback (Let / Tilpas / Udfordrende)
- Se dagen markeret som klaret på hjemsiden

**Begge programmer har nu 21 dages indhold:**
- `mikrotraening_kettlebell` (Marias program)
- `mikrotraening_no_kettlebell` — auto-genereret med 21 dage kropsvægts-øvelser i denne session

**Næste skridt:** Manuel test af udløbet-bruger-flow, eller gå videre til etape 10 (et af de andre moduler — Kost, Vaner, Mit forløb, Bibliotek).

---

## Hvad der er bygget i denne session

### Workout-spilleren (fase 4)

Ny rute: `/app/moduler/traening/mikrotraening/[dag]/spil/+page.svelte`

State-maskine cycler `prep → work → rest → switch → done`.

**Lag-på-lag, hvert sit commit:**

1. **Basal player** (`1ad1e94`) — state-maskine, video, cirkel-timer, fase-badge, bonus-ribbon, switch-PiP, pause/stop-knapper
2. **Finish-card + feedback** (`fe1d3af`) — gem træning til `fremgang.gennemforte`, bottom-sheet feedback-modal til `fremgang.feedback[dagNummer]`
3. **Aktiver Start træning-knap** (`b6d0a4b`) — linker til `/spil`-undersiden
4. **Baggrundsmusik** (`7bcab31`) — loop af `baggrundsmusik.mp3`, mute-toggle, $effect synkroniserer playback med pause/done
5. **Talt nedtælling** (`537c050`) — ved `rem === 3` afspilles `nedtaelling-go.mp3` (mod work) eller `nedtaelling-pause.mp3` (mod rest/switch). Sidste sæt af sidste øvelse springes over så finish-flowet ikke afbrydes. Musik duckes til 0 i 5 sek
6. **Wake Lock** (`65c2b4a`) — `navigator.wakeLock.request('screen')` ved start, frigiv ved finish/stop. `visibilitychange`-listener re-acquirer ved fane-skift. Toggle-knap stables med lyd-knappen
7. **Pause-på-tværs-af-session** (`506b18e`) — `gemPause` ved Stop og `beforeNavigate`. `hentPause` ved page-load auto-resumer state. Banner viser "Du fortsætter hvor du slap" + "Start forfra"-link. `sletPause` ved gennemførsel
8. **Fix PiP-overlay** (`85939fe`) — `ei++` udskudt fra work→switch-overgangen til switch→work-overgangen, så aktuelExercise i switch-fasen er den forrige (sløret bag PiP) og naesteExercise er den nye (vises i PiP-card)

### Onboarding (fase 3)

Ny rute: `/app/moduler/traening/mikrotraening/onboarding/+page.svelte`

To store knapper (🔔 kettlebell / 💪 uden) der gemmer `programValg.mikrotraening` via `gemProgramValg`-helperen. Mikrotræning-hjem, dag-side og spil-side redirecter alle til onboarding hvis programvalg mangler.

### Datalag

**`src/lib/firestore/mikrotraening.ts`** — fem nye helpers:

- `gemMikrotraeningFremgang(uid, productId, fremgang)` — opdaterer `fremgang.mikrotraening`-feltet
- `gemProgramValg(uid, productId, treaningsform, programId)` — sætter `programValg.{treaningsform}` via dot-path
- `hentPause(uid, programId, dag)`, `gemPause(uid, pause)`, `sletPause(uid, programId, dag)` — pause-state-håndtering på `users/{uid}/pauses/{programId}_{dag}`

**`src/lib/content/mikrotraening.ts`** — to nye pure-funktioner:

- `markerDagSomGennemfort(fremgang, dag)` — idempotent, sorteret
- `registrerFeedback(fremgang, dag, feedback)` — overskriver eksisterende
- 8 nye unit tests dækker begge

### Lyd og scripts

**`scripts/upload-audio.ts`** + `npm run upload:audio` — uploader alle .mp3-filer fra `sounds/` til `/audio/` i Storage. Allerede kørt: baggrundsmusik (3.89 MB), nedtaelling-go, nedtaelling-pause, pause.

**`scripts/reset-mikrotraening.ts`** + `npm run reset:mikrotraening [-- <uid>]` — fjerner programValg, nulstiller fremgang, sletter pauses for en bruger. Bruges til at teste onboarding-flowet forfra. Defaulter til Marias UID.

**`scripts/inspect-program.ts`** + `npm run inspect:program [-- <programId>]` — viser status på et program, lister tomme/fyldte dage. Uden arg lister alle programmer.

**`scripts/auto-generate-program.ts`** + `npm run generate:program -- <programId>` — fylder et programs days-collection med 1 ben + 1 overkrop + 1 core/stabilitet pr dag, filtreret på programmets `udstyr`-felt. Kørt på `mikrotraening_no_kettlebell` i denne session.

### `.gitignore`

`/sounds` tilføjet — lyd-filerne er kun i Linns lokale klon, ikke i repoet.

---

## Den tekniske tilstand

### Mappestruktur (relevant for etape 9)

```
src/
├── lib/
│   ├── content/mikrotraening.ts        ← typer + pure logik (4 nye fns)
│   ├── content/mikrotraening.test.ts   ← 33 unit tests (8 nye)
│   ├── firestore/mikrotraening.ts      ← Firestore-helpers (5 nye fns)
│   └── utils/storage.ts                ← getVideoUrl, getAudioUrl
└── routes/
    └── app/
        ├── admin/mikrotraening/        ← uændret fra v10
        └── moduler/traening/mikrotraening/
            ├── +page.svelte            ← redirecter til /onboarding
            ├── onboarding/+page.svelte ← NY
            └── [dag]/
                ├── +page.svelte         ← Start-knap aktiveret
                └── spil/+page.svelte    ← NY (workout-player)
scripts/
├── seed-mikrotraening.ts        ← uændret
├── upload-videos.ts             ← uændret
├── upload-audio.ts              ← NY
├── reset-mikrotraening.ts       ← NY
├── inspect-program.ts           ← NY
└── auto-generate-program.ts     ← NY
```

### Firestore-struktur (kendte stier)

- `exercises/{id}` — øvelsesbiblioteket (23 dokumenter)
- `trainingPrograms/{id}` + `/days/dag{N}` — to programmer á 21 dage hver, begge fyldte
- `products/kickstart` — produktdefinition
- `users/{uid}/products/kickstart` — bruger-produkt med `programValg.mikrotraening` og `fremgang.mikrotraening: { gennemforte: number[], feedback: Record<string, 'let'|'tilpas'|'udfordrende'> }`
- `users/{uid}/pauses/{programId}_{dag}` — `PauseDoc` for delvise sessioner

### Storage-struktur

- `gs://linns-academy-app.firebasestorage.app/exercises/{filename}.mp4` — 23 videoer
- `gs://linns-academy-app.firebasestorage.app/audio/{filename}.mp3` — 4 lyd-filer

### Tests

**93 tests passerer** (var 85 før denne session — 8 nye for fremgang-helpers). Kør med `npm test`.

### Test-brugere (uændret)

- `forlob@linnsacademy.dk` (Maria) — Marias `programValg.mikrotraening` er pt. **fjernet** så hun rammer onboarding-flowet næste login. Sæt den tilbage med `npm run reset:mikrotraening` (det også sletter eventuel resterende fremgang/pauser, så onboarding kan testes rent)
- `modul@linnsacademy.dk` (Anne)
- `udlobet@linnsacademy.dk` (Sofia)
- `linnabildtrup00@gmail.com` (Linn, admin)

Maria's UID: `NxqDU9r5VJhDSNP1PnFa5UimntC2`

### Kommandoer

```bash
npm run dev                            # start dev-server
npm test                               # kør alle tests (93)
npm run seed:mikrotraening             # idempotent seed af programmer + Maria
npm run upload:videos                  # upload videoer til Storage
npm run upload:audio                   # upload lyd-filer til Storage
npm run reset:mikrotraening [-- <uid>] # nulstil bruger til onboarding-state
npm run inspect:program [-- <id>]      # status på programmer
npm run generate:program -- <id>       # auto-fyld dage med standardprogram
npx svelte-check --tsconfig ./tsconfig.json   # type-check
```

---

## Åbne tråde / kendte mangler

### Etape 9 — næsten færdig

1. **Manuel test af udløbet-bruger-flow** — Sofia (`udlobet@linnsacademy.dk`) skulle gerne blokeres fra mikrotræning. Ikke verificeret. Hvis det fejler, skal `hentUserProduct` evt. tjekke `udloberDato` og redirecte
2. **Wake Lock-knappen vises selv på browsere uden API-support** — kan skjules hvis `'wakeLock' in navigator` er false (lille forfining)
3. **iOS user-gesture / autoplay** — vi har ikke verificeret at lyd og video starter rent på iOS-Safari uden eksplicit klik på player-siden. Hvis det er et problem, kan vi tilføje en "Tap for at starte"-overlay

### Andre kendte huller (uden for etape 9)

4. **B1 modul-grid på forsiden ignorerer hvad brugeren har købt** (åben tråd fra etape 8)
5. **`/app/moduler/traening/+page.svelte` viser kun Mikrotræning hardkodet** — skal hente programmer dynamisk fra Firestore når der kommer flere træningsformer (yoga osv.)
6. **Modul-rækkerne for Kost, Vaner, Mit forløb, Bibliotek er ikke klikbare** — venter på at deres sider bygges (kandidater til etape 10+)
7. **handover-til-naeste-chat-v9.md er slettet** — denne session fjernede den

---

## Commits fra denne session (chronologisk)

```
2ee33d1 Tilføj fremgang-helpers til workout-spilleren
1ad1e94 Tilføj basal workout-player med video, timer og state-maskine
fe1d3af Tilføj finish-card og feedback-modal til workout-spilleren
b6d0a4b Aktiver Start traening-knap saa den linker til workout-spilleren
f758914 Tilføj upload-script til lyd-filer på Firebase Storage
7bcab31 Tilføj baggrundsmusik til workout-spilleren med mute-toggle
537c050 Tilføj talt nedtælling 3-2-1 til workout-spilleren
65c2b4a Hold skærmen tændt under workout via Wake Lock API
506b18e Tilføj pause-på-tværs-af-session via Firestore PauseDoc
85939fe Fix forkert øvelse vist i PiP-overlay under switch
f9757f8 Tilføj onboarding-side for kettlebell-valg
02527ee Redirect til onboarding når mikrotraening-programvalg mangler
b5d14a6 Tilføj reset-script til mikrotraening for testbrugere
8b7bd06 Tilføj inspect- og generate-program scripts + fyld no-kettlebell
```

Tidligere etape 9-commits er beskrevet i v10-handoveren.

---

## Til næste Claude-instans

1. **Læs `MEMORY.md`** hvis det findes — der er memory om Linn, kommunikationsstil, projekt-arkitektur
2. **Linn taler dansk** — svar på dansk, ingen em-dashes/semikolons/lange tankestreger i prosa
3. **Hele filer, ikke linje-for-linje edits**
4. **Små commits ofte** — hvert lag/skridt sin egen commit
5. **Tjek altid `npx svelte-check` og `npm test`** efter ændringer
6. **CSS-variabler** følger `--ff-d`, `--text2`, `--bg2`-konventionen
7. **Bo håndterer terminalen** — han er ikke udvikler, antag intet om kontekst
8. **Reference-app i `reference/index.html`** — alle features kan slås op her
9. **Firestore-rules** ligger i `firestore.rules` og skal manuelt copy-pastes til Firebase Console når ændret (vi har ikke Firebase CLI)
10. **Service-account-key** ligger i `scripts/service-account-key.json` (gitignored)

Held og lykke med næste etape.
