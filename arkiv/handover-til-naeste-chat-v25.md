# Handover til næste chat — v25

Status efter session 25 (13.-14. maj 2026). **~30 commits siden v24.** Stor session med stor omstrukturering af forsiden for både modulbrugere og forløbskunder + flere nye features. Hovedtemaer:

1. **Forside-omstrukturering** — stripped, dato-aware, vaner besvares inline, Mad-card med progress-barer, App-hjælp-knap under coaching. Modulbruger og forløbskunde har nu samme layout.
2. **Modulbruger-lektioner** — ny admin-feature: Linn lægger daglige lektioner op pr dato, vises på modulbruger-forsiden.
3. **App-hjælp AI** — separat AI fra Linn AI der KUN svarer på spørgsmål om appen. Tilgængelig for alle kundetyper.
4. **AI-rating** — klienterne rater Linn AI- og App-hjælp-svar 1-5 stjerner. Admin-side til at se ratings.
5. **Mad-navngivning** — "Kost"-modulet omdøbt til "Mad" i UI'et.
6. **iOS zoom-fix** — !important-regel der forhindrer iOS Safari i at zoome ind på inputs.
7. **Træning gennemført-knap** — manuel markering på spil-siden, forside-card viser status.
8. **Diverse UX-finjusteringer** — back-knapper til forsiden, video-thumbnail på mikrotræning-card, farvekoder, månedsarkiv-sortering, m.fl.

**Vigtige åbne tråde fra v24 — uændrede:**
1. Cancel-flow afklaring (Simplero sender 2 events ved cancel — hvorfor?)
2. End-to-end test af fornyelse + betaling-fejlede webhooks
3. Slet legacy `/api/simplero-webhook`-route når alle Simplero-konfigurationer er migreret
4. Persona-prompt til Linn AI

**Nye åbne tråde i v25:**
5. **Firestore-rules skal opdateres MANUELT** i Firebase Console — to nye collections (`modulbrugerLektioner` + `aiRatings`) har rules i `firestore.rules` der endnu ikke er pushed til Firebase. Indtil det er gjort, virker disse features ikke i prod.

---

## Status quo

**Live URL:** `https://linns-academy-app.pages.dev`
**Deploy:** Auto fra `main` på Cloudflare Pages
**Tests:** 367 tests passerer, 0 type-fejl, 0 svelte-warnings.

### Test-brugere (uændrede fra v24)

Alle med password `test1234`:
- `forlob@linnsacademy.dk` — Maria, forløbskunde, Kickstart maj 2026
- `modul@linnsacademy.dk` — Anne, modulbruger
- `udlobet@linnsacademy.dk` — Sofia, udløbet
- `linnabildtrup00@gmail.com` — Linn, admin
- `bo_andersen1@icloud.com` — Bo, Simplero-test-kunde
- `bo_andersen1@mac.com` — Bo, sekundær Simplero-test
- `basis_app@linnsacademy.dk` — BasisApp, modulbruger, basis-abo
- `premium_app@linnsacademy.dk` — PremiumApp, modulbruger, premium-abo
- `kickstart@linnsacademy.dk` — Kickstart, forløbskunde
- `premium_forlob@linnsacademy.dk` — PremiumForlob, forløbskunde

---

## Forside-omstrukturering (modulbrugere + forløbskunder)

Begge forside-varianter har nu samme layout:

1. **Strip øverst** — for forløbskunder: program-dage 0-21 + dato. For modulbrugere: kalenderdage fra `userDoc.createdAt` til 3 dage frem, med faded styling for fremtidige og historik-uden-data dage.
2. **Dagens lektioner-sektion** — viser dagens lektion-card (fra forløb for forløbskunder, fra `modulbrugerLektioner/{dato}` for modulbrugere) + Mikrotræning-card.
3. **Dagens små skridt-sektion** — vaner besvares INLINE direkte på forsiden med ja/delvist/nej-knapper. Dagens bonus-spørgsmål er en ekstra række. På check-in-dage (søndage for abo / dag 0, 7, 14, 21 for forløb) vises 5 sliders til ugentligt check-in.
4. **Mad-card** — kompakt action-card med slanke progress-barer for protein og fiber (terra/sage farver, viser `aktuel/mål g`-format).
5. **Personlig coaching + App-hjælp** — coaching-knap (Simplero) + lille knap til App-hjælp.

### Datamodel

For modulbrugere bruges `aboVaneOpsaetning` + `aboVanedage/{dato}` + `aboBonusPulje/{produktType}`. Alle gemmes inline med `gemAboVanedag`-call på hver klik.

For forløbskunder bruges `vaneprogramDage` (fra forløbet) + `users/{uid}/products/{productId}/vanedage/dag{n}`. Gemt inline med `gemVanedag`.

