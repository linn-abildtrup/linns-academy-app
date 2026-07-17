# Handover til næste chat — v33

**Dato:** 17. juli 2026
**Session-tema:** **Master-programmer** (Linn bygger egne, forløbs-uafhængige træningsprogrammer og tildeler dem bredt eller smalt) bygget og deployet i tre klodser · **Programmet "Bo"** oprettet (30 dage, 5→15 min) · kapacitets-audit af hosting · iMac-opsætnings-tjekliste.

Denne handover er selvstændig. Memory-filerne loades også automatisk (se især `project_master_programmer`, `project_forlob_byggevaerktoej`, `feedback_diagnose_foerst`, `feedback_fokuseret_scope`, `feedback_kunde_paavirkning`). Tidligere: v32 (måltids-fokus, gratis-abo udløb, symptomcheck én-kilde), v31 (dato-styret adgangsmodel).

> ## ⚠ VIGTIGSTE REGEL: DIAGNOSE FØRST — KOD ALDRIG UDEN GO
> Lav ALTID en grundig diagnose før du skriver eller ændrer kode: forstå årsagen, læs den relevante kode, og verificér mod live-data (tør audit / dry-run) hvor der er kunde-påvirkning. Præsentér fundene + løsningsforslag, og **vent på et klart "ja/kør/ret det"** fra Bo/Linn før du koder — også på "er det muligt?"-spørgsmål. Læse-only undersøgelse (læse filer, dumpe Firestore via midlertidige scripts der ryddes op) er en del af diagnosen og er OK. ~760 kunder i drift. (Se memory `feedback_diagnose_foerst`.)

---

## 0. Arbejdsgang — læs FØRST
Uændret fra v31/v32. Kort:
- **Stack:** SvelteKit (Svelte 5 runes), Firestore, Cloudflare Pages (auto-deployer fra `main`), Firebase Auth + Storage, Cloudflare R2 (lyd). Alt UI/kommentarer på **dansk** (ingen em-dash/semikolon i tekst til Linn).
- **Før commit:** `npx svelte-check --threshold error` (0 errors) + `npm test` ved logik-ændringer. Ved kunde-følsomt: også `npm run build` + integrationstest mod live via engangs-script.
- **Deployment:** push til `main` → Cloudflare bygger automatisk (~2 min). Commit + push KUN når Linn beder om det. `firestore.rules`/`storage.rules` deployes MANUELT via Console.
- **Data-scripts:** `firebase-admin` + `scripts/service-account-key.json` (lokal, IKKE i git). Skriv midlertidigt `scripts/_navn.ts`, kør `npx tsx`, **slet bagefter**. Dry-run/read-only før apply ved kunde-data.
- **Deploy-version:** `https://linns-academy-app.pages.dev/_app/version.json` (UTC-tidsstempel).

---

## 1. Master-programmer (STØRSTE feature — bygget, deployet, live)
Linn kan nu bygge sine egne træningsprogrammer der IKKE hører til et bestemt forløb, og tildele dem til alle app-brugere, udvalgte hold eller enkelte personer. Bygget og pushet i tre klodser. **Alt er live på main.**

### Datamodel
- **Master-programmer** bor i top-collection **`trainingPrograms`** (program-doc + `days`-subcollection), modsat forløbs-programmer under `forlob/{id}/mikrotraeningProgrammer`. Samme `TrainingProgram`/`TrainingDay`-typer og samme øvelsesbank (`exercises`).
- **Tildelinger** i `programTildelinger` fik nye felter: `programKilde: 'master' | 'forlob'` (udeladt = `forlob`, bagudkompat) og `modtagerType` udvidet til **`'kunde' | 'forlob' | 'alle-app'`**. `forlobId` er nu tom streng for master-tildelinger (stadig påkrævet `string`). Se `src/lib/content/tildelinger.ts`.
- **Fremgang genbruger et eksisterende spor:** `users/{uid}/programFremgang/{tildelt__master__<programId>}` (`gennemforteDage`). Afspilleren skrev det allerede via `tilfoejGennemfoersel(...'tildelt', programId, forlobId, dag)` — master isoleres via `forlobId='master'`. Pause-sporet (`spilPauser`) isoleres på samme måde.

