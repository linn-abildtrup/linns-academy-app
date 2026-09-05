# Overdragelse: Linns Academy 3.0

Sidst opdateret 4. september 2026.

**DEN 4. SEPTEMBER VAR EN STOR DAG I 3.0, OG DET DER SPÆRRER ER NU ÉN TING:
de fire velkomstvideoer.** Tre beslutninger fra Linn lukkede resten, se 9.78.
Læs NÆSTE SKRIDT i afsnit 9, som er skrevet helt om den dag.

**Rører du noget der ruller, klæber eller tegnes i en graf, så læs 9.76 og 9.77
FØRST.** Fire fejl i træk samme dag havde den samme årsag: det er skallens
`.ny-scroll` der ruller, ikke listen indeni. Tre af dem gik på timing, mens
fejlen lå i layoutet. Der er nu en `utils/rulning3.ts` der finder det rigtige
element, og et afsnit om at et klæbende felt er i TO tilstande.

**Beskeder er lavet om så det virker som den gamle app**, se 9.76: kunden kan
skrive direkte til Linn igen, samtalen er en chat, og sikkerheds-procenten
vises. Det omgør en regel der stod to steder i koden.

**Test selv i Chrome før du melder noget færdigt.** Linns besked samme dag, og
den kom af at hun brugte en time som min tester. Der er flere browsere
forbundet, og den Claude åbner faner i er ikke nødvendigvis den hun sidder i:
spørg, og vælg med `select_browser`. Jeg må ikke selv taste adgangskoder, så
bed Linn logge ind ÉN gang i fanen, tidligt i sessionen.

**3.0 SIGER IKKE FRA NÅR APPEN IKKE KAN KOMME IGENNEM. Det skal på plads
inden det første hold flyttes over.** Et gem uden forbindelse melder ALDRIG
fejl, og ændringen ser gemt ud på skærmen alligevel. Det kostede en kunde i
den gamle app to hele dage, mad, vaner og noter, uden at hun fik det at vide.
Den gamle app fik løsningen 4. september 2026, og delene ligger i `src/lib/`
og kan genbruges. Se konventionen i afsnit 6, og hele beskrivelsen i
`HANDOVER-GAMMEL-APP.md`. **Flytter du et hold til `/ny` uden det her, giver
du de kunder præcis den fælde vi lige har lukket for de andre.**

**LÆS DEN HER FØRST HVIS DU LEDER EFTER DEN SIDSTE UGES ARBEJDE.** Mellem 27.
og 31. august blev der lavet 39 ting, og **næsten alle ligger i den GAMLE app**,
ikke i 3.0. Login i to trin, hjemmeskærms-skærmen, Kickstarts startdag og
uge-mål, Facebook-gruppen, intro og info-knapper, hele opstarts-oprydningen og
AI-svarudkastene er alt sammen `/app`. **De hører til i `HANDOVER-GAMMEL-APP.md`, som er
skrevet op til 1. september og dækker dem alle.** Leder du efter noget fra den
uge og ikke finder det her, er det derfor, og ikke fordi det mangler.

Værd at kende, selv om du kun arbejder på 3.0: **den gamle app voksede fra 618
til 925 kunder i den uge.** Et helt nyt Kickstart-hold kom ind.

**3.0 fik i samme uge kun tre ting**, se 9.59.

**DEN 1. SEPTEMBER KOM DER OTTE TING TIL, se 9.61, OG HELE ADMIN BLEV
LAVET OM SAMME DAG, se 9.62.** Kort: Linn AI ved nu
hvilket forløb kunden er på, kender hendes FAQ og hendes lektioner til og med
i dag, og bruger for første gang Linns egne tidligere svar. Dertil en ny
admin-side, Ingrediensernes tal, hvor Linn kan rette en fødevares næringstal
så det gælder BEGGE apper, og hvor opskrifterne regnes om i samme kørsel.
Links i Beskeder kan trykkes. **Rører du Linn AI eller fødevarernes tal, så
læs 9.61 først.**

**Rører du Mad, så læs 9.56 først, og derefter 9.50 og 9.52 til 9.55.** 9.56 er
at hendes egne madvarer, de scannede varer og hjertet er samlet til ét begreb
der hedder Mine favoritter. 9.50 er at alle fødevarers næringstal kommer fra Den Danske Fødevaredatabase, skrevet ud til BEGGE apper 24. august. 9.52 til 9.55 er 25. august: kunden kan rette i Linns opskrifter, søgningen er lagt om to gange, salaterne var forsvundet, og en blank skærm i 30-30 er rettet. 9.49 er gennemgangen af fødevare-kilderne der førte til det. Se 9.39 til 9.48 for hele beskedsystemet, bygget 23. august.

**DEN 1. TIL 4. SEPTEMBER: LYD OG BILLEDE TIL ÉN KUNDE, se 9.70, OG EN SIDE
DER SPØRGER TELEFONEN, se 9.71.** Linn kan nu sende en lydbesked eller et
billede til én kunde, og filen ligger i kundens egen mappe, hvor ingen anden
kunde kan læse den. Storage-reglen bag det er udgivet OG afprøvet i
virkeligheden. **Rører du beskederne eller Storage, så læs 9.70 først.**

**Denne fil handler kun om 3.0.** Den gamle app i drift på `/app` har sin egen overdragelse i `HANDOVER-GAMMEL-APP.md`, og de to må ikke blandes sammen.

**Læs i denne rækkefølge hvis du er ny:** afsnit 2 om den vigtigste regel, afsnit 7 om fælderne, og så afsnit 9 om hvor vi står. Resten kan slås op efter behov.

**Er du ny og skal rette noget for en kunde, så læs også 9.58.** Den er listen
over hvad den gamle app kan, som 3.0 ikke kan. Otte ting, og fem af dem stod
ikke i noget dokument før 26. august.

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
| `src/lib/components/ny/` | 37 komponenter, alle kun brugt i 3.0. `VaelgArk.svelte` er ubrugt siden 12. august og skal enten slettes eller have en note |
| `components/ny/MineFavoritterArk.svelte` | **Mine favoritter.** Afløste `MineFodevarerArk` 26. august, som er slettet. Se 9.56 |
| `components/ny/Sidehoved.svelte` | **Toppen af hver side.** Afløser syv varianter, se 9.31 |
| `components/ny/Maerke.svelte` | **Logoet.** Ét sted, to udgaver. Skrivemåden er `Linn's` MED apostrof |
| `src/lib/utils/billede3.ts` | Skalering og webp i browseren. `billede.ts` er den gamle og må ikke røres |
| `src/routes/ny/admin/ingredienser/` | Kobl ingredienser til fødevarer. Se 9.17 |
| `src/routes/ny/admin/opskrift-makro/` | Regnestykket linje for linje. **Gå her når et tal ser forkert ud** |
| `src/routes/ny/admin/traening/hensyn/` | Hvad hver øvelse belaster. **Tallene øverst er det vigtigste på siden.** Se 9.33 |
| `src/routes/ny/admin/naering/` | Hvem ser udvidet næring. Pr forløb, plus undtagelser pr kunde. Se 9.38 |
| `src/routes/ny/admin/skriv/` | **Skriv til en kunde.** Lander i hendes Beskeder. Se 9.43 |
| `src/routes/ny/admin/forsidebesked/` | **Besked på forsiden.** Til et hold eller alle. Se 9.44 |
| `src/routes/ny/admin/noti/` | Hvad appen må sige til om, og et prik uden besked. Se 9.39 |
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
| `content/oevelsesSoeg3.ts` | Søgning og kategori-tælling i øvelsesbanken. Delt af biblioteket, vælgeren og Hensyn | 22 |
| `content/valgtProgram3.ts` | **Hendes valgte program.** Hvornår hun skal spørges før et skift. Se 9.32 | 15 |
| `content/traeningTempo3.ts` | De tre tempoer: Roligt 30/20, Almindeligt 45/15, Hårdt 50/10. Se 9.32 | 11 |
| `content/oevelseHensyn3.ts` | **Hensyn.** Hvad hver øvelse belaster, og hvad der filtreres fra. Se 9.33 | 19 |
| `content/vaelgSkridt3.ts` | **Hun vælger selv.** Maks tre, kategorier, hendes egne. Se 9.35 | 26 |
| `content/lektionSet3.ts` | **Hvornår en lektion er set.** Fluebenet følger videoen. Se 9.37 | 16 |
| `content/naeringAdgang3.ts` | **Hvem ser udvidet næring**, og hvem må rette sine mål. Se 9.38 | 12 |
| `content/notifikation3.ts` | **Beskeder på telefonen.** De tre slags, hvem der må, teksterne. Se 9.39 | 38 |
| `content/videreTil3.ts` | Hvor hun var på vej hen, og **låsen** der holder det inde i 3.0. Se 9.41 | 9 |
| `content/forsidebesked3.ts` | **Beskeden på forsiden.** Hvem, hvor længe, hvilken der vinder. Se 9.44 | 18 |
| `content/mail3.ts` | **Mailen.** Samtalen til svar, opslag eller invitation til resten. Se 9.47 og 9.48 | 18 |
| `content/mineFavoritter3.ts` | **Mine favoritter.** De tre begreber samlet til ét. **Læs toppen før du rører noget her**, den rummer reglen om at listen regnes ud og aldrig skrives. Se 9.56 | 21 |

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
| `firestore/valgtProgram3.ts` | Hvilket program hun har valgt. Den tolvte der **skriver** kundedata. Se 9.32 |
| `firestore/oevelseHensyn3.ts` | Mærkerne på øvelserne. Ét dokument til dem alle. Kun admin skriver. Se 9.33 |
| `firestore/vaelgSkridt3.ts` | Hendes valgte skridt. Læser begge skuffer. Se 9.35 |
| `firestore/naeringAdgang3.ts` | Nærings-skemaet og undtagelserne. **Kun admin skriver.** Se 9.38 |
| `firestore/notifikation3.ts` | Telefonerne hun har sagt ja på, hvad Linn tillader, og hendes aktivitet. Se 9.39 |
| `firestore/forsidebesked3.ts` | Beskederne på forsiden. Kun admin skriver. Se 9.44 |
| `server/webPush.ts` | **Selve afsendelsen.** Web Push direkte, uden tredjepart. Se 9.39 |
| `server/notiSend.ts` | **De fire spørgsmål før hver besked.** Ét sted, så de ikke kan drive fra hinanden. Se 9.43 |
| `server/notiHold.ts` | Udsendelse til flere. Går ud fra telefonerne, ikke kundelisten. Se 9.45 |
| `server/sendMail.ts` | Mailen ud ad døren. Se 9.47 |
| `utils/notiTilmeld3.ts` | At sige ja, set fra telefonen. Hjemmeskærm, lov, tilmelding |
| `utils/sendSvarNoti3.ts` | Den ene linje den gamle admin kalder når Linn har svaret |
| `hooks.server.ts` | **3.0's eget ikon.** Bytter manifest, navn og ikon på `/ny`. Se 9.40 |
| `vagt/` | **Vækkeuret** hos Cloudflare. Egen lille Worker, egen udrulning. Se 9.45 |
| `firestore/egneSkridt3.ts` | **3.0's egen skuffe** til forløbskundens egne skridt. Se 9.35 |
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

**Bundmenuen:** Forside · 30-30 · Træning · Beskeder · Udvikling · Din side. Seks faner siden 19. august.

**Højden er 50 px** siden 20. august, hvor den gik fra 76 til 58 til 50 samme dag. Den står ét sted som `--nav-h`. Den valgte fane markeres med en **pille bag ikonet**, ikke med en prik forneden. Se 9.31.

**Toppen er låst** siden 20. august og står på alle sider med Linn's Academy og datoen. Højden er `--top-h`. Se 9.31.

**Ordet Snak er droppet 16. august.** Fanen hedder Beskeder, og siden rummer
både Linn AI og Linn. Ser du ordet et sted, hører det til før den dato.

Forsiden består af, i rækkefølge: hilsen med Linns ansigt, Til dig lige nu, noten fra Linn, Dit overskud med kurven, datostrimlen, dagens små skridt, dagens lektioner, dagens træning, dagens refleksion, dagens tal, challenge og næste hold.

**AI-inspiratoren er fjernet 20. august** og kommer ikke igen, se 9.31.

**Foldning:** en sektion hun har klaret folder sig sammen til én linje med flueben, og den bliver liggende præcis hvor den stod. Et tryk folder den ud igen, og så står den åben resten af dagen. Det huskes i `sessionStorage` pr dato.

**To blokke folder sig bevidst ikke sammen:** noten fra Linn og challengen. Ingen af dem er noget kunden kan gøre færdig på en dag.

---

## 5. Test-profiler

To konti har flaget `ny-app` og kan se hele fladen.

| Email | Hvem | Type |
|---|---|---|
| `test-forlob@linnsacademy.dk` | Mette Testkonto | Forløbskunde på `kropsro_16_augu` |
| `test-medlem@linnsacademy.dk` | Hanne Testkonto | Medlem uden aktivt forløb, abo til 6. juni 2027 |

**Mette blev flyttet 20. august.** Hendes gamle hold, `kropsro_maj_2026`, udløb 17. august, og hun havde intet abonnement. Hun var derfor **spærret helt ude af 3.0** og ubrugelig som testkonto. Hun ligger nu på KropsRo 16. august og har `kropsro_maj_2026` i historikken. Sikkerhedskopi af hendes dokument før ændringen ligger i `backup/mette-testkonto-2026-08-20.json`.

**Hold øje med det her igen.** Testkonti udløber lige så stille som rigtige kunder, og en udløbet testkonto ligner en fejl i koden. Tjek `forlobIds` mod forløbets slutdato før du fejlsøger noget der handler om adgang.

**Hanne har to udløbne forløb i `forlobIds`.** Hun er medlem uden AKTIVT forløb, ikke uden forløb overhovedet. Det betyder blandt andet at hun har bibliotek og Dine lektioner.

Adgang til `/ny` gives til admin og til kunder hvor `harTestAdgang(userDoc, 'ny-app')` er sand. Flaget kan sættes både pr person og pr hold. Der er bevidst ingen omdirigering fra `/app` til `/ny`.

---

## 6. Konventioner der ikke må brydes

**Tekstskalering.** Alle skriftstørrelser skrives som `calc(NNpx * var(--fs-scale, 1))`. Uden det virker kundens valg af tekststørrelse ikke, og målgruppen er kvinder i 40erne og opefter. Det er ikke pynt.

**CSS er scoped under `.ny-app`.** Tokens ligger bevidst ikke på `:root`. Ville de det, kunne de overskrive `src/app.css` og ændre udseendet i den gamle app for alle kunder. Der ligger en token-bro nederst i `ny.css`, så genbrugte gamle komponenter automatisk får den nye flades farver.

**Skrifter indlejres som data-URI.** Ingen CDN-links, ellers rammer PWAens CSP.

**Sprog.** Alt UI og alle kodekommentarer er på dansk. Tekst kunden ser skrives med æ, ø og å. Kommentarer inde i koden skrives uden, altså forloeb, aendret og maerkat. Sådan er koden allerede, og det skal blive ved med at være ensartet.

**Attrap mærkes.** Indhold der endnu ikke er koblet til rigtige data får klassen `skitse`, så der aldrig er tvivl om hvad der virker.

**Et gem uden forbindelse melder ALDRIG fejl. Byg det ikke forkert i 3.0.** Firestore skriver ændringen i telefonens lokale kopi med det samme, så den ser gemt ud, og lader anmodningen til serveren stå og vente uden nogensinde at fejle. Et almindeligt `try/catch` omkring et gem fanger derfor ingenting, og gem-knappen bliver stående og arbejder i det uendelige. Det kostede en kunde i den gamle app to hele dage, mad, vaner og noter, uden at hun fik det at vide. 1. og 2. september 2026.

Delene ligger klar i `src/lib/` og er **ikke** bundet til den gamle app, så genbrug dem i stedet for at finde på noget nyt:

- `state/forbindelseState.svelte.ts`: den eneste sandhed om forbindelsen. Ingen side må selv gætte.
- `firestore/forbindelse.ts`: lytteren der bruger Firestores `fromCache` som det pålidelige signal. Browserens eget `navigator.onLine` lyver på et net der ikke slipper noget igennem.
- `content/gemVentetid.ts`: holder op med at VENTE efter otte sekunder, men giver ikke op på skrivningen.
- `components/ForbindelseBaand.svelte`: båndet. Det er lavet til den gamle apps udseende, så **3.0 skal have sin egen udgave** med `ny.css`-tokens. Logikken bagved er den samme.

**Der må ALDRIG stå "Prøv igen" på sådan en besked.** Skrivningen ligger allerede i kø, så et tryk mere sender det samme to gange. Hele beskrivelsen står i `HANDOVER-GAMMEL-APP.md` under "Rettet 4. september 2026: appen siger nu fra".

**Intet af det er koblet på `/ny` endnu.** Det er en åben opgave, og den bør laves inden det første hold flyttes over.

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

**Retter du en fødevares tal, bliver opskrifterne forældede i samme sekund.** De 133 opskrifters makro er REGNET UD på forhånd og gemt i `ingrediensKobling/beregninger`. De regnes ikke om af sig selv. Det skete 24. august: fødevarerne fik nye tal fra DTU, og i en time stod opskrifterne med tal fra de gamle. **Rør aldrig ved en fødevares næringstal uden at regne opskrifterne om samme dag.** Fremgangsmåden står i 9.50.

**Firestore-regler driver.** Sammenlign altid de live regler med `firestore.rules` i repoet, inden du udgiver noget. Det er nu ét kald, se afsnit 8.

**`prettier --write` PAA ny.css OMSKRIVER SKRIFTERNE. Jeg gik selv i den 21. august, selv om advarslen stod her.** De indlejrede skrifter er base64 på én linje, og prettier brækker dem op. Diffen bliver 165 linjer i stedet for de 126 du skrev. Redningen er at rulle filen tilbage med `git checkout` og lægge sine egne regler på i hånden. **Hold `ny.css` helt uden for prettier.**

**`prettier --write` med et bredt mønster ødelægger din diff.** Fundet 18. august. Repoet er ikke prettier-rent i dag, formentlig fordi versionen har flyttet sig siden filerne blev skrevet. Én kørsel på `src/routes/ny/**` omformaterede **25 filer der ellers var urørte**, og i `ny.css` skrev den de indlejrede skrifter om, som er base64 på én linje. Intet af det var forkert, men diffen blev ubrugelig og ingen kunne se hvad der faktisk var ændret. **Formatér kun de filer du selv har rørt, og hold `ny.css` helt udenfor.** Kør `git diff --stat` før hver commit og se efter filer du ikke har rørt.

**Der kan køre en anden session i det samme repo.** 18. august dukkede tre ændrede filer op midt i en opgave, heriblandt én i den GAMLE app. De var ikke fejl, en anden session arbejdede parallelt og committede dem bagefter. **Rul aldrig fremmede ændringer tilbage, og bland dem aldrig ind i din egen commit.** Kør `git status` når du begynder OG når du er færdig, og sammenlign.

---

### Fælder tilføjet 20. august, først på dagen

**En søg-og-erstat der ikke rammer, siger ingenting.** Skriver du en ændring
mod en linje som formateringen siden har klappet sammen, gled den lydløst
igennem. Gør en ændring i en Svelte-fil **ingenting som helst**, så se først
efter om mønstret overhovedet fandtes i filen, før du leder efter fejlen
andre steder. Det kostede en runde med Linn hvor hun testede noget der
aldrig var blevet skrevet.

**`:global()` findes ikke i `ny.css`.** Det er Svelte-syntaks og virker kun
inde i en komponent. I et almindeligt stylesheet gør det hele reglen ugyldig,
og browseren smider den væk uden at sige noget.

**En SVG med `width: 100%` OG en fast `height` bliver ikke større.** Den
bliver lagt midt i feltet med tom plads i begge sider. Det ramte både
forsidens og Udviklings kurve, og det tog to omgange at opdage, fordi det
ligner et layout-problem. Sæt højden fri.

**Cloudflare er op til en halv time om at lægge en ændring ud.** Og appen
gemmer sine egne filer, så en PWA skal lukkes helt ned og åbnes igen. Det har
tre gange i træk lignet en fejl i koden. **Sig det til Linn i stedet for at
lede**, men tjek altid først at rettelsen faktisk står i den byggede fil.

### Fælder tilføjet 20. august, sent på dagen

**Vores egen "fuld skærm" er kun så stor som browserens vindue.** En drejet
eller udspændt overlejring dækker det område browseren giver appen, og ikke
telefonens skærm. Drejer kunden telefonen, kommer browserens eget vindue til
syne udenom. Det slog en ellers færdig løsning ihjel og blev rullet tilbage,
se 9.31. **Tegn aldrig en løsning der forudsætter at appen ejer skærmen.**

**Et absolut placeret `::before` males oven på almindeligt indhold.** Bar
tekst inde i et link har ingen vej til at komme foran. Skal noget ligge over
en pseudo-flade, skal det pakkes i sit eget element og have `z-index`. Fanens
navn i bundmenuen manglede det.

**Mål aldrig en markering fra bunden af bundmenuen.** Den luft er telefonens
sikkerhedszone: nul i en browser og omkring 34 px i den installerede app.
Prikken under den aktive fane sad én pixel fra kanten og så forkert ud i det
øjeblik menuen blev lavere. Der står en advarsel i `ny.css`.

**En automatisk indsat import kan lande midt i en flerlinjet import.** Et
script der lagde en ny import efter "den sidste import-linje" ramte inde i en
`import {` over fem linjer og brækkede filen. `svelte-check` fandt det, men
kun fordi navnene forsvandt. **Læg kun noget efter en import der slutter på
semikolon.**

### Fælder tilføjet 26. august

**EN KAEDE AF TILFAELDE PAA EN HEL SKAERM SKAL ALTID HAVE EN SIDSTE UDVEJ.**
Det er nu sket TO gange paa to dage, og anden gang stod advarslen allerede i
dokumentet. 25. august var det 30-30 oversigten. 26. august var det scanneren:
knappen "Skriv tallene selv" sendte hende videre til gennemgangen uden at give
hende et skema at skrive I, og gennemgangen tegner kun noget naar der ER tal.
Arket blev blankt. **Hverken typerne, testene eller et build kan se den slags**,
for koden er korrekt, den bliver bare kaldt uden det den skal bruge.

Der er nu gaaet alle 53 sider og 37 ark igennem, se 9.57. Resten staar rent,
paa naer onboardingen, som er beskrevet samme sted.

**Et ark der tegner ingenting ligner en app der er gaaet i staa.** Arket ligger
som en fast flade over det halve af skaermen med sin egen baggrund. Er der intet
i det, ser kunden en tom flade i den rigtige farve, og alt hun trykker paa
inde i fladen gaar ingen steder. Hun kan ikke vide at der ligger noget ovenpaa.
**Det er derfor en blank skaerm i et ark er vaerre end en blank side.**

**En kunde kan blive laast ude af en udrulning, og selvhelbredelsen kan ikke
redde hende.** Appen gemmer en kopi af sig selv, og lige efter en udrulning kan
den naa at vise den GAMLE udgaves ramme, mens de filer rammen peger paa er
skiftet ud. Saa starter motoren aldrig. Kunden ser top, bund og den rigtige
baggrund, og INTET reagerer. Der findes en selvhelbredelse i
`routes/+layout.svelte`, men den lytter efter en fejl der kun opstaar naar
motoren allerede koerer, saa den kan ikke fange netop det tilfaelde.

Linn sad fast i det 26. august. Udvejen er at lukke appen HELT ned og aabne
igen. **Den gamle app har en knap til praecis det, "Nulstil appen paa denne
enhed". 3.0 har den ikke**, se 9.58 punkt 3. Det var en teoretisk mangel indtil
den dag.

---

## 8. Sådan tjekker du dit arbejde

```
npx svelte-check --threshold error     # skal give nul fejl
npm test                               # 2665 tests lige nu, alle grønne
npm run build                          # ved kundefølsomme ændringer
git status --porcelain                 # kun nye eller 3.0-filer må stå der
```

**Firestore-regler.** Siden 9. august 2026 ligger `firebase.json` og `.firebaserc` i repoet, så regler ikke længere kopieres ind i Console i hånden:

```
npx firebase-tools deploy --only firestore:rules
npx firebase-tools deploy --only storage
```

Den oversætter reglerne først og nægter at udgive hvis der er en syntaksfejl. Reglerne styrer adgang for alle kunder i drift, så **vis altid Linn den præcise ændring og få et ja, før du kører den.** Servicekontoen i `scripts/` kan desuden læse de live regler, så du kan sammenligne med repoet uden at udgive noget.

**Cloudflare kan styres fra maskinen.** Siden 23. august er `wrangler` logget
ind, så hemmeligheder, byggelogs og udrulninger kan klares herfra i stedet for
i Cloudflares skærmbillede:

```
npx wrangler pages secret list --project-name linns-academy-app
npx wrangler pages deployment list --project-name linns-academy-app
```

Vagten er sit eget lille projekt i `vagt/` med sin egen `wrangler deploy`.

**Regelfilen udgives som helhed.** En fejl i én blok kan lukke kunder ude af noget helt andet, fx træningsvideoer. Læs de live regler bagefter og tjek at de eksisterende blokke stadig står der, ikke kun at den nye er kommet ind.

Data-scripts mod rigtige kunder skrives som `scripts/_navn.ts`, køres med `npx tsx`, og **slettes bagefter**. Kør altid read-only eller dry-run først og vis Linn resultatet. Skal der skrives til kundedata, skal Linn sige ja specifikt til netop den kørsel. Skriver scriptet oven i noget der ikke kan regnes ud igen, så tag en sikkerhedskopi til `backup/` først. Den mappe er uden for git, for kundedata skal ikke på GitHub.

---

## 9. Hvor vi står, og hvad der er næste skridt

Opdateret 4. september 2026. **Alt er kodet, committet og pushet, og `main` er
i sync.** Firestore-reglerne er udgivet og verificeret mod det der kører,
senest 24. august, hvor de scannede varer fik deres egen samling.

**Storage-reglerne er udgivet 3. september klokken 22.01**, med mappen til
beskeder til én kunde. De live regler er hentet ned bagefter og er ord for ord
magen til `storage.rules`, og reglen er afprøvet i virkeligheden, se 9.70.
**Der ligger ingen uudgivet regel.**

Regler lægges ud med `./scripts/deploy-regler.sh storage` eller `firestore`.
Vis altid Linn ændringen og få et ja først.

`scripts/_storage-regler.ts`, der kunne vise de udgivne regler uden at røre
noget, blev slettet ved en oprydning 4. september 2026 og kan ikke hentes
tilbage. Det var et levn fra dengang Firebases eget værktøj ikke lå på
maskinen. Det gør det nu, og `deploy-regler.sh` bruger det.

**DER ER ARBEJDET PÅ 3.0 IGEN DEN 1. SEPTEMBER, se 9.61.** Ugen 27. til 31.
august gik med den gamle app, hvor nu 925 kunder er i drift. Se toppen af
dokumentet og 9.60.

**Det der blev lavet 26. august**, hver med sit eget afsnit:

- **9.56** Mine favoritter. Hendes egne madvarer, de scannede varer og
  hjertet er samlet til ÉT begreb. Det var det største enkelte greb i Mad
  siden regnemaskinen
- **9.57** Scanneren gav blank skærm når hun ville skrive tallene selv.
  Rettet, og derefter er alle 53 sider og 37 ark gennemgået for samme fejl
- **9.58** Hvad den gamle app kan, som 3.0 ikke kan. Otte ting, og fem af
  dem stod ikke i noget dokument før den dag
- **9.59** De 327 hjerter der pegede på en skjult dublet er peget videre.
  91 kunder rettet, sikkerhedskopi taget

**Det der blev lavet 25. august**, hver med sit eget afsnit:

- **9.52** Hun retter i Linns opskrifter: mængder op og ned, læg en
  ingrediens til, fjern den igen. I praksis et bytte
- **9.53** Hendes hjerter, egne varer og egne scanninger kommer først i
  søgningen. Og søgningen tåler nu en slåfejl på ét tegn
- **9.54** Salaterne var forsvundet. 26 varer er åbnet igen, 64 er
  forelagt og bevidst fravalgt
- **Den blanke skærm på 30-30 oversigten er rettet.** Den havde ingen
  udvej hvis dagen ikke kunne hentes, og så tegnede siden ingenting
- Tekststørrelsen hedder Lille, Normal og Stor, ligger nu under Din side,
  og en ny kunde starter på Normal
- Guides markeres nu som set, så dagen kan folde sig sammen

**Beskedsystemet er færdigt og afprøvet:** notifikationer, beskeder til én
kunde, forsidebeskeder, morgen-vagten og mail som reserve. Se 9.39 til 9.48.
Nøglerne ligger i Cloudflare, mailen er verificeret på domænet, og vagten
kører hver time.

**Etape 1 til 3 er færdige, og hele den åbne liste fra 6. august er klaret.** Etape 4 er i gang.

**Mad er nu færdigbygget i 3.0** på nær det der står under NÆSTE SKRIDT. Efter
9.56 er der ét begreb hvor der var tre, og hendes scannede varer har for første
gang et sted at være.

### NÆSTE SKRIDT

