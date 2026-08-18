# Overdragelse: Linns Academy 3.0

Sidst opdateret 18. august 2026.

**Denne fil handler kun om 3.0.** Den gamle app i drift på `/app` har sin egen overdragelse i `HANDOVER-GAMMEL-APP.md`, og de to må ikke blandes sammen.

**Læs i denne rækkefølge hvis du er ny:** afsnit 2 om den vigtigste regel, afsnit 7 om fælderne, og så afsnit 9 om hvor vi står. Resten kan slås op efter behov.

Denne fil er til den næste der skal arbejde videre, uanset om det er et nyt Claude-vindue, Bo eller en udvikler udefra. Den fortæller hvor vi er, hvordan tingene hænger sammen, og hvor fælderne ligger.

**Der findes én overdragelse for 3.0, og det er den her.** Gamle overdragelser fra 1.0 og 2.0 ligger i `arkiv/` og gælder ikke. De blev flyttet derned 11. august, fordi tyve filer i roden der alle lignede en overdragelse var en fælde: den med det højeste nummer så nyest ud og var det ikke.

Læs den sammen med disse tre:

- `CLAUDE.md` i repo-roden er arbejdsreglerne. De er ikke til forhandling.
- `SPEC-3.0.md` er hvad der bygges og hvorfor. 34 afsnit, hvor 26 og 29 har en del underafsnit. 13 til 21 er designbeslutningerne fra 5. august, 22 til 27 er hele 30-30 beregneren med målingerne bag hver beslutning, 28 er opstarten, altså det der sker før den første skærm kommer frem, og **29 er hele træningsmodulet**, **30 er Beskeder**, **31 er onboarding**, **32 er Dine lektioner og Hjælp**, **33 er login** og **34 er Udvikling**. **Efter afsnit 27 ligger Ventelisten**, altså alt det der bevidst er sat på pause til appen er designet færdig. Læs afsnit 22 til 27 før du går i gang med noget i Mad, og afsnit 29 før du rører træningen.

  **Pas på afsnit 22 og 26.5.** De sagde begge at Biblioteket blev et kort nederst på forsiden. Det er omgjort to gange, og afsnit 32 er det gældende. Linjerne er markeret som forældede, men de står der stadig, fordi målingerne omkring dem stadig gælder.
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
- **`firestore.rules` og `storage.rules` deployes ikke af et push.** Siden 9. august 2026 udgives de med Firebase CLI, se afsnit 8. Reglerne styrer adgang for alle kunder i drift, så vis altid Linn den præcise ændring og få et ja først.

### 3.2 Filerne

**Alt der hører til 3.0 ender på `3`.** `adgang3.ts`, `forside3.ts`,
`maaltider3.ts` og så videre. Ser du en fil uden 3-tallet, hører den til den
gamle app og må kun læses.

| Sted | Hvad |
|---|---|
| `src/routes/ny/+layout.svelte` | Skallen. Adgangs-gate, spærring, bundmenu, contexts for `user`, `userDoc`, `adgang` og `forlob`. **Læg ikke nyt her uden en god grund**, se SPEC 26.5 |
| `src/routes/ny/ny.css` | Alt design. Scoped under `.ny-app`. Cirka 2.000 linjer |
| `src/lib/components/ny/` | 30 komponenter, alle kun brugt i 3.0. `VaelgArk.svelte` er ubrugt siden 12. august og skal enten slettes eller have en note |
| `src/lib/utils/billede3.ts` | Skalering og webp i browseren. `billede.ts` er den gamle og må ikke røres |
| `src/routes/ny/admin/ingredienser/` | Kobl ingredienser til fødevarer. Se 9.17 |
| `src/routes/ny/admin/opskrift-makro/` | Regnestykket linje for linje. **Gå her når et tal ser forkert ud** |
| `src/lib/firestore/ingrediensKobling3.ts` | Koblingerne. Læses af regnemaskinen |
| `src/lib/firestore/opskriftBeregning3.ts` | De gemte beregninger. Overlejres i `hentOpskrifter3` |

**Ren logik, ingen database, alt sammen testet:**

| Fil | Hvad | Tests |
|---|---|---|
| `content/adgang3.ts` | Adgangsmodellen, dagnummer, medlemstid | 44 |
| `content/challenge3.ts` | Challenge: mål, gitter, stilling | 42 |
| `content/opskriftSoeg3.ts` | Søgning i opskrifter. Se 9.5 | 49 |
| `content/opskriftBillede3.ts` | Billed-størrelser, filnavne, sortering. Se 9.6 | 33 |
| `content/maengde3.ts` | Mængde, spring pr enhed, næring | 28 |
| `content/forside3.ts` | Kurve, målinger, kadence | 27 |
| `content/maaltider3.ts` | Dagens fire måltider og deres tal | 27 |
| `content/nulDage3.ts` | Pause-dage. Se 9.2 | 24 |
| `content/spaerring3.ts` | Spærring ved abo-udløb. Se 9.3 | 12 |
| `content/opskriftKategori3.ts` | Opskrift-kategorier, hvor snack er sin egen | 23 |
| `content/inspirator3.ts` | Hvornår AI-inspiratoren dukker op | 12 |
| `content/plejer3.ts` | "Det du plejer". Modulets vigtigste fil, læs toppen | 12 |
| `content/enhedsvaegt3.ts` | **Regnemaskinen etape 1.** Husholdningsmål til gram. Se 9.17 | 38 |
| `content/ingrediensNavn3.ts` | **Etape 2.** 402 navne til 291 kernenavne. Tilstand står på navnet | 23 |
| `content/ingrediensKobling3.ts` | **Etape 3.** Kernenavn til fødevare. Hele ord, sundhedstjek | 26 |
| `content/opskriftMakro3.ts` | **Etape 4.** Selve regnestykket, plus `visMakro` | 24 |
| `content/hurtigStart3.ts` | 3.0's opstartsregel plus `opstartsBillede()`. Se 9.7 | 13 |
| `content/favoritOpskrift3.ts` | Favorit-opskrifter, altså bogmærker. Se 9.8 | 22 |
| `content/fasteMaaltider3.ts` | Faste måltider, altså "byg et måltid". Se 9.10 | 36 |
| `content/mineOpskrifter3.ts` | Kundens egne opskrifter. Se 9.11 | 66 |
| `content/egneFodevarer3.ts` | Kundens egne fødevarer. Se 9.12 | 22 |
| `content/tal3.ts` | Dansk komma og Atwater. Delt af de skærme hvor hun taster næringstal | via de to |
| `content/hjerteFodevare3.ts` | Hjertet på en fødevare. Se 9.14 | 15 |
| `content/fodevareSoeg3.ts` | Søgning i fødevarer: hele ord og flere ord. Se 9.14 | 24 |
| `content/opskriftPortion3.ts` | Portioner og makro. **Regnereglen**, se 9.9 | 14 |
| `content/opskriftTekst3.ts` | Fremgangsmåde, trin og tilberedningstid. Se 9.9 | 20 |
| `content/beskeder3.ts` | "Til dig lige nu". **Ikke Beskeder-siden**, se `beskedside3` | 8 |
| `content/beskedside3.ts` | **Beskeder-siden.** Adgang, faner, send videre. Se 9.19 | 43 |
| `content/onboarding3.ts` | **Onboarding.** Kortene, tælleren, de to felter. Se 9.20 | 32 |
| `content/appHjaelp3.ts` | **Spørg om appen.** 3.0-videnbasen. Se 9.21 | 16 |
| `content/traeningsprogram3.ts` | **Træning.** Programmer og træninger. Se 9.18 | 44 |
| `content/traeningKategori3.ts` | Kategorier og hendes udstyrsvalg | 39 |
| `content/traeningTildeling3.ts` | Hvem får hvad, hvornår, og dækning | 49 |
| `content/traeningFremgang3.ts` | Hvor langt hun er, og rækkefølgen | 30 |
| `content/afspiller3.ts` | **Afspillerens fase-maskine.** Ren logik | 38 |
| `content/mineTraeninger3.ts` | Kundens egne programmer. Præfikset `egen_` | 26 |
| `content/traeningAi3.ts` | **AI-værktøjet.** Validering mod banken, dage-fra-sætning | 44 |
| `content/lektionsliste3.ts` | **Dine lektioner.** Rækkerne, låsen, noterne, de 90 dage. Se 9.22 | 57 |
| `content/hjaelp3.ts` | **Hjælp.** Hvilke forløb FAQ og links hentes fra, og fletningen. Se 9.23 | 15 |

**To nye filer uden 3-tallet, og det er med vilje.** `content/hurtigStart.ts`, 16 tests, og `userDocCache.ts` hører til den hurtige opstart i den GAMLE app, se 9.7. De er skrevet af os og må gerne rettes. Navnereglen ovenfor handler om at filer uden 3-tallet typisk er den gamle apps, ikke om at alt uden 3-tal er fredet. `content/hurtigStart.ts` læses desuden af 3.0, som henter tidsgrænsen derfra.

**Firestore-laget, kun læsning på nær måltider:**

| Fil | Hvad |
|---|---|
| `firestore/forside3.ts` | Alt til forsiden |
| `firestore/maaltider3.ts` | Dagens måltider |
| `firestore/plejer3.ts` | Vaner og måltider. Den første af **seks** filer i 3.0 der **skriver** kundedata |
| `firestore/challenge3.ts` | Challenge, både nye og gamle |
| `firestore/nulDage3.ts` | Pause-dage |
| `firestore/featureAdgang3.ts` | Feature-adgang. Hentes her, ikke i skallen |
| `firestore/opskrifter3.ts` | Opskrifter. Egen indlæser, fordi den gamle taber snack |
| `firestore/opskriftBillede3.ts` | Upload og sletning af opskrift-billeder. Kun admin |
| `firestore/challengeAdmin3.ts` | Admin: opret og tildel challenges |
| `firestore/hurtigStart3.ts` | Hele opstarts-billedet, læst lokalt uden netværk. Se 9.7 |
| `firestore/favoritOpskrift3.ts` | Bogmærket på en opskrift. Den anden der **skriver** kundedata. Se 9.8 |
| `firestore/fasteMaaltider3.ts` | Faste måltider. Den tredje der **skriver** kundedata, både genvejen og dagbogen. Se 9.10 |
| `firestore/mineOpskrifter3.ts` | Kundens egne opskrifter. Den fjerde der **skriver** kundedata. Se 9.11 |
| `firestore/egneFodevarer3.ts` | Kundens egne fødevarer. Den femte der **skriver** kundedata. Se 9.12 |
| `firestore/hjerteFodevare3.ts` | Hjertet på en fødevare. Den sjette der **skriver** kundedata. Se 9.14 |
| `firestore/traeningsprogram3.ts` | Programmerne og deres træninger. Kun admin skriver |
| `firestore/traeningKategori3.ts` | Kategorierne. Kun admin skriver |
| `firestore/traeningTildeling3.ts` | Tildelingerne. Kun admin skriver. Kunden læser to snævre forespørgsler |
| `firestore/traeningFremgang3.ts` | Hendes fremgang. Den syvende der **skriver** kundedata |
| `firestore/traeningPlads3.ts` | Gemt plads i en træning. Den ottende der **skriver** |
| `firestore/traeningUdstyr3.ts` | Hendes udstyrsvalg. Den niende der **skriver** |
| `firestore/traeningKunde3.ts` | Kunderne set fra admin, med adgang og forløbsdag |
| `firestore/lektionsliste3.ts` | Forløbets dage. Kun læsning, genbruger `hentForlobsdage` |
| `firestore/traeningForside3.ts` | Træningsflisen på forsiden |
| `firestore/beskedside3.ts` | Beskeder. Kobler til `linnAiSamtaler` og `klientspoergsmaal`. Den tiende der **skriver** |
| `firestore/onboarding3.ts` | `onboardet3` og `tekstSkala3`. Den ellevte der **skriver** |
| `routes/api/ny-ai/+server.ts` | AI-endpointet til 3.0. `/api/linn-ai` er den gamle og er urørt |

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
| `/ny/beskeder` | **Beskeder.** Linn AI og Linn i to faner. Færdig, se 9.19 |
| `/ny/snak` | Nedlagt 16. august. Sender videre til `/ny/beskeder` |
| `/ny/maaling` | Spørgeskema. Færdig |
| `/ny/udvikling` | **Alle fem områder bygget 18. august** som foldede kort. Se 9.24, 9.25 og 9.26 |
| `/ny/moduler` | Gammel skitse. **Ikke længere i bundmenuen**, erstattet af 30-30 |
| `/ny/profil`, `/ny/forlob` | Bygget |
| `/ny/profil` → **Dine lektioner** | Ét forløb pr række. **Afløser diplom-blokken.** Se 9.22 |
| `/ny/lektioner/[forlobId]` | **Ét forløbs lektioner og hendes noter.** Se 9.22 |
| `/ny/admin/challenges` | Admin: opret og tildel challenges. Kun admin. Intet menupunkt, skriv adressen |
| `/ny/admin/opskrift-billeder` | Admin: læg billeder på opskrifter. Kun admin. Intet menupunkt. Se 9.6 |
| `/ny/admin/ingredienser` | Admin: kobl ingredienser til fødevaredatabasen. Se 9.17 |
| `/ny/admin/opskrift-makro` | Admin: regnestykket bag hver opskrift, linje for linje. Se 9.17 |
| `/ny/30-30` | 30-30 beregneren, oversigten. Fire måltider og dagens tal. Færdig |
| `/ny/30-30/[type]` | Inde i et måltid. Alt indhold hænger her. Færdig |
| `/ny/admin` | **Admin-forsiden.** Ét sted at trykke sig videre fra. Nås fra Profil |
| `/ny/admin/traening` | Admin: byg træningsprogrammer. Se 9.18 |
| `/ny/admin/traening/kategorier` | Admin: det udstyr kunden kan vælge imellem |
| `/ny/admin/traening/ai` | Admin: **byg et program med AI.** Se 9.18 |
| `/ny/admin/traening/[id]/ai` | Admin: **ret et program med AI**, én uge ad gangen |
| `/ny/admin/traening/[id]/tildel` | Admin: hvem har programmet, og hvornår det gælder |
| `/ny/admin/traening/hold` | Admin: **har hvert hold træning til alle slags udstyr** |
| `/ny/admin/traening/kunde` | Admin: slå en kunde op, se hvad hun ser og hvorfor |
| `/ny/admin/traening/byg-eget` | Admin: hvem må bygge sit eget program |
| `/ny/traening` | Kunden: Mikrotræning, hendes programmer. Færdig |
| `/ny/traening/[id]` | Kunden: træningerne og hvor langt hun er. Færdig |
| `/ny/traening/[id]/[nr]` | Kunden: **afspilleren.** Én, hvor den gamle app har fire |
| `/ny/traening/byg-eget` | Kunden: opret sit eget program. Se 9.18 |
| `/ny/traening/byg-eget/[id]` | Kunden: ret sit eget program, tilføj og fjern træninger |
| `/ny/traening/byg-eget/[id]/[nr]` | Kunden: vælg øvelser til én af sine egne træninger |
| `/ny/profil/traening` | Kunden: Sådan træner jeg, altså udstyrsvalget |
| `/ny/velkommen` | **Onboarding.** Fire spørgsmål og en rundvisning. Se 9.20 |
| `/ny/hjaelp` | **Navet.** Spørg, FAQ, links, skriv til Linn. Se 9.23 |
| `/ny/hjaelp/spoerg` | Spørg om appen. Egen 3.0-videnbase, se 9.21. **Flyttet hertil 18. august** |
| `/ny/hjaelp/faq` | Ofte stillede spørgsmål. Se 9.23 |
| `/ny/hjaelp/links` | Links og guides. Se 9.23 |

