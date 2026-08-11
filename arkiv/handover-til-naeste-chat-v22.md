# Handover til næste chat — v22

Status efter session 22 (11. maj 2026). **9 commits siden v21.** Kort, fokuseret session med to hovedtemaer:

1. **Fødevare-berigelse** — 840 incomplete food items i `fodevarer`-collection er nu beriget med kh/fedt/kcal. 348 via Frida-matching, 492 via Claude AI-estimater. App'en har nu fuld næringsdata for alle ikke-community fødevarer.
2. **Min opskrift** — ny premium-feature: klienten tager 1-3 billeder af en opskrift, Claude vision læser den og estimerer makro pr portion. Opskriften gemmes privat. Kan redigeres, billede kan skiftes, og opskriften kan lægges ind som måltid med valgt antal portioner.

**Vigtige åbne tråde fra v21 — uændrede:**
1. Auto-eksport af besvarede klient-spørgsmål til Linn AI-videnbasen (script eksisterer ikke endnu)
2. Simplero cancel- og refund-triggers (åbent siden v20)
3. Persona-prompten til Linn AI — Linn skal selv tilpasse den

---

## Status quo

**Live URL:** `https://linns-academy-app.pages.dev`
**Deploy:** Auto fra `main` på Cloudflare Pages
**Tests:** 0 type-fejl, 0 svelte-warnings. Ingen nye tests skrevet i v22 (alle features er UI/Worker — testet manuelt).

### Test-brugere (uændrede fra v21)

Alle med password `test1234`:
- `forlob@linnsacademy.dk` — Maria, forløbskunde, Kickstart maj 2026
- `modul@linnsacademy.dk` — Anne, modulbruger
- `udlobet@linnsacademy.dk` — Sofia, udløbet
- `linnabildtrup00@gmail.com` — Linn, admin
- `bo_andersen1@icloud.com` — Bo, Simplero-test-kunde
- `basis_app@linnsacademy.dk` — BasisApp, modulbruger, basis-abo
- `premium_app@linnsacademy.dk` — PremiumApp, modulbruger, premium-abo
- `kickstart@linnsacademy.dk` — Kickstart, forløbskunde
- `premium_forlob@linnsacademy.dk` — PremiumForlob, forløbskunde, premium-forløb test

---

## Fødevare-berigelse (engangs-opgave, nu fuldført)

### Problem

