# Handover til næste chat — v32

**Dato:** 15. juli 2026
**Session-tema:** **Måltids-fokus pr forløb** (admin begrænser mad-modulet til bestemte måltider i en periode) · **Gratis app-kunder: udløbsdato + "Ret udløb" pr abonnent (admin)** · **Symptomcheck: én kilde til påmindelse + ingen fri udfyldelse** · **Ikke-forstyrrende app-opdatering** (video-lektion afbrydes ikke længere af reload) · **Terminologi "Vaner" → "Små skridt" i al synlig tekst** · diverse data-rettelser.

Denne handover er selvstændig. Memory-filerne loades også automatisk (se især `project_maaltids_fokus`, `project_abo_datoer`, `project_symptomcheck_kadence`, `project_feature_adgang_plan`, `feedback_diagnose_foerst`). Tidligere: v31 (abo-datoer + dato-styret abo↔forløb-model), v30 (udvikling-dashboard 4 faner), v27 (Linns Academy 2.0, IKKE implementeret).

> ## ⚠ VIGTIGSTE REGEL: DIAGNOSE FØRST — KOD ALDRIG UDEN GO
> Lav ALTID en grundig diagnose før du skriver eller ændrer kode: forstå årsagen, læs den relevante kode, og verificér mod live-data (tør audit / dry-run) hvor der er kunde-påvirkning. Præsentér fundene + løsningsforslag, og **vent på et klart "ja/kør/ret det"** fra Bo/Linn før du koder — også på "er det muligt?"-spørgsmål (svar først, kod ikke). Læse-only undersøgelse (læse filer, dumpe Firestore via midlertidige scripts der ryddes op) er en del af diagnosen og er OK. ~760 kunder i drift, så forkerte/forhastede ændringer er dyre. (Se memory `feedback_diagnose_foerst`.)

---

## 0. Arbejdsgang — læs FØRST
Uændret fra v31 (læs den for fuld projektstruktur §0b). Kort:
- **Stack:** SvelteKit (Svelte 5 runes), Firestore, Cloudflare Pages (auto-deployer fra `main`), Firebase Auth + Storage. Alt UI/kommentarer på **dansk** (ingen em-dash/semikolon i tekst til Linn).
- **Før commit:** `npx svelte-check --threshold error` (0 errors) + `npm test` ved logik-ændringer.
- **Deployment:** push til `main` → Cloudflare bygger automatisk (~2 min). `firestore.rules`/`storage.rules` deployes MANUELT via Console.
- **Data-scripts:** `firebase-admin` + `scripts/service-account-key.json` (lokal, IKKE i git). Skriv midlertidigt `scripts/_navn.ts`, kør `npx tsx`, **slet bagefter**. Dry-run før apply ved kunde-data.
- **~760 kunder i drift.** Verificér ALTID risikable ændringer mod live FØR kodning. Testkonti ekskluderes fra live-tal: alle `@linnsacademy.dk`, `bo_andersen1@…`.
- **Deploy-version:** `https://linns-academy-app.pages.dev/_app/version.json` (tidsstempel i UTC).

---

## 1. Måltids-fokus pr forløb (STØRSTE feature)
Admin kan pr forløb begrænse mad-modulet til bestemte måltidstyper i en periode (fx dag 0–6 = kun morgenmad), så kunden i starten kun har fokus på ét måltid.

- **Datamodel:** `forlob/{id}.maaltidsFokus: {fraDag, tilDag, maaltider[]}[]` (forløbs-DAGE, ikke datoer → gælder alle hold uanset startdato). Ren logik i **`src/lib/content/maaltidsFokus.ts`**: `tilladteMaaltiderForDag(perioder, dag)` → liste eller **null** (= ingen begrænsning). `validerPerioder` afviser overlap. 9 tests. Måltidstyper fra `kost.ts`: morgenmad/frokost/aftensmad/snack.
- **Admin:** ny sektion nederst på **"Funktioner og adgang"** (`admin/feature-adgang`): forløbs-dropdown + periode-editor (fra/til dag med dato, måltids-afkrydsning, tilføj/fjern), gemmer via `gemForlob`. Bevidst valg: styres pr-forløb, men bor på den ellers pr-kundetype-baserede side. (commit 7d6c6f5)
- **Håndhævelse (klient):** 30-30-3-modulet (`moduler/30-30-3`) + biblioteks-opskrifter. Beregnes via `hentAktivtForlob(forlobIds)` + `dageSidenStart` + `tilladteMaaltiderForDag`. Hård skjul: kun tilladte måltidstyper i byg/gem/kopier, opskrifter filtreres til tilladte kategorier (kategori-filter skjult), madplan skjult, banner vist. **Dagbog + makro-mål er URØRT** (selv-restringerer via logning; historik bevares). Fibre-mål forblev DAGLIGT (30g), kun det tilladte måltid bidrager (Linns valg). (commit 2ebe5ea)
- **SIKKERHED:** intet `maaltidsFokus` → `tilladteMaaltider=null` → alt uændret. Blast-radius = kun kunder på et forløb med aktiv periode. Fejl i beregning → fald tilbage til ingen begrænsning.
- Se memory `project_maaltids_fokus`.