**Bundmenuen:** Forside · 30-30 · Beskeder · Udvikling · Profil.

**Ordet Snak er droppet 16. august.** Fanen hedder Beskeder, og siden rummer
både Linn AI og Linn. Ser du ordet et sted, hører det til før den dato.

Forsiden består af, i rækkefølge: hilsen med Linns ansigt, Til dig lige nu, noten fra Linn, Dit overskud med kurven, AI-inspiratoren, datostrimlen, dagens små skridt, dagens lektioner, dagens træning, dagens refleksion, dagens tal, challenge og næste hold.

**Foldning:** en sektion hun har klaret folder sig sammen til én linje med flueben, og den bliver liggende præcis hvor den stod. Et tryk folder den ud igen, og så står den åben resten af dagen. Det huskes i `sessionStorage` pr dato.

**To blokke folder sig bevidst ikke sammen:** noten fra Linn og challengen. Ingen af dem er noget kunden kan gøre færdig på en dag.

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

**`.env` manglede et linjeskift. Rettet 9. august 2026.** `ANTHROPIC_API_KEY` hang sammen med `PUBLIC_FIREBASE_APP_ID` på samme linje, så nøglen blev en del af app-id'ets værdi og røg med i klient-koden. Tidligere udgaver af det her dokument sagde at nøglen kunne lække ud til kunderne. **Det passede ikke.** Det blev tjekket den 9. august ved at hente den kode browseren faktisk får fra den live side og se efter: der stod kun app-id'et. Cloudflare har sine egne variabler sat i deres kontrolpanel, og de har hele tiden været i orden. Nøglen har heller aldrig været i git, hverken i en fil eller i historikken. Problemet fandtes kun i lokale builds. Nøglen er derfor ikke rullet, og det er en bevidst beslutning, ikke en glemt opgave.

Bemærk sidegevinsten: før rettelsen fandtes `ANTHROPIC_API_KEY` slet ikke som selvstændig variabel lokalt, så AI-funktionerne kunne ikke virke i dev.

**Farverne forsvinder når noget flyttes ud af `.ny-app`.** Modaler og ark portalles til `document.body` for at bryde ud af et område der ruller på iOS. Men farverne er variabler defineret på `.ny-app`, så `var(--oat)` resolver til ingenting, og arket bliver gennemsigtigt. **Sæt klassen `ny-tokens` på rod-elementet i alt der portalles.** Kostede en aften 10. august, og challenge-stillingen havde samme fejl uden at nogen havde opdaget den.

**En for stærk nulstilling slår komponenternes egen stil ihjel.** `.ny-app button` satte `font: inherit` og `background: none`, og reglen var stærkere end en komponents egen klasse. Fliser mistede deres baggrund og fik forkert skriftstørrelse. Det så ud som tre forskellige fejl. Reglen er nu pakket i `:where()`, så den er vægtløs. Gør det samme hvis du skriver en ny.

**Læg ikke noget nyt i skallen uden en god grund.** Et forsøg på at hente feature-adgangen i `routes/ny/+layout.svelte` gav en helt blank app 11. august, og årsagen kunne aldrig findes. Vi rullede tilbage og byggede det i mindre bidder, hvor hentningen ligger dér hvor den bruges. Skallen omgiver hver eneste side, så en fejl der rammer den, rammer alt.

**`vh` gør ark højere end den synlige skærm på mobil.** Mobilbrowsere regner `vh` ud som om adresselinjen var væk. Et ark på 86vh blev derfor højere end det Linn kunne se, og toppen med søgefelt og luk-kryds havnede uden for skærmen. Hun kunne hverken søge eller lukke arket. Brug `dvh`, som er den synlige højde, med `vh` som reserve:

```css
height: 84vh;
height: 86dvh;
max-height: calc(100dvh - 10px);
```

Rettet 11. august på alle fire ark. `.henter` og `.side-ramme` bruger stadig `vh` med vilje, for de er ikke ark.

**Et VALGFRIT felt i en type kan skjule en filtrerings-fejl.** `Opskrift3` har feltet `kategorier3`, men filter-funktionen læste `kategorier`. Feltet var valgfrit, så TypeScript sagde ikke fra: tallet ud for Morgenmad stod rigtigt på 24, men et tryk på knappen tømte skærmen. **Gør felter som en filtrering afhænger af påkrævede**, se `FiltrerbarOpskrift` i `opskriftSoeg3.ts`.

**WebP fejler ikke, den lyver.** Beder man en browser der ikke kan webp om webp, får man ikke en fejl. Man får en **PNG**, som er større end den JPEG man ville have haft. Man tror man har sparet og har gjort det værre. **Spørg altid hvad der faktisk kom ud**, se `formatDuger` i `opskriftBillede3.ts`, og lav en JPEG hvis svaret ikke duer.

**Læg aldrig et billede ind i et Firestore-dokument.** Opskrift-billeder lå som base64-tekst inde i dokumentet. To billeder vejede 189 KB, altså halvdelen af hele opskrift-samlingens 379 KB, og de blev hentet hver gang listen blev åbnet, uanset om nogen rullede ned til dem. Flyttet til Storage 11. august, se 9.5. **Læg billedet i Storage og gem adressen.**

**Appen ventede på netværket, selv om svaret lå lokalt.** Det gennemgående mønster i hele opstarten, og det kostede Linns telefon over ét minut på logoet og "Et øjeblik" den 11. august. Firestore gemmer i forvejen hvert dokument i telefonens egen hukommelse, se `localCache` i `lib/firebase.ts`, men det almindelige `getDoc` spørger serveren alligevel, og på en forbindelse der er der men død, kan det tage et minut før browseren giver op. Det samme gjaldt app-skallen i service workeren og skrifterne fra Google. **Spørg altid om svaret allerede ligger lokalt, før du lægger et kald i opstarten.** Se SPEC afsnit 28 for hele gennemgangen og for de fem flaskehalse der blev fjernet.

**En LUKKET dør åbnes aldrig på en lokal kopi.** Følger af ovenstående, og den er vigtigere end hastigheden. Både "du har ingen adgang" i den gamle app og "Din adgang er udløbet" i 3.0 skal bekræftes af serveren, for kopien kan være gammel, fx hvis kunden lige har fornyet. Den anden vej er ufarlig. Se `maaAabnePaaKopi` og `maaAabnePaaKopi3`, og der er test på begge.

**Spærringen i 3.0 hviler på det aktive forløb, så halve data er farlige.** Regel 1 i `spaerring3.ts` siger at et aktivt forløb vinder over alt. Kender koden ikke forløbene endnu, ser en Kropsro-kunde med udløbet abonnement ud som om hun ingen forløb har, og så får hun spærre-skærmen midt i sit forløb. **Læs aldrig kun bruger-dokumentet og træf en adgangs-beslutning på det.** Bemærk også at en forløbs-række kræver begge ben, altså `forlobIds` på kunden OG selve forløbs-dokumentet, se `udledAdgange` i `adgang3.ts`.

**Makroen på en opskrift er PR PORTION. Del den aldrig med `defaultPortioner`.** Det tal fortæller kun hvor mange portioner INGREDIENSLISTEN rækker til. Reglen blev brudt tre forskellige steder i to apps uden at nogen opdagede det, fordi 122 af 130 opskrifter står til én portion, og at dele med 1 ændrer ingenting. Kun på de 8 der står til 2, 4 eller 12 slår fejlen igennem, og der lå de to apps 2, 4 og 12 gange fra hinanden. Se 9.9 og SPEC 26.9. Regnereglen ligger i `content/opskriftPortion3.ts`, brug den i stedet for at skrive den forfra.

**Makro-tallene er gemt inde i `instruktioner`-teksten. Slet aldrig den linje.** Alle fem tal parses ud af en linje der starter med `Protein:`, se `parseOpskriftMakro`. Fjernes den fra teksten, mister alle 130 opskrifter deres næringstal i BEGGE apps på én gang. Skal den ikke ses, klip den ud af VISNINGEN, se `content/opskriftTekst3.ts`. Tiden ligger i samme linje og ryger med hvis man ikke trækker den ud.

**Regn ikke makro af råvarerne ved at gætte fødevaren ud fra navnet.** Forsøgt 12. august som kontrol af alle 130. Fødevare-databasen har både tørre og kogte udgaver, og matcheren valgte systematisk den tørre: "kikærter" blev til *tørrede, rå* med 337 kcal, og "bouillon" blev til *koncentreret terning*, så 300 g suppe blev til 480 kcal. Prøven udpegede **59 opskrifter som forkerte, og de var det ikke.** Skal det gøres rigtigt, skal hver ingrediens kobles til en bestemt fødevare, ikke slås op på navnet.

**En favorit har ikke plads til makro, og det opdager du ikke før tallet er forkert.** `favoritmaaltider` gemmer kun et navn og en liste af varelinjer. Protein og fiber regnes ud ved at slå hver linje op i fødevare-databasen, og en linje uden `foodId` springes over. Gemmer du derfor noget som favorit der ikke består af rigtige madvarer, fx en opskrift, lægger et tryk på den **0 g protein og 0 g fiber** i hendes dag, uden en eneste fejlmeddelelse. I et modul der hedder 30-30 og handler om præcis de to tal er det den værst tænkelige fejl, for den ser rigtig ud. Det er derfor favorit-opskrifter blev bygget som et bogmærke i stedet, se 9.8. **Målt 12. august: 178 af 2.905 favoritter, altså 6 %, har allerede mindst én linje uden makro**, så de kunder logger lige nu mindre end de spiste. Det er en grænse i den gamle model og ikke noget vi har lavet, og det er ikke løst.

**En bred CSS-regel rammer også den nye knap du lægger ved siden af.** Hjertet i søgeresultatet lagde sig 12. august oven i madvarens navn, og teksten brækkede om på ét ord pr linje. Årsagen var `.tm-traef button`, som satte `width: 100%` på ALT hvad der var en knap i søgeresultatet. Den ramte også hjertet. **Se efter brede regler på det gamle element, før du lægger en knap ved siden af det.** Der er flere af dem i `ny.css`, for eksempel `.va-liste button` og `.ol-faner button`. **Og bemærk at hverken `svelte-check`, testene eller et build fanger den slags.** Det gør kun øjne.

**En komponent kan være skrevet, testet og importeret uden nogensinde at blive brugt.** Faste måltider åbnede 12. august et tomt ark uden en eneste fejl. Det nye ark var aldrig kommet ind i markup, så det gamle Vælg-ark åbnede i stedet, med den nye titel på og uden en tom tekst at vise. **Hverken `svelte-check` eller testene fanger det**, for koden er korrekt, den bliver bare aldrig kaldt. Tjek at en ny komponent faktisk står i markup, ikke kun at den er importeret.

**Tre fælder i `firestoreRest.ts`, alle tre fundet 16. august i det samme endpoint.** Ingen af dem fanges af typerne, testene eller et build, fordi et cast fortæller TypeScript at formen er rigtig. De blev kun fundet ved at spørge den kørende app.

- **`hentAlleDocs` giver `{ id, data }` og IKKE dokumentet selv.** Et cast direkte til dokumentets form ser rigtigt ud og giver `undefined` hele vejen igennem
- **En timestamp kommer som en ISO-STRENG**, ikke som det `_seconds`-objekt `firebase-admin` bruger. Læser du `_seconds`, får du intet, og datoen bliver til 1970
- **Forløbene står på BRUGER-dokumentet som `forlobIds`. Samlingen `products` er TOM for forløbskunder.** Læser du products for at finde forløbet, ser hver eneste kunde ud som om hun ikke har et. Se `udledAdgange` i `adgang3.ts`, som gør det rigtigt

**Regn aldrig selv ud hvornår et forløb slutter.** `forlobSlutMs` i `content/forlob.ts` gulver starten til midnat og lægger en dag til, så kunden får HELE den sidste dag. Uden det sagde AI-hjælpen 16. august til en kvinde på dag 84 af 84 at hun ikke var på et forløb. Der er allerede en lang kommentar over funktionen om præcis den fejl. Bemærk igen at der findes **to** funktioner med det navn, se 9.2.

**Server-siden kan ikke naa Firestore paa localhost uden tre noegler.** Alt under `src/routes/api/` gaar gennem `firestoreRest.ts`, som kraever `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL` og `FIREBASE_PRIVATE_KEY`. De har kun ligget i Cloudflares kontrolpanel, aldrig i `.env`, saa i lokal udvikling svarede AI'en i Beskeder, hilsenen paa forsiden og opskrift-analysen alle sammen **"Internal Error"**. I drift har det virket hele tiden, saa fejlen ser ud som en fejl i koden og er det ikke. Rettet 16. august ved at laegge de tre i `.env`, hentet fra `scripts/service-account-key.json`. Begge filer er i `.gitignore`.

**`opretDoc` findes ikke i `firestoreRest.ts`.** Brug `gemDocMerge` med et selvlavet dokument-id.

**Firestore-regler driver.** Sammenlign altid de live regler med `firestore.rules` i repoet, inden du udgiver noget. Det er nu ét kald, se afsnit 8.

**`prettier --write` med et bredt mønster ødelægger din diff.** Fundet 18. august. Repoet er ikke prettier-rent i dag, formentlig fordi versionen har flyttet sig siden filerne blev skrevet. Én kørsel på `src/routes/ny/**` omformaterede **25 filer der ellers var urørte**, og i `ny.css` skrev den de indlejrede skrifter om, som er base64 på én linje. Intet af det var forkert, men diffen blev ubrugelig og ingen kunne se hvad der faktisk var ændret. **Formatér kun de filer du selv har rørt, og hold `ny.css` helt udenfor.** Kør `git diff --stat` før hver commit og se efter filer du ikke har rørt.

**Der kan køre en anden session i det samme repo.** 18. august dukkede tre ændrede filer op midt i en opgave, heriblandt én i den GAMLE app. De var ikke fejl, en anden session arbejdede parallelt og committede dem bagefter. **Rul aldrig fremmede ændringer tilbage, og bland dem aldrig ind i din egen commit.** Kør `git status` når du begynder OG når du er færdig, og sammenlign.

---

## 8. Sådan tjekker du dit arbejde

```
npx svelte-check --threshold error     # skal give nul fejl
npm test                               # 1754 tests lige nu, alle grønne
npm run build                          # ved kundefølsomme ændringer
git status --porcelain                 # kun nye eller 3.0-filer må stå der
```

**Firestore-regler.** Siden 9. august 2026 ligger `firebase.json` og `.firebaserc` i repoet, så regler ikke længere kopieres ind i Console i hånden:

```
npx firebase-tools deploy --only firestore:rules
npx firebase-tools deploy --only storage
```

Den oversætter reglerne først og nægter at udgive hvis der er en syntaksfejl. Reglerne styrer adgang for alle kunder i drift, så **vis altid Linn den præcise ændring og få et ja, før du kører den.** Servicekontoen i `scripts/` kan desuden læse de live regler, så du kan sammenligne med repoet uden at udgive noget.

