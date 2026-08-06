# Overdragelse: Linns Academy 3.0

Sidst opdateret 6. august 2026.

Denne fil er til den næste der skal arbejde videre, uanset om det er et nyt Claude-vindue, Bo eller en udvikler udefra. Den fortæller hvor vi er, hvordan tingene hænger sammen, og hvor fælderne ligger.

Læs den sammen med disse tre:

- `CLAUDE.md` i repo-roden er arbejdsreglerne. De er ikke til forhandling.
- `SPEC-3.0.md` er hvad der bygges og hvorfor. 21 afsnit, hvor 13 til 21 er designbeslutningerne fra 5. august.
- `v3 app/linns-academy-design/DESIGN-SPEC.md` og `mockups.html` er hvordan det ser ud.

---

## 1. Hvad 3.0 er, på fem linjer

Den nuværende app ligger på `/app` og har omkring 760 kunder i drift. Den er bygget om forløbet, med tre forskellige forsider afhængigt af kundetype.

3.0 er en ny kundeflade på `/ny` i den samme kodebase. Den er bygget om kunden, ikke om forløbet. Der er én forside for alle. Har kunden et aktivt forløb, lægger forløbs-laget sig ovenpå. Har hun ikke, er blokken der bare ikke.

Den gamle app skal blive stående uændret, indtil 3.0 kan afløse den. Første hold der flyttes over bliver et Kickstart-hold.

---

## 2. Den vigtigste regel

**Ingen eksisterende fil må ændres.** Der er kunder i drift.

Konkret betyder det at `src/routes/app/`, `adgangResolver.ts`, `features.ts`, `userDoc.ts` og Simplero-webhooken kun må læses og importeres, aldrig rettes. Alt nyt er nye filer.

`git diff` køres før hver commit. Står der en eksisterende fil i diffen, er ændringen forkert og skal rulles tilbage. Der findes en ventil hvis noget i den gamle app rammer kunder akut, men så er det en helt separat opgave med sit eget go og sin egen commit.

Nye filer behøver ikke ligge under `src/routes/ny/`. Datamodellen ligger for eksempel i `src/lib/content/adgang3.ts`. Det afgørende er ikke hvor filen ligger, men at ingen eksisterende fil bliver rørt.

---

## 3. Sådan er det bygget

### 3.1 Teknik

SvelteKit med Svelte 5 runes, altså `$state`, `$derived`, `$derived.by`, `$effect` og `$props`. Firebase står for Firestore, Auth og Storage. Hosting er Cloudflare Pages, og push til `main` deployer automatisk til kunderne.

To ting der har kostet tid før, og som skal huskes:

- **`firebase-admin` virker ikke i Cloudflares Workers-runtime.** Server-kode der skal snakke med Firestore, skal gå gennem `src/lib/server/firestoreRest.ts`. Det gælder alle endpoints under `src/routes/api/`.
- **`firestore.rules` og `storage.rules` deployes manuelt** ved at kopiere dem ind i Firebase Console. De bliver ikke deployet af et push. Siger man at regler er ændret, skal man også sige at de skal kopieres ind.

### 3.2 Filerne

| Sted | Hvad |
|---|---|
| `src/routes/ny/+layout.svelte` | Skallen. Adgangs-gate, bundmenu, contexts for `user`, `userDoc`, `adgang` og `forlob` |
| `src/routes/ny/ny.css` | Alt design. Scoped under `.ny-app` |
| `src/lib/content/adgang3.ts` | Adgangsmodellen. Rene funktioner, 38 tests |
| `src/lib/content/forside3.ts` | Kurve, målinger, kadence. Rene funktioner, 27 tests |
| `src/lib/content/inspirator3.ts` | Hvornår AI-inspiratoren skal dukke op. 12 tests |
| `src/lib/content/beskeder3.ts` | "Til dig lige nu". 8 tests |
| `src/lib/firestore/forside3.ts` | Al Firestore-læsning til forsiden |
| `src/lib/components/ny/` | 15 komponenter, alle kun brugt i 3.0 |
| `src/routes/api/ny-ai/+server.ts` | AI-endpointet til 3.0. `/api/linn-ai` er den gamle og er urørt |

### 3.3 Datamodellen

Kunden er i centrum. Adgange er rækker med et fra og et til, og ingen række overskriver en anden. En kunde kan godt have abonnement og forløb samtidig, og hun kan melde sig ud og komme igen senere uden at historikken går tabt.