**Opdateret 4. september, og hele afsnittet er skrevet om.** Tre beslutninger
fra Linn den dag fjernede eller lukkede halvdelen af det der stod her. Se 9.78.

#### DET ENESTE DER SPÆRRER FOR AT FLYTTE ET HOLD

**De fire velkomstvideoer.** Indhold fra Linn, ikke kode. Har stået øverst
siden 16. august, og efter 4. september er det den eneste post tilbage.

De tre andre der stod her er væk:

- ~~**Programmerne skal tildeles**~~ **Klaret 4. september.** De to Kickstart-
  programmer er tildelt Kickstart August fra dag 3, og det er verificeret som
  kunden ser det. De to øvrige programmer er stadig kladder og kan ikke
  tildeles. Fælden var reel: der lå nul tildelinger til et rigtigt hold indtil
  den dag
- ~~**Kalender eller selvbetjening**~~ **Besvaret 4. september: 3.0 venter på
  kunden.** Kostede nul kode, se 9.78. Den gamle app beholder sin kalender, og
  de to apper gør nu bevidst noget forskelligt
- ~~**"Vælg dine små skridt" er en død vej**~~ Klaret 22. august, se 9.35

#### Kunden kan møde en halvfærdig app tre steder

Fundet 4. september ved at scanne for attrap og forældreløse sider. **Ingen af
dem stod på nogen liste, og de to første ser en kunde uden at gøre noget
forkert.**

1. **"Resten af din profil kommer her. Siden er ikke bygget færdig endnu."**
   står på Din side, lige over Log ud, for alle kunder der ikke er i bonus.
   **Det er det eneste sted i hele 3.0 hvor appen selv siger at den er
   halvfærdig.** Væk eller erstattet inden et hold flyttes
2. **`/ny/moduler` er en tom side** der siger "Siden er ikke bygget endnu".
   Den blev lavet som en plads i skallen så bundmenuen ikke førte til en
   fejlside, men **Moduler er ikke i bundmenuen længere**, så den har nul veje
   ind. Rammes kun via et gammelt link eller browser-historik
3. **`/ny/forlob` er også forældreløs**, siden 20. august hvor "Alle dage" blev
   fjernet. Virker hvis man skriver adressen. Enten en vej ind eller sløjfes

Alt andet er rent: der er **ingen `skitse`-markering tilbage på nogen
kundeside**, kun på admin-forsiden. `/ny/snak` er bevidst nedlagt og sender
pænt videre.

#### Kode der bør på plads før et hold flyttes

**Advarslen om manglende forbindelse findes ikke i 3.0.** Den gamle app fik den
4. september, efter at en kunde havde mistet to hele dage uden at få det at
vide. Delene ligger i `src/lib/` og kan genbruges, men båndet skal have sin
egen udgave med `ny.css`-tokens, og hvert gem i 3.0 skal igennem
`gemMedVentetid`. Se konventionen i afsnit 6. **Ellers arver de nye kunder den
fælde vi lige har lukket for de gamle.**

#### Mindre ting, ingen af dem blokerer

- **Onboardingens sidste udvej.** Fire linjer, og det er den første skærm en ny
  kunde møder. Se 9.57
- **De to tekster i scanneren** der står forkert på et tomt skema. Se 9.57
- **Mine favoritter på en rigtig telefon.** Aldrig prøvet i en hånd
- **Bonus-skridtet** vises slet ikke i 3.0, og **de låste "Fra forløb"-vaner**
  skal tjekkes på Kickstart-holdet, for de forsvinder lydløst. Hele listen over
  hvad Små skridt mangler står i 9.36
- **Søgeord-feltet på fødevarer.** Søgningen kender kun ét navn ad gangen, så
  "isberg" giver ingenting nu hvor varen hedder Icebergsalat. Samme med
  brocolli og avocado. Slåfejls-slækket løser dem IKKE, se 9.53. Feltet findes
  ikke i data
- ~~**"Nulstil appen på denne enhed"**~~ **Droppet 4. september.** Skal ikke i
  3.0. Findes fortsat i den gamle app

#### Sat på pause af Linn

- **Hensyn på øvelserne.** Admin-siden og reglen findes, men kunden kan ikke
  bede om et hensyn, og **0 ud af 62 øvelser har et mærke**, så et hensyn ville
  alligevel ikke filtrere noget fra. **Linns beslutning 4. september: det
  venter.** Byg ikke videre uden et nyt go. Se 9.33
- **Om en scannet vare skal have et synligt hjerte.** Løst i rækkefølgen i
  stedet, se 9.53. Beslutningen står ved magt

#### Færdigt, men venter på at et hold flyttes

**Beskedsystemet.** Alt virker og er afprøvet hele vejen, men Linns egen regel
er at der aldrig må sendes til en kunde i den gamle app, og lige nu er alle på
nær Kimmie dér. **Det skifter i det sekund et hold får flaget `ny-app`** — der
er ikke mere at bygge.
#### Det Linn selv skal gøre, og som ingen kode kan erstatte

Opdateret 4. september. To af de fem er klaret, og én var forkert.

1. **De fire velkomstvideoer.** Har stået øverst siden 16. august, og er nu
   det eneste der reelt spærrer for at flytte et hold
2. ~~**Tildel de to Kickstart-programmer**~~ **Klaret 4. september**, og
   verificeret som kunden ser det
3. ~~**Sæt mærkerne på øvelserne** under Hensyn~~ **Sat på pause 4. september**
   sammen med resten af Hensyn. 0 af 62 øvelser har et mærke
4. ~~**Slå fluebenet "Vises altid til alle" fra** på Uden redskaber~~
   **DET HER PUNKT ER NU FORKERT og må ikke udføres.** Efter udstyrsreglen 4.
   september, se 9.75, ville det betyde at en kunde uden valgt udstyr slet
   ikke ser noget. Fluebenet skal blive stående. Det er kun den modsatte vej,
   at en kunde uden kettlebells fik tilbudt kettlebell-programmet, der var
   forkert, og den er lukket
5. **Optag en skulderøvelse uden vægt**, hvis den variant skal ramme
   skulderen. Banken har ingen

#### Beslutninger der venter på Linn

- **Q&A kendes kun på titlen.** Der er intet mærke i databasen, så vi leder
  efter "Q&A" i overskriften. Skriver hun en gang "Spørgetime", forsvinder
  den ned i ugerne. Den holdbare løsning er et flueben i admin
- **"Set"-fluebenet er ikke bundet til forløbet.** Genbruges en lektion på
  to hold, viser fluebenet sig begge steder. Noterne har ikke problemet.
  **Fra 22. august gælder det også på tværs af dage, og dér er det med
  vilje**, se 9.37. Skal det på et tidspunkt bindes til holdet, så husk at
  video-nøglen skal med i den binding
- **Beskeder er lukket i de 90 dage.** Det er mit valg og ikke hendes. Hun
  er aldrig blevet spurgt
- **Træningsvideoen fylder ikke skærmen på en stående telefon.** Prøvet og
  rullet tilbage 20. august, se 9.31: vores overlejring dækker kun browserens
  vindue, ikke telefonens skærm. De fire muligheder er tegnet i
  `mockups-traeningsvideo-stor.html`. **Den eneste der virkelig virker er at
  filme øvelserne på højkant**, og den kræver ikke kode. Vimeo løser det ikke
- **Vimeo til træningsvideoerne.** Egen sag, ikke besluttet. Løser IKKE
  fuldskærm, men giver video der tilpasser sig forbindelsen og flytter en
  regning væk fra Firebase, hvor video er det dyreste. Se 9.31
- **De 5 års opbevaring.** Se SPEC 35.4. Kræver et felt der stemples når hun
  åbner appen. Feltet findes ikke, og sletningen er ikke bygget. **Byg den
  aldrig på Firebases login-tidspunkt**, det er målt forkert for 16 % af
  kunderne
- **Indkøbslisten** og **madplanen**. Begge parkeret

#### Ideer der er tegnet, men ikke bygget

- **"Hvad du har lavet"** under Træning, altså en historik med måneder og
  minutter. Tallene ligger i forvejen, Udvikling bruger dem allerede
- **Titlerne på hver træning i programgitteret.** Fravalgt, fordi de 88 så
  bliver til 88 rækker igen

#### Ældre tråde, ikke statustjekket

Forløb-webhooken til Simplero, feature-adgangs-matricen,
forløb-byggeværktøjet, Linn AI under Beskeder, og rettelsen af otte kunders
købsdatoer. **Verificér dem mod koden før nogen regner med dem.**

#### Kendt, ikke rettet

- **Skærmen ser tom ud mens fødevare-databasen hentes.** 2.268 dokumenter
  tager tid på en telefon
- **Makrotallene skrives ikke ud til den gamle app.** Scriptet er klar og har
  kørt tørløb. Synlig ændring for 760 kunder på én gang, så det skal times
- **AI-samtalerne slettes ikke automatisk** efter en måned
- **Repoet er ikke prettier-rent.** Formatér kun de filer du selv har rørt,
  og hold dig fra `ny.css`, hvor prettier omskriver de indlejrede skrifter
- **"isberg" og "brocolli" giver ingenting.** Se 9.53. Slækket tager kun
  slåfejl på ét tegn, og de to er ikke slåfejl
- **Proteindrik, færdig står til 9 g protein og 50 kcal**, hvilket ser
  lavt ud. Varen er skjult, så det haster ikke, men tallet er ikke tjekket
- **Scanneren er stadig ikke prøvet på en Android.** iPhone er bekræftet
  af Linn 25. august. Selve stregkode-læsningen er den gamle apps egen
  komponent, uændret, inklusive de tre Android-rettelser fra 2. juni

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

#### Knapperne og farverne, valgt 25. august

Alle fire er tegnet i `mockups-husk-baand-farve.html`, hvor Linns valg
er markeret.

- **Begge fjern-knapper hedder "Fjern fra retten".** De gør ikke det
  samme, se punktet om de to farver nedenfor, men Linn har taget
  stilling til at ordene alligevel skal være ens
- **Knappen er terracotta**, model E. Før lignede den den grå knap den
  står ved siden af. Rød er bevidst fravalgt: appen bruger den ingen
  steder, heller ikke på spærre-skærmen, og at sige at man ikke tog
  avokado i er ikke en fejl. **Brug ikke `var(--terra)`**, den peger på
  plomme i `ny.css`, se 9.31
- **Flisen der spørger er mørk plomme**, model A. Cremefarvet lå den på
  samme flade som kortene omkring den, og øjet læste den som en del af
  siden. **Honning kunne ikke bruges**, den betyder "du har ændret
  noget" på præcis den skærm, og **grøn betyder klaret**

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
sammen. 227 linjer blev til 117.

**Den fælde du skal kende, hvis du nogensinde rører opdelingen igen:**

**Samle på titlen er forkert.** Det er det oplagte, og det ville have
skjult 83 lektioner. "Din 1%" hedder det samme alle 84 dage men er 84
forskellige lydfiler. Vi samler på url'en.

**Og url'en er heller ikke nok alene.** Linns Zoom-rum er det samme link
hele forløbet igennem, så otte forskellige live-kald ville være blevet til
ét. Det endte med at mødelinks slet ikke kommer med på siden, fordi et link
til et møde i maj er værdiløst i et tilbageblik. Kunden møder stadig linket
på dagen på forsiden mens forløbet kører.

**Ingen thumbnails, Linns rettelse samme dag.** Ét lille ikon, navnet, og
et flueben. Sæt dem ikke tilbage.

Begge fejl blev fanget ved at køre opdelingen mod de rigtige Kropsro-data
med et engangs-script og tælle efter. **Gør det samme hvis du ændrer
reglerne.** Tallet der skal passe er antal viste linjer mod antal unikke
filer. Testene alene fangede dem ikke, for jeg skrev testene ud fra hvad
jeg troede dataene var.

**Åben tråd: Q&A kendes kun på titlen.** Der er intet mærke i databasen.
Skriver Linn en gang "Spørgetime" i stedet, forsvinder den ned i ugerne.
Den holdbare løsning er et flueben på lektionen i admin.

### 9.28 TRAENINGEN BYGGET FORFRA, 19. og 20. august

**Læs SPEC afsnit 36 om foldning før du rører noget her.** Det her er
kortversionen af to lange dage.

Træningen var en liste over programnavne. Nu er den et modul med en fane,
en forside, en programside, en afspiller og et øvelsesbibliotek. Rækkefølgen
her er den Linn valgte.

**TRÆNING HAR SIN EGEN FANE.** Ved siden af 30-30, hvor den hører hjemme.
Prisen er seks faner, og fem er den behagelige grænse på en telefon.
Teksten er sat ned fra 9,5 til 9 px, så "Udvikling" ikke brækker om.
Kolonnerne står **ikke** som et fast tal: i de 90 dage er der kun to faner,
og med `repeat(6)` ville de ligge klemt i venstre side.

**TO DØRE, TO FORMÅL.** Flisen på forsiden fører **direkte** ind på dagens
træning, uden om alt. Fanen fører til træningens forside, hvor hun kigger,
skifter program og vælger en anden dag. Bland dem ikke sammen.

**KLAR-SKÆRMEN.** Træningen gik før i gang i samme sekund siden åbnede. Det
går an når hun aktivt har valgt en dag på en liste. Det går **ikke** an når
forsiden fører direkte ind: en god del af trykkene fra en forside er
nysgerrighed, og så står hun midt i en øvelse i toget. Nu ser hun videoen
køre og trykker selv Start.

**UENDELIGT MANGE TRÆNINGER PR DAG.** Linns beslutning, ordret. Efter en
træning står der "Tag træning 8". Knappen dukker først op når træningen ER
gemt: næste side læser fremgangen forfra, og nåede hun frem før gemningen,
ville den mene at 8 ikke var låst op og sende hende tilbage.

**AFSPILLEREN ER MØRK.** Model B1. Hele fladen bliver mørk mens uret kører.
Appen taler sproget i forvejen med kortet på forsiden, og en træning er en
tilstand man går ind i. De tre andre skærme på ruten er lyse som før.
Bundmenuen forbliver lys, så der er en kant mellem det hun er i gang med og
vejen ud.

**URET LIGGER UNDER VIDEOEN OG IKKE PÅ DEN.** Model L2. Videoen er 16:9 og
altså lav, og uret dækkede en femtedel af den. På en squat var det
underkroppen der forsvandt.

**ÉN STOR KNAP, RESTEN RUNDE IKONER.** Pause er den eneste rigtige knap.
Lyd og stor video er runde ikoner. **Afslut står med ORD**, for et kryds kan
betyde luk vinduet, slet, fortryd eller gå tilbage, og det er den ene knap
hvor hun ikke må gætte.

**TRYK PÅ VIDEOEN HOLDER PAUSE.** Og pause fryser ALT: uret, musikken og
billedet. Før kørte øvelsen videre bag pause-skyen.

**STOR VISNING.** Videoen er 16:9, så på en stående telefon kan den ikke
fylde mere end en stribe, uanset layout. Den bliver stor på to måder: hun
trykker på knappen, eller hun lægger telefonen ned.

Det er **vores egen** visning med CSS og ikke browserens fulde skærm.
Netop derfor virker den på iPhone, hvor Apple kun tillader fuld skærm på
selve videofilen. Vi beder om browserens ovenpå, så kanten også forsvinder
hvor det kan, men intet afhænger af det. Sådan gør den gamle app også.

**PROGRAMSIDEN ER ET GITTER.** Model S1. 88 træninger stod som 88 rækker.
Nu er de nummererede felter, syv i bredden, altså tretten linjer. Grøn er
taget, gul er den næste, bleg er ikke låst op. Titlen på hver træning står
ikke i gitteret: skulle den med, ville de 88 blive til 88 rækker igen.

**ØVELSESBIBLIOTEKET.** Alle 62 øvelser, med video, beskrivelse og trin.
Talt før det blev bygget: **alle 62 har alle tre dele**, ikke én mangler
noget. Bygget som opskriftssiden, så mad og træning opfører sig ens.
Søgningen leder i fire felter, og æ, ø og å kan findes uden at hun skriver
dem.

Siden ligger under **Din side** og ikke under Træning. Det er med vilje: i
de 90 dage har hun ikke træningen, og så er det her det eneste sted hun kan
slå en øvelse op. Der er en vej ind fra træningens forside til den samme
side.

**"Sådan træner jeg" flyttede fra Din side til Træning.** Det er en
trænings-indstilling og ikke noget om hendes konto.

### 9.29 SMÅ TING FRA 19. og 20. august, som er lette at overse

**Siden hedder "Din side" alle steder.** Fanen sagde Profil, overskriften
sagde Din konto. Hun trykkede ét sted og landede et andet. Adressen er
stadig `/ny/profil`, den ser kunden aldrig.

**Alle opskrifter ligger under Din side.** Listen fandtes kun inde i 30-30
som et ark der åbner når hun registrerer et måltid. Ren læsning: ingen
"læg i måltid", ingen ret og slet.

**Materiale er to farvede kort** og ikke to tekstrækker. Sand til mad, grøn
til træning, appens egne farver.

**Bundmenuen er 76 → 58 px.** De 12 pixlers faste luft forneden er skiftet
ud med telefonens egen sikkerhedszone: nul i en browser, ~34 px i en PWA
hvor den SKAL respekteres. Højden står nu ét sted som `--nav-h`, for 76 stod
skrevet tre steder og driver fra hinanden.

**Kurverne fyldte ikke deres kort.** Både forsiden og Udvikling havde en
fast højde sammen med bredde 100 %, og så lægger browseren tegningen midt i
feltet med tom plads i siderne i stedet for at gøre den større. **Den fælde
gælder enhver SVG i appen.** Sæt højden fri.

**Udvikling åbner med alt foldet sammen.**

**Testkontiene har fået et træningsprogram.** Mette og Hanne har begge
"Kettle". Der lå nul tildelinger i hele den nye app før det.

### 9.30 TRE FEJL JEG SELV LAVEDE, OG HVAD DE LÆRTE OS

**En søg-og-erstat der ikke ramte noget.** Jeg skrev en ændring mod en linje
der stod over fire linjer, men formateringen havde klappet den sammen til
én. Ændringen gled lydløst igennem, og stor visning kunne ikke tændes. Alt
CSS'en lå og ventede på en klasse der aldrig kom. **Gør en ændring i en
Svelte-fil ingenting som helst, så se først efter om mønstret overhovedet
fandtes i filen.**

**`:global()` i ny.css.** Det er Svelte-syntaks og virker kun inde i en
komponent. `ny.css` er et almindeligt stylesheet, og en `:global()` heri
gør hele reglen ugyldig, så browseren smider den væk uden at sige noget.

**"Stille" og "usynlig" ligger tættere på hinanden end man tror.** En
"Fold sammen"-knap blev bygget som en grå tekstlinje uden flade. Linn bad om
funktionen igen dagen efter uden at have set den. Er en kontrol den eneste
vej til noget, skal den kunne ses, også når den ikke er hovedhandlingen.

### 9.31 HELE DAGEN DEN 20. AUGUST, SENT PÅ DAGEN

Otte ting gik ud til testerne på én dag. De står her i den rækkefølge de blev
lavet, fordi flere af dem hænger sammen.

**1. AI-INSPIRATOREN ER FJERNET HELT.** Kortet "En hilsen fra Linn AI" under
Dit overskud er væk. Linns ord: det kommer vi ikke til at bruge. Komponenten,
reglerne, de 12 tests, grenen i `/api/ny-ai`, de to gem-funktioner,
`dageSidenAktiv` og CSS'en er slettet. 552 linjer.

To ting står tilbage med vilje. **Felterne `nyInspirator` og
`nyInspiratorAfvist` bliver liggende på kunderne**, de gør ingenting og en
oprydning ville koste et script hen over alle kunder for ingen gevinst. Og
**`inspirator` står stadig i `NyAiLinje`-typen**, fordi de gamle log-linjer
findes og admin-siden i den GAMLE app filtrerer på dem. Sletter du det,
brækker den side. Der står en advarsel i filen.

Forsiden henter stadig to måneders aktivitet ved hver indlæsning. Kun de
seneste syv dage bruges nu. **Vinduet kan sættes ned og ville gøre forsiden
hurtigere.** Ikke gjort, for det var en anden opgave.

**2. ÉT SIDEHOVED I HELE APPEN.** Toppen fandtes i SYV udgaver: `side-top`,
`adm-top`, `ing-top`, `ob-hoved`, `rm-top`, `maaling-top` og forsidens egen.
Tolv sider bar desuden den samme håndrettelse i markup for at få luften til
at passe. Alt det er nu `Sidehoved.svelte` med en `kant`-parameter.

**Sidder hovedet inde i `.ny-pad`, skal `kant={false}` med.** Den ramme har
allerede 17 px i siderne. Det er den ene ting du skal tænke over når du bruger
komponenten.

**To sider bruger den med vilje ikke:** lektionen og træningens afspiller.
Begge er medie-sider uden titel, hvor et mærke ville være støj oven på en
video. Lektionen har sin egen `medie-top`.

**3. TOPPEN ER LÅST OG STÅR PÅ ALLE SIDER.** Linns anden runde samme dag. Den
viser KUN "Linn's Academy" og datoen. Sidernes egne titler ruller med.

**Den er IKKE `position: fixed`.** Den er søster til bundmenuen i den samme
lodrette flex, altså uden for `.ny-scroll`. Derfor kan den hverken gynge eller
dække noget, og indholdet skal ikke skubbes ned med en polstring der bagefter
skal holdes i sync. **Gør det på samme måde hvis der skal noget mere fast
ind.** Højden står som `--top-h` ved siden af `--nav-h`.

**Skrivemåden er `Linn's` MED apostrof.** Logoet har altid haft den, resten af
appen skrev den uden, og de to stod side om side uden at nogen havde valgt.
Nu er det besluttet.

**Logoets terracotta har sit eget token, `--maerke`.** Der ligger en fælde:
`--terra` findes allerede og peger på PLUM. Griber du efter den, bliver
logoet lilla uden at nogen opdager det.

**4. BUNDMENUEN NED TIL 50 PX MED PILLE I STEDET FOR PRIK.** Højden gik fra
76 til 58 til 50 samme dag. Trykfladen er stadig 44 px, det er luften omkring
der er skåret. Markeringen af den valgte fane er nu en blød pille bag ikonet,
model 2 fra `mockups-bundmenu-markering.html`. Se fælden ovenfor om aldrig at
måle en markering fra bunden.

**5. TRÆNINGEN SENDER HENDE TILBAGE HVOR HUN KOM FRA.** Der er to døre ind,
flisen på forsiden og fanen Træning, og afspilleren vidste ikke hvilken. Alle
udgange pegede på træningens forside, så kom hun fra forsiden, blev hun sat af
et sted hun aldrig havde bedt om. Flisen mærker nu sin vej med `fra=forside`,
og alle tre udgange læser den. "Tag træning 8" tager mærket med.

Fejl-skærmens Tilbage-knap peger stadig fast på programsiden. Anden situation,
ikke rørt.

**6. ET FORLØB DER KØRER VISER KUN I DAG OG BAGUD.** Dagene fremad er helt
væk fra listen, ikke bare låst. **Det VENDER Linns egen beslutning fra 18.
august** om at hun skulle kunne se hele forløbet med en lås på. Begge udgaver
har nu været prøvet, så skriv den ikke om igen uden at spørge.

En lektion med et synlighedsvindue frem i tiden forsvinder også mens forløbet
kører. Et GENNEMFØRT forløb viser alt, også rækker der stadig er låst af et
vindue. Ugerne bygges ud fra listen, så tomme fremtidsuger falder ud af sig
selv.

**7. "ALLE DAGE" ER FJERNET** ved dagens lektioner på forsiden. Datostrimlen
fører allerede til hver enkelt dag. **Bemærk at `/ny/forlob` dermed ikke
linkes til fra nogen side.** Siden virker hvis man skriver adressen, men den
er forældreløs. Skal enten have en vej ind eller sløjfes.

**8. HUN KAN SE ØVELSERNE FØR HUN STARTER.** Klar-skærmen viste kun den
FØRSTE øvelses video. De øvrige var usynlige, og kendte hun ikke en øvelse,
kunne hun ikke slå den op uden at starte træningen først. Nu ligger der en
foldet række, "Se øvelserne · 6", under Start-knappen.

**Listen er foldet sammen og ligger UNDER knappen.** Hun åbner skærmen for at
træne og ikke for at læse. Hold fast i det hvis der skal mere på skærmen.

**Arket er det SAMME som øvelsesbiblioteket bruger**, `OevelsesArk.svelte`,
udvidet med to valgfrie ting: en ekstra meta-linje med sæt og sekunder, og
bladring mellem øvelserne. Biblioteket sender ingen af dem og er uændret.
**Retter du noget i arket, rammer det begge steder.**

Bonus-øvelsen står med i listen og er mærket som bonus. Udstyret står i arket
og ikke på hver række, for rækkerne blev for tætpakkede med både sæt, sekunder
og udstyr.

Der kan køre op til seks små videoer på én gang i den udfoldede liste. Det
virkede på Linns telefon 20. august. **Hold øje med det på en ældre telefon.**

### Det der blev prøvet og rullet tilbage samme dag

**Træningsvideoen drejet 90 grader.** Model B fra
`mockups-traeningsvideo-stor.html`. Videoen er 16:9 og en telefon er meget
højere end bred, så i stor visning kunne den kun blive en stribe. Løsningen
drejede hele den store flade, så uret og knapperne fulgte med.

**Den virkede ikke, og grunden er værd at huske.** Vores overlejring dækker
kun det område BROWSEREN giver appen, ikke telefonens skærm. Drejede Linn
telefonen, kom browserens eget vindue til syne udenom. Rullet tilbage samme
dag.

**Det er stadig et åbent ønske.** De fire muligheder er tegnet i mockup-filen.
A er som i dag og virker kun når telefonen ligger ned. C skærer det halve af
billedet væk og duer ikke på en squat. **D, altså at filme øvelserne på
højkant, er den eneste der giver et rigtigt resultat uden at bytte noget væk**,
og den kræver ikke kode. Film på højkant næste gang der optages.

**Og nej, Vimeo løser det ikke.** Spurgt og undersøgt 20. august. Problemet er
ikke hvilken afspiller det er, det er at den der går i ægte fuldskærm på en
iPhone ejer hele skærmen, og så forsvinder uret. Vimeo ville til gengæld give
video der tilpasser sig forbindelsen og flytte en regning væk fra Firebase.
**Det er en selvstændig sag med sin egen pris**, ikke et svar på fuldskærm.

### Nye mockup-filer fra 20. august

- `mockups-sidehoved.html` — fire modeller for toppen. A plus C valgt, og
  siden overhalet af den låste top i punkt 3
- `mockups-bundmenu-markering.html` — seks markeringer af den valgte fane.
  Nummer 2 valgt
- `mockups-traeningsvideo-stor.html` — fire veje til at fylde skærmen, plus
  hele svaret på Vimeo-spørgsmålet. B valgt, prøvet og rullet tilbage
- `mockups-se-oevelserne-foerst.html` — fire måder at kigge øvelserne igennem
  før start. A valgt og bygget

---

### 9.32 DEN 21. AUGUST: TRÆNINGEN BLEV FÆRDIG NOK TIL ET HOLD

Dagen hvor træningen gik fra at virke til at kunne bruges. Ni ting.

**1. DE TO KICKSTART-PROGRAMMER ER BYGGET.** Linns kravspec: 4 øvelser,
45 sekunder arbejde, 15 sekunders pause, **ét sæt** pr øvelse. Det giver
præcis 3 minutters effektiv træning. Slot 1 ben, slot 2 ryg, slot 3
skulder, **slot 4 ALTID planken**. 42 træninger hver, så der er to om
dagen i et 21-dages forløb.

`Kickstart · med kettlebell` og `Kickstart · uden kettlebell`. Begge er
verificeret efter skrivning: alle 84 træninger har fire øvelser, 180
sekunders arbejde, og planken sidst uden undtagelse.

**Ét sæt er nyt.** De gamle programmer kører 3 sæt, hvilket er derfor
Kettle tog over ti minutter. Med Linns tal skal det være ét.

**Banken er tynd uden kettlebell.** Der findes kun to ryg-øvelser og to
pres-øvelser uden vægt, så de går igen hver anden dag. **Og der findes
INGEN ægte skulderøvelse uden vægt.** Incline push-up og dips rammer
bryst og triceps. Skal skulderen med i den variant, mangler der en øvelse
i banken, og den skal optages.

**2. RUNDER, OG EN FEJL DER VILLE HAVE RAMT DEN FØRSTE DER BLEV FÆRDIG.**
Fremgangen gemte ALLE gennemførte numre for altid. Skulle programmet
loope, sagde appen "din næste er nummer 1", men 1 stod allerede på
listen, så der skete ingenting. **Hun sad fast på 1.**

Fremgangen har nu et `runde`-felt. `gennemfoerte` er kun den runde hun er
i gang med. Gamle dokumenter uden feltet læses som runde 1, så der er
ingen migrering.

`naesteTraening3` giver nu **null** når runden er kørt igennem, også på
et program der looper. Hun skal spørges. Tre steder siger det samme:
færdig-skærmen, et bånd på programsiden, og forsidens flise.

**3. HUN VÆLGER NU SELV SIT PROGRAM.** Før fandtes valget slet ikke. Det
stod ordret i koden: "Der er ikke noget gemt valg: hun vælger ved at
begynde." Appen gættede ud fra hvad hun senest havde trænet i.