**Regelfilen udgives som helhed.** En fejl i én blok kan lukke kunder ude af noget helt andet, fx træningsvideoer. Læs de live regler bagefter og tjek at de eksisterende blokke stadig står der, ikke kun at den nye er kommet ind.

Data-scripts mod rigtige kunder skrives som `scripts/_navn.ts`, køres med `npx tsx`, og **slettes bagefter**. Kør altid read-only eller dry-run først og vis Linn resultatet. Skal der skrives til kundedata, skal Linn sige ja specifikt til netop den kørsel. Skriver scriptet oven i noget der ikke kan regnes ud igen, så tag en sikkerhedskopi til `backup/` først. Den mappe er uden for git, for kundedata skal ikke på GitHub.

---

## 9. Hvor vi står, og hvad der er næste skridt

Opdateret 18. august 2026. Alt herunder er kodet. **Arbejdet fra 18. august er
IKKE committet endnu**, resten er pushet og `main` er i sync.

**Etape 1 til 3 er færdige, og hele den åbne liste fra 6. august er klaret.** Etape 4 er i gang.

### NÆSTE SKRIDT

**Biblioteket er klaret 18. august**, se 9.22 og 9.23. Det blev delt i to og
navnet droppet. Ordet Bibliotek findes ikke længere i kundens sprog.

Der står nu to ting tilbage før et hold kan flyttes:

- **De fire videoer til onboarding.** Indhold, ikke kode. Skærmbillederne er
  taget 16. august
- ~~De tre sidste blokke på `/ny/udvikling`~~. **Alle fem områder er bygget
  18. august**, se 9.25 og 9.26. Men se den åbne tråd nedenfor om små skridt

**Og før et hold flyttes til 3.0:** programmerne skal være bygget OG tildelt i
det nye system. De gamle kopieres ikke, det droppede Linn 16. august. Bliver
det glemt, starter et helt hold uden træning.

### Det der ellers står åbent, 18. august

Spærrer for 3.0:

- **De fire videoer til onboarding.** Skærmbillederne er taget 16. august
- ~~Små skridt på `/ny/udvikling`~~. **Fjernet igen 18. august**, Linns
  beslutning. Se 9.26 for hvad der gjorde det svært, hvis det skal tilbage
- ~~Biblioteket~~. **Klaret 18. august**, se 9.22 og 9.23
- ~~AI-hjælpen beskriver den GAMLE app~~. **Klaret 16. august**, se 9.21

Skal besluttes, fundet 18. august:

- **Kunden i bonus-perioden kan ikke komme ind i 3.0.** Se 9.22. Spærringen
  kender ikke de 90 dage, så en kunde uden abonnement lukkes helt ude, selvom
  hun i den gamle app har sit bibliotek i 90 dage. Koden bag de to tilstande
  er bygget og testet, men uopnåelig indtil spærringen ændres. **Rør den ikke
  uden et selvstændigt go**, den beskytter hele fladen
- **"Set"-fluebenet er ikke bundet til forløbet.** Se 9.22. Genbruges en
  lektion på to hold, viser fluebenet sig begge steder
- **Repoet er ikke prettier-rent.** Køres `prettier --write` bredt, ændrer den
  omkring 25 filer i 3.0 der ellers er urørte, formentlig fordi versionen har
  flyttet sig. **Formatér kun de filer du selv har rørt**, og hold dig fra
  `ny.css`, hvor prettier omskriver de indlejrede skrifter

Venter på en beslutning fra Linn:

- **Indkøbslisten.** Anbefaling: vent til billederne er på opskrifterne
- **Madplanen.** Parkeret 11. august, mangler et endeligt ja eller nej

Kendt, ikke rettet:

- **Skærmen ser tom ud mens fødevare-databasen hentes.** 2.268 dokumenter
  tager tid på en telefon. Samme klasse som opstarts-problemet i 9.7
- **Makrotallene skrives ikke ud til den gamle app.** Scriptet var klar og
  kørte tørløb, men blev aldrig kørt. Synlig ændring for 760 kunder på én
  gang, hvor nogle tal fordobles, så det skal times. Se afsnittet om åbne
  tråde på regnemaskinen
- **AI-samtalerne slettes ikke automatisk** efter en måned. Se 9.18

Ældre tråde der ikke er statustjekket 16. august, og som skal verificeres mod
koden før nogen regner med dem: forløb-webhooken til Simplero,
feature-adgang-matricen, forløb-byggeværktøjet, Linn AI under Beskeder, og
rettelsen af otte kunders købsdatoer.

**30-30 beregneren** er bygget og i brug, se 9.4, og regnemaskinen bag opskrifternes makro er færdig, se 9.17.

**Beskeder er lagt sammen til én side 16. august**, altså Linn AI og Linn i
to faner, og ordet Snak er droppet. Se 9.19.

**Træningen er bygget om fra bunden 15. og 16. august**, hele modulet, fra Linns værktøj og AI-hjælperen til kundens afspiller og til at kunden bygger sit eget. Se 9.18, og læs SPEC afsnit 29 før du rører noget der.

**Sidst på aftenen 11. august blev hele opstarten rettet**, efter at Linns telefon stod over ét minut på "Et øjeblik". Fem flaskehalse, fire af dem i den app der er i drift. Se 9.7, og SPEC afsnit 28 for hele gennemgangen.

### Åben liste, aftalt 6. august

Den kom ud af en gennemgang af den gamle forside blok for blok. Punkterne står i den rækkefølge Linn har prioriteret dem.

1. ~~Dagens lektion for medlemmer~~. **Udgår.** Samlingen `modulbrugerLektioner` er tom, funktionen er aldrig blevet brugt. Almindelige abonnenter skal ikke have lektioner.
2. ~~**Nyt svar fra Linn**~~. **Klaret 6. august** som del af "Til dig lige nu".
3. ~~**Adgang udløber**~~. **Klaret 6. august**, samme sted. Vises fra 14 dage før, og kun for kunder uden aktivt forløb.
4. ~~**Note fra Linn på forsiden**~~. **Klaret 9. august.** Vises som en talebobbel lige under "Til dig lige nu", i blomme, fordi den skal læse som et menneske og ikke som endnu en meddelelse fra appen. Den folder sig ikke sammen, for den er ikke en opgave hun kan gøre færdig. Noten lå allerede i det dokument forsiden hentede i forvejen, så den koster ingen ekstra læsning, se `hentDagensProgram`.
5. ~~Personlig coaching~~. **Udgår.** Linn har fravalgt linket.
6. ~~**Challenge**~~. **Klaret 9. august**, og datamodellen blev lagt om undervejs. Se afsnit 9.1.
7. ~~**Nul-dage i datostrimlen**~~. **Klaret 9. august**, og undervejs viste det sig at der lå en alvorligere fejl bagved. Se afsnit 9.2.
8. ~~**Spærring ved udløb af abonnement**~~. **Klaret 9. august.** Se afsnit 9.3.

**Hele listen er dermed klaret eller bevidst droppet.** Næste skridt er etape 4.

### 9.1 Challenge, som den ser ud nu

**Den lå forkert.** En challenge hørte til ét forløb, så et medlem der bare har købt appen kunne slet ikke få en. Linn bad 9. august om at kunne tildele den til Kickstart, til Kropsro og til medlemmer uden forløb.

**Nu ligger den for sig selv** i top-samlingen `challenges/{id}` og bliver tildelt, med samme sprog som master-programmerne bruger, se `tildelinger.ts`: `kunde`, `forlob` og `alle-app`. En challenge kan have flere modtagere på én gang.

**De gamle bliver liggende** under `forlob/{id}/challenges` og læses stadig af 3.0. Juni-challengens 28 indtastninger er urørte, og den gamle app opdager ingenting. Nye laves kun det nye sted. En ny slår en gammel, ellers ville de gamle blokere i al fremtid.

**Vær opmærksom på to ting:**

- Den gamle `hentChallenges` i `firestore/challenge.ts` læser kun de felter den kender, og `maal` er ikke en af dem. Derfor læser `firestore/challenge3.ts` dokumentet selv. Retter du noget her, så tjek at målet stadig kommer med.
- **Stillingen koster ét opslag pr deltager.** På et hold med 28 er det ingenting. Går challengen til alle med appen, ville det være 600 til 700 opslag hver gang en kunde åbner forsiden. Derfor hentes stillingen på forsiden kun når challengen går til et hold, ellers først når kunden selv trykker. Se `stillingPaaForsiden`. Lav ikke om på det uden at regne på hvad det koster.

**Målet** sættes pr challenge og er 50 hvis det ikke er sat. Baggrunden for tallet: challengen 1. til 7. juni 2026 havde 28 deltagere, højeste score 49, median 32, laveste 1. Ingen nåede 50 på en uge. Derfor skal målet kunne følge periodens længde, og derfor er det et felt og ikke et tal i koden.

**Stillingen viser de ti øverste plus kundens egen linje**, ikke alle. Og på forsiden nævnes hendes placering kun når hun er i den øverste tredjedel. Nummer 26 ud af 28 skal ikke mindes om det hver gang hun åbner appen. Det er et bevidst valg truffet sammen med Linn, ikke en mangel.

**Admin** ligger på `/ny/admin/challenges`. Der er med vilje intet menupunkt, for det ville kræve en rettelse i den gamle app.

### 9.2 Nul-dage, og fejlen der lå bagved

Opgaven på listen hed "nul-dage i datostrimlen", altså en visning. **Den egentlige fejl var langt værre.** 3.0 talte rene kalenderdage og kendte slet ikke til pause, så en Kropsro-kunde med 21 pause-dage fik **dag 63 hvor hun skulle have dag 42**. Tre ugers forkerte lektioner, forkerte små skridt og forkert refleksion. Og hendes forløb lukkede 21 dage for tidligt.

**Årsagen til den anden halvdel er værd at kende:** der findes **to funktioner med navnet `forlobSlutMs`**, en i `content/forlob.ts` der regner pause med, og en i `content/forlobAdgang.ts` der ikke gør. 3.0 brugte den forkerte. Falder du over et sluttidspunkt der ser en smule forkert ud, så tjek hvilken af de to der er importeret.

**Logikken ligger i `content/nulDage3.ts`**, læsningen i `firestore/nulDage3.ts`, og den kobles på i `adgang3.ts` gennem en valgfri parameter der er tom som standard.

**Tre ting der er bevidst besluttet:**

- **Kun Kropsro kan holde pause.** Linns beslutning 9. august 2026. En Kickstart-kunde må aldrig få sit dagnummer forskudt, heller ikke hvis der ved et uheld skulle ligge pause-data på hende. Der er en test på det.
- **Fremtidig ferie tæller forskelligt de to steder.** Den flytter **ikke** dagens dagnummer, for hun er der ikke endnu. Men den tæller **med** i slutdatoen, så kunden kan planlægge frem uden at datoen rykker sig under hende.
- **Går hentningen galt, viser vi forløbet uden pause** i stedet for ingenting. Så er dagnummeret det rå, altså som før rettelsen.

**Vær opmærksom på stien.** Pause-dagene ligger i `users/{uid}/products/{produkt}.nulDage.intervaller`. Det er `products`, ikke `userProducts`. En måling der ledte i `userProducts` gav et falsk nul og fik det til at se ud som om ingen kunder havde brugt nul-dage. De rigtige tal 9. august 2026: **12 af 615 kunder**, fra 1 til 21 dage, alle på Kropsro.

Verificeret mod virkeligheden samme dag: for alle 12 giver den gamle app og 3.0 nu præcis samme dagnummer. Der er også en unittest der sammenligner udfoldningen af intervaller direkte med den gamle apps `nulDageDatoer`, så de to aldrig kan drive fra hinanden.

**I strimlen** står pause-dagen med stiplet kant og teksten Pause. Stiplet fordi den skal se ud som *en anden slags dag*, ikke som en dag der bare er slukket. Den kan ikke trykkes, for der er intet indhold bag den.

### 9.3 Spærring ved abonnements-udløb

`adgang.harApp` blev regnet ud, men blev ikke brugt som port nogen steder. Adgangen lukker nu af sig selv.

**Porten ligger ét sted**, i `routes/ny/+layout.svelte`, og reglerne i `content/spaerring3.ts`. Læg den aldrig ud på undersiderne. Ét sted at kigge, og ingen bagdør.

**Reglerne, i den rækkefølge de afgøres:**

1. **Et aktivt forløb vinder over alt.** En kvinde midt i Kropsro spærres aldrig, heller ikke hvis abonnementet udløber undervejs. Hun har betalt for forløbet.
2. **Ingen slutdato er løbende adgang.** Fri- og manuelle konti. 7 af 178 abonnenter havde det 9. august 2026.
3. **Tre dages nåde** efter slutdatoen, fordi fornyelsen fra Simplero kan komme forsinket. Hun kommer ind og ser et bånd med hvor længe der er tilbage.
4. Derefter spærret, med et forny-link.

**Admin går uden om porten.** Ellers kunne en forkert dato på Linns egen konto låse hende ude af hendes eget værktøj.

**Målt før den blev bygget:** af 615 kunder ville **én** blive spærret, og hun havde ikke registreret et måltid i over en måned. Ingen aktiv kunde rammes. Aktivitet blev målt på måltider og ikke på login, fordi auth-datoen lyver for PWA-kunder.

**Tonen er med vilje.** Teksten er ikke en fejlmeddelelse, og båndet under nåden er honningfarvet og ikke rødt. Hun har ikke gjort noget forkert. Der står at hendes data ligger og venter, og at alt kommer tilbage når hun fornyer. Lav ikke om på det uden at tale med Linn.

### 9.4 30-30 beregneren, etape 4's første modul

**Moduler-fanen er udgået.** Den var en menu der førte til en menu, og alt
andet end Biblioteket kunne nås fra forsiden. **30-30 beregneren** har taget
dens plads i bundmenuen. Biblioteket er siden delt i to og navnet droppet,
se 9.22 og 9.23.

Den er **færdig og i brug** pr 11. august: oversigt med fire måltider og dagens
tal, måltidsskærm, "det du plejer", søgning, mængde med genveje og plus/minus,
fortryd, fjern, opskrifter, favoritter og egne fødevarer. **Madplanen er
parkeret**, ikonet er fjernet, motoren urørt.

**Læs SPEC afsnit 22 til 27 før du rører den.** Det er en fuld gennemgang af
det gamle Mad-modul, målinger på rigtige kundedata, og hver eneste beslutning
med sin begrundelse. Uden det bygger du på gæt, og det gjorde vi allerede i
fem runder mockups før gennemgangen.

**De tre målinger der ændrede designet mest:**

- **68,5 %** af alt kunderne registrerer er en gentagelse. Derfor er den
  hurtigste vej ikke bedre søgning, men at hun slet ikke skal søge
- **13 madvarer** på en almindelig dag, median. Derfor foldes måltiderne
  sammen til én linje
- **38 %** af dagene har en måltidstype der går igen. Derfor kan en plads
  rumme mere end én ting

### 9.5 Opskrift-listen, bygget 11. august

**Læs SPEC 26.6 før du rører den.** Her står kun det en ny person skal vide
med det samme.

**Gitteret er to i bredden** med farvet flise efter måltid og tre linjers
titel. Det **skifter ikke facon når hun søger**, der bliver bare færre fliser.
Linn afviste bevidst et forslag om at skifte til én i bredden ved søgning: et
layout der skifter under fingrene er forvirrende.

