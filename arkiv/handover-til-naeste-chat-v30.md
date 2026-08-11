# Handover til næste chat — v30

**Dato:** 16. juni 2026
**Session-tema:** **Kunders udvikling-dashboard udvidet til 4 måletype-faner** (MRS · Velvære · Refleksioner · Manglende aktivitet) · **genberegning fra appen** (Opdater tal + Fuld) · **fødevare-0-kcal-bug rettet** · **Små skridt samlet i ét system** · **lektion-grid + dag-faner** · **Linn AI "Lær af alle svar"-videnbase** · diverse UI-finpudsninger.

Denne handover er selvstændig — en frisk session kan læse den og være produktiv. Memory-filerne loades også automatisk. (v27 dækker den separate "Linns Academy 2.0"-rearkitektur, stadig IKKE implementeret. v29 dækker feature-skema + første MRS-dashboard + nul-dage-til-Kickstart.)

---

## 0. Arbejdsgang — læs FØRST (vigtigt i en frisk terminal)

- **Stack:** SvelteKit (Svelte 5 runes: `$state`, `$derived`, `$effect`, `{@const}`, `{#snippet}`/`{@render}`), Firestore, Cloudflare Pages (auto-deployer fra `main`), Firebase Auth + Storage. Alt UI/kommentarer er på **dansk**.
- **Før commit, kør altid:** `npx svelte-check --threshold error` (skal være 0 errors), `npm test` ved logik-ændringer, `npx prettier --write <filer>`.
- **Deployment:** push til `main` → Cloudflare bygger/deployer automatisk. MEN **`firestore.rules` og `storage.rules` deployes MANUELT** via copy-paste til Firebase Console (to faner: Firestore Rules / Storage Rules). Git matcher det deployede, men push deployer dem IKKE.
- **Data-scripts:** kører via `firebase-admin` + `scripts/service-account-key.json` (lokal, IKKE i git). Mønster: skriv midlertidigt `scripts/_navn.ts`, kør `npx tsx scripts/_navn.ts`, **slet det bagefter**. Der ligger pt. mange utracked `scripts/_*.ts` lokalt — de er bevidst IKKE committet (diagnose-engangsting, ofte PII). Lad dem ligge utracked; commit dem ikke.
- **~600-700 kunder i drift.** Verificér ALTID risikable ændringer mod live-data FØR kodning. Vælg den mindst risikable løsning.
- **Testkonti at ekskludere fra live-tal:** alle `@linnsacademy.dk`-emails, `linnsacademy@gmail.com`, `premium_app@linnsacademy.dk`, `kickstart@linnsacademy.dk`, og **Bente** = `kickstart-01-06-2026@linnsacademy.dk`.
- **Linns arbejdsstil:** forklar enkelt/ikke-teknisk; lav aldrig mere end aftalt; **kod ALDRIG før hun siger "ja"/"kod"** — også på "er det muligt?"-spørgsmål, svar først; list ændringer + verificér mod live før hver commit; én ting ad gangen; separate commits. Commit-besked slutter med `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`. Hun arbejder i screenshots — kig altid i `screenshots/` (nyeste fil) når hun siger "se screenshot".

---

## 1. "Kunders udvikling"-dashboard (`/app/admin/dashboard`) — nu 4 måletype-faner

Overskrift = **"Kunders udvikling"**. Fire faner foroven (måletyper, ikke datasæt):

| Fane | Indhold |
|---|---|
| **MRS-udvikling** | MRS-rejse-graf, baseline-sværgrad, demografi, forbedrings-fordeling, subskalaer. `Alle`/`Gennemførte`-toggle + hold-vælger. |
| **Velvære-udvikling** | Egen velvære-måling (5 sliders, HØJERE=bedre), **check-in-for-check-in-tabel** (matcher Linns eksterne "udvikling uge for uge"-rapport). `Alle`/`Gennemførte`-toggle. |
| **Refleksioner** | Aktivitets-tal + engagement-kurve pr forløbsdag + AI-tema-opsummering on-demand. Se §2. |
| **Manglende aktivitet** | Risiko-liste over inaktive/faldende kunder i igangværende forløb. Se §3. |

**MRS** = Menopause Rating Scale, 0-44, **LAVERE=bedre**. Velvære = 5 sliders 1-10, HØJERE=bedre. Disse er **to forskellige målinger** — derfor hver sin fane (Linns udtrykkelige ønske).

