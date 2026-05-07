# Handover til næste chat — v14

Status efter session 15 (7. maj 2026). **Etape 12 er færdig — 30-30-3-modulet** med beregner og opskrifter er bygget på klient og admin.

---

## TL;DR

- **30-30-3 beregner** med slå-op + byg-måltid på `/app/moduler/30-30-3/beregner`
- **Opskrifter** med liste + detalje på `/app/moduler/30-30-3/opskrifter`
- **Fødevaredatabase** med 840 items i Firestore (porteret 1:1 fra ref-app)
- **Admin** til opskrifter på `/app/admin/opskrifter` — opret, rediger, slet
- Modulet er aktivt i `/app/moduler` for forløbskunder
- 205 tests passerer (var 164 — 41 nye)

**Næste skridt:** Etape 13 — vælg blandt FAQ, Guides eller Mit forløb.

---

## ⚠️ Vigtigt: Firestore-rules skal opdateres i Console

`firestore.rules` har nu regler for `fodevarer` og `opskrifter`. Copy-paste til Firebase Console før klienterne kan læse data.

---

## Hvad der er bygget i denne session

### Datalag — kost (fødevarer)

**`src/lib/content/kost.ts`** — typer + pure-funktioner:
- `Fodevare` med kategori, protein/fiber pr 100g, portion-enheder
- `MaaltidsItem` — fødevare + portion + valgt enhed
- `gramForEnhed`, `beregnItem`, `beregnMaaltid`, `procentMod`, `formatGram`
- `filtrerFodevarer`, `sorterFodevarer` (alfabetisk / mest protein / mest fiber)
- 27 unit tests

Kategorier matcher ref-app: mejeri, koed, fisk, baelg, korn, gront, baer, noedder, prot, drikke, andet.

**`src/lib/firestore/kost.ts`** — `hentAlleFodevarer`, `hentFodevare`, `gemFodevare`.

### Datalag — opskrifter

**`src/lib/content/opskrifter.ts`** — typer + pure-funktioner:
- `Opskrift` med kategorier, ingredienser, defaultPortioner, instruktioner
- `OpskriftKategori`: morgenmad/frokost/aftensmad/snack/dessert/tilbehor
- `skalerMaengde` — skalering ved ændret antal portioner
- `formatMaengde` — dansk komma-separator (1,5 i stedet for 1.5)
- `filtrerOpskrifter` — søgeord + kategori-OR-logik
- 14 unit tests

**`src/lib/firestore/opskrifter.ts`** — CRUD-helpers med automatisk oprettet/opdateret-timestamps.

### Klient-UI

**`/app/moduler/30-30-3/+page.svelte`** — toplevel med to genveje (Beregner + Opskrifter).

**`/app/moduler/30-30-3/beregner/+page.svelte`** — to tabs:
- **Slå op**: søgefelt, sort-knapper, kategori-chips, liste over alle 840 fødevarer med plus-knap
- **Byg måltid**: to total-cards (protein/fiber mod 30g med fremgangsbar), liste over tilføjede items med portion-input + enhedsdropdown, picker-modal til at vælge fødevare, + Tilføj-knap, Nulstil-knap

**`/app/moduler/30-30-3/opskrifter/+page.svelte`** — liste:
- Søgefelt
- Multi-select kategori-chips (OR-logik)
- 2-kolonne grid med billede + titel + kategori-badges

**`/app/moduler/30-30-3/opskrifter/[id]/+page.svelte`** — detalje:
- Hero-billede (eller emoji-fallback)
- Titel + kategori-badges + beskrivelse
- Ingredienser-card med portion-justering (- / +) der live-skalerer mængderne
- Fremgangsmåde-card med fri tekst

### Admin-UI

**`/app/admin/opskrifter/+page.svelte`** — liste med thumb + status-badge. + Opret-knap genererer tomt doc og redirecter til editor.

**`/app/admin/opskrifter/[id]/+page.svelte`** — editor med fire sektioner:
- Generelt: titel, beskrivelse, billede-URL, kategori-chips, default-portioner, aktiv-checkbox
- Ingredienser: dynamisk liste med flyt op/ned + fjern
- Fremgangsmåde: stort textarea
- Slet med to-trins bekræftelse

### Seed-script

**`scripts/seed-fodevarer.ts`** + **`scripts/foods-data.ts`** (PF_FOODS porteret) — `npm run seed:fodevarer` skriver 840 items i 400-batches til `fodevarer/{id}`.

### Aktivering

- `/app/moduler` har nu `kost`-modulet bundet til `/app/moduler/30-30-3`
- `/app/admin` har Opskrifter-rækken med sage-grøn accent
- Firestore-rules har `fodevarer` og `opskrifter` med læs-for-alle, skriv-for-admin

---

## Bevidst ude af scope (kan tilføjes senere)