**Søgningen havde to fejl som begge er målt, ikke gættet:**

- **Flere ord gav nul.** Den gamle deler kun ved komma, så et mellemrum blev
  en del af ordet. Otte almindelige to-ords-søgninger gav ALLE nul træffere,
  fx "kylling broccoli" som der findes fire af. Nu deles der ved mellemrum og
  alle ord skal findes, uanset rækkefølge. Enkelt-ord giver præcis samme
  resultat som før, så intet forsvandt
- **56 % af alle træffere har ikke ordet i titlen.** "tomat" giver 35
  træffere hvoraf 31 kun har ordet i ingredienslisten. Derfor skriver hver
  flise hvorfor den kom med, fx "broccoli i ingredienser". Uden den linje
  ville over halvdelen af fliserne ligne en fejl

**Danske bogstaver foldes til ae, oe og aa. IKKE til a, o, a** som
`klientSoegeMatch` i admin gør. Med a/o/a ville "æg" blive til "ag" og ramme
bagt, mager og lagkage. Stavefejls-tolerance er bevidst fravalgt: høstakken er
hele ingredienslisten på flere hundrede tegn.

**Snack er sin egen kategori i 3.0.** Den gamle indlæser folder snack, salat
og dessert sammen til "andet", så 15 snack-opskrifter ikke kunne findes som
snack. Den gamle må ikke rettes, så `firestore/opskrifter3.ts` læser de samme
dokumenter på ny. Fordelingen er morgenmad 24, frokost 51, aftensmad 46,
snack 15, andet 8.

**Filtrene ligger i eget ark**, `OpskriftFiltre.svelte`. De lå først som tre
rækker knapper over listen og åd 215 px, altså over en fjerdedel af arket, før
den første opskrift kom til syne. Hovedet er nu 92 px.

**Måltidet er forvalgt ud fra skærmen hun kom fra.** Åbner hun listen inde fra
Frokost, står den på frokost. Fordi filtrene er skjulte, **skal**
begrænsningen kunne ses, og den vises tre steder: overskriften siger
"Opskrifter til frokost", filter-knappen bærer et tal, og "Vis alle 130" står
ved overskriften. **Fjern ikke ét af de tre uden at tænke over de andre.**

**Billederne blev flyttet ud af Firestore samme dag.** Samlingen gik fra 379
til 195 KB. Den gamle app henter de samme opskrifter i Biblioteket og 30-30-3,
så alle kunder fik den samme forbedring. Billeder ligger nu i Storage under
`opskrifter/`, dokumentet har `billedeUrl` og `billedeSti`, og reglen står i
`storage.rules`. Sikkerhedskopi af de gamle værdier ligger i `backup/`.

**Etape-hentning blev vurderet og fravalgt.** Efter flytningen var listen
hurtig nok. Firestore-klienten kan i øvrigt ikke hente et dokument uden ét
felt: man får hele dokumentet eller ingenting. Bygger du det alligevel senere,
så læs først hvorfor vi lod være, i SPEC 26.6.

**Kun 2 af 130 opskrifter har et billede**, og begge er frokost. Resten
lægges på fra admin-siden, se 9.6.

### 9.6 Billede-upload i admin, bygget 11. august

**Ny side på `/ny/admin/opskrift-billeder`.** Den gamle admin-side under
`app/admin/opskrifter` må ikke røres, og der står stadig at upload tilføjes
senere. Intet menupunkt, skriv adressen, samme løsning som challenges.

**To størrelser pr billede.** Flisen i gitteret er 62 px høj og 170 bred. At
sende et 1200 px billede til den er som at sende en plakat for at vise et
frimærke.

| | Bredde | Vejer | Felt | Bruges af |
|---|---|---|---|---|
| Lille | 480 px | ~17 KB | `billedeUrlLille` (nyt) | 3.0 fliserne i gitteret |
| Stor | 1000 px | ~38 KB | `billedeUrl` | 3.0 opskrift-arket og hele den gamle app |

Ved 130 billeder koster første skærm i listen 150 KB i stedet for 420, og hele
listen 2,2 MB i stedet for 9,1.

**Den store bliver liggende i `billedeUrl`, og det er ikke tilfældigt.** Den
gamle opskrift-side beder specifikt om 800 px, og dens liste viser billedet i
fuld bredde. Gjorde du det felt lille, ville **760 kunder i drift få slørede
billeder**. Det nye felt er additivt, og den gamle app opdager ingenting.

**Rækkefølgen er: se først, gem bagefter.** Billedet vises i flisens naturlige
størrelse, 170 × 62, så det kan opdages hvis hovedet på retten er skåret af.
Et stort billede ville skjule netop det. Fjern ikke den forhåndsvisning.

**Filerne uploades FØR dokumentet opdateres**, så en halv fejl efterlader det
gamle billede intakt og opskriften virker som før. Gamle filer slettes
bagefter, men kun hvis det nye filnavn er et andet.

**Én ret ad gangen.** Linns beslutning. Et forslag om at slippe mange filer og
gætte hvilken opskrift de hører til blev droppet, fordi gættet bygger på
filnavnet og en fotograferet ret hedder `IMG_4821.jpg`. **Genopfind det ikke
uden at spørge.**

**Bygget smalt først**, fordi billedet ligger i telefonen lige efter maden er
lavet. Bliver bredere på en laptop, se `@media (min-width: 720px)` i `ny.css`.

**To kendte kanter:**

- **HEIC fra iPhone kan ikke åbnes i Chrome på Mac.** Vælges billedet på selve
  telefonen, laver iOS det om til jpeg undervejs. Sker det alligevel, får man
  en besked der siger netop det, ikke en teknisk fejl
- **Ryddes URL-feltet i den GAMLE admin**, forsvinder den store men ikke den
  lille, og så viser 3.0 et billede hvor den gamle app ikke gør. Brug Fjern på
  den nye side i stedet, den rydder begge dele plus filerne

**De to billeder fra flytningen har kun den store udgave.** De markeres "kun
stor udgave" i listen. De virker, men fliserne henter 38 KB hvor de kunne nøjes
med 17. Det retter sig når billedet lægges på igen.

### 9.7 Opstarten, rettet 11. august om aftenen

**Baggrunden.** Linns telefon stod i over ét minut på logoet og "Et øjeblik". En gennemgang af hele opstarts-kæden fandt fem flaskehalse. Det gennemgående mønster: appen ventede på netværket, selv om svaret lå lokalt. Se fælde-afsnittet i 7.

**Fire af de fem ligger i den app der er i drift**, ikke i 3.0, og er derfor rettet gennem ventilen i `CLAUDE.md` regel 2, som selvstændige opgaver med eget go og egne commits. Der er syv commits i alt.

| Rettelse | Hvem rammes | Hvor |
|---|---|---|
| Tidsgrænse på app-skallen, 3 sek | Alle i drift | `service-worker.ts` |
| Skrifterne blokerer ikke optegningen | Alle i drift | `app.html` |
| Lagring kan ikke vælte en navigation | Alle i drift | `service-worker.ts` |
| Hurtig opstart, gamle app | Alle i drift, fra 12/8 | `routes/app/+layout.svelte` |
| Hurtig opstart, 3.0 | Kun `/ny` | `routes/ny/+layout.svelte` |
| `static/mockup` slettet, 808 KB | Alle i drift | `static/` |
| Én fejlet fil kaster ikke resten væk | Alle i drift | `service-worker.ts` |

**Den hurtige opstart i den gamle app blev rullet ud bag flag og er nu åben for alle.** Først kun admin og kunder med `ny-app`, og **åbnet for alle 12. august** efter et døgn uden problemer. Kontakten er én linje, `HURTIG_START_FOR_ALLE` i `content/hurtigStart.ts`, og der er en test der fælder hvis nogen vipper den uden at ville det. **Kontakten bliver stående**, så et problem kan rulles tilbage med den ene linje. De to sikkerhedsregler, altså aldrig uden kopi og aldrig en lukket dør, gælder uanset kontakten.

**Nye filer:**

| Fil | Hvad | Tests |
|---|---|---|
| `content/hurtigStart.ts` | Reglen og tidsgrænsen. Delt af begge apps | 16 |
| `content/hurtigStart3.ts` | 3.0's regel plus `opstartsBillede()` | 13 |
| `firestore/hurtigStart3.ts` | Læser hele opstarts-billedet lokalt | |
| `userDocCache.ts` | Læser bruger-dokumentet lokalt | |

`userDoc.ts` er bevidst urørt. Kopi-læsningen ligger i sin egen nye fil netop derfor.

**Udregningen af adgang og spærring er flyttet ud af 3.0's skal** og ind i `opstartsBillede()`. Reglerne er uændrede, linje for linje. Grunden er at kopien og serveren skal besvares med nøjagtig samme spørgsmål, ellers kan de to vise hver sin skærm.

**Det er ikke bekræftet på en rigtig telefon endnu.** Fem flaskehalse er fundet i koden og fjernet, men problemet er aldrig set ske under måling. Hænger den stadig, så mål i stedet for at gætte, og spørg først om skærmen er **helt blank**, altså skallen eller skrifterne, eller viser **logoet og "Et øjeblik"**, altså Firebase-kæden. Firebase Auth selv er ikke undersøgt.

### 9.8 Favorit på opskrifter, bygget 12. august

**Hun kan markere en opskrift med et hjerte og finde den igen på en egen fane.** Se SPEC 26.8 for hele gennemgangen. Her står kun det en ny person skal vide med det samme.

**Det startede et helt andet sted.** Spørgsmålet var hvordan en opskrift kunne gentages, fordi 30-30 hviler på at 68,5 % af alt der registreres er en gentagelse, og den regel slet ikke var anvendt på opskrifter. En måling på 9.347 måltider fra 204 kunder vendte samtalen:

- **62 %** af opskrift-registreringer er gentagelser. Mekanikken er altså sund
- **men opskrifter er kun 0,9 %** af alt der registreres, og kun **23 %** af kunderne har brugt én
- **86 % af kunderne har favoritter.** Det er den suverænt mest brugte hylde i modulet

Derfor blev genvejen bygget dér hvor kunden allerede er, og ikke som en femte plejer-flise. **Mål før du vælger, også når du tror du kender svaret.**

**En favorit er et BOGMÆRKE, ikke et gemt måltid.** Det er den vigtigste ting at forstå her. Et tryk åbner opskriften som i dag, så hun kan sætte portioner, og makroen læses fra opskriften når hun trykker "Læg i". Derfor skal protein og fiber ikke kopieres nogen steder hen. Havde vi gemt et færdigt måltid i stedet, ville favoritten logge 0 g protein, se fælden i afsnit 7.

**Bogmærkerne ligger i `userDoc.favoritOpskrifter`**, samme mønster som `favoritFodevarer` i den gamle app. Additivt, den gamle app læser det ikke, og der skal **intet udgives i Firebase Console**, for reglerne tillader det i forvejen.

**`lib/types.ts` er urørt**, selv om feltet er nyt. Feltet læses gennem `favoritterFra()`, så castet ligger ét sted og er testet.

**Nye filer:**

| Fil | Hvad | Tests |
|---|---|---|
| `content/favoritOpskrift3.ts` | Bogmærkerne, og hvilke opskrifter der er favoritter | 22 |
| `firestore/favoritOpskrift3.ts` | Skriver bogmærket | |

**Tre ting der er bevidst besluttet:**

- **Hjertet sidder ved "Læg i", ikke oppe i hjørnet.** Hånden er der i forvejen. Linns valg ud fra fire tegnede forslag
- **Måltids-forvalget gælder BEGGE faner.** Linns valg, hvor hun vendte forslaget om at favoritter skulle vises på tværs. Det skabte en tilstand hvor hun kan have seks favoritter og se en tom skærm, og derfor er "Vis alle N" og et antal i den tomme tekst nødvendige. Uden dem modsiger tallet på fanen skærmen
- **Fanen er et filter, lagt først**, ikke en anden liste. Derfor virker måltid, kost og søgning ens på begge faner uden at kende til fanerne

### 9.9 Portioner og makro på opskrifter, rettet 12. august

**Det eneste sted hvor de to apps skrev forskellige tal i kundens dagbog for den samme handling.** Se SPEC 26.9 for hele gennemgangen med målingerne.

**Reglen, i én sætning:** `defaultPortioner` bruges på **ingredienserne** og **ALDRIG** på makroen. Makroen er pr portion, også på de retter der er skrevet til fire.

Reglen var spredt ud over tre skærme i to apps, og de var uenige. På de 122 opskrifter der står til én portion gav det samme svar, for at dele med 1 ændrer ingenting. På de 8 der står til 2, 4 eller 12 gav det svar der lå 2, 4 og 12 gange fra hinanden. **En kunde fik krediteret 12 g protein hvor hun spiste 48.**

**Regnereglen ligger nu ét sted**, `content/opskriftPortion3.ts`, med målingerne i filens hoved så den næste ikke skal regne det ud forfra.

**3.0 er rettet. Den gamle app er ikke.** Se ventelisten i SPEC efter afsnit 27.

**Fire ting kom med samme dag:**

- **Arket åbner på opskriftens eget tal**, altså 1 for de 122 og 4 for familieretterne. Skruer hun ned, regner alt sig om. Gem-knappen siger antallet når det ikke er 1, for starttallet er også dét der gemmes
- **Alle fem tal vises og gemmes.** Kulhydrat og fedt dæmpet på linjen, kalorier under, skjult uden udvidet næring. `gemSammensat` gemte før kun protein og fiber og brød dermed reglen i SPEC 26.5 som resten af modulet fulgte
- **Makro-linjen er klippet ud af fremgangsmåden.** Data er urørt, se nedenfor. Tiden trækkes ud og vises ved titlen
- **Trinnene står hver for sig.** Opskrifterne er ikke skrevet ens, så der deles på numrene og ikke på linjeskift

**Nye filer:**

| Fil | Hvad | Tests |
|---|---|---|
| `content/opskriftPortion3.ts` | Portioner og makro. Regnereglen | 14 |
| `content/opskriftTekst3.ts` | Fremgangsmåde, trin og tilberedningstid | 20 |

**Én rigtig datafejl fundet og rettet:** "Den grønne grød - isterninger" havde hele holdets makro stående som om det var pr terning, så 3.0 viste 144 g protein og 4.800 kcal ud for 75 g avocado. Rettet i data efter tørløb, sikkerhedskopi i `backup/`.

### 9.10 Faste måltider, bygget 12. august

**Hun kan gemme det måltid hun lige har tastet, og lægge det i igen med ét tryk.** Det den gamle app kalder "byg måltid". Se SPEC 26.10 for hele gennemgangen med målingerne. Her står kun det en ny person skal vide med det samme.

**Det hedder Faste måltider og ikke favoritter**, selv om det ligger i den gamle samling `favoritmaaltider`. Ordet favorit er reserveret til hjertet på en opskrift, se 9.8. De to ting er ikke det samme og må ikke hedde det samme: et bogmærke ligger på `userDoc.favoritOpskrifter`, et fast måltid er varelinjer i `favoritmaaltider`.

**Målingen på alle 616 kunder 12. august:** 2.905 faste måltider hos 365 kunder, altså 59 %. Median 5 varelinjer, men 33 % har kun én. 76 % bruges altid til det samme måltid, og 48 % af al brug er morgenmad. Kun 3 % er nogensinde blevet redigeret, og det er derfor der ikke findes en redigér-skærm.