### Snapshot-arkitektur (uændret princip fra v29, nu udvidet)
Hvert tema har: `scripts/generer-<tema>-stats.ts` (firebase-admin) → skriver ÉT dokument i `adminStats/<tema>`. Dashboardet læser kun snapshot-dokumentet = lynhurtigt. Snapshots: `adminStats/mrs`, `adminStats/refleksion`, `adminStats/aktivitet`.

### Delt beregningsmodul (vigtig refaktor)
`src/lib/stats/mrsBeregning.ts` = **ren, delt** MRS/velvære-beregning (`beregnScope`, `distillerKunde`, `byggSnapshot`, `mrsStats`, `velvaereStats`, `effektivKcal`). Bruges af BÅDE scriptet OG genberegnings-endpointet, så tal er identiske uanset hvor de genberegnes. Producerer også `mrsCompletere`/`velvaereCompletere` (gennemførte-subsets til toggle).

### Genberegning fra APPEN (ingen terminal)
Linn har to knapper på dashboardet:
- **"Opdater tal"** (incremental): `POST /api/admin/genberegn-mrs`. Genbruger per-kunde-cache `mrsCache/{uid}` (skrevet af scriptet) og genberegner KUN kunder med nye målinger. Hurtigt. **Bruges i dagligdagen.**
- **"Fuld genberegning"**: `POST /api/admin/genberegn-mrs?mode=fuld`. Læser ALT via collection-group + bunke-skriv. Bruges når beregnings-LOGIK ændres (ny kolonne, ændret formel), eller cachen er skæv.
- Endpointet genberegner også refleksions- og aktivitets-snapshots.

**Cloudflare-runtime-detalje:** firebase-admin (gRPC) virker IKKE på Cloudflare Workers. Derfor `src/lib/server/firestoreRest.ts` = custom Firestore REST-klient (service-account fra env-vars, JWT via Web Crypto). Den har `hentCollectionGroupAlle`/`hentHeleCollection`/`hentAlleDocs`/`batchWrite`. Genberegnings-endpoints bruger DEN, ikke firebase-admin.

**Firestore-index:** collection-group-queries på `mrs_scores.timestamp` kræver et **COLLECTION_GROUP_ASC**-index (oprettet i Console). Hvis et genberegnings-endpoint giver 500, er manglende/forkert index den hyppigste årsag — fejlen surfaces nu rigtigt (ikke "Internal Error").

Detaljer: memory `project_admin_dashboard.md` + `project_dashboard_opdater.md`.

---

## 2. Refleksioner-fane (aktivitet + AI-temaer)

- **Modul:** `src/lib/stats/refleksionBeregning.ts` + `scripts/generer-refleksion-stats.ts`. Snapshot `adminStats/refleksion`: samlet + prType + **prForlob**.
- **Grupperet pr SPECIFIKT forløb (forlobId), ikke pr produkt.** ⚠️ Faldgrube: juni-Kickstart-vanedage lever under `premiumforløb`-produktet → naiv produkt-gruppering talte dem som Kropsro. Løst ved at slå `products/{pid}.forlobId` op. (Eksempel-effekt: Kickstart 1828→2669, Kropsro 1062→221.)
- **AI-tema-opsummering on-demand:** `POST /api/admin/refleksion-temaer` med `{valg, dag}` (specifikt forløb ELLER type). Knappen "Opsummer temaer" i fanen kalder Claude (Sonnet 4.6) når Linn trykker — ikke automatisk.

---

## 3. Manglende aktivitet-fane

- **Modul:** `src/lib/stats/aktivitetBeregning.ts` + `scripts/generer-aktivitet-stats.ts` + `POST /api/admin/genberegn-aktivitet` ("Opdater liste").
- **Kun kunder i IGANGVÆRENDE forløb.** `INAKTIV_DAGE = 3`. Viser både **inaktive** (≥3 dage) OG **faldende** aktivitet.
- **Aktivitet = max timestamp** på tværs af `maaltider.oprettet`, `vanedage`/`aboVanedage.savedAt`, `traeningHistorik.gennemfoertAt`. ⚠️ Auth `lastSignInTime` LYVER for PWA-kunder — brug aldrig den (memory `feedback_aktivitet_maaling`).

