# Handover til næste chat — v13

Status efter session 14 (7. maj 2026). **Etape 11 vanetracker (klient + admin) er færdig.** Maria kan nu åbne /app/moduler/vaner, gennemføre baseline-check-in, svare på daglige vaner og bonus-skridt, og lave sliders-check-in på dag 7/14/21. Linn kan redigere alle dage via admin-UI.

---

## TL;DR

**Etape 11 er færdig.** Vanetracker virker fra ende til ende:

- Klient: hjem-side med 21-dages grid (flower-farver), dag-side med refleksion + Ja/Delvist/Nej-knapper + bonus + note + check-in-sliders
- Admin: program-liste, dag-for-dag editor (refleksion, vaner, bonus, isCheckin/isBaseline/isWin)
- Datalag: `vaneProgrammer/{id}` versioneret indhold + `users/{uid}/products/kickstart/vanedage/{N}` brugerens svar
- Seed-script `npm run seed:vaneprogram` opretter `kickstart_v1` med VT_PROGRAM porteret 1:1 fra ref-app
- Login-flow allerede dækket fra etape 10 — Maria er forløbskunde med forlobId='kickstart_maj_2026'
- Firestore-rules opdateret (skal manuelt copy-pastes til Console)

**Næste skridt:** Etape 12 — vælg blandt: 30-30-3 beregner, opskrifter, FAQ, Guides eller "Mit forløb"-modulet.

---

## ⚠️ Vigtigt: Firestore-rules skal opdateres i Console

`firestore.rules` har nu regler for `vaneProgrammer` og `users/{uid}/products/{productId}/vanedage`. De skal manuelt copy-pastes til Firebase Console før klient-flowet virker:

1. Åbn Firebase Console → Firestore Database → Rules
2. Erstat indholdet med `firestore.rules` fra repoet
3. Tryk Publish

---

## Hvad der er bygget i denne session

### Datalag — `src/lib/content/vaner.ts`

**Typer:**
- `Vane`, `Bonus` — enkelt-spørgsmål-strukturer (id + label)
- `VaneProgramDag` — programmets indhold pr dag (refleksion, checks, bonus, isCheckin/isBaseline/isWin)
- `VaneProgram` — toplevel-doc (navn, antalDage, aktiv)
- `VaneSvar` ('ja'|'delvist'|'nej') og `BonusSvar` ('ja'|'nej')
- `CheckinSvar` med 5 numeric felter + generelTekst
- `VanedagEntry` — brugerens samlede svar for én dag

**Pure-funktioner (31 nye unit tests):**
- `beregnDagsStatus` — empty / partial / completed for både baseline og almindelige dage
- `beregnFlowerNiveau` — excellent/good/medium/low/poor/none baseret på %-ja/delvist
- `vaneStatistik` — score for én vane på tværs af alle besvarede dage
- `beregnSamletFremgang` — antal completed dage af unlocked

**Konstant:** `CHECKIN_SPORGSMAAL` med fem sliders: energi, mave, cravings, humor, sovn.

### Firestore-helpers — `src/lib/firestore/vaner.ts`

- `hentAlleVaneProgrammer()`, `hentVaneProgram(programId)` — admin + klient læser
- `gemVaneProgramDag(programId, dag)` — admin skriver
- `hentAlleVanedage(uid, productId)`, `hentVanedag(uid, dagNummer, productId)`, `gemVanedag(uid, entry, productId)` — bruger læser/skriver egne svar

### Seed — `scripts/seed-vaneprogram.ts`

`npm run seed:vaneprogram` opretter:
- `vaneProgrammer/kickstart_v1` (navn, beskrivelse, antalDage=21, aktiv=true)
- 22 dage i subcollection (baseline + dag 1-21) porteret 1:1 fra `reference/index.html`
- Sætter `vaneProgramId='kickstart_v1'` på `forlob/kickstart_maj_2026`

### Klient-UI