### Klods 1 — byg (commit 0116f25)
- Admin-side **"Mine programmer"** (`app/admin/programmer`): liste + opret-dialog + oversigt + auto-generér + dag-for-dag editor. Genbruger forløbs-trænings-editoren 1:1.
- Nye helpers i `src/lib/firestore/mikrotraening.ts`: `hentAlleMasterProgrammer`, `hentMasterProgram`, `gemMasterProgram`, `gemMasterDag`, `gemMasterDage`, `sletMasterProgram`. (Erstattede de gamle ubrugte top-niveau-helpers `hentAlleProgrammer`/`hentProgram`/`gemDag`/`gemDage`.)
- Menu-indgang i `app/admin/+page.svelte` under "Delt indhold".

### Klods 2 — tildel (commit c0aa9f7)
- Tildel-side `app/admin/programmer/[programId]/tildel`: tre spor — **Alle app-brugere** (afkrydsning), **Hold/forløb** (flueben-liste, kryds de hold der skal have det), **Enkelte personer** (fuzzy-søgning via `klientSoegeMatch`). Gemmer med det samme, kan fjernes.
- Resolveren (`harProgramAdgang`/`tildelingerForKunde`) fik et `{ erAppBruger }`-opts (defaulter `false`). `alle-app` rammer kun app-brugere. `tildelProgram` deduper nu på kilde+forløb i hukommelsen og skriver aldrig `undefined`-felter.
- **Bevidst valg (afklaret med Linn):** "alle forløb" er IKKE en broadcast-knap — man krydser de enkelte hold af via flueben. "Alle app-brugere" = KUN premium.

### Klods 3 — levér + spil (commit d573368, kunde-følsom)
- Klient-træningsmodulet (`app/moduler/traening/+page.svelte`) leverer nu master-programmer i BEGGE grene under overskriften "Tildelte programmer": app-kunder med `erAppBruger:true` (får alle-app + direkte + hold), forløbskunder med `erAppBruger:false` (kun direkte + hold). Additivt, deduppet pr program-id, kun aktive. Forløbskundens EGNE programmer hentes først/kritisk; master-hentning er best-effort og kan aldrig skjule dem.
- **Afspilning:** master leveres via sentinel `forlobId='master'` gennem den eksisterende rute `program/[forlobId]/[programId]` (+ `/spil`). Al master-logik er bag en `forlobId === 'master'`-gren, så **forløbstræning er byte-for-byte uændret**.
- **Selvbetjent progression (Linns valg):** ingen forløbs-kalender. `aktuelDagNummer = min(antalDage, højeste gennemførte dag + 1)`. Dag N+1 låses op når dag N er gennemført.
- `hentTildelingerForBruger` fik `{ erAppBruger }`-opts videreført til resolveren.

### Beslutninger låst denne session
- `alle-app` = **kun premium** · levering er **additiv** (master lægges oveni, erstatter ikke forløbets) · hold via **flueben** (specifikke hold) · master-programmer lever **ved siden af** det eksisterende "byg inde i et forløb"-flow (det er urørt).
- **v1-afgrænsning (bevidst udskudt):** master-programmer sætter sig IKKE som forsidens "Aktiv"-genvej endnu. De er tilgængelige fra Træning-modulet (åbn + træn). At koble forsiden på ville kræve en `forlobId==='master'`-gren i `app/+page.svelte` (linje ~610 bruger `hentForlobsProgram`). Lav-prioritet efterfølger.

### Verifikation (alle klodser)
0 svelte-check-fejl, 666+ unit-tests grønne, produktions-build grøn, og integrationstests mod ægte Firestore (resolver-levering + fremgangs-round-trip + selvbetjent dag-formel, ryddet op). **Ingen `firestore.rules`-ændring nødvendig** — `trainingPrograms` + `days` + `programTildelinger` var allerede dækket (admin skriver, alle læser).

