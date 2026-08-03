# Handover til næste chat — v34

**Dato:** 3. august 2026
**Session-tema:** **Strategisk sparring om Linns Academy 3.0.** Beslutning om at bygge en ny kundeflade i den eksisterende kodebase med kunden i centrum i stedet for forløbet. Specifikationen er skrevet som `SPEC-3.0.md`. **Ingen kode skrevet i denne session.**

Denne handover er bevidst kort. Det substantielle indhold står i `SPEC-3.0.md`, og den er kilden til sandhed. Gentag den ikke her, så de to ikke driver fra hinanden. Memory-filerne loades også automatisk (se især `project_academy_3_0`, `feedback_diagnose_foerst`, `feedback_fokuseret_scope`, `feedback_kunde_paavirkning`). Tidligere: v33 (master-programmer), v32 (måltids-fokus), v31 (dato-styret adgangsmodel).

---

> ## ⚠ VIGTIGSTE REGEL: DIAGNOSE FØRST — KOD ALDRIG UDEN GO
> Uændret fra v33. Lav ALTID en grundig diagnose før du skriver eller ændrer kode. Præsentér fundene og løsningsforslag, og vent på et klart "ja/kør/ret det" fra Bo eller Linn. Cirka 760 kunder i drift.

> ## ⚠ NY REGEL FRA DENNE SESSION: DEN EKSISTERENDE APP RØRES IKKE
> Linn, 3. august 2026: **der må under ingen omstændigheder kodes eller laves om i den eksisterende app.** Det gælder hele kundefladen under `src/routes/app/` og de delte moduler, den bruger, herunder `adgangResolver.ts`, `features.ts`, `userDoc.ts` og Simplero-webhooken. Alt nyt til 3.0 er **additivt**: nye filer, nye funktioner, nyt rodtræ. Heller ikke "bare en linje" i det gamle layout.
>
> **Tjek `git diff` før hver commit.** Rører ændringen noget uden for det nye rodtræ, er den forkert.

---

## 1. Hvad der blev besluttet

Kort version. Den fulde begrundelse og alle detaljer står i `SPEC-3.0.md`.

| | |
|---|---|
| Platform | Web-app. Ikke App Store |
| Byggemåde | Ny kundeflade i SAMME kodebase, nyt rodtræ. Ikke nyt projekt, ikke ombygning |
| Datamodel | Kunden i centrum. Abonnement og forløb bliver rækker med fra/til. Intet overskrives |
| Forløb | En tilmelding der lægger lektioner og kalender ovenpå appen. Ikke en beholder for kundens data |
| App-niveauer | Ét. **Der findes ikke premium i 3.0** |
| Funktioner | App-funktioner er tændt for alle. Forløbs-mekanikker følger tilmeldingen |
| Udrulning | Både pr person og pr hold, via `harTestAdgang(userDoc, 'ny-app')` |
| Første hold | Kickstart. Startdato ikke fastlagt |
| Datamigrering | Ingen. Baglæns-kompatible læsere i stedet |

---

## 2. Hvorfor kunde-først, kort

Den nuværende model kan kun rumme, at kunden er én ting ad gangen. Beviset står i jeres egen kommentar til `aboProdukt` i `src/lib/types.ts`:

> *"Bevares så vi kan skifte tilbage til app efter et forløb. `activeProduct` overskrives af forløbet undervejs."*

Og i `src/lib/content/adgangResolver.ts:49`:

```ts
// 1) Aktivt forløb vinder. Ved overlap: det med senest slut (mest adgang).
```

Derfor findes skyggefelterne `aboProdukt` og `aboAccessLevel`, og derfor bliver app-køb under et aktivt forløb udskudt til dagen efter forløbets slut. I 3.0 vinder forløbet ikke, det lægger sig ovenpå, og hacket bliver overflødigt.

