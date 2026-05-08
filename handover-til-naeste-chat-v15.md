# Handover til næste chat — v15

Status efter session 16 (8. maj 2026). **30-30-3-modulet er nu fuldt udbygget** med dagbog, favoritter, smart ingrediens-matching og fuld migration af 71 opskrifter fra den gamle vanetracker-app. Plus 1381 fødevarer fra Frida (DTU).

---

## TL;DR

- **30-30-3-modulet** er sammenflettet til én side med fire tabs: Slå op, Byg måltid, Opskrifter, Dagbog
- **Måltidet persisterer** i localStorage (overlever side-navigation)
- **Dagbogen** gemmer måltider pr dato, grupperet efter type (morgen/frokost/aften/snack), med totaler og fremgang mod 30g-mål
- **Favoritmåltider** kan gemmes ved måltids-gem og genbruges med ét klik. Rediger-knap åbner favoritten i Byg måltid hvor man kan ændre ingredienser/navn og gemme over
- **Opskrifter** importeret fra vanetracker: 58 aktive, alle ryddet for tal-prefiks, med dietTags (vegetar/glutenfri) og kategorier (inkl. ny salat-kategori)
- **Fødevaredatabase** udvidet: 840 fra ref-app + 1381 fra Frida = 2221 fødevarer
- **Auto-match af opskrift-ingredienser** mod fødevaredatabasen rammer 99.5% (564/567) — kun jalapeño, flankesteak og sødkartoffel kan ikke automatisk matches fordi de ikke findes i nogen database
- **228 tests passerer**, 0 type-fejl

**Næste skridt:** Bibliotek (FAQ + Guides), Mit forløb, eller noget andet.

---

## ⚠️ Vigtigt: Firestore-rules skal opdateres

`firestore.rules` har nye regler for `maaltider` og `favoritmaaltider` — copy-paste til Firebase Console før dagbog/favoritter virker for nye brugere. (Maria virker allerede via admin-SDK seed.)

```
match /users/{uid}/maaltider/{mealId} { ... }
match /users/{uid}/favoritmaaltider/{favId} { ... }
```

---

## Hvad der er bygget i denne session

### 30-30-3-refactor til samlet tabs-side

`/app/moduler/30-30-3/+page.svelte` har fire tabs i samme side:
- **Slå op** — søg fødevarer + plus-knap til hurtigt tilføj
- **Byg måltid** — totaler (protein/fiber mod 30g-mål), liste med portion-/enhedskontrol, picker-modal, Gem-/Nulstil-knapper
- **Opskrifter** — søgbar liste med kategori- og diet-tag-filtre
- **Dagbog** — dato-navigation + dagsoversigt med samlet protein/fiber

`?tab=`-query understøttet for deep-links. Måltid persisterer i `localStorage` under nøglen `la_30303_maaltid_v1`.

### Opskrift-migration fra vanetracker

`scripts/migrate-recipes.ts` læser fra det gamle `vanetracker`-projekt (kræver `scripts/vanetracker-key.json`) og kopierer til `opskrifter/`-collection i nye projekt. Mapping af felter:
- title/description/imageUrl/instructions → titel/beskrivelse/billedeUrl/instruktioner
- categories → kategorier (inkl. middagsmad→aftensmad, snacks→snack, salater→salat)
- dietTags → dietTags (vegetar, glutenfri)
- ingredients → ingredienser (med displayName som fallback for navn)

Scriptet springer status='deleted' over (13 stk) og bevarer billeder som inline base64 data-URI'er.

**Resultat:** 58 aktive opskrifter med fuld data, alle aktiveret via `npm run aktiver:opskrifter`, og tal-prefiks ('17. ', '46. ' osv.) ryddet via `npm run ryd:titler`.

### Frida-fødevaredatabase fra DTU

