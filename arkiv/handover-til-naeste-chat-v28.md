# Handover til næste chat — v28

Session: **23.–24. maj 2026.** Fokus var **Kropsro-forløbets go-live** (start 24/5). Kropsro 2.0-arkitekturen fra v27 er stadig ikke implementeret — denne session har bygget oven på v1-modellen (basis/premium app + Kickstart/premiumforløb) og lavet de fixes der skulle til for at få Kropsro i drift på den eksisterende kodebase.

---

## Hovedopnåelser

### 1. Kropsro 24. maj 2026 live
- 24 kunder opgraderet fra `basisabo` → `premiumforløb` (premium-app + Kropsro-forløb)
- Alle Kropsro-relaterede flows verificeret: dagens lektioner, mikrotræning-onboarding, dag-tæller, slutdato
- Forløb-data sat op: forlobsdage/dag0 (2 video-lektioner), 2 mikrotræningsprogrammer (med/uden kettlebells)

### 2. Bagvedliggende bug-fix: alle mikrotrænings-sider var hardkodet til Kickstart
**Roden:** 6 sider hardkodede `hentUserProduct(uid, 'kickstart')`. Det betød Kropsro-kunder ikke kunne vælge program, ikke fik vist dagens trænings-thumbnail, og deres beskeder havnede uden forlobId.

**Løsning:** Ny helper `hentAktivProduktType(forlobIds): Promise<ForlobProduct>` i `src/lib/firestore/forlob.ts`. Returnerer korrekt produkt-id ud fra hvilket forløb der er aktivt i dag. Brugt af:
- `/moduler/traening/mikrotraening/onboarding/+page.svelte`
- `/moduler/traening/mikrotraening/+page.svelte`
- `/moduler/traening/mikrotraening/[dag]/+page.svelte`
- `/moduler/traening/mikrotraening/[dag]/spil/+page.svelte`
- `/profil/+page.svelte`
- `/beskeder/+page.svelte`

### 3. Synkronisering af "valgt mikrotræningsprogram"
Vi havde to overlappende felter: `userProduct.programValg.mikrotraening` (sat fra onboarding) og `userDoc.aktivtTraeningsprogram` (sat fra Træning-modulets "Vælg"). De var ikke synkroniseret.

**Løsning:** Onboarding og profil-siden skriver nu til **begge** felter i én `Promise.all`. Migrations-script kørt på linnsacademy@gmail.com.

### 4. Komplet makro på alle 128 opskrifter
**Før:** 70 havde kalorier, 0 havde kh, 0 havde fedt. Modal viste 0g/0g/0 hvis ét felt manglede (regex krævede alle 3 samtidigt).

**Løsning:**
- `parseOpskriftMakro()`-helper i `src/lib/content/opskrifter.ts` parser hver felt uafhængigt
- UI viser '—' for manglende felt
- AI-estimering med Claude Haiku 4.5: scripts `estimer-opskrift-kalorier.ts` + `estimer-opskrift-kh-fedt.ts`
- Modal udvidet fra 3 til 5 felter

### 5. Nul-dage (test-feature, kun Kropsro)
Klienten kan markere et interval (fra–til dato) som nul-dage og skubbe forløbet uden aktivitet. **21 pr Kropsro-forløb**, hardcoded, kun fra i dag og frem, fortryd kun samme dag.

**Datamodel:**
```typescript
// userProduct (premiumforløb).nulDage
{ intervaller: { fra: string; til: string; satMs: number }[] }
```

**Helpers** i `src/lib/content/forlob.ts`:
- `nulDageDatoer(intervaller): string[]` — folder intervaller ud til ISO-datoer
- `getCurrentDayMedNulDage(forlob, nulDatoer, now): number | null`
- `forlobSlutMs(startMs, antalDage, nulDageBrugt): number`

**Firestore-helpers** i `src/lib/firestore/mikrotraening.ts`:
- `tilfoejNulDageInterval(uid, productId, fra, til, max): Promise<{ok, brugt} | {ok:false, fejl}>` (validerer 21-pulje)
- `fjernNulDageInterval(uid, productId, satMs): Promise<void>`

**UI:**
- Profil-side: tæller, dato-vælger, liste med fortryd-knap (kun samme-dag), BekraeftModal
- Forsiden: dag-strippen viser nul-dage med 'Pause'-label + stiplet kant
- "Dag X af 84"-tæller på Moduler-siden + Mit Forløb + forsiden justeret
- Slutdato udvides automatisk

**Gating:** `harTestAdgang(userDoc, 'nul-dage')` + aktivt Kropsro-forløb.

