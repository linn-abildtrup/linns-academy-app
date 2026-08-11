# Handover til næste chat — v23

Status efter session 23 (12. maj 2026). **3 commits siden v22.** Kort, fokuseret session med tre hovedtemaer:

1. **Frokost-kategori fyldt** — der var 0 opskrifter i kategorien `frokost`. Diagnosen viste at `migrate-recipes.ts` fejlagtigt mappede den gamle vanetracker-værdi `middagsmad` til `aftensmad` i stedet for `frokost`. Migration-bug rettet + 21 af de 29 fejlagtigt-tag'gede aftensmad-opskrifter blev re-kategoriseret via Claude-vurdering (13 kun frokost, 8 til både frokost+aftensmad, 8 forbliver aftensmad).
2. **Optimér min mad** — ny premium-feature: knap på Dagbog-fanen der lader AI'en foreslå små bytter/tilføjelser i dagens måltider så protein/fiber-målet rammes inden for kcal-budgettet (±5% el. ±150 kcal). "Anvend ændringer" opdaterer dagbogen direkte.
3. **Premium-gating strammet** — fjernet `adminKlientMode === 'forlob'` fra server-side premium-tjek i både `/api/linn-ai` og `/api/analyser-opskrift`. UI'et mapper allerede den mode til basis-niveau, så server-tjekket var inkonsistent.

**Vigtige åbne tråde fra v22 — uændrede:**
1. Auto-eksport af besvarede klient-spørgsmål til Linn AI-videnbasen
2. **Simplero cancel- og refund-triggers (åbent siden v20)** — *fokus for næste session*
3. Persona-prompten til Linn AI

---

## Status quo

**Live URL:** `https://linns-academy-app.pages.dev`
**Deploy:** Auto fra `main` på Cloudflare Pages
**Tests:** 0 type-fejl, 0 svelte-warnings.

### Test-brugere (uændrede fra v22)

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

## Frokost-kategori fix (engangs-data-opgave, fuldført)

### Problem

`scripts/diagnose-fodevarer-naering.ts`-stil tælling viste 0 frokost-opskrifter ud af 59 i alt — 29 var tag'get aftensmad, hvilket var alt for mange. Diagnose i `reference/index.html` (gammel app, line 11872 + 12089-12090) afslørede at den gamle Firestore brugte `middagsmad` som lagret kategori-værdi men viste det som "Frokost" i UI. Migrationen havde mistolket det.

### Fix i kode

`scripts/migrate-recipes.ts` blev rettet (commit `d592b7a`): mapping refaktoreret til en `KATEGORI_ALIASER`-lookup-tabel hvor `middagsmad` nu mapper til `frokost`. Hvis migrate-scriptet nogensinde re-køres mod vanetracker, kommer bug'en ikke tilbage.

### Fix i data

29 aftensmad-opskrifter blev gennemgået manuelt af Claude (jeg, ikke API) med kriterier "lette/kolde/mealprep = frokost, varme/familiestørrelse = aftensmad". Resultat:
- **13** → kun `frokost` (mealprep-bokse, salater, wraps, rugbrødsmadder, frokosttallerkner)
- **8** → både `frokost` og `aftensmad` (bowls, curries, pasta-i-mealprep-størrelse)
- **8** → forbliver kun `aftensmad` (4-portions familieretter, ovnbagt fisk-aftensmad, lasagne, marineret laks)

Resultat: 21 aktive frokost-opskrifter, 16 aftensmad (var 29), de andre kategorier uændret.

Engangs-scripts brugt undervejs (`foreslaa-kategorier-fra-ai.ts`, `anvend-kategori-forslag.ts`, `dump-aftensmad-opskrifter.ts`, m.fl.) er slettet efter brug.

---

## Optimér min mad — premium-feature

### Hvad det er

