# Handover til næste chat — v29

**Dato:** 12. juni 2026
**Session-tema:** Feature-skema gjort ægte · Nul-dage til Kickstart · App-vaner forenklet · **MRS-dashboard bygget fra bunden** · Off-by-one-bug i mikrotræning rettet.

Denne handover er selvstændig — en frisk terminal/session kan læse den og være produktiv. (Memory-filerne loades også automatisk; v27 dækker den separate "Linns Academy 2.0"-rearkitektur, som stadig IKKE er implementeret.)

---

## 0. Arbejdsgang — læs FØRST (vigtigt i en frisk terminal)

- **Stack:** SvelteKit (Svelte 5 runes: `$state`, `$derived`, `$effect`, `{#snippet}`/`{@render}`), Firestore, Cloudflare Pages (auto-deployer fra `main`), Firebase Auth + Storage. Alt UI/kommentarer er på **dansk**.
- **Før commit, kør altid:** `npx svelte-check --tsconfig ./tsconfig.json` (skal være 0 errors/warnings), `npm test`, `npx prettier --write <filer>`.
- **Deployment:** push til `main` → Cloudflare bygger og deployer automatisk. MEN **`firestore.rules` og `storage.rules` deployes MANUELT** ved at copy-paste til Firebase Console (to separate faner: Firestore Rules vs Storage Rules). Filerne i git matcher det deployede, men git-push deployer dem IKKE.
- **Data-scripts:** read-only/skrive-verifikation kører via `firebase-admin` + `scripts/service-account-key.json` (lokal, IKKE i git/sky — indeholder admin-nøgle). Mønster: skriv et midlertidigt `scripts/_navn.ts`, kør `npx tsx scripts/_navn.ts`, slet det bagefter. `scripts/generer-mrs-stats.ts` er et PERMANENT script (dashboard-data).
- **~600-700 kunder i drift.** Verificér ALTID risikable ændringer mod live-data FØR kodning. Vælg den mindst risikable løsning.
- **Testkonti at ekskludere fra live-tal:** alle `@linnsacademy.dk`-emails, `linnsacademy@gmail.com`, `premium_app@linnsacademy.dk`, `kickstart@linnsacademy.dk`, og **Bente** = `kickstart-01-06-2026@linnsacademy.dk`.
- **Linns arbejdsstil:** forklar enkelt/ikke-teknisk; lav aldrig mere end aftalt; kod ALDRIG før hun siger "ja"/"kod"; list ændringer + verificér mod live før hver commit; én ting ad gangen; separate commits. Commit-besked slutter med `Co-Authored-By: Claude Opus 4.8 (1M context)`.

---

## 1. Feature-skema er nu ÆGTE (Etape 3C færdig)

`harFeatureAdgang(userDoc, matrix, feature)` i `src/lib/content/features.ts` er **DEN ENESTE** funktion der afgør feature-adgang (skema pr kundetype + tester-override via `testerFeatures`). De 6 funktioner i skemaet er alle koblede nu:

| Funktion | Status | Hvor |
|---|---|---|
| Linn AI | koblet (tidl.) | moduler/linn-ai + api/linn-ai |
| Udvidet næring | koblet | profil/udvikling/30-30-3 |
| Byg eget program | koblet | traening + custom-builder-tildeling RYDDET |
| AI-opskrift | koblet | min-opskrift + api/analyser-opskrift |
| AI-madplan | koblet | 30-30-3 + api/foreslaa-madplan (test-flag `foreslaa-madplan`→`ai-madplan`) |
| Nul-dage | koblet (tidl.) | profil-siden |

**Udvidet vanetracker blev FJERNET (ikke koblet):** premium-7-vaner-tier var ubrugt (0/123 app-kunder havde valgt >3), så alle app-kunder får nu 3 vaner. `produktType` låst til 'basis' i vane-flowet.

### ⚠️ STØRSTE FÆLDE: verificér mod det GEMTE skema, ikke kodens STANDARD
Linn HAR gemt et custom skema i Firestore (`featureAdgang/aktiv`) — det **overstyrer** `STANDARD_MATRIX` i koden. Da AI-opskrift blev koblet, var den slukket i det gemte skema, så forløbskunder mistede kortvarigt adgang. **Tjek altid `featureAdgang/aktiv` (live), ikke STANDARD_MATRIX, når du kobler/verificerer features.** Pr 12/6 har Linn bevidst tændt **Linn AI + nul-dage for Kropsro** (alle Kropsro-kunder har dem).

