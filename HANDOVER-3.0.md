# Overdragelse: Linns Academy 3.0

Sidst opdateret 11. august 2026.

**Læs i denne rækkefølge hvis du er ny:** afsnit 2 om den vigtigste regel, afsnit 7 om fælderne, og så afsnit 9 om hvor vi står. Resten kan slås op efter behov.

Denne fil er til den næste der skal arbejde videre, uanset om det er et nyt Claude-vindue, Bo eller en udvikler udefra. Den fortæller hvor vi er, hvordan tingene hænger sammen, og hvor fælderne ligger.

**Der findes én overdragelse, og det er den her.** Gamle overdragelser fra 1.0 og 2.0 ligger i `arkiv/` og gælder ikke. De blev flyttet derned 11. august, fordi tyve filer i roden der alle lignede en overdragelse var en fælde: den med det højeste nummer så nyest ud og var det ikke.

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
- **`firestore.rules` og `storage.rules` deployes ikke af et push.** Siden 9. august 2026 udgives de med Firebase CLI, se afsnit 8. Reglerne styrer adgang for alle kunder i drift, så vis altid Linn den præcise ændring og få et ja først.

### 3.2 Filerne

| Sted | Hvad |
|---|---|
**Alt der hører til 3.0 ender på `3`.** `adgang3.ts`, `forside3.ts`,
`maaltider3.ts` og så videre. Ser du en fil uden 3-tallet, hører den til den
gamle app og må kun læses.

| Sted | Hvad |
|---|---|
| `src/routes/ny/+layout.svelte` | Skallen. Adgangs-gate, spærring, bundmenu, contexts for `user`, `userDoc`, `adgang` og `forlob`. **Læg ikke nyt her uden en god grund**, se SPEC 26.5 |
| `src/routes/ny/ny.css` | Alt design. Scoped under `.ny-app`. Cirka 2.000 linjer |
| `src/lib/components/ny/` | 20 komponenter, alle kun brugt i 3.0 |

**Ren logik, ingen database, alt sammen testet:**

| Fil | Hvad | Tests |
|---|---|---|
| `content/adgang3.ts` | Adgangsmodellen, dagnummer, medlemstid | 44 |
| `content/challenge3.ts` | Challenge: mål, gitter, stilling | 42 |
| `content/maengde3.ts` | Mængde, spring pr enhed, næring | 28 |
| `content/forside3.ts` | Kurve, målinger, kadence | 27 |
| `content/maaltider3.ts` | Dagens fire måltider og deres tal | 27 |
| `content/nulDage3.ts` | Pause-dage. Se 9.2 | 24 |
| `content/spaerring3.ts` | Spærring ved abo-udløb. Se 9.3 | 12 |
| `content/inspirator3.ts` | Hvornår AI-inspiratoren dukker op | 12 |
| `content/plejer3.ts` | "Det du plejer". Modulets vigtigste fil, læs toppen | 12 |
| `content/beskeder3.ts` | "Til dig lige nu" | 8 |

**Firestore-laget, kun læsning på nær måltider:**

| Fil | Hvad |
|---|---|
| `firestore/forside3.ts` | Alt til forsiden |
| `firestore/maaltider3.ts` | Dagens måltider |
| `firestore/plejer3.ts` | Vaner, og den eneste fil i 3.0 der **skriver** kundedata |
| `firestore/challenge3.ts` | Challenge, både nye og gamle |
| `firestore/nulDage3.ts` | Pause-dage |
| `firestore/featureAdgang3.ts` | Feature-adgang. Hentes her, ikke i skallen |
| `firestore/challengeAdmin3.ts` | Admin: opret og tildel challenges |
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
| `/ny/beskeder` | Beskeder til Linn. Færdig |
| `/ny/snak` | Kunde-chat med AI. Færdig |
| `/ny/maaling` | Spørgeskema. Færdig |
| `/ny/udvikling` | Bygget, men ikke gennemgået mod den gamle app endnu |
| `/ny/moduler` | Gammel skitse. **Ikke længere i bundmenuen**, erstattet af 30-30 |
| `/ny/profil`, `/ny/hjaelp`, `/ny/forlob` | Bygget |
| `/ny/admin/challenges` | Admin: opret og tildel challenges. Kun admin. Intet menupunkt, skriv adressen |
| `/ny/30-30` | 30-30 beregneren, oversigten. Fire måltider og dagens tal. Færdig |
| `/ny/30-30/[type]` | Inde i et måltid. Alt indhold hænger her. Færdig |