## 2. Gratis app-kunder: udløbsdato + "Ret udløb" (admin)
På **Admin → Abonnenter**. Alt via `aboSlutterAt` — feltet den dato-styrede model håndhæver (IKKE `expiresAt`, se §5).
- **Opret gratis app-kunde** (`api/admin/opret-app-kunde`): nyt valgfrit **"Udløber"-datofelt**. Tom = løbende comp; dato = tidsbegrænset der udløber automatisk. Sætter nu også `aboProdukt`/`aboAccessLevel` så resolveren håndhæver udløbet.
- **"Ret udløb" pr abonnent** (`api/admin/ret-abo-udloeb`, nyt endpoint): knap på kundens detalje → sæt/ret dato ELLER fjern udløb (gør løbende). "Udløber"-visningen viser nu `aboSlutterAt` (ikke forældet `expiresAt`). Skriver til allowedEmails + userDoc, logger `aboUdloebSatAf`/`aboUdloebSatAt`. Advarsel ved betalende Simplero-kunder (fornyelse kan overskrive). (commit 4b7a70e)
- **VIGTIG LÆRING:** et tidsbegrænset gratis-abo SKAL have `aboSlutterAt` sat — ikke `expiresAt`. Den nye resolver læser "intet aboSlutterAt" som EVIGT comp. (Kristine blev oprettet før modellen med kun `expiresAt` + `activeSubscription=false`; da resolveren vippede `activeSubscription=true`, holdt udløbet ikke. Rettet manuelt 4/7: `aboSlutterAt=22/9` sat på hende. Se §7.)

## 3. Symptomcheck: én kilde til påmindelse + ingen fri udfyldelse
Kadencen (`skalUdfyldeNu` i `mrs.ts`) er nu ENESTE sandhed for hvornår symptomcheck skal laves. Rytme uændret: **Kickstart = ugentlig (søndag), Kropsro/øvrige/app = hver 4. søndag**, første gang = straks (baseline). Klassificering via det AKTIVE forløb (`forlobErKickstart(aktivtForlob?.id)`).
- **Fjernet** vane-dagens (`moduler/vaner/[dag]`) symptomcheck-notits — den viste "Tid til symptomtjek" på vaneprogram-check-in-dage uanset kadencen (konkurrerende kilde). Forsidens kadence-styrede kort (`{#if skalUdfyldeMrs}`) er nu eneste påmindelse.
- **Fjernet "Udfyld igen"-knappen** på symptomcheck-resultatsiden — kunden kunne ellers gen-udfylde frit. Nu kun via den gatede "Tag symptomcheck nu"-knap (vises kun når forfaldent). (commit ee0beda)

## 4. Ikke-forstyrrende app-opdatering
Kunder oplevede at en ny video-lektion "lukkede appen ned og genstartede" — det var appens auto-opdatering (`controllerchange` → `location.reload()` i `src/routes/+layout.svelte`) der reloadede MIDT i brugen når en ny SW tog over efter et deploy.
- **Nu:** `controllerchange` sætter kun et flag `opdateringVenter`. En `beforeNavigate`-handler anvender opdateringen ved NÆSTE navigation via fuld indlæsning af destinationen (SvelteKits anbefalede mønster). Så video/udfyldelse afbrydes aldrig. `vite:preloadError`-sikkerhedsnettet + de periodiske update-tjek (focus + 15 min) er uændret. (commit bc0f307)
- Effekten mærkes fuldt fra næste deploy EFTER bc0f307 (kunder på ældre version kan stadig få det gamle reload én sidste gang).

## 5. Terminologi "Vaner" → "Små skridt"
Al kunde- OG admin-synlig tekst siger nu **"Små skridt"** (stort S, lille s — matcher forsidens eksisterende "Dagens små skridt"). 14 filer, 77 strenge, KUN tekst.
- Modul-flise, Små skridt-modulet (+ opsaetning/[dag]/abo), forside-CTA, udvikling, app-hjælp; admin-menu, abo-siden, forløb-siden.
- **`appHjaelp.ts` (også AI-videnbasen)** opdateret så AI-app-hjælpens svar bruger "små skridt".
- **Bevidst URØRT:** kode/ruter/felter (`/moduler/vaner`, collections `vanedage`/`admintildelteVaner`, typer `VaneProgramDag`, variabler `egneVaner`/`maxVaner`), konsol-warns, enkelte kode-kommentarer, én test-beskrivelse. (commit dfce60e)