**Fire ting der er bevidst besluttet:**

- **Knappen står OVER den første ingrediens**, ikke under listen. Linns valg, og begrundelsen er god: ligger den under, falder den uden for skærmen så snart måltidet fylder noget, og en knap man skal rulle efter bliver aldrig brugt
- **Et fast måltid må gerne være én madvare.** Linns valg, som vendte forslaget om at skjule de 945 med kun én linje
- **Det lægges i som én linje pr madvare**, ikke som én samlet. Se nedenfor, det er den vigtigste
- **Retter hun i det bagefter, spørger et blødt bånd** om det faste måltid skal opdateres. Ikke en pop-up, for den ville lægge sig hen over kvitteringen med Fortryd

**Den vigtigste ændring, og hvorfor.** Før i dag lagde 3.0 en favorit i som ÉN linje med de fem tal lagt sammen. Det havde tre følger: hun kunne ikke fjerne én enkelt ting, en linje uden makro talte lydløst nul, og **"Det du plejer" lærte ingenting**. Brugte hun genvejen hver morgen, blev hendes fire fliser ved med at være tomme, fordi de tæller `foodId` og den samlede linje ikke har nogen.

**Tre fælder du skal kende, hvis du retter noget her:**

- **En linje uden `foodId` kan ikke gemmes.** En opskrift har ingen enkelte varer at slå op. Arket siger det højt i stedet for at droppe linjen i stilhed. Det er samme fejl som de 178 af 2.905 i drift, hvor kunden logger mindre end hun spiste
- **`foerIds` husker hvad der lå i måltidet FØR hun lagde det faste måltid i.** Uden dem ville en æggemad hun tastede i forvejen blive regnet som en del af hendes morgengrød
- **Er en madvare forsvundet fra databasen, holder vi slet ikke øje.** Ellers ville båndet spørge med det samme om hun ville gemme måltidet uden den linje, og et ja ville klippe hendes eget faste måltid ned

**Båndet spørger én gang og standarden er at der ikke sker noget.** De fleste ændringer er engangs-ting. Hun har ikke flere blåbær i dag, men i morgen har hun. Et "opdatér" der lyser mest ville langsomt tygge hendes eget faste måltid i stykker. Vi holder desuden kun øje så længe hun bliver på skærmen.

**Måltidstypen er et nyt felt**, og de 2.905 fra den gamle app har det ikke. Derfor gættes den ud af hendes egen historik. Det rammer som regel, fordi tre ud af fire altid bruges til det samme måltid.

**Der skal intet udgives i Firebase Console.** Reglerne tillader det i forvejen, se `firestore.rules` linje 62.

**Nye filer:**

| Fil | Hvad | Tests |
|---|---|---|
| `content/fasteMaaltider3.ts` | Reglerne, sorteringen og båndets betingelse | 36 |
| `firestore/fasteMaaltider3.ts` | Læsning og skrivning | |
| `components/ny/FasteMaaltiderArk.svelte` | Hylden | |
| `components/ny/GemFastMaaltidArk.svelte` | Gem-arket | |

`plejer3.ts` fik et frivilligt `dato`-felt på historikken, så en hel dags måltid kan lægges sammen uden at hente de 45 dage en gang til.

### 9.11 Mine opskrifter, bygget 12. august

**Kundens egne opskrifter, altså dem hun har fotograferet og faaet AI'en til at laese.** De lå i den gamle app og fandtes slet ikke i 3.0. Se SPEC 26.11 for hele gennemgangen. Her står kun det en ny person skal vide med det samme.

**Det blev opdaget fordi Linn spurgte.** SPEC afsnit 23 havde noteret at de skulle have enten en plads eller et bevidst nej, og de havde fået ingen af delene. Der kan ligge flere af den slags på den liste.

**Målingen 12. august:** 222 egne opskrifter hos 53 kunder, altså 9 %. Men hos dem der har dem, er **9 % af alt de taster en egen opskrift**, mod 0,9 % for hele Linns bibliotek. Hendes egne bruges cirka ti gange så meget. Alle 222 har et foto, af Linns 130 har 2.

**Fanen findes kun når hun har mindst én.** De 91 % der ingen har, ser præcis det de så før.

**Kategorierne er de samme fem som på Linns opskrifter og ligger i samme feltform.** Derfor løber hendes egne gennem præcis den samme søgning og de samme filtre, uden en eneste undtagelse i filter-koden. Kunden sætter selv måltidet, hun må vælge flere, og hun kan rette det bagefter. Linns beslutninger 12. august.

**DEN VIGTIGSTE REGEL: en opskrift uden måltid vises ALTID**, uanset filteret. De 222 fra den gamle app har intet måltid og kan ikke få et af sig selv. Faldt de ud af filteret, ville hendes egen mad forsvinde fordi hun aldrig er blevet bedt om at udfylde et felt. Undtagelsen ligger ét sted, i `filtrerMine`, og der er test på den.

**Makroen er PR PORTION og ganges. `antalPortioner` må ALDRIG bruges på den**, kun på ingredienserne. De to skalerer derfor hver sin vej på skærmen. Det er samme regel som på Linns opskrifter, se 9.9.

**Der skal intet udgives i Firebase**, hverken regler eller Storage-regler. Alt er dækket i forvejen. **Og AI-motoren findes allerede** som `/api/analyser-opskrift`, som 3.0 bare kalder.

**Bygget i tre bidder samme dag:** finde og logge, så rette og slette, så oprette med kamera og AI.

**`RetOpskriftArk` bruges TO steder:** når hun retter en opskrift hun har, og når hun gennemgår det AI'en har læst af et billede. Derfor arbejder den på et udkast og ikke på dokumentet. Retter du noget der, så husk at det rammer begge veje.

**Hun gennemgår altid AI'ens svar før der gemmes.** Et gæt der lander direkte i dagbogen uden at hun har set det, ville være den forkerte slags automatik i et modul der handler om præcis to tal.

**Alt hvad AI'en svarer læses defensivt**, se `fraAiSvar`. Svaret er skrevet af en model og ikke af vores kode, og hun har lige taget et billede hun ikke vil miste. Der er tolv tests på netop de tilfælde.

**Billedet lægges op FØR dokumentet skrives.** Den omvendte rækkefølge ville give en halv opskrift uden billede.

**Hun kan tage et foto af RETTEN til flisen, og det erstatter ikke opskrift-fotoet.** `billedeUrl` er kogebogssiden AI'en læste, og da der ikke gemmes nogen fremgangsmåde er det hendes eneste opskrift på hvordan retten laves. Fotoet af maden ligger derfor i `madBilledeUrl` med sine egne felter, i to størrelser. Flisen tager madfotoet, så opskriftfotoet, så bogstavet.

**Nye filer:**

| Fil | Hvad | Tests |
|---|---|---|
| `content/mineOpskrifter3.ts` | Måltider, filtrering, portioner, makro, udkast, AI-svaret og billederne | 66 |
| `firestore/mineOpskrifter3.ts` | Læsning, måltider og sletning | |
| `components/ny/MinOpskriftArk.svelte` | Arket | |

**Test-data:** `test-medlem@linnsacademy.dk` har tre opskrifter hvis id starter med `test_`. De dækker de tre tilstande: med foto og måltid, uden måltid, og uden foto. Slet dem når de ikke skal bruges mere.

### 9.12 Egne fødevarer og de sidste huller i Mad, 12. august

**Hun kan nu lave sine egne fødevarer i 3.0.** Før kunne hun kun se dem. Se SPEC 26.12 for hele gennemgangen.

**To veje ind, og den anden findes ikke i den gamle app:** en knap i Mine-arket, og en når søgningen ikke finder noget. Den sidste er den vigtigste, for det er dér hun står i stå med varen i hånden. Ordet hun søgte på følger med ind i navnefeltet.

**Tallene er PR 100 G, og det står tre steder.** Står det ikke på skærmen, taster hun tallene for hele pakken.

**Mængde-arket åbner af sig selv når hun har gemt en ny.** Slagsen er forvalgt til Andet så hun kan springe den over, og hun kan sætte flueben ved at det er noget man drikker, så deciliter virker.

**Retter hun en vare hun allerede har brugt, ændres hendes gamle registreringer ikke.** Hvert måltid gemmer sine egne tal. Der står bevidst ingenting om det på skærmen.

**Hun kan også rette mængden på en linje hun har tastet**, se SPEC 26.13. Et tryk på linjen åbner mængden. Vi opdaterer det samme dokument, så linjen bliver liggende hvor den står.

### 9.13 Tre bevidste nej i Mad, så de ikke tages op igen

**Stregkode-scanneren: nej.** De 49 varer i den fælles fødevare-samling ligner scanninger, men **kun 3 har en rigtig stregkode**. De øvrige 46 er tastet manuelt. Scanneren er brugt tre gange i appens levetid. Delene findes hvis den skal bygges en dag, se SPEC 26.14.

**Kopiér et måltid til en anden dag: nej.** Faste måltider gør det bedre.

**Rediger et helt måltid: nej.** I 3.0 er hver madvare sin egen post, så der er ikke noget måltid at redigere.

**Og en regel fra Linn 12. august:** en fødevare kunden opretter eller scanner må **kun kunne ses af hende selv**. Kilden er allerede lukket, `gemCommunityFodevare` kaldes ikke længere. De 49 gamle blev gennemgået, og tre blev rettet efter Linns go, med sikkerhedskopi i `backup/`. Historikken blev ikke rørt. Se SPEC 26.14.

### 9.14 Hjertet og søgningen, 12. august

**Hjertet på en fødevare er bygget.** Jeg troede den var dobbeltarbejde ved siden af Det du plejer, og målingen viste at det passer ikke: kun 18 % af de hjertede ville stå på fliserne. Fliserne viser fire pr måltid, og kunden har median 13 hjerter. Se SPEC 26.15.

**To regler du ikke må bryde, begge med test:**

- **Hendes EGNE fødevarer holdes UDE af hjerte-gruppen.** 72 % af de 6.855 hjerter er varer hun selv har oprettet, sat automatisk af den gamle app. De står i forvejen under Mine egne, og uden filteret ville halvdelen af listen være en kopi af den anden halvdel
- **3.0 sætter ALDRIG hjertet automatisk.** Gør vi det, fyldes listen igen med noget hun ikke har valgt, og så er tallet ubrugeligt næste gang nogen måler

**Søgningen i fødevarer kan nu to ting mere.** Hele ord kommer først, så "æg" ikke drukner i Æggenudler. Og to ord virker, delt ved mellemrum eller komma. Begge dele er fejl vi har set før i opskrifterne, se 9.5. Den gamle apps afkryds "Kun hele ord" blev bevidst ikke kopieret: sortering skjuler ingenting, hvor afkrydset er enten eller. Se SPEC 26.16.

### 9.15 Måltidsskærmen lagt om, og hvor opskrifterne kommer fra

**Måltidsskærmen gik fra ni lag til fire**, se SPEC 26.17. Alt det der tilføjer noget ligger nu i ét ark bag knappen "Tilføj til morgenmaden". Arket er en fordeling og ikke et sted hun bliver: vælger hun noget, lukker det. Prisen er ét tryk mere på den vej der bruges mest, og det er derfor det skal mærkes på en telefon og ikke regnes ud.

**Hjertet betyder nu kun ét: et bogmærke.** Faste måltider har fået en tallerken. Stjernen på en madvare er blevet et hjerte i samme blomme som på en opskrift. "Mine" hedder nu "Mine madvarer".

### 9.16 LÆS DEN HER FØR DU REGNER PÅ EN OPSKRIFT

**Der findes ikke ét målt tal i Linns opskrifter.** Se SPEC 26.18 for hele gennemgangen. Kort:

- Opskrifterne blev fundet på navngivne danske sider: Valdemarsro 23, I Form 9, Spis Bedre 8, Arla 6. Kilde-linjen blev senere fjernet fra data
- **CSV-kolonnerne hedder "Estimeret protein", "Estimeret fiber", "Estimeret kalorier".** Makroen har aldrig været målt
- **820 ingrediens-mængder blev gættet af AI** i maj, se `estimater-opskrifter-mangder.json`
- Kulhydrat og fedt blev beriget med AI 24. maj

**Mængderne er ét estimat og makroen et andet, lavet uafhængigt med en måneds mellemrum.** Det er hele forklaringen på at de ikke går op.

~~**PRØV IKKE at koble ingredienser til fødevare-databasen for at verificere makroen.**~~ **Det råd gælder ikke længere. Koblingen ER bygget 13. til 15. august, og den virker. Se 9.17.** Advarslen stod her fordi fire forsøg var slået fejl, og de slog fejl af én grund: navne blev matchet for løst, så tørre linser blev koblet til kogte. Det er løst ved at tilstanden nu står på navnet.

**Sammenlign kalorier med varsomhed.** De skrevne er AI-estimerede, og 22 af dem stemmer ikke med deres egen makro.

**Det ene der KAN rettes billigt:** 35 opskrifter siger ikke om linser, kikærter og bønner er tørre eller kogte. Forskellen er en faktor tre. Kalkun-rugbrødet skriver "afdryppede", resten skriver ingenting.

**Rækkefølgen er ikke til forhandling:** skal makroen en dag regnes af ingredienserne, skal bælgfrugt-ordet ind FØRST. Ellers bages tvetydigheden ind i de nye tal.

**Der rettes ikke bagud i kundernes dagbøger.** Linns beslutning 13. august. 8 registreringer hos 7 kunder har for lidt protein som følge af den fejl der blev rettet samme dag, men de bliver stående. Det er kundernes egen dagbog. Kilden er lukket, så tallet kan ikke vokse. Se SPEC ventelisten punkt 3.

**Bælgfrugt-ordet ER sat ind 13. august**, 38 linjer på 35 opskrifter, sikkerhedskopi i `backup/`. Reglen var: røde linser er altid tørre, koges de i opskriften er de tørre, ellers er 100 g eller mere en dåse.

**Portionstallet ER rettet 13. august**, efter at den gamle apps deling blev fixet. De seks står nu på 2, sikkerhedskopi i `backup/opskrifter-portionstal-foer.json`. Ørred-opskriften hænger endelig sammen.

**Og opskrift-arket i 3.0 åbner nu ALTID på én portion**, se SPEC 26.9 som er omgjort. Det gælder også de otte familieretter, der før åbnede på 4. Spørgsmålet er "hvor meget spiste du", og starttallet er også dét der gemmes.

**Pas på `startPortioner`.** Den gjorde før TO ting: hvad arket åbner på OG hvad ingredienslisten er skrevet til. Da den blev sat til altid at give 1, blev 600 g kylling i en ret til fire til 2.400 g. De to hedder nu `startPortioner` og `listenErSkrevetTil` og må aldrig smelte sammen igen.

Den oprindelige advarsel, som nu er historik: ~~portionstallet må ikke rettes endnu.~~ Seks opskrifter rækker til to personer. Sættes de til 2, viser den GAMLE app 16 g protein i stedet for 32, fordi den deler makroen med portionstallet. Og 3.0 ville logge 64, fordi arket åbner på opskriftens eget tal. **De to apper ville tage fejl i hver sin retning.** Først skal punkt 1 på ventelisten rettes.

### 9.17 REGNEMASKINEN, bygget 13. til 15. august