Mad-progress bruger `dagligeMalForBruger(userDoc.dagligeMaal)` med fallback til STANDARD_DAGLIGE_MAL (protein 90g, fiber 30g).

### Beslutninger

**Hvorfor vaner inline i stedet for link til modul:** brugeren skal ikke skifte side bare for at sætte et flueben. Optimerer for hurtig daglig logging.

**Hvorfor inline-rækker er horisontale (label + chips):** sparer ca. halv højde sammenlignet med stablet (label over chips). Vigtigt så hele forsiden ikke bliver for lang.

**Hvorfor pille-formede chips og ikke firkantede:** matchede ikke resten af app'ens stil ifølge feedback. Pille-formen føles lettere.

**Hvorfor labels nu bruger Playfair Display:** action-card-titler bruger Playfair, så vane-labels stak ud da de brugte DM Sans. Nu samme typografi-hierarki.

### Filer (nye/ændrede)

- `src/routes/app/+page.svelte` — den store omstrukturering
- `src/lib/content/modulbrugerLektioner.ts` — datamodel
- `src/lib/firestore/modulbrugerLektioner.ts` — CRUD-helpers
- `src/routes/app/admin/modulbruger-lektioner/+page.svelte` — admin-side

---

## App-hjælp AI

Ny separat AI med ÉN opgave: svare på spørgsmål om hvordan appen virker. Adskilt fra Linn AI både i UI, endpoint og knowledge base.

### Hvad det er