---

## 4. Fødevare-/makro-system — 0-kcal-bug rettet

Kunde-klage: "Lurpak smør viser 0 kalorier". Fuldt diagnosticeret + rettet. Detaljer i memory `project_fodevarer_kost.md`. Kort:

- **FIRE datakilder:** frida (~1381, god) · oprindeligt sæt uden kilde (~840, god) · legacy `community` (49, delt, `gemCommunityFodevare` er UDFASET) · **private `users/{uid}/customFodevarer`** (~3503, kun synlige for ejeren — det er HER nye bruger-fødevarer havner i dag).
- **`effektivKcal(food)`** i `src/lib/content/kost.ts`: bruger `food.kcal` hvis sat>0, ellers Atwater (`4·p + 4·kh + 9·fedt`). Brugt i `beregnItem` = sikkerhedsnet for alle med makroer men manglende kcal.
- **`TilfoejFodevareDialog`**: auto-udregner kcal fra makroer ved gemning hvis tom + `advarsler`-prop ("Tjek lige tallene"-banner).
- **OFF-kvalitetskontrol:** `tjekNaering()` i `openFoodFacts.ts` (plausibilitetstjek). `vaelgOffProdukt` henter nu det FULDE produkt på stregkode (`lookupBarcode`) i stedet for søge-indeksets tynde tal (det var rod-årsagen). Frida køres ikke gennem tjekket (pålidelig).
- **`scripts/berig-community-fodevarer.ts`** (dry-run default, `--apply`): re-berigede de 3 ægte-stregkode community-foods fra OFF (KØRT: Lurpak→707 kcal/78g fedt, Kefir→54, Pepsi→1).
- Gamle delte `manual_`/`community`-foods vises i søgningen kun for deres opretter; `foodMap` beholder ALLE så gamle måltider stadig beregnes.

---

## 5. Lektioner + Små skridt (admin-forløbsindhold)

### Lektioner
- **Kalender-grid** på `/app/admin/forlob/[id]/lektioner`: uger, ugedage, tomme-filter.
- **Dag-redigeringssiden** `/app/admin/forlob/[id]/lektioner/[dag]` har 3 faner: **Lektioner · Refleksioner · Små skridt** + pile til forrige/næste dag.
- **NYT (denne session):** under "Dag XX" vises nu **ugedag + dato centreret**, fx "Uge 4 · Mandag 15. juni" — udregnet `forlob.startDato + dagNummer` (Dag 0 = baseline). `dagDato`-derived i `[dag]/+page.svelte`.

### Små skridt — ét samlet system
`/app/admin/forlob/[id]/smaa-skridt` (+ `ForlobSmaaSkridtFane`-komponent på dag-siden). **Ét værktøj dækker både daglige vaner (alle dage) og uge-baserede skridt.** Plan-typer: Alle dage / Hele uger / Interval / Ugedage / Bestemte dage. **Kladde → manuel "Publicér til appen"** (skriver først ind på de rigtige dage + gør synligt for kunder ved publicering). Faste vaner + uge-skridt er migreret ind i dette system (live 14/6). Den gamle faste-vaner-redigering under Refleksioner er FJERNET, og gamle `/vaner`-admin-ruter er slettet.
- **NYT (denne session):** "Publicér til appen"-rubrikken er flyttet OP (mellem formularen og "På dette forløb"-listen) med ekstra luft, så man ikke skal scrolle forbi hele listen for at publicere.

Detaljer: memory `project_dag_faner_omstrukturering`, `project_kickstart_traening_krav`.

---

## 6. Linn AI — "Lær af alle svar" + videnbase

To lag i AI-vidensmotoren (`src/lib/server/svarViden.ts`, delt af admin-svar-udkast OG kunde-chat):
1. **Rullende eksempler (auto):** 30 nyeste besvarede Q&A pr forløb (`klientspoergsmaal` + `svarHistorik`).
2. **Permanent destilleret videnbase (`linnAiVidenbase`):** Ny knap "Lær af alle svar" på `/app/admin/linn-ai` → `POST /api/admin/laer-af-svar`. Samler ALLE besvarede Q&A og destillerer til 4-6 kompakte videns-docs via Claude. **Map-reduce i bidder** (CHUNK=100, pause 3500ms mellem) for at undgå Anthropics 429 rate-limit; reduce-trin konsoliderer til JSON (max_tokens 8192, robust JSON-ekstraktion). Docs får id-præfiks `destil_`, kilde `klient_spoergsmaal`. On-demand ("engang imellem"). Erstatter gamle `destil_`-docs; rører ikke manuelt uploadede. **Linn kan redigere/slette hver doc inline.** (Kørt 14/6: 6 docs lavet.)

