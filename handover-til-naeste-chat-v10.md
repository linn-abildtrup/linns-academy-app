# Handover til næste chat — v10

Dette dokument beskriver hvor Linn's Academy-appen står efter session 11 (7. maj 2026), og hvad næste session bør tage fat på.

---

## TL;DR

**Etape 9 er i gang. Fase 1 og 2 er færdige.** Mikrotræningsmodulet har nu:

- Fuldt øvelsesbibliotek med 23 øvelser i Firestore + 23 videoer i Firebase Storage
- To 21-dages programmer (`mikrotraening_kettlebell` og `mikrotraening_no_kettlebell`)
- Mikrotræning-hjem og dag-side for kunder på `/app/moduler/traening/mikrotraening`
- Admin-side på `/app/admin` med liste, dag-editor og auto-generér-knap
- Firestore-rules der tillader læsning for kunder og skrivning for admin

**Næste skridt:** Fase 4 — bygge selve workout-spilleren med video, timer, faser, og lyd. "Start træning"-knappen på dag-siden er pt. deaktiveret indtil player er klar.

---

## Hvad der er bygget i etape 9

### Datalag

**`scripts/seed-mikrotraening.ts`** — Seed-script der opretter:

- 23 dokumenter i `exercises` (hele øvelsesbiblioteket med navn, beskrivelse, hvordan-trin, kategori, tags, videoPath, udstyr)
- 2 dokumenter i `trainingPrograms` med 42 dage subcollection-dokumenter
- 1 produkt i `products/kickstart`
- 1 user-product-relation under Maria's UID

**`scripts/upload-videos.ts`** — Upload-script der pusher alle .mp4-filer fra `videos-to-upload/` til Firebase Storage `/exercises/`. Total ~28 MB.

**`src/lib/firestore/mikrotraening.ts`** — Firestore-helpers for klient-side:
- `hentProgram(id)` — program + alle dage
- `hentUserProduct(uid, productId)` — bruger-produkt-relation
- `hentExercise(id)`, `hentExercises(ids)` — biblioteket
- `hentAlleProgrammer()`, `hentAlleExercises()` — admin-brug
- `gemDag(programId, dagNummer, dag)`, `gemDage(programId, dage)` — admin-skrivning

**`src/lib/content/mikrotraening.ts`** — Pure-typer og logik (ingen Firestore-kald):
- Typer: `Exercise`, `TrainingProgram`, `TrainingDay`, `DayExercise`, `Product`, `UserProduct`, `MikrotraeningFremgang`, `PauseDoc`, m.fl.
- Pure-funktioner: `beregnDagensTid`, `antalNormaleOvelser`, `harGennemfortDag`, `beregnProgramFremgang`, `naesteDag`, `filtrerOvelserTilProgram`, `genererStandardProgram`

**`src/lib/admin.ts`** — Admin-tjek baseret på email-liste:
- `ADMIN_EMAILS = ['linnabildtrup00@gmail.com']`
- `isAdmin(user)`-helper

### UI for kunder

**`/app/moduler/traening/+page.svelte`** — Træning-modulside (container der lige nu kun viser Mikrotræning, klar til flere programmer)

**`/app/moduler/traening/mikrotraening/+page.svelte`** — Mikrotræning-hjem:
- "Start næste træning"-knap (peger til næste ikke-gennemførte dag)
- Progress-bar med fremgang (X/21)
- 21-dages grid (klikbar). Klaret = grøn, næste = terra, kommer = neutral
- Stat-row med "X dage klaret" og "Y dage tilbage"

**`/app/moduler/traening/mikrotraening/[dag]/+page.svelte`** — Dag-siden:
- Header med dag-nummer og titel
- Liste over dagens øvelser med kategori-label og sets/work/rest
- Bonus-badge for bonus-øvelser
- Done-banner hvis allerede gennemført
- "Start træning"-knap er **deaktiveret** med teksten "Workout-spilleren bygges i næste fase"

**`/app/moduler/+page.svelte`** — Modulsiden er opdateret så Træning-rækken er klikbar (de andre moduler venter på at deres sider bygges).

### UI for admin

**`/app/admin/+layout.svelte`** — Adgangskontrol: redirecter ikke-admins til `/app`

**`/app/admin/+page.svelte`** — Landing-side med liste over admin-områder (lige nu kun Mikrotræning)

**`/app/admin/mikrotraening/+page.svelte`** — Liste over begge programmer

**`/app/admin/mikrotraening/[programId]/+page.svelte`** — Program-detalje:
- "Auto-generér standardprogram"-knap der fylder alle 21 dage med 1 ben + 1 overkrop + 1 core/stabilitet, alle 3 sæt × 30s × 10s
- Liste over 21 dage med opsummering af øvelser. Tomme dage vises med stiplet kant.