Det holdt indtil et hold får to programmer. Så kunne hun ikke skifte:
forsiden blev ved med at vise det gamle, indtil hun startede en træning i
det nye, og så var valget truffet uden at nogen var blevet spurgt.

Valget gemmes nu i `valgtTraeningsprogram3` på kunden. **Programrækken
VÆLGER, pilen ÅBNER.** Skifter hun væk fra noget, spørges hun først, og
bliver stående på siden bagefter.

**4. FLUEBENET FØLGER PROGRAMMET, IKKE DAGEN.** Forsiden spurgte "har hun
trænet i dag" uden at skele til hvilket program. Med to programmer
foldede den træningen sammen efter én træning i det ene. Fejlen fandtes
uafhængigt af skift og havde bare ikke kunnet ses.

**5. TRÆNINGSSIDEN RYDDET OP.** Start-knappen fyldte hele bredden og var
appens største knap, på en side hvor intet haster. Den er nu en pille i
højre side med fremgangen ved siden af.

**Og en tekst-dublet:** "Uden redskaber · 42 træninger · 42 træninger ·
ikke begyndt". To stumper skrev begge antallet. `fremgangTekst3` skriver
det ikke længere og bruger lille begyndelsesbogstav, for den står ALTID
efter noget andet.

**"Alle øvelser" vises kun til medlemmer UDEN aktivt forløb.** En
forløbskunde møder øvelserne inde i selve træningen. Hun mister ikke
adgangen: kortet under Materiale på Din side fører samme sted hen og er
urørt, efter Linns ønske.

**6. HELE TOPPEN AF AFSPILLEREN ER FJERNET.** I tre skridt samme dag:
"Øvelse 3 af 6", så "Træning 8", så fremdriftslinjen. Skærmen begynder nu
direkte med videoen. **Bemærk at striben er skjult i stor visning**, så
dér er der ikke længere noget der viser hvor langt hun er.
`procentAfTraening3` har ingen brugere og står med en note.

**7. BYG DIT EGET PROGRAM GENNEMGÅET.** Funktionen fandtes, men var ikke
givet ud til nogen, så knappen var skjult for alle. Den gives i admin
under Byg eget program, hvor **Medlemmer** er en af modtagerne.

Fem ting rettet efter en gennemgang som kunde. **Den værste: hun valgte i
blinde.** Listen viste kun navn og kategori, ingen video. Vælgeren havde
sin EGEN søgning der kun kiggede på navnet, mens øvelsesbiblioteket lige
ved siden af kan det hele. **Nu bruger vælgeren bibliotekets søgning og
bibliotekets ark**, så de tre lister opfører sig ens.

Dertil: to knapper pr række (pilen kigger, plusset vælger), faste valg
for antal træninger ved oprettelsen, og **tempo for hele træningen** i
stedet for tre talfelter pr øvelse.

**Tempoerne er Roligt 30/20, Almindeligt 45/15, Hårdt 50/10.** Linns tal.
**De tre tager IKKE lige lang tid**: Roligt er 50 sekunder pr øvelse, de
to andre 60. Det er noteret i koden, så ingen retter det uden at spørge.

**8. FØDEVARER OG OPSKRIFTER VISES FRA TELEFONENS EGEN KOPI FØRST.**
Telefonen har hver doc liggende i forvejen, men `getDocs` spurgte
serveren alligevel, så skærmen stod og hentede noget vi allerede havde.
Samme fælde som opstarten faldt i 11. august, bare et andet sted.

Fødevarerne er den der betyder noget: 2.268 rækker, langt den største
samling, og det eneste sted i databasen der kunne løbe op på regningen.
**Kopien koster nul læsninger.**

`kost.ts` kunne ikke bruges, for den GAMLE app bruger den seks steder.
3.0 har fået sin egen indgang i `fodevarer3.ts` mod den samme samling.

**9. SE ØVELSERNE FØR DU STARTER.** Se punkt 8 i 9.31, bygget sent den
20. og bekræftet virkende den 21.

### Sådan står træningen nu

| | |
|---|---|
| Programmer i alt | 4 |
| Sat til klar | 2, begge Kickstart |
| Tildelinger | 2, begge til Mette |
| Kunder med `ny-app` | 2 |

**Ingen rigtige kunder kan se 3.0 endnu.** Det er stadig kun Mette og
Hanne. De 18 kunder på KropsRo 16. august har ikke flaget.

### Det Linn selv skal gøre, og som ingen kode kan erstatte

- **De fire velkomstvideoer.** Har stået øverst siden 16. august
- **Fluebenet "Vises altid til alle" på kategorien Uden redskaber.** Det
  er derfor kettlebell-kunder stadig ser kropsvægts-programmerne. Slås
  fra i admin under Kategorier. **Konsekvens:** Uden redskaber bliver
  noget hun skal vælge aktivt, og en kunde der kun har valgt Kettlebells
  ser så ingenting uden redskaber
- **En skulderøvelse uden vægt** skal optages, hvis den variant skal ramme
  skulderen
- **Tildel programmerne til et rigtigt hold.** Stadig den farligste, for
  der kommer ingen fejl når det glemmes. Der kommer bare ingenting

### Nye mockup-filer fra 21. august

- `mockups-program-igennem.html` — når programmet er kørt igennem
- `mockups-skift-program.html` — skift af træningsprogram
- `mockups-traeningssiden.html` — træningssiden ryddet op
- `mockups-byg-eget.html` — byg dit eget, hele arbejdsgangen

---

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

### 9.33 HENSYN PÅ ØVELSERNE, 21. august sent og 22. august

Linns beslutning den 21. august: når en kunde selv bygger et program, skal
hun kunne sige **skån mine knæ**. Det kunne appen ikke, for der stod ingen
steder hvad en øvelse belaster. Kategorien siger Ben, Core og Balance, ikke
hvad der gør ondt bagefter.

**Hun vælger fra en liste, hun skriver ikke en sætning.** Det er det
vigtigste valg i hele funktionen. Et frit felt hvor hun skriver "jeg har ondt
i knæet", og en app der så bygger et program hun udfører, er
fysioterapeutisk rådgivning i Linns navn. En liste med lukkede valg er et
værktøj. Derfor er ordlyden også neutral hele vejen: der står "Skån min
bækkenbund", ikke noget om en diagnose.

**Og AI'en bliver ikke bedt om at lade være.** De fravalgte øvelser er væk
fra den bank den vælger fra. En instruktion kan overses, en tom liste kan
ikke.

#### De seks hensyn

| Det hun trykker på | Det du sætter mærket efter |
|---|---|
| Skån mine knæ | Hård ved knæene |
| Skån min ryg | Belaster ryggen |
| Skån mine skuldre | Belaster skuldrene |
| Skån min bækkenbund | Belaster bækkenbunden |
| Jeg kan ikke ligge på gulvet | Kræver at man er på gulvet |
| Det må ikke larme | Larmer, hop eller vægt mod gulv |

De fire første kom den 21. august. **Bækkenbund og larm kom til den 22.**
Bækkenbunden er den vigtigste af dem alle for målgruppen, kvinder fra 40 og
opefter, og det er noget mange lever med uden at tale om det. Larm er ikke en
skavank, men det er en rigtig grund til ikke at træne: hop og en kettlebell
mod gulvet klokken seks om morgenen i en lejlighed.

#### Mærkerne er Linns faglighed, ikke kodens

Alle 62 øvelser er sat på forhånd, men **det er et forslag og et gæt**, sat
efter hvad de hedder og hvad de åbenlyst gør. Der er en knap i admin der
lægger forslaget ind, og så retter du i det. Dine valg vinder.

Tre steder hvor gættet kan være forkert, og som du bør kigge på først:

- **Planken har IKKE fået bækkenbund.** Dybe mavebøjninger er den klassiske
  synder, mens planken normalt regnes for i orden
- **Pres over hovedet HAR fået bækkenbund**, altså shoulder press og
  thruster, fordi det øger trykket i maven
- **Glute bridge har fået gulv og ikke knæ.** Den foregår på gulvet, men er
  samtidig noget af det mest knævenlige der findes

Fem øvelser står med vilje helt uden mærker: ankelstræk, lægge og balance på
ét ben. De belaster ikke noget særligt.

#### Tallene øverst i admin er det vigtigste på siden

De siger hvor mange øvelser der er tilbage, hvis en kunde beder om ét hensyn
— og nederst, hvor få der er tilbage hvis hun beder om dem alle sammen på én
gang. **Under 8 øvelser kan der ikke bygges et program der er værd at have**,
og så siger appen det til hende i stedet for at levere de samme fire øvelser
hver dag. Uden det tal opdager man først for lidt at vælge imellem når en
kunde står med det.

To regler der hænger sammen med det:

- **En øvelse uden mærker kommer altid med.** Er den ikke nået at blive
  mærket, skal den ikke forsvinde stille. Hellere en øvelse for meget end et
  program der pludselig er tomt
- **Beder hun om to hensyn, respekteres begge.** En øvelse ryger ud hvis den
  har bare ét af de mærker hun har valgt

#### Hvor det ligger

Mærkerne ligger for sig selv, som ingrediens-koblingerne gør for opskrifter.
**Der skrives ikke på den gamle apps øvelser**, se regel 2. Kun du kan sætte
mærker, kunden kan kun læse dem. Der ligger 19 tests på reglerne.

#### Det der mangler, og det er halvdelen

**Kunden kan endnu ikke bede om et hensyn.** Admin-siden virker, mærkerne kan
sættes og gemmes, og reglerne for hvad der så filtreres fra er skrevet og
testet. Men "byg dit eget program" spørger hende ikke, og AI-værktøjet
filtrerer ikke. Funktionen er usynlig for kunden indtil den del bygges.

~~**Firestore-reglen skal udgives.**~~ **Udgivet 22. august kl 16.02**, og
verificeret mod det der faktisk kører. Admin-siden kan gemme.

**Og mærkerne skal sættes.** Forslaget ligger klar, men indtil du har trykket
Gem, står der ingen mærker i databasen, og så filtrerer et hensyn ingenting
fra. Det er den samme slags fælde som de manglende tildelinger i 9.32: der
kommer ingen fejl, der kommer bare ingen forskel.

---

### 9.34 FLUEBENET LIGGER NU OVEN PÅ BILLEDET, 22. august

Lille rettelse, men den fjernede noget hun mistede.

Dagens lektioner viste et flueben **i stedet for** billedet, når hun havde
set en lektion. Rækken blev anonym: hun kunne se at hun havde set noget, men
ikke hvad. Nu bliver billedet stående, og fluebenet lægger sig i øverste
højre hjørne med en lys kant om, så det også kan ses på et lyst billede.

Det gælder alle tre slags, for det var Linns ord: video med sit eget billede
fra Vimeo eller YouTube, lyd med Linns billede i den lilla tone, og læsning
med den farvede flise. Play-tegnet og noden bliver stående, så hun stadig kan
se hvad slags lektion det er.

Der var to muligheder tegnet i `mockups-set-flueben.html`, og Linn valgte A,
det lille flueben i hjørnet. B lagde billedet i skygge med et stort flueben
midt på, og det ville have gjort billedet svært at se lige dér hvor pointen
var at hun skulle kunne se det.

**Kun dagens lektioner er ramt**, altså forsiden og dag-siden. "Dine
lektioner" har ingen billeder, kun små ikoner, og dér ligger fluebenet
allerede rigtigt yderst i rækken.

Det store flueben på 34 px havde kun den ene bruger og er fjernet.

---

### 9.35 HUN VÆLGER NU SELV SINE SMÅ SKRIDT, 22. august

Kortet "Vælg dine små skridt" har stået på forsiden siden juni og ført til
en tom plads. Nu fører det til en rigtig side.

**Det kom ud af en gennemgang mod den gamle app**, funktion for funktion.
Hele listen over hvad kunden og admin kan i den gamle app og ikke i 3.0 står
i 9.36. Det her afsnit er den første af de ting der er bygget.

#### To spor, og de må ikke blandes

- **Et medlem uden forløb** vælger alle sine tre skridt selv. Enten fra Linns
  forslag, som der ligger 14 af i fire kategorier, eller skrevet med hendes
  egne ord
- **En kunde på et forløb** får Linns skridt fra forløbets plan, og dem kan
  hun ikke fjerne. Hun må lægge op til tre af sine egne oveni

**Rettet samme aften:** forløbskunden fik først ingen forslag at se og skulle
skrive alt selv. Linn så det på test-Mette. Nu ser begge de 14 forslag.
Forskellen er hvor valget havner: medlemmets bliver til hendes liste,
forløbskundens bliver til ét af **hendes egne** skridt. Derfor kan et forslag
på det spor ikke genkendes på sit id, kun på teksten, og der står en linje på
skærmen om hvad der sker, så det ikke ligner at hun kan vælge Linns skridt
fra og til

Sådan deler den gamle app dem allerede, og **de to gemmes to forskellige
steder i databasen.** Medlemmets valg ligger i hendes opsætning, forløbs-
kundens egne ligger på hendes forløbs-produkt.

#### Ingen ny datamodel, og det er med vilje

Der skrives med den gamle apps egne funktioner, i de samme felter.
**Kunden kan sidde i begge apper samme dag**, og så skal et flueben lande
samme sted uanset hvor hun sætter det.

Det gælder også en detalje der er let at overse: hendes egne skridt på
forløbs-sporet får præfikset `eg-` på selve svaret. Det er ikke en smagssag,
det er den nøgle den gamle app allerede bruger.

#### To ting jeg rettede i forhold til den gamle side

- **Der er ingen Gem-knap.** Hvert valg gemmes med det samme. Den gamle side
  har en knap nederst, og går hun tilbage uden at trykke, er alt væk
- **Når der er valgt tre, står der hvorfor resten er slukket.** Den gamle
  side gør bare knapperne grå. En slukket knap uden forklaring læser som en
  fejl i appen

Dertil er hendes egne skridt mærket **"Dit eget"** på dagen. Den gamle app
blander de to uden at vise forskel, og så ligner hendes eget noget Linn har
bestemt.

#### To veje ind

Kortet på forsiden forsvinder i det øjeblik hun har valgt noget, så der skal
være en vej tilbage:

- **En diskret linje nederst i dagens kort**, "Tilføj egne skridt". Den hed
  først "Ret dine skridt", og Linn rettede ordlyden samme dag
- **En flise på Din side** der skriver hvad hun har valgt, ikke bare at man
  kan vælge. Linns ønske samme dag. Den virker også som en påmindelse de dage
  hun ikke har været på forsiden

Flisen blev en bred række for sig og ikke en tredje flise ved siden af
Opskrifter og Øvelser. Tre i bredden er trange på en lille telefon, og små
skridt er ikke materiale, det er hendes egen opsætning.

Tegningen med begge planer ligger i `mockups-vaelg-smaa-skridt.html`.

#### "Produkt ikke fundet", og hvad det lærte os

Første gennemgang på test-Mette samme aften: hun fik **"Produkt ikke
fundet"**, cirklen ud for et forslag gjorde ingenting, og hendes eget skridt
kom aldrig på forsiden. Alle tre var den samme fejl.

**Den gamle app gemmer hendes egne skridt inde på kundens
produkt-dokument**, og det dokument oprettes ved køb. Det findes ikke altid:
**begge testkonti har nul produkt-dokumenter**, og admin i klient-mode har
heller ingen. Så fejlede hver eneste skrivning.

3.0 har nu **sin egen skuffe**, ét dokument pr produkt under kunden selv.
**Vi opretter ikke det gamle dokument.** Det læses af den gamle app i drift,
og et halvt dokument derinde er præcis den slags risiko regel 10 handler om.

Der **læses fra begge**, så intet hun har skrevet i den gamle app forsvinder,
og samme tekst to steder vises én gang. Fjern-knappen retter det sted
skridtet faktisk står, og det kendes på id'et: 3.0's egne begynder med
`es3-`.

Reglen der giver hende adgang blev **udgivet 22. august kl 16.02** sammen med
hensyns-reglen, og begge er verificeret mod det der kører.

**Læren, og den gælder bredere end små skridt:** et produkt-dokument er ikke
noget 3.0 kan regne med. Bygger du noget der skal skrive der, så tjek først
om dokumentet findes for testkontiene.

---

### 9.36 SMÅ SKRIDT MOD DEN GAMLE APP: HVAD DER STADIG MANGLER

Gennemgang 22. august, blok for blok. **9.35 klarede punkt 1.** Resten står
her, så det ikke skal findes forfra.

#### Admin

Alt admin-værktøjet virker, for admin bor stadig i den gamle app: fem slags
tidsplaner pr skridt, hvor mange dage det rammer, redigér, slet, og Publicér
til appen. Men **to ting du kan lave nnår ikke ud i 3.0:**

- **Bonus-skridtet på en dag.** Både forløbets bonus og medlemmernes
  bonus-spørgsmål fra puljen, hvor der ligger 90. 3.0 viser det slet ikke,
  heller ikke notefeltet der hører til
- **De låste "Fra forløb"-vaner**, altså vaner tildelt et helt forløb for en
  bestemt uge. Ingen admin-side laver nye længere, men de kan ligge i data på
  eksisterende forløb. **Det skal tjekkes for Kickstart-holdet inden det
  flyttes**, for de forsvinder lydløst

#### Kunden

1. ~~Vælge sine små skridt som medlem~~. **Klaret 22. august**, se 9.35
2. ~~Tilføje sine egne oveni på et forløb~~. **Klaret 22. august**, se 9.35
3. ~~**Svare Delvist.**~~ **Afgjort 22. august: den kommer IKKE med.** Linns
   beslutning, og den skal ikke tages op igen.

   Den gamle app har tre knapper pr skridt: Ja, Delvist, Nej. **Delvist
   findes kun for at blødgøre Nej.** 3.0 har ingen Nej-knap, og et skridt hun
   ikke tog er bare ikke markeret. Så er der ikke noget at blødgøre.

   **Bygger nogen den alligevel, kommer Nej med af sig selv**, for ellers kan
   hun ikke se forskel på "jeg nåede det halvt" og "jeg har ikke rørt den
   endnu". Og så er karaktergivningen tilbage på en side der efter Linns
   regel aldrig må læse som en anklage, se 9.26.

   Feltet i databasen rummer stadig det tredje svar. Det bliver liggende, for
   den gamle app skriver det, og gamle svar skal kunne læses
4. **Bonus-skridtet**, se admin ovenfor
5. **Baseline på dag 0 og slut-refleksionen på dag 21**, hvor hendes eget
   svar fra dag 0 stilles op ved siden af. Findes ikke i 3.0
6. **Oversigten over alle dage med farver** efter hvor meget hun ramte, plus
   forklaringen på farverne. Medlemmer har et måneds-arkiv. 3.0 har en
   dag-liste på `/ny/forlob`, men den er sort/hvid og forældreløs
7. **Statistikken:** "Små skridt opnået" i procent, og velvære-trend over 7
   og 30 dage
8. **De låste vaner fra forløbet** som medlem, mærket "Fra forløb"
9. **Velkomstkortet** første gang hun åbner små skridt

Tegningen der lå til grund for beslutningen om Delvist er
`mockups-delvist-knappen.html`, hvor de to sidder ved siden af hinanden.

**To ting er bedre i 3.0 og skal ikke tilbage:** svaret gemmes med det samme
uden en Gem-knap, og der står ikke "3 af 5 gennemført" på dagen. Det sidste
er Linns regel om at en side aldrig må læse som en anklage, se 9.26.

---

### 9.37 FLUEBENET FØLGER VIDEOEN OG IKKE DAGEN, 22. august

Linns spørgsmål: på Kropsro ligger den samme video på alle syv dage i ugen.
Ser hun den mandag, hvad møder hun så tirsdag?

**Svaret var: en umarkeret lektion.** Hun skulle sætte flueben på den samme
film syv gange. Linns beslutning samme dag: fluebenet skal følge lektionen
til de andre dage.

#### Hvorfor det ikke bare var at slå op på id'et

Jeg tjekkede alle forløb i databasen først. **Der findes ikke ét sted hvor
det samme lektions-id går igen på to dage.** Kropsro har den samme film
liggende på dag 1 til 7, men som syv selvstændige lektioner med hvert sit id.
Appen kendte dem derfor som syv forskellige ting.

Så identiteten måtte komme fra **videoens adresse**. Den renses først, for
den samme film står med `?share=copy` det ene sted og `#t=0` det andet.

#### To nøgler pr lektion, og hvorfor

Når hun ser noget, gemmes nu **både lektionens eget id og en nøgle for
videoen**. En lektion tæller som set hvis én af dem findes.

**Det er derfor intet flueben forsvandt ved ændringen.** Alt der blev
markeret før 22. august har kun sit id, og det virker uændret. En lektion
uden video, altså en tekst, kendes stadig kun på sit id.

Fortryder hun på tirsdag, ryger både tirsdagens id og video-nøglen. Mandagens
eget flueben bliver stående, for det er den dag hun faktisk markerede.

#### Fem steder, og de skal blive ved med at være enige

Dagens lektioner, selve lektions-siden, forløbets dagliste, Dine lektioner,
og optællingen "3 af 12 set". **Bygger du et sjette sted hvor status vises,
så brug `erSet3` og ikke `klaret.has(id)`.** Der er ingen anden regel.

#### Konsekvensen, som Linn er blevet spurgt om først

Har hun set mandagens video, står **hele ugen** som set, og de dage folder
sig sammen som taget. Det var det hun bad om, og det er ikke en fejl når det
ses.

---

### 9.38 UDVIDET NÆRINGSDATA, 22. august

Det startede med et spørgsmål fra Linn: hvorfor siger appen at test-Mette har
brug for 105 g protein om dagen?

**Svaret var at tallet var tastet ind.** Ikke beregnet, ikke standarden. Begge
testkonti havde de samme fem runde tal og ingen fysisk profil. De blev fjernet
fra Mette samme dag efter Linns ja, så hun møder standarden som en ny kunde.

Undervejs blev det tydeligt at halvdelen af udvidet næring allerede fandtes i
3.0: Mad-modulet viser kulhydrat, fedt og kalorier. Det der manglede var
hendes egen kontakt, hendes egne mål, og at tallene også står på forsiden.

#### Hvad kunden fik

**Siden "Dine mål"** under Din side. Protein og fiber står ALTID, og det er en
rettelse af den gamle app: dér er de to felter låst bag den kontakt der
handler om de tre andre, så hun ikke kan rette sit protein-mål uden også at få
kalorier at se.

**Kontakten** lægger kulhydrat, fedt og kalorier til. Den er hendes egen og
står på fra som standard.

**Guiden** er fem spørgsmål på ÉN side. Den gamle er seks skærme i træk med en
knap mellem hver. Resultatet regner sig om mens hun svarer, og **regnestykket
er den gamle apps eget** — to steder der regner protein forskelligt er værre
end ingen beregner.

**Guiden står ALTID fremme.** Den lå først bag kontakten, som i den gamle app,
og Linn fangede det med det samme: så kan hun ikke få sit protein-mål beregnet
uden også at slå kalorier til. Det er nøjagtig den fejl der blev rettet på
felterne en time før, og som blev glemt på guiden.

**Resultatet viser kun det hun har slået til.** Uden udvidet næring står der
protein og fiber og intet andet. De tre andre **gemmes alligevel**, så de står
klar den dag hun slår dem til, men et kalorietal skal ikke dukke op på en
skærm hun ikke har bedt om.

**Derfor kan den gamle apps gem-funktion ikke bruges.** Den slår udvidet
næring TIL som en sidegevinst. Det gav mening dengang guiden kun kunne nås når
kontakten allerede var slået til. 3.0 skriver de to felter og rører ikke
hendes kontakt, se `firestore/naeringMaal3.ts`.

**På forsiden** står de tre som en stille linje under protein og fiber, uden
bjælker. Fem bjælker gør kortet til et regneark, og en bjælke på kalorier
læser som en grænse hun er ved at overskride.

#### Hvad Linn fik, og hvorfor det blev en ny admin-side

Linns krav: alle medlemmer må have det, hun skal kunne slå det til og fra pr
forløb, og et enkelt kunde-valg skal kunne overrule forløbet. Det samme for
om kunden må rette sine egne mål.

**"Funktioner og adgang" i den gamle admin kunne ikke bruges.** Den styrer det
samme i dag, men **pr kundetype** og ikke pr forløb, og den styrer den GAMLE
app for 760 kunder samtidig. 3.0 fik derfor sin egen side, og den gamle står
urørt.

**Tre lag, og rækkefølgen er hele reglen:**

1. En **undtagelse** på kunden vinder
2. Ellers gælder **forløbet**
3. Ellers gælder linjen for **alle medlemmer**
4. Og selvom hun må, ser hun det først når hun **selv** slår det til

**ALT ER TIL SOM STANDARD.** Linn slår fra, ikke til. Ellers ville kunder der
har noget i dag pludselig miste det.

**De to kontakter afgøres hver for sig.** Sætter Linn en undtagelse der kun
siger noget om den ene, arver den anden videre ned. Ellers ville ét flueben
komme til at slå noget fra hun aldrig tog stilling til.

#### To ting der er værd at huske

**Undtagelserne ligger i deres egen samling og ikke i det fælles skema.** Alle
kunder skal kunne læse skemaet for at vide om de må, og lå navnene der, kunne
enhver kunde se hvem Linn ellers havde taget stilling til.

**Mad-modulet i 3.0 er lagt om til det nye skema.** Gjorde vi ikke det, kunne
hun slå noget til på sin profil og opdage at det ikke virkede inde i Mad. Det
gælder måltidssiden, opskrifterne og onboardingen. AI-opskrift spørger stadig
det gamle skema, og det er med vilje: den styrer også den gamle app.

#### En fejl fundet undervejs

**Forsiden faldt tilbage på målet NUL** når kunden ikke havde sat et. Så stod
der "56 af 0 g", og dagen blev kaldt i hus. Den faldt først frem da Mettes
tal blev slettet. Nu falder den tilbage på standarden, 90 g protein og 30 g
fiber, som resten af appen gør.

Reglerne blev udgivet 22. august kl 21.49 og verificeret mod det der kører.

---

### 9.39 BESKEDER PÅ TELEFONEN, 23. august

Linns spørgsmål: kan vi give kunden en notifikation når du har svaret, eller
når hun har nået et mål?

**Svaret på den sidste halvdel er nej, og det er med vilje.** "Du har nået dit
mål" sker mens hun har telefonen i hånden, og så kan appen sige det selv. En
notifikation om noget hun lige har gjort er støj. Notifikationer er kun værd
at bygge til **det der sker mens appen er lukket.**

#### Forudsætningen, som Linn traf beslutning om

På iPhone virker det **kun** når appen ligger på hjemmeskærmen. Det er Apples
regel. Jeg foreslog at måle hvor mange der har gjort det, før vi byggede.
Linns svar: vi forudsætter at kunderne følger vores instruktioner. Så det gør
vi, og opstarten viser vejledningen.

#### Tre slags, og karantænen

| | |
|---|---|
| **svar** | Linn har svaret. Højst én hver sjette time |
| **dag** | Dagens indhold er klart. Højst én i døgnet |
| **savn** | Der er gået for lang tid. Højst én om ugen |

Karantænen er ikke pynt: svarer Linn tre gange på ti minutter, bliver det til
**én** besked. Uden den slår kunden det fra, og så er kanalen væk for altid.

**Både Linn og kunden skal sige ja**, og kunden vinder når hun slår fra. Tre
lag som med næringen: kundens valg, forløbet, medlems-linjen.

#### Afsendelsen, og hvorfor der ikke er nogen tredjepart

Vi sender **direkte til telefonen** med Web Push, som alle browsere taler.
Ingen Firebase Cloud Messaging, ingen konto, ingen regning, og ingen der får
kundernes adresser at vide.

To ting sker for hver besked: vi underskriver os selv over for telefonens
push-tjeneste, og vi låser indholdet med telefonens egen nøgle. Hverken
Google, Apple eller vi kan læse det undervejs.

**Krypteringen er BEVIST og ikke bare skrevet.** Testen spiller telefonens
rolle: den låser beskeden op igen og tjekker at der står det samme, også med
æ, ø og å, og at en anden telefon ikke kan. **Den slags fejler lydløst** — en
byte galt giver en besked telefonen bare smider væk uden at sige noget.

Nøglerne ligger i Cloudflare som `NOTI_NOEGLE_OFFENTLIG`, `NOTI_NOEGLE_PRIVAT`
og `NOTI_KONTAKT`. Den offentlige står også i klarteksten i
`utils/notiTilmeld3.ts`, og det er meningen: den er lavet til at deles.

#### KUN 3.0, og det står to steder

Linns krav: der må aldrig sendes til en kunde i den gamle app. Der spørges kun
om lov på `/ny`, **og** endpointet tjekker adgangen igen lige før der sendes.
To låse om det samme, med vilje.

#### Opstarten, og prøven

Linns idé, og den er bedre end mit forslag om at vente til hun stiller et
spørgsmål: i opstarten er hun i gang med at sætte ting op og forventer at
blive spurgt.

To trin, og de hænger sammen. Ligger appen ikke på hjemmeskærmen, vises
vejledningen, og beskederne springes over — et ja ville alligevel ikke virke.
Hun møder dem når hun åbner fra ikonet. **Begge trin forsvinder når de er
overflødige**, og tælleren følger med.