**Opskrifternes makro regnes nu ud af ingredienserne i 3.0.** Det er den største enkelt-ting i Mad, og den ophæver advarslen i 9.16.

**Hvorfor den skulle bygges:** kunder vil kunne bytte ris ud med kartofler. Det kan kun lade sig gøre hvis hver ingrediens har sit eget tal. Man kan ikke trække ris fra et samlet tal man ikke ved hvordan er sat sammen.

#### Fire filer, fire etaper

Hver har sine tests. Læs dem i rækkefølge, de bygger ovenpå hinanden.

**`content/enhedsvaegt3.ts`** oversætter husholdningsmål til gram. 1 spsk er 15 ml, 1 tsk er 5 ml, men vægten afhænger af hvad der ligger i skeen. Styk-vægtene er **DTU Fødevareinstituttets officielle tabel** fra fooddata.dk, mellem-størrelse og netto. Tørre varer målt i dl vejes efter massefylde og ikke som vand.

**`content/ingrediensNavn3.ts`** samler 402 skrevne navne til 291 kernenavne. Olivenolie stod på seks måder, mandler på syv. **Den vigtigste regel i hele filen:** ordene tør, kogt og afdryppet bliver PÅ navnet for bælgfrugter, ris og korn. Tørre grønne linser har 20,5 g protein, afdryppede har 5,7. Slås de sammen, bliver makroen fire gange forkert. Der er en test der fejler hvis nogen gør det igen.

**`content/ingrediensKobling3.ts`** går fra kernenavn til fødevare. Kun hele ord, aldrig stumper, så ærter ikke rammer kikærter. Et sundhedstjek afviser varer hvis kalorier ikke passer med deres egen makro.

**`content/opskriftMakro3.ts`** er selve regnestykket, plus `visMakro` der vælger mellem beregnet og skrevet tal.

#### Hvor tallene ligger

**Alt nyt ligger i samlingen `ingrediensKobling`, aldrig i opskrifterne.**

```
ingrediensKobling/koblinger    297 koblinger fra kernenavn til foedevare
ingrediensKobling/beregninger  133 opskrifters beregnede makro pr portion
```

**Opskrifter og fødevarer er ikke rørt af regnemaskinen.** Hele samlingen kan slettes uden spor. Det var Linns regel 13. august, og den skal holdes.

#### Hvordan 3.0 bruger dem

Overlejringen sker i **`hentOpskrifter3`**, altså helt inde i kilden. Så findes der ikke et sted i 3.0 hvor det gamle tal kan slippe igennem. Listen, opskrift-arket og det der gemmes i kundens måltid viser alle det samme.

**Er dækningen under 90 procent, falder den tilbage på det skrevne tal.** Bruges ikke i dag, men står klar til nye opskrifter uden koblinger.

**Mangler en fødevare sit kalorietal**, bruges beregnet protein men skrevet kalorietal. Uden det gav en omelet 27 g protein og 130 kalorier, hvilket er umuligt.

#### Den gamle app er urørt

**De 760 kunder ser præcis det samme som før.** Den læser videre fra instruktioner-teksten, som ikke er ændret. **Det er en åben tråd**, se nedenfor.

#### 15 tal er slået op udenfor databasen

Databasen manglede dem. Hver har **kilde og dato** gemt i koblingen, og alle er kontrolleret med Atwater, altså at kalorierne passer med varens egen makro.

Ørred, torskefars, fiskefars med laks, tomatsauce, fuldkornspasta, fuldkornslasagneplader, proteinpasta, fuldkornsnudler, ærteskud, chiliflager, jalapeño, nori, vaniljepulver, gul karrypasta og hvide bønner på dåse.

**To ting der bider ved opslag udefra:** amerikanske kilder opgiver kulhydrat INKLUSIVE fibre, mens vores database bruger uden. Og vaniljeEKSTRAKT har 288 kalorier fordi det indeholder alkohol, mens vaniljePULVER har 250. Begge fejl blev fanget af Atwater-tjekket.

#### To admin-sider

**`/ny/admin/ingredienser`** er koblingerne. De hyppigste først, med bud fra databasen.

**`/ny/admin/opskrift-makro`** viser regnestykket linje for linje. **Det er her du går hen når et tal ser forkert ud.** Fold opskriften ud, og der står hvilken fødevare hver linje bruger og hvad den bidrager med.

#### Hvad tallene viser

De skrevne tal i opskrifterne er **runde måltal, ikke udregninger.** 80 procent af kalorietallene ender på nul, og 64 af 130 har enten 28, 30, 32 eller 34 g protein. De blev skrevet efter konceptet, ikke efter maden.

**Retterne indeholder som regel mere end der står.** Protein 14 procent, fiber 40 procent, kalorier 20 procent i gennemsnit.

#### FÆLDEN DER KOSTEDE MEST: portionstallet

**Linsegryde med kylling stod 103 procent forkert. Årsagen var ikke regnemaskinen, men at retten er til to personer og stod som én.** Sat til 2 rammer den 32,4 mod de 32 der står, altså under én procent fra.

**Se efter portionstallet FØR du mistænker beregningen.** Det er den enkelte ting der forbedrer tallene mest. Der står i dag 14 opskrifter med mere end én portion, og vi fandt to der manglede 15. august. Der er formentlig flere.

#### Fejl jeg selv lavede, så du ikke gentager dem

**Gæt aldrig et foodId eller et kernenavn. Slå det op.** Bulgur blev til chiafrø, brune ris til plantemargarine, pastinak til sød kartoffel og revet ost var lige ved at blive røget skinke. Alle fanget af tørløb, men tørløbet skal ikke være sikkerhedsnettet.

**Erstat aldrig en vare med en anden uden at sige det.** Ørred blev til laks, 92 kalorier for meget per 100 g. Pastinak fandtes i databasen hele tiden, min søgning fandt den bare ikke.

**En manglende kobling kan Linn se. En forkert kan hun ikke.**

---

### 9.18 TRÆNING, bygget 15. og 16. august. Modulet er færdigt

**Hele modulet er lavet om fra bunden.** Det er den største enkelt-ting siden
regnemaskinen. Seks bidder plus AI-værktøjet er bygget, tegnet og godkendt hver for sig,
og der er en snes beslutninger bag. **Læs SPEC-3.0.md afsnit 29 før du rører noget.**
Her står kun det en ny person skal vide med det samme.

#### Hvad der var galt

Programmerne lå tre steder, og to af dem var bundet til enten et forløb eller
et abonnement. Dagen blev regnet ud på tre forskellige måder. Fremgangen lå
fem steder. Og der var **fire næsten ens afspillere på cirka 1.400 linjer
hver**, én for abo, én for forløb, én for master og én for byg-eget.

#### Hvad der er nu

Programmerne ligger ét sted, `traeningsprogrammer3`, og er uafhængige af
kundetype. Linn bygger dem selv i admin og tildeler dem til et hold, en
person, alle medlemmer eller alle. Kunden vælger sit udstyr, ser kun de
programmer der passer, og træner i **én** afspiller.

Får hun lov, bygger hun også sine egne. De ligger under hende selv, men har
**præcis samme form som Linns**, så afspilleren, fremgangen og listen virker
på dem uden en eneste ny regel.

**Alt nyt er nye samlinger som kun 3.0 læser.** Den gamle app kender ingen af
dem, og de 760 kunder i drift mærker ingenting.

#### Fem ting der er dyre at genopdage

**DET HEDDER TRÆNING, IKKE DAG.** Ordet betød to forskellige ting: dag 15 i et
forløb, som er en rigtig kalenderdag, og dag 5 i et program, som bare er
femte gang hun træner. Nu er de adskilt. Feltet hedder stadig `antalDage` i
databasen, og undersamlingen hedder `dage`, men **brug `antalTraeninger3()` i
UI-kode** så ordet ikke sniger sig tilbage på skærmen.

**Dagen rykker først når hun har trænet**, ikke når kalenderen skifter. Det
gælder også forløbskunder, og det er en ændring i forhold til den gamle app.
Springer hun ti dage over, står hun stadig på træning 4.

**En tildeling gælder ÉT bestemt hold.** Det var Linns valg, og prisen er
reel: **hvert nyt hold starter på nul.** Derfor findes `/ny/admin/traening/hold`,
der viser tomme hold øverst og med farve, og derfor findes knappen der
kopierer et tidligere holds tildelinger over.

**En tom udstyrsliste betyder at hun ser alt.** Spørgsmålet stilles i
onboarding, som ikke er bygget, så ingen kunde har valgt endnu. At skjule
hendes træning fordi hun ikke er blevet spurgt ville være at straffe hende
for noget vi ikke har bygget.

**`programmerForKunde3` bruges BEGGE steder**, både af admin-opslaget og af
kundens egen liste. Det er med vilje. To udgaver af den regel ville drive fra
hinanden, og så ville admin sige noget andet end kunden oplever. Retter du
noget i filtreringen, retter du begge skærme på én gang, og det er meningen.

**HENDES EGNE PROGRAMMER KENDES PÅ ID'ET.** De har præfikset `egen_`, og
`hentProgramMedTraeninger3` er det ene sted der ser på det og henter det
rigtige sted fra. Både program-siden og afspilleren går gennem den. Uden
præfikset skulle hver skærm slå op to steder for at finde ud af hvad den
havde med at gøre. Hendes egne har `kategoriId: ''` og `egen: true`, så
udstyrs-filteret springer dem over: hun har selv valgt øvelserne.

#### Reglerne i Firebase

Tre nye samlinger. Programmer og kategorier må alle indloggede læse, kun admin
skriver. **Tildelingerne er delt i to**, og det er vigtigt: rækker til et
hold, til medlemmer og til alle må enhver læse, men en række til én person
indeholder hendes navn og må kun læses af hende selv. Derfor henter kunden
med to snævre forespørgsler, se `hentMineTildelinger3`. Et enkelt kald efter
hele samlingen bliver afvist, og det er meningen.

Dertil `users/{uid}/mineTraeninger3`, udgivet 16. august. Hun skriver selv,
admin må også læse, så Linn kan hjælpe hende i kunde-opslaget.

#### Hun bygger sit eget, bygget 16. august

Tre skærme under `/ny/traening/byg-eget`: opret, ret programmet, ret én
træning. Adgangen styres fra `/ny/admin/traening/byg-eget` og tjekkes på alle
tre plus på program-siden og i afspilleren, ikke kun på knappen i listen.

Fire ting der er dyre at genopdage:

- **Ingen adgang giver ingen knap**, ikke en grå boks der forklarer hvad hun
  ikke må
- **Tages retten fra hende, bliver programmerne skjult, ikke slettet.** Får
  hun retten igen, er de der stadig
- **Hun ser kun øvelser hendes udstyr dækker**, se `oevelserTilKunde3`. Der
  er med vilje ingen "vis alle"-knap som admin har
- **Der er ingen grænse** på antal træninger eller øvelser. Linns valg.
  Tiden står nederst i stedet

#### AI-værktøjet, bygget 16. august

To veje. `/ny/admin/traening/ai` bygger et nyt program, `/ny/admin/traening/[id]/ai`
retter et der findes. Endpointet er `/api/traening-ai`, kun admin, Opus 5.
**Læs SPEC 29.10 før du rører det.**

Fem ting der er dyre at genopdage:

- **AI'EN MÅ ALDRIG FINDE PÅ EN ØVELSE.** Puljen sendes med, prompten siger
  at der kun må vælges derfra, og svaret valideres i `rensSvar3`. Alt der
  ikke findes i banken, smides væk. En opfundet øvelse har ingen video, og så
  står kunden med en tom skærm midt i en træning
- **Sætningen oversættes til dage FØR der ringes nogen steder hen**, i
  `dageFraSaetning3`. "Uge 3" bliver til dag 15 til 21. Kan det ikke regnes
  ud, stiller skærmen selv spørgsmålet, uden at bruge et kald. Der sendes
  højst 14 dage ad gangen, for 84 dage kan ikke sendes afsted hver gang hun
  skriver en sætning
- **AI'en skriver højst 14 dage.** Er programmet længere, designer den en
  skabelon, og `udfoldDage3` fordeler den. Beder man en model skrive 84 dage
  i ét svar, bliver de sidste tredive sjuskede
- **`gemUdvalgteDage3` skriver kun de rettede dage**, men regner tælleren
  over tomme dage ud af HELE programmet. Ellers ser et 84-dages program
  næsten færdigt ud efter en rettelse af én uge
- **Admin har sin egen daglige tæller på 60.** Kundernes 20 er urørte og
  deler ikke tæller med den

#### Det der mangler

- **De gamle programmer bliver IKKE kopieret over.** Linns valg 16. august.
  Programmerne bygges forfra i det nye værktøj. Originalerne bliver liggende
  urørte, så beslutningen kan tages om. Diagnosen af hvad der faktisk ligger,
  altså 19 programmer hvoraf kun 13 er forskellige, står i SPEC 29.9
- **AI-samtalerne slettes ikke automatisk.** De ligger i
  `traeningAiSamtaler3` med et `udloeberAt` en måned frem, men der er ikke
  noget der rydder op. Det kræver en TTL-regel i Firebase Console eller et
  lille script

#### DET VIGTIGSTE FØR ET HOLD FLYTTES TIL 3.0

Forsidens træningsflise læser nu den nye model. **En kunde får ingen
træningsflise før hun har fået et program tildelt i det nye system.** Det
gælder også det første Kickstart-hold.

Programmerne skal derfor være **bygget og tildelt** før et hold flyttes over.
De gamle kopieres ikke, det droppede Linn 16. august, så der er ikke en
genvej. Bliver det glemt, starter et helt hold uden træning.

**Og kunderne starter på træning 1.** Der er ingen fremgang at tage med fra
den gamle app, så en Kropsro-kunde midt i sit forløb begynder forfra. Det er
accepteret, se SPEC 29.9.

### 9.19 BESKEDER, lagt sammen 16. august

**Linn AI og Beskeder til Linn er nu én side med to faner.** Linns
beslutning: det er det samme i hendes verden. **Læs SPEC afsnit 30** før du
rører noget. Her står kun det en ny person skal vide med det samme.

**Ordet Snak er droppet.** Siden hedder Beskeder, det gør fanen i bundmenuen
også, og fanerne inde på siden hedder Linn AI og Linn. `/ny/snak` er nedlagt
og sender videre, med fanen i behold, fordi der ligger links til den i
kundernes browser-historik.

#### DET VIGTIGSTE: adgangen ligger i 3.0, ikke i det delte skema

**Reglen står i `content/beskedside3.ts` og er to linjer.** Alle kan skrive
til Linn AI. Kun kunder på et forløb kan sende videre til Linn, og et bygget
forløb som SommerRo tæller med.

**Rør ikke adgangs-skemaet for at ændre det.** Det live skema siger nej til
Linn AI for Kickstart og nej til skriv-til-Linn for fleksible forløb. Skulle
3.0 følge det, skulle to flueben ændres, **men skemaet styrer også den gamle
app**. De to flueben ville give 6 Kickstart-kunder Linn AI og 11
SommerRo-kunder en Skriv til Linn-fane i den app der er i drift, samme dag.
Linns besked 16. august: hold det uden om den gamle app.

Konsekvensen skal kendes: **ændrer Linn skemaet, sker der ingenting i 3.0.**

#### Fire ting der er dyre at genopdage