Brugeren har logget eller planlagt sine 3-4 måltider for dagen. Hun trykker **"Optimér min mad"** på Dagbog-fanen. AI'en kigger på:
- Dagens måltider (totaler + ingrediens-navne)
- Brugerens daglige mål (`userDoc.dagligeMaal`)
- Diet-tags (sendes som tomt array pt — koblet op senere)
- Klokkeslæt (implicit via måltidstyper)

…og returnerer 0-N forslag i et før/efter-kort. Hvert forslag er en "handling" (tilføj/byt/fjern) tilknyttet et specifikt måltid plus et `makroDelta`. "Anvend ændringer" føjer forslagene ind som manuelle "AI-justering"-items og opdaterer måltidernes totaler.

Adgang: kun premium-app + premium-forløb (samme gating som Linn AI og analyser-opskrift).

### Datamodel

Ingen nye Firestore-collections. Featuren genbruger eksisterende `users/{uid}/maaltider/{id}` og `users/{uid}/linnAiQuotaer/{dato}`.

Diff-formatet defineret i `src/lib/content/optimerMaaltider.ts`:

```ts
interface MaaltidDiff {
  maaltidId: string;         // existing måltid-id, eller 'NY_*' for nye snacks
  maaltidNavn: string;
  maaltidType: Maaltidstype; // 'morgenmad' | 'frokost' | 'aftensmad' | 'snack'
  handling: 'tilfoej' | 'fjern' | 'byt';
  tekst: string;             // fx "Tilføj 30g valnødder"
  begrundelse: string;       // fx "Bidrager med 5g protein og 3g fiber"
  makroDelta: { protein, fiber, kh, fedt, kcal }; // gram pr makro
}

interface OptimerSvar {
  diff: MaaltidDiff[];
  resultatMakro: MakroDelta;       // forventet dags-sum efter ændringer
  samletBegrundelse: string;       // 1-2 sætninger til brugeren
  advarsel?: string;               // hvis mål ikke kunne rammes
}
```

### Endpoint `/api/optimer-maaltider`

Cloudflare Worker. Samme model som Linn AI (Claude Sonnet 4.6 — `claude-sonnet-4-5-20250929`).

**Request:**
```json
{ "maaltider": [...GemtMaaltid[]], "maal": DagligeMaal, "dietTags": [] }
```

**Constraints:**
- Bearer token (Firebase ID-token) i Authorization-header
- Premium-check (samme logik efter at vi strammede den)
- Rate-limit: deler 20/dag-kvota med Linn AI + analyser-opskrift
- System-prompt instruerer Claude i at holde sig inden for ±5% af kcal-målet (min ±150 kcal) via `kcalTolerance(maal.kcal)` i pure-funktions-filen

**Response:** `OptimerSvar`-objekt valideret via `valierOptimerSvar()` før det returneres til klienten.

### Klient-UI

Tilføjet til `/app/moduler/30-30-3?tab=dagbog`:

1. **"Optimér min mad"-knap** vises kun når:
   - Brugeren er premium (`harPremium(userDoc)`)
   - Brugeren har sat `dagligeMaal` via 'Beregn mine mål'-wizarden
   - Dagbogs-datoen er i dag (ingen optimering tilbage i tiden)
2. **Klik** → fetch til `/api/optimer-maaltider` med ID-token. Loader-tekst: "AI analyserer dagen..."
3. **Resultat-kort** viser:
   - Samlet begrundelse
   - Eventuel advarsel (gul status-besked)
   - Liste af forslag, farvet efter handlings-type (grøn=tilføj, gul=byt, terra=fjern) via `handlingsFarve()`
   - "Forventet resultat"-blok med dags-makro efter ændringer
   - To knapper: "Behold som det er" (luk) + "Anvend ændringer"