**Prøven er Linns idé og den vigtigste detalje.** Vi sender én besked med det
samme, og hun bekræfter at den kom. Uden den opdager hverken hun eller Linn at
noget er galt før den dag et rigtigt svar aldrig kom frem. Kunden må derfor
sende netop den ene slags til sig selv; alt andet er kun for admin.

#### Automatikken, og de ni linjer i den gamle app

Linn svarer i den GAMLE apps admin, to steder. Der er tilføjet **én linje**
hvert sted efter at svaret er gemt, plus en import. Linns ja, efter at have
fået den præcise ændring forelagt.

Det er ni linjer i alt, og **de to filer er admin-sider**: går noget galt der,
rammer det Linn og ikke de 760 kunder. Alt det svære ligger i en ny fil
udenfor, så der ikke skulle skrives andet ind i dem.

**Den fejler aldrig opad.** Går afsendelsen galt, er svaret stadig gemt, og
Linn ser ingen fejl. En besked der ikke kom frem må aldrig kunne se ud som om
svaret ikke blev sendt.

#### Hvad der IKKE er bygget endnu

- **"Dagen er klar" og "der er gået lang tid"** kræver noget der kører af sig
  selv hver morgen, og det findes ikke i dag. Reglerne og teksterne er skrevet,
  men der er ingen der kalder dem
- **Mail som reserve.** Linns beslutning: vi bruger vores egen afsender, ikke
  Simplero, og hun har adgang til domænet. Kontoen er ikke oprettet endnu.
  Reglen ligger klar i `vaelgKanal3`: **mail er en reserve, ikke en kopi.** Kan
  hun nås på telefonen, sender vi kun dér

---

### 9.40 3.0 FIK SIT EGET IKON, 23. august

Linn kunne ikke lægge 3.0 på sin hjemmeskærm: ikonet blev ved med at åbne den
gamle app.

**Telefonen læser ét sted hvad appen hedder og hvor den åbner**, og der stod
`/app`. Filen er fra dengang der kun var én app, og den deles af begge.

**Linn bruger begge apper**, så den gamle skiftes ikke ud. Hun skal have to
ikoner der kan kendes fra hinanden: "Linn's Academy" med uendelighedstegnet
mod `/app`, og **"Linn's 3.0" med det store L** mod `/ny`. Hendes valg af navn
og ikon, hvor L'et er det samme som i notifikations-mockup'en.

**Ingen eksisterende fil er rørt.** To nye: én der beskriver 3.0's ikon, og
`hooks.server.ts`, som ligger i vejen for alle sider og derfor kun gør ÉN ting
— på `/ny` bytter den tre linjer ud. Alt andet går igennem urørt.

**iPhone læser hverken navn eller ikon fra manifest-filen.** Den bruger to
linjer i sidehovedet, og de vinder over alt andet. Havde jeg kun byttet
manifestet, var der ikke sket noget synligt overhovedet.

**De 760 i drift mærker ingenting.** Deres ikon ligger der allerede, og
telefonen huskede adressen den dag de lagde det på. Lægger en af dem det på i
morgen, får hun stadig den gamle app.

**Den dag 3.0 afløser den gamle** ændres navnet tilbage til "Linn's Academy",
og den gamle lades dø.

---

### 9.41 NÅR HUN TRYKKER PÅ BESKEDEN, 23. august

Beskeden virkede. Det der manglede var hvad der sker i det sekund hun trykker.

**Den pegede på Beskeder, men ikke på fanen.** Hun har to, Linn AI og Linn, og
hun landede på den hun sidst brugte. Hun blev lovet et svar og skulle selv
lede efter det.

Nu peger den på fanen, skærmen ruller ned til det nye svar, og det får et bånd
der siger "Nyt svar". **Der rulles kun ÉN gang**: hun skal kunne rulle væk
uden at skærmen hiver hende tilbage. Båndet forsvinder når hun har været inde
på fanen, for et mærke der bliver stående holder op med at betyde noget.

#### Login husker hvor hun var på vej hen

Uden det landede hun på forsiden efter login, og så havde beskeden reelt ikke
virket. Der står nu "Log ind, så viser jeg dig det du blev sagt til om."

**Adressen kommer fra en besked udefra, så den er også en lås.** Kun stier der
begynder med `/ny` accepteres. Testen nævner fælderne ved navn, og de er alle
sammen rigtige angreb — også den med to skråstreger, der sender hende ud af
appen uden at ligne det.

#### Striben, når appen allerede er åben

Telefonen viser typisk ingenting når appen er fremme. **Vi river hende ikke
væk fra det hun er i gang med:** beskeden lander som en stille stribe øverst
hun kan trykke på eller lade ligge. Den forsvinder efter otte sekunder, og
kommer der én til, erstatter den den første. Den ligger under ark og modaler,
så den aldrig dækker noget hun skal trykke på.

---

### 9.42 VI MÅLER SELV OM HUN HAR VÆRET INDE, 23. august

Savn-beskeden bygger på det. **Det kan ikke læses på hvornår hun sidst loggede
ind:** med appen på hjemmeskærmen er hun logget ind i månedsvis uden at åbne
noget. Det tal lyver, og det har det gjort før.

Skallen stempler `sidstAktiv3` når hun åbner appen, **højst hver sjette time**,
så hendes mange åbninger på en dag ikke bliver til mange skrivninger.

Feltet er 3.0's eget og står bevidst ikke i den delte bruger-type: den fil
hører til den gamle app og må kun læses.

---

### 9.43 LINN KAN SKRIVE TIL EN KUNDE, 23. august

Linn sendte et prik til test-Mette. Notifikationen kom, men **der var ingen
besked at læse**, og trykket landede på forsiden.

Det var ikke en fejl. Det afslørede et hul: **Linn kunne kun SVARE på noget
kunden selv havde spurgt om.** Hun kunne ikke skrive først. Det havde aldrig
været bygget, hverken i den gamle app eller i 3.0.

#### Sådan virker det nu

Beskeden lander som en rigtig tråd i kundens Beskeder, med Linns tekst og
**ingen boble ovenover**: kunden har ikke spurgt om noget. Under den kan hun
svare, og svaret bliver et helt almindeligt spørgsmål der lander i Linns egen
liste. **Der er ikke en ny indbakke at holde øje med.**

Tråden ligger som **besvaret**, så Linns liste over ubesvarede bliver ved med
at være rigtig. Svarer kunden, hopper hendes svar op i listen som noget nyt.

Notifikationen siger **"Linn har SKREVET til dig"** og ikke "svaret". Hun har
ikke spurgt om noget, og det forkerte ord ville få hende til at lede efter sit
eget spørgsmål.

#### To ting der kostede tid

**Det sker på serveren.** Reglerne i databasen siger at kun kunden selv må
oprette en tråd med sit eget navn på, og det er en god regel. I stedet skriver
serveren den, hvor adgangen allerede er tjekket. Så slap vi for at åbne noget
for alle. Serveren kunne til gengæld ikke skrive et rigtigt tidsstempel, og
uden det kunne den gamle admin ikke læse tråden — det er tre linjer i
`firestoreRest`, rent tilføjet.

**SVARFELTET BLEV ALDRIG TEGNET.** Første gennemgang: beskeden kom frem, men
kunden kunne ikke svare. 3.0 hentede trådene gennem den gamle apps funktion,
og **den bygger en fast form med kun de felter den selv kender**. Mærket "det
her skrev Linn først" var ikke ét af dem, så det forsvandt på vejen. Skærmen
troede at hun havde spurgt om noget, og så er der ikke noget svarfelt.

Den slags er svær at få øje på: der er ingen fejl nogen steder, alle led
virker, og feltet er bare ikke der. **3.0 læser nu selv de samme dokumenter.**

---

### 9.44 BESKED PÅ FORSIDEN, 23. august

Linns skelnen, og den er rigtig: **en besked til én kunde er en samtale. En
generel oplysning er det ikke.** Q&A i aften, nye opskrifter, en ferie.

**ÉN BOBLE, ALDRIG TO.** Forsiden havde allerede en talebobbel fra Linn,
bundet til dagen i et forløb. Den generelle står nu øverst, dagens note under
med sit dagnummer og en tynd streg imellem.

**Medlemmer uden forløb har aldrig haft en vej ind på forsiden.** Nu har de en.

**Alt har en slutdato**, og "i dag" er standarden. Uden den bliver forsiden en
opslagstavle der aldrig ryddes. "I dag" betyder **til midnat** og ikke om 24
timer: skriver Linn klokken 9 om noget i aften, skal den være væk når kunden
står op.

**Passer to på samme kunde, vinder den nyeste.** Et hold-opslag fra i dag skal
ikke ligge under en generel besked fra i mandags.

**Vejen videre står i boblen.** Hun vil svare på den, og der er ikke noget at
svare i: uden linjen trykker hun og opdager at der ikke sker noget.

Linn kan **rette og fjerne** den bagefter, og det er hele forskellen på den og
en besked til én kunde, som er afleveret i det sekund den er sendt. Retter hun
teksten, bevares både tidspunktet og slutdatoen: en stavefejl skal ikke
forlænge beskeden eller skubbe den foran de andre.

---

### 9.45 VAGTEN, 23. august

Et lille vækkeur hos Cloudflare, i mappen `vagt/`. **Det ved ingenting selv:**
alt om hvornår der sendes, til hvem og hvad der står ligger i appen, hvor Linn
kan ændre det i admin.

**DEN BANKER PÅ HVER TIME, og det er sommertidens skyld.** 6.15 dansk er ikke
det samme klokkeslæt hele året, og en fast tid ude hos vagten ville rykke sig
en time om vinteren uden at nogen opdagede det. Appen svarer kun ja i den ene
time, regnet i dansk tid.

Vagten har **ingen dør ud til nettet** og kender en nøgle appen også kender.
Afprøvet 23. august: med nøglen svarer den "ikke-tid", uden den "Ikke vagten".

**Højst én besked pr kunde pr morgen.** Er der noget nyt i dag, får hun "Dag 12
er klar". Er der ikke, og har hun været væk for længe, får hun et savn. Aldrig
begge: to beskeder om det samme er én for mange.

**Den går ud fra TELEFONERNE og ikke fra kundelisten.** Kun de få der har sagt
ja kan nås, og en gennemgang af alle 760 for at finde dem ville vokse med
kundetallet. Forløbene læses ÉN gang og ikke pr kunde.

**Én kunde må ikke vælte resten.** Fejler en telefon, fortsættes til den næste.

Linns to rettelser samme dag: **pauser trækkes fra dagnummeret** (ellers kalder
beskeden dagen noget andet end appen gør), og **træning tæller med som noget
nyt** (en Kickstart-dag kan være ren træning, og så tav vagten om det eneste
der var).

**Prikket til et hold** sendes når Linn sætter en forsidebesked op med
kontakten slået til. **Kun når den er ny:** retter hun en stavefejl, skal
holdet ikke prikkes igen.

---

### 9.46 TO FEJL DER KOSTEDE TID, OG HVAD DE LÆRTE OS

#### Et manuelt send gjorde appen tavs bagefter

Linn svarede test-Mette fra den gamle admin, og der kom ingen notifikation.
Ikke en fejl i afsendelsen: **karantænen slog til.**

Trykker Linn selv send, springes karantænen over — men vi stillede også uret.
Så var den AUTOMATISKE besked lukket ude i seks timer bagefter. Hun skrev til
Mette, svarede hende et kvarter senere, og kunden hørte ingenting.

**Uret stilles nu kun af det der sker af sig selv.** Linns eget tryk er hendes
beslutning, og det skal ikke gøre appen tavs.

**Og karantænen på svar er helt væk.** Linns beslutning: hver besked fra hende
er sin egen notifikation. Før gik der seks timer imellem, og så sad kunden og
ventede på et svar der allerede lå der. De to står også som TO på låseskærmen
nu — før erstattede den nye den gamle.

#### Svaret stod der først lidt senere

Linn trykkede på notifikationen, og svaret var der ikke. Det dukkede op lidt
efter.

**Appen åbner den side den allerede stod på, med det den hentede sidste gang.**
Beskeder hentede kun sine tråde én gang, og en telefon der har ligget i lommen
i tre timer står med tre timer gamle data.

Beskeder henter nu forfra **hver gang skærmen bliver synlig igen**. Ikke i en
løkke: en app der ligger fremme henter ingenting af sig selv. Det samme på
forsiden og i striben.

**Læren, og den gælder bredere:** en PWA lukkes ikke ned mellem gangene. Alt
der hentes én gang ved åbning, står stille indtil nogen beder om andet.

---

### 9.47 MAILEN, 23. august

Sidste brik. **Mail er en RESERVE og ikke en kopi:** kan hun nås på telefonen,
sender vi kun dér. Ellers ville hun få alting to gange og slå begge dele fra.

Den rammer dem vi ellers ikke kan nå: kunder uden appen på hjemmeskærmen, dem
der har sagt nej, og dem der sidder ved en computer.

**TO SLAGS MAIL, og forskellen er ikke pynt.** Et svar fra Linn er noget hun
har BEDT om, og der står ingen afmelding nederst. Et savn er tættere på
markedsføring, og der SKAL stå en vej ud. **Der ligger en test der falder hvis
de to bytter plads.**

Emnelinjen siger altid hvad det handler om og aldrig "ny besked fra appen".
Hun skimmer en indbakke.

Layoutet er bevidst gammeldags, og der er altid en ren tekst-udgave ved siden
af: en mail skal kunne læses i alt fra Outlook til en gammel telefon, og for
mange billeder med for lidt tekst ligner en reklame for et spamfilter.

**Proeven i opstarten sendes aldrig som mail.** Hele pointen med den er at se
at telefonen virker.

#### Opsætningen, som er gjort

- **Resend**, gratis-planen: 3.000 mails om måneden, **100 om dagen**. Den
  daglige grænse er den eneste der kan bide. Den dag alle er på 3.0 og der går
  en morgen-besked ud, skal der opgraderes til ca. 140 kr/md
- **Domænet er verificeret** 23. august kl 21.26. Tre poster hos Simply.com på
  `send.linnsacademy.dk`: DKIM, MX og SPF. **Kundens almindelige mail på
  linnsacademy.dk er ikke rørt** — den har sin egen MX mod Simply
- Kontoen ligger i **eu-west-1**, altså Irland. Inden for EU
- `RESEND_API_KEY` og `MAIL_FRA` ligger i Cloudflare. Afsenderen er
  **Linn \<linn@linnsacademy.dk>**, og svarer en kunde på mailen, går svaret
  dertil
- Prøvemail sendt og modtaget samme aften

---

### 9.48 MAILENS UDSEENDE, 23. august sent

Mailen virkede, men den så ud som en programmør havde sat den op. Linn bad om
at få den tegnet ordentligt, og der blev lavet tre runder mockups: én til
svaret, én til den generelle, og én mere til svaret bagefter.

Alle tre ligger i `linns-academy-design/`: `mockups-mail-design.html`,
`mockups-mail-generel.html` og `mockups-mail-svar.html`. **Læs dem hvis du
skal røre mailen** — de forklarer hvorfor hver detalje er som den er.

#### Svaret: "Samtalen". Linns valg

**Hendes eget spørgsmål står ovenover Linns svar**, i de samme to bobler som i
appen: hendes i sand, Linns i blomme med et L ved siden af.

**Det er hele grunden til at den vandt.** Der kan gå dage mellem spørgsmål og
svar, og uden hendes egen tekst læser hun et svar på noget hun har glemt hun
spurgte om. Spørgsmålet følger derfor med hele vejen fra den gamle admin,
gennem endpointet, ud i mailen.

**Emnet nævner HENDES EGNE ORD:** "Svar på: Jeg er så træt om eftermiddagen…"
og ikke bare "Linn har svaret dig". Det første bliver åbnet, det andet bliver
skimmet.

**Bogstavet L og ikke et foto.** Det holder når billeder er slået fra, og det
er 3.0's ikon i forvejen.

**Ingen afmelding på et svar.** Det er noget hun har bedt om, og en
afmelde-linje ville gøre et personligt svar til en udsendelse.

#### DEN KORTE FORM BLEV BYGGET OG FRAVALGT SAMME AFTEN

Der var først en kortere udgave uden ramme til svar under hundrede tegn:
tanken var at opsætningen ville fylde mere end svaret. **Linn så den i sin
egen indbakke og fravalgte den.**

Hendes begrundelse er den rigtige, og den skal stå her: **et svar på to linjer
uden ramme læser som om der ikke blev taget tid til hende.** Det er præcis
forkert på et spørgsmål om hendes helbred, og der er ingen måde at vide på
forhånd hvornår et kort svar er et hastigt svar og hvornår det bare er præcist.

Der ligger nu en test der falder hvis nogen bygger den igen.

**Skriver Linn FØRST, er der ikke noget spørgsmål at vise.** Så falder den
øverste boble væk, og der står "Linn skrev til dig" i stedet for "Linn
svarede". Før faldt det tilfælde tilbage på den korte form, som ikke findes
mere.

#### Den generelle: opslag eller invitation, Linn vælger pr besked

- **Opslaget** har mærket i toppen, én knap, og "Skru ned for mails" i bunden.
  Til alt det almindelige
- **Invitationen** sætter tidspunktet stort og øverst i et mørkt felt, og
  først i emnelinjen. Til det der sker på et klokkeslæt

**De to ser ens ud på forsiden i appen.** Det er KUN mailen der skifter form,
og det står på admin-skærmen, så ingen leder efter en forskel der ikke er der.

Overskrift-feltet står **kun i mailen**. Boblen på forsiden har kun teksten.

#### Håndværket, som gælder alle mails herfra

- **Ét formål, én knap.** To knapper halverer hvor mange der trykker på den
  vigtigste
- **Afsendernavnet er en beslutning:** "Linn" til det personlige, "Linn's
  Academy" til det fælles. Hun kan se forskel inden hun åbner
- **Layoutet er bevidst gammeldags** med tabeller og uden baggrundsbilleder.
  En mail skal kunne læses i alt fra Outlook til en gammel telefon
- **Der er altid en ren tekst-udgave** ved siden af den med layout
- **Skriv altid linjen til dem der ikke kan.** "Optagelsen ligger i appen
  dagen efter" gør mailen nyttig for hele holdet
- **Ingen mail uden en vej ud** — bortset fra svar. Og der står "Skru ned for
  mails", ikke "afmeld": hun skal have færre, ikke forsvinde

---

### 9.49 FØDEVARE-KILDERNE, tjekket 24. august

Der er **fire kilder**, og de opfører sig meget forskelligt. Tallene her er
læst direkte i databasen 24. august og er de samme som 13. august.

#### Den fælles liste: 2.268 fødevarer

| Kilde | Antal | Hvad det er |
|---|---|---|
| **Frida** | 1.381 (61 %) | Den officielle danske fødevaredatabase fra DTU |
| **Kickstart-listen** | 840 (37 %) | Dem Linn selv har lavet til appen. Står uden `kilde`-felt |
| **Scannede** | 47 (2 %) | Fra stregkoder. Alle 47 har et rigtigt stregkodenummer |

**Men kunderne spiser 79 % fra Kickstart-listen og kun 11 % fra Frida.** De 20
mest brugte madvarer er alle sammen Linns egne. **Frida er komplet og
upraktisk, Linns liste er lille og rigtig**, og det er den vigtigste
oplysning i hele afsnittet.

**Frida alene ville gøre det værre.** Søger man på æg i Frida, er de otte
øverste andeæg, gåseæg, tørret æg og æggeblomme. Tørret æg har 564 kalorier,
og intet i navnet advarer om det.

#### Kundens egen liste

Hver kunde har sin egen, private samling i `users/{uid}/customFodevarer`.
Opretter hun en fødevare, ligger den **kun** hos hende. Linns regel 12. august,
og den kom netop af at de scannede før kunne ses af alle.

#### Open Food Facts

International database med produkter og stregkoder. Bruges to steder:
**stregkode-scanneren i den gamle app** slår op der, og `/api/off-search` er en
mellemmand fordi OFF's svar mangler en header browseren kræver. **3.0's
søgning bruger den ikke.**

#### Hvordan søgningen virker i 3.0

Hun søger i **den fælles liste plus sin egen**. Rækkefølgen er lavet om: hele
ord først, og inden for hver gruppe det korteste navn øverst, så "Skyr" kommer
før "Skyr med vanilje". Den gamle app løser det med et afkryds der hedder "Kun
hele ord" — og **det er netop den slags indstilling målgruppen aldrig prøver.**
Se `content/fodevareSoeg3.ts`, hvor begrundelsen står i toppen.

#### Stregkode-scanneren: stadig et nej

Den er **bevidst ikke bygget i 3.0**. Af de 47 scannede varer er scanneren
brugt tre gange i appens levetid. Delene findes hvis den skal bygges: selve
scanneren i den gamle app, og opslaget mod OFF.

Bygges den, er der tre spørgsmål der skal besvares først: **skal den overhovedet
med**, **hvad sker der med en vare OFF ikke kender** (hun skal taste tallene
selv, og det er dér de fleste giver op), og **hvor havner den** — svaret på det
sidste er givet: kun hos hende selv.

#### To ting der stadig ikke er løst

**53 fødevarer mangler et kalorie-tal.** Det er de gamle community-varer.
Appen regner nu kalorierne ud af protein, fedt og kulhydrat i stedet for at
vise nul, men **tallet er et skøn**.

**Det største åbne spørgsmål i Mad er ikke hvilken database, men hvad kunden
må se.** Der er ingen der har bestemt det. Løsningen er et kurateret lag
ovenpå de 2.268, og Kickstart-listen er allerede tæt på at være det lag.
Diagnosticeret, ikke besluttet.

---

---

### 9.51 SCAN EN VARE, tegnet 24. august. IKKE BYGGET

**Tegningen ligger i `v3 app/linns-academy-design/mockups-scan-vare.html`**, elleve
skærme i seks afsnit. Læs den før du bygger noget her, den rummer begrundelsen
for hver detalje.

**Idéen er Linns, og den er bedre end den vi startede med.** Stregkoden og
billedet gør to forskellige ting:

- **Stregkoden er varens navneskilt.** Den siger hvilket produkt det er, så to
  kunder der scanner den samme yoghurt får den samme vare
- **Billedet af varedeklarationen er beviset for tallene.** Det er
  producentens lovpligtige tal, ikke en frivillig indtastning

**Derfor bruger vi stort set ikke stregkode-registret til andet end navnet.**
Det var netop dér Lurpak lå med nul kalorier, se `project_fodevarer_kost`.

#### Reglerne Linn har lagt fast

- **En scannet vare med billede deles med ANDRE kunder.** Grundlaget er
  producentens deklaration og der ligger et bevis
- **Retter hun ét tal efter scanningen, bliver varen hendes alene.** Så er det
  ikke længere pakkens tal
- **En vare hun skriver fra bunden er altid kun hendes**, uanset hvor rigtig
  den er
- **Består tallene ikke kvalitetstjekket, deles varen aldrig**
- **En delt vare kan kun rettes af den der scannede den.** Passer tallene ikke
  med en anden kundes pakke, tager hun sit eget billede og får sin egen udgave
- **Linn godkender ikke.** Varen er delt fra det sekund den er scannet. Der er
  en admin-side som nødbremse, hvor hun kan fjerne, ikke godkende

#### DET STØRSTE PROBLEM: FIBRE ER FRIVILLIGE PÅ EN VAREDEKLARATION

EU kræver energi, fedt, mættet fedt, kulhydrat, sukkerarter, protein og salt.
**Kostfibre står på listen over det man MÅ skrive, ikke det man SKAL.**

I en app der hedder 30-30 og handler om protein og fiber er det den værst
tænkelige mangel. Seks af de syv tal kommer sikkert ind fra et billede. Det
syvende kan mangle.

**Løsningen er at sige det højt.** Mangler fibrene, står der at de mangler, og
hun vælger mellem at lade dem stå tomme, skrive tallet selv, eller låne det
fra en tilsvarende råvare. **Aldrig et stille nul**, for det er præcis den
fejl hvor kunden logger mindre end hun spiste.

#### Den anden fælde

**Mange pakker har to kolonner, pr 100 gram og pr portion.** Læses den
forkerte, bliver alt skævt og det ser fuldstændig rigtigt ud. Der skal stå
tydeligt hvilken kolonne der er læst, og hun skal godkende inden der gemmes.
Samme fremgangsmåde som når hun fotograferer en opskrift i dag, se 9.11.

#### Det er billigt at bygge

Motoren findes: `/api/analyser-opskrift` læser allerede et billede af en
opskrift og trækker ingredienser ud, og 222 kunder har brugt den. En
varedeklaration er langt lettere at læse end en kogebogsside.

Mærkerne i søgningen hedder **Fødevaredatabasen**, **Fra pakken** og **Dit
eget tal**. Linns valg af ord.

### 9.50 FØDEVARERNE KOBLET TIL DTU, 24. august. TALLENE ER SKREVET UD

**Den største enkelt-ting i Mad siden regnemaskinen, og den rammer BEGGE apper.**
Alle fødevarers næringstal kommer nu fra Den Danske Fødevaredatabase i stedet
for fra den prototype de blev skrevet i. Det er sket, det er live, og det
gælder de 760 kunder i den gamle app lige så vel som 3.0.

#### Hvorfor det skulle gøres

Linn spurgte hvor vores egen fødevare-liste kom fra. Svaret var værre end
forventet. **De 840 varer uden `kilde`-felt blev kopieret ord for ord fra
`reference/index.html`**, altså prototypen fra før den nuværende app, den 7.
maj 2026. Der stod i toppen af den fil at grunddata var fra Frida, men tallene
er runde og var aldrig slået op.

**Og de havde oprindeligt kun protein og fiber.** Kulhydrat, fedt og kalorier
kom til fire dage senere ved at matche NAVNET mod Frida. Det er nøjagtig den
fremgangsmåde vi selv afviste på opskrifterne, se 9.16.

Resultatet kunne måles: 17 slags hakket kød havde fået identiske tal, creme
fraiche 5, 9, 18 og 38 procent stod alle til 50 gram fedt, tørrede grønne
linser stod til 70 kalorier i stedet for 310, og **mørk chokolade 70 procent
stod til 47 kalorier i stedet for 549.**

#### Kilden

**Den Danske Fødevaredatabase, version 6.1, maj 2026**, udgivet af DTU
Fødevareinstituttet. 1.390 fødevarer med 228 næringstal hver. Gratis under
CC BY 4.0, altså fri kommerciel brug mod kildeangivelse, og den opdateres to
gange om året.

Datasættet ligger som `scripts/FCDB_6.1.xlsx` og er uden for git, se
`.gitignore`. Hentes igen fra `https://doi.org/10.11583/DTU.32312844`.

**Kildeangivelsen skal med når tallene vises.** Det er betingelsen for at
bruge dem.

#### Hvad der står i databasen nu

Hver vare i `fodevarer` har fået fire nye felter, additivt:

| Felt | Hvad |
|---|---|
| `kildeType` | `dtu` eller `linn` |
| `dtuId` | Fødevarens nummer i DTU 6.1 |
| `dtuNavn` | Det navn DTU selv bruger |
| `kildeNavn` | Den fulde kildeangivelse |
| `kildeDato` | 2026-08-24 |

**1.735 varer har DTU-tal. 33 har Linns egne tal.** 500 er bevidst uden
kobling og står uændret. Verificeret mod den kørende database bagefter: nul
afvigelser.

**Sikkerhedskopi af alle 2.268 varer som de så ud før ligger i
`backup/fodevarer-foer-dtu-2026-08-24.json`.** Alt kan sættes tilbage.

#### Hvad kunderne mærker

Målt på 7.398 rigtige dage: **dagens protein falder med 0,7 gram ud af 65.**
45 procent af dagene ændrer sig under ét gram. 15 procent mister over tre.

De to der bliver bemærket:

- **Rugbrød med kerner** gik fra 8,5 til 5,1 gram protein, 1.458 registreringer
- **Hørfrø** gik fra 18 til 25,5 gram protein, 1.229 registreringer

**Kundernes egne registreringer er urørte.** Hvert måltid gemmer sine egne tal
ved gemning, så historikken står som før. Kun nye registreringer bruger de nye
tal.

#### DE FEM REGLER LINN TRAF, OG DE SKAL HOLDES

**1. Den fælles liste indeholder kun det der kan navngives uden et mærke.**
Ikke "råvarer". Kefir, rugbrød, hytteost og skyr er forarbejdede og hører
lige så meget til som gulerod. Cultura Kefir Naturel fra Arla gør ikke.

**2. Rå vægt er udgangspunktet.** Stegt kyllingebryst kobles til det rå, for
kød og fisk taber vand. **UNDTAGELSEN er alt der SUGER vand**: ris, pasta,
bælgfrugter og gryn beholder begge udgaver, fordi 100 g rå ris bliver til 250
g kogte. Har databasen præcis den tilberedning vi skriver, bruges den
alligevel. Samme regel som opskrifts-beregneren allerede har, se
`ingrediensNavn3.ts`.

**3. Grammene i en OPSKRIFT er rå vægt**, medmindre der udtrykkeligt står
andet. Det er allerede praksis: kyllingebryst, laks og torsk peger alle på de
rå. **Bacon peger stadig på stegt bacon og skal rettes.**