### 6. Byg-eget-program flyttet bag test-flag
Hele "Byg dit eget program"-modulet er nu gated bag `harTestAdgang(userDoc, 'byg-eget-program')`. Skjules på Træning-modulet for ikke-testere, og direkte navigation til `/moduler/traening/byg-eget` redirecter tilbage til Træning.

### 7. Display-rename "Premium-forløb" → "Kropsro"
Synlige strenge i UI (Mine køb, profil-status, admin-labels, fejlbeskeder) viser nu "Kropsro" hhv. "Kropsro-forløb" hvor det matcher Kickstart-mønstret. Det interne `activeProduct`-id er stadig `'premiumforløb'` af bagudkompatibilitets-årsager.

### 8. Konstanter for læselighed
Nye konstanter i `src/lib/types.ts`:
```typescript
export const KROPSRO_PRODUCT_ID = 'premiumforløb' as const;
export const KICKSTART_PRODUCT_ID = 'kickstart' as const;
export type ForlobProduct = typeof KICKSTART_PRODUCT_ID | typeof KROPSRO_PRODUCT_ID;
```
Bruges nu i ~10 filer i stedet for hardkodede string-literals. **Ingen data ændret.** Type-definitioner (`ActiveProduct`-union) og object-keys (`{ premiumforløb: ... }`) beholder string-literal fordi TypeScript ikke tillader variabler dér.

### 9. Mindre fixes
- **Vimeo-thumbnails:** Linn skiftede Vimeo-privacy fra "Hide from Vimeo" til "Specific domains" → vumbnail-billeder virker nu
- **Drag-and-drop thumbnail-upload** på admin-lektion-siden (alternativ til Vimeo-thumbnails)
- **PDF-lektioner** åbnes direkte fra forsiden (ikke via Mit Forløb-mellemstop)
- **Scroll-bug** i 'Log som måltid'-modal fixet (body-scroll-lock + overscroll-behavior)
- **Admin → Spørgsmål dropdown** viser nu alle aktive forløb (også dem uden spørgsmål endnu)
- **Beskeder-side** fixet til at bruge dynamisk produktType
- **Forsidens premiumforløb-detection** udvidet med nul-dage så slutDato beregnes korrekt

---

## Kundetypologi pr 24. maj 2026

| Type | Antal | Status |
|---|---|---|
| App-basis (basisabo) | ~70 | Uændret |
| App-premium (premiumabo) | 1 | Uændret |
| Kickstart-forløbskunder | ~10 (afsluttede) | I 90-dages bibliotek-bonus |
| **Kropsro-forløbskunder** | **24** | **Startet 24/5, kører 84 dage** |
| linnsacademy@gmail.com | Test-bruger | Kropsro + alle test-features |

---

## Test-features pr 24. maj 2026

| Key | Navn | Beskrivelse |
|---|---|---|
| `foreslaa-madplan` | Foreslå madplan | AI-genereret madplan-forslag i 30-30-3 |
| `byg-eget-program` | Byg dit eget program | Custom-builder + 14-dages auto-byg |
| `nul-dage` | Nul-dage (pause-dage) | Skub forløbet med ferie/sygedage |

Linns testere: tildeles via `/admin/testere`.

---

## Åbne tråde

### 1. Linns Academy 2.0 (v27)
Stadig ikke implementeret. v27-handover er fortsat gældende blåtryk. Bemærk: med Kropsro live er det MERE realistisk at gå i gang nu, fordi vi har et test-mønster for migrering (24 kunder opgraderet uden problemer).

### 2. Eksisterende kicker fra Simplero
Når Kropsro skal sælges via Simplero som engangs-produkt, skal webhook-mapping konfigureres til at sætte `activeProduct: 'premiumforløb'` (eller hvad vi måtte rename til). Det er ikke aktivt endnu — de 24 nuværende Kropsro-kunder er manuelt tildelt.

### 3. Premiumforløb-rename
Ingen data-migration foretaget. Diskuteret med Linn — afvejning:
- **A** Rename hele vejen fra `'premiumforløb'` → `'kropsro'` (kode + Firestore-migration på ~61 dokumenter)
- **B (valgt)** Behold internt id, brug `KROPSRO_PRODUCT_ID`-konstant for læselighed
- **C** Drop `activeProduct` helt, brug `accessLevel + accessSource + forlobId`

Beslutning: B nu, A overvejes når alle Kropsro-kunder er færdige (~16. august 2026).

### 4. Tilbageblivende Kickstart-spørgsmål
6 spørgsmål er stadig stemplet med `forlobId: kickstart_maj_2026`. Bevidst valg — de blev sendt under Kickstart-forløb og forbliver historisk korrekte.

---

## Vigtige filer og helpers