4. **Anvend** → for hver diff:
   - Eksisterende måltid (`maaltidId` matcher): tilføj manuel item `{ foodId: '', portion: 1, manuel: { navn: '+ tekst', enhed: 'AI-justering' } }` til items-array + opdater totalP/F/Kh/Fedt/Kcal med makroDelta (klippet til ikke-negativ).
   - Nyt måltid (`maaltidId` starter med `NY_`): opret nyt måltid via `gemMaaltid()`.
   - Genindlæs dagbog, luk kortet.

### Beslutninger

**Hvorfor manuelle "AI-justering"-items i stedet for at matche mod den faktiske `Fodevare`-DB:** AI'en returnerer fri-tekst-forslag der ikke nødvendigvis findes som koblede fødevarer. Manuel-item-mønstret findes allerede i kost-modulet (bruges når opskrift-ingredienser ikke kan auto-matches). Måltidets totalP/F/etc. opdateres direkte med makroDelta så det visuelle stemmer — brugeren kan altid manuelt rydde op bagefter.

**Hvorfor ingen RAG/opskrifts-forslag i v1:** AI'en kender ikke biblioteket. Det er overlagt simpelt — v2 kan eventuelt sende opskriftsmetadata med i prompten så AI'en kan foreslå konkrete opskrifter fra biblioteket.

**Hvorfor en separat endpoint i stedet for at udvide Linn AI:** rate-limit og prompt-struktur er forskellig. Linn AI er multi-turn chat med videnbase; optimer-maaltider er én-svar struktureret JSON. De to fungerer bedst hver for sig men deler kvota.

### Filer (nye i v23)

- `src/lib/content/optimerMaaltider.ts` — typer (`MaaltidDiff`, `OptimerSvar`, `MakroDelta`), pure-funktioner (`kcalTolerance`, `summerDagsMakro`, `valierOptimerSvar`, `handlingsFarve`)
- `src/routes/api/optimer-maaltider/+server.ts` — vision-fri Worker med struktureret JSON-output

### Ændrede filer

- `src/routes/app/moduler/30-30-3/+page.svelte` — knap, optimer-kort, anvend-handler, CSS for `.optimer-*`-klasser
- `scripts/migrate-recipes.ts` — `KATEGORI_ALIASER`-lookup-tabel, `middagsmad` → `frokost`
- `src/routes/api/linn-ai/+server.ts` — fjernet `adminKlientMode === 'forlob'` fra premium-check
- `src/routes/api/analyser-opskrift/+server.ts` — samme

---

## Tekniske gotchas (nye i v23)

- **Kcal-tolerancen er bevidst lempelig.** Hvis brugeren har et lavt kcal-mål (fx 1500 kcal), giver 5% kun 75 kcal slingreplads — for lidt til realistiske bytter. `kcalTolerance(maalKcal)` returnerer derfor `max(150, 5% af mål)`.
- **AI'en kan returnere `NY_`-prefiksede maaltidId'er.** Klient-handleren skal tjekke for dette prefiks og kalde `gemMaaltid()` i stedet for `opdaterMaaltid()`. Hvis du udvider featuren med fx `byt`-handlinger der finder eksisterende items, så husk samme branche-logik.
- **`adminKlientMode === 'forlob'` er nu inkonsistent mellem klient og server hvis du tilføjer flere AI-endpoints i fremtiden** — UI'et mapper det til basis, server-siden afviser det. Husk at server-tjekket KUN må acceptere `accessLevel === 'premium'` OR `adminKlientMode === 'premiumapp'`.
- **`dagligeMaal`-feltet på userDoc skal være sat** før knappen vises. Hvis brugeren ikke har kørt 'Beregn mine mål'-wizarden, vises optimer-knappen ikke. Tjek `userDoc?.dagligeMaal` før eventuel debug.
- **Engangs-AI-batch i samme chat-session er billigere end via API-keys i scripts** — vi har set i denne session at Claude direkte (mig som assistent) kan håndtere mindre engangs-kategoriserings-opgaver hurtigere end at sætte ANTHROPIC_API_KEY op for scripts. Hvis du har under 50-100 items at klassificere, så bare spørg i chatten i stedet for at bygge et script.