## 2. Programmet "Bo" (oprettet, IKKE tildelt)
Master-program `trainingPrograms/bo`, oprettet via engangs-script (slettet). **30 dage, ~5 min (dag 1) → ~15 min (dag 30)**, tilpasset en aktiv 50-årig mand. Fuld krop (ben/core/stabilitet + lidt overkrop), ren kropsvægt, niveau `let_oevet`, sæt 2→3, arbejdstid 30→38s, hvile 20s, selvbetjent, tilpassede intro-tekster pr dag. `aktiv=true`.
- **Ingen kunde påvirket:** Bo er IKKE tildelt nogen. Linn tildeler den selv til den rigtige testperson (via "Enkelte personer", IKKE "alle app-brugere").
- **Note:** dag 1 åbner med burpees (lidt intenst til en blød start) — kan byttes i editoren hvis ønsket.

## 3. Kapacitets-audit af hosting (read-only, denne session)
Ingen kapacitetsvæg i sigte. **Firebase Storage: 0,43 GB i alt** (exercises 134MB, forlob 12MB, audio 4MB — resten af lyd på R2, opskrift-billeder 285MB og voksende). **Firestore:** ~5.100 top-niveau-docs (småt); de rigtige kundedata ligger i subcollections pr bruger (maaltider op til 187/kunde osv) — dét er Firestore-regningens skaleringsakse. Cloudflare Pages: 58 builds/30 dage af 500, masser af luft. **De to ting at holde løst øje med: Vimeo-planen (hårdt leverandør-loft, uden for koden) og Firestore-regningen (vokser med aktive kunder × anciennitet).** De hurtigst voksende Storage-poster er opskrift-billeder (uploades ukomprimeret 4-5MB) — kan halveres med klient-komprimering hvis det nogensinde bliver dyrt.

---

## 4. Åbne tråde / TODO
- **⚠ Kropsro maj små skridt — uge 12 (dag 78-84) mangler stadig**, starter ~9/8. Skal planlægges + publiceres i admin (Forløb → Kropsro → Små skridt) inden da. (Videreført fra v32.)
- **Abo-udløbs-overvågning:** `fabersalle44@gmail.com` (17/7) og `connielauridsen@gmail.com` (20/7) — bekræft at de flipper til `udlobet`. Kør `scripts/tjek-abo-udloeb.ts <email>` lokalt de dage. (Videreført fra v32; 17/7 er i dag.)
- **2 legacy-programmer i `trainingPrograms`:** `mikrotraening_kettlebell` + `mikrotraening_no_kettlebell` (aktive, 21 dage) dukker op i "Mine programmer"-listen. De er IKKE lavet i denne session. UAFKLARET: om noget live stadig bruger dem (abo-mikrotræning bor i `aboMikrotraening`, ikke her — så de er sandsynligvis forældede duplikater). **Undersøg før de evt. slettes/skjules.**
- **Forside "Aktiv" for master-programmer** — bevidst udskudt v1-efterfølger (se §1).
- **iMac-opsætning** (Linn udskød): for at kode fra iMac mangler kun 3 gitignored filer kopieret over (`.env`, `scripts/service-account-key.json`, `scripts/vanetracker-key.json`) + install af Node/Claude Code/VS Code + git-token (osxkeychain, nemmest `gh auth login`) + Claude-login. Tilbud om at lave `.env.example` står åbent. Samme brugernavn (`linnabildtrup`) + projektsti (`~/Projekter/linns-academy-app`) → lokale scripts virker uden ændringer.
- **Feature-adgang 3D** (fra memory `project_feature_adgang_plan`): ryd premium-hacket på Kickstart. Lav-prioritet, harmløst.

## 5. Fil-reference (denne session)
**Master-programmer, klods 1:** `lib/firestore/mikrotraening.ts` (master-helpers) · `app/admin/programmer/{+page, [programId]/+page, [programId]/[dag]/+page}.svelte` · `app/admin/+page.svelte` (menu).
**Klods 2:** `lib/content/tildelinger.ts` (+`.test`) · `lib/firestore/tildelinger.ts` · `app/admin/programmer/[programId]/tildel/+page.svelte`.
**Klods 3:** `lib/firestore/tildelinger.ts` (`hentTildelingerForBruger` opts) · `app/moduler/traening/+page.svelte` · `app/moduler/traening/program/[forlobId]/[programId]/{+page, spil/+page}.svelte`.
**Data:** `trainingPrograms/bo` oprettet (engangs-script, slettet).

**Commit-kæde (denne session, nyeste sidst):** 0116f25 (klods 1) · c0aa9f7 (klods 2) · d573368 (klods 3). Alle pushet til `main`.