**`/app/admin/mikrotraening/[programId]/[dag]/+page.svelte`** — Dag-editor:
- Inputs til titel og indledning
- Liste øvelser med inline-kontrol over sets, workSec, restSec, bonus
- Op/ned-knapper til at flytte rækkefølge
- Slet-knap
- Dropdown til at tilføje øvelse fra biblioteket
- Total-tid-beregning øverst
- "Gem dag"-knap nederst

### Sikkerhed

**`firestore.rules`** — Reglerne ligger nu i version-control. Indeholder:
- `users/{uid}` + `products/` + `pauses/` — kun egen bruger
- `exercises/`, `trainingPrograms/`, `products/` — alle autentificerede kan læse, kun admin (email-tjek) kan skrive

**Vigtigt:** Reglerne skal manuelt copy-pastes ind i Firebase Console når de ændres — vi har IKKE Firebase CLI sat op.

---

## Hvad fase 4 (workout-spilleren) skal indeholde

Fase 4 er det største stykke arbejde i etape 9. Den eksisterende app's workout-flow er beskrevet detaljeret i `reference/index.html` linje 2151+ (`viewMTPlayer`-blok).

### Grundlæggende player (skal bygges først)

Rute: forslag `/app/moduler/traening/mikrotraening/[dag]/spil/+page.svelte`

State-maskine for én træning (fra eksisterende app):
```
WK = { day, exercises[], ei (exercise index), si (set index), phase, rem (sec) }
```

Faser:
- `prep` — 10s "Gør dig klar" før første øvelse
- `work` — workSec for én sæt af én øvelse, video kører
- `rest` — restSec mellem sæt, video kører stadig (samme øvelse)
- `switch` — 15s mellem to forskellige øvelser, PiP-overlay viser næste øvelses navn
- `done` — slut

Hovedelementer:
- Stor video der fylder skærmen (autoplay, loop, muted, playsinline). Hentes via `getVideoUrl(filename)` fra `src/lib/utils/storage.ts`
- Cirkel-timer med farve per fase (work=grøn, rest=terra, prep=mørk)
- Fase-badge øverst til højre
- Bonus-ribbon på bonus-øvelser
- Pause/Stop-knapper
- Switch-overlay med PiP af næste øvelse

Ved gennemførsel:
- "Træning gennemført!" finish-card
- "Gem træning ✓"-knap der opdaterer `userProducts/kickstart/fremgang.mikrotraening.gennemforte`
- Modal med 3 emoji-knapper: Let / Tilpas / Udfordrende — gemmes på `fremgang.mikrotraening.feedback[dagNummer]`

### Lag-på-lag tilføjelser (separate commits)

1. **Baggrundsmusik** — Loop-afspilling, ducker volumen ved nedtælling. Lyd-fil skal uploades til Storage `/audio/baggrundsmusik.mp3`. Linn skal bede om filen — den ligger i den eksisterende app i `sounds/`.

2. **Talt nedtælling** — 3, 2, 1 + pause/go-stemmefiler. Også fra `sounds/` i den eksisterende app. iOS kræver "prime"-trick i user-gesture for autoplay.

3. **Wake Lock** — Hold skærmen tændt under træning. Browser-API: `navigator.wakeLock.request('screen')`. Frigives ved pause/stop/finish.

4. **Pause-på-tværs af session** — Brug `PauseDoc`-typen der allerede er defineret. Gem til Firestore `users/{uid}/pauses/{programId}_{dag}` ved pause/luk. Reload ved næste workout-start.

### Player-state-maskine — pseudokode

```typescript
function tick() {
  WK.rem -= 1;
  if (WK.rem <= 0) advance();
}

function advance() {
  if (phase === 'prep') {
    phase = 'work';
    rem = currentExercise.workSec;
    playVideo(currentExercise);
  } else if (phase === 'work') {
    if (si < currentExercise.sets - 1) {
      phase = 'rest';
      rem = currentExercise.restSec;
    } else {
      // sidste sæt
      if (ei < exercises.length - 1) {
        phase = 'switch';
        rem = SWITCH_SEC;
      } else {
        phase = 'done';
        finish();
      }
    }
  } else if (phase === 'rest') {
    si++;
    phase = 'work';
    rem = currentExercise.workSec;
  } else if (phase === 'switch') {
    ei++;
    si = 0;
    phase = 'work';
    rem = currentExercise.workSec;
    swapVideo(currentExercise);
  }
}
```

---

## Den tekniske tilstand

### Mappestruktur (relevant for etape 9)

```
src/
├── lib/
│   ├── admin.ts                    ← admin-emails konstant
│   ├── content/
│   │   ├── mikrotraening.ts        ← typer + pure logik
│   │   └── mikrotraening.test.ts   ← 25 unit tests
│   ├── firestore/
│   │   └── mikrotraening.ts        ← Firestore-helpers
│   └── utils/
│       └── storage.ts              ← getVideoUrl, getAudioUrl
└── routes/
    └── app/
        ├── admin/
        │   ├── +layout.svelte
        │   ├── +page.svelte
        │   └── mikrotraening/
        │       ├── +page.svelte
        │       └── [programId]/
        │           ├── +page.svelte
        │           └── [dag]/+page.svelte
        └── moduler/
            ├── +page.svelte        ← klikbare rækker
            └── traening/
                ├── +page.svelte
                └── mikrotraening/
                    ├── +page.svelte
                    └── [dag]/+page.svelte
```