Detaljer: memory `project_ai_videnbase.md`, `project_linn_ai_beskeder.md`.

### NYT (denne session): kunde-chat-layout
I kunde-Beskeder (`src/routes/app/beskeder/+page.svelte`), Linn AI-fanen: **skrivefeltet + "Spørg Linn AI"-knappen står nu FOROVEN** (lige under intro'en, som "Skriv til Linn"), og samtaletråden vokser NEDENUNDER (adskilt med en tynd streg). Tidligere blev skrivefeltet skubbet nedad af svarene.

---

## 7. Mindre UI

- **"Dagens små skridt" vane-svar er nu en TOGGLE:** klik på et allerede valgt Ja/Delvist/Nej fjerner svaret (forsiden).
- **Symptomcheck-CTA** (Kickstart-forsiden): endte på **grøn (sage) gradient + blød puls** (Linn afviste den varme/orange variant — "vi skal mere over i det grønne").

---

## 8. Åbne tråde / ikke gjort

- **Charlotte Stausholm (Kropsro), nul-dage + tidlig bonus-adgang — DROPPET af Linn ("glem det").** Kontekst hvis det dukker op igen: lektioner låses op pr **effektiv dag** = kalenderdage siden start MINUS passerede nul-dage (`getCurrentDayMedNulDage` i `src/lib/content/forlob.ts`). Charlotte har 14 nul-dage (pause 24/5–6/6) → effektiv dag ≈ 7, mens holdet er på dag 21. Bonus-lektionen "Lær din normal at kende" ligger på dag 21. Der findes INGEN per-kunde tidlig-oplåsning i koden. Hvis ønsket igen: enten (a) trimme nul-dage (blunt — oversvømmer + forkorter pause, frarådet) eller (b) bygge en lille per-kunde "lås op denne dag/lektion"-override. Intet er kodet.
- **Mange utracked `scripts/_*.ts`** lokalt — bevidst ikke committet. Overvej `.gitignore` for `scripts/_*.ts` hvis det generer (ikke gjort).
- **Forløb-webhook** (automatisér forløbskøb via Simplero) — stadig manuelt, ikke kodet (memory `project_forlob_webhook_plan`).
- **Feature-adgangs-matrix (Etape 3)** — admin-styret adgangsmatrix der erstatter basis/premium — planlagt, ikke kodet (memory `feature_adgang_plan`).

---

## 9. Hurtig fil-reference

| Område | Filer |
|---|---|
| Dashboard-side | `src/routes/app/admin/dashboard/+page.svelte` |
| Delt MRS-beregning | `src/lib/stats/mrsBeregning.ts` |
| Refleksion/aktivitet | `src/lib/stats/{refleksionBeregning,aktivitetBeregning}.ts` |
| Genberegnings-endpoints | `src/routes/api/admin/{genberegn-mrs,genberegn-aktivitet,refleksion-temaer,laer-af-svar}/+server.ts` |
| Firestore REST (Cloudflare) | `src/lib/server/firestoreRest.ts` |
| Permanente stats-scripts | `scripts/generer-{mrs,refleksion,aktivitet}-stats.ts` |
| Kost | `src/lib/content/{kost,openFoodFacts}.ts`, `src/lib/components/TilfoejFodevareDialog.svelte`, `src/routes/app/moduler/30-30-3/+page.svelte` |
| Lektion-dag | `src/routes/app/admin/forlob/[id]/lektioner/[dag]/+page.svelte` |
| Små skridt | `src/routes/app/admin/forlob/[id]/smaa-skridt/+page.svelte` |
| Linn AI (kunde) | `src/routes/app/beskeder/+page.svelte` |
| Linn AI (admin) | `src/routes/app/admin/linn-ai/+page.svelte` |

Seneste commit ved skrivetidspunkt: `14c3ee9`.