`scripts/seed-frida.ts` parser Data_Table-arket fra Frida v5.5 (xlsx fra [frida.fooddata.dk/data](https://frida.fooddata.dk/data?lang=en)). Kategori gættes via keyword-heuristik på navn (mælk → mejeri osv.). 1381 fødevarer importeret med `frida_<FoodID>`-id'er og `kilde: 'frida'`.

Frida-filen er gitignored (12 MB) — Linn skal selv re-downloade ved opdatering.

### Måltids-dagbog

Datamodel: `users/{uid}/maaltider/{id}` med `navn`, `type` (morgenmad/frokost/aftensmad/snack), `dato` (YYYY-MM-DD), `items` (samme MaaltidsItem-array som byg-måltid), `totalP`, `totalF`.

UI på Dagbog-tab:
- Dato-navigation: piler + dato-input + "I dag"/"I går"-label
- Total-cards for protein og fiber (med fremgangsbar mod 30g)
- Måltider grupperet efter type med slet-knap

Gem-flow: knap på Byg måltid → modal med navn-input, måltidstype-chips (auto-gæt fra klokkeslæt), dato-vælger, og **"Gem også som favorit"-checkbox**.

### Favoritmåltider

Datamodel: `users/{uid}/favoritmaaltider/{id}` med `navn` + `items` (uden dato/type).

UI på Byg måltid-tab (vises hvis favoritter findes og ikke er i rediger-tilstand):
- Horisontalt scrollende række af kort med navn + antal ingredienser
- Klik = indlæs i måltid-state (med bekræftelse hvis allerede et måltid i gang)
- Hvert kort har **✎** (rediger) og **×** (slet) mini-knapper

Rediger-flow:
- Klik ✎ → ingredienser indlæses i Byg måltid + terra-banner øverst med navn-input + annullér-kryds
- Normale Gem/Nulstil-knapper erstattes af "Gem ændringer i favorit" (sage-grøn) + "Annullér redigering"
- `opdaterFavorit` skriver via `setDoc` med merge så oprettet-tidsstempel bevares

### Manuelle items + smart ingrediens-matching

Tidligere: ingredienser fra opskrift der ikke kunne matches blev droppet.

Nu: ALLE ingredienser kommer ind i byg-måltid. Manuelle items vises med sandfarvet baggrund + "Manuel"-badge + "Find"-knap (åbner picker med ingrediensnavn præudfyldt). Klik på en fødevare i pickeren erstatter det manuelle item.

**Smart matching i `findFodevareForIngrediens`** (4 lag):
1. Direkte match (eksakt → ord-grænse → compound → substring)
2. Renset match (samme efter rensning af mængder/tilberedning)
3. Sidste-ord-fallback (`fed hvidløg` → prøv `hvidløg`)
4. Stemming (flertal, compound suffix/prefix, rekursiv strip)

`renseIngrediensNavn` håndterer:
- Komma-suffix: `agurk, i tern` → `agurk`
- "Saft fra X": `saft fra 1/2 citron` → `citron`
- Mængder: `2 spsk`, `100g`, `1/2 dl`, `1 stor`, `en håndfuld`
- Mængdeord: `fed`, `klove`, `stang`, `bundt`, `dåse`
- Tilberedning: `frisk`, `kogt`, `stegt`, `passeret`, `stødt`, `hakket`
- Suffix: `i tern/skiver/strimler`, `til stegning`, `uden tilsat X`

**Stemming** håndterer compound ord:
- Suffix-spaltning: `laksefilet` → `laks`, `chiliflager` → `chili`, `fuldkornslasagneplader` → `lasagne`
- Prefix-spaltning: `fuldkornstortilla` → `tortilla`, `dijonsennep` → `sennep`, `snackpeber` → `peber`
- Flertal: `cherrytomater` → `cherrytomat`, `kyllingebryster` → `kyllingebryst`

Match-rate-progression:
- Original: 65% (368/567)
- Efter første runde: 96% (545/567)
- **Nu: 99.5% (564/567)**

---

## Den tekniske tilstand

### Mappestruktur (relevant for denne session)

```
src/
├── lib/
│   ├── content/
│   │   ├── kost.ts                              ← +match-funktioner, GemtMaaltid, FavoritMaaltid
│   │   ├── kost.test.ts                         ← +21 tests for match-logik
│   │   └── opskrifter.ts                        ← +DietTag, +salat-kategori
│   └── firestore/
│       ├── kost.ts                              ← +gemMaaltid, hentMaaltiderForDato,
│       │                                          gemFavorit, opdaterFavorit, sletFavorit
│       └── opskrifter.ts                        ← uændret
└── routes/app/moduler/30-30-3/
    ├── +page.svelte                             ← refactor til tabs + dagbog + favoritter
    └── opskrifter/[id]/+page.svelte             ← +Tilføj til byg-måltid

scripts/
├── migrate-recipes.ts                           ← NY (vanetracker → linns-academy-app)
├── inspect-vanetracker-recipe.ts                ← NY (debug)
├── seed-frida.ts                                ← NY (DTU-fødevarer)
├── inspect-frida.ts                             ← NY (debug)
├── aktiver-opskrifter.ts                        ← NY (bulk aktiv=true)
├── ryd-opskriftstitler.ts                       ← NY (fjern tal-prefiks)
├── find-fodevare.ts                             ← NY (debug-lookup)
├── test-match.ts                                ← NY (test enkelte ingredienser)
└── test-alle-opskrifter.ts                      ← NY (test alle migrerede)
```

### Firestore-struktur (nye stier i denne session)

- `opskrifter/{id}` — 58 opskrifter (aktiv=true, fra vanetracker-migration)
- `fodevarer/frida_<FoodID>` — 1381 Frida-fødevarer (kilde='frida')
- `users/{uid}/maaltider/{id}` — gemte måltider for dagbog
- `users/{uid}/favoritmaaltider/{id}` — favorit-skabeloner

### Tests

**228 tests passerer** (var 205 før denne session — 23 nye for ingrediens-matching, dagbog, favoritter).

### Test-brugere (uændret)

- `forlob@linnsacademy.dk` (Maria) — forløbskunde, knyttet til kickstart_maj_2026
- `modul@linnsacademy.dk` (Anne) — modulbruger, ingen forløb
- `udlobet@linnsacademy.dk` (Sofia) — udløbet
- `linnabildtrup00@gmail.com` (Linn, admin)

### Kommandoer

```bash
npm run dev                          # start dev-server
npm test                             # 228 tests
npm run seed:fodevarer               # 840 ref-app fødevarer (idempotent)
npm run seed:frida                   # 1381 Frida-fødevarer
npm run migrate:recipes [-- --dry]   # opskrifter fra vanetracker
npm run aktiver:opskrifter           # sæt aktiv=true på alle inaktive
npm run ryd:titler [-- --dry]        # fjern tal-prefiks fra titler
npx tsx scripts/find-fodevare.ts <q> # debug-lookup
npx tsx scripts/test-match.ts <q>    # test ingrediens-matching
npx tsx scripts/test-alle-opskrifter.ts  # rapportér ikke-matchede
```

---

## Åbne tråde / kendte mangler

### Klient-side polering

1. **Firestore-rules skal copy-pastes til Console** — `maaltider` og `favoritmaaltider` er nye regler
2. **Dagbog mangler edit-flow** — slet-knap virker, men man kan ikke ændre et gemt måltid (skal slettes og gemmes igen)
3. **Dagbog viser kun én dag ad gangen** — uge/måned-visning kunne tilføjes som senere etape
4. **Indkøbsliste fra opskrifter** — eksisterer i ref-app (markér opskrifter, generer liste, eksport til PDF) — ikke implementeret
5. **Næringsstoffer ud over protein/fiber** — Frida har masser (kulhydrater, fedt, vitaminer) men vi bruger kun de to. Mængden af "andet"-kategori (ca 295) er fordi heuristikken er simpel — kunne forbedres ved at læse FoodGroup-mappingen i Frida hvis det bliver vigtigt
6. **3 ingredienser kan ikke auto-matches** — jalapeño, flankesteak, sødkartoffel findes ikke i hverken ref-app eller Frida. Kan løses ved custom seed-script eller ved at tilføje admin-UI til fødevarer

### Adgangskontrol (åben tråd fra etape 11)

7. **modulbrugere kan stadig klikke på Kickstart-moduler** — der er ingen tjek på `userDoc.state === 'forlobskunde'` før modul vises på `/app/moduler` eller før klient-sider loades. Bør tilføjes konsistent
8. **Mikrotræning er ikke bundet til `forlobId`** — bruger stadig `userProduct.programValg.mikrotraening` direkte. Bør flyttes til at læse fra forløbet (`forlob/{id}/mikrotraeningsprogram` eller lignende — refactor lignende vanetracker)
9. **Profilside viser ikke hvilket forløb brugeren er på** — Linn ønskede at se det

### Andre moduler der mangler

10. **Bibliotek (FAQ + Guides)** — forløbs-specifikke. Afventer beslutning fra Linn om de skal være pr forløb (som vanetracker) eller globale (som opskrifter)
11. **Mit forløb** — daglig lektion + baseline-check-in. Skal sandsynligvis erstatte den eksisterende mock i `src/lib/content/forlob.ts` med rigtig data
12. **`/app/moduler/traening/+page.svelte`** viser kun Mikrotræning hardkodet — skal hente programmer dynamisk når der kommer flere træningsformer

### Kosmetiske

13. **B1 modul-grid på forsiden** ignorerer hvad brugeren har købt (åben tråd fra etape 8)
14. **Wake Lock-knappen** vises selv på browsere uden API-support
15. **scripts/vanetracker-key.json** bør slettes når Linn er færdig med migration (giver fuld adgang til den gamle database)

---

## Commits fra denne session

```
4f6b9f8 Udvid stemming med flere compound-suffikser og prefikser
fad43e7 Match flere ingrediens-mønstre + bedre prioritering
407201e Smartere ingrediens-matching mod fødevaredatabasen
40a551d Fjern tal-prefiks fra 57 opskrifttitler
aed569f Tilføj bulk-aktivering af opskrifter
8d0e7da Tilføj rediger-knap til favoritmåltider
2633def Tilføj favoritmåltider til 30-30-3-modulet
4caf378 Tilføj måltids-dagbog til 30-30-3-modulet
e1ac942 Fjern Frida.xlsx fra repo og gitignore xlsx/csv
f0d2be9 Importér 1381 fødevarer fra Frida (DTU Fødevareinstituttet)
fe1a535 Forbered seed-script til Frida-fødevaredatabase fra DTU
9839a10 Vis ALLE opskrift-ingredienser i byg-måltid (også manuelle)
e0c093e Fix back-link på opskrift-detalje + tilføj 'Tilføj til byg-måltid'
6ece5b2 Tilføj dietTags-felt og re-migrer opskrifter med fuldstændig data
00a78b2 Tilføj salat-kategori og kør recipe-migration
8522bfd Tilføj migration-script til opskrifter fra vanetracker
ac38d57 Saml 30-30-3 i én side med tre tabs
```

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
9. **Forløbs-modellen er førsteklasses** — FAQ og Guides skal sandsynligvis være forløbs-specifikke som vaneprogrammet (lever under `forlob/{id}/...`)
10. **TabBar har Admin-tab kun for admin-brugere** (matcher ADMIN_EMAILS i src/lib/admin.ts)
11. **Kopi-funktionalitet** — `kopierForlobIndhold` i `src/lib/firestore/forlob.ts` skal udvides med FAQ/guides når de bygges
12. **Migrations-scripts** — alle kører lokalt med admin-SDK. xlsx/csv-filer er gitignored
13. **Smart ingrediens-matching** — koden i `findFodevareForIngrediens` og `stemVarianter` (i `src/lib/content/kost.ts`) er fleksibel og kan udvides med nye prefikser/suffikser hvis Linn finder mønstre der ikke fanges

Held og lykke med næste etape.