**4. Mærkevarer og retter hører ikke til i den fælles liste.** Kunden scanner
en købt vare med et billede af varedeklarationen, se 9.51 og
`mockups-scan-vare.html`.

**5. Linn godkender ikke varer løbende.** Derfor må intet i den fælles liste
kræve hendes ja. Alt er enten fra databasen eller fra en scanning med billede.

#### Undtagelsen: Linns udvalg

**Bellwell Gut Balance ligger bevidst i den fælles liste og ses af alle**,
også nye kunder. Den er en del af Linns program, findes ikke i databasen, og
tallet er hendes med hendes navn på. Det er den eneste af sin slags i dag, og
kategorien hedder `LINNS_UDVALG` i koblings-scriptet.

#### FÆLDER VI FALDT I, OG SOM KOSTER DEN NÆSTE DYRT

Alle sammen fundet fordi Linn kiggede navnene efter. **Ingen af dem kan fanges
af en test.**

- **Æg blev til fisken Helt.** "Helt" er både et tillægsord og en fisk. Reglen
  er nu at det FØRSTE ord i begge navne skal kunne genfindes i det andet
- **Smør blev til jordnøddesmør, ost til smelteost, æble til paradisæble, sød
  kartoffel til kartoffel.** Et sammensat ord ender på det rigtige uden at
  være det. **Et præcist hovedord slår nu altid et sammensat**
- **Græskarkerner blev til græskar, valnødder til valnøddeolie, solsikkekerner
  til solsikkeolie.** Råvaren blev blandet sammen med det man laver af den.
  Formord som olie, kerner, mel og juice er nu en hård grænse
- **Sodavand light blev til sodavand med sukker.** Én kalorie blev til 41.
  Light og sukker udelukker nu hinanden
- **En grov bolle blev til en kiks**, fordi brød og kiks lå i samme kasse
- **Risalamande blev til andekød.** Ordet "and" står inde i navnet
- **KYLLINGEBRYST ER DEN VIGTIGSTE.** DTU har KUN kyllingebryst MED skind,
  altså 6,9 gram fedt mod de 1,5 danske butikker sælger. Koblingen ville have
  givet 42 procent flere kalorier på en af de mest brugte varer i appen. Det
  samme gælder kyllingelår og parmaskinke, og de tre har nu Linns tal
- **Mørk chokolade 70 og 85 procent var lige ved at blive slået sammen**, fordi
  begge stod med de samme forkerte tal. Forskellige procenter i navnet må nu
  aldrig smeltes sammen

**Hovedordet i et dansk navn står SIDST i en sammensætning og efter
tillægsordet.** "Grove havregryn" handler om havregryn. "Rugbrød med kerner"
om rugbrød. Den ene regel flyttede over hundrede varer på plads.

#### Danske ord der ikke ligner hinanden

Databasen bruger fagsprog. Der ligger en eksplicit liste i scriptet, aldrig et
gæt: svinekød hedder grisekød, peanutbutter hedder jordnøddesmør, mandelmælk
hedder mandeldrik, cottage cheese hedder hytteost, isbergsalat hedder Salat
Iceberg, zucchini hedder squash, druer hedder vindrue, rosiner hedder Rosin
uden kerner, aroniabær hedder Surbær.

Og danske flertalsformer: dadler bliver til daddel, cashewnødder til cashewnød,
mandler til mandel. Dobbeltkonsonanten falder bort igen.

#### OPSKRIFTERNE BLEV REGNET OM SAMME DAG, OG DET SKAL DE ALTID

**Det her er den vigtigste driftsregel der kom ud af dagen.**

De 133 opskrifters makro er regnet ud på forhånd og ligger gemt i
`ingrediensKobling/beregninger`. **De regnes ikke om af sig selv.** Ændrer man
en fødevares tal, står opskrifterne stille med de gamle, og de to kilder siger
så forskellige ting om den samme mad.

Det skete den 24. august. Fødevarerne fik nye tal klokken 16.48, og
opskrifterne blev først regnet om klokken 16.59. **Rækkefølgen var forkert**,
og den skal være omvendt eller samtidig næste gang.

**Sådan regnes de om:** brug `regnOpskrift` og `afrund` fra
`content/opskriftMakro3.ts` direkte i et script, med hele `fodevarer`-samlingen
og `ingrediensKobling/koblinger` som input. Skriv resultatet til
`ingrediensKobling/beregninger` under `kort`. **Husk `afrund`**, ellers ender
der tal som 546,9899999999999 i databasen.

**Hvad omregningen gjorde:** 46 af de 133 ændrede sig mærkbart. Protein pr
portion steg med 1,6 gram i median, spændet var fra minus 3,7 til plus 3,7.
Linse- og kikærteretterne steg mest, fordi vores gamle tal for tørrede
bælgfrugter var for lave. Sikkerhedskopi i
`backup/ingrediensKobling-foer-2026-08-24.json`.

**Bacon blev rettet samme kørsel.** Ingrediensen pegede på vores egen "Bacon,
stegt" og peger nu på DTU's "Bacon i skiver, rå", se regel 3 ovenfor. Bacon
findes kun i én opskrift, Kyllingesalat med sprød bacon, som gik fra 34,4 til
32 gram protein pr portion.

#### SOEGNINGEN ER RYDDET OP SAMME DAG, OG SYNLIGHEDEN ER TAENDT

**Punkt 1 til 3 er gjort. Kun scanneren mangler.**

Tre ting blev skrevet til `fodevarer`, og ingen naeringstal blev roert:

- **350 dubletter fik feltet `pegerPaa`** og forsvinder fra soegningen for
  ALLE. AEg haardkogt, AEg stort, AEg lille, Avocado halv og resten. De er
  den samme mad med de samme tal, saa der er intet at miste
- **232 retter og maerkevarer fik `kunKendte: true`** og ses kun af den
  kunde der allerede bruger dem
- **Fire varer skiftede navn**, fordi tallet nu er raavarens: Kyllingebryst,
  Havregryn, Sød kartoffel og Rødbede

**Fra 2.268 raekker til 1.686 for en ny kunde.** Soeger hun paa aeg, faar hun
aeg, aeggehvide og aeggeblomme plus de fire slags hoenseaeg Linn bad om, i
stedet for otte raekker af det samme.

Sikkerhedskopi i `backup/fodevarer-foer-sortering-2026-08-24.json`.

**Reglerne ligger i `content/fodevareKilde3.ts` med 31 tests.** Den svarer paa
to spoergsmaal der er forskellige: hvor kommer tallet fra, og maa hun se varen
overhovedet. Fire maerkater med Linns ord: **Fødevaredatabasen, Scannet, Dit
eget tal, Uden kilde.**

Skaermene er i `TilfoejArk.svelte` og `MaengdeArk.svelte`. Maerket er et SPAN
og aldrig en knap, saa en bred regel som `.tm-traef button` ikke giver det
width 100 % og laegger det oven i navnet. Samme faelde som hjertet faldt i 12.
august.

**Maengde-arket har faaet linjen "Mængder er før tilberedning"**, sat stille
under tallene og ikke som et baand. Og et baand paa varer uden kilde der beder
hende scanne pakken. **Linns beslutning: hver gang**, ikke kun foerste gang og
ikke kun paa de mest brugte.

#### `kendteVarer3` PAA KUNDEN, OG HVORFOR DEN MAATTE BLIVE ET FELT

**Jeg lovede Linn at det ikke ville kraeve et script. Det gjorde det.**

Historikken i `plejer3` raekker kun 45 dage tilbage, og Linns regel er UDEN
tidsgraense: en vare hun brugte for et aar siden skal stadig kunne findes.
Derfor staar de faa varer hun har taget i brug paa hendes eget dokument som
`kendteVarer3`, se `firestore/kendteVarer3.ts`.

**Feltet er additivt.** `userDoc.ts` og `types.ts` er uroerte, og der skal
intet udgives i Firebase, for reglerne tillader kunden at skrive paa sit eget
dokument i forvejen.

**Backfill koert 24. august:** 382 af 618 kunder fik en liste. Median 3 varer,
hoejeste 32, i alt 2.039. Verificeret bagefter: nul id'er der ikke burde staa
der.

**Kun varer med `kunKendte` skrives.** En almindelig foedevare ses af alle i
forvejen, og at skrive den ville lade listen vokse uden grund. Der er test paa
det.

Soegningen laeser tre kilder sammen: listen paa dokumentet, "det du plejer" de
sidste 45 dage, og hendes hjerter. Listen er den eneste der raekker uendeligt
tilbage, de to andre fanger det nye foer listen naar at blive opdateret.

#### SCANNEREN ER BYGGET 24. august. Kun billedet mangler

Punkt 4 til 8 er gjort. **Kunden kan scanne en vare, faa tallene fra
varedeklarationen, og varen bliver delt med alle.**

| Fil | Hvad |
|---|---|
| `content/varedeklaration3.ts` | At laese en deklaration. 27 tests |
| `api/ny-varedeklaration/` | Endpointet der laeser billedet |
| `components/ny/ScanArk.svelte` | Hele forloebet i ét ark |
| `firestore/scannedeVarer3.ts` | De delte varer. 4 tests |
| `routes/ny/admin/scannede/` | Linns noedbremse |

**Stregkode-scanneren er den GAMLE apps `BarcodeScanner.svelte`**, kun laest
og importeret. `@zxing/browser` laa allerede i projektet. Det sparede et
bibliotek og en aften.

**Kalorie-tjekket er ogsaa den gamle apps `tjekNaering`.** To steder der
doemmer naeringstal forskelligt er vaerre end ét sted der doemmer dem lidt
for haardt.

#### Reglerne bag delingen

- **Har hun ikke rettet i tallene, deles varen med alle.** Retter hun ét
  tal, er det ikke laengere pakkens, og saa bliver den kun hendes
- **Egen samling, `scannedeVarer3`, ALDRIG i `fodevarer`.** Kunne kunderne
  skrive i den faelles liste, kunne én kunde aendre AEg til 999 g protein
  for alle 760, og ingen ville opdage det foer tallene stod forkert i
  hundredvis af dagboeger. Reglen er udgivet 24. august kl 19.06 og
  verificeret mod det der koerer
- **DOKUMENT-ID ER STREGKODEN.** To kunder der scanner den samme yoghurt
  rammer det samme sted, og den foerste vinder. Firestore afviser den anden
  af sig selv, saa der skal ingen kode til at haandtere kaploebet. Bliver
  hun afvist, bruger appen den vare der ligger, og hun ser ingen fejl
- **Den faelles liste vinder ved sammenlaegning**, saa en scanning aldrig
  kan skygge for en raavare. Der er test paa det
- **Linn godkender ikke.** Varen er delt fra det sekund den er scannet.
  Skulle hun godkende foerst, ville en kunde staa og vente paa hende midt
  i sin morgenmad. Admin-siden er en noedbremse, hvor de varer med tal der
  ikke haenger sammen staar oeverst

#### To ting der er dyre at genopdage

**"201 kJ / 48 kcal" bliver til 20148** hvis man fjerner alt der ikke er
cifre. Sådan skriver enhver dansk pakke energi. `tilTal` tager nu det tal
der staar lige foer ordet kcal. Fanget af en test, ikke af oejne.

**Et rent fiberprodukt faar en falsk alarm.** Bellwell med 76 g fiber og
360 kalorier ser umuligt ud for regnestykket, selv om det er rigtigt. Vi
lever med den, for hun kan gemme alligevel. Alternativet var at slaekke
tjekket for alle, og saa fanger det heller ikke den forkerte kolonne, som
er den fejl der goer skade. Begrundelsen staar i testen.

#### KOSTFIBRE ER FRIVILLIGE, OG DET ER DET STOERSTE HUL

EU kraever energi, fedt, maettet fedt, kulhydrat, sukkerarter, protein og
salt paa en varedeklaration. **Fibre staar paa listen over det man MAA
skrive, ikke det man SKAL.**

I en app der hedder 30-30 er det den vaerst taenkelige mangel. Seks af de
syv tal kommer sikkert ind fra et billede. Det syvende, som er halvdelen
af konceptet, kan mangle.

**Vi skriver ALDRIG et stille nul.** Mangler fibrene, siger arket det og
giver hende to veje: lad dem staa tomme, eller skriv tallet selv. Paa en
delt vare gemmes 0 med `fiberUkendt: true` ved siden af, saa regnestykket
ikke lyver og vi stadig kan se forskel.

#### BILLEDET ER BEVISET, OG DET ER DERFOR VAREN MAA DELES

Billedet af varedeklarationen ligger i Storage under
`deklarationer/{uid}/{vareId}`. **Reglen er udgivet 24. august kl 19.14**
og verificeret mod det der koerer.

**UDEN BILLEDE DELES VAREN IKKE.** Har hun skrevet tallene selv i stedet
for at fotografere, bliver varen kun hendes, og det staar paa skaermen
inden hun gemmer. Uden beviset ville vi sende én kundes tastearbejde
videre til alle.

Reglen i `storage.rules`:

- **Alle indloggede LAESER.** Varen deles med alle, saa kunne kun hun der
  tog billedet se det, ville beviset ikke vaere noget bevis
- **Hver kunde SKRIVER kun i sin egen mappe.** Uid'et staar i stien, saa
  det altid kan ses hvem der har lagt noget op, og ingen kan overskrive
  en andens
- **Hoejst 2 MB og kun billeder.** Et skaleret billede af en varetabel
  vejer omkring 40 KB
- **Kun admin maa slette**

**Det er foerste gang en kunde skriver til Storage i en mappe andre kan
laese.** Hidtil kunne hun kun skrive sine egne opskrift-billeder, som kun
hun selv ser. Risikoen er lille men reel, og det er derfor stien baerer
hendes uid og Linn kan slette.

**Uploaden fejler aldrig opad.** Gaar den galt, gemmes varen alligevel med
tallene. Et manglende bevis er bedre end en mistet scanning.

**Fjerner Linn en vare, slettes billedet HELT**, mens varen kun maerkes
som fjernet. De maaltider hvor den er brugt skal blive ved med at virke,
se regel 10.

Sikkerhedskopi af de gamle regler i
`backup/storage.rules-foer-deklarationer-2026-08-24`.

#### DET DER IKKE ER GJORT ENDNU

**Kun tallene er skrevet ud. Søgningen er ikke rørt.** Alle 2.268 varer står
stadig i listen. Det næste er:

- ~~350 dubletter, 232 retter og mærkevarer, fire nye navne~~. **Klaret 24.
  august**, se afsnittet ovenfor
- ~~Scanneren, inklusive billedet som bevis~~. **Bygget 24. august**, se
  afsnittet ovenfor. **Den er ikke proevet paa en rigtig telefon endnu**, og
  det er dér Linn finder de fejl ingen andre kan se
- **Torskefars, laksefars og oksekød har ingen opskrifts-kobling.** En time
- **Aftrykket af ingredienslisten**, aftalt 15. august og stadig ikke bygget
- **225 fødevarer databasen ikke har.** 1,3 procent af al brug, højeste har
  55 registreringer. Cafe latte, flerkornsbrød, frossen bærblanding
- **Torskefars, laksefars og oksekød mangler helt en opskrifts-kobling**
- **225 varer er ikke koblet**, men de fylder kun 1,3 procent af al brug og den
  mest brugte har 55 registreringer. Cafe latte, flerkornsbrød, frossen
  bærblanding. Databasen har dem ikke

**`scripts/_kobl-fodevarer.ts` skal blive stående indtil ovenstående er gjort.**
Den rummer alle håndsatte koblinger, sorteringen i fire slags og Linns
beslutninger. Koblingerne selv står nu i databasen som `dtuId`, men
sorteringen gør ikke. Slet den først når søgningen er lagt om.

#### Sådan arbejdede vi, og hvorfor det virkede

Linn gennemgik omkring 50 varer i alt hen over dagen. **Hver eneste gang hun
rettede noget, afslørede rettelsen en regel der rettede hundrede mere.** Fem
af hendes syv sidste rettelser var i øvrigt vores egen fejl: havregryn, rødløg
og dadler stod i hendes liste fordi databasen kalder dem noget andet, men
tallene var de samme.

**Læren: giv hende de varer hvor hendes svar er det eneste der findes, ikke
dem hvor maskinen bare ikke er dygtig nok endnu.**

Og en fejl der er værd at kende: gennemgangs-siden voksede til fem sektioner
med hundredvis af rækker, og Linn kunne ikke finde sin opgave i den. **En
rapport over dit arbejde er ikke det samme som en opgave til hende.** Den blev
til sidst delt i to, hvor `tjek-tal.html` kun indeholder de 33 varer hun
skulle svare på.

---

### 9.52 HUN RETTER I LINNS OPSKRIFTER, 25. august

**Tegningen er `mockups-ret-maengde-i-opskrift.html`**, og Linns svar
står i den. Læs den før du rører noget her.

Det startede som et spørgsmål fra Linn: kan en kunde rette i en af
appens opskrifter når hun lægger den i som måltid? Det kunne hun ikke.
Hun kunne kun skrue på antal portioner, som flytter alle ingredienser
på én gang.

#### DET ER ET BYTTE, OG DET SKAL SIGES HØJT

Diagnosen anbefalede kun mængder, altså skrue op og ned. **Linn bad
samme dag om at hun også skulle kunne lægge en ingrediens til.** Dermed
kan hun bytte: skru risen til nul, læg kartofler til.

Vi kom altså frem til byttet ad bagvejen, og det er den nemmeste vej
derhen. To af de tre forhindringer forsvandt af sig selv: **hun siger
selv hvor meget der skal i**, så der er ingen omregning at gætte på, og
retten er allerede mærket i hendes dag.

#### Fundamentet, målt før der blev kodet

**Alle 133 opskrifter har 1.008 ingrediens-linjer der betyder noget, og
hver eneste er koblet til en fødevare.** Ikke én mangler. Der findes
ikke en opskrift hvor det her falder fra hinanden.

#### Fire ting der er dyre at genopdage

**HUN RETTER DET HUN SER, IKKE DET DER STÅR I OPSKRIFTEN.**
Ingredienslisten vises allerede skaleret til hendes antal portioner.
Derfor regnes der på de VISTE mængder, og der deles **aldrig** med
portionstallet bagefter. Gjorde man det, ville en familieret give hende
en fjerdedel af den feta hun lige har lagt i.

**En linje hun selv har sat følger IKKE portions-tælleren bagefter.**
Hun satte 200 g fordi det var det hun spiste. De linjer er mærket på
skærmen netop derfor.

**To farver med hver sin betydning, og de må ikke smelte sammen.**
Honning betyder "jeg har ændret noget af Linns", blomme betyder "det
her er mit eget". Linns linjer kan skrues til nul men ikke fjernes, så
hun kan fortryde. Hendes egne kan fjernes helt.

**Retter Linn opskriften, falder hendes gemte mængder bort.** Der ligger
et aftryk af navn og enhed på det gemte. Uden det sad hun med 200 g
kylling i en ret der var lavet om til fisk, og ingen ville opdage det.
Aftrykket er bevidst uden mængde: skruer Linn 150 g op til 180, er det
stadig den samme ret, og hendes "jeg tog ikke avokado i" skal overleve.

#### Tallet regnes på stedet, men kun når hun har rørt noget

Uden ændringer vises det GEMTE tal, som med vilje er frosset, se
`opskriftBeregning3.ts`. Med ændringer regnes der forfra. **De to kan
give en lille forskel på den samme mad, og Linn har sagt ja til det 25.
august.** Alternativet var en omvej der kostede mere end forskellen er
værd.

#### Hun spørges om mængderne skal huskes

Linns valg: hun skal **spørges**, ikke have en indstilling stående.
Spørgsmålet er et blødt bånd der kommer når retten ER lagt i, og ikke
en pop-up, som ville lægge sig hen over kvitteringen med Fortryd. Samme
mønster som når hun retter i et fast måltid, se 9.10.

**Der spørges kun én gang pr opskrift.** Siger hun nej, spørges der ikke
igen for netop den ret. Ellers er det en pop-up der aldrig holder op.

#### I hendes dagbog

Der står **"Dine mængder · 2 rettet"** under rettens navn. Navnet selv
er urørt, så retten stadig kan kendes. Uden linjen kan hverken hun eller
Linn se at hun spiste noget andet end det der står, og om tre uger
ligner det en fejl i tallene.

#### Den gamle app er urørt

`content/kost.ts` deles med den app der er i drift, så linjen i dagbogen
har fået sit eget 3.0-felt og læses gennem et cast ét sted. Feltet på
kunden er additivt, og **der skal intet udgives i Firebase**: reglerne
tillader i forvejen at kunden skriver sit eget dokument.

#### To fejl testene ikke kunne se

Begge fundet ved at prøve den kørende app, ikke ved at køre tests.

- **Ingrediens-rækkerne fik browserens grå knap-baggrund.**
  Nulstillingen i `.ny-app` er pakket i `:where()` og er derfor vægtløs,
  så en knap uden egen baggrund får browserens. Samme fælde som
  fliserne faldt i 10. august. **Sæt altid en baggrund på en ny knap.**
- **Mængde-arket sagde "Læg i frokosten"** mens hun stod og byggede
  retten færdig. Maden lander først i dagbogen når hun trykker "Læg i"
  nede i opskriften. Der står nu "Tilføj til retten".

#### Det der IKKE er gjort

- **Kun Linns opskrifter.** Hendes egne har ét samlet næringstal og ikke
  tal pr ingrediens, så en tæller dér ville ikke kunne regne noget om
- **Ikke prøvet på en rigtig telefon.** Prøvet i browseren hele vejen
  igennem, men det er i Linns hånd fejlene bliver fundet

### 9.53 HENDES HJERTER OG FAVORITTER KOMMER FØRST I SØGNINGEN, 25. august

Linns spørgsmål: har hun sat en favorit, skal den så ikke komme øverst
når hun søger på ordet? Det gjorde den ikke. Søgningen så kun på hvor
godt ordet passede på navnet, og derefter på det korteste navn.

**Det gælder nu både fødevarer og opskrifter.**

#### Hjertet vinder over reglen om hele ord

Reglen om hele ord er et **gæt** på hvad hun mon mener, og den findes
fordi vi ellers ikke ved noget. Hjertet er hendes **eget valg**, og et
gæt skal aldrig slå et svar hun selv har givet. Søger hun "feta" og får
tre slags, er hjertet det eneste sted appen ved hvilken der er hendes.

Det kan ikke oversvømme listen: medianen er 13 hjerter pr kunde, og de
skal også ramme søgeordet for at komme med. Og **sorteringen skjuler
ingenting**, præcis som da hele ord blev indført. Der er test på begge.

#### DEN FÆLDE DER KUNNE HAVE ØDELAGT DET

**72 % af de 6.855 hjerter i drift er varer hun selv har oprettet, og
dem satte den GAMLE app AUTOMATISK.** Talte de med, ville hendes
søgning fylde sig med gamle egne indtastninger, og hjertet ville sige
noget om hvad appen har gjort i stedet for hvad hun vil have.

De holdes ude, samme regel som `hjertedeFodevarer` allerede følger, se
9.14. **De to skal blive ved med at være enige.**

#### På opskrifter gælder det kun når hun søger

Uden et søgeord er rækkefølgen alfabetisk som før. Der er en
Favoritter-fane til netop det, og et gitter der skifter orden mens hun
bladrer er forvirrende. Samme begrundelse som da Linn afviste at
gitteret skulle skifte facon under en søgning, se 9.5.

#### En type blev strammet

`FiltrerbarOpskrift` har fået et **påkrævet** id. Filen siger selv
hvorfor: var feltet valgfrit, ville favoritterne bare tavst holde op med
at komme først, præcis som kategori-filteret gjorde én gang, se fælden i
afsnit 7.

---

### 9.54 SALATERNE FORSVANDT, 25. august

Linn kunne ikke finde salat i 30-30. **Nul salater var synlige for en ny
kunde.**

#### Hvad der var sket

Oprydningen 24. august maerkede 232 varer som "retter og maerkevarer"
med `kunKendte`, se 9.50. Det var rigtigt for de 43 burgere og sandwich
der har salat i navnet. **Men reglen tog salathovederne med i samme
net.** Isbergsalat, Romainesalat, Bladsalat, Egebladssalat og Feldsalat
er alle sammen fra Linns egen liste, og de blev skjult.

Til sammenligning var agurk, tomat, rucola og broccoli synlige hele
tiden. Det var kun salaterne.

**Foelgefejlen:** de tre DTU-salater peger paa netop de her, saa
pegepinden endte et sted kunden ikke kunne se.

Rettet samme dag: de fem har faaet `kunKendte` slettet igen.
Sikkerhedskopi i `backup/fodevarer-salat-foer-2026-08-25.json`.

#### DET STOERRE PROBLEM, IKKE LOEST

**90 varer fra Linns EGEN liste er skjult for nye kunder.** Den liste er
den kurerede, og kunderne spiser 79 % af netop den, se 9.49.

Noget af det er rigtigt skjult efter Linns egen regel om at maerkevarer
og retter ikke hoerer til, fx Nutella, Philadelphia og Pizza. Men der er
mange der ser forkerte ud:

- **Krydderier og pulvere**: bagepulver, kakaopulver, chili, gurkemeje,
  matcha. Det er ingredienser, ikke retter
- **Hummus, guacamole, frikadeller, granola og mysli.** De kan navngives
  uden et maerke, praecis som kefir, rugbroed og hytteost, som Linn selv
  besluttede skulle blive, se regel 1 i 9.50
- **Protein-varerne**: proteinbar, proteinbroed, proteindrik,
  proteinchips, proteinis. Generiske slags og ikke maerkevarer, og
  praecis det en 30-30-kunde spiser

**Naeste skridt er en side med de 90, hvor Linn siger synlig eller
skjult.** Det var sådan de 33 blev afgjort 24. august, og det virkede.

#### Hvad der er aabnet igen, 25. august

Efter Linns gennemgang, ti ad gangen. Sikkerhedskopier i `backup/`.

- **De fem salater**, se ovenfor
- **Hummus, Guacamole, Frikadelle, Granola, Mysli fuldkorn usødet.**
  De kan navngives uden et maerke, praecis som kefir, rugbroed og
  hytteost, se regel 1 i 9.50
- **Kakaopulver, Matcha, Chili og Gurkemeje.** Man bruger et gram, saa
  tallene betyder intet for hendes dag, men de taeller som PLANTER, og
  Kropsro-challengen hedder "Planter til tarmmikrobiom"
- **Bagepulver blev bevidst IKKE aabnet.** Man spiser ikke en portion af
  det, og nul i alle felter ligner en fejl i tallene

Anden runde 25. august: **kun Kyllingefrikadelle og Fiskefrikadelle**
blev aabnet. De hoerer med fordi den almindelige Frikadelle blev aabnet
i foerste runde, og ellers kunne kunden finde den ene og ikke de to
andre.

**PROTEIN-VARERNE BLEV FORELAGT OG FRAVALGT.** Proteinbar, proteinbroed,
proteinchips, proteinis, proteindrik, proteinberiget knaekbroed og pasta
og havrekiks med protein staar stadig skjult. Det er Linns beslutning
og ikke en forglemmelse, saa aabn dem ikke uden at spoerge.

Bemaerk ogsaa at **Proteindrik, færdig staar til 9 g protein og 50 kcal**,
hvilket ser lavt ud for en faerdig proteindrik. Tallet er ikke tjekket.

Tredje runde 25. august: **dressinger, dip og én svamp.** Karl Johan
frisk, Tzatziki, de to hummus-varianter, Tahin-, Yoghurt-, Cæsar-,
Æbleeddike- og blandet salatdressing, samt Coleslaw.

**Karl Johan var en decideret fejl.** En frisk svamp med 22 kalorier,
skjult som om den var en faerdigret. Samme fejl som salaterne.

**Dressingerne ligger paa 300 til 400 kcal pr 100 g.** Det er der de
skjulte kalorier bor. En kunde der spiser en stor salat med to spsk
caesardressing og kun kan taste salaten, faar et tal der ser sundere ud
end hendes dag var.

#### GENNEMGANGEN ER FAERDIG. 64 bliver skjult

Linn gik hele bunken igennem 25. august, ti ad gangen, og sagde stop.
**Alt det der ikke er naevnt ovenfor bliver hvor det er.** Det er en
beslutning, ikke noget nogen har glemt.

De 64 fordeler sig saadan:

- **43 protein- og kosttilskudsvarer.** Proteinbar, proteinpulver i ni
  varianter, whey, kollagen, kreatin, BCAA og resten. Forelagt og
  fravalgt
- **11 paalaeg og tilbehoer.** Falafel, tunsalat, rejesalat,
  gulerodssalat, roedkaalssalat, agurkesalat, pandekage, koedsovs,
  chili con carne, bagepulver. Forelagt og fravalgt
- **10 sidste.** Mysli klassisk, spirulina, groen smoothie, light
  energidrik, Nutella, Philadelphia, pizza, lasagne, kanelsnegl,
  risalamande. Forelagt og fravalgt

**AABN DEM IKKE UDEN AT SPOERGE.** Argumenterne for og imod er givet én
gang, og svaret var nej.

To af begrundelserne er vaerd at kende, for de gaelder bredere:

- **Maerkevarer som Nutella og Philadelphia hoerer ikke til.** Kunden
  scanner dem i stedet og faar pakkens egne tal, se regel 4 i 9.50
