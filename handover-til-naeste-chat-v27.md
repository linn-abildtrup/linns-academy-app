# Handover til næste chat — v27

Specifikation efter dialog 21. maj 2026. Den her chat har IKKE ændret kode — den har fastlåst arkitekturen for **Linns Academy 2.0**: én samlet app for alle kunder, ingen basis/premium-distinktion.

Næste chat skal bruge dette dokument som blåtryk når implementeringen begynder.

---

## Hovedtema i v27 — "Linns Academy 2.0"

Den eksisterende model med to apps (basis + premium) lægges sammen til **én app**. Alle eksisterende premium-eksklusive features åbnes for alle. `accessLevel: basis | premium` fjernes fra data-modellen. Forskellen mellem kunde-typer reduceres til to enkle tilstande: **app-kunde** eller **forløbskunde**.

Et nyt 3. forløb introduceres (52 uger, rullende, kan pauses).

Hele arkitekturen er specificeret nedenfor — koden er endnu ikke skrevet.

---

## Kunde-model

### To kunde-typer

| Type | Adgang | Linn-chat | Vaner |
|---|---|---|---|
| **App-kunde** | Hele appen | Nej | Selvvalgte (op til 3) |
| **Forløbskunde** | Hele appen + dagens lektion + admin-styrede små skridt | Ja | Admin-låste |

### Adgangs-regler

- Aktivt forløb giver fuld app-adgang inkluderet
- Forløbs-slut → 90 dages bibliotek-bonus (uændret fra i dag)
- Efter bonus → ingen adgang medmindre kunde køber app-abo eller nyt forløb
- Kun ét aktivt forløb ad gangen
- Pris/abo-model er ikke en arkitektur-bekymring

### Slettet fra data-modellen

- `accessLevel: 'basis' | 'premium'` (fjernes overalt — også i Firestore-felter, kode-helpers, UI-gating)
- `harPremium()`-funktionen og alle dens kaldesteder
- Alle premium-låse på: Linn AI, scanner, Optimér min mad, Min opskrift, udvidet næring, 7-vaner-grænsen

---

## Forsiden

Samme rækkefølge for alle kunder, men element #2 skjules hvis ikke forløbskunde.

| # | Element | Hvem |
|---|---|---|
| 1 | **Din rejse** (datostrip — klik på dato → den dags lektioner + små skridt + mad) | Alle |
| 2 | **Dagens lektion** | Forløbskunder |
| 3 | **Dagens små skridt** | Alle |
| 4 | **Mad-modulet** | Alle |
| 5 | **Mikrotræning** | Alle |
| 6 | **Personlig coaching** (booking-link til Linn på Simplero) | Alle |
| 7 | **AI-hjælp til appen** | Alle |

Tre nuværende forside-layouts (`forlobskunde` / `modulbruger` / `udlobet`) konsolideres til ÉN layout med betinget visning af #2.

## Bundnavigation

- **Beskeder**-fane: kun forløbskunder (uændret fra i dag)
- Øvrige faner uændret

---

## Modul-ændringer

### Træning-modul (stor omskrivning)

**Default for ALLE kunder:** kun admin-tildelte programmer er synlige. Ingen kunde får automatisk fri adgang til hele øvelseskataloget længere.

**Admin tildeler på to dimensioner:**

| Tildelings-type | Modtagere |
|---|---|
| **Specifikke programmer** | Hele forløbet (gruppe) ELLER enkeltkunder |
| **Custom-builder-adgang** | Hele forløbet (gruppe) ELLER enkeltkunder |

**Custom-builder (ny feature):** Kunder med tildelt adgang kan bygge eget program ved at vælge:
- Øvelser fra katalog
- Antal sæt
- Antal repetitioner
- Pause mellem sæt

**"Gruppe" = forløbet selv.** Ingen ny abstraktion — admin vælger fx "Alle på Kickstart maj 2026" eller en enkeltkunde. Ad hoc-grupper er ikke nødvendige.