**Vejen ind til Linn går gennem AI'en.** Der findes intet skrivefelt på fanen
Linn. Hun spørger AI'en, og er hun ikke tilfreds, sender hun netop det
spørgsmål videre. Bygger du et skrivefelt ind igen, ryger hele reglen.

**Send videre gemmer det par hun kigger på**, ikke det sidste i tråden.
Ruller hun tilbage til et svar fra i går, er det dét spørgsmål Linn får.

**Om et spørgsmål allerede er sendt afgøres på TEKSTEN.** Samtalen ligger i
`linnAiSamtaler` og spørgsmålene i `klientspoergsmaal`, og de kender ikke
hinanden. Rammer sammenligningen ved siden af, sker det i den sikre retning:
hun kan sende igen, i stedet for at et spørgsmål lydløst ikke når frem.

**Samtalen deles med den gamle app.** Den ligger i `linnAiSamtaler`, altså
den gamle apps egen samling, så en kunde ser den samme samtale begge steder.
Det blev valgt frem for en egen 3.0-samling, fordi en ny samling ville kræve
at `firestore.rules` blev udgivet på ny, og regelfilen udgives som helhed.
**Der skal derfor intet udgives i Firebase, og Linns admin-værktøj er urørt.**

#### Filerne

| Fil | Hvad | Tests |
|---|---|---|
| `content/beskedside3.ts` | Adgang, faner, send videre, samtalens længde, datolinjen | 43 |
| `firestore/beskedside3.ts` | Kobler til de to samlinger der findes i forvejen | |
| `routes/ny/beskeder/+page.svelte` | Selve siden | |
| `routes/ny/snak/+page.svelte` | Nedlagt, sender videre | |

**Filen hedder beskedSIDE med vilje.** `content/beskeder3.ts` findes allerede
og er noget andet, nemlig linjerne i "Til dig lige nu" på forsiden. Bland dem
ikke sammen.

**Forsidens kort "Skriv til Linn" er fjernet**, fordi Beskeder står i
bundmenuen hele tiden.

### 9.20 ONBOARDING, bygget 16. august

**Alle beslutninger står i SPEC afsnit 31**, og skærmene er tegnet i
`v3 app/linns-academy-design/mockups-onboarding.html`. Hele flowet er bygget,
både de fire spørgsmål og rundvisningen. Her står kun det en ny person skal
vide med det samme.

**Porten ligger på forsiden, ikke i skallen**, af samme grund som alt andet:
skallen omgiver hver eneste side, og et forsøg på at lægge noget nyt derind
gav en blank app 11. august. **Admin går udenom**, ellers kunne Linn ikke
åbne sit eget værktøj uden at tage opstarten forfra.

**Det ene nye i skallen er skriftstørrelsen**, som sættes fra kontoen. Det er
et lokalt attribut-skift uden ét eneste netværkskald, altså ikke det der
væltede appen.

**Onboarding gælder alle**, første gang de åbner appen, uanset kundetype. Den
er delt i to der kan køres hver for sig: del A er de fire ting hun skal
oplyse, del B er en gennemgang af appen med rigtige skærmbilleder. Under
Profil kan hun bagefter vælge "Kør opstarten igen" eller kun "Gennemgå
appen". Én tæller der går til 11 for en forløbskunde og 9 for et medlem.

**Alt filtreres efter hvad kunden faktisk har adgang til**, og et kort hun
ikke har adgang til forsvinder helt. Ingen grå kasse. Onboarding må ikke have
sin egen mening om det: én funktion afgør det, og den spørger de samme steder
som appen selv, samme princip som `programmerForKunde3` i træningen.

**Gennemgangen regnes ud på ny hver gang og gemmes aldrig.** Derfor får en
kunde der er gået fra forløb til medlemskab den app hun har nu. Og derfor
skubbes der aldrig nye kort ud til dem der allerede er i gang: vil de se det
nye, trykker de selv "Gennemgå appen".

**To nye felter på kunden, begge additive.** `userDoc.ts` og `types.ts` er
urørte, og der skal intet udgives i Firebase:

- **`onboardet3`.** Uden det betød en tom udstyrsliste to ting på én gang,
  nemlig "aldrig spurgt" og "har intet udstyr", og `maaSesMedUdstyr3` viser
  alt i begge tilfælde. **Skrives først når hun er helt færdig.** Falder hun
  ud midt i, starter hun forfra, for et halvt svar er værre end ingen
- **`tekstSkala3`.** Skriftstørrelsen fandtes kun i den gamle apps profil, og
  valget lå i browserens `localStorage`, så det var væk ved telefonskift. Nu
  gemmes den begge steder

**Det der mangler er indhold, ikke kode:**

- **Fire videoer**, én pr kundetype. `VELKOMSTVIDEO_3` står tom, og en tom URL
  betyder at skærmen springer afspilleren over og kun viser hilsenen.
  Hilsenen er allerede forskellig pr kundetype
- ~~Ti skærmbilleder~~. **Klaret 16. august.** Det blev otte, ikke ti, for det
  er hvad kortene faktisk bruger naar de to udgaver af forsiden taelles med.
  De ligger i `static/onboarding/` og fylder 288 KB tilsammen.

  **Taget af `scripts/skaermbilleder.ts`, som IKKE skal slettes.** Det er et
  vaerktoej og ikke en engangs-opgave: aendrer en skaerm sig, koeres
  `npm run skaermbilleder`, og saa er billedet friskt. Det logger selv ind som
  begge testkonti, saetter vinduet til en iPhone og klipper om det element
  hvert kort handler om. Koderne staar i `.env`.

  Mangler en fil, fjerner kortet bare rammen, saa gennemgangen virker uanset

### 9.21 SPØRG OM APPEN, egen videnbase 16. august

**`/ny/hjaelp` svarede ud fra den GAMLE apps videnbase.** Spurgte en kunde
hvor hun fandt sine moduler, fik hun forklaret en fane der ikke findes i 3.0.

**Både `content/appHjaelp.ts` og `/api/app-hjaelp` er urørte**, for de bruges
af de 760 i drift. Alt nyt ligger ved siden af: `content/appHjaelp3.ts` med 18
afsnit og 16 tests, endpointet `/api/ny-app-hjaelp`, og `/ny/hjaelp` peger nu
på det nye.

**Videnbasen skæres til efter hvad hun faktisk har**, med de samme spørgsmål
som onboarding stiller. Et medlem hører ikke om forløb og får ikke at vide at
hun kan skrive til Linn. Ordene premium og basis bruges ikke.

**Den her fil forældes hvis ingen passer på den.** Ændrer du en skærm i 3.0,
så ret afsnittet samme dag. Det er præcis den fejl der blev rettet da filen
blev skrevet. Der er en test der fælder hvis Moduler-fanen sniger sig ind
igen, og en der fælder hvis ordet Snak dukker op om fanen.

**Verificeret mod den kørende app**, ikke kun med tests. Det var dér de fire
fælder i afsnit 7 blev fundet, og de kostede fire runder.

### 9.22 DINE LEKTIONER, bygget 18. august. Biblioteket delt i to

**Læs SPEC afsnit 32 før du rører noget her.** Det her er kortversionen.

**Spørgsmålet var hvor Biblioteket skulle ligge og hvad det skulle hedde.
Svaret blev at der ikke skulle være noget der hed Bibliotek.**

Biblioteket i den gamle app har fem faner. Tre af dem havde allerede fået et
hjem i 3.0 uden at nogen bemærkede det: opskrifterne i 30-30 og
træningsøvelserne i Træning. Tilbage stod to ting af helt forskellig natur.
Lektionerne og noterne er **hendes eget**. FAQ og links er **Linns
hjælpestof**. Ét ord over begge dele måtte nødvendigvis blive vagt, og et
vagt ord kan ikke placeres. Derfor blev det delt.

**Linns beslutning 18. august:** lektionerne og noterne under Profil, FAQ og
links under Hjælp, og ordet Bibliotek ud af kundens sprog.

**Navnet blev "Dine lektioner".** Det oplagte var "Dine forløb", men det
kolliderer med `/ny/forlob`, som allerede hedder "Dit forløb" og viser det
aktive. To næsten ens navne, hvor det ene er nutid og det andet fortid.

**Det tekniske navn er urørt.** `bibliotekBonusSlutMs`, `harBibliotekAdgang`,
`bonusPeriodEndsAt` og `harBibliotek` hedder stadig det de hed. Kunden ser dem
aldrig.

**Sådan ser det ud.** På Profil står ét forløb pr række. Det der kører øverst
med en ring om hvor langt hun er og mærkatet "I gang", de gennemførte under
med deres stjerne. Diplom-blokken som selvstændig sektion er **afløst**,
stjernen lever videre inde i listen. Tryk på et forløb og du er på
`/ny/lektioner/[forlobId]` med alle lektionerne i rækkefølge.

**Det aktive forløb er med på listen.** Linns beslutning, så hun har overblik
over alle lektioner ét sted. Det betød at lektioner hun ikke er nået til nu
**vises uden at kunne åbnes**, i stedet for at være skjult.

**LÆS DEN HER, HVIS DU RØRER LÅSEN.** Datoen på en låst lektion regnes fra I
DAG og aldrig fra forløbets startdato. `dagNummer` har allerede kundens pauser
med, se `nulDage3.ts`. Regner du forfra fra startdatoen, får en Kropsro-kunde
med to pausedage en dato der ligger to dage forkert. Der er en test der holder
på det.

**Noterne ligger i den samme samling som den gamle app bruger**, altså
`users/{uid}/lektionNoter` med id `forlobId__lektionId`. Ingen ny datamodel.
En note skrevet i den gamle apps bibliotek står allerede i 3.0, og omvendt.
Har hun skrevet noter, dukker fanen "Mine noter" op, og en blyant i listen
viser hvor der ligger en. **En note overlever sin lektion**: tager Linn
lektionen ned, står noten stadig nederst med en reservetekst. Det var Linns
svar på spørgsmålet, og det er hendes egne ord der begrunder det.

**Noten er kun kundens.** Reglerne lukker alle andre ude, også Linn. Derfor
står der "Kun du kan se den" og ikke "Kun du og Linn", som på dagens
refleksion. Den forskel er bevidst, lav den ikke om ved et uheld.

**De 90 dage.** Et gennemført forløb er enten `aaben`, `bonus` eller `lukket`,
se `forlobAdgang()`. Er de 90 dage gået, står kun noterne tilbage, og rækken
siger "Kun dine noter". Et forløb der KØRER er altid åbent, også hvis
abonnementet udløber undervejs, samme regel som `spaerring3` punkt 1. Den
direkte adresse er også spærret: en liste er ikke en lås.

**TO TING DER IKKE ER LØST, OG SOM DU SKAL KENDE:**

**1. Kunden i bonus-perioden kan slet ikke komme ind i 3.0.** Spærringen i
skallen kender ikke de 90 dage. Har hun hverken abonnement eller et kørende
forløb, får hun "Din adgang er udløbet" og kommer aldrig ind. I den gamle app
har hun sit bibliotek i 90 dage. Det betyder at tilstandene `bonus` og
`lukket` er **korrekt bygget og gennemtestet, men uopnåelige i praksis**. Al
kode er der og venter. **Spærringen er ikke rørt.** Den er den ene lås der
beskytter hele fladen, og at lukke en ny slags kunde ind kræver sin egen
diagnose og sit eget go.

**2. "Set"-fluebenet er ikke bundet til forløbet.** Det gemmes i `nyKlaret` på
lektionens id alene. Genbruger Linn den samme lektion på to hold, viser
fluebenet sig begge steder. Det har været sådan i 3.0 hele tiden, men blev
først synligt da gamle forløb kunne åbnes. Noterne har IKKE problemet, de er
scopet til forløbet.

### 9.23 HJÆLP, samlet 18. august

`/ny/hjaelp` er nu et nav med tre indgange i en bevidst rækkefølge: **Spørg om
appen** (AI-en, flyttet til `/ny/hjaelp/spoerg`), **Ofte stillede spørgsmål**
og **Links og guides**. Nederst vejen til et menneske.

Kortet på forsiden peger direkte på `/ny/hjaelp/spoerg`, så den vej ikke blev
længere af at der kom et nav.

FAQ og links læser **den samme data som det gamle bibliotek**, med dets egne
hjælpere til sortering og udgivelse. Retter Linn et svar ét sted, er det
rettet begge steder.

**FAQ hører til ét forløb i databasen**, men en kunde kan have været på flere.
Reglen er den samme som på lektionerne: hun ser materialet fra de forløb hun
stadig har adgang til, flettet sammen, se `content/hjaelp3.ts`. Har hun mere
end ét forløb, står holdets navn ved siden af kategorien. Har hun kun ét,
står navnet ingen steder. Er de 90 dage gået for et forløb, forsvinder dets
FAQ også.

**AI-videnbasen fulgte med.** `content/appHjaelp3.ts` fik tre nye afsnit, og
`HjaelpKunde3` fik feltet `harGennemfoertForlob` så de kun nævnes for en kunde
med forløbshistorik. Uden det havde vi genskabt fejlen fra 16. august, hvor
hjælpen forklarede en app der ikke fandtes. **Reglen står ved magt: ændrer du
kundefladen i 3.0, opdaterer du `appHjaelp3.ts` i samme ombæring.**

### 9.24 UDVIKLING, første blok bygget 18. august

**Siden var IKKE bygget.** Tidligere udgaver af det her dokument sagde at
`/ny/udvikling` var bygget og bare manglede en gennemgang mod den gamle app.
Det passede ikke. Den var en tom side med teksten "Siden er ikke bygget
endnu". Vær varsom med den slags formuleringer, de koster den næste en
fejlvurdering.

**Den gamle Udvikling har fire blokke:** næring, træning, små skridt, og
baseline plus check-ins. Linns beslutning 18. august: tag den sidste alene
først. **De tre andre er ikke påbegyndt.**

**Den gamle side tegner fem farvede streger oven i hinanden** i ét lille felt
med en farveforklaring under. Den viser alt og svarer på ingenting.
Målgruppen er kvinder i 40erne på en telefon. Linn sagde ja til at vende det
om: én kurve over hendes overskud samlet, og under den en liste med fra-til
pr spørgsmål, som er det der svarer på om det har hjulpet. Vil hun grave,
vælger hun ét spørgsmål og får dets egen kurve.

**Der måles mod hendes ALLERFØRSTE måling**, ikke mod det nuværende forløbs
start. Linns beslutning: har hun været med i to år, er det den historie der
er den rigtige.

**To ting jeg tog fejl af undervejs, og som er rettet:**

- **Cravings tæller ikke omvendt.** 1 betyder mange og 10 betyder ingen, så
  et højt tal er godt på alle fem. Der er ingen undtagelse at kode. Der er en
  test der holder på det, netop fordi det er nemt at læse forkert
- **Målingerne kommer kun ét sted fra.** Den gamle side fletter to kilder,
  men de gamle svar fra vaner-modulet blev flyttet over i sommeren 2026 og
  ligger nu sammen med resten, mærket så de ikke tæller i symptom-scoren men
  stadig har deres fem tal. Der er intet at flette, og kurven kan ikke få et
  hul