- **Et fast tal paa en ret hun selv laver er et gaet der ser ud som en
  kendsgerning.** To portioner koedsovs kan ligge hundrede kalorier fra
  hinanden. Til det har hun faste maaltider, hvor tallet bliver hendes
  eget og rigtigt

**Isbergsalat hedder nu Icebergsalat.** Linns besked: det hedder Iceberg
paa posen. Bemaerk konsekvensen: "isberg" giver nu ingenting.
Soegningen leder kun i navnet, saa den kan kun kende én stavemaade.
**Den holdbare loesning er et soegeord-felt ved siden af navnet**, og
det ville loese mange lignende tilfaelde. Ikke bygget.

#### EN TING DER IKKE VIRKER SOM MAN TROR

**En dublet er skjult i soegningen for ALLE**, se `maaSesISoegning`.
Pegepinden hjaelper kun de maaltider der allerede peger paa det gamle
id. Den goer IKKE at kunden kan finde varen paa dublettens navn.

Konkret: soeger hun "iceberg", faar hun **ingenting**. "Isberg" virker.
Navnet paa posen i butikken er det foerste. Ikke loest, og det kraever
enten et andet navn paa varen eller et soegeord ved siden af.

---

### 9.55 SMÅ TING FRA 25. AUGUST, som er lette at overse

#### DEN BLANKE SKÆRM PÅ 30-30 OVERSIGTEN

Linn så den flere gange: en tom flade med top og bundmenu, mens hun var
inde i 30-30.

**Skærmen havde kun TO tilstande**, "henter" og "her er dagen". Gik
hentningen af dagens måltider galt, satte fejl-grenen `henter` til falsk,
men `dag` stod stadig som null, og så var der **ingen gren tilbage der
tegnede noget.** Top og bundmenu blev stående, fordi de hører til
skallen, og derfor lignede det en blank app.

Den blev desuden hængende: siden prøver ikke af sig selv og henter først
igen hvis hun skifter dag eller forlader siden.

Rettet med to ting. Den prøver **én gang til af sig selv** med en kort
pause, for de fleste af de her fejl er et øjebliks dårlig forbindelse og
er væk ved andet forsøg. Slår det også fejl, er der nu en sidste udvej
med en rolig tekst og en Prøv igen-knap.

**DER STÅR EN ADVARSEL I MARKUP OM AT DEN GREN ALDRIG MÅ FJERNES.**
Måltidsskærmen inde bagved havde det rigtigt hele tiden, den falder
tilbage på "Der er ikke noget her endnu". Det var kun oversigten der
manglede udvejen, og fejlen havde været der siden skærmen blev bygget.

**Læren gælder bredere: en `{#if}`-kæde på en hel side skal altid have
en sidste udvej der tegner noget.**

#### TEKSTSTØRRELSEN

Tre ting, alle Linns valg 25. august.

- **Den hedder Lille, Normal og Stor.** Før hed den Almindelig, Større og
  Størst. Tre trin der alle lyder som varianter af det samme er svære at
  vælge imellem. **Værdierne bagved er urørte**, de deles med den gamle
  app, se `TEKST_SKALAER_3`
- **Den ligger nu under Din side.** Før fandtes den KUN i opstarten, så
  hun kunne kun rette den ved at køre hele opstarten igennem igen.
  Bemærk at app-hjælpen i forvejen påstod at den lå der
- **En ny kunde starter på Normal**, ikke på den mindste. Har hun VALGT
  Lille, står det gemt og bliver respekteret

#### GUIDES MARKERES NU SOM SET

**Målt på Kropsro: af de 43 guide-lektioner har kun 6 en varighed sat.**
De 37 andre kunne derfor aldrig markere sig selv, hvor video og lyd gør
det, og så foldede dagen sig aldrig sammen for hende.

En **indlejret side** markeres efter tyve sekunder. Et **link eller en
PDF** markeres når hun trykker Åbn: den åbner i et nyt vindue, så uret
står stille imens, og siden er ikke synlig.

Video og lyd får stadig ingen grænse uden varighed. Dér ved vi ikke hvor
lang filmen er, og et gæt ville markere den mens hun stadig ser.

#### SCANNEREN VIRKER PÅ IPHONE

Bekræftet af Linn 25. august. **Ikke prøvet på en Android.**

Værd at vide hvis nogen fejlsøger den: **selve stregkode-læsningen er den
GAMLE apps komponent, uændret.** Den har allerede de tre Android-
rettelser fra 2. juni, hvoraf den vigtigste er at opløsningen blev sat
ned, fordi mellemklasse-Android ikke kunne nå at behandle billederne
hurtigt nok og derfor aldrig fik et hit.

Det der ER nyt i 3.0 ligger EFTER scanningen: stregkoden giver kun
navnet, og tallene kommer fra billedet af varedeklarationen. Se 9.51.

---

---

---

### 9.56 MINE FAVORITTER: tre begreber blev til ét, 26. august

**Tegningen er `mockups-hjerte-og-scannede.html`**, og alle Linns svar staar i
den. Læs den før du rører noget her.

Det startede som et spørgsmål om hjertet og de scannede varer, og endte et
andet sted. **Diagnosen pegede på en hylde. Linns svar var at de tre begreber
er forvirrende i sig selv**, og det var rigtigt. Løsningen fjerner et begreb i
stedet for at lægge et til.

#### Problemet, målt 26. august på de 618 kunder

| | |
|---|---|
| Hjerter i alt | 7.158 |
| Kunder der har hjertet noget | 310, altså halvdelen |
| Median pr kunde | 13, den største har 150 |
| Hjerter på en SYNLIG fælles vare | kun 22 % |
| Hjerter på hendes EGNE varer, sat automatisk af den gamle app | 74 % |
| Scannede varer i drift | 4, alle med billede |

Kunden mødte tre ting for at bruge én skærm: hendes egne madvarer, de scannede
varer og hjertet. **To af dem er appens bogholderi og ikke hendes tanke.** Om
en vare bor i den fælles samling eller i hendes egen skuffe er noget koden skal
vide, ikke hende.

**Og grænsen flyttede sig under hende.** Retter hun ét tal efter en scanning,
holder varen op med at være scannet og bliver til en af hendes egne. Hun gjorde
ikke noget der føltes som et skift, hun rettede et tal.

**To ting var direkte forkerte.** Hendes egne SCANNINGER stod slet ikke på
nogen liste, så hun kunne kun finde dem ved at søge. Og rækkerne opførte sig
forskelligt selv om de lignede hinanden: en hjertet vare havde kun et hjerte,
en af hendes egne havde Ret og et kryds.

#### Linns beslutninger, og de skal ikke tages op igen

- **Listen hedder Mine favoritter**
- **Mærkatet bliver ved med at hedde Scannet.** Der lå et forslag om "Fra
  pakken", og det er droppet
- **Hjerte og favorit er ét begreb**, også på opskrifterne, som brugte ordet
  favorit i forvejen
- **Opskrifter og madvarer er TO lister med samme ord**, ikke én. En opskrift
  bliver til et helt måltid, en madvare er én linje i et måltid, og de to åbner
  hver sit ark

#### DEN REGEL DER IKKE MÅ BRYDES

**Listen REGNES UD. Den skrives aldrig.** Der er test på det.

Navnet er en lille overdrivelse for to af de tre grupper. Hun lavede Mors
rugbrød fordi den ikke fandtes, ikke fordi hun elsker den. **Den nærliggende og
forkerte måde at gøre navnet sandt på er at sætte hjertet automatisk på det hun
laver og scanner.** Det er præcis den gamle apps fejl, og det er derfor 74 % af
alle hjerter er noget kunden aldrig har valgt. Gentages den, kan ingen længere
måle hvad hun faktisk har valgt.

Hjertet sættes kun når hun trykker. Hendes egne og hendes scanninger kommer med
ved udregning, uden at der røres et felt.

#### Krydset har TRE svar og ikke to

- **Fjern** på et hjerte. Varen findes for alle bagefter
- **Slet** på hendes egen. Den findes ikke andre steder, så at fjerne den ER at
  slette den, og det skal stå på skærmen
- **INTET kryds** på en vare hun selv har scannet. Den er delt med andre
  kunder, så den må hverken slettes for alle eller skjules for hende alene uden
  et nyt felt på kunden. **Det er ikke bygget**, og med 4 scannede varer i drift
  rammer det få. Spørg Linn før du bygger feltet

#### Det øvrige

**Ret er flyttet** fra hver række ned i mængde-arket, hvor varen alligevel er
åben. **Favorit-linjen samme sted har fået ord på**, så hun kan vide hvad
hjertet gør, og den ligger under mængden og over knappen, så den aldrig står
mellem hende og en registrering.

**Hylden i tilføj-arket** viser fire favoritter med "Se alle" bagved. Fliserne
har med vilje ingen farvekode: hvor varen kom fra er præcis den forskel vi har
fjernet.

**App-hjælpen fulgte med.** Den beskrev hjertet og "dine egne madvarer" som to
forskellige ting og nævnte slet ikke scanning.

#### Det der IKKE er prøvet

**Det har aldrig været på en telefon.** Alt er tjekket i browseren og bygget
igennem, men de to gange før i Mad blev fejlene fundet ved at bruge appen.

---

### 9.57 SCANNEREN: BLANK SKÆRM, OG GENNEMGANGEN AF ALLE SKÆRME, 26. august

Linn fandt den. Efter stregkoden står hun med to valg, "Tag billedet" og "Skriv
tallene selv". Trykkede hun på den sidste, **blev arket blankt.**

Årsagen står i afsnit 7 under fælderne, og det er den samme som den blanke
30-30 oversigt. Det tomme skema lå endda færdigt i koden som `TOM` og var
aldrig blevet koblet på knappen. Nogen skrev knappen og glemte den sidste
ledning.

**Fire ting rettet.** Knappen giver hende nu skemaet. Varen mærkes som hendes
alene med det samme, for tallene er ikke pakkens. Der er en sidste udvej på
arket, med en advarsel i markup om at grenen ikke må fjernes. Og teksterne
skifter: "Tjek tallene" og "Sammenlign med pakken" er forkert når hun skriver
fra bunden, så der står nu **"Skriv tallene"** og at tallene står **pr 100
gram**. Det er den vigtigste linje på skærmen, for taster hun hele pakkens tal,
er hendes protein tre gange for højt resten af året.

#### GENNEMGANGEN AF ALLE SKÆRME

Efter anden gang blev alle **53 sider og 37 ark** gennemgået, i alt 622 steder
hvor appen vælger mellem tilfælde. Det er gjort, så det ikke skal gøres forfra.

**Resultatet:**

- **Ingen skærm i 3.0 mangler en udvej når en hentning går galt.** Det var
  mønstret fra 30-30, og det står rent alle andre steder
- **Alle 53 sider har noget der altid tegnes.** Ingen kan blive helt hvid
- De øvrige steder uden en sidste udvej er ark, modaler og valgfri afsnit, hvor
  det er rigtigt at der ikke står noget

**Det ene sted der ikke er sikret er onboardingen, `/ny/velkommen`.** Kæden har
seks tilfælde og ingen sidste udvej. Rammes den, får hun en skærm med kun
fremdrifts-bjælken, uden tekst og uden knap, og hun er låst fast i opstarten.
Det kræver at listen af spørgsmål eller kort bliver KORTERE mens hun står midt
i den, og begge bygges ud fra ting der hentes mens skærmen er åben.
**Det er ikke bevist at det kan ske i dag, og det er ikke rettet.** Linn har
set forslaget og ikke svaret. Det er den første skærm en ny kunde møder, og
prisen er fire linjer.

**Beslægtet, ikke rettet:** går det galt at gemme til allersidst i onboardingen,
bliver hun stående på det sidste kort med en fejlbesked. Hun kan trykke igen, så
hun er ikke låst, men det er ikke pænt.

#### To ting fundet ved at BRUGE scanneren, ikke ved at teste

Begge står stadig:

- **"Noget ser forkert ud, produktet har ingen næringstal"** vises allerede på
  et helt tomt skema, før hun har skrevet noget. Samme slags støj som
  fibre-beskeden der blev udskudt
- **"Du har rettet i tallene, så varen bliver kun din"** står nederst, men hun
  har ikke rettet noget, hun skriver fra bunden

---

### 9.58 HVAD DEN GAMLE APP KAN, SOM 3.0 IKKE KAN, gennemgået 26. august

Den gamle app blev stillet op mod 3.0 rute for rute. **Fem af de otte stod ikke
i noget dokument før den dag.** Verificér dem mod koden før nogen regner med
listen, den er fra 26. august.

1. **Kunden kan selv booke sine pause-dage.** Gammel Profil har fra-til, en
   tæller med brugt og tilbage, en liste og Fortryd samme dag. **3.0 kan kun
   VISE pause-dage** på datostrimlen. Det er en test-funktion i den gamle app,
   så det rammer ikke alle
2. **Skift adgangskode.** Findes på gammel Profil. 3.0 har kun Log ud
3. **"Nulstil appen på denne enhed."** Rydder den gemte kopi. **Det er præcis
   den knap der manglede da Linn sad fast 26. august**, se fælderne i afsnit 7.
   Den bør bygges før noget andet på listen her
4. **Stjerner på opskrifter.** Kunden giver 1 til 5, og det ruller op i admin
   og i dashboardet. **Den datastrøm stopper den dag et hold flyttes**
5. **Stjerner på AI-svar.** Samme, feeder `/admin/ai-ratings`
6. **Appens versionsnummer** vises ikke i 3.0. Det gør fejlsøgning over
   telefonen sværere
7. **"Dit abonnement"** med købt-dato og adgang-til
8. **"Mine køb"**

**Makker-modalen og Facebook-gruppen** står i forvejen under "Bevidst udskudt" i
9.32, men det er én linje midt i et langt afsnit og meget nem at overse. Begge
rammer først når et Kropsro-hold flyttes, ikke Kickstart.

---

### 9.59 DE 327 HJERTER, og hvad 3.0 ellers fik 27. til 31. august

#### Hjerterne på dubletter er peget videre, 26. august

Oprydningen 24. august mærkede en række varer som dubletter, og en dublet er
skjult for alle, se `maaSesISoegning`. **Hjertet blev liggende.** Varen stod
stadig på hendes liste og gav nul træffere når hun søgte. Appen gav to
forskellige svar på det samme hjerte.

**Rettet 26. august efter tørløb og Linns go:**

| | |
|---|---|
| Kunder rettet | 91 |
| Hjerter peget videre | 251 |
| Fjernet, fordi hun hjertede den overlevende i forvejen | 76 |
| Hjerter tilbage på en dublet | 0 |

**Det vigtigste tal er et andet: alle 350 dublet-par har fuldstændig identiske
næringstal.** Ikke ét afviger med 0,1 g protein eller 1 kcal. Det blev målt
netop fordi linjer som "Kylling, bryst, kød og skind, rå" til "Kyllingefilet"
ligner rå mod tilberedt. Pegepindene blev sat som samme mad med samme tal og et
andet navn, og det holder. **Et hjerte der peges videre kan ikke ændre et tal.**

Sikkerhedskopi i `backup/hjerter-foer-2026-08-26.json`, 91 kunder og 3.673
hjerter. Hjerterne gik fra 7.158 til 7.085.

#### Det 3.0 ellers fik, 27. til 31. august

Kun tre ting. Resten af ugen var den gamle app, se toppen af dokumentet.

- **Gennemførte forløb er med i adgangsbilledet.** `udledAdgange` antog at
  `forlobIds` var en komplet historik, men de afsluttede ligger i et andet felt
  og faldt ud af billedet. Både `forlobIds` og `afsluttedeForlobIds` læses nu.
  **Samme fejl fandtes i den gamle app og blev rettet samme dag**
- **Mærkatet Mejerifri på opskrifter.** Opfører sig som Glutenfri: flueben i
  admin, filter-knap i listen, og det står på den enkelte opskrift. Ordet er
  Linns valg, for "mælkefri" kan læses som om det kun handler om mælken i
  kartonen. Madplan-forslagene i den gamle app har fået et tilsvarende flueben
- **App-hjælpens tekst om bibliotekets forløbs-faner**

---

### 9.60 SÅDAN STÅR 3.0 DEN 31. AUGUST

**Der er ikke arbejdet på 3.0 siden 26. august.** Det er ikke fordi noget er
gået i stå, men fordi hele ugen gik med den gamle app, hvor 760 kunder er i
drift. Se `HANDOVER-GAMMEL-APP.md`, som selv er bagud og står på 24. august.

**Det der spærrer for at flytte et hold har ikke flyttet sig siden 22. august,
og det er stadig indhold og tildelinger fra Linn, ikke kode.** Se NÆSTE SKRIDT.

**Nyt på listen siden 26. august**, i den rækkefølge jeg ville tage dem:

1. **"Nulstil appen på denne enhed"** i 3.0, se 9.58 punkt 3. Den er gået fra
   teoretisk til konkret
2. **Onboardingens sidste udvej**, se 9.57. Fire linjer, og det er den første
   skærm en ny kunde møder
3. **De to tekster i scanneren**, se 9.57
4. **Mine favoritter på en rigtig telefon.** Det er aldrig prøvet i en hånd

### 9.61 DEN 1. SEPTEMBER: INGREDIENSERNES TAL, OG LINN AI FIK ØJNE

Seks ting til 3.0 på én dag, plus fire i den gamle app. Dagen begyndte med
en admin-opgave om opskrifter og endte et helt andet sted, nemlig med at
Linn AI for første gang ved hvilket forløb kunden er på.

#### 1. Ingrediensernes tal, ny side

`/ny/admin/ingrediens-tal`. **Alle ingredienser der indgår i opskrifterne,
med de næringstal de regnes med.** Olivenolie står 38 steder i opskrifterne
men kun én gang her, og retter du tallet, gælder det dem alle.

Linns ønske: ét sted at kontrollere tallene, ikke ét pr opskrift.

**Der er kun ÉN side, og der er en vej ind fra BEGGE admin-forsider.** To
kopier ville før eller siden sige forskellige ting om det samme tal. Det er
værd at holde fast i, for spørgsmålet kommer igen.

**Den samler på kernenavn**, altså præcis den nøgle koblingerne bruger. Gjorde
den det anderledes, ville oversigten vise noget andet end regnemaskinen regner
med, og så er den værre end ingenting. Tilstanden bliver PÅ navnet, så tørre og
afdryppede linser er to rækker.

Målt på de rigtige data samme dag: **282 ingredienser, 278 med tal, 4 uden
kobling, 0 uden kalorietal, 17 med egne tal.** Fordelt på madtype: morgenmad
77, frokost 153, aftensmad 151, andet 101. De tæller til mere end 282, fordi
den samme ingrediens indgår i flere slags retter.

**De fire uden kobling ligner skrivefejl og ikke manglende varer:**
"citronsaft olivenolie", "citron saft skal", "appelsin saft" og "bær". De to
første er to ingredienser på samme linje. Rækkerne linker ind i opskriften,
hvor teksten rettes, og **listen regnes ud hver gang og gemmes aldrig**, så en
rettet række forsvinder af sig selv.

Logikken ligger i `content/ingrediensOversigt3.ts`, 23 tests.

#### 2. Linn kan rette et næringstal, og det gælder BEGGE apper

**Linns regel 1. september: der findes ét sæt tal, og det er vores.**
Databasens officielle tal som udgangspunkt, og har Linn rettet et, er det
hendes der gælder. Både i opskrifterne og når kunden taster varen ind selv.

**DER SKRIVES PÅ SELVE FØDEVAREN** og ikke i en samling ved siden af. Begge
apper læser allerede den samling, så rettelsen virker for de 925 kunder uden at
der ændres én linje i det de bruger. Alternativet var at lære begge apper at
kigge to steder, og det ville betyde ændringer i noget kunderne er afhængige
af. Se regel 10.

Fem ting der ligger fast:

- **Noten er påkrævet.** Om et halvt år er den det eneste der forklarer hvorfor
  varen står til noget andet end databasen siger. **Kunden ser den aldrig**,
  hun ser kun tallet. Linns beslutning samme dag
- **Det oprindelige tal gemmes i `foerRettelse`, og KUN første gang.** Ellers
  ville anden rettelse gøre den første permanent, og fortryd ville føre tilbage
  til et mellemtrin ingen har valgt
- **Kilden sættes til `linn`.** Vi skriver ikke DTU på noget vi selv har
  ændret. Kunden ser samme mærkat som før, se `kildeAf`, så der er ingen synlig
  ændring for hende
- **Et tomt felt skrives som null og aldrig som nul.** Nul betyder at varen ikke
  indeholder noget, og det er ikke det samme som at vi ikke ved det
- **Opskrifterne regnes om i SAMME kørsel**, og skærmen viser hvilke der
  flyttede sig. Det gik galt 24. august, hvor de to kilder i elleve minutter
  sagde forskellige ting om den samme mad. Går omregningen galt EFTER at varen
  er skrevet, siges det højt

**Kundernes gamle registreringer er urørte.** Hvert måltid fryser sine egne tal
ved gemning, så rettelsen gælder kun fremad.

Reglerne tillod admin at skrive begge steder i forvejen, så **der er intet
udgivet i Firebase.** Sikkerhedskopi af alle 2.268 fødevarer plus koblinger og
beregninger ligger i `backup/`, taget før felterne blev bygget.

**Tørløb før commit fandt ÉN opskrift der allerede var ude af sync:**
Chia-pudding med bær og mandler stod gemt med 45,4 g protein og regnes til
42,9. Den flytter sig ved første omregning uanset hvad Linn retter.

Logikken ligger i `content/ingrediensRettelse3.ts`, 29 tests, og skrivningen i
`firestore/ingrediensRettelse3.ts`.

#### 3. LINN AI KENDER NU KUNDENS FORLØB

**Det her er dagens vigtigste, og det kom af et spørgsmål fra en testkunde.**
Hun spurgte hvornår der er Q&A. Svaret står ordret i hendes forløbs FAQ med
Zoom-tidspunkter og det hele, men AI'en fik kun en generel videnbase på seks
dokumenter, og ingen af dem nævner Q&A. **Den kunne ikke svare på noget der lå
én skuffe væk.**

AI'en får nu forløbets navn, hendes dagnummer, dagens dato og FAQ'en fra
hendes eget forløb. Kun det UDGIVNE: et svar Linn stadig arbejder på må ikke
komme ud af munden på AI'en.

**AI'EN MÅ ALDRIG FINDE PÅ ET TIDSPUNKT.** Det er den værste fejl her, for så
møder en kunde op på det forkerte klokkeslæt. Instruktionen står i selve
blokken og TIL SIDST, så den ikke drukner i 25 svar.

**FUNDET VED AT KØRE MOD DE RIGTIGE DATA, ikke af testene.** Første udgave
sorterede Q&A-svaret HELT UD. De 25 svar fylder mere end der er plads til, og
et langt svar om at spise nok mad vandt, fordi ordet "der" stod fyrre gange i
det og også inde i "måltider". Rettet med en fyldord-liste, med at et ord kun
tæller én gang pr felt, og med at der deles på mellemrum så "Q&A" ikke bliver
til "q" og "a". Der er test på alle tre. **Kør altid udvælgelsen mod de
rigtige data, testene fanger den slags ikke.**

Målt i `nyAiLog` samme dag: kunden spurgte om Q&A kl 11.04 og AI'en var **15
procent** sikker. Kl 11.16, efter ændringen var ude, var den **100 procent**.

#### 4. AI'en kender også lektionerne, men KUN til og med i dag

Titel og beskrivelse på alle videoer, lyd og guides kunden har i appen. På
Kickstart August er det 36 lektioner over 22 dage, og de fylder kun 3.753 tegn.

**Linns beslutning 20. august står ved magt:** et forløb der kører viser kun i
dag og bagud, og dagene fremad er helt væk fra listen. Fik AI'en hele forløbet,
kunne den fortælle en kunde på dag 3 hvad der ligger på dag 15, og så modsiger
AI'en appen uden at nogen har taget beslutningen om. Linn fik tre muligheder
forelagt 1. september og valgte den snævre.

**FREMTIDEN FJERNES I DATA OG IKKE MED EN INSTRUKTION.** En instruktion kan
overses, en tom liste kan ikke. Samme regel som træningens AI-værktøj, se
SPEC 29.10.

#### 5. AI'en bruger nu Linns egne svar

**Det største hul, og det havde stået åbent hele tiden.** Motoren har altid
kunnet bruge Linns tidligere svar, og admin-værktøjet til svar-udkast gør det,
men kunde-AI'en i 3.0 gjorde ikke. Den henter nu kundens eget forløb først og
supplerer på tværs, præcis som `/api/linn-ai` gør.

**BEMÆRK HVAD DET GØR VED SIKKERHEDS-PROCENTEN.** Instruktionen beder modellen
bedømme hvor godt LINNS TIDLIGERE SVAR dækkede spørgsmålet, se
`SIKKERHEDS_INSTRUKTION`. Uden svarene målte tallet på noget der ikke var der.
**Tallene i `nyAiLog` fra før 1. september kan ikke sammenlignes med dem
efter.**

Dertil kundens egen historik, altså hvad hun selv har spurgt om før og hvad
Linn svarede. Højst fem, med besked om ikke at gentage sig selv ordret.

Loggen får nu forløb, dagnummer, antal FAQ, antal lektioner, antal tidligere
svar og antal egen historik med, så et forkert svar kan fejlsøges.

#### 6. MAD-TALLENE UDGÅR. Linns beslutning samme dag

Der lå et forslag om at AI'en også skulle kende kundens egne tal, altså protein
og fiber pr dag. **Linn droppede det samme dag.** `content/kundeTal3.ts` og
dens 14 tests blev bygget og slettet igen, for en fil der er bygget og testet
men aldrig kaldt er en fælde: den næste tror den virker. Se advarslen om
`VaelgArk` i afsnit 3.2.

**Der lå også en teknisk grund, og den er værd at kende hvis nogen tager det
op igen:** måltiderne ligger i en undersamling under kunden, og
`firestoreRest` kan kun spørge fra roden. Der er ingen parent i `runQuery`.
`hentAlleDocs` stopper ved 300 dokumenter i tilfældig rækkefølge, og en kunde
har tusindvis af madlinjer, så et snit ville blive regnet på 300 tilfældige og
blive forkert uden at nogen opdagede det. **Forkerte tal om hendes egen mad er
værre end ingen tal.** Regnestykket kan hentes op af git-historikken.

#### 7. Links i Beskeder kan trykkes

Zoom-linket kom ud som død tekst, så kunden skulle markere og kopiere det i
hånden på en telefon. Gælder nu AI'ens svar, hendes egne beskeder og Linns svar
på den anden fane.

**DER LAVES ALDRIG HTML AF TEKSTEN.** Teksten kommer fra en sprogmodel, og en
sprogmodel kan skrive hvad som helst. Blev svaret sat ind som HTML, kunne et
svar indeholde noget der kørte i kundens browser. `content/linkTekst3.ts` giver
en LISTE af stumper, som skærmen tegner med almindelige Svelte-elementer, så
der pr definition ikke kan komme kode ud. **Kun http og https**, og der er test
på både `javascript:`, `data:` og `file:`.

**Stumperne står på ÉN linje i markup med vilje.** Boblen bevarer linjeskift,
så et linjeskift i selve markup ville blive til luft på skærmen.

`ny.css` er rørt med 16 tilføjede linjer og intet andet. **De indlejrede
skrifter er urørte, tjekket i diffen**, se advarslen i afsnit 7 om prettier.

#### 8. En testkonto mere på 3.0

`kickstart-aug-2026@linnsacademy.dk` har fået flaget `ny-app`. Den ligger på
`kickstart_august`, der startede 29. august og løber 21 dage, så den er inde
fordi forløbet er aktivt. **Den har ingen træningstildeling**, så forsiden
siger "Din træning er på vej". Det er ikke en fejl, det er præcis det punkt
der står øverst under NÆSTE SKRIDT.

**Flaget sættes pr person under Testere i den gamle admin.** Linn kan selv,
det kræver ikke et script.

---

### 9.62 DEN 1. SEPTEMBER, SENT: HELE ADMIN LAVET OM

Samme dag som 9.61, men efter. **Admin er gået fra to forsider og 34
spredte sider til ét sted med 27 skærme i samme udseende.** Ingen
kundeflade er rørt.

#### Hvorfor, og hvad Linn valgte

Der lå **to admin-forsider**, én pr app, og man skulle vide om et værktøj
hørte til den gamle eller den nye app for at finde det. Med 34 sider er
det ikke til at holde ud.

Linn pegede på Teslas skærme i bilerne. Tegningen ligger i
`mockups-admin.html`. Hun fik fire spørgsmål og svarede:

- **Én samlet admin**, ikke to
- **Lyst i hendes egne farver**, ikke mørkt. Så det vi tog med fra Tesla
  er ikke paletten, men måden at tænke på
- **Status først, menu under**
- **Kunder og beskeder øverst**, det er dem hun bruger mest

**Menuen skiftede side to gange samme dag.** Først venstre, så højre efter
hendes ønske, så venstre igen. Den ligger til venstre nu. Skriv den ikke
om uden at spørge.

#### Det der er bygget