---

## 2. Nul-dage åbnet for Kickstart
Var hårdlåst til Kropsro. Nu vises nul-dage for ENHVER forløbskunde med adgang (skema/tester). Pulje er forløbs-afhængig: `maxNulDageForForlob(forlobId)` = `kropsro_`→21, ellers (Kickstart)→14. Dag-beregningen var allerede forløbs-uafhængig.

---

## 3. MRS-dashboard (`/app/admin/dashboard`) — bygget fra bunden

KPI-dashboard, link øverst i admin-menuen. **Snapshot-arkitektur:** `scripts/generer-mrs-stats.ts` (firebase-admin) beregner alle KPI'er og gemmer ÉT dokument i `adminStats/mrs`. Dashboard-siden læser kun det → lynhurtigt. **Linn kører scriptet manuelt** for friske tal (`npx tsx scripts/generer-mrs-stats.ts`); siden viser "sidst opdateret". Firestore-regel: `adminStats/{docId}` allow read if isAdmin, write if false (deployet manuelt).

**MRS** = Menopause Rating Scale, total 0-44, **LAVERE = bedre**. Data: `users/{uid}/mrs_scores/{id}` med `total`, `subscales{somatisk,psykologisk,urogenital}`, `sliders{energi,mave,cravings,humor,sovn}` (1-10, HØJERE=bedre), `measurePoint`, `timestamp`, `kunSliders`.

Dashboardet indeholder: 2 faner (Alle / Vælg forløb), MRS-rejse-graf + velvære-rejse-graf (begge med hold-vælger: Alle / Alle Kickstart / Kropsro alle / enkelte hold), baseline-sværgrad, demografi (menopause + alder), forbedrings-fordeling, subskalaer, velvære-tabel.

**Vigtige databehaviors (fundet undervejs):**
- **measurePoint er inkonsistent** — baseline bestemmes som kundens FØRSTE rigtige måling (timestamp-sorteret, `kunSliders` springes over), IKKE etiketten.
- **Hold bruger MRS forskelligt:** Kickstart maj lavede KUN det ugentlige velvære-slider-check (kun 3 af 322 har 2+ fulde MRS, men 177+ har velvære). Juni laver fulde MRS løbende. Derfor medtages kunder med ENTEN MRS ELLER sliders.
- **Pr-forløb-tilskrivning:** hver måling tilskrives det forløb der var senest startet på måletidspunktet (3 dages buffer). En kickstart→kropsro-kundes data blandes aldrig.

Detaljer i memory `project_admin_dashboard.md`.

---

## 4. Off-by-one-bug i mikrotræning (rettet 12/6)

**Symptom Linn fandt:** mikrotræning-vanen i "Dagens små skridt" stod forudfyldt JA, selvom træning-thumbnailen (højere oppe) korrekt viste intet flueben.

**Rod-årsag:** Spil-/program-siden beregnede `aktuelDagNummer = (idx % antalDage) + 1` (forkert +1, gammel kommentar antog `getCurrentDay` giver 0 på dag 1 — den giver 1). Forsiden + vaneprogram bruger forløbsdagen UDEN +1, og tildelte programmer (`forlob/{id}/mikrotraeningProgrammer/{pid}/days`) er 1-indekserede og ALIGNED (forløbsdag N = program-dag N). → gennemførsler gemt på dag+1; gårsdagens gennemførsel matchede i-dags dag → vanen blev auto-ja'et forkert. **107 rigtige kunder ramt.**

**Løsning (3 commits):**
1. `ca12ce6` — rettet dag-nummeret til `idx <= 0 ? 1 : ((idx-1) % antalDage) + 1` (program- + spil-siden). Fremadrettet korrekt.
2. `63fbe1f` — auto-ja brugte samme dato-tjek som thumbnailen.
3. `7c9cf14` — **auto-udfyldningen FJERNET helt.** Kunden krydser nu selv mikrotræning af, som de øvrige vaner. Ingen kobling mellem træning og vane-svar = problemet kan ikke opstå.