**Kurven er den samme geometri som forsidens**, altså `byggKurve` i
`content/forside3.ts`, så forløbs-bånd og pauser følger med gratis og de to
sider ikke kan drive fra hinanden. Den er tegnet inline med lyse farver i
stedet for at trække forsidens komponent ud i en fælles. Forsidens kurve står
på en mørk plomme-flade, og forsiden er den mest brugte skærm i appen. Mindst
risikable løsning frem for den pæneste.

**Tre tilstande.** Aldrig målt giver en invitation. Én måling står som hendes
udgangspunkt og ikke som en fremgang på nul, som ville læse som en fiasko. Fra
to målinger er der en historie. Går det den forkerte vej, siges det roligt og
ikke i rødt.

**Gennemsnittet divideres med ANTAL SVAR og ikke med fem**, så et oversprunget
spørgsmål ikke trækker hendes overskud ned.

### 9.25 UDVIKLING: fem foldede kort, og forsiden fulgte med

Bygget 18. august, oven på 9.24.

**Formen.** Udvikling rummer fem områder: Dit overskud, Symptomer,
Træning, Mad og Små skridt. Fem måder at bladre mellem dem blev tegnet
op, og Linn valgte **foldede kort**. Hvert område er et kort hvor tallet
og retningen altid står fremme, mens grafen er foldet sammen. Ét kort er
åbent ad gangen.

Grunden er hvad siden er til: hun kommer ikke for at studere sin
proteinindtagelse, hun kommer for at få svar på om det hjælper. Det svar
er helheden, altså at flere ting peger samme vej, og det kræver at hun
kan se dem alle på én skærm.

Og en praktisk grund: **med den form kan et område bygges ad gangen uden
at siden ser halvfærdig ud.** Et kort der ikke findes, er der bare ikke.

**Knapperne øverst udgik.** Der lå seks runde knapper til at vælge
mellem det samlede og de fem spørgsmål. De brækkede over på to linjer og
skubbede hendes tal ned under folden. Nu er listen "Siden du startede"
selv styringen: tryk på en linje, og kurven ovenover skifter. "Samlet"
står øverst i listen som vejen tilbage.

**Y-aksen.** Linns valg: den dækker hendes EGNE tal og ikke hele skalaen
fra 1 til 10. På hele skalaen ville en fremgang fra 4,2 til 7,6 kun
bruge den midterste tredjedel og se næsten flad ud. Men når der STÅR tal
på aksen, må der ikke stå 3,8, så `beregnAkse` runder ud til hele tal og
sørger for at midten også bliver et. Elleve tests på den alene.

**Forsiden fik den samme kurve**, men beholdt sin mørke plomme-flade.
Linns valg. Der er ingen tal på selve kurven, kun aksen og holdnavnene.

**FÆLDE, fundet på et skærmbillede:** holdnavnet og datoen stod på samme
linje, så "Kickstart" lå oven i "26. apr". Der er nu en test der forbyder
at `baandTekstY` og `datoY` får samme værdi igen.

**Tegnefladen er ét objekt.** Målene lå før som faste tal spredt over to
filer. `FLADE_FORSIDE` og `FLADE_UDVIKLING` i `content/forside3.ts`
følger med ud på kurven, så komponenten læser sin viewBox af den. Vil du
ændre en højde, er det ét tal, og bånd, pauser og datoer følger med.

### 9.26 UDVIKLING: de fire andre kort, og reglen bag dem

Bygget 18. august.

**LINNS REGEL, og den vigtigste linje i hele afsnittet:** en side der gør
status må ALDRIG kunne læses som en anklage. Den gamle side gør det fire
steder, uden at det er ondt ment:

- Træning "12 af 30 dage". Hun læser 18 dage hvor hun ikke gjorde det
- Næring: tomme søjler de dage hun ikke fik tastet. Hun spiste jo
- Små skridt "3 af 5" hver dag, altså to nej dagligt
- Symptomtjek: en stigende linje efter en hård måned

**Symptomer.** Linns navn og hendes valg af model. Tallet står som det
er, 0 til 44 hvor 0 er bedst, altså det samme tal hun ser når hun
udfylder. Vi vender det IKKE om til et "ro"-tal, for så ville de to
sider vise forskellige tal for det samme.

**DET TÆLLER OMVENDT AF ALT ANDET PÅ SIDEN.** En faldende kurve er
sejren her. Derfor er kurven grøn, og linjen under siger det med rene
ord. Går det den forkerte vej, står der at kroppen har haft en hårdere
periode, og at det ikke siger noget om hvor godt hun gør det.

Udfyldelser der kun har de fem skydere springes over. De blev flyttet
over fra vaner-modulet og har ingen symptom-score, så de ville ligge som
nuller i bunden og ligne en kunde der pludselig var rask.

**Træning.** Måned mod måned i MINUTTER, seks måneder som søjler, og
intet mål. Den længste måned fylder søjlen ud, og alt andet måles mod
den, så en måned kan aldrig se ud som en fiasko, kun som kortere.

**MINUTTERNE ER NYE, OG DE KAN IKKE LAVES BAGUDRETTET.** Historikken
gemte før kun AT hun havde trænet, og entry'en gemmer ikke hvilken dag i
programmet hun tog, så længden kan ikke regnes ud. Afspilleren gemmer
dem fra 18. august. Mangler bare én træning i perioden sine minutter,
tælles der træninger i stedet, og det står med en linje på skærmen. De
blandes ALDRIG: en måned med minutter mod en uden ville se ud som en
kæmpe fremgang der ikke findes.

**Mad.** Snittet regnes pr dag hun HAR registreret, ikke pr dag i
måneden. En uge uden madregistrering trækker hende ikke ned. Målet på
105 g nævnes KUN når hun er over det. Ligger hun under, står der
ingenting om målet.

**Små skridt.** Vi tæller kun ja'erne og nævner aldrig hvor mange hun
kunne have sagt ja til. Kun de vaner hun har valgt NU tæller med.

**Måned mod måned bor ét sted.** `content/maanedTal3.ts` kan både lægge
sammen (træning) og tage snit (mad, små skridt). Uden den ville reglen
ligge tre steder og drive fra hinanden.

**Små skridt er FJERNET fra Udvikling igen, 18. august.** Linns
beslutning. Kortet blev bygget og pillet ned samme dag. Bygger du det
igen, så husk hvorfor det var svært: kortet læste abo-sporet, som er
nøglet på dato, mens en kunde der er PÅ et forløb får sine skridt gemt
pr forløbsdag et andet sted. Kortet var derfor tomt for præcis det
Kickstart-hold der skal flyttes først.

### 9.27 LEKTIONSLISTEN DELT OP I UGER, 18. august

**Læs SPEC afsnit 32.12 før du rører noget her.** Det her er kortversionen.

Listen inde på ét forløb var flad, én linje pr lektion pr dag. På Kropsro
blev det 227 linjer hvor godt hundrede var den samme video gentaget på syv
dage. Nu ligger live-Q&A øverst for sig selv, og ugerne under står foldet
sammen. 227 linjer blev til 116.

**Den fælde du skal kende, hvis du nogensinde rører opdelingen igen:**

**Samle på titlen er forkert.** Det er det oplagte, og det ville have
skjult 83 lektioner. "Din 1%" hedder det samme alle 84 dage men er 84
forskellige lydfiler. Vi samler på url'en.

**Og url'en er heller ikke nok alene.** Linns Zoom-rum er det samme link
hele forløbet igennem, så otte forskellige live-kald ville være blevet til
ét. Live-formater samles kun på dage lige efter hinanden.

Begge fejl blev fanget ved at køre opdelingen mod de rigtige Kropsro-data
med et engangs-script og tælle efter. **Gør det samme hvis du ændrer
reglerne.** Tallet der skal passe er antal viste linjer mod antal unikke
filer. Testene alene fangede dem ikke, for jeg skrev testene ud fra hvad
jeg troede dataene var.

**Åben tråd: Q&A kendes kun på titlen.** Der er intet mærke i databasen.
Skriver Linn en gang "Spørgetime" i stedet, forsvinder den ned i ugerne.
Den holdbare løsning er et flueben på lektionen i admin.

### Mad er nu bygget faerdig paa naer to beslutninger

Hele Mad-modulet blev gennemgaaet mod den gamle app 12. august, funktion for
funktion. Det der mangler er ikke kode, men to beslutninger fra Linn:

- **Indkoebslisten.** Anbefaling: vent til billederne er paa opskrifterne. Den
  bygger paa det mindst brugte i modulet, og gitteret er 128 farvede felter
- **Madplanen.** Parkeret 11. august og mangler et endeligt ja eller nej

Og én ting der er set, men ikke rettet: **skaermen ser tom ud mens
foedevare-databasen hentes.** 2.268 dokumenter tager tid paa en telefon, og
imens lignede det for Linn at alt var forsvundet. Samme klasse som
opstarts-problemet i 9.7.

### Efter 30-30

Resten af etape 4:

- ~~**Træning.**~~ **Bygget 15. og 16. august**, hele modulet fra bunden, inklusive at kunden bygger sit eget og AI-værktøjet. Se 9.18
- ~~**Biblioteket**~~. **Klaret 18. august.** Delt i to, se 9.22 og 9.23
- **`/ny/udvikling`** mangler næring, træning og små skridt. Første blok bygget 18. august, se 9.24
- ~~`static/mockup/` slettes~~. **Klaret 11. august.** Se 9.7
- ~~SPEC mangler et afsnit 26.7~~. **Passede ikke.** Afsnittet står i spec'en
  og er fyldigt. Tidligere udgaver af det her dokument sagde at det manglede,
  og det var forkert

### Åbne tråde på regnemaskinen, aftalt 15. august

Rækkefølgen er Linns. Hun stoppede bevidst her.

**1. Skriv de beregnede tal ud til den gamle app.** Linns beslutning 15. august: makrotallene skal være de samme i begge versioner. Det kræver at makro-linjen i opskrifternes `instruktioner` skrives om.

Scriptet var klar og kørte tørløb, men blev ikke skrevet. **Sikkerhedskopi af alle 133 opskrifters tekst ligger i `backup/opskrifter-instruktioner-2026-08-13.json`.**

Vær opmærksom på: **rør kun de fem tal.** Linjen ser sådan ud, og Tid-delen varierer fra opskrift til opskrift.

```
Protein: 24 g | Fiber: 11 g  | Kulhydrater: 44 g | Fedt: 16 g | Kalorier: 440 kcal | Tid: 15 minutter
```

**Hele tal, ikke decimaler.** Teksten har altid haft hele tal.

**Og det er en synlig ændring for 760 kunder på én gang.** Nogle tal fordobles.

**2. Find de øvrige retter til flere personer.** Se fælden ovenfor. Det er den enkelte ting der forbedrer tallene mest, og det kræver Linns viden om hver ret. Giv hende en liste med kandidater, lad hende sige til og fra.

**3. Aftrykket af ingredienslisten.** Aftalt løsning 15. august, ikke bygget.

Gem et aftryk af ingredienslisten sammen med det beregnede tal. Passer aftrykket ikke når 3.0 viser opskriften, er den rettet siden, og så træder det beregnede tal til side for Linns tal i teksten.

**Linns regel: intet regnes om automatisk. Ændrer man opskriften, retter man selv makrotallet.** Aftrykket er det der gør at hun kan gøre det ét sted, i den gamle admin, uden at et forældet tal bliver hængende i 3.0.

**4. Tre opskrifter hedder "Ny opskrift" og har nul ingredienser.** Tomme kladder, står som 4 portioner. Skal fyldes ud eller slettes.

**5. Fødevare-listen kunden søger i.** Det største åbne spørgsmål i Mad, se nedenfor.

### Den kuraterede fødevare-liste, diagnosticeret 13. august

**Søger kunden på æg, får hun syv valg, og de tre øverste hedder bare "Æg" uden kalorier.** Det er scannede stregkoder oprettet tre gange.

Databasen er én bunke af tre oprindelser:

```
frida       1381 varer   61%   den officielle foedevaredatabase
kickstart    840 varer   37%   lavet til appen
scannede      47 varer    2%   fra Open Food Facts
```

**Men kunderne spiser 79 procent fra Kickstart-listen og kun 11 procent fra Frida.** De 20 mest brugte madvarer er alle sammen fra Kickstart.

**Kun Frida ville gøre det værre.** Søger man på æg i Frida alene, er de otte øverste andeæg, gåseæg, tørret æg og æggeblomme. Tørret æg har 564 kalorier, og intet i navnet advarer om det.

**Problemet er ikke hvilken database. Det er at ingen har bestemt hvad kunden må se.** Løsningen er et kurateret lag ovenpå, ikke et databaseskifte. Kickstart-listen er allerede tæt på at være det lag.

**Og 9.910 madvare-linjer, 10 procent af alt kunderne har registreret, peger på varer der ikke findes længere.** De viser stadig rigtige tal, fordi makroen fryses ind i måltidet når hun trykker gem. Men genveje som faste måltider og "det du plejer" slår varen op igen og går i stykker. **Rydder du op i listen, så peg gamle id'er videre i stedet for at slette.**

### Bevidst udskudt

~~Biblioteket~~, klaret 18. august, se 9.22 og 9.23. Variant-, makker- og Facebook-modalerne på træning og Kropsro. "Mine køb" for udløbne kunder.

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

### Arbejdsformen der virker

Det her er ikke teori. Det er hvad der faktisk har fungeret, og hvad der ikke har.

**Mål på rigtige kundedata før du vælger design.** Det har ændret designet flere gange, og hver gang til det bedre. Skriv scriptet som `scripts/_navn.ts`, kør det læs-kun, vis Linn tallene, og slet scriptet bagefter. Tre eksempler: de 68,5 % gentagelser flyttede hele Mad-skærmen, de 13 madvarer om dagen aflivede tre forslag, og en måling viste at ingen kunde ville blive låst ude af spærringen.

**Mockups før kode. Hver gang.** Linns faste regel siden 15. august, og den gælder også admin-skærme. Tegn skærmen som HTML i `v3 app/linns-academy-design/` som `mockups-<emne>.html`, gennemgå den med hende, ret efter hendes svar, og kod først derefter. Det er ikke pynt: tildelingen i træningen blev tegnet om én gang undervejs, fordi hun ville have ét bestemt hold i stedet for forløbet generelt, og den ændring ville have været dyr at opdage i koden.

**Ét skærmbillede ad gangen.** Tegn det, få det låst, byg det. Vi tegnede fem runder mockups af Mad-modulet på et gæt om hvad det indeholdt, før vi gennemgik det. Det var spildt arbejde.

**Gennemgå det gamle modul blok for blok, før du tegner noget.** Det gælder både forsiden og Mad, og det gav begge gange en liste over ting der ellers var blevet glemt.

**Byg i små bidder når noget er gået galt.** En samlet ændring gav en blank app uden at årsagen kunne findes. Delt i to bidder virkede den samme funktion uden problemer.

**Linn tester på telefonen, og hun finder ting du ikke kan se.** Fem fejl på to aftener: tomme cirkler, forkerte skriftstørrelser, et gennemsigtigt ark, et mærkat der lå hen over et ikon, og et tal uden ord på. Vurdér aldrig et design færdigt før det har været i hendes hånd.

**Skærmbillederne ligger i `Projekter/v3 app/Screenshots v3/`**, ikke i repoets `screenshots`-mappe.

**Efter hver udrulning skal hun lukke fanen helt.** Appen gemmer en kopi af sig selv, og den viser gerne den gamle udgave. Det har fire gange lignet en fejl i koden.