840 fødevarer i `fodevarer`-collection havde kun protein + fiber pr 100g, ingen kh/fedt/kcal. Det betød at premium-brugere med udvidet næring slået til, så "0g kh, 0g fedt, 0 kcal" på alt mad de tilføjede. Diagnose-scriptet `scripts/diagnose-fodevarer-naering.ts` viste:
- 348 hvor navnet matchede direkte mod Frida-datasæt (DTU Food's officielle kost-tabel) — kunne beriges automatisk
- 492 "ukendt"-kilde (community-import fra et tidligt eksperiment) — for diverse til at matche mod Frida

### Løsning

**Frida-match (348 items):** `scripts/berig-fra-frida.ts` matchede navne mod Frida-CSV og skrev kh/fedt/kcal. Køres som engangs-batch.

**Claude AI-estimater (492 items):** `scripts/berig-ukendte-fodevarer.ts` sender hvert ukendt fødevare-navn til Claude med prompt "estimér kh/fedt/kcal pr 100g for denne danske fødevare, baseret på Frida-værdier hvis muligt". Claude returnerer JSON. `scripts/skriv-estimater-fra-claude.ts` skriver det til Firestore.

Begge er bevidst engangs-scripts der ikke kommer ind i runtime. Hvis nye community-fødevarer dukker op uden makro, må vi køre dem igen.

### Status

100% af ikke-community fødevarer har nu kh/fedt/kcal. To community-items mangler stadig (kan udfyldes manuelt eller når der stemmes på dem).

### Filer

- `scripts/diagnose-fodevarer-naering.ts` — find incomplete items
- `scripts/berig-ukendte-fodevarer.ts` — beder Claude om estimat for hver
- `scripts/skriv-estimater-fra-claude.ts` — skriver tilbage til Firestore
- (Frida-match-scriptet eksisterede fra tidligere session, blot kørt igen)

---

## Min opskrift — premium-feature

### Hvad det er

Klient tager 1-3 billeder af en opskrift (kogebog, blad, screenshot, hjemmeside, håndskrift). Claude vision læser billederne, estimerer makro pr portion, og opskriften gemmes som privat dokument under brugerens egen profil. Klienten kan redigere alle felter, skifte billedet, og lægge opskriften ind som måltid i dagbogen med valgt antal portioner.

Adgang: kun premium-app + premium-forløb (samme gating som Linn AI og scanner).

### Datamodel

```
users/{uid}/privateOpskrifter/{id}    ← klientens egne opskrifter (kun ejer)
  navn, beskrivelse?, billedeUrl?, antalPortioner, ingredienser[], makroPrPortion,
  oprettet, opdateret?

  ingredienser: [{ navn, maengde, enhed }]   ← fri-tekst, ikke koblet til fodevarer-DB
  makroPrPortion: { protein, fiber, kh, fedt, kcal }   ← gram pr portion
```

**Vigtig konvention:** `makroPrPortion` er ALTID pr én portion. Antal portioner gemmes separat. Når opskriften lægges ind som måltid, skaleres makroen med valgt antal via `skalerMakro()` i `src/lib/content/minOpskrift.ts`.

### Billede-storage

```
users/{uid}/opskrift-billeder/{billedeId}    (Firebase Storage)
```

Storage-rule: kun ejer kan læse/skrive, max 5 MB pr fil, kun image/* MIME-types.

**Konvention:** Hvis klienten uploader flere billeder (op til 3), gemmes kun det FØRSTE som thumbnail i Storage. De andre kasseres efter AI-analysen, da makroen er udvundet. Gamle billeder slettes (best-effort) når klienten skifter billede i edit-mode.

### Vision-endpoint `/api/analyser-opskrift`

Cloudflare Worker. Samme model som Linn AI (Claude Sonnet 4.6 — `claude-sonnet-4-5-20250929`).

**Request:**
```json
{ "billeder": [{ "billedeBase64": "...", "mediaType": "image/jpeg" }, ...] }
```
Bagudkompatibelt format med single-billede:
```json
{ "billedeBase64": "...", "mediaType": "image/jpeg" }
```

**Constraints:**
- Bearer token (Firebase ID-token) i Authorization-header
- Premium-check (samme logik som Linn AI)
- Rate-limit: deler 20/dag-kvota med Linn AI (gemt i `users/{uid}/linnAiQuotaer/{dato}`)
- Max 3 billeder pr kald, max 5 MB pr billede

**Response:**
```json
{
  "navn": "Pasta med hytteost",
  "antalPortioner": 4,
  "ingredienser": [{"navn": "...", "maengde": 100, "enhed": "g"}],
  "makroPrPortion": { "protein": 22, "fiber": 4, "kh": 60, "fedt": 12, "kcal": 450 }
}
```

System-prompt instruerer Claude i at returnere KUN JSON, antage 4 personer hvis antal portioner ikke står, og kombinere flere billeder til ét resultat.

### Klient-UI

**`/app/moduler/30-30-3?tab=mine`** — ny tab "Mine" der kun vises for premium. Liste over gemte private opskrifter med thumbnail + navn + antal portioner. Tom-tilstand viser "Tilføj fra billede"-CTA.

**`/app/moduler/30-30-3/min-opskrift/ny`** — upload-flow:
1. **Vælg billede** — `<input type="file" multiple accept="image/*">`. Brugeren kan tilføje 1-3 billeder, hver vises som thumbnail med nummer + ✕-knap. "Tilføj endnu et billede" indtil 3 er nået
2. **Analysér** — sender alle billeder til workeren, viser "AI analyserer X billeder..."-loader (5-25 sek)
3. **Rediger** — alle felter (navn, portioner, ingredienser, makro) er forudfyldt fra AI'ens svar men kan redigeres. Det første billede vises som preview
4. **Gem** — uploader første billede til Storage, gemmer opskrift i Firestore, sender til `?tab=mine`

**`/app/moduler/30-30-3/min-opskrift/[id]`** — detail/edit:
- **Vis-mode:** billede + navn + antal portioner + makro-grid + ingrediens-liste. To primær-knapper:
  - **"Læg ind som måltid"** (terra) — åbner modal med portion-chips (0.5/1/1.5/2 + fri-tekst), dato-picker, måltidstype-selector. Live preview af skaleret makro. "Læg ind i dagbog" → gemmer som ét manuelt item med override-totaler og sender til `?tab=dagbog&dato=...`
  - **"Rediger"** — skifter til edit-mode
- **Edit-mode:** alle felter redigerbare inkl. ingredienser (tilføj/fjern). "Billede"-kort med "Skift billede" / "Fortryd skift". Når et nyt billede vælges uploades det ved gem, og det gamle slettes best-effort

### Måltid-integration

Når en opskrift lægges ind som måltid, skrives den til `users/{uid}/maaltider/{id}` (eksisterende collection) med:
- `items: [{ foodId: '', portion: N, manuel: { navn, enhed: 'portion(er)' } }]` — ét manuelt item
- `totalP/F/Kh/Fedt/Kcal` — direkte skaleret fra `makroPrPortion × N`

Dagbogsvisningen viser opskriften som et almindeligt måltid med "1 ingredienser" som meta-tekst. Det er kosmetisk men fungerer.

**Beslutning ikke at auto-matche ingredienser mod Frida:** Vi forsøger IKKE at finde matchende `Fodevare`-IDs for hver opskrift-ingrediens. To grunde:
1. AI returnerer fri-tekst-ingredienser der ikke nødvendigvis matcher Fridas naming
2. Makroen er allerede estimeret af AI på opskriftens helhed — at også summe matchede items oven i ville dobbeltregne

### Filer (nye i v22)

- `src/lib/content/minOpskrift.ts` — typer, `skalerMakro()`, `erGyldigAnalyse()`, `DEFAULT_MAKRO`
- `src/lib/firestore/minOpskrift.ts` — CRUD-helpers, scoped til `aktivBrugerBasisPath`
- `src/routes/api/analyser-opskrift/+server.ts` — vision-worker
- `src/routes/app/moduler/30-30-3/min-opskrift/ny/+page.svelte` — upload-flow
- `src/routes/app/moduler/30-30-3/min-opskrift/[id]/+page.svelte` — detail + edit + læg-som-måltid

### Ændrede filer

- `src/routes/app/moduler/30-30-3/+page.svelte` — ny "Mine"-tab + load af private opskrifter
- `firestore.rules` — `match /users/{uid}/privateOpskrifter/{opskriftId}` tilføjet
- `storage.rules` — `match /users/{uid}/opskrift-billeder/{filename=**}` tilføjet

---

## Tekniske gotchas (nye i v22)

- **Vision API tager flere billeder i ét kald.** Hvert image-content-block er separat, men de tæller som én rate-limited query. Dvs. en opskrift med 3 billeder = 1 query mod kvotaen
- **Cloudflare Workers og base64-data.** Vi konverterer billeder klient-side med FileReader → base64 → JSON. Det er fint op til ~5 MB pr billede, men hvis Linn ønsker større billeder i fremtiden skal vi skifte til multipart/form-data eller direct-to-Storage + URL-reference
- **`PUBLIC_FIREBASE_API_KEY` i `analyser-opskrift`-workeren skal importeres fra `$env/static/public`** — samme bug som Linn AI havde første gang
- **Storage-rules deployes manuelt.** Linn skal kopiere `storage.rules` til Firebase Console → Storage → Rules → Publish, IKKE kun firestore.rules
- **`skalerMakro()` afrunder til 1 decimal for gram, helt tal for kcal.** Hvis klienten lægger 1.5 portioner ind, vil hun ikke se "37.65g protein" men "37.7g"
- **Best-effort image-cleanup.** Når klienten skifter billede slettes det gamle fra Storage. Hvis sletning fejler (race condition, network), bare logger vi en warning — gemte opskrifter har stadig korrekt nyt URL i Firestore

---

## Hvad du skal gøre lige nu

### Hvis det er FØRSTE gang du deployer v22

1. **Firestore rules:** Kopiér `firestore.rules` til Firebase Console (`privateOpskrifter`-blok er ny)
2. **Storage rules:** Kopiér `storage.rules` til Firebase Console → Storage → Rules → Publish (`opskrift-billeder`-blok er ny)
3. **`ANTHROPIC_API_KEY`** er allerede sat fra v21 — ingen ændring nødvendig

### Test-flow

Log ind som `premium_app@linnsacademy.dk` (eller brug admin-klient-mode → premium-app):
1. Gå til `/app/moduler/30-30-3` → klik "Mine"-tab
2. "Tilføj fra billede" → vælg en opskrift-screenshot eller bog-side. Test gerne med 2-3 billeder
3. Verificer at AI returnerer realistisk navn + ingredienser + makro
4. Rediger noget (fx antal portioner), gem
5. Klik "Læg ind som måltid", vælg 1.5 portioner, gem
6. Skift til Dagbog-tab og verificer at måltidet vises med skaleret makro
7. Gå tilbage til opskriften, klik "Rediger" → "Skift billede" → vælg en anden fil → "Gem ændringer". Verificer at thumbnail opdateres

---

## Næste session — åbne tråde

### Højeste prioritet (uændret fra v21)

1. **Auto-eksport af besvarede klient-spørgsmål** til Linn AI-videnbasen
2. **Simplero cancel- og refund-triggers** (åbent siden v20)
3. **Persona-prompt for Linn AI** — Linn skal selv skrive sin stemme

### Min opskrift — mulige udvidelser

4. **Auto-match ingredienser mod Frida** for opskrifter der ikke er foto-analyseret (måske ikke relevant da vision-flow er primær use case)
5. **Del opskrifter mellem brugere** — fx hvis Linn vil dele en favorit-opskrift med alle premium-klienter. Vil kræve ny `delteOpskrifter`-collection med admin-write
6. **PDF-upload** — flere kogebøger findes som PDF. `pdfjs-dist` er allerede i bundlen til Linn AI's videnbase. Vil kræve PDF→billeder-konvertering eller text-extraction
7. **Genskab opskrift fra delvis info** — fx hvis klienten skriver navn + ingredienser uden billede, kan AI'en så estimere makro

### Medium prioritet (uændret)

8. RAG/embeddings til Linn AI når videnbasen vokser
9. Streaming responses i Linn AI-chat
10. Premium-bruger downgrade edge cases
11. Mobil-test af alle nye flows

---

## CLAUDE-instruktion: Læs IKKE handover v17/v18/v19/v20/v21 inden du starter

v22 er den fulde aktuelle status PÅ TILLÆG til v21. v21 dækker den store struktur (abo-flows, admin-klient-3-modes, Linn AI). v22 dækker fødevare-berigelse + Min opskrift. De to handovers tilsammen er det fulde billede.