---

## Hvad du skal gøre lige nu

### Cloudflare deploy

Allerede pushed. Verificer på Cloudflare Pages dashboard at deployet er lykkedes. Ingen secrets, rules eller env-vars at opdatere.

### Test-flow for Optimér min mad

Log ind som `premium_app@linnsacademy.dk` (eller brug admin-klient-mode → premiumapp):
1. Gå til `/app/moduler/30-30-3` → klik Dagbog-fanen
2. Hvis du ikke har daglige mål: brug 'Beregn mine mål'-wizarden først
3. Log 2-3 måltider for i dag (varierende mængder protein/fiber)
4. Tryk "Optimér min mad" → AI returnerer forslag inden for ~10 sek
5. Verificer at forslagene har realistisk makro-delta og at kcal-summen lander tæt på dit mål
6. Klik "Anvend ændringer" → tjek at hvert berørt måltid får en "+ tekst" manuel-item og at totalerne opdateres

---

## Næste session — Simplero købsproces

### Højeste prioritet

**1. Cancel- og refund-triggers** (åbent siden v20)
Når en Simplero-kunde annullerer abonnementet eller får refund, skal vi rydde adgang. Pt. står `expiresAt` og `activeSubscription`-felterne forkert hvis det sker. Webhook-handler i `src/routes/api/simplero-webhook/+server.ts` mangler logik for:
- `subscription.canceled` event → sæt `activeSubscription = false`, behold `expiresAt` indtil perioden er kørt ud
- `subscription.refunded` event → straks sæt `accessLevel = 'none'`, `activeSubscription = false`, `expiresAt = Date.now()`
- Forløbskøb med refund → tilsvarende håndtering med `bonusPeriodEndsAt`

**2. Adgangs-flow ved første login** (delvist på plads)
Webhook opretter `allowedEmails/{email}` med adgangs-felter. Når brugeren første gang logger ind, kopieres felterne til `users/{uid}`. Verificer:
- Alle fire produkter (`kickstart`, `premiumforløb`, `basisabo`, `premiumabo`) håndteres korrekt i copy-flow
- Upgrade-paths: hvis basis-bruger køber premium, sker det rigtige
- Downgrade-paths: hvis premium-bruger nedgrader, sker det rigtige

**3. Persona-prompt for Linn AI** — Linn skal selv skrive sin stemme. Inkluderer nu også implicit Optimér min mad-koreografien selv om den feature har sin egen system-prompt.

### Mulige udvidelser til Optimér min mad

4. **Opskrifts-forslag i prompten** — send 10-20 filtrerede opskrifter (passer kategori + diet-tags) som context, så AI'en kan foreslå konkrete opskrifter fra biblioteket i stedet for fri-tekst
5. **Diet-tags-kobling** — `dietTags`-feltet sendes pt. tomt fra klient. Find/lav et userDoc-felt med brugerens diet-præferencer
6. **'Anvend kun udvalgte'** — checkbox pr forslag så brugeren kan vælge hvilke der anvendes (i stedet for alt-eller-intet)
7. **Aften-tjek-variant** — efter kl 19 vises et knapdrevet "Hvad gik godt i dag?" der primært er coaching-tekst frem for konkrete ændringer

### Medium prioritet (uændret fra v22)

8. RAG/embeddings til Linn AI når videnbasen vokser
9. Streaming responses i Linn AI-chat
10. Premium-bruger downgrade edge cases (overlapper med Simplero-prioritet 1)
11. Mobil-test af alle nye flows

---

## CLAUDE-instruktion: Læs IKKE handover v17/v18/v19/v20/v21/v22 inden du starter

v23 er det fulde aktuelle tillæg til v22. v22 dækker fødevare-berigelse + Min opskrift; v23 dækker frokost-kategori-fix + Optimér min mad + premium-gating-stramning. De to handovers tilsammen er det fulde billede oven på v21.