### Centrale typer + konstanter
- `src/lib/types.ts` — `ActiveProduct`, `KROPSRO_PRODUCT_ID`, `KICKSTART_PRODUCT_ID`, `ForlobProduct`
- `src/lib/content/produkter.ts` — PRODUKTER-katalog
- `src/lib/content/koeb.ts` — visningsnavne

### Helpers
- `src/lib/firestore/forlob.ts:hentAktivProduktType()` — find aktivt produkt-id ud fra forlobIds
- `src/lib/content/forlob.ts:nulDageDatoer()`, `getCurrentDayMedNulDage()`, `forlobSlutMs()` — nul-dage-beregninger
- `src/lib/content/opskrifter.ts:parseOpskriftMakro()` — tolerant makro-parser
- `src/lib/utils/userAdgang.ts:harTestAdgang()` — feature-flag-check

### Admin-tools
- `/admin/testere` — tildel test-features per kunde
- `/admin/forlob/[id]/lektioner/[dag]` — admin-side med drag-and-drop thumbnail
- `/admin/spoergsmaal` — Beskeder fra klienter (dropdown viser alle aktive forløb)
- `/admin/forlob/[id]/traening` — admin-tildelte programmer + custom-builder

### Scripts brugt i denne session
- `scripts/_opgrader-kropsro-til-premiumforlob.ts` — engangs-opgradering af 24 kunder
- `scripts/estimer-opskrift-kalorier.ts` — AI-berig 57 opskrifter med kalorier
- `scripts/estimer-opskrift-kh-fedt.ts` — AI-berig 128 opskrifter med kh+fedt
- `scripts/_sync-linnsacademy-aktivt-program.ts` — sync programValg + aktivtTraeningsprogram
- `scripts/_flyt-spoergsmaal-til-kropsro.ts` — manuel flytning af spørgsmål
- `scripts/_audit-premiumforlob-data.ts` — data-audit før rename-beslutning

---

## Test-bruger setup (linnsacademy@gmail.com)

- `forlobIds: ['kickstart_maj_2026', 'kropsro_maj_2026']` (Kickstart-historik + aktivt Kropsro)
- `activeProduct: 'premiumforløb'` (= Kropsro)
- `accessLevel: 'premium'`, `accessSource: 'forløb'`
- `userProducts/premiumforløb.programValg.mikrotraening = 'kropsro_uden_kettlebells'`
- `userDoc.aktivtTraeningsprogram = { kilde: 'tildelt', programId: 'kropsro_uden_kettlebells', forlobId: 'kropsro_maj_2026' }`
- `testerFeatures: ['foreslaa-madplan', 'byg-eget-program', 'nul-dage']`

---

## Hvad næste chat skal vide

### Hvis Kropsro-fejl rapporteres
1. Tjek først om brugeren faktisk er stemplet `activeProduct: 'premiumforløb'` + har `kropsro_maj_2026` i `forlobIds`
2. Hvis ikke begge — kør `scripts/_opgrader-kropsro-til-premiumforlob.ts` (eller manuelt)
3. Verificer `userProducts/premiumforløb` har `forlobId: 'kropsro_maj_2026'`

### Hvis "0 spørgsmål" på admin-forløb-side
Sandsynligvis stemples spørgsmålet med forkert forlobId. Tjek `klientspoergsmaal`-collection.

### Hvis nul-dage-test giver problemer
- Tjek `userProducts/premiumforløb.nulDage.intervaller` direkte i Firestore
- Verificer `harTestAdgang(userDoc, 'nul-dage')` er true
- Verificer at brugeren har et aktivt Kropsro-forløb (ikke kun i forlobIds)

### Hvis dag-tælleren er forkert
`getCurrentDayMedNulDage()` trækker nul-dage fra `getCurrentDay()`. Hvis du ser "Dag 7 af 84" men kunden burde være på dag 5, så er der nul-dage. Tjek `userProducts/premiumforløb.nulDage`.

### Style/UI-konventioner
- Dansk overalt, ingen em-dashes eller semicolons i prosa (kommentarer + commit-messages)
- Tester: `npx vitest run` (456 tests pt — alle grønne)
- Type-check: `npx svelte-check --threshold error --output human` (0 fejl pt)
- Commit + push automatisk når opgave færdig (Linns regel)
- Cloudflare Pages deployer fra main, ~1 min ventetid

---

## Referencer

- Forrige handover: `handover-til-naeste-chat-v27.md` (Linns Academy 2.0-arkitektur, ikke implementeret)
- Memory-noter: `project_linns_academy.md`, `project_kunde_typologi.md`, `feedback_arbejdsstil.md`
- CLAUDE.md i repo-roden

**Status:** Kropsro live, 24 kunder kørende, alle test-features klar til feedback fra linnsacademy@gmail.com. Næste skridt afhænger af hvad der dukker op fra den første uges drift.