**Bundmenuen:** Forside · 30-30 · Snak · Udvikling · Profil.

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

**`opretDoc` findes ikke i `firestoreRest.ts`.** Brug `gemDocMerge` med et selvlavet dokument-id.

**Firestore-regler driver.** Sammenlign altid de live regler med `firestore.rules` i repoet, inden du udgiver noget. Det er nu ét kald, se afsnit 8.

---

## 8. Sådan tjekker du dit arbejde

```
npx svelte-check --threshold error     # skal give nul fejl
npm test                               # 916 tests lige nu, alle grønne
npm run build                          # ved kundefølsomme ændringer
git status --porcelain                 # kun nye eller 3.0-filer må stå der
```

**Firestore-regler.** Siden 9. august 2026 ligger `firebase.json` og `.firebaserc` i repoet, så regler ikke længere kopieres ind i Console i hånden:

```
npx firebase-tools deploy --only firestore:rules
```

Den oversætter reglerne først og nægter at udgive hvis der er en syntaksfejl. Reglerne styrer adgang for alle kunder i drift, så **vis altid Linn den præcise ændring og få et ja, før du kører den.** Servicekontoen i `scripts/` kan desuden læse de live regler, så du kan sammenligne med repoet uden at udgive noget.

Data-scripts mod rigtige kunder skrives som `scripts/_navn.ts`, køres med `npx tsx`, og **slettes bagefter**. Kør altid read-only eller dry-run først og vis Linn resultatet. Skal der skrives til kundedata, skal Linn sige ja specifikt til netop den kørsel.

---

## 9. Hvor vi står, og hvad der er næste skridt

Opdateret 11. august 2026. Alt herunder er kodet, committet og pushet, og `main` er i sync.

**Etape 1 til 3 er færdige, og hele den åbne liste fra 6. august er klaret.** Etape 4 er i gang: 30-30 beregneren er bygget og i brug, se 9.4.

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
andet end Biblioteket kan nås fra forsiden. **30-30 beregneren** har taget
dens plads i bundmenuen.

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

### Efter 30-30

Resten af etape 4:

- **Træning.** Kunden skal kunne vælge sit program første gang der trykkes, og
  skifte valg løbende. Nås fra dagens træning på forsiden
- **Biblioteket** som et kort nederst på forsiden, kun for dem der har adgang
- **`/ny/udvikling`** er bygget, men aldrig gennemgået mod den gamle app

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

### Arbejdsformen der virker

Det her er ikke teori. Det er hvad der faktisk har fungeret, og hvad der ikke har.

**Mål på rigtige kundedata før du vælger design.** Det har ændret designet flere gange, og hver gang til det bedre. Skriv scriptet som `scripts/_navn.ts`, kør det læs-kun, vis Linn tallene, og slet scriptet bagefter. Tre eksempler: de 68,5 % gentagelser flyttede hele Mad-skærmen, de 13 madvarer om dagen aflivede tre forslag, og en måling viste at ingen kunde ville blive låst ude af spærringen.

**Ét skærmbillede ad gangen.** Tegn det, få det låst, byg det. Vi tegnede fem runder mockups af Mad-modulet på et gæt om hvad det indeholdt, før vi gennemgik det. Det var spildt arbejde.

**Gennemgå det gamle modul blok for blok, før du tegner noget.** Det gælder både forsiden og Mad, og det gav begge gange en liste over ting der ellers var blevet glemt.

**Byg i små bidder når noget er gået galt.** En samlet ændring gav en blank app uden at årsagen kunne findes. Delt i to bidder virkede den samme funktion uden problemer.

**Linn tester på telefonen, og hun finder ting du ikke kan se.** Fem fejl på to aftener: tomme cirkler, forkerte skriftstørrelser, et gennemsigtigt ark, et mærkat der lå hen over et ikon, og et tal uden ord på. Vurdér aldrig et design færdigt før det har været i hendes hånd.

**Skærmbillederne ligger i `Projekter/v3 app/Screenshots v3/`**, ikke i repoets `screenshots`-mappe.

**Efter hver udrulning skal hun lukke fanen helt.** Appen gemmer en kopi af sig selv, og den viser gerne den gamle udgave. Det har fire gange lignet en fejl i koden.