- **Måltidsdagbog** — gem måltider pr dag, se total-fiber over dagen
- **Favoritmåltider** — gem brugerdefinerede måltids-skabeloner
- **Indkøbsliste** — markér opskrifter, generer indkøbsliste, eksport til PDF
- **Custom fødevarer fra klient** — admin-only nu, klient-add senere
- **Diet-tags på opskrifter** (vegetar/glutenfri osv.) — kan tilføjes som ekstra felt
- **Billede-upload til Firebase Storage** — pt. URL-input, upload-funktion senere
- **Forløbs-specifikke opskrifter** — alle er globale nu

---

## Den tekniske tilstand

### Mappestruktur (relevant for etape 12)

```
src/
├── lib/
│   ├── content/
│   │   ├── kost.ts                            ← NY (fødevarer)
│   │   ├── kost.test.ts                       ← 27 tests
│   │   ├── opskrifter.ts                      ← NY
│   │   └── opskrifter.test.ts                 ← 14 tests
│   └── firestore/
│       ├── kost.ts                            ← NY
│       └── opskrifter.ts                      ← NY
└── routes/app/
    ├── admin/opskrifter/
    │   ├── +page.svelte                       ← NY
    │   └── [id]/+page.svelte                  ← NY
    └── moduler/30-30-3/
        ├── +page.svelte                       ← NY (toplevel)
        ├── beregner/+page.svelte              ← NY
        ├── opskrifter/+page.svelte            ← NY
        └── opskrifter/[id]/+page.svelte       ← NY

scripts/
├── foods-data.ts                              ← NY (840 fødevarer)
└── seed-fodevarer.ts                          ← NY
```

### Firestore-struktur (nye stier)

- `fodevarer/{id}` — fødevaredatabase (840 items efter seed)
- `opskrifter/{id}` — opskrifter (oprettes via admin)

### Tests

**205 tests passerer** (var 164 — 41 nye for kost/opskrifter).

### Kommandoer

```bash
npm run dev                          # start dev-server
npm test                             # 205 tests
npm run seed:fodevarer               # seed 840 fødevarer (idempotent)
npm run seed:forlob                  # uændret
npm run seed:vaneprogram             # uændret
```

---

## Åbne tråde / kendte mangler

### Etape 12 — næsten færdig:

1. **Firestore-rules skal copy-pastes til Console** — kritisk
2. **Manuel test mangler** — vi har ikke testet i browser endnu
3. **Ingen opskrifter er seedet** — Linn skal oprette dem manuelt via admin (eller vi kan lave seed senere)
4. **Beregner gemmer ikke måltid** — bygmåltid-state lever kun i komponentens lokale state. Persistens (dagbog) kommer i en senere etape
5. **Billede-upload mangler** — pt. kun URL-input. Firebase Storage-integration kommer senere

### Andre kendte huller

6. **Adgangsbegrænsning** — modulbrugere kan stadig klikke på 30-30-3 og få fejl. Skal tjekkes at user.state==='forlobskunde' før modul vises
7. **B1 modul-grid på forsiden ignorerer købte moduler** (åben tråd fra etape 8)
8. **`/app/moduler/traening/+page.svelte`** viser kun Mikrotræning hardkodet
9. **Mit forløb og Bibliotek er ikke klikbare endnu** — kandidater til etape 13

---

## Commits fra denne session

```
36dec61 Tilføj admin-UI til opskrifter
270b070 Tilføj klient-UI til opskrifter
d4e862f Tilføj datalag for opskrifter
ddc4e20 Tilføj 30-30-3 beregner med slå-op og byg-måltid tabs
ef5653e Tilføj 30-30-3 hjem-side med to genveje
f3ba9dd Seed 840 fødevarer til fodevarer-collection
3f82b7a Tilføj datalag for kost-modulet (fødevarer)
```

Plus aktivering + handover som sidste commit.

---

## Næste etape (13) — Forslag

Tilbageværende moduler:
- **FAQ** (forløbs-specifik) — sandsynligvis enkleste at bygge, klart afgrænset scope
- **Guides** (forløbs-specifik) — meget lig FAQ men længere indhold med billeder/video
- **Mit forløb** — daglig lektion pr dato, baseline-check-in. Erstatter mock på forsiden

Min anbefaling: **FAQ + Guides samlet** som "Bibliotek"-modul (lignende 30-30-3-mønster). Begge er forløbs-specifikke og kan deles om en fælles indholds-base.

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
9. **Forløbs-modellen er førsteklasses** — FAQ og Guides skal være forløbs-specifikke som vaneprogrammet (lever under `forlob/{id}/...`)
10. **TabBar har Admin-tab kun for admin-brugere** (matcher ADMIN_EMAILS i src/lib/admin.ts)
11. **Kopi-funktionalitet** — `kopierForlobIndhold` i `src/lib/firestore/forlob.ts` er designet til at udvides med FAQ/guides når de bygges. Husk at tilføje dem dér så nye forløb kan starte med komplet indhold

Held og lykke med næste etape.