- **Frontend:** `/app/app-hjaelp/+page.svelte` — chat-side med 4 forslag som startpunkter.
- **Backend:** `/api/app-hjaelp/+server.ts` — Cloudflare Worker, Claude Sonnet 4.6, egen rate-limit (30/dag separat fra Linn AI's 20/dag).
- **Knowledge base:** `src/lib/content/appHjaelp.ts` — TypeScript-konstanter med sektioner pr produkt. IKKE Firestore. Når kode ændres, opdateres relevante sektioner manuelt.
- **Adgangs-filter:** sektioner har `visFor: ActiveProduct[]`. Brugerens activeProduct bestemmer hvilke sektioner der inkluderes i system-prompten. Basis-brugere får IKKE svar om premium-features, og forløbskunder får IKKE svar om abo-features.

### Forsiden

Under "Personlig coaching" på alle 3 forside-varianter ligger en lille knap *"Har du spørgsmål til appen? Stil dem her — jeg svarer med det samme"*.

### Vigtigt

System-prompten afviser eksplicit faglige spørgsmål (kost, træning, helbred) og henviser til Linn AI (premium) eller Beskeder (forløbskunde). Hver gang appens funktioner ændres, skal `APP_HJAELP_SEKTIONER` i `appHjaelp.ts` opdateres så svar matcher virkeligheden.

### Filer

- `src/lib/content/appHjaelp.ts` — knowledge base + prompt-byg
- `src/routes/api/app-hjaelp/+server.ts` — worker
- `src/routes/app/app-hjaelp/+page.svelte` — chat-UI

---

## AI-rating

Brugere kan rate hvert AI-svar 1-5 stjerner. Gælder både Linn AI og App-hjælp.

### UI

Under hvert AI-svar vises subtle prompt: *"Hjælp os med at gøre AI bedre — rate svaret"* med 5 gylne stjerner. Klik → svaret gemmes, stjernerne fryses, "Tak"-besked. Komponenten er `src/lib/components/StjerneRating.svelte`.

### Datamodel

`aiRatings/{id}` med:
- aiType ('linn-ai' | 'app-hjaelp')
- uid + userEmail (så admin kan se hvem)
- sporgsmaal (truncate 1500) + svar (truncate 5000)
- rating: 1-5
- samtaleId + beskedIdx for Linn AI (deterministisk id så re-rating overskriver)
- For App-hjælp: timestamp-baseret id (hver rating = nyt doc)

### Admin

`/app/admin/ai-ratings/+page.svelte` — viser:
- Gennemsnitlig rating pr AI-type øverst
- Filter på AI-type + max-rating (find dårligst ratede svar)
- Klikbar liste der folder ud til fuld spørgsmål+svar

### Firestore-rules (SKAL OPDATERES MANUELT)

```
match /aiRatings/{ratingId} {
    allow read: if isAdmin() || (request.auth != null && resource.data.uid == request.auth.uid);
    allow create: if request.auth != null && request.resource.data.uid == request.auth.uid;
    allow update: if request.auth != null && resource.data.uid == request.auth.uid;
    allow delete: if isAdmin();
}
```

### Filer

- `src/lib/content/aiRating.ts` — typer + doc-id-helper
- `src/lib/firestore/aiRating.ts` — gem/hent
- `src/lib/components/StjerneRating.svelte`
- `src/routes/app/admin/ai-ratings/+page.svelte`

---

## Mad-modul (omdøbt fra Kost)

Alle SYNLIGE forekomster af "Kost" som modul-navn er ændret til "Mad":
- `MODULER_BASE.navn: 'Mad'` i `src/lib/content/moduler.ts`
- 30-30-3-siden viser nu "Mad"-eyebrow over "30-30 beregner"-titlen
- Action-cards på forsiden bruger "Mad"-eyebrow
- App-hjælp knowledge base referer til "Mad-modulet"

**Bevidst IKKE ændret:** interne identifiers (`kost`-modul-id, `src/lib/content/kost.ts`-filnavn, `modul === 'kost'`-checks). At ændre dem ville kræve data-migration uden brugerværdi.

Nyt **`workout`-ikon** i `Icon.svelte` (tændstik-figur med arme/ben spredt) erstatter `flame` på Træning-modulet og Mikrotræning-action-cards.

---

## Træning gennemført + forside-feedback

Begge spil-sider (`abo/[dato]/spil` + `[dag]/spil`) har nu en sage-grøn knap **"Tryk her for at markere træningen gennemført"** under play/pause-kontrollerne. Klik sætter `phase = 'done'` så det eksisterende gem+feedback-flow kører.

Forsidens Mikrotræning-card viser gennemført-state:
- For modulbrugere: tjek mod `aboTraeninger`-datoer (allerede loadet til strip)
- For forløbskunder: tjek mod `userProduct.fremgang.mikrotraening.gennemforte`-array
- Når gennemført: sage-grøn ikon-baggrund + check-icon + "Gennemført"-meta

**Video-thumbnail** under "Dagens lektion" / Mikrotræning-cardet: 46x46 autoplay-muted-loop af dagens første øvelse. Lille check-badge i hjørnet hvis trænet. Falder tilbage til workout-ikon hvis video ikke kan hentes.

---

## iOS zoom-fix

iOS Safari zoomede ind på inputs hvis font-size < 16px. Den eksisterende globale regel i `src/app.css` blev tilsidesat af komponent-scoped CSS pga. specificity. Tilføjet `!important` + udvidet til at dække date/time/datetime-local/month/week-typer:

```css
input[...], textarea, select {
    font-size: max(16px, calc(14px * var(--fs-scale, 1))) !important;
}
```

Tekstskalering virker stadig — den faktiske visuelle størrelse styres via CSS-variabler i komponenten.

---

## Tilbage-knap til forsiden

Tilbage-knapper på 30-30-3 og Mikrotræning-abo-siderne bruger nu `history.back()` i stedet for fast href til "Moduler". Resultat: når brugeren klikker en forside-card, kommer hun tilbage til forsiden ved at trykke Tilbage (i stedet for at lande på `/app/moduler`-listen). Falder tilbage til `/app` (forside) hvis ingen historik (direkte URL-access).

---

## Diverse UX-finjusteringer (mindre commits)

- **Forside coaching-tekst**: "Personlig træning med Linn" → "Personlig coaching med Linn" (alle 3 varianter)
- **Vaner månedsarkiv**: sorteret nu ældste-først inden for hver måned (i stedet for nyeste-først)
- **Vaner månedsarkiv**: fjernet "X/Y"-tæller, tilføjet farvekode-legende (mørke-grøn = alle, brun = halvdelen, sand = få osv)
- **Mikrotræning abo-page**: fjernet "Træninger i alt"-stat, "Tidligere træninger"-liste og det lille flueben på chips. Tilføjet farvekode-legende.
- **Bibliotek Links-fane**: skjules nu hvis ingen synlige guides (auto-switch til FAQ eller Opskrifter via $effect)
- **--text4-token** mørkere så hint-tekster er læselige (`rgba(107, 78, 66, 0.7)` i stedet for `rgba(160, 136, 120, 0.45)`)
- **30-30-3 dagbog**: knap "Byg måltid for denne dag" der pre-vælger dagbog-dato som gem-dato + skifter til Byg-fanen
- **Forside Mad-link**: passer `?dato=YYYY-MM-DD` så dagbogen åbner på valgt strip-dato
- **Tjek-knap fade-fix**: aktiv svar-knap bliver IKKE bleg under gem-async længere (kun de ikke-aktive)
- **Bonus-knap-farver**: får nu samme farvekode som vane-knapper (positive = grøn, neutral = brun, negative = terra)

---

## Tekniske gotchas (nye i v25)

- **Firestore-rules SKAL kopieres til Firebase Console** for at de to nye features (`modulbrugerLektioner` + `aiRatings`) virker i prod. `firestore.rules` er kun en kildefil i repo'et, ikke auto-deployet.
- **App-hjælp knowledge base er kode**, ikke data. Når du ændrer en feature, så husk at opdatere relevante `APP_HJAELP_SEKTIONER`-entry i `src/lib/content/appHjaelp.ts` så svar matcher virkeligheden.
- **Vaner inline gemmer optimistisk** — UI opdateres FØR Firestore-callet. Hvis save fejler logges advarsel men UI'et viser stadig den valgte tilstand. Det er bevidst (mindre frustrerende UX).
- **Aboo-vaner og forløbs-vaner har FORSKELLIGE datamodeller**: abo bruger `aboVaneOpsaetning` + dato-baseret entries, forløb bruger `vaneprogramDage` + dagNummer-baseret entries. Bonus-svar er også forskellige (abo har 3 svarmuligheder 0/1/2, forløb har 'ja'/'nej').
- **Video-thumbnails er lazy** — fetched async via getVideoUrl. Hvis Firebase Storage er nede eller exercise mangler videoPath, falder UI'et tilbage til workout-ikon uden fejl.
- **`history.back()` på back-knapper** kan opføre sig uventet hvis brugeren bruger åbn-i-ny-fane og lignende. Fallback til `/app` håndterer direkte URL-access.
- **iOS zoom-fix bruger `!important`** — hvis du tilføjer en ny input et sted og fonten skal være MINDRE end 16px af æstetiske grunde, så er det ikke muligt på iOS. Vi har bevidst valgt læselighed over æstetik der.

---

## Hvad du skal gøre lige nu

### Cloudflare deploy

Alle commits er pushed, auto-deployet sker.

### Firestore-rules (KRITISK)

Kopier `firestore.rules` indhold til Firebase Console → Firestore → Rules → Publish. Uden dette virker:
- Modulbruger-lektioner ikke (admin kan ikke gemme, brugere kan ikke læse)
- AI-rating ikke (brugere kan ikke skrive)

### Test-flow

- Log ind som `basis_app@linnsacademy.dk` for at se den nye modulbruger-forside med inline vaner + Mad progress-barer
- Log ind som `kickstart@linnsacademy.dk` for at se forløbskunde-versionen
- Som admin: opret en lektion på `/app/admin/modulbruger-lektioner` og se den dukke op på modulbruger-forsiden
- Test App-hjælp: klik "Har du spørgsmål til appen?" på forsiden
- Test AI-rating: stil et spørgsmål til Linn AI eller App-hjælp, rate svaret, og se det dukke op i `/app/admin/ai-ratings`

---

## Næste session — prioriteret

### 1. Firestore-rules deploy (HOVEDPRIORITET)

Skal copy-pastes til Firebase Console før features virker i prod.

### 2. Cancel-flow afklaring (fra v24)

Find ud af om Simperos cancel sender to events bevidst.

### 3. Forløbskunde test af det nye forside-layout

Inline vaner for forløbskunder er bygget men ikke testet end-to-end. Tjek at vaneprogramDage hentes korrekt, at check-in dage (0, 7, 14, 21) viser sliders, og at gemmen virker.

### 4. App-hjælp knowledge base udvidelse

Den nuværende videnbase i `appHjaelp.ts` er en grundlæggende beskrivelse. Tilføj sektioner om:
- Opskrifts-bibliotek navigation
- Hvordan man tilføjer egne opskrifter (premium)
- Hvordan man ændrer dagligt mål
- Hvordan man slipper af med en vane / nulstiller baseline
- Beskeder-flow (forløbskunder)

### 5. Persona-prompt til Linn AI (uændret fra v24)

### 6. Auto-eksport af klient-spørgsmål til Linn AI-videnbasen (uændret fra v24)

### Mulige udvidelser

7. AI-rating: vis bruger sin egen tidligere rating når hun besøger samme samtale igen (allerede skitseret i `hentAiRating`, ikke wired op)
8. Modulbruger-lektioner: filter pr accessLevel (gør det muligt at lave premium-only lektioner)
9. Træning-thumbnail på forside skal opdatere baseret på valgt strip-dato (i øjeblikket viser den aktuelle programdag baseret på fremgang, ikke valgt dato)
10. Blokér direkte URL-adgang til vane-/mikrotræning-datoer før brugerens start-dato
11. Sæt `SIMPLERO_WEBHOOK_SECRET` som env-variabel i Cloudflare Pages og slå signatur-verifikation til
12. Streaming responses i Linn AI-chat

---

## CLAUDE-instruktion: Læs IKKE handover v17-v24 inden du starter

v25 er det fulde aktuelle tillæg til v24. v22 dækker fødevare-berigelse + Min opskrift; v23 dækker frokost-kategori-fix + Optimér min mad; v24 dækker Simplero-webhook split + mine-køb-refaktor + adgangs-flow-stramning; v25 dækker forside-omstrukturering + modulbruger-lektioner + App-hjælp AI + AI-rating + Mad-omdøbning. De fire seneste handovers tilsammen er det fulde billede oven på v21.