**Linn valgte INGEN data-oprydning** af de historiske forkerte `gennemforteDage` — kun fremadrettet. De 99 "andet mønster"-tilfælde (kunder der trænede efter forløb, dubletter) er heller ikke rørt.

---

## 5. Åbne tråde (til næste session)

1. **3D — premium-hack-oprydning. UDSKUDT til efter 23/6 2026.** 279 juni-Kickstart-kunder har `accessLevel='premium'` (overflødigt levn; 176 Kickstart kører allerede på 'basis'). Juni-forløbet slutter 21/6, adgang udløber 22-23/6. Plan: (1) verificér ingen aktiv ramt, (2) sæt resterende premium-Kickstart→basis, (3) ret `app-hjaelp/+page.svelte` så `erPremium`→`harFeatureAdgang('linn-ai')`. RØR IKKE app-kunders abo-mikrotræning basis/premium-program. Se memory `project_feature_adgang_plan.md`.
2. **MRS-dashboard — tabel vs rapport.** Velvære-grafen matcher Linns eksterne statistik-rapport (`Baselineudvikling.docx`), men velvære-TABELLEN viser lavere forbedring fordi den bruger "baseline→hver kundes sidste måling" (blander dem der stoppede tidligt), mens rapporten matcher "baseline→uge 3" for kun de gennemførende. Linn overvejede at gøre tabellen uge-for-uge + tilføje %-forbedret (som rapporten). **Ikke besluttet/bygget.**
3. **Flere dashboard-temaer** (snapshot-mønstret kan genbruges): Engagement (aktive 7/30-dage via maaltider+vanedage+traeningHistorik; inaktiv-liste), Retention (udløber-snart via expiresAt, forløb→abo-konvertering), Produkt (Linn AI-brug+ratings, ubesvarede klientspoergsmaal). Datakilder kortlagt.
4. **Forløb-webhook:** automatisér forløbskøb via Simplero (i dag manuelt). Ikke kodet.
5. **Linns Academy 2.0** (v27): planlagt rearkitektur til 2 kunde-typer. Ikke implementeret.

---

## 6. Vigtige Firestore-stier

| Hvad | Sti |
|---|---|
| Bruger | `users/{uid}` (felter: accessSource, accessLevel, forlobIds, testerFeatures, brugerProfil{alder,menopaus,vaegt,hojde}, expiresAt) |
| MRS | `users/{uid}/mrs_scores/{id}` |
| Feature-skema (live) | `featureAdgang/aktiv` |
| Dashboard-snapshot | `adminStats/mrs` |
| Forløbs-vaner | `users/{uid}/products/{pid}/vanedage/{dagId}` (pid har `forlobId`-felt; note=refleksionssvar) |
| Abo-vaner | `users/{uid}/aboVanedage/{YYYY-MM-DD}` |
| Vaneprogram (spørgsmål) | `forlob/{id}/vaneprogram/{dag}` (0-indekseret, `reflection`-felt) |
| Træningsprogram | `forlob/{id}/mikrotraeningProgrammer/{pid}/days/{n}` (1-INDEKSERET) |
| Program-fremgang | `users/{uid}/programFremgang/{...}` (gennemforte=timestamps, gennemforteDage) |
| Måltider | `users/{uid}/maaltider/{id}` |
| Klient-spørgsmål | `klientspoergsmaal/{id}` |

**Dato-konvention:** `forlob.startDato` = baseline (Dag 0). Dag N = startDato + N. `getCurrentDay`/`getCurrentDayMedNulDage` er 0-indekseret. Se memory `project_forlob_dato_konvention.md` (inkl. off-by-one-fælden).

---

## 7. Referencer
- **Memory** (loades automatisk i ny session): `project_feature_adgang_plan`, `project_admin_dashboard`, `project_forlob_dato_konvention`, `project_vaner_system`, `project_kunde_typologi`, `feedback_*`.
- **v27** — Linns Academy 2.0-rearkitektur (ikke implementeret).
- **Denne sessions commits:** `6147ead` → `7c9cf14` (se `git log`).
- Lokal kunde-data (PII, IKKE i git): `vanetracker.csv`, `Baselineudvikling.docx`, `scripts/*-key.json` — Linn rydder dem selv.