| | |
|---|---|
| `content/adminForside3.ts` | Alle værktøjer, status-reglerne og søgningen. 25 tests |
| `routes/ny/admin/+page.svelte` | Forsiden |
| `routes/ny/admin/+layout.svelte` | Rammen om alle nye admin-sider |
| `routes/app/admin/+layout.svelte` | Den samme ramme om de 19 gamle |
| `lib/components/admin/` | Seks byggeklodser |

**NÅR DER KOMMER EN NY ADMIN-SIDE, SKAL DEN IND I `VAERKTOEJER`.** Ellers
findes den kun for den der kender adressen, og sådan er det gået med
challenges, opskrift-billeder og scannede varer, der alle lå uden
menupunkt i uger. Der er test på at listen dækker begge apper.

#### De fire tal på forsiden

Ubesvarede spørgsmål, hold uden træning, ingredienser uden kobling og
opskrifter der mangler godkendelse. Linns valg, og feltet er lavet til at
vokse: der skal kun lægges en række til for at hænge et femte tal op.

Tre ting der er dyre at genopdage:

- **Tallene hentes EFTER siden er tegnet, og hver for sig.** Går én galt,
  står det ene tal med en streg og resten virker. Et forsøg på at hente
  noget i en skal gav en blank app 11. august
- **`null` betyder "hentes stadig" og bliver ALDRIG til nul.** Nul betyder
  at der ikke er noget at se til, og det er en anden besked
- **Kun det kort der venter på hende er i plomme.** Er alt i orden, er
  intet fremhævet. Det er hele grunden til at fremhævelsen betyder noget

Og en detalje: **fødevarerne hentes IKKE** for at tælle manglende
koblinger. Det kan ses uden dem, og de 2.268 rækker hører ikke hjemme på
en forside der skal åbne hurtigt.

#### Byggeklodserne

Seks stykker: side, kort, knap, mærkat, søgefelt og **sidste udvej**.
Uden dem ville de samme designbeslutninger blive truffet nitten gange, og
så kommer siderne til at ligne hinanden næsten men ikke helt.

**`AdmTom` er den vigtigste og skal på hver eneste side.** En kæde af
tilfælde uden noget der altid tegnes giver en blank side, og det er sket
to gange på to dage i august.

**Klodserne virker i BEGGE apper.** Farverne skrives som
`var(--paper, #fbf8f2)`: på `/ny` findes tokenet i `ny.css`, og alle andre
steder falder den tilbage på samme værdi.

#### TO MÅDER AT FLYTTE EN SIDE PÅ, og hvornår hver bruges

Det her er den vigtigste lære fra dagen.

**1. Skrevet om med byggeklodser.** Brugt på de sider hvor skærmen var
værd at forbedre: Spørgsmål, AI-vurderinger, Opskrift-vurderinger,
Refleksioner, Fællesskabs-fødevarer, Lektioner og Små skridt til
abonnenter, Mine programmer, Øvelsesbanken, Træning til abonnenter,
Testere, Nulstil adgangskode, Funktioner og adgang, Videnbasen,
Abonnenter, Forløb-listen og Opskrifter.

**Logikken er flyttet, ALDRIG skrevet om.** Hver side kalder præcis de
samme funktioner som den den afløser. To sider der gemmer forskelligt er
kundedata der driver fra hinanden.

**2. Kopieret ordret med en farvebro.** Brugt på Dashboard og de ni
forløbs-sider, i alt godt 9.000 linjer. Script, markup og stil er kopieret
uændret, og udseendet skifter ved at de gamle farve-navne peger på de nye
værdier inde i `.page`.

**Hvorfor:** Dashboard rummer 897 linjer tal og tabeller om kundernes
udvikling. En forkert overskrift på et tal DER er værre end at siden ser
gammel ud. Det samme gælder forløbets otte undersider. **Brug den metode
igen på store sider hvor markup bærer betydning.**

**Alle interne veje i de kopierede sider peger nu på den nye admin.** Uden
det falder man tilbage i det gamle udseende så snart man åbner en lektion.

#### Det Linn skal vide

**De gamle sider er urørte, alle nitten.** De fem der rører adgang, altså
Spørgsmål, Testere, Nulstil adgangskode, Funktioner og adgang og
Abonnenter, har deres gamle udgave stående i menuen under System som vej
tilbage. **Fjern dem når Linn har brugt de nye i en uge.**

**Ingen af de nye sider er set af et menneske endnu.** De bygger, typerne
holder og alle tests er grønne, men admin kan ikke logges ind udefra.

#### Rettet undervejs: "ingen forløb" er ikke "vi ved det ikke"

`hentForlobViden` gav `null` i to helt forskellige tilfælde: når kunden
ikke er på et aktivt forløb, og når hentningen fejlede. Blandet sammen
betød det at **et fejlet opslag fik AI'en at vide at kunden IKKE er på et
forløb**, og så ville den svare en forløbskunde som om hun var almindeligt
medlem. En forkert oplysning er værre end en manglende. Rettet med `TOMT`
mod `null`, og der er test på begge.

#### Det der IKKE er lavet om

Ingenting i admin. Alle 27 skærme står i det nye udseende.

---

---

### 9.63 DEN 2. OG 3. SEPTEMBER: TO TING DER OGSÅ RAMMER 3.0

Arbejdet de to dage foregik i den gamle app, se afsnittet "Rettet 2. og 3.
september" i `HANDOVER-GAMMEL-APP.md`. **To af ændringerne slår igennem
her uden at der er rørt en fil i `/ny`.**

#### 1. Enhedslisten er nu delt, og den er blevet længere

`content/mineOpskrifter3.ts` er 3.0's fil, men **den gamle app henter nu
enhedslisten derfra**, så de to apper ikke kan drive fra hinanden. Det er
kun en læsning, så regel 2 er overholdt. **Retter du `ENHEDER`, rammer du
begge apper.**

Listen er gået fra syv til tolv: fed, dåse, håndfuld, knivspids og bundt
er kommet til. De dukker derfor også op i opskrift-arket i 3.0.

**Vægt-tabellen i `content/enhedsvaegt3.ts` er lært de tre nye der kostede
noget.** Fed og knivspids kendte den, men dåse, håndfuld og bundt faldt
ned i styk-grenen og blev gættet som 100 g, altså en dåse hakkede tomater
regnet som en fjerdedel af sig selv. Nu er dåse 400 g, håndfuld 30 g og
bundt 25 g, med test. **Sætter du flere enheder på listen, så lær tabellen
dem i samme ombæring.**

Arket i 3.0 har ikke det "andet"-felt den gamle app fik, hvor kunden selv
kan skrive en enhed. Det er ikke et bevidst valg, det er bare ikke lavet
endnu.

#### 2. Linn AI har fået fire faste regler, og de gælder også `/api/ny-ai`

Chatten må ikke tale om andre forløb end kundens eget, ikke fortælle hvad
der er planlagt (på nær Q&A-tidspunkter fra hendes egen FAQ), ikke nævne
premium eller adgangsniveauer, og ikke nævne en ny app eller kommende
versioner. Linns beslutning 3. september.

**Reglerne står i `content/linnAi.ts` uden for persona-teksten**, samme
sted som sikkerheds-markøren, fordi admin kan skrive persona'en helt om
inde i appen. Begge apper bygger deres system-prompt samme sted, så de
gælder automatisk her. Svar-udkastene til Linn selv er ikke omfattet.

**Punkt fire er værd at bide mærke i i lige netop denne fil:** AI'en må
ikke fortælle kunderne at der er en ny app på vej. Bliver 3.0 rullet ud
til et hold, skal reglen læses igennem igen, for så er den nye app ikke
længere noget der kommer, men noget hun står i.

---

### 9.64 DEN 3. SEPTEMBER: SLÅ EN KUNDE OP

Linns ønske: **"alt information om kunden skal fremgå. Alt simpelthen."**
Før den dag viste kunde-opslaget kun hendes træning, og resten lå spredt
over syv admin-sider.

**To skærme.** `/ny/admin/kunde` henter kundelisten én gang og søger
lokalt med `klientSoegeMatch`, altså den samme fuzzy-søgning som resten af
admin. `/ny/admin/kunde/[uid]` er profilen med syv faner: Overblik,
Forløb, Mad, Træning, Symptomer, Beskeder og Konto.

**Hver fane henter først når den åbnes.** Fire af dem læser
undersamlinger, så alt på én gang ville være langsomt og dyrt på en kunde
Linn kun ville se overblikket for. Toppen med navn, mail og de fire
mærkater bliver stående når man skifter fane, så man aldrig kigger på den
forkerte kunde.

**Reglerne ligger i `content/kundeOpslag3.ts` med 29 tests**, ikke i
skærmen. Det vigtigste er `springerIOejnene`, som samler det der er galt
ét sted. Rækkefølgen er bevidst: **et hold uden tildelt træning står
øverst**, fordi der ikke kommer nogen fejl når det glemmes. Er listen tom,
står der at alt ser fint ud. En tom boks ligner en side der ikke virker.

**To ting der er lette at få galt i halsen:**

- **En dag uden registrering får ingen række**, ikke et nul. Et nul ser ud
  som om hun ikke spiste.
- **Snittet deles med de dage hun HAR tastet.** Ellers læser en status som
  en anklage mod en kunde der har haft en stille uge.

**Sidste aktivitet er det seneste af vores eget stempel (`sidstAktiv3`) og
hendes sidste måltid**, aldrig login-datoen. Den lyver for kunder med
appen på hjemmeskærmen, se 9.42.

**Siden skriver ingenting.** Alt der kan ændres ligger på de sider der er
bygget til det, og knapperne øverst peger derhen. Menupunktet "Slå en
kunde op" peger nu her i stedet for på træningssiden, som stadig findes på
`/ny/admin/traening/kunde`.

---

### 9.65 DEN 4. SEPTEMBER: GUIDEN DER SPÆRRER FOR AT UDGIVE ET HOLD

Skærm 4 i `mockups-admin.html`, tegnet 1. september og bygget nu. **Det er
den vigtigste af de nye admin-skærme**, og grunden står allerede i denne
fil: når noget bliver glemt ved en holdstart, kommer der ingen fejl. Der
kommer bare ingenting.

**To ruter.** `/ny/admin/forlob/nyt` er trin 1 og 2, altså navn, slags,
længde og startdato. Så snart der er trykket, findes holdet, og resten kan
gemmes undervejs. `/ny/admin/forlob/[id]/guide` er de ni trin.

**Holdet oprettes ALTID lukket.** Det åbnes først på trin 9, og kun når
der ikke er noget der spærrer. Guiden lukker aldrig et hold der er åbnet
igen, for så kunne en kunde midt i sit forløb miste adgangen ved et uheld.

**Den tjekker virkeligheden, ikke fluebenene.** Der er ingen "jeg har
husket det"-afkrydsning nogen steder. Guiden ser efter om tildelingen,
lektionen og skridtet ligger i databasen. Et flueben man sætter selv er
lige så nemt at sætte forkert som at glemme det oprindelige.

**Reglerne ligger i `content/forlobGuide3.ts` med 41 tests.** Skellet
mellem `spaerringer` og `bemaerkninger` er skarpt med vilje: spærrer alt,
spærrer ingenting, fordi så begynder man at lede efter vejen udenom.

**Det der SPÆRRER:**

- intet navn, ingen startdato, nul dage
- holdet har mikrotræning, men **ingen tildeling rammer det**
- træningen starter på en dag der ligger efter forløbets sidste
- ingen lektioner på nogen dag
- ingen små skridt
- Facebook-gruppen er slået til uden et link
- **et andet åbent hold står på det samme Simplero-nummer.** Så lander nye
  køb på det hold der starter senest, og det er ikke nødvendigvis det nye.
  Se `content/forlobKoeb.ts`

**Det der kun bemærkes:** ingen FAQ (Linn AI kan så ikke svare på hvornår
der er Q&A), huller i dagene, en startdato der er passeret, og et hold
uden både kunder og Simplero-kobling.

**Guiden er ikke et nyt sted at gemme data.** De små felter der bor på
selve holdet gemmes med den samme `gemForlob` som alle andre steder, og
alt det store, altså træning, lektioner, små skridt og biblioteket, åbnes
på de sider der allerede findes.

**Felterne til et nyt hold bygges nu ét sted.** `forlobGuide3.forlobFelter`
bruges både af guiden og af den hurtige vej på forløbs-listen. Der er to
veje ind til et nyt hold, og de skal gemme det samme, ellers opfører ét
hold sig anderledes end alle andre. `idAf` er flyttet med, uændret,
inklusive den lille skævhed at å bliver til a og ikke aa. Det er sådan de
eksisterende holds id'er er lavet, og et id kan ikke ændres bagefter.

**Trin 8 hedder Funktioner og ikke Velkomst.** Tegningen sagde Velkomst
med velkomstvideoer pr kundetype, men **den datamodel findes ikke**, og
guiden må ikke opfinde et sted at gemme noget. Skal velkomstvideoer
bygges, er det en opgave for sig, og så får guiden et trin mere.

**Ikke afprøvet som indlogget admin.** Skærmene svarer og bygger, men
begge kræver login, og jeg indtaster ikke Linns kode. De skal klikkes
igennem ved gennemgangen.

---

### 9.66 DEN 4. SEPTEMBER: KUNDE-OPSLAGET LØJ, OG HVORFOR

Linn slog Randi Frandsen op og fik en side der sagde to forkerte ting.
**Begge fejl er værd at kende, fordi de er nemme at lave igen.**

#### 1. Admin måtte slet ikke læse hendes tal

Reglerne sagde `request.auth.uid == uid` på måltider, faste måltider,
egne opskrifter, træningshistorik, symptomtjek og produkter. Altså kun
kunden selv. Siden fik nej på hvert opslag, fangede fejlen, og meldte så
**"Hun har aldrig registreret noget i appen"** om en kunde der havde
tastet hele ugen.

**`firestore.rules` er udvidet 4. september:** admin må nu LÆSE de seks
steder, aldrig skrive. Samme mønster som `vanedage` og `pushTelefon3`,
der har haft admin-læsning længe. `mrs_scores` kan stadig ikke opdateres
af nogen, heller ikke admin, fordi en udfyldt måling er forskningsdata.

**Reglerne tager op mod et minut om at slå igennem.** Første verifikation
efter deploy viste `mrs_scores` som afvist, anden viste den som virkende,
uden at der var rettet noget. Tjek to gange før du leder efter fejlen.

#### 2. "Ingen træning tildelt" om et hold der havde begge programmer

**Der er to steder at kigge efter træning, og koden kiggede kun ét.**

- 3.0 tildeler programmer i `traeningTildelinger3`
- Kickstart og Kropsro har dem liggende i
  `forlob/{id}/mikrotraeningProgrammer`, hvor kunden vælger sin variant
  ved opstarten. Ingen tildeling er nødvendig

Kunde-opslaget og **guidens spærring** kiggede begge kun i den første.
Resultatet var at hver eneste kunde på den gamle app fik "ingen træning
tildelt", og at guiden ville have spærret for at udgive et Kickstart-hold
der ikke fejlede noget. Begge ser nu begge steder.

#### Reglen der kom ud af det

**En status om et menneske må aldrig gætte.** Kan et tal ikke hentes, skal
der stå at det ikke kunne hentes, ikke det værste. `KundeInput` har derfor
`aktivitetKendt`, og er den falsk, tier listen "det der springer i
øjnene" om aktivitet i stedet for at sige "aldrig".

#### Reglerne deployes nu med et script

`scripts/deploy-regler.sh` lægger `firestore.rules` og `storage.rules` ud.
Der ligger et script i stedet for én lang kommando, så tilladelsen kan
gives til præcis den handling. **Firebase-værktøjet skal være `@latest`:**
version 13 kræver Node 18, 20 eller 22, og maskinen kører Node 24. Det er
grunden til at CLI'en så ud til at være forsvundet.

**Reglerne skal altid vises til Linn og godkendes før scriptet køres.**

---

### 9.67 DEN 3. OG 4. SEPTEMBER: LINN AI, TRE TING DER OGSÅ RAMMER HER

Arbejdet foregik i den gamle app, se "Rettet 3. og 4. september" i
`HANDOVER-GAMMEL-APP.md`. **Tre af ændringerne slår igennem her.** To af
dem rørte `/ny/beskeder` og `ny.css`, den sidste kommer af den delte motor.

#### 1. Svarets FØRSTE linje står nu øverst, ikke bunden

Før rullede vi til bunden når svaret kom, så hun landede i slutningen af et
langt svar og skulle selv rulle op for at læse det. `rulTilSvarTop` finder
den sidste svar-boble og stiller dens top øverst. **`.bobler` har fået
`position: relative`**, ellers måler den forkert, fordi boblens plads
regnes i forhold til den. `rulNed` bruges stadig ved hendes egen besked og
ved åbning.

#### 2. Stjernerne renses når svaret vises

`udenFormateringstegn` lægger sig om `delOpILinks`, så `**fed**` ikke står
råt i boblen. Det er nødvendigt her og ikke kun på serveren, fordi de svar
der allerede er gemt, har tegnene i sig.

#### 3. Manglende sikkerheds-tal tæller nu som usikkert

`/api/ny-ai` sendte `usikker: false` når markøren manglede, og markøren
mangler i cirka hvert tiende svar. Nu er `null` det samme som usikker.
**Feltet bruges ikke af siden endnu**, `visSend` tilbyder Linn ved hvert
svar, så det er kun rigtigt for rigtighedens skyld indtil videre.

Loftet på svarlængden er hævet fra 1024 til 2048 i begge apper, og
`stop_reason` læses nu, se den gamle overdragelse for målingen bag.

**Videnbasen og de faste regler er FÆLLES med den gamle app.** Alle de åbne
tråde om AI'ens grundlag står ét sted, i `HANDOVER-GAMMEL-APP.md` under
"Åbnet 4. september". Læs dem før du rører AI'en her.

---

### 9.68 DEN 4. SEPTEMBER: EN OVERDRAGELSE OM KUNDEOPLEVELSEN

`HANDOVER-KUNDEOPLEVELSE.md` er kommet til. Den handler ikke om hvad der
er bygget, men om hvad der sker hos kunden, og den bygger på målinger på
Kickstart August på dag 5 af 21.

**Læs den før du bygger noget der handler om hvordan kunden har det.**
De vigtigste tal: 53 af 323 der købte, kom aldrig ind. 63 af 315 har
aldrig tastet et måltid. 1 ud af 315 har sat sine egne mål. 23 af 121
spørgsmål handler om appen selv, og det største enkelttema er at få den
på hjemmeskærmen.

**En fejl blev fundet undervejs og rettet:** "Hun kan ikke nås på
telefonen" stod på alle 315 kunder, fordi beskeder på telefonen kun
findes i 3.0. Punktet vises nu kun for kunder på den nye app. **Et punkt
der aldrig kan være falsk, er støj.**

---

### 9.69 DEN 4. SEPTEMBER: SYMPTOMTJEKKET I KUNDE-OPSLAGET

Commit `059a911`, Linns ønske samme dag. Fanen viste kun totalen som en
række tal. Nu er der fire ting: kurven over MRS-totalen, hver målings tre
delscorer, de fem sliders med hver sin kurve og seneste værdi, og seneste
målings elleve svar skrevet i ord.

**SAMME KURVE SOM KUNDEN SELV SER.** Regnestykket er flyttet til
`content/mrsGraf3.ts` fra symptomcheck-siden i den gamle app, ikke skrevet
om. Ellers kunne Linns skærm og kundens skærm vise hver sin udvikling af
det samme, og så er samtalen tabt på forhånd. Filen tegner ikke, den regner
kun koordinater ud, så kurven kan prøves uden en browser.

**TO SKALAER DER VENDER HVER SIN VEJ**, og det er den nemmeste fejl at lave
her. MRS går 0 til 44 og LAVT er bedst. Sliderne går 1 til 10 og HØJT er
bedst. Derfor tager `retning` altid stilling til hvilken vej der er den
gode i stedet for at gætte på tallet, og der står ved hver kurve hvad man
skal håbe på.

Sætningen under kurven roser ikke og bebrejder ikke. Et symptomtjek der går
den forkerte vej siger noget om en krop i en hård periode, ikke om en kunde
der ikke gør sit arbejde.

**Migrerede rækker fra vaner-modulet har kun sliders.** De tæller med i
slider-kurverne og holdes ude af MRS-kurven, hvor de ellers ville tegne en
total på nul.

19 tests. **Kurven er ikke set med rigtige øjne endnu:** siden kræver
login, og der er kun én måling på de kunder der kunne slås op, så
flerpunkts-kurven mangler at blive set. Står den skævt, er det dét der
skal ses på først.

---

---

### 9.70 DEN 1. OG 2. SEPTEMBER: LYD OG BILLEDE TIL ÉN KUNDE

Commits `dc61326`, `f2e8405`, `30a1469`, `c894ce8`, `d44e0dd`. Linns ønske
1. september, tegnet som mockup og godkendt før der blev kodet.

**Beskeden fra Linn til én kunde kan nu bære ÉN lydbesked eller ÉT billede
ved siden af teksten.** Det er den samme besked, det samme sted, den samme
tråd. Der er ikke bygget en ny indbakke, og der er ikke to systemer.

**Hun optager direkte på skærmen** under Admin, Skriv til en kunde. Tiden
løber, den stopper selv ved fem minutter, og det hun har sagt indtil da
bliver liggende. Bagefter hører hun optagelsen igennem, og først da bliver
Send aktiv. **Beskeden kan ikke kaldes tilbage, så hun skal have hørt
præcis det kunden får.** Siger browseren nej til mikrofonen, skifter
knappen til at vælge en lydfil, og der står hvorfor. Hun skal aldrig stå i
en blindgyde.

**FILERNE LIGGER I KUNDENS EGEN MAPPE**, `/beskeder/{uid}/`. Det er den
eneste mappe i hele lageret hvor andre kunder ikke må kigge med: alt andet
indhold er det samme for alle, og derfor står der `request.auth != null` på
resten. Reglen er udgivet 3. september klokken 22.01 **og afprøvet i
virkeligheden**, ikke kun læst igennem: en opdigtet kunde kunne hente sin
egen fil, en anden kunde blev afvist, og uden login blev man afvist.
Testfilen og de to opdigtede kunder blev slettet bagefter.

**Serveren tjekker at adressen peger på netop DEN kundes mappe**,
`erVoresBeskedFil` i `content/beskedFil3.ts`. Det er ikke en mistanke til
Linn, men en spærre mod en tastefejl der ellers ville lande i en kundes
besked og ikke kunne kaldes tilbage.

**Billedet skrumpes i browseren før det sendes**, med den samme klods som
opskrift-billederne, `skalerTil(img, 'stor')`. Kun én størrelse: et billede
i en besked vises ét sted. Et telefonbillede på 2,4 MB bliver til omkring
60 KB.

**Afspilleren er ÉN klods, brugt to steder.** `components/ny/Lydbesked.svelte`
står både i Linns forhåndsvisning og i kundens tråd, så det hun hørte er
det kunden får. Det er med vilje IKKE den store `Lydafspiller` fra
lektionerne: den har plade, farter og hukommelse for hvor man slap, fordi
en lektion er tyve minutter man vender tilbage til. En besked er ét minut
man hører én gang.

**Billedet kan trykkes op i fuld skærm.** `BilledeLag.svelte` portales ud i
body. Uden det ligger bundmenuen ovenpå på en iPhone, og den regel har vi
betalt for at lære én gang.

**Prikket på telefonen siger hvad det er**, `medFilNoti3`: "Linn har sendt
dig en lydbesked" eller "et billede". Før sagde den altid "Linn har skrevet
til dig", og er der ingen tekst, leder kunden efter ord der ikke findes.

Grænserne: fem minutter lyd, 20 MB i Storage-reglen, og **én fil pr
besked**. Vælger hun et billede, ryger lyden, og omvendt. Skal der begge
dele til, er det to beskeder.

**Kunden kan ikke sende lyd eller billeder tilbage.** Hun svarer med tekst
som før. Det er et bevidst valg og ikke en mangel: det ville kræve at
kunder må skrive filer, og det ville give Linn en indbakke af filer.

Skriv til en kunde er i samme ombæring **den tyvende admin-side i det nye
udseende**. Den så ud som en telefonskærm med sidehoved og tilbage-pil midt
i en menu der står til venstre. Intet er ændret i hvad den gør.

`content/appHjaelp3.ts` har fået et afsnit om det, så App-hjælp kan svare
kunden om play-knappen og billedet. Videnbasen er håndholdt og ved kun det
vi fortæller den.

**DET MANGLER AT BLIVE PRØVET AF SOM KUNDE.** Linn skal sende en lydbesked
og et billede til en testbruger, logge ind som hende og se at begge dele
kan åbnes. Reglen er afprøvet på filniveau, men hele vejen gennem skærmen
er den ikke set endnu.

Låsen på upload-døren til R2, `dc61326`, hører til den gamle app og står i
dens overdragelse.

---

### 9.71 DEN 2. OG 3. SEPTEMBER: TJEK VIDEO, EN SIDE DER SPØRGER TELEFONEN

Commit `6190fcf`. Ligger under Admin, System, "Tjek video", på
`/ny/admin/tjek-video`.

**Hvorfor den findes:** kunder meldte om træningsvideo uden lyd, der hakker
eller er sort. Linn havde det selv på én iPhone 12 Pro Max, mens en anden
iPhone var fin i samme øjeblik. Lydkontakten, strømsparetilstanden, en
genstart, Safari uden om ikonet, pladsen på telefonen og lavdatatilstanden
blev alle afprøvet uden held. **Så holder gætteriet op med at være
nyttigt**, og telefonen må selv sige det.

**Siden viser BÅDE billede og tal.** Testvideoen kører synligt øverst ved
siden af målingerne. Det afgørende spørgsmål er, om telefonen TROR den
spiller mens ruden er sort: står der at billedet bevæger sig, og er ruden
alligevel sort, ligger fejlen i det telefonen tegner, ikke i det den
henter.

**Den kører først UDEN et tryk**, præcis som træningsskærmen gør, og kan
derefter køres igen MED et tryk. Er den første blokeret og den anden fin,
er det browserens regel om at starte af sig selv, og så ved vi hvad der
skal rettes. Til sidst er der en Kopier-knap, så svaret kan sendes videre.

Den måler også filens pakning. `mp4Pakning` i `content/tjekVideo3.ts` er et
rent modul og er prøvet af mod to rigtige filer, én af hver slags.

**Selve sagen er ikke løst.** Den hører til den gamle app, og den står som
åben tråd i `HANDOVER-GAMMEL-APP.md`. Det korte: fejlen forsvandt da Linn
loggede ud og ind igen, altså bygger den sig op i den kopi af appen der
kører på telefonen. **Næste gang den viser sig, skal tjek-siden åbnes FØR
der logges ud.** Log ud sletter beviset.

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

---

### 9.72 FORSIDEN STOD OG HENTEDE I RING, 4. september

**Symptomet.** Linn åbnede 3.0, og appen blev stående på vente-skærmen. Tallet
sprang mellem 0 og 100 procent og forfra, og siden blev aldrig færdig. Det
skete flere steder, ikke kun på én enhed.

**Det var ikke ventetid på udrulningen.** Den var ude, og serveren svarede på
under et sekund. Velkomstskærmen på `/ny` kom frem med det samme uden login, så
appen som sådan fejlede ikke.

**FIGUREN DER SVINGER ER NORMAL.** Det er `Ventetegn`, altså logoet med tegnet
der løber. Den sagde intet om fejlen, og den kostede tid at udelukke.

#### To fejl der forstærkede hinanden

**1. Hentningen startede forfra på for lidt.** Effekten på forsiden skulle køre
på `noegle`, altså ny kunde, ny dag eller nyt forløb. Men mens den stillede de
seks kald op, læste den også `userDoc`, `adgang.aktiveForlob`, `forlobKilder()`,
`aktivtForlob` og `nu`, og alt det blev dermed noget den holdt øje med.
Adgangsbilledet bygges om hver gang bruger-dokumentet ændrer sig, og skallen
lytter løbende på det dokument med `lytTilUserDoc`. **Hver ombygning giver NYE
objekter, også når indholdet er præcis det samme**, og så begyndte hentningen
forfra. Alt andet end nøglen læses nu i `untrack`.

**2. Sikkerhedslinen lå inde i hentningen.** Den skulle vise siden efter tolv
sekunder uanset hvad, men den blev ryddet i effektens cleanup og sat op igen
ved hver genstart. Uret blev altså stillet tilbage hver gang, og de tolv
sekunder løb aldrig ud. Uret ligger nu udenfor i `onMount` og starter én gang
pr besøg. Har det først vist siden, kommer vente-skærmen ikke igen: hentninger
der lander bagefter fylder stille resten ud, styret af `harGivetOp`.

**Fejl 2 er den alvorlige.** Uden den ville fejl 1 kun have været en
forsinkelse på nogle sekunder. Det er den slags fælde der er værd at kende
generelt: **en nødbremse der kan nulstilles af det den skal bremse, er ingen
nødbremse.**

#### Det der IKKE er fundet

**FUNDET TIL SIDST, da det viste sig hvilken konto det var.** Linn testede som
`kickstart-aug-2026@linnsacademy.dk`, altså Kimmie, og ikke som sig selv. Den
konto er helt sund: aktivt Kickstart-forløb, `ny-app` sat, intet skævt i data.