Samme mønster ses i `kundetypeFor` i `features.ts`, hvor kundens type gættes ud fra om forløbs-id'et starter med `kropsro_`, og hvor app-kunden er defineret som `alleFeatures(false)`, altså fraværet af alt. Det er omvendt af den forretning, appen skal bære.

---

## 3. Status på filer

| Fil | Status |
|---|---|
| `SPEC-3.0.md` | **NY.** Fuld specifikation. Kilden til sandhed for 3.0 |
| `handover-til-naeste-chat-v34.md` | **NY.** Dette dokument |
| Alt andet i repoet | **Uændret.** Ingen kode rørt i denne session |

Memory opdateret: `project_academy_3_0` oprettet, `project_linns_academy_2_0` markeret FORÆLDET, `MEMORY.md` opdateret.

**2.0-planen i `handover-til-naeste-chat-v27.md` er annulleret.** Byg ikke videre på den.

---

## 4. Målinger fra kodebasen, brugt som grundlag

Til den næste, der skal vurdere omfang:

- Cirka 101.000 linjer i `src` (72.600 Svelte, 28.600 TS)
- 73 sider, heraf **37 admin**. Over halvdelen af appen er Linns eget værktøj og skal ikke bygges om
- 32 kunde-vendte sider, 36.900 linjer. `app/+page.svelte` alene er 3.910 linjer og rummer tre layouts
- 19 API-endpoints, 25 firestore-moduler, 666+ tests, 319 scripts
- Cirka 4.500 linjer findes i **to udgaver** (`vaner/[dag]` mod `vaner/abo/[dato]`, `mikrotraening/[dag]` mod `mikrotraening/abo/[dato]`) alene fordi kunden er delt i to typer. De kollapser i 3.0

**Konklusion:** det reelt nye er rygraden. Modulerne er allerede bygget mod det fælles lag og skal kobles på en ny skal, ikke skrives forfra.

---

## 5. Næste skridt

1. **Linn læser `SPEC-3.0.md` igennem.** Særligt afsnit 1 (låste beslutninger), 8 (ude af scope) og 9 (det der ikke genskabes)
2. Når den er godkendt: **etape 1** i afsnit 7. Datamodellen og udledningen i et nyt modul `src/lib/content/adgang3.ts`, med tests, uden en eneste skærm og uden at røre en eksisterende fil
3. Derefter etape 2, skallen med egen indgang, flag, layout og den ene forside

**Kod ikke etape 1 uden et klart go fra Linn.**

---

## 6. Udestående spørgsmål

- Startdato for det første Kickstart-hold i 3.0
- Hvad en app-kunde uden forløb møder på forsiden. Afklares når forsiden bygges i etape 2
- Om reglen i afsnit 0 også gælder admin fuldt ud. Specifikationen antager, at admin-tilføjelser lægges som nye sider eller scripts, ikke som ændringer i eksisterende admin-sider

---

## 7. Arbejdsgang

Uændret fra v33.

- **Stack:** SvelteKit (Svelte 5 runes), Firestore, Cloudflare Pages (auto-deployer fra `main`), Firebase Auth + Storage, Cloudflare R2 (lyd). Alt UI og alle kommentarer på **dansk** (ingen tankestreg eller semikolon i tekst til Linn)
- **Før commit:** `npx svelte-check --threshold error` (0 errors) og `npm test` ved logik-ændringer. Ved kunde-følsomt: også `npm run build` og integrationstest mod live via engangs-script
- **Deployment:** push til `main` giver automatisk Cloudflare-build (~2 min). Commit og push KUN når Linn beder om det. `firestore.rules` og `storage.rules` deployes MANUELT via Console
- **Data-scripts:** `firebase-admin` og `scripts/service-account-key.json` (lokal, IKKE i git). Skriv midlertidigt `scripts/_navn.ts`, kør `npx tsx`, **slet bagefter**. Dry-run og read-only før apply ved kundedata
- **Deploy-version:** `https://linns-academy-app.pages.dev/_app/version.json`