## 6. Baggrund: den dato-styrede adgangsmodel (fra v31, stadig gældende)
`src/lib/content/adgangResolver.ts` + login-sync i `src/lib/userDoc.ts` er autoritativ: aktivt forløb → forløbskunde; ellers gyldig abo (`aboSlutterAt > nu`, eller comp uden dato) → app-kunde; ellers udløbet. `effektivState` (`utils/userAdgang.ts`) håndhæver `aboSlutterAt`-udløb. Fibre/data-detaljer se v31.

---

## 7. Data-rettelser i denne session (ingen commit — engangs-scripts)
- **Kristine (kristine@bjerrum-scharling.dk):** gratis premium-app 3 mdr. Sat `aboSlutterAt=22/9/2026` (4/7) så udløbet håndhæves korrekt af den nye model.
- **Fejlplacerede refleksions-noter (sidste-dags off-by-one, nu fixet i kode):** lisbethrye + bm@soeberg + steenlone.elkaer fik deres Kickstart juni dag-noter flyttet fra `kickstart`- til `premiumforløb`-skuffen. **UAFKLARET (bevidst efterladt):** heidigabrielleh (6 noter) + jettevibe (1) — de er legitime Kickstart maj-noter i korrekt skuffe, IKKE fejlplaceret (deres `kickstart`-produkt peger forvirrende på forlobId=kropsro_maj).
- **Kropsro maj små skridt uge 7:** planer fandtes men var ikke publiceret ud på dagene (dag 43+ havde 0 checks). Linn kørte publiceringen 9/7 → uge 7 fyldt. Se §8.

## 8. Åbne tråde / TODO
- **⚠ HASTER — Kropsro maj små skridt uge 8–12:** der findes SLET INGEN små skridt-planer for uge 8–12 (planerne dækker kun uge 1–7). Kropsro maj krydsede i uge 8 på **dag 50 = 13/7** → "Dagens små skridt" står tom igen fra 13/7 (dvs NU). Linn skal planlægge + publicere små skridt for uge 8–12 i admin (Forløb → Kropsro → Små skridt). **Tjek også SommerRo + andre aktive forløb for samme "tomme uger"-hul.**
- **Abo-udløbs-overvågning:** bekræft at `fabersalle44@gmail.com` (17/7) og `connielauridsen@gmail.com` (20/7) flipper til `udlobet`. Kør `scripts/tjek-abo-udloeb.ts <email>` lokalt de dage — kan IKKE cloud-schedules (service-account-key kun lokal).
- **Feature-adgang 3D (fra memory `project_feature_adgang_plan`):** ryd premium-hacket på Kickstart. Diagnose (4/7): 230 Kickstart-kunder har accessLevel=premium; 216 er udløbet (flag harmløst), 14 er aktive men på **SommerRo** (legitimt premium via `adgangsNiveau=premium`, resolver-styret — RØR IKKE). Kode-rest: `app-hjaelp/+page.svelte` bruger stadig `harPremium` (→ `harFeatureAdgang('linn-ai')`). Lav-prioritet, harmløst nu.
- **Valgfri oprydning:** fjern det døde `adgangFra`-felt (afløst af resolveren i v31).
- **UI-detalje (lav):** "Dagens små skridt"-sektionen på forsiden viser sin header selv når listen er tom (fx Kropsro uge 8 nu). Kunne skjules når tom — men det ægte fix er at publicere små skridt.

## 9. Fil-reference (denne session)
- `src/lib/content/maaltidsFokus.ts` (+.test) — måltids-fokus logik
- `src/routes/app/admin/feature-adgang/+page.svelte` — måltids-fokus admin-sektion
- `src/routes/app/moduler/30-30-3/+page.svelte` + `moduler/bibliotek/+page.svelte` — måltids-fokus håndhævelse
- `src/lib/content/forlobAdgang.ts` — `maaltidsFokus`-felt på Forlob
- `src/routes/api/admin/opret-app-kunde/+server.ts` + `api/admin/ret-abo-udloeb/+server.ts` + `admin/abonnenter/+page.svelte` — udløbsdato + ret udløb
- `src/routes/app/moduler/symptomcheck/+page.svelte` + `moduler/vaner/[dag]/+page.svelte` — symptomcheck én-kilde
- `src/routes/+layout.svelte` — ikke-forstyrrende opdatering
- Terminologi (14 filer): `content/{moduler,appHjaelp,features,produkter}.ts`, `app/+page`, `admin/{+page,abo-vaner,forlob/[id]}`, `app-hjaelp`, `udvikling`, `moduler/vaner/{+page,opsaetning,[dag],abo/[dato]}`

**Commit-kæde (denne session, nyeste sidst):** 4b7a70e · 7d6c6f5 · 2ebe5ea · ee0beda · bc0f307 · dfce60e