**Der er ingen datamigrering.** Rækkerne udledes ved læsning af de felter der allerede står på kunden, i `adgangsbilledeFor()` i `adgang3.ts`. Der skrives aldrig noget adgangs-felt.

**Der findes ikke premium i 3.0.** Hverken som kundeskel, felt eller gate. Alle har den samme app. Ordene `premium` og `basis` findes stadig som rene datanøgler i gamle Firestore-dokumenter, og de skal blive der, men de må aldrig blive til et skel mellem kunder.

---

## 4. Hvad der er bygget

Alle ruter ligger under `/ny`.

| Rute | Tilstand |
|---|---|
| `/ny` | Forsiden. Færdig og i brug |
| `/ny/dag/[dato]` | Én dag pr dato. Samme kort som forsiden. Færdig |
| `/ny/lektion/[dag]/[id]` | Video- og lydlektion med rigtig gennemført-registrering. Færdig |
| `/ny/beskeder` | Beskeder til Linn. Færdig |
| `/ny/snak` | Kunde-chat med AI. Færdig |
| `/ny/maaling` | Spørgeskema. Færdig |
| `/ny/udvikling` | Bygget, men ikke gennemgået mod den gamle app endnu |
| `/ny/moduler` | Skitse. Etape 4 |
| `/ny/profil`, `/ny/hjaelp`, `/ny/forlob` | Bygget |

Forsiden består af, i rækkefølge: hilsen med Linns ansigt, Til dig lige nu, Dit overskud med kurven, AI-inspiratoren, datostrimlen, dagens små skridt, dagens lektioner, dagens træning, dagens refleksion, dagens tal og næste hold.

**Foldning:** en sektion hun har klaret folder sig sammen til én linje med flueben, og den bliver liggende præcis hvor den stod. Et tryk folder den ud igen, og så står den åben resten af dagen. Det huskes i `sessionStorage` pr dato.

---

## 5. Test-profiler

To konti har flaget `ny-app` og kan se hele fladen.

| Email | Hvem | Type |
|---|---|---|
| `test-forlob@linnsacademy.dk` | Mette Testkonto | Forløbskunde på `kropsro_maj_2026` |
| `test-medlem@linnsacademy.dk` | Hanne Testkonto | Medlem uden forløb, abo til 6. juni 2027 |

Adgang til `/ny` gives til admin og til kunder hvor `harTestAdgang(userDoc, 'ny-app')` er sand. Flaget kan sættes både pr person og pr hold. Der er bevidst ingen omdirigering fra `/app` til `/ny`.

---

## 6. Konventioner der ikke må brydes

**Tekstskalering.** Alle skriftstørrelser skrives som `calc(NNpx * var(--fs-scale, 1))`. Uden det virker kundens valg af tekststørrelse ikke, og målgruppen er kvinder i 40erne og opefter. Det er ikke pynt.

**CSS er scoped under `.ny-app`.** Tokens ligger bevidst ikke på `:root`. Ville de det, kunne de overskrive `src/app.css` og ændre udseendet i den gamle app for alle kunder. Der ligger en token-bro nederst i `ny.css`, så genbrugte gamle komponenter automatisk får den nye flades farver.

**Skrifter indlejres som data-URI.** Ingen CDN-links, ellers rammer PWAens CSP.

**Sprog.** Alt UI og alle kodekommentarer er på dansk. Tekst kunden ser skrives med æ, ø og å. Kommentarer inde i koden skrives uden, altså forloeb, aendret og maerkat. Sådan er koden allerede, og det skal blive ved med at være ensartet.

**Attrap mærkes.** Indhold der endnu ikke er koblet til rigtige data får klassen `skitse`, så der aldrig er tvivl om hvad der virker.

---

## 7. Fælder vi allerede er faldet i

Læs den her, inden du fejlsøger noget der ligner.

**Programdag og kundens svar bor under to forskellige nøgler, og de må ikke byttes om.** Programmet, altså spørgsmål og refleksion, ligger under **forløbets id**. Hendes egne svar ligger under **produkt-nøglen** i hendes egen skuffe. Byttes de om, ser siden helt normal ud og er bare tom. Det kostede en fejlsøgning på datostrimlen, de små skridt og refleksionen på én gang. Se kommentaren i `src/lib/firestore/forside3.ts`.

**Service worker serverer en cachet skal.** En blank side på `localhost:5173` betyder ofte bare at dev-serveren ikke kører, og at service workeren viser den gamle cache. Tjek at serveren kører, før du leder i koden.