Udløseren er ikke én fejl, men **helt normale skrivninger til `users/{uid}`**.
`stempleAktiv3` skriver at hun har været inde, og Beskeder-siden skriver
`senestSpoergsmaalLaestAt` når hun har set et svar. Skallen lytter løbende på
det dokument med `lytTilUserDoc`, så hver af dem byggede adgangsbilledet om, og
hver ombygning gav forsiden en fuld genhentning.

**Der skal altså ingen uendelig løkke til.** Der skal bare komme skrivninger
oftere end hentningen når at blive færdig. Og fordi nødbremsen lå inde i
hentningen, blev uret stillet tilbage hver gang, så siden aldrig gav op.
Det er derfor fejlen så uregelmæssig ud og var svær at ramme.

**Læren:** alt hvad der skrives til bruger-dokumentet under normal brug er en
genhentning et andet sted i appen, hvis nogen læser adgangsbilledet i en
hentende effekt. Se reglen nederst i afsnittet.

Udelukket undervejs, så det ikke skal gøres om: Firestore-reglerne fra samme
formiddag (`isAdmin()` slår intet op, den læser mailen i tokenet, så den koster
ikke tid), opstartsvagten (den findes kun i den gamle app), og datamængde
(kontoen har 4 måltider).

#### Set undervejs, ikke rørt

**Linns egen konto har hverken `forlobIds` eller `products`**, men bærer stadig
`aktivtTraeningsprogram` tildelt `kickstart_august`. Altså et træningsprogram
der peger på et forløb hun ikke står på. Forelagt Linn, ikke ændret.

#### Fælden der kostede tid, igen

**Linn meldte "det virker fortsat ikke" mens Cloudflare stadig byggede.**
Skærmbilledet fra dashboardet viste commit'en med spinner og produktion stadig
på den forrige. Det er fjerde eller femte gang. `version.json` mod commit-tiden
er ikke nok i sig selv: **buildet kan være i gang, og så svarer den gamle
version stadig.** Se på Deployments-listen i Cloudflare, ikke kun på svaret fra
serveren.

#### Den samme ring fem steder mere, samme dag

Linn meldte 30-30 kort efter forsiden var rettet. Hele `/ny` er derfor
gennemgået, og der var **fem steder i alt**.

**SÅDAN FINDER DU DEM IGEN.** Tag hver `$effect` der henter, og se hvad den
læser SYNKRONT, altså før og med argumenterne til første `await`. Læser den
`userDoc`, `adgang`, `aktivtForlob`, `forlobKilder` eller noget udledt af dem,
kører den forfra hver gang adgangsbilledet bygges om. **Argumenterne til det
første await tæller med** — det var derfor 30-30 slap gennem første søgning,
hvor `userDoc` står som argument i `hentDagen(uid, d, userDoc, ...)`.

**30-30, den alvorlige.** Effekten læste `userDoc` og `fokus`. `fokus` er en
`$derived.by` der bygger et NYT objekt hver gang, så hver ombygning startede
hentningen forfra og satte `henter` til sand igen. **Udvejen fra 25. august,
to forsøg og så en fejlskærm med Prøv igen, nåede aldrig frem**, fordi den blev
afbrudt af næste genstart. Og der er ingen nødbremse på den side, så den kunne
hænge for evigt. Kører nu på en nøgle af rene værdier: uid, dato, forsøg og
`fokus.dagNummer`.

**Fire steder mere, som ikke kunne hænge, men hentede unødigt forfra:**
nærings-adgangen og svar-fra-Linn på forsiden, forsidebeskeden, og
skridt-flisen på Din side. Alle fire læste et helt objekt for at få én enkelt
værdi ud af det. De læser nu værdien gennem en `$derived`, så de kun kører når
den faktisk skifter. Ingen synlig ændring, bare færre kald.

**Gennemgået og frikendt:** de øvrige 20 sider under `/ny` med hentende
effekter. `profil/beskeder` så ud som en træffer, men den SKRIVER `tilstand` og
læser den ikke, så der er ingen ring.

**REGLEN, så det ikke sker igen:** en hentende effekt skal køre på en nøgle af
rene værdier, aldrig på objekter fra adgangsbilledet. Skal den bruge et objekt,
læses det i `untrack`. Adgangsbilledet bygges om hver gang bruger-dokumentet
ændrer sig, og skallen lytter løbende på det dokument.

---

### 9.73 BUNDMENUEN HENTER IKKE LÆNGERE FORFRA, 4. september

Linn: hver fane stod og loadede et kort sekund ved hvert skift. Årsagen var at
**hver fane hentede sine ting forfra hver eneste gang.** Træning henter fem
ting, forsiden seks, Udvikling tre. Frem og tilbage mellem to faner ti gange
gav ti hentninger af det samme. Mad-delen har haft en hukommelse længe, se
`fodevarer3` og `opskrifter3`, de øvrige faner havde ingen.

**Linn fik tre veje forelagt og valgte "husk hvad fanen viste".** De to fravalgte
var at cache kun det der sjældent ændrer sig, og at hente fanerne på forhånd
i baggrunden. Den sidste blev fravalgt fordi den koster kald til faner kunden
måske aldrig åbner, og vi er på Blaze.

**Ny fil `content/sidehukommelse3.ts`.** Vis det fanen viste sidst med det
samme, hent friskt i baggrunden. Vente-skærmen kommer nu kun første gang en
fane åbnes i et besøg. Prisen, som Linn er forelagt: har hun lige tastet noget
på en anden fane, kan hun se det gamle tal et halvt sekund.

**EJERSKABET ER DET VIGTIGSTE I DEN FIL.** Alt er bundet til ét uid, og
hukommelsen ryddes helt før der udleveres noget hvis brugeren har skiftet.
Det gælder både opslag og gemning, så der ikke findes en vej udenom. Dertil
`glemAlt()` ved logout i skallen. **Rører du filen, så lad de to tests om
bruger-skifte være i fred.** En delt telefon er ikke en teoretisk situation.

**Hukommelsen lever kun så længe appen er åben.** Der skrives intet til
telefonen, med vilje: en kopi der overlevede kunne vise tal fra i går, og den
slags har vi allerede haft fingrene i med den hurtige opstart. **Nøglerne bærer
det der skifter** — forsiden bruger sin fulde nøgle med dag og forløb, 30-30
bruger datoen — så en ny dag aldrig kan vise gårsdagens tal.

**Fire faner plus trådene i Beskeder.** Din side er ikke rørt, den har ingen
vente-skærm at fjerne.

**En detalje der er let at overse:** står der allerede noget fra sidst, og den
friske hentning fejler, lader vi det stå i stedet for at lægge en fejlbesked
oven på en side der virker. Det gælder Træning og 30-30.

---

### 9.74 SKRIFTLIGE LEKTIONER FIK EN FLISE DER LIGNER EN SIDE, 4. september

Linn om dag 5 på Kickstart August: "Få øje på dine #wins" så dumt ud, hvor
flisen bare var lilla med en stjerne.

**DET VAR IKKE ÉN FLISE.** 23 af de 42 lektioner i Kickstart August har intet
billede, 19 har. Alle 23 fik den samme lilla flade og den samme stjerne, så to
helt forskellige lektioner var umulige at skelne. På dag 5 gjaldt det både
wins-lektionen og Fibertilskud.

**Fem veje blev tegnet** i `mockups-skriftlige-lektioner.html`, og Linn valgte
A. De fravalgte: droppe firkanten helt for tekst, vise de første ord af selve
teksten (dyrt, kræver at hver lektion hentes), et emne-ikon pr lektion (kræver
at hun vælger et), og at hun selv lægger 23 billeder op.

**To ændringer.** En skriftlig lektion uden billede får nu en papir-flise med
sin egen titel på, uden "Dag 5, " foran. Og **beskrivelsen, som lå ubrugt i
data**, vises nu under titlen. Flere lektioner har allerede en, fx Fibertilskud
med "Det fibertilskud jeg selv bruger + 15 % rabat", og appen viste den ikke.

**Video og lyd er ikke rørt.** Video uden billede beholder sit ▶, lyd har Linns
eget billede i lilla tone.

**Det du skal passe på:** `.medie-thumb.side` skal blive stående EFTER
`.medie-thumb.tekst` i `ny.css`, ellers vinder den lilla gradient. Og reglen om
"Dag 5, " ligger i `content/lektionFlise3.ts`, ikke i komponenten, så den kan
testes. De vigtigste tests er at **"Dagens vaner" ikke bliver ædt**, og at en
titel der kun er et dagnummer beholder sig selv frem for at blive tom.

**Til Linn, og det er nyt:** beskrivelsesfeltet er nu synligt for kunden. Hvor
hun har skrevet en, bliver rækken markant bedre, og det er hurtigere end at lave
et billede. Lægger hun et rigtigt billede på, vinder det stadig over
papir-flisen, så de to løsninger kan bruges side om side.

---

### 9.75 UDSTYR: ET PROGRAM ER SKJULT INDTIL HUN SIGER HUN HAR REDSKABERNE, 4. september

Linn så at Kimmie fik tilbudt kettlebell-programmet uden at have valgt
kettlebells.

**FØR var en tom udstyrsliste et ja til ALT.** Begrundelsen dengang var at ingen
måtte stå med en tom træningsside. Prisen var værre end problemet: en kvinde
uden kettlebells kunne vælge programmet og nå flere træninger ind før det gik op
for hende. **Og det var ikke et kant-tilfælde: 0 ud af 318 på Kickstart August
havde valgt udstyr**, så hele holdet ville have fået det tilbudt.

**Reglen er nu:** vis det der passer til hendes udstyr, plus det der aldrig
kræver noget. Ikke andet. Vælger hun udstyret, kommer programmet frem i samme
øjeblik.

**DEN ANDEN VEJ ER MED VILJE UÆNDRET.** Har hun kettlebells, ser hun stadig
kropsvægts-programmerne — har man en kettlebell, kan man også træne uden. Det er
fluebenet `visesAltid` på kategorien Uden redskaber, og **det skal blive
stående.** Den fjerde post på "det Linn selv skal gøre" om at slå det fra er
dermed forkert og skal ikke udføres.

**Den tomme side er stadig dækket, og bedre end før.** `mt-tom` skelnede
allerede mellem "skjult af udstyr" og "intet tildelt". To tekster er skrevet om,
for de sagde begge "det udstyr du har valgt" til en kunde der aldrig havde
valgt noget. Det tilfælde kunne ikke opstå før, og er nu det almindelige.

**Admin følger med automatisk**, fordi opslaget bruger nøjagtig samme funktion.
Det viser nu "Hun har ikke valgt Kettlebells" i stedet for at påstå at
programmet er synligt. Det betyder at opslaget viser flere kunder som "mangler
noget" end før — **det er ikke en regression, det gamle billede løj.**

**Teksten må kun nævne udstyr der findes.** Den stod først med opfundne
eksempler, "kettlebells, elastikker eller andet", og Linn fangede det: der
findes ingen elastik-kategori. Navnene kommer nu fra hendes egne kategorier, og
kun fra dem der faktisk skjuler noget lige nu. Se `kategoriListeTekst3`.
Reserven er ordet "redskaber", vagt med vilje: vagt slår forkert.

**Åbent, ikke besluttet:** ingen på holdet har valgt udstyr, så alle vil kun se
kropsvægts-programmet indtil de siger fra. Det er det rigtige, men det gør
spørgsmålet "skal vi spørge dem én gang?" mere relevant den dag holdet flyttes.
Forslaget er tegnet som B i `mockups-udstyr-og-programmer.html`.

---

### 9.76 BESKEDER GJORT SOM I DEN GAMLE APP, 4. september

Linn: "beskedfunktionen skal rettes til så løsningen skal være det samme som på
den gamle app, men med det nye design." Fire forslag blev tegnet i
`mockups-beskeder-som-gammel.html`, og hun valgte **B: den gamle app plus det
3.0 allerede kunne**.

#### Hvad der var forskelligt, fundet ved at gennemgå begge sider blok for blok

**Den store forskel var ikke udseendet, det var en regel.** I den gamle app kan
kunden skrive direkte til Linn. I 3.0 fandtes der intet skrivefelt på fanen
Linn: vejen ind gik gennem AI'en, og feltet fandtes kun som svar på en besked
Linn selv havde startet. Dertil manglede Linns intro-tekst, noten om anonyme
svar, dag-mærker, tegn-tælleren, sikkerheds-procenten, og selve chat-formen.

#### Det der er bygget

**Fanen er en samtale**, ældst øverst. Linns egen ordlyd første gang, med
"Kh Linn". Dag-mærker, "Afventer svar", tegn-tæller ved 400 af 500. **Ét
skrivefelt forneden** i stedet for et pr tråd: et svar på Linns besked blev
allerede gemt som et helt almindeligt spørgsmål, så Linn ser det samme som før.

**Alt 3.0's eget lever videre inde i boblerne**, og det var hele pointen med B:
lyd, billeder, klikbare links, at Linn kan skrive først, og "Nyt svar".

**Sikkerheds-procenten vises nu til kunden.** Det omgør en regel der stod to
steder i koden. Tallet blev kastet væk tre steder på vejen og bæres nu hele
vejen, se `content/aiSikkerhed3.ts`. **Gamle beskeder har intet tal gemt** og
viser derfor den forsigtige linje uden procent. Det er korrekt, ikke en fejl.

#### RULNING OG LAYOUT: læs det her før du rører noget der klæber

Fire fejl i træk samme dag, og alle af samme grund. **Det er ikke boble-listen
der ruller, det er skallens `.ny-scroll`.** Listen har selv `overflow-y: auto`,
men `.ny-scroll` er ikke en flex-container, så listens `flex: 1` bider ikke.

1. **`rulNed()` har aldrig virket.** Den har stået der siden 23. august og sat
   scrollTop på et element der ikke ruller. Ingen opdagede det, fordi en kort
   samtale ikke fylder mere end skærmen. Se `utils/rulning3.ts`, som leder
   opad efter det der faktisk ruller
2. **Nøglen blev brugt op før elementet blev læst**, så var listen ikke tegnet
   endnu, blev der aldrig rullet
3. **Striben under skrivefeltet: feltet er i TO tilstande.** Klæbende når hun
   er rullet op, og helt almindelig når hun er rullet til bunden. `bottom`
   dækker den første, `margin-bottom` den anden. **Negativ margin plus
   polstring virker IKKE**: et klæbende element holder sin bund fast, så
   polstringen vokser opad og gør feltet højere
4. **Fane-skift hoppede.** Skiftet til Linn gør indholdet kort, browseren
   klamper positionen mod toppen, og ved skift tilbage stod samtalen øverst og
   blev rullet ned bagefter. Positionen gemmes nu før skiftet og gendannes

**Lære, og den kostede en time af Linns tid:** mål i browseren i stedet for at
gætte på timing. De tre første forsøg gik alle på timing, mens fejlen lå i
layoutet. Se `feedback_test_altid_i_chrome`.

#### Åbent

**Skrivefeltet ligger nu fast forneden**, og fanerne klæber øverst. Begge dele
er Linns ønske og virker. **Alt er afprøvet af mig selv i Chrome som Kimmie**,
ikke kun med tests.

---

### 9.77 UDVIKLING: TRE FEJL I KURVERNE, 4. september

Alle tre fundet ved at måle i browseren, ikke ved at kigge i koden.

**1. Symptom-kurven manglede de stiplede stykker.** To målinger stod uden noget
imellem sig, og så ligner det at kurven er i stykker frem for at der ikke er
målt. De to grafer bruger den SAMME `byggKurve`, så hullerne lå der allerede i
data — de blev bare aldrig tegnet i symptom-grafen. Forglemmelse fra 18. august.

**2. Aksens tal blev klippet af grafens venstre kant.** Tallene står
højrestillet og blev tegnet 5 enheder inde, altså med højre kant på 8. Et
tocifret tal fylder 11,3 ved 8,5 px, så "20" begyndte på **minus 3**.
`akseBredde` er sat op fra 13 til 16, og springet fra 5 til 4.

**DET VAR IKKE ET SKÆRMBREDDE-PROBLEM**, og det var min egen første mistanke
der var forkert. Målene ligger i grafens eget koordinatsystem og skalerer med
bredden, så en telefon rammer nøjagtig det samme. Det var kun tydeligere på en
bred skærm.

**3. X-aksen havde kun en slutdato.** Uden en startdato siger kurven ikke hvor
lang en periode man kigger på, og så betyder formen ingenting. Startdatoen står
nu venstrestillet ved første punkt. **De to vokser mod hinanden**, så den vises
kun når der er plads, se `visStartDato3`. Ellers vinder slutdatoen, for den
siger hvor frisk tallet er. Bredden regnes af tekstlængden og er ikke et fast
tal, fordi datoen kan være både "1. sep" og "26. dec 2025".

**Alle tre gælder BEGGE kurver på siden** — overskud og symptomer — fordi de
deler `byggKurve` og `FLADE_UDVIKLING`. Retter du noget i den ene, så se efter
om den anden har det samme.

---

### 9.78 TRE BESLUTNINGER FRA LINN, 4. september

**1. TRÆNINGEN VENTER PÅ KUNDEN I 3.0.** Ikke kalender. Næste træning er den
laveste hun ikke har taget, og springer hun en dag over, forsvinder den ikke.

**Det her punkt har blokeret for at flytte et hold siden 22. august, og det
kostede nul kode.** Verificeret efter beslutningen: `naesteTraening3` gør det
allerede, og der findes ingen kalender-tekst nogen steder i træningen — hverken
"I dag, tirsdag" eller ugedage. Teksterne er "Vælg din træning", "Du er
igennem X" og "Træning 7 af 21", som alle er sande uanset.

**DE TO APPER GØR NU BEVIDST NOGET FORSKELLIGT.** Den gamle apps kravspec fra
9. juni siger fast kalender-plan, programdag = forløbsdag 1:1. **Den gælder kun
den gamle app.** Første hold i 3.0 er et Kickstart-hold, så reglen skifter under
netop de kunder, og det er med vilje. Se `project_kickstart_traening_krav`, som
er mærket med det.

**2. HENSYN VENTER.** Halvdelen der virker er stadig den halvdel ingen kan se:
admin-siden og reglen findes, men kunden kan ikke bede om et hensyn, og
**0 ud af 62 øvelser har et mærke**, så et hensyn ville alligevel ikke filtrere
noget fra. Linns beslutning: det venter. Byg ikke videre på det uden et nyt go.

**3. "NULSTIL APPEN PÅ DENNE ENHED" SKAL IKKE I 3.0.** Punktet har stået på
listen siden 26. august, hvor Linn selv sad fast uden den. Det er nu droppet.
Knappen findes fortsat i den gamle app under Din profil.

#### Hvad der så er tilbage før et hold kan flyttes

1. **De fire velkomstvideoer.** Indhold fra Linn, ikke kode. Har stået øverst
   siden 16. august og er nu det eneste der reelt spærrer
2. Programmerne: to er tildelt Kickstart August fra dag 3 og verificeret.
   To andre er stadig kladder og kan ikke tildeles

---

### 9.67 DEN 4. SEPTEMBER: OPSKRIFTERNES TAL BLEV RETTET, OG BEGGE APPER BRUGER NU 3.0's REGNESTYKKE

**Læs det her før du rører makrotallene i 3.0.**

Den 4. september blev hele fødevare- og opskriftsgrundlaget ryddet op fra den
gamle apps side. Se `HANDOVER-GAMMEL-APP.md`, afsnittet "Rettet 4. september
2026: opskrifternes to tal gav to forskellige svar", for hele gennemgangen.
Kort fortalt: omkring 70 ingredienser koblede til den forkerte fødevare, 70
fødevarer manglede måleenheder efter DTU-berigelsen 24. august, seks fødevarer
havde tørvægtens tal på en kogt vare, og stegefedtet manglede på 34
ingredienslister. Alle 130 opskrifters makro-linje er skrevet om, og tre tomme
kladder er slettet.

**Konsekvensen for 3.0.** De beregnede tal i `ingrediensKobling/beregninger` er
et bevidst øjebliksbillede, se `opskriftBeregning3.ts`. Det blev sidst regnet
den **1. september**, altså før oprydningen. Det betyder to ting:

- **Tallene i 3.0 og i den gamle app er forskellige lige nu.** Linns egen
  morgenmad står gemt som 28,6 g protein og 4,8 g fiber i 3.0, hvor den rigtige
  er 29,4 og 10,8. Snackbøtten står som 310 kalorier mod 375.
- **Øjebliksbilledet indeholder stadig de tre slettede kladder**
  `opskrift_mowzma5w`, `opskrift_mqb0b8ma` og `opskrift_msm5qc7m`.

**Hvad der skal gøres.** Linn skal ind på `/ny/admin/opskrift-makro`, regne om
og se listen igennem, præcis som arkitekturen er tænkt. Det er ikke noget der
må ske automatisk, og det er ikke gjort 4. september.

**Omregningen ER kørt, senere samme dag.** Øjebliksbilledet er nu 130
opskrifter med fuld dækning på dem alle, og de tre kladder er væk. Undervejs
skulle to ting rettes først, ellers ville omregningen have gjort 3.0 dårligere:

- **12 koblinger manglede** efter dagens omdøbninger af ingredienser, blandt
  andet letmælk, pastinak, rugknækbrød og fibertilskuddet. Dækningen faldt til
  42 procent på den værste. De er lagt ind i `ingrediensKobling/koblinger`.
- **Vægttabellen kendte ikke fire nye styk-varer.** Et ukendt styk regnes som
  100 g, så én måleske fibertilskud blev til 76 g fiber og to knækbrød til 200
  g. Vægtene i `enhedsvaegt3.ts` følger tabellens egne naboer.

**Den åbne tråd fra 15. august er IKKE løst, og forventningen skal justeres.**
Punkt 1 dér var at få samme tal i begge versioner. Efter omregningen er de to
apper inden for 50 kalorier på **70 af 130** opskrifter. De øvrige 60 skiller
sig, nogle med op til 280 kalorier, for eksempel Kylling-curry med kikærter
hvor den gamle app siger 734 og 3.0 siger 452.

Årsagen er at det er **to uafhængige regnestykker**. Den gamle app slår
ingrediensen op i fødevaredatabasen og bruger varens egne `units`. 3.0 bruger
sit eget koblingskort og sin egen vægttabel i `enhedsvaegt3.ts`. De vil aldrig
give samme svar af sig selv, uanset hvor rent grundlaget er.

Skal de to nogensinde vise det samme, er der to veje: enten skrive 3.0's
beregnede tal ud i den gamle apps makro-linjer, som var den oprindelige plan,
eller lade begge apper bruge det samme regnestykke. Ingen af delene er
besluttet.

**Fælden der blev rettet i koden** rammer også 3.0, fordi begge apper bruger
samme opslag. Ordet "eller" i en ingrediens blev brugt som søgeord, så "æble
eller en håndfuld bær" ramte Kantareller. Og et valg giver nu den **første**
mulighed, ikke den med det længste navn. Skriver du et nyt ingrediensnavn, så
brug aldrig to kommaer: det læses som en liste og bliver splittet.

#### Senere samme dag: den gamle app bruger nu 3.0's regnestykke

Linns beslutning, ordret: uanset hvilken ingrediens eller opskrift man slår op
i den nye eller den gamle app, skal det vise det samme. Både beskrivelsen,
makrotallene forneden og beregningen.

To af de tre var ens i forvejen. Teksten, fordi begge apper læser det samme
dokument. Opslag på en enkelt fødevare, fordi begge bruger `gramForEnhed` og
`effektivKcal`. Det eneste der skilte sig var opskrift-regnestykket.

`content/opskriftTal3.ts` er broen. Den gamle apps opskrift-side henter nu
`ingrediensKobling/beregninger` og `koblinger`, vælger tallet med `visMakro`
præcis som 3.0 gør, og bygger byg-måltid af 3.0's linjer. Kan intet hentes,
falder den tilbage på makro-linjen i teksten.

**Enheden beholdes kun når den giver samme vægt.** 3.0's tabel siger 55 g pr
æg, varen selv siger 58. Beholdt vi enheden dér, ville byg-måltid vise 29,7 g
protein hvor opskriften siger 28,6. Er de to uenige, vinder gram.

**REGLEN FRA 13. AUGUST OM AT OPSKRIFTERNE ALDRIG MÅ RØRES ER OPHÆVET.** Linn
ændrede den 4. september. `regnOpskrifterOm` skriver nu makro-linjen om i samme
kørsel som beregningen, så det skrevne og det viste altid står ens. Kun de fem
tal røres, og rækkefølgen er: gem beregningen først, skriv teksten bagefter.
Går skrivningen galt, står beregningen stadig rigtigt, og det er den kunden
ser. Kvitteringen i `admin/ingrediens-tal` siger hvor mange linjer der blev
skrevet om.

Begrundelsen står i koden ved siden af, så den ikke bliver rullet tilbage af en
der kun kender den gamle regel.

---

### 9.79 OPRYDNING OG ENSRETNING, 5. september

Linn bad om en gennemgang af hele 3.0 for uoverensstemmelser i design og
funktion. Her er hvad der kom ud af den.

#### Først det der VAR i orden

Designet var mere konsistent end forventet. Samme titel-skrift og -størrelse,
samme margen, samme palette. **Alle hentende sider har en fejl-udvej** — det var
ikke tilfældet 25. august. Fuldskærms-billeder ligger korrekt over bundmenuen.
De sider uden fælles `Sidehoved` har deres eget med vilje.

#### Tre steder hvor kunden mødte en halvfærdig app. Alle fjernet

1. **"Resten af din profil kommer her. Siden er ikke bygget færdig endnu."**
   stod på Din side. Siden har **otte sektioner** — den var bygget. Linjen var
   usand og det eneste sted i 3.0 hvor appen talte ned om sig selv
2. **`/ny/moduler` slettet.** Linn: der kommer ikke noget der hedder moduler
3. **`/ny/forlob` slettet.** Linn: der kommer ikke noget der har forløb

Begge ruter blev tjekket for referencer først. De to træffere var kommentarer
om at de IKKE længere peger derhen. `/ny/forlob` var også i
`scripts/skaermbilleder.ts`.

#### Vente-skærmen: ÉN i hele appen

Forsiden var det eneste sted med en procent-bjælke, de 21 øvrige havde den
rolige. **Ny `components/ny/Venter.svelte`**, brugt alle 22 steder — før stod
den samme stump markup 22 gange, og så driver de fra hinanden igen.

**Linns valg: forslag B.** Trækker det ud, kommer der efter fire sekunder en
linje: *"Det tager længere end normalt. Din forbindelse er måske langsom lige
nu."* **Fire sekunder er valgt så en normal hentning aldrig når at vise den** —
kommer den for tidligt, lærer kunden at appen altid er langsom, og så betyder
den ingenting den dag den er sand. `aria-live`, så en blind kunde ikke sidder i
tavshed.

**Otte sider sagde før bare "Henter" eller ingenting.** De siger nu hvad hun
venter på. Velkomst-skærmen siger "Et øjeblik, jeg gør klar" — den er den
allerførste skærm en ny kunde ser, og der stod ingenting.

**To undtagelser, begge med vilje:** `/ny/snak` sender videre på et splitsekund
og får ingen "trækker ud"-linje. Og "Tænker"-boblen i AI-chatten beholder det
bare ventetegn — den er en besked i samtalen, ikke en vente-skærm.

#### Tilbage-knappen peger nu hvor hun kom fra

Linns eksempel: Dine egne små skridt sagde "Forside", også når hun kom fra Din
side. **Fire sider nås fra flere steder** og havde problemet: små skridt,
målingen, øvelserne og byg dit eget. De øvrige tolv nås kun ét sted fra.

`content/forrigeSide3.ts` husker hvor hun kom fra. **Den faste adresse er
beholdt som reserve**, så ingen side mister sin knap når den åbnes fra en besked
eller et bogmærke.

**Hvorfor ikke `history.back()`:** teksten skal sige HVOR hun lander. "‹
Tilbage" er en dårligere knap end "‹ Din side". Derfor gemmes både adressen og
navnet, og kun ruter med et kort navn huskes — en underside som
`/ny/traening/abc/3` springes over, så et smut derind ikke ødelægger knappen.

**REGISTRERINGEN SKAL LIGGE I `beforeNavigate`, IKKE I EN `$effect`.** Første
forsøg brugte en effect, og den kører EFTER siden er tegnet: så nåede
sidehovedet at læse den gamle værdi, og der stod stadig "Forside". **Det er
tredje gang i to dage at en `$effect` har kørt på et andet tidspunkt end
forventet**, se også 9.76 om rulningen.

#### Bevidst uændret

**Tallene i graferne skalerer IKKE med tekststørrelsen.** 711 af 723 font-size
i `ny.css` bruger `--fs-scale`. De sidste 12 er SVG-tekst i kurverne. **Linns
beslutning: lad det blive.** Skalerede de, ville de blive klippet af grafens
kant, præcis den fejl der blev rettet 4. september. Ret det ikke i god tro.

#### En fælde i at teste selv, som kostede tid

**Et klik udført med kode (`element.click()`) udløser en FULD sideindlæsning**
og ikke appens egen navigation. Alt der lever i hukommelsen bliver nulstillet,
og så ser en rettelse ud til ikke at virke. Jeg troede tilbage-knappen var i
stykker to gange af den grund. **Klik som en rigtig bruger når du afprøver
noget der afhænger af navigation.**