**`/app/moduler/vaner/+page.svelte`** — Hjem:
- Header med beskrivelse
- "Start dit baseline-check-in" eller "Åbn dag X" knap (peger på næste ikke-gennemførte)
- Baseline-row som separat element øverst
- Stats-card med fremgangsbar (X / 21 dage)
- 21 dage opdelt i 3 uger med flower-farve pr dag
- Hvis forløbet ikke er startet: banner med startdato

**`/app/moduler/vaner/[dag]/+page.svelte`** — Dag-side:
- Refleksionsspørgsmål med textarea
- Vaner som rækker med Ja/Delvist/Nej-knapper (sage-grøn/gold/grå når aktiv)
- Bonus-skridt med Ja/Nej (toggleable — klik samme værdi igen fjerner)
- Fremgangsbar
- Check-in-sektion (kun hvis isCheckin/isBaseline) med 5 sliders
- Generelt fritekst-felt (kun baseline + dag 21)
- Dag 21 viser baseline-svar som "før"-sammenligning
- Edit-tilstand: nye dage starter aktive, gemte dage skal låses op via "Rediger svar"
- Status-badge "Gemt"/"Redigerer"

### Admin-UI

**`/app/admin/vaner/+page.svelte`** — Programliste

**`/app/admin/vaner/[programId]/+page.svelte`** — Dag-oversigt:
- Liste over alle dage med badges (Baseline/Check-in/#win)
- Preview af refleksionsspørgsmål
- Klik åbner editor

**`/app/admin/vaner/[programId]/[dag]/+page.svelte`** — Dag-editor:
- Refleksion-textarea
- Uge + checkboxes for isCheckin/isBaseline/isWin
- Faste vaner (id + label, kan tilføjes/fjernes dynamisk)
- Bonus-skridt (kan aktiveres/fjernes)
- Gem-knap der overskriver hele dagen som ny doc

### Aktivering

- Vaner-rækken på `/app/moduler` linker nu til `/app/moduler/vaner`
- Admin-landing-side har Vaner mellem Forløb og Mikrotræning

### Firestore-rules

Tilføjet:
- `vaneProgrammer/{id}` + `/days/{dayId}` — alle læser, admin skriver
- `users/{uid}/products/{productId}/vanedage/{dagId}` — kun egen bruger

---

## Den tekniske tilstand

### Mappestruktur (relevant for etape 11)

```
src/
├── lib/
│   ├── content/
│   │   ├── vaner.ts                        ← NY (typer + pure logik)
│   │   └── vaner.test.ts                   ← NY (31 tests)
│   └── firestore/
│       └── vaner.ts                        ← NY
└── routes/app/
    ├── admin/vaner/
    │   ├── +page.svelte                    ← NY (programliste)
    │   ├── [programId]/+page.svelte        ← NY (dag-oversigt)
    │   └── [programId]/[dag]/+page.svelte  ← NY (dag-editor)
    └── moduler/vaner/
        ├── +page.svelte                    ← NY (klient hjem)
        └── [dag]/+page.svelte               ← NY (klient dag-side)

scripts/
└── seed-vaneprogram.ts                     ← NY
```

### Firestore-struktur (nye stier)

- `vaneProgrammer/{id}` — toplevel-doc (navn, beskrivelse, antalDage, aktiv)
- `vaneProgrammer/{id}/days/dag{N}` — programdage med spørgsmål
- `users/{uid}/products/kickstart/vanedage/dag{N}` — brugerens svar pr dag
- `forlob/{id}.vaneProgramId` — peger på hvilket vaneProgram forløbet bruger

### Tests

**164 tests passerer** (var 133 — 31 nye for vanetracker-logik).

### Test-brugere (status uændret fra v12)

- `forlob@linnsacademy.dk` (Maria) — på `kickstart_maj_2026`-whitelist, forlobId sat
- `modul@linnsacademy.dk` (Anne) — IKKE på whitelist
- `linnabildtrup00@gmail.com` (Linn, admin)

### Kommandoer

```bash
npm run dev                        # start dev-server
npm test                           # 164 tests
npm run seed:forlob                # opret/opdater Kickstart-forløb
npm run seed:vaneprogram           # opret kickstart_v1 med 22 dage
npm run seed:mikrotraening         # uændret
npm run reset:mikrotraening        # uændret
```

---

## Åbne tråde / kendte mangler

### Etape 11 — næsten færdig, men:

1. **Firestore-rules skal copy-pastes til Console** — ellers fejler klient-flowet
2. **Manuel test mangler** — vi har ikke testet i browser endnu (Maria → Vaner → udfyld baseline → osv.)
3. **Forløbet starter 4. maj 2026** — i dag er 7. maj, så 3 dage er låst op (baseline + dag 1 + dag 2 + dag 3). Hvis du tester på en anden dato vil unlocked-tællingen være anderledes
4. **Win-dage (dag 5, 13, 20) har ingen særlig UI endnu** — kunne vises med ribbon eller anden styling
5. **Stats-card på hjem-side viser kun samlet fremgang** — ref-app har desuden per-vane statistik (PM/FI/MK %) og baseline→uge-graf. Kan tilføjes senere
6. **Reset-script er kun for mikrotræning** — vanedage og fremgang nulstilles ikke. Hvis du vil teste forfra: slet manuelt fra Firestore Console, eller udvid `scripts/reset-mikrotraening.ts`

### Andre kendte huller (uden for etape 11)

7. **Adgangsbegrænsning** — modulbrugere kan stadig klikke på Vaner og få fejl. Skal tjekkes at user.state==='forlobskunde' før modul vises
8. **Mikrotræning skal også bindes til forlobsId** — pt. henter den userProduct.programValg.mikrotraening direkte. Skulle helst hente fra forløb (forlob.vaneProgramId-mønstret)
9. **Profilside** viser ikke hvilket forløb brugeren er på (åben tråd)
10. **Modul-rækkerne for Kost, Mit forløb, Bibliotek er ikke klikbare** — kandidater til etape 12

---

## Commits fra denne session

```
0d9d7b2 Aktiver Vaner-modul + tilføj Firestore-rules
0155d9d Tilføj admin-UI til vaneprogram-editor
b08a58c Tilføj check-in sliders og baseline-sammenligning
ef4883f Tilføj dag-side til vanetracker
af7062e Tilføj vanetracker hjem-side til klienter
3f11be2 Seed vaneprogram kickstart_v1 med 22 dage
c1a877e Tilføj datalag for vanetracker
```

---

## Næste etape (12) — Forslag

Vi har fortsat fire moduler der ikke er bygget endnu:
- **Kost** — opskrifter + indkøbsliste + 30-30-3 beregner (sandsynligvis flere etaper)
- **Mit forløb** — daglig lektion pr dato + baseline check-in (skal nok udfaserer den eksisterende mock)
- **Bibliotek** — guides, FAQ, lektioner (Linn nævnte at FAQ + Guides skal være forløbs-specifikke)
- **30-30-3 beregner** — separat eller del af Kost?

Min anbefaling: **Bibliotek (FAQ + Guides) først** fordi de er enkleste at bygge (mest statisk indhold) og giver en synlig win. Eller **30-30-3 beregner** hvis Linn vil have det først.

---

## Til næste Claude-instans

1. **Linn taler dansk** — svar på dansk, ingen em-dashes/semikolons/lange tankestreger
2. **Hele filer, ikke linje-for-linje edits**
3. **Små commits ofte** — hvert lag/skridt sin egen commit
4. **Tjek altid `npx svelte-check` og `npm test`** efter ændringer
5. **CSS-variabler** følger `--ff-d`, `--text2`, `--bg2`-konventionen
6. **Bo håndterer terminalen** — antag intet om udvikler-kontekst
7. **Reference-app i `reference/index.html`** — alle features kan slås op
8. **Firestore-rules** copy-pastes manuelt til Firebase Console når ændret
9. **Forløbs-modellen er førsteklasses** — alle nye Kickstart-features (kost, opskrifter, FAQ, Guides) skal binde sig til `forlobId` i klient-data og versionere indhold via egne `/{programId}`-collections som vaneProgrammer
10. **TabBar har Admin-tab kun for admin-brugere** (matcher ADMIN_EMAILS i src/lib/admin.ts)

Held og lykke med næste etape.