**`.env` mangler et linjeskift.** `ANTHROPIC_API_KEY` hænger sammen med `PUBLIC_FIREBASE_APP_ID` på samme linje, og det betyder at nøglen kan lække ud i den HTML klienten får. **Det er ikke rettet endnu.** Det bør rettes, og nøglen bør rulles.

**`opretDoc` findes ikke i `firestoreRest.ts`.** Brug `gemDocMerge` med et selvlavet dokument-id.

**Firestore-regler driver.** Sammenlign altid de live regler med `firestore.rules` i repoet, inden du beder Linn kopiere noget ind i Console. Driften er den reelle risiko, ikke selve reglen.

---

## 8. Sådan tjekker du dit arbejde

```
npx svelte-check --threshold error     # skal give nul fejl
npm test                               # 765 tests lige nu, alle grønne
npm run build                          # ved kundefølsomme ændringer
git status --porcelain                 # kun nye eller 3.0-filer må stå der
```

Data-scripts mod rigtige kunder skrives som `scripts/_navn.ts`, køres med `npx tsx`, og **slettes bagefter**. Kør altid read-only eller dry-run først og vis Linn resultatet. Skal der skrives til kundedata, skal Linn sige ja specifikt til netop den kørsel.

---

## 9. Hvor vi står, og hvad der er næste skridt

Alt til og med "Til dig lige nu" er kodet. Det sidste er ikke committet endnu.

### Åben liste, aftalt 6. august

Den kom ud af en gennemgang af den gamle forside blok for blok. Punkterne står i den rækkefølge Linn har prioriteret dem.

1. ~~Dagens lektion for medlemmer~~. **Udgår.** Samlingen `modulbrugerLektioner` er tom, funktionen er aldrig blevet brugt. Almindelige abonnenter skal ikke have lektioner.
2. **Nyt svar fra Linn.** Kodet 6. august som del af "Til dig lige nu".
3. **Adgang udløber.** Kodet samme sted. Vises fra 14 dage før, og kun for kunder uden aktivt forløb.
4. **Note fra Linn på forsiden.** Ikke kodet. Feltet hedder `noteFraLinn` og ligger på forløbsdagen. Vi viser den allerede på dags-siden, men ikke på forsiden. Bruges sjældent, én gang ud af 79 dage i Kropsro, men når den bruges er den vigtig.
5. ~~Personlig coaching~~. **Udgår.** Linn har fravalgt linket.
6. **Challenge.** Ikke kodet. Skal bevares. Der kører én lige nu i Kropsro, "Planter til tarmmikrobiom", og 28 kunder har tastet ind i den. Der skal laves fire mockup-forslag først.
7. **Nul-dage i datostrimlen.** Ikke kodet. Skal bevares. Se `nulDageDatoer()`.
8. **Spærring ved udløb af abonnement.** Ikke kodet. `adgang.harApp` bliver regnet ud i dag, men bruges ikke som gate nogen steder. Adgangen skal lukke af sig selv når abonnementet udløber.

### Efter den liste

Etape 4, altså modulerne. Foreslået rækkefølge: oversigten, Udvikling, Træning, Mad, Små skridt. Under Træning skal kunden kunne vælge sit træningsprogram første gang der trykkes, og kunne skifte valg løbende.

### Bevidst udskudt

Biblioteket. Variant-, makker- og Facebook-modalerne på træning og Kropsro. "Mine køb" for udløbne kunder.

---

## 10. Sådan arbejder Linn

Det her er lige så vigtigt som koden.

Linn koder ikke selv og har ingen teknisk baggrund. Tal almindeligt dansk, forklar fagudtryk kort i en parentes, og hold svarene korte. Skal hun gøre noget selv, for eksempel indsætte regler i Firebase Console, så guide hende trin for trin.

**Lav altid en diagnose først, og kod aldrig uden et klart go.** Det gælder også de små ting.

**Commit og push kun når hun beder om det.** Push til `main` går direkte ud til kunderne.

**Én ting ad gangen.** List hvilke ændringer du vil lave, før du laver dem. Finder du noget andet undervejs, så nævn det og lad det ligge.

**Vær ikke en ja-siger.** Peg på svagheder og risici, giv reelle alternativer med fordele og ulemper, og sig ærligt til hvis en idé er svag. Hun beder selv om det.

I tekst til hende bruges hverken tankestreg eller semikolon. Det gælder tekst, ikke kode.

Bo arbejder med på projektet og kan give et go på samme måde som hun kan.