### Tests

85 tests passerer (var 76 før etape 9-arbejdet). Kør med `npm test`.

### Test-brugere (uændret)

- `forlob@linnsacademy.dk` (Maria, forløbskunde) — har Kickstart med mikrotræning_kettlebell-program valgt
- `modul@linnsacademy.dk` (Anne, modulbruger)
- `udlobet@linnsacademy.dk` (Sofia, udløbet)
- `linnabildtrup00@gmail.com` (Linn, **admin**) — kan se `/app/admin`

Maria's UID: `NxqDU9r5VJhDSNP1PnFa5UimntC2`

### Kommandoer

```bash
npm run dev                        # start dev-server
npm test                           # kør tests
npm run seed:mikrotraening         # seed Firestore (idempotent)
npm run upload:videos              # upload videoer til Storage
npx svelte-check --tsconfig ./tsconfig.json   # type-check
```

### Firebase

- Projekt: `linns-academy-app` (ikke det gamle `vanetracker`)
- Storage bucket: `linns-academy-app.firebasestorage.app`
- Service-account-key: `scripts/service-account-key.json` (i `.gitignore`)
- Rules: `firestore.rules` i repo + skal manuelt copy-pastes til Firebase Console når ændret

---

## Åbne tråde / kendte mangler

1. **Workout-spilleren mangler** — "Start træning"-knappen er deaktiveret. Det er fase 4 (næste session)
2. **Onboarding mangler** — kettlebell-spørgsmål første gang. Fase 3 — kan tages efter eller før fase 4
3. **B1 modul-grid på forsiden ignorerer hvad brugeren har købt** (åben tråd fra etape 8)
4. **Lyd-filer mangler** — baggrundsmusik.mp3 og nedtællings-stemmer skal uploades til `/audio/` i Storage. Linn skal levere dem fra den eksisterende app
5. **Træning-modulet viser kun Mikrotræning** — når Linn tilføjer flere træningsformer (yoga, etc.) skal `/app/moduler/traening/+page.svelte` udvides til at hente programmer dynamisk fra Firestore i stedet for hardkodet liste
6. **Modul-rækkerne for Kost, Vaner, Mit forløb, Bibliotek er stadig ikke klikbare** — venter på at deres sider bygges
7. **Vi har ikke testet** at udløbede brugere bliver redirected væk fra mikrotræning-siden manuelt
8. **handover-til-naeste-chat-v9.md er forældet** — kan slettes eller arkiveres

---

## Commits fra denne session (etape 9, fase 1+2)

```
03e2a59 Tilføj admin-side til mikrotræning med dag-editor og auto-generér
ff37c10 Tilføj generér-standardprogram og Firestore-skriv-helpers
f992b3d Tilføj Firestore-rules til mikrotræning-collections
6c20437 Tilføj mikrotræning-hjem og dag-side med klikbar Træning-modul
dda0757 Tilføj Firestore-helpers og Træning-modulside
540649b Tilføj 21-dages skeletter for begge mikrotræning-programmer
514a119 Tilføj upload-script til Firebase Storage med npm-kommando
0339c9e Tilføj alle 23 mikrotræning-øvelser til træningsbiblioteket
```

Tidligere commits fra etape 9:

```
1687fc8 Tilføj seed-script til mikrotræning
2715f71 Formater eksisterende filer med prettier
38ff5b7 Tilføj mikrotræning datatyper og hjælpe-funktioner
0b2a082 Tilføj Firebase Storage med helper-funktioner og tests
```

Etape 8 og tidligere er beskrevet i `handover-til-naeste-chat-v9.md`.

---

## Til næste Claude-instans

1. **Læs `MEMORY.md`-indekset** — der er memory-filer om Linn, kommunikationsstil, download-metoden, projekt-arkitektur og etape 9-status
2. **Linn taler dansk** — svar på dansk, ingen em-dashes/semikolons/lange tankestreger i prosa
3. **Hele filer, ikke linje-for-linje edits**
4. **Små commits ofte** — hvert trin er sin egen commit
5. **Tjek altid `npx svelte-check` og `npm test`** efter ændringer
6. **CSS-variabler** følger `--ff-d`, `--text2`, `--bg2`-konventionen — ikke `--font-display` eller andre navne
7. **Bo håndterer terminalen** — han er ikke udvikler, antag intet om kontekst
8. **Linn har eksisterende live-app i `reference/index.html`** — alle features kan slås op her som reference

Held og lykke med fase 4.