### Vaner-modul

- **App-kunde:** vælger selv op til 3 vaner fra katalog (som i dag for basis-abo)
- **Forløbskunde:** admin-låste vaner (som i dag for forløbskunder)
- **Uge-check-in** flyttes hertil fra det nuværende "Mit forløb"-modul

### "Mit forløb"-modul

Fjernes som selvstændigt modul-kort på moduler-siden. Dets indhold fordeles:
- **Dagens lektion** → forsiden (#2)
- **Uge-check-in** → vaner-modulet

### Bibliotek

Får nye **faner pr gennemført forløb:** "Kickstart", "Kropsro", "[3. forløb-navn]". Hver fane viser:
- Lektioner kunden var igennem
- Kundens egne noter og refleksioner fra forløbet

---

## Datalag

**Princip: alt på kundeniveau.** Ingen data ligger pr forløb-instans.

### Datastier — konsolidering

I dag har vi to parallelle datastier for samme type data. De skal samles:

| Modul | Nu (app-kunde) | Nu (forløbskunde) | Nyt (alle) |
|---|---|---|---|
| Vaner | `users/{uid}/aboVanedage/{dato}` | `users/{uid}/products/{forlobId}/vanedage/dag{N}` | **Én strøm pr kunde** (kalender-baseret) |
| Mikrotræning | `users/{uid}/aboMikrotraening/{dato}` | `users/{uid}/products/{forlobId}/fremgang` | **Én strøm pr kunde** |
| Måltider | `users/{uid}/maaltider/{dato}` | `users/{uid}/maaltider/{dato}` | Allerede én strøm ✅ |

### Hvad forbliver pr forløb

- `users/{uid}/products/{forlobId}/lektion-noter` — noter til lektioner (vises i bibliotek-fanen)
- `users/{uid}/products/{forlobId}/uge-check-in` — ugentlige refleksioner
- Forløbs-progression (hvilken dag/uge er kunden på)

### Bevares uændret

- `userDoc.forlobIds: string[]` — historik over alle forløb kunden har været på
- `users/{uid}/customFodevarer` — egne fødevarer
- `users/{uid}/favoritter`

---

## Det 3. forløb (rullende)

**Spec:**
- **52 uger**
- **1 lektion pr uge**
- Format ligner Kropsro (kun længere + ugentlig rytme)
- Kunden kan starte når hun vil

**Lifecycle:** Kunden kan:
- **Starte** — første gang
- **Pause** — kunden betaler stadig, app-adgang bevares, kun forløbs-counter står stille
- **Fortsætte** — fra hvor hun pausede
- **Stoppe** — afslut forløbet
- **Start forfra** — dag-counter → 1, men **historikken bevares** i biblioteket

**Bonus efter stop:** sandsynligvis 90 dage som de andre forløb — bekræft når indholdet er designet.

**Indhold er ikke designet endnu** — arkitekturen kan bygges først, indhold lægges på senere.

---

## Migration af eksisterende kunder

**Princip:** Alle eksisterende kunder over på den nye model. 90-dages bonus uændret.

**Konkret overgang:**

| I dag | Bliver i ny model |
|---|---|
| 92 basis-abo-kunder | App-kunder |
| 1 premium-abo-kunde | App-kunde |
| 199 i 90-dages bibliotek-bonus | Uændret bonus, derefter ingen adgang medmindre køb |
| 13 aktive forløbskunder | Forløbskunder |
| 78 med manuel basis-adgang efter Kropsro-køb | App-kunder |

**Udestående beslutning — datalag-migration:**

To strategier til at samle de to datastier (vanedage og mikrotræning):

- **Strategi A (flade ud):** Migrér forløbs-historik én gang ind i kundestrømmen. Slet de gamle stier bagefter. Ren — men engangs-risiko.
- **Strategi B (legacy snapshot):** Behold de gamle stier som arkiv. Start ny strøm fra overgangsdatoen. Bibliotek viser begge.
- **Strategi C (hybrid):** Flad ud det vi VED er kritisk (vanedage, mikrotræning-fremgang), behold lektionshistorik separat.

Beslutning udskudt indtil implementeringen starter.

---

## Admin-UI — nyt der skal bygges

Vi har i dag IKKE et admin-modul til at tildele programmer eller custom-builder-adgang. Det skal designes fra bunden. Krav:

1. **Liste over kunder** — søgbar (navn + email) — eksisterer delvist på `nulstil-adgang`-siden
2. **Tildel program** — vælg program + vælg modtagere (hele et forløb ELLER en eller flere enkeltkunder)
3. **Tildel custom-builder-adgang** — samme to-vejs-tildelings-UI
4. **Vis hvem der har hvad** — pr kunde: hvilke programmer + om de har custom-adgang
5. **Vis hvem der er i et forløb** — pr forløb: liste over alle deltagere

---

## Implementerings-rækkefølge (forslag til næste chat)

Den her omskrivning er stor. Foreslået rækkefølge:

### Fase 1 — Forenkling uden datalag-ændringer
1. Fjern `accessLevel: basis | premium` fra alle gates (Linn AI, scanner, Optimér, Min opskrift, udvidet næring, 7-vaner). Alt åbnes for alle.
2. Konsolidér de tre forsider til én.
3. Fjern "Mit forløb"-modulet fra moduler-listen. Flyt dagens lektion til forsiden, uge-check-in til vaner-modulet.
4. Fjern "Beskeder"-fane for ikke-forløbskunder (allerede sådan i dag, men dobbelt-tjek).

### Fase 2 — Træning-modul omskrivning
5. Byg admin-UI for program-tildeling og custom-builder-tildeling.
6. Skift træning-modulet til "admin-styret default" for alle.
7. Byg custom-workout-builder UI.

### Fase 3 — Datalag-konsolidering
8. Beslut migrations-strategi (A/B/C).
9. Migrér vanedage og mikrotræning-historik.
10. Opdatér bibliotek til at hente fra én strøm + vise forløbs-faner.

### Fase 4 — Det 3. forløb
11. Byg forløbs-lifecycle-state (start/pause/genoptag/forfra).
12. Byg ugentlig progression med "klient starter når hun vil".
13. Indhold lægges på når Linn har designet det.

---

## Hvad der IKKE skal røres

- Måltider, opskrifter, kalori-beregning, scanner: virker fint, ingen ændringer
- Optimér min mad, Min opskrift, Linn AI: skal bare have premium-gating fjernet
- Auth-flow, password-reset, glemt-kode: uændret
- Custom-fødevarer: uændret
- Bonus-skridt: uændret
- Performance-optimeringer (IndexedDB-cache, in-memory caches, top-200 fødevarer-bundle, 90-dages cutoff): bevares
- Service worker: bevares
- Simplero-webhook: skal opdateres når nye produkt-IDs introduceres, men ikke ændres strukturelt

---

## Spørgsmål næste chat bør stille før implementering

1. Hvilken fase starter vi med? Forslag: Fase 1 (lavrisiko, høj UX-værdi).
2. Skal Fase 1 deployes som én PR eller fire separate?
3. Datalag-migration (Strategi A/B/C) — afklares før Fase 3.
4. Indhold til det 3. forløb — Linn skal designe ugentlige lektioner.
5. Pricing-model for ren "app-kunde" — Linn beslutter, ikke kode-relevant.

---

## Referencer

- Tidligere handover: `handover-til-naeste-chat-v26.md` (migrations-status fra 15.-17. maj)
- Eksisterende kode-arkitektur dokumenteret i CLAUDE.md
- Memory-noter relevante: `project_linns_academy.md`, `project_kunde_typologi.md`

**Status:** Specifikation låst. Klar til implementering. Ingen kode ændret i denne session.
