# Overdragelse: den gamle app

Sidst opdateret 4. september 2026.

**LEDER DU EFTER NOGET OM VIDEO ELLER LYD PÅ TRÆNINGEN, så læs "Rettet 2. til
4. september" i afsnit 7 og de to nye åbne tråde fra 3. september i afsnit 9.**
Alle 62 øvelsesvideoer er pakket om, øvelsesvideoerne har slet ingen lyd, og
den sorte skærm på Linns egen iPhone er stadig uforklaret.

**UGEN 27. TIL 31. AUGUST VAR NÆSTEN UDELUKKENDE DEN HER APP.** 39 ændringer,
og de er samlet i afsnit 7. Det er den travleste uge i den gamle app siden 3.0
blev påbegyndt, og grunden er at et stort Kickstart-hold kom ind. Leder du efter
noget fra den uge i `HANDOVER-3.0.md`, står det ikke der, og det er med vilje.

**Denne fil handler KUN om den app der er i drift på `/app`.** Den må ikke blandes sammen med `HANDOVER-3.0.md`, der handler om den nye kundeflade på `/ny`. To apps, to filer, to arbejdsspor. Retter du noget i den gamle app, hører det til her. Bygger du på 3.0, hører det til der.

**Læs i denne rækkefølge hvis du er ny:** afsnit 2 om hvornår du overhovedet må røre den, afsnit 6 om fælderne, og så afsnit 9 om hvad der er åbent. Resten slås op efter behov.

Læs den sammen med `CLAUDE.md` i repo-roden. Det er arbejdsreglerne, og de gælder begge apps. Gamle overdragelser fra 1.0 og 2.0 ligger i `arkiv/` og er forældede.

---

## 1. Hvad den gamle app er

Kundefladen på `/app`. Målt 1. september 2026 er der **925 kunde-dokumenter** og **942 mails på whitelisten**. Det er den app kunderne betaler for lige nu, og den der skal blive ved med at virke mens 3.0 bygges.

**APPEN VOKSEDE MED HALVDELEN PÅ EN UGE.** Den 18. august var tallet 618. **307
af de 925 er oprettet siden 26. august**, altså et helt nyt Kickstart-hold. Det
forklarer hvorfor hele den sidste uges arbejde ligger her og ikke i 3.0, og det
er værd at have med når du vurderer risiko: en fejl der før ramte 618 rammer nu
halvanden gang så mange, og en stor del af dem er splinternye kunder der aldrig
har set appen før.

Den er bygget om **forløbet**, ikke om kunden. Derfor har forsiden tre forskellige udgaver, styret af `effektivState(userDoc)`:

- **forlobskunde**, altså et aktivt forløb. Hun ser dagens indhold, sine små skridt, træning og mad.
- **modulbruger**, altså et abonnement uden forløb. Hun ser sit eget spor uden dag-nummer.
- **udlobet**, altså ingen af delene. Hun ser sit bibliotek hvis hun stadig er i bonus-perioden, ellers en købsside.

70 sider under `src/routes/app/`, hvoraf godt halvdelen er admin. 21 endpoints under `src/routes/api/`, heriblandt fire Simplero-webhooks (`koeb`, `fornyelse`, `afbrudt`, `betaling-fejlede`).

---

## 2. Hvornår du må røre den

**Udgangspunktet er at du ikke må.** `CLAUDE.md` regel 2 siger at ingen eksisterende fil må ændres, fordi der er kunder i drift.

Der findes én ventil, og det er akutte fejl der rammer kunder lige nu. Så gælder:

1. Diagnosen først. Vis Linn hvad der er galt, hvem det rammer, og hvad du foreslår. Vent på et klart ja.
2. Egen opgave og egen commit. Aldrig blandet sammen med 3.0-arbejde.
3. Mål altid hvor mange kunder ændringen rører, før du skriver kode. Tallet skal stå i commit-beskeden.
4. Commit og push kun når Linn beder om det. Push til `main` deployer automatisk til kunderne via Cloudflare.

Den bedste rettelse i den gamle app er den der ikke kan ses. Vælg altid den mindst risikable løsning frem for den pæneste.

---

## 3. Sådan er den bygget

SvelteKit med Svelte 5 runes. Firebase står for Firestore, Auth og Storage. Hosting er Cloudflare Pages.

**Filerne følger en enkel regel:** alt der ender på `3` tilhører 3.0 og skal ikke røres herfra. `src/lib/content/mrs.ts` er den gamle app, `src/lib/content/forside3.ts` er 3.0. `src/lib/firestore/vaner.ts` er den gamle, `src/lib/firestore/onboarding3.ts` er ny.

De filer du oftest ender i:

- `src/lib/userDoc.ts` er login-synkroniseringen. Den kører hver gang kunden åbner appen, læser hendes whitelist-række og skriver hendes tilstand. Alt om adgang starter her.
- `src/lib/utils/userAdgang.ts` er tilstands-udledningen, altså `effektivState`, `erForlobsklient`, `harBibliotekAdgang` og resten.
- `src/lib/content/forlobAdgang.ts` er typer og ren logik om forløb og adgang, inklusive `forlobSlutMs` og `bibliotekBonusSlutMs`.
- `src/lib/content/adgangResolver.ts` afgør ud fra datoer om kunden er på forløb, abonnement eller udløbet.
- `src/lib/content/features.ts` afgør hvilke funktioner en kundetype har.
- `src/lib/firestore/forlob.ts` er opslagene mod Firestore, blandt andet `hentAktivtForlob`, `hentAktivProduktType` og `hentNulDagePrForlob`.

---

## 4. Datamodellen

Rod-samlingerne i Firestore er `users`, `allowedEmails`, `forlob`, `products`, `opskrifter`, `fodevarer`, `exercises`, `klientspoergsmaal`, `trainingPrograms`, `featureAdgang`, `adminStats`, `mrsCache`, `webhookLog` og en håndfuld til 3.0 og AI.

**`allowedEmails/{email}` er sandheden ved login.** Her står hvilket forløb kunden er købt på, hendes niveau og hendes status. `userDoc` udledes af den, ikke omvendt. Skal en kunde på et hold, er det her det sker.

**`users/{uid}`** har blandt andet `forlobIds` (alle forløb hun nogensinde har haft), `activeProduct`, `accessLevel`, `accessSource`, `expiresAt`, `bonusPeriodEndsAt`, `aktivtTraeningsprogram` og `mikrotraeningVariant`.

**`users/{uid}/products/{produkt}` er kundens dataskuffe.** Skuffe-navnet er produkt-nøglen, ikke forløbets id. `kickstart` for Kickstart, `premiumforløb` for Kropsro (se `KROPSRO_PRODUCT_ID` i `types.ts`), og byggede forløb har deres egen nøgle, for eksempel `sommerro_ny` eller `kropsro_aug_26`. I skuffen ligger `forlobId`, `programValg`, `fremgang`, `egneVaner`, `nulDage` og undersamlingen `vanedage`.

**`users/{uid}` har desuden** `maaltider`, `mrs_scores`, `traeningHistorik`, `programFremgang`, `favoritmaaltider`, `customFodevarer` og `linnAiSamtaler`.

**`forlob/{id}`** har `navn`, `startDato`, `antalDage`, `type`, `byggetForlob`, `adgangsNiveau`, `produktNoegle` og `aktiv`, plus undersamlingerne `vaneprogram` (én per dag, dag 0 er baseline) og `forlobsdage` (lektionerne).

---

## 5. Adgangsmodellen

`effektivState(userDoc)` giver `forlobskunde`, `modulbruger` eller `udlobet`. Den ser på `accessLevel`, `accessSource`, `activeSubscription`, `aboSlutterAt` og `expiresAt`.

**`expiresAt` betyder to forskellige ting**, og det er værd at have i baghovedet. For en forløbskunde er det hendes adgangs-slut. For en aktiv abonnent er det næste fornyelse, og den lukker ikke noget. Abonnementer lukkes af `activeSubscription` og `aboSlutterAt`.

**Bibliotek-bonus er 90 dage** efter forløbets slut, gemt i `bonusPeriodEndsAt`. I den periode har kunden stadig FAQ, links, lektioner, træningsøvelser og opskrifter, men ingen moduler. Datoen forlænges men forkortes aldrig.

**Funktioner styres af `harFeatureAdgang(userDoc, matrix, feature)`.** Den slår kundetypen op med `kundetypeFor`, som klassificerer på forløbets **id-præfiks**, altså `kickstart_` eller `kropsro_`, og først derefter på `activeProduct`. Kundetyperne er `kickstart`, `kropsro`, `fleksibelt` og `app`. Er kunden udløbet, giver `kundetypeFor` null, og så har hun ingen funktioner.

Admin kan ændre skemaet under `/app/admin/feature-adgang`. `STANDARD_MATRIX` i `features.ts` bruges hvis skemaet ikke kunne hentes, så adgangen aldrig falder bort ved en hentefejl. Enkelte kunder kan få en funktion før alle andre via `testerFeatures`, se `/app/admin/testere`.

---

## 6. Fælderne

Det her afsnit er det vigtigste i filen. Alle fælder herunder har kostet rigtige kunder rigtig adgang.

### 6.1 Der findes to `forlobSlutMs`

`src/lib/content/forlob.ts` har én med tre argumenter, der tæller kundens nul-dage med. `src/lib/content/forlobAdgang.ts` har én med to, hvor det tredje er frivilligt. De hedder det samme og importeres fra hver sin fil.

Tjek altid hvilken du har fat i. Regner du på **kontoens adgang**, skal nul-dagene med.

### 6.2 Nul-dage forlænger forløbet

Nul-dage er pauser kunden selv sætter på profil-siden. De ligger i hendes dataskuffe som `nulDage.intervaller`, og de tæller ikke som forløbsdage. Et 84-dages forløb med 16 pausedage slutter altså 100 dage efter start.

Indtil 17. august regnede kontoens adgang uden dem. Tolv kunder på Kropsro 24. maj mistede alt en morgen, med op til 21 dages forløb tilbage, og ti af dem fik samtidig slettet deres træningsprogram af login-tjekket. Rettet, se afsnit 7.

Skal du afgøre om et forløb kører, så send kundens uid med til `hentAktivtForlob(ids, now, uid)` og `hentAktivProduktType(ids, uid)`. Uden uid regner de uden pauser.

Det er ikke kun kontoens adgang der går galt uden uid. Den 18. august viste det sig at tre træningssider var blevet glemt i den runde. De regnede kunden over på Kickstart-skuffen, dag-beregningen landede på dag 2, og fordi dag-vælgeren kun viser op til dagens dag, kunne ti kunder hverken se eller starte deres træning. Der kom ingen fejlbesked, så det lignede at træningen var væk. Rettet, se afsnit 7.

**Tjek altid alle kaldesteder når en funktion får uid med.** `grep` efter `hentAktivProduktType(` og `hentAktivtForlob(` og se efter dem der mangler det andet argument.

### 6.3 Dataskuffen skifter under kunden når forløbet regnes som slut

`hentAktivProduktType` falder tilbage til Kickstart-skuffen når intet forløb er aktivt. For en Kropsro-kunde betyder det at små skridt og mikrotræning pludselig viser hendes gamle Kickstart-dage. **Det er stadig ikke rettet.** Det er kendt og bevidst ladt ligge, fordi udløbne kunder normalt ingen adgang har til modulerne. Rører du adgangs-logikken, så tjek at du ikke kommer til at åbne den dør.

### 6.4 `forlobIds` indeholder også udløbne forløb

Brug **aldrig** `forlobIds.some(id => id.startsWith(...))` til at afgøre kadence, status eller kundetype. Et udløbet `kickstart_`-id der hang ved gav i juni 38 kunder forkert kadence. Brug det forløb der er aktivt i dag, altså `hentAktivtForlob`.

### 6.5 Premium-Kickstart hedder også `premiumforløb`

En Kickstart-kunde med premium har `activeProduct = 'premiumforløb'`, præcis som en Kropsro-kunde. Klassificér derfor på forløbets id-præfiks, ikke på produktnavnet.

### 6.6 Kunden står på holdet før hun har forløbet på sin konto

`allowedEmails` opdateres når hun købes ind på et hold, men `forlobIds` på hendes eget dokument opdateres først næste gang hun åbner appen. Har hun ikke været inde siden holdstart, ser hun sit gamle forløb eller en udløbs-side, selvom alt er korrekt sat op. Det retter sig selv ved første login.

### 6.7 Auth-tidsstemplet lyver

`lastSignInTime` fra Firebase Auth er ikke til at stole på for PWA-kunder. Vil du vide om nogen bruger appen, så se på data hun selv har skabt, altså måltider, vanedage, symptomcheck eller træning. `userDoc.updatedAt` er også et brugbart spor.

### 6.8 Skuffens `forlobId` overskrives ved holdskifte

Flytter en kunde fra ét hold til et andet med samme produkt-nøgle, peger den gamle skuffe bagefter på det nye forløb, selvom dagene i den stammer fra det gamle. Feltet kan altså ikke bruges til at se hvilke dage der hørte til hvilket hold.

### 6.9 Et lag der skal dække skærmen skal flyttes ud i `document.body`

Ligger det inde i det område der ruller, **tegner bundmenuen sig oven på det på
iPhone**, selv om laget har højere z-index. Chrome på en computer viser det
rigtigt, så fejlen er usynlig i din egen test.

Info-arket lå sådan 29. august 2026, og Luk-knappen lå bag menu-ikonerne.
**Fundet først da Linn sendte skærmbilleder fra telefonen.** Kopiér mønstret fra
et af de ark der allerede gør det rigtigt. Har arket rullende tekst, skal
rulle-området have lov at krympe, ellers skubbes Luk-knappen ud under
skærmkanten.

### 6.10 Et tal der vises fire steder skal rettes fire steder

Da Kickstarts uge-mål blev indført, sad mærkerne pr dag rigtigt med det samme,
mens **kortets overskrift stadig sagde 90 g og y-aksen stadig gik til 90**, så
søjlerne var ulæselige. Tallene var grønne i testene og typetjekket var rent.

Fejlen blev fundet ved at åbne siden som en rigtig kunde. **Ændrer du et mål,
en grænse eller en enhed, så find alle de steder tallet vises, ikke kun det der
regner det ud.** Overskrift, akse, mærker og forklarende tekst er fire
forskellige steder.

### 6.11 Spørg altid om BÅDE aktive og afsluttede forløb

`forlobIds` er **ikke** en komplet historik. Et afsluttet forløb flyttes til
`afsluttedeForlobIds`, og læser du kun det første felt, forsvinder kundens
gennemførte materiale. Det ramte 29 maj-kunder i biblioteket 27. august, og den
samme fejl fandtes i 3.0.

Alle steder der spørger "hvilke forløb har kunden været på" skal bruge begge
felter. Se også 6.4, som er den samme fælde set fra den anden side.

### 6.12 Et hold-flueben er en manuel handling der skal huskes

Nye Simplero-køb lander på det hold der har fluebenet "Aktivt forløb". **Linn
skal flytte fluebenet når hun åbner et nyt hold.** Sker det ikke, lander de nye
kunder på det forrige hold, og der kommer ingen fejl. Det opdages først når en
kunde skriver.

Samme slags fælde som de manglende tildelinger i 3.0: den gør ingen larm, den
gør bare ingenting.

---

## 7. Rettet i august 2026

### Rettet 17. og 18. august 2026

Tre akutte rettelser, alle under ventilen i regel 2, alle udrullet.

**Symptomchecken måler nu på Kropsro-forløbets egne datoer.** Commit `caeadd4`. Målepunkterne er startdagen og hver 28. dag, for KropsRo 16. aug altså 16/8, 13/9, 11/10 og 8/11, så hele holdet udfylder samme dag. Kickstart, abonnenter og byggede forløb er uændrede og kører videre på kundens eget ur. Fejlen var at fem kunder startede et 84-dages forløb uden startmåling, fordi 28-dages-uret fra deres forrige forløb stadig løb. Se `kropsroMaalepunkter` i `src/lib/content/mrs.ts`.

**Nul-dage tælles nu med i kontoens adgang.** Commits `adc647e`, `f691f7b` og `b1d0e61`. `forlobSlutMs` og `bibliotekBonusSlutMs` fik et frivilligt tredje argument, `hentNulDagePrForlob(uid)` slår kundens pauser op med mellemlager, login-tjekket bruger dem to steder, og ti sider sender kundens uid med. 883 af 895 dataskuffer i basen har ingen pauser og er dermed helt uberørte.

Sussi og Ann-Brigitt fik deres slettede træningsprogram skrevet tilbage manuelt bagefter.

**De sidste tre træningssider sender nu også kundens uid med.** Commit `6dcdac3`. Runden dagen før ramte ti sider, men tre blev glemt: programsiden `traening/program/[forlobId]/[programId]`, som er den forsidens Træning-knap peger på, afspilleren `traening/mikrotraening/[dag]/spil` og valgsiden `traening/mikrotraening/onboarding`. Ti kunder på Kropsro 24. maj fik dag 2 i stedet for deres rigtige dag mellem 65 og 81, og fremgang blev gemt i Kickstart-skuffen. Verificeret mod live før og efter. Ingen øvrige kunder ændrede sig. Linn valgte ikke at give de ti besked.

---

### Rettet 23. og 24. august 2026

Tre rettelser, alle under ventilen i regel 2, alle udrullet. De kom ud af en gennemgang af hele mad-modulet mod rigtige kundedata.

**Forsiden har nu ét dag-nummer i forhåndsvisningen.** Commit `5a7996d`. Forsiden havde to opfattelser af hvilken dag den viste. Lektioner og små skridt fulgte den dag kunden havde valgt i datostrimlen, mens challengen fulgte forhåndsvisnings-dagen. De to faldt kun sammen når `previewDag` allerede stod i adressen, så admin kunne se mandagens lektioner sammen med søndagens challenge. Et billede ingen kunde nogensinde ser.

Krydset der lukkede forhåndsvisningen ryddede kun det ene af de to tal, så det andet blev stående i adressen og trak forsiden skæv bagefter. Det er også rettet. Samme runde lukkede et hul hvor et fremtidigt dag-nummer i adressen kunne åbne lektioner der endnu ikke var frigivet. Berørte 20 kunder med aktivt forløb.

**Et enhedsskift overskriver ikke længere kundens egen mængde.** Commit `cf614a0`. `opdaterEnhed` justerede altid portionstallet når enheden skiftede type, fra gram til en navngiven enhed blev det 1, den anden vej blev det 100. Også når kunden lige selv havde tastet et tal. Mængdefeltet står til venstre for enheds-vælgeren, så den naturlige rækkefølge er at taste tallet først og rette enheden bagefter. Skrev hun 80 og skiftede til gram, blev hendes 80 lydløst til 100.

Reglen ligger nu i `portionVedEnhedsskift` i `content/kost.ts` og justerer kun når tallet stadig er den standard appen selv satte. Otte tests låser begge sider.

Anledningen var en kunde der meldte at den valgte mængde ikke blev gemt. **Det blev aldrig bekræftet at det var hendes problem**, og fingeraftrykket i data er svagt: varer med egen enhed gemt i gram lander på præcis 100 i 13,6 procent af tilfældene, mod 27,8 procent i kontrolgruppen hvor 100 blot er standarden. De fleste opdager altså det forkerte tal og retter det. Rettelsen blev lavet fordi appen ikke bør overskrive et tal kunden selv har skrevet.

**Fiber tæller med i kalorie-tjekket.** Commit `c6ce582`. Plausibilitets-tjekket på næringstal fra Open Food Facts så slet ikke på fiber, og fiber blev ikke engang sendt med fra de to kaldesteder. Konsekvensen var den modsatte af hvad man skulle tro: kalorie-krydstjekket regner Atwater af protein, kulhydrat og fedt, og uden fiber landede rene fiberprodukter helt ved siden af. Husk har 87 gram fiber, næsten intet andet, og 200 kalorier på pakken, men regnestykket gav 10. Hver gang en kunde scannede Husk eller loppefrøskaller, sagde appen at tallene så forkerte ud.

Fiber tæller nu med til 2 kalorier pr gram. Om fiber allerede er talt med i kulhydrat afhænger af hvilket land deklarationen kommer fra, så appen regner begge veje og godtager tallet hvis det er rimeligt efter mindst én af dem. Ændringen tilføjer ingen nye advarsler, den fjerner kun falske.

---

### Rettet 27. august til 31. august 2026

**39 ændringer.** Anledningen til de fleste af dem er den samme: et stort
Kickstart-hold kom ind, og 307 splinternye kunder mødte appen for første gang.
Alt det der før kun ramte nogle få, ramte pludselig mange på én gang.

De er grupperet efter emne, ikke efter dato, for det er sådan man leder efter
dem bagefter.

#### Det første møde med appen

**Loginskærmen er to trin.** Commit `b10cef8`. Kunden skriver kun sin email, og
et serveropslag afgør hvad skærm to viser: "Vi fandt dit køb" med forløbsnavnet
og valg af adgangskode, "Velkommen tilbage" med login, eller "Vi kan ikke finde
et køb". Velkomstskærmen med Log ind og Opret konto er væk.

Grunden er at **en ny kunde kommer direkte fra betalingen og ikke har en konto
endnu**, men "Log ind" stod som det primære valg. Hun ramte den, fik at vide at
kontoen ikke fandtes, og var strandet før hun var inde.

**Købslisten kan kun læses af en der ALLEREDE er logget ind.** Derfor ligger
opslaget på serveren, og det kan ikke laves om til et kald fra browseren.
Opslaget kan i sagens natur røbe om en email er kunde, så der vises aldrig et
navn på "Velkommen tilbage", og der er 30 opslag pr IP pr time. `4ef7714`
rettede at skærmen ikke kunne stå på en lille iPhone uden at scrolle.

**Ny kunde bliver bedt om at lægge appen på hjemmeskærmen.** Commits `22a54f7`
og `a92861b`. Skærmen står alene, før forsiden bygges, så kettlebell-
spørgsmålet ikke lander oveni. Ét spørgsmål ad gangen, samme model som 3.0.

**Grænsen for "ny kunde" er en DATO og ikke et felt på hver kunde.** Valgt for
ikke at skrive til alle kundedokumenter for en skærm de aldrig skal se. Kunder
oprettet før grænsen ser den aldrig. Den springes også over for admin, på
computer, og når appen allerede ligger på hjemmeskærmen, så **Linn kan ALDRIG
se den på sin egen konto**, kun via en testbruger oprettet efter grænsen. Det
kostede en fejlsøgning. iPhone får desuden besked om at det skal gå gennem
Safari.

**Intro i opstarten og en info-knap på hver side.** Commit `70c4984`. Fire
skærme ved første login, efter de tre spørgsmål om hjemmeskærm, kettlebell og
Facebook. Ingen "spring over", Linns valg. Vises kun for kunder oprettet efter
samme dato-grænse.

Illustrationerne er **tegnet af appens egne dele og ikke skærmbilleder**, netop
for at de ikke kan blive forældede. Skift dem ikke til fotografier uden grund.

Info-knappen er et lille i samme sted på ti sider. **Den vigtigste regel her:
176 kunder har KUN et abonnement og intet forløb.** En linje om "dit forløb" er
for dem ikke bare overflødig, den er forvirrende, fordi hun leder efter noget
der ikke findes på hendes skærm. Info-arket kostede tre efterrettelser,
`abec874`, `06ee47e` og `d43ea5e`, se den nye fælde 6.9.

#### Opstarten, som var den største enkelte sag

**Appen satte sig fast ved første login efter en frisk installation.** Commit
`50b66d5`. Målt 29. august: efter at have ryddet alt lokalt, altså det samme
som at slette appen fra telefonen, stod appen og "hentede data" i **over 110
sekunder og blev aldrig færdig**. Auth svarede på 200 ms, og derefter blev der
sendt **nul** kald til Firestore. Ikke langsomme kald. Ingen kald.

Årsagen var den delte lokale kopi. Delingen mellem faner kræver at fanerne
bliver enige om hvem der har styringen, og **den forhandling kan sætte sig fast
første gang lageret bygges op forfra.** Der var ingen tidsgrænse noget sted, så
appen ventede i det uendelige. Efter skiftet: 28 til 32 kald, og appen åbner på
cirka 8 sekunder.

**Filen deles af BÅDE apper.** En ændring der rammer alle kunder og kræver
Linns go.

**Vagten blev bygget og slukket igen samme uge.** Commits `6fb46f4` og
`11b7acf`. Idéen var at appen efter otte sekunder skulle se efter om der
overhovedet var sendt kald, og rydde den lokale kopi hvis der ikke var. Linn så
"Det tager længere end normalt" tre gange i træk kort efter udrulningen, og den
er destruktiv, så den blev slukket med det samme. **Den er ikke tændt igen, og
den skal ikke tændes uden at nogen først har forstået hvorfor målingen så
anderledes ud på hendes telefon end på en computer.**

**Fire ting mere gjorde opstarten hurtigere**, alle udrullet:

- `deaf100` Appen ventede på at hente alle sine filer, cirka 6 MB på over
  hundrede filer, mens kunden så på "Et øjeblik", og de kæmpede med appens egne
  kald om den samme forbindelse. Nu hentes de i baggrunden ti sekunder efter
  åbning. **Prisen er at en kunde der installerer appen og med det samme går i
  flytilstand ikke har alt med.** Bevidst byttehandel
- `7cc3b8c` Adgangs-tjekket kørte **tre gange ved hver eneste app-start for
  alle kunder**, fordi det første billede fra databasen leveres to gange, først
  fra den lokale kopi og så fra serveren. To af de tre var rent spild
- `30839cb` Seks ture til serveren lå i kø, og tre af dem afhænger ikke af
  hinanden. De henter nu samtidig
- `8bc0e2e` Træningsvideoer hentes ikke længere under opstarten

**Opstarten prøver igen når adgangen ikke kan hentes.** Commit `2053ab0`. En
kunde oprettede sig 30. august, kaldet der henter hendes adgang fejlede, fejlen
blev logget, og **hun blev lukket ind UDEN adgang**. Skærmen sagde "Vi kan ikke
finde dit køb" og bad hende tjekke sin email. Hun kom ikke igen. Én ud af 168
nye kunder den dag. Der er nu tre forsøg med stigende pause, under to sekunder
i alt.

#### Kickstart: startdagen og ugens mål

**Træningen starter dag 3, ikke dag 1.** Commit `fe9c2ba`. Forløb har feltet
`traeningStartDag`. Kickstart August står på 3, alle andre har det slet ikke
sat. Dag 3 giver træning 1 og dag 4 giver træning 2, altså **programmet rykker
med** i stedet for at springe de to første træninger over. De to første dage
handler om mad og små skridt.

**Afgjort, og det skal ikke tages op igen:** på et 21-dages Kickstart når
kunden kun til træning 19. Linn har hørt det og sagt glem det den 30. august.
Nævn det ikke igen.

Spærringen kostede fire commits, `4cb8a55`, `aaae46a`, `7487fce` og `9ad86e1`,
fordi den kun sad to steder og Kickstart-kunderne går ad en tredje vej der var
**helt åben**. Afprøvet på dag 0, hvor begge programmer lå fremme med Start
træning. Regnestykket og spærringen ligger nu ét sted.

**Målene følger ugens måltids-fokus.** Commits `2a617e1` og `9aff3e1`. Kickstart
August har fokus pr uge: uge 1 kun morgenmad, uge 2 morgenmad og frokost, uge 3
alle tre. Målene følger med, altså 30 og 10, så 60 og 20, så de normale 90 og
30.

Grunden er at **kunden blev målt på hele dagens 90 g fra dag ét, også i den uge
hvor hun kun måtte logge morgenmad.** Søjlen kunne aldrig fyldes, og en god
første uge så ud som et nederlag.

**Regnestykket ligger ÉT sted**, og det er hendes eget dagsmål delt med de tre
hovedmåltider gange antallet i fokus. Derfor rammer uge 3 hendes eget mål af sig
selv, også hvis hun har ændret det på profilen. **Skriv aldrig 30 eller 10 ind
et sted.** `9aff3e1` var efterrettelsen: mærkerne pr dag på udviklings-siden sad
rigtigt, mens kortets overskrift stadig sagde 90 g og y-aksen gik til 90, så
søjlerne var ulæselige. Se den nye fælde 6.10.

#### Adgang, hold og køb

**Gennemførte forløb er tilbage i biblioteket.** Commit `d082467`. 29
maj-kunder mistede deres Kickstart-fane, fordi holdet blev flyttet fra
`forlobIds` til `afsluttedeForlobIds` af symptomcheck-rettelsen. Biblioteket
læste kun det første felt, så materialet forsvandt selv om de betaler.

**Reglen:** kunder skal ALTID kunne se deres gennemførte forløb så længe de
enten abonnerer eller er i gang med et nyt. Bonusperioden på 90 dage er kun
redningsnettet for dem der hverken har abo eller forløb, og **den må aldrig være
det der afgør om en betalende kunde kan se sit gamle materiale.** Samme fejl
fandtes i 3.0 og blev rettet samme dag, se `HANDOVER-3.0.md` 9.59. Se den nye
fælde 6.11.

**Nye Simplero-køb kan lande på holdet af sig selv.** Commit `ee661f7`. Linn
sælger hvert nyt Kickstart-hold under SAMME produkt i Simplero, så koblingen
kan ikke stå i koden: den ville pege på et forkert hold ved næste holdstart.
Nummeret står nu på selve holdet, og **fluebenet "Aktivt forløb" afgør hvem der
tager imod.** Linn flytter fluebenet når hun åbner et nyt hold. Det er en
manuel handling der skal huskes, ellers lander de nye køb det forkerte sted.

**Forløbets begrænsninger gælder ikke app-kunder.** Commit `4796c37`. Ved
importen 30. august blev hele købshistorikken for Kickstart lagt på
august-holdet: **869 rækker, hvoraf kun 236 faktisk havde købt det hold.**
Blandt de 633 andre var 173 kunder med et løbende abonnement. De kunne
pludselig kun logge morgenmad, og træningen var spærret til dag 3. En af dem
skrev til Linn. Begrænsningerne gælder nu kun det nuværende hold.

**Det er den dyreste fejl i ugen, og den kom af en import og ikke af kode.**
Måler du på et hold, så tjek altid hvor mange af rækkerne der faktisk hører til
holdet.

#### Facebook, Beskeder og mad

**Facebook-gruppen er et blødt tilbud.** Commits `f60ec0a` og `d7913c2`. Hvert
forløb har sin EGEN gruppe, og linket ligger på holdet. **Linket er selv
kontakten:** er feltet tomt, spørger appen slet ikke om Facebook på det hold, så
et hold kan aldrig sende kunderne til den forkerte gruppe.

**Tonen er et tilbud og ikke et krav**, for der findes kunder der slet ikke er
på Facebook. Der er tre svar i samme størrelse: ja, tag mig til gruppen, og "jeg
er ikke på Facebook". **Den sidste skal blive ved med at være en rigtig knap på
linje med de andre**, ikke en lille lænke nederst. Ingen af de tre spørger igen.

**Ny tekst på Beskeder.** Commit `0db0367`. Den gamle lovede at Linn læser alle
spørgsmål, men sagde ikke hvor svarene lander. Nu står der at hun samler
spørgsmålene og svarer samlet, at svarene findes på forsiden, at alt deles
anonymt, og **at man derfor ikke skal forvente et personligt svar.**
App-hjælpen lovede stadig personligt svar inden for et par dage og er rettet
med.

**Mærkatet Mejerifri på opskrifter.** Commit `3f60c2a`. Opfører sig som
Glutenfri. Ordet er Linns valg, for "mælkefri" kan læses som om det kun handler
om mælken i kartonen. Madplan-forslagene har fået et tilsvarende flueben, både i
kandidat-listen og i selve prompten, **for uden det kunne AI'en foreslå en
madplan fuld af ost til en kunde der ikke tåler det.**

**Admin kan rette makro i felter i stedet for i fritekst.** Commit `7cb37f4`.
Opskrifternes næringstal står som én linje tekst nederst i fremgangsmåden, og
admin kunne kun rette dem ved at ramme formatet præcist. **Ét forkert tegn, og
kunden ser en tankestreg.** Felterne skriver stadig den samme linje, så der er
kun ÉN kilde til tallene, ingen migrering, og de to apper kan ikke komme i
utakt. Se `HANDOVER-3.0.md` afsnit 7 om hvorfor den linje aldrig må slettes.

#### AI-svarudkastene, ombygget i fire etaper 30. august

Commits `6df056b`, `011ca8e`, `d341dfb` og `b27f910`. Udkastet bygger nu på
fire lag i stedet for ét:

1. **Kundens egen historik.** Op til 15 af hendes EGNE besvarede spørgsmål på
   tværs af alle forløb, med dato. Prompt-reglerne siger: gentag ikke et helt
   svar hun allerede har fået, og modsig aldrig et tidligere svar til samme
   kunde
2. **Relevans-udvalg i HELE arkivet.** Nyt rent modul med dansk stopordsliste,
   grov stamming, og spørgsmåls-feltet vejer dobbelt. **Den relative grænse på
   45 procent af topscoren er nødvendig:** uden den fyldte udvalget altid op til
   loftet. Giver typisk 6 til 21 eksempler
3. **Forløbs-laget.** De 30 nyeste fra kundens eget hold, urørt, så kunde-chatten
   opfører sig præcis som hidtil
4. **Hele videnbasen.** Loftet på 10 dokumenter er fjernet

**Admin kan folde ud og se præcis hvad et udkast bygger på.** Foldet som
standard.

**Målt 30. august:** 374 besvarede spørgsmål, 87 ubesvarede, 154 kunder har
spurgt, 83 af dem to gange eller mere, men **kun 5 på tværs af forløb.** Hele
arkivet fylder cirka 70.000 tokens.

**Destilleringen køres stadig i hånden**, og der er nu en påmindelse på
admin-forsiden efter syv dage, commit `ec6cb79`. Den ugentlige planlægger er en
åben tråd, se afsnit 9.

---

### Rettet 1. september 2026

**Fire ting, alle sammen i ADMIN.** Ingen kundeflade er rørt, og ingen kunde
kan se forskel på noget af det. Læs også 9.61 i `HANDOVER-3.0.md`, for dagens
femte ting ligger dér og hænger sammen med den fjerde her.

**Admin kan filtrere opskrifter på madtype.** Listen var 133 rækker i én
alfabetisk liste uden søgning. Der er nu et søgefelt, fire knapper med
madtyperne, og en linje der siger hvor mange der vises.

Filtreringen genbruger `filtrerOpskrifter` fra `content/opskrifter`, altså
præcis den samme regel som kunden møder under 30-30-3. To steder der filtrerer
hver sin vej ville betyde at admin viste noget andet end kunden.

**Bemærk at der kun er FIRE madtyper i den gamle app.** Snack, salat og dessert
foldes sammen til Andet i `normaliserKategorier`. Snack er først sin egen
kategori i 3.0, se 9.5 i 3.0-overdragelsen. Linn er gjort opmærksom på det og
har valgt de fire. Fordelingen målt 1. september: morgenmad 24, frokost 51,
aftensmad 46, andet 23, **og 3 uden madtype**. De tre er de tomme kladder der
hedder "Ny opskrift", og de forsvinder så snart der trykkes på en madtype.

**Admin kan godkende en opskrift.** Linns eget flueben på at hun har set den
igennem. Nyt valgfrit felt `godkendt` plus `godkendtAt` på `Opskrift`,
additivt, så gamle dokumenter uden feltet læses som ikke-godkendt og ikke som
afvist. En knap pr række i listen, grøn kant i venstre side på de godkendte, et
filter der hedder "Mangler godkendelse", og en knap inde i opskriften.

**DET MÅ ALDRIG BLIVE EN PORT FOR HVAD KUNDEN SER.** Det er `aktiv` der styrer
synlighed, og de to skal blive ved med at være to ting. Der står en note om det
på feltet og en linje om det på skærmen.

`saetOpskriftGodkendt` skriver KUN de to felter med merge og ikke hele
dokumentet, fordi fluebenet sættes fra listen hvor der ikke ligger et redigeret
udkast. `gemOpskrift` skriver også med merge og rører ikke feltet, så
godkendelsen overlever en redigering.

**Næringstal pr ingrediens inde i en opskrift.** Ud for hver ingrediens står
nu hvilken madvare den er koblet til, hvor mange gram linjen er, og hvad den
bidrager med. Det regnes på de felter der står på skærmen, så tallene følger
med når mængden ændres.

**Regnestykket er 3.0's regnemaskine**, altså `opskriftMakro3` og
`opskriftPortion3`. Rene funktioner der kun læser, og den samme motor som
`/ny/admin/opskrift-makro` bruger, så de to sider aldrig kan sige forskellige
ting om den samme ret. **Der skrives ingenting**: makro-felterne er Linns, og
hendes regel er at intet regnes om automatisk.

Fire ting der er dyre at genopdage:

- **Fødevarerne hentes med den gamle apps egen `hentAlleFodevarer`**, så siden
  ikke får sin egen kopi af 2.268 rækker ved siden af den appen har i forvejen
- **Hentningen ligger EFTER opskriften og blokerer ikke redigeringen.** Går den
  galt, står der en linje om det og resten af siden virker
- **En linje der ikke kan regnes skriver hvorfor med ord.** Aldrig et stille
  nul. Det er fejlen hvor en ret ser ud til at have mindre protein end den har
- **Summen står både for hele retten og pr portion**, og kun når listen er
  skrevet til flere. Makro-felterne er PR PORTION, så det er dem der
  sammenlignes. Det er præcis den fejl der tidligere lå tre steder i to apper,
  se 9.9 i 3.0-overdragelsen

**Vej fra admin-forsiden til Ingrediensernes tal.** Nyt menupunkt under Delt
indhold der peger på `/ny/admin/ingrediens-tal`, altså en side der ligger i
3.0. **Der er kun ÉN side**, og den nås fra begge admin-forsider. To kopier
ville før eller siden sige forskellige ting om det samme tal. Linn er admin, så
hun kommer ind på `/ny` uden videre.

#### DET DER RAMMER KUNDERNE, og det ligger i 3.0

Fra den side kan Linn rette en fødevares næringstal, og **rettelsen skrives på
selve fødevaren**. Begge apper læser den samme samling, så et rettet tal gælder
også de 925 kunder her, næste gang de taster varen ind.

Det er en bevidst beslutning fra Linn 1. september: der findes ét sæt tal, og
det er vores. Hele gennemgangen står i 9.61 i `HANDOVER-3.0.md`, og den skal
læses før nogen rører fødevarernes tal.

**Kundernes gamle registreringer er urørte.** Hvert måltid fryser sine egne tal
ved gemning. **Og kunden ser ingen forskel på skærmen**, hun ser kun tallet.
Sikkerhedskopi af alle 2.268 fødevarer ligger i `backup/`.

**Rører du en fødevares tal, så husk at opskrifterne skal regnes om samme dag.**
Det er indbygget i admin-siden, men gør du det med et script, står reglen i
9.50 i 3.0-overdragelsen.

#### LINN AI KENDER NU KUNDENS FORLØB, også her

**Den femte ting, og den eneste der rører kundefladen.** `/api/linn-ai` fik
samme dag det samme som 3.0's AI: forløbets navn, dagnummer med pause trukket
fra, dagens dato, FAQ'en fra kundens eget forløb, og lektionerne **til og med i
dag**. Dertil hendes egen historik, altså hvad hun selv har spurgt om før og
hvad Linn svarede.

Anledningen var at en testkunde spurgte hvornår der er Q&A. Svaret stod ordret
i hendes FAQ, men AI'en havde aldrig fået den at vide. Hele gennemgangen står i
9.61 i `HANDOVER-3.0.md`, og den skal læses før nogen rører det her.

**Hentningen er DELT med 3.0**, se `lib/server/forlobViden.ts`. To steder der
udleder dagnummeret eller finder FAQ'en ville drive fra hinanden, og så ville
de to apper svare forskelligt på det samme spørgsmål. **Ret det ét sted, og du
retter begge apper. Det er meningen.**

**BEGGE HENTNINGER FEJLER NEDAD.** Går noget galt, svarer AI'en præcis som den
gjorde før 1. september, og kunden ser ingen fejl. Et dårligere svar er
uendeligt meget bedre end intet svar, når der er 925 kunder i drift.

Tre regler der følger med, og som ikke må laves om uden at spørge:

- **AI'en må aldrig finde på et tidspunkt.** Står det ikke ordret i FAQ'en, skal
  den sige det og tilbyde at sende spørgsmålet videre. En kunde der møder op på
  det forkerte klokkeslæt er værre end intet svar
- **Fremtidige dage er ikke med**, og de fjernes i DATA og ikke med en
  instruktion. En instruktion kan overses, en tom liste kan ikke
- **"Vi ved det ikke" er ikke det samme som "hun har intet forløb".** Fejler
  opslaget, siger vi ingenting om forløbet i stedet for at påstå at hun er
  almindeligt medlem

**Bemærk forskellen på de to apper:** den her app har hele tiden brugt Linns
tidligere svar, så sikkerheds-procenten har målt på det rigtige. Det gjaldt
IKKE 3.0 før 1. september.

---

### Rettet 1. september 2026, sent på dagen

**Fire ting mere, og de tre af dem RAMMER KUNDERNE.** Alt sammen efter
Linns ønske samme dag.

#### 1. Kunden kan skrive en opskrift selv

Før kunne hun kun lægge en opskrift ind ved at **fotografere** den. Havde
hun den på papir eller i hovedet, kunne hun ikke. Siden hed ligefrem
"Tilføj fra billede".

**Skemaet fandtes allerede.** Efter AI'en havde læst et billede, landede
hun på en skærm hvor hun kunne rette alt. Der var bare ingen dør ind til
den. Samme slags hul som scanneren havde 26. august, hvor knappen fandtes
men skemaet aldrig blev koblet på.

Linns fire svar, som ligger fast:

- **ALLE kunder kan nu både skrive og fotografere.** Låsen er fjernet både
  på siden og i `/api/analyser-opskrift`. **Det koster penge:** hvert
  billede er et kald til modellen, og det er nu åbent for alle 925 i
  stedet for de få. Den daglige pulje på 20 pr kunde er tilbage, og skal
  det lukkes til igen, findes nøglen `ai-opskrift` stadig i
  featureAdgang-skemaet
- **Protein og fiber er tvungne.** OPHÆVET DAGEN EFTER, se punkt 1 under
  "Rettet 2. og 3. september". Reglen spærrede for enhver ret uden fiber.
  En opskrift uden dem lægger NUL i
  hendes dag hver gang hun bruger den, og det ser rigtigt ud. I et modul
  der hedder 30-30 er det den værst tænkelige fejl
- **Hun spørges** om appen skal gætte tallene eller om hun selv vil skrive
  dem. Nyt endepunkt `/api/estimer-opskrift`, eget og ikke en gren i
  analyser-opskrift, som læser billeder for 925 kunder i drift
- **Fremgangsmåde.** Nyt valgfrit felt `fremgangsmaade` på `MinOpskrift`.
  Bemærk at en opskrift læst af AI'en heller ikke får den: analysen gemmer
  kun ingredienser og tal

**Billedet er nu valgfrit.** Før gemte siden slet ikke uden et. Uden
billede får retten et bogstav i listen, hvilket den kunne i forvejen.

**Der står et bånd over tallene om at de er PR PORTION.** Skriver hun hele
rettens tal på en ret til fire, bliver hendes dag talt fire gange for højt
hver gang hun bruger opskriften. Samme fejl som lå tre steder i to apper,
se SPEC 26.9.

Knappen under Mine hedder nu **"+ Tilføj en opskrift"** og ikke "+ Tilføj
fra billede", altså det samme som siden den åbner. En knap der hedder
noget andet end den skærm den fører til er den fejl der blev rettet på Din
side 19. august.

#### 2. ARK KUNNE IKKE RULLES PÅ EN TELEFON. Rettet 13 steder

Linn fandt det på arket der lægger en opskrift i dagbogen: hun kunne vælge
portioner og måltidstype, men ikke rulle.

**To fejl oven i hinanden, og begge kendte fra før:**

- **`vh` i stedet for `dvh`.** Mobilbrowsere regner `vh` ud som om
  adresselinjen var væk, så arket på 92vh blev HØJERE end det hun kunne
  se. Arket mente selv at der var plads nok, `overflow-y` slog aldrig til,
  og der var intet at rulle i. Præcis den fejl der blev rettet på alle
  fire ark i 3.0 den 11. august, men **den gamle apps ark stod tilbage**
- **Arket var ikke portaleret ud i body.** Det lå inde i den rullende
  skal, som på iOS fanger `position: fixed`-børn

**Rettet 13 steder**, kun ved at TILFØJE en `dvh`-linje hvert sted. `vh`
bliver stående som reserve. De kundevendte: opskrifter, egne opskrifter,
Dit forløb, Biblioteket, Byg dit eget program, App-hjælpen og
frugt-og-grønt-dialogen. Dertil syv admin-sider.

**Og ét i 3.0:** `.oev-ark` blev sprunget over 11. august og har haft
fejlen siden. Det bruges to steder, se 9.31 punkt 8.

**Se efter `max-height: NNvh` uden en `dvh` ved siden af, hvis et ark
opfører sig underligt.**

#### 3. Linn AI kender kundens forløb

Se afsnittet ovenfor under "Rettet 1. september".

#### 4. ADMIN ER FLYTTET TIL 3.0, og de gamle sider er urørte

**Hele admin er lavet om og ligger nu i den nye app**, 27 skærme i samme
udseende. Se 9.62 i `HANDOVER-3.0.md` for hele gennemgangen.

**Ingen af de 19 gamle admin-sider er rørt.** Der er kun lagt en ramme
udenom i `app/admin/+layout.svelte`, så de sidder i den samme menu som de
nye. Rammens farver står lokalt i filen og kan ikke slippe ud i resten af
den gamle app.

**De fem der rører adgang har deres gamle udgave stående i menuen under
System.** Fjern dem når Linn har brugt de nye i en uge.

**Dashboard og forløbets otte undersider er KOPIERET ordret** til 3.0, med
en farvebro i stilen. Retter du noget i den gamle udgave af dem, sker der
ikke noget i den nye. Det er den pris der blev betalt for ikke at tegne
9.000 linjer tal og tabeller forfra.

---

### Rettet 2. og 3. september 2026

**Hele vejen rundt om kundens egne opskrifter, plus fire regler for hvad
Linn AI ikke må tale om.** Alt sammen efter Linns ønske, alt sammen
udrullet.

#### 1. Protein og fiber er IKKE længere tvungne

**Det her ophæver beslutningen fra dagen før**, se punkt 1 under "Rettet
1. september, sent på dagen". Commit `3a6bfc7`.

Reglen krævede at både protein og fiber var over nul, ellers kunne
opskriften ikke gemmes. **En omelet med ost har nul fiber**, og den kunne
dermed ikke gemmes overhovedet. Det er rigtigt at nul fiber er nul fiber.

Nu spærrer vi kun når **alle fem tal** står på nul, altså når retten reelt
vil tælle nul i hendes dag. Står fiber alene på nul, siger skærmen roligt
at det er helt normalt. Bekymringen bag den gamle regel er den samme og
er stadig gyldig, den er bare løst med en blødere hånd.

#### 2. Opskriften oprettes i tre trin

Commits `3a6bfc7` og `fc68726`. Én lang side blev til tre trin: retten,
indholdet, tallene. En bjælke øverst viser hvor langt hun er.

**Spørgsmålet om appen skal regne næringstallene stod før OVER
ingredienserne**, altså på en skærm hvor der endnu ikke var noget at regne
på. Det står nu efter dem. Kommer opskriften fra et billede, er de to
første trin allerede udfyldt af AI'en, og hun lander direkte på tallene.

Ingredienserne står på to linjer med navnet i fuld bredde. Det blev
nødvendigt da enheden blev en liste: ordet "knivspids" skal kunne stå der,
og så var der ikke plads til navnet på samme linje.

#### 3. Beregningen af næringstal var i stykker på to måder

Commit `eb7981f`. Begge fundet ved at køre rigtige opskrifter mod
tjenesten, ikke ved at læse koden.

**Havde kunden ikke skrevet en mængde, sendte vi "- 0 g Æg".** Modellen
fik dermed at vide at der var nul gram æg, svarede helt korrekt at der
ikke var noget at regne på, og kunden så en app der ikke kunne regne.
Mængden skrives nu kun når den er der, og systemprompten antager så en
almindelig portion. Samme omelet gik fra "ikke nok at regne på" til
rigtige tal.

**Svaret indeholder et regnestykke pr ingrediens**, og loftet på 2048
tokens rakte kun cirka tredive ingredienser. Derover blev svaret afkortet
midtvejs og kunne ikke læses. Loftet er 8192 nu, og 40 ingredienser fylder
2245. Bliver et svar alligevel afkortet, siger tjenesten det i stedet for
at fejle på et halvt svar.

Dertil, commit `2d1f254`: begge skærme skrev "kunne ikke regne på
opskriften" uanset grunden. Nu står serverens egen forklaring med, ellers
fejlkoden. **Uden den kunne hverken kunden eller vi se hvad der skulle
rettes**, og en fejlmelding fra Linn kostede en runde frem og tilbage.

#### 4. Enheden vælges fra en liste, og listen er DELT med 3.0

Commit `7b05eda`. **Her går en ny tråd fra den gamle app ind i en
3.0-fil.** Listen ligger i `content/mineOpskrifter3.ts`, hvor 3.0 allerede
havde den, og den gamle app henter den samme sted fra. Det er bevidst:
ellers ville de to apper drive fra hinanden, og det er kun en læsning, så
regel 2 er overholdt. **Retter du listen, rammer du begge apper.**

Listen er udvidet med fem efter Linns ønske: fed, dåse, håndfuld,
knivspids og bundt. Vælger hun "andet", åbner et skrivefelt hvor hun selv
kan skrive. Det felt står også åbent hvis AI'en har læst en enhed ud af et
billede som ikke er på listen, **så hendes opskrift ikke bliver lavet om
bag om ryggen på hende**.

**Fed og knivspids kendte vægt-tabellen i forvejen. De tre andre gjorde
ikke**, og de faldt ned i styk-grenen og blev gættet som 100 g, altså en
dåse hakkede tomater regnet som en fjerdedel af sig selv. De er lært nu i
`content/enhedsvaegt3.ts`: dåse 400 g, håndfuld 30 g, bundt 25 g, med
test. **Sætter du flere enheder på listen, så lær tabellen dem samtidig.**

#### 5. Fremgangsmåden var usynlig

Commit `a9e37e0`. Feltet kom til 1. september, men kunne **kun skrives ved
oprettelsen**. Bagefter blev det hverken vist eller kunne rettes, så
kundens tekst lå gemt uden vej ind til. Den står nu begge steder. Tom
tekst skrives som tom, så hun også kan slette en fremgangsmåde hun har
fortrudt. Uden det ville en tom værdi blive sprunget over ved gem, og den
gamle tekst blive stående.

Resten af redigerings-siden er bragt på højde med opret-siden: indholdet
før tallene, samme enhedsliste, samme opstilling, tomme mængde-felter, og
en tom mængde skrives ikke længere som "0 g" når hun læser opskriften. Hun
kan nu også bede appen regne tallene ud herinde. **Før fandtes hjælpen kun
ved oprettelsen**, så rettede hun en ingrediens bagefter, stod hun med
regnestykket selv.

Commit `8b29d98`: Linns eget opskrift-værktøj under admin har fået den
samme liste og de samme tomme mængde-felter.

#### 6. Fire faste regler for hvad Linn AI ikke taler om

Commit `470f6c1`. Linns beslutning 3. september. Chatten må ikke tale om
andre forløb end kundens eget, ikke fortælle hvad der er planlagt (på nær
Q&A-tidspunkter fra hendes egen FAQ), ikke nævne premium eller
adgangsniveauer, og ikke nævne en ny app eller kommende versioner.

**REGLERNE STÅR UDEN FOR PERSONA-TEKSTEN**, i `content/linnAi.ts` samme
sted som sikkerheds-markøren. Admin kan skrive persona'en helt om inde i
appen, og lå reglerne der, ville de forsvinde den dag teksten blev rettet,
uden at nogen opdagede det. De gælder derfor i **begge apper**.
**Svar-udkastene til Linn selv er IKKE omfattet**, Linns beslutning samme
dag: dem læser hun alligevel igennem før de sendes.

**Hvorfor de var nødvendige.** Chatten får Linns tidligere svar med som
forbillede, og har kundens eget hold ikke svar nok, hentes der svar fra
ALLE hold for at fylde op, se `hentTidligereSvarMedBackup`. De svar kan
nævne et andet forløb, premium eller noget der var på vej dengang, og der
stod ikke ét ord om at det ikke måtte gå videre.

**Reglerne er afprøvet mod modellen** med et forbillede-svar der med vilje
nævnte Kropsro, premium og en ny app. Første udgave var for løs to steder:
den beskrev det andet forløb da kunden selv nævnte navnet, og den gættede
på hvad kunden kunne se i appen. Begge er skrevet skarpere. **Retter du i
reglerne, så kør den prøve igen**, og husk at spørge om Q&A bagefter: den
viser at reglerne ikke lukkede for meget.

---

### Rettet 3. og 4. september 2026

**Beskeder er lavet om til en chat, og Linn AI har fået tre rettelser der
alle kom af noget Linn opdagede undervejs.** Alt sammen efter hendes ønske,
alt sammen udrullet.

#### 1. BESKEDER STÅR NU SOM EN CHAT, begge faner

Commits `7100576` (Linn AI) og `02605bc` (Skriv til Linn). Skrivefeltet lå
øverst og samtalen voksede nedad, så efter et par spørgsmål lå det nyeste
svar nederst og kunden skulle rulle op igen for at skrive det næste. Linns
ord: "det er lidt bøvlet at scrolle ned hver gang."

Nu fylder samtalen skærmen mellem fanerne og bundmenuen, den ruller for sig
selv, og skrivefeltet ligger fast nederst. `.page` får klassen `chat` når
en af de to faner vises, og det er den der giver siden fast højde. **Uden
`position: relative` på rullefeltet måler rulningen forkert**, fordi den
regner boblens plads ud i forhold til det.

På fanen **Skriv til Linn** er listen "Mine spørgsmål" og kvitteringsboksen
væk. Spørgsmålene står som bobler med ældste øverst, dag-mærke over dagens
beskeder, og "Afventer svar" under et ubesvaret spørgsmål. `hentMineSpoergsmaal`
giver stadig nyeste først, og rækkefølgen vendes **kun i visningen**.
Linns intro tager imod første gang, derefter står den korte linje, og hele
teksten ligger bag i-knappen.

Tegn-tælleren vises først fra 400 af de 500 tegn. Grænsen er uændret.

`content/appHjaelp.ts` er rettet i samme ombæring, commit `af7d30f`, den
beskrev knappen og listen der ikke findes mere.

#### 2. LINN AI SKREV MED STJERNER. To steder, så det holder

Commit `02605bc`. Kunden så `**kombinere**` råt på skærmen. Rettet begge
veje: **regel 5 i `FASTE_REGLER`** siger ren tekst uden markdown, og
`udenFormateringstegn` renser svaret **når det vises**, fordi alle de svar
der allerede er gemt, har tegnene i sig. Gangetegn som `2*3` og
bindestreger røres ikke, der er test på det. Gælder begge apper.

#### 3. BELLWELL, og hvor problemet i virkeligheden lå

Commit `02605bc` lagde **regel 6** ind: ved fiber, forstoppelse og mave
anbefales Bellwell, aldrig loppefrøskaller i stedet, og den er ikke
udsolgt.

**Men kilden siger stadig det modsatte.** Gennemgangen dagen efter fandt
det: `Kickstart-FAQ.pdf (del 8/10)` i videnbasen indeholder ordret
spørgsmålet "Fibertilskuddet, du anbefaler, er udsolgt. Hvad gør jeg?" med
svaret at loppefrøskaller gør samme gavn. Del 3 anbefaler dem også.
AI'en gjorde altså præcis hvad der stod. **Reglen er et sikkerhedsnet,
ikke en løsning.** Se de åbne tråde.

#### 4. KLIPPEDE SVAR, målt før der blev rettet

Commit `75c7537`. Påstanden var at lange svar blev klippet midt i en
sætning. **Målingen viste det modsatte:** ingen af de 105 gemte svar var
klippet, og det længste fyldte under halvdelen af loftet. Måle-scriptet
ligger som `scripts/_diagnose-klippede-svar.ts`, så målingen kan gentages
når der er flere samtaler.

Det der derimod fejlede: **sikkerheds-tallet manglede i 10 af de 105
svar.** Ikke fordi svaret var klippet, men fordi modellen glemmer at sætte
markøren på, især ved korte svar og hilsener. Før forsvandt linjen helt, så
et umålt svar så **mere** sikkert ud end et målt. Nu står den forsigtige
udgave uden procent.

Loftet er hævet fra 1024 til 2048, og `stop_reason` læses nu. Rammer et
svar loftet, klipper `afrundKlippetSvar` tilbage til sidste hele sætning og
skriver at hun blev afbrudt. Der betales kun for den tekst der faktisk
skrives, så det hævede loft koster ikke i sig selv.

---

### Rettet 2. til 4. september 2026: træningsvideoerne og upload-døren

#### 1. ALLE 62 ØVELSESVIDEOER ER PAKKET OM

Kunder meldte om træningsvideo der hakker eller viser en sort skærm i
starten. **50 af de 62 videoer i `exercises/` havde indholdsfortegnelsen
bagerst i filen.** En videofil består af billederne og en fortegnelse over
hvor hvert billede ligger, og telefonen skal bruge fortegnelsen først.
Ligger den bagerst, er telefonen nødt til at hente HELE filen før den kan
vise det allerførste billede. Det er den sorte skærm, og det er hakket i
starten. Det ramte alle kunder lidt, og værst på de store: kettlebell swing
fylder 5,1 MB, single leg deadlift 4,6 MB.

Alle 50 er pakket om og lagt op igen, og hele lageret er gennemgået
bagefter: **alle 62 svarer nu "fortegnelsen forrest".**

**BILLEDERNE ER IKKE RØRT.** Filerne er pakket om, ikke komprimeret om.
Lyd- og billeddata er kontrolleret bit for bit på hver eneste fil før den
blev lagt op. Kvaliteten er præcis den samme.

**TOKENET ER BEVARET PÅ HVER FIL, og det er det vigtigste at vide, hvis du
skal gøre det samme igen.** Adressen kunderne har fået udleveret indeholder
et token. Lægger man filen op uden det, laver Firebase et nyt, og så holder
de udleverede adresser op med at virke, også hos en kunde der står midt i
en træning i det øjeblik. `scripts/_pak-om-video.ts` læser det gamle token
og sætter det på den nye fil.

**Det retter IKKE noget for en kunde der allerede har set øvelsen.**
Adressen er den samme, og filerne har `max-age` på et år, så telefonen kan
have den gamle udgave liggende i op til et år. Hun får rettelsen på det hun
ikke har set før, og på resten når telefonen rydder op. Vil man tvinge det
igennem, skal filerne have nye navne, og så skal hver øvelse i databasen
pege det nye sted hen. Det er fravalgt som for stort et indgreb til
gevinsten.

**Tjek-værktøjet ligger i `scripts/_tjek-video-pakning.ts`.** Det går hele
lageret igennem og siger hvilke filer der er pakket forkert. **Kør det når
der kommer nye videoer**, ellers sniger det sig ind igen. Kørt 4. september
2026: alle 62 filer i `exercises/` er pakket rigtigt.

**Ompaknings-værktøjet findes ikke længere.** `_pak-om-video.ts` og
`_hent-video.ts` blev slettet ved en oprydning 4. september 2026, fordi de
så ud som engangs-scripts. De var aldrig lagt ind i projektet og kan derfor
ikke hentes tilbage. Er der en fil der skal pakkes om igen, skal de skrives
forfra. Det de gjorde: hentede filen ned, og lagde den ompakkede udgave op
igen **med det gamle token bevaret**, se afsnittet ovenfor om hvorfor det er
afgørende. Ompakningen selv er `ffmpeg -c copy -movflags +faststart`.

#### 2. ØVELSESVIDEOERNE HAR SLET INGEN LYD, og det er ikke en fejl

Værd at vide inden man leder efter en lydfejl der ikke findes. **23 af de
24 filer der ligger i projektet har intet lydspor overhovedet**, og under
selve træningen er videoen desuden sat til lydløs med vilje, fordi den
kører i ring bag ved timeren.

Den lyd der findes under en træning er **baggrundsmusikken og
nedtællingen**, som er tre separate filer i `audio/`. Siger en kunde at der
ikke er lyd på træningen, er det dem hun mangler, ikke video-lyd.

#### 3. LÅSEN PÅ UPLOAD-DØREN TIL R2

Commit `dc61326`. Noten øverst i `/api/r2-upload-url` sagde at serveren
tjekkede at kalderen var logget ind og admin. **Det gjorde den ikke.**
Enhver der kendte adressen kunne bede om en upload-adresse og lægge filer i
lageret. Fundet under diagnosen af lydbeskeder til én kunde.

Tokenet hentes nu inde i `uploadLydFil` og ikke på de tre sider der kalder
den, så ingen af siderne skulle røres, og ingen af dem kan glemme det.
Kunderne mærker ingenting: døren bruges kun af admin i forvejen.

---

### Rettet 4. september 2026: favoritter der alle hedder det samme

Under ventilen i regel 2, med Linns go. Commits `6bbdd18` og `d3f894e`.

**Anledningen.** En kunde på Kickstart August skrev at hendes morgenmad ikke
blev gemt tirsdag og onsdag. Diagnosen viste at hun havde ret, men også at
det ikke var mad-modulets skyld: der lå **intet** fra hende de to dage,
heller ikke vanedage eller noter, og hun udfyldte dag 2 og 3 bagud om
torsdagen. Resten af holdet loggede normalt de dage, 386 og 336 måltider.
Altså hendes forbindelse, ikke appen. **Den sag er ikke løst**, se 9-afsnittet.

**Det diagnosen fandt undervejs** var noget andet og reelt: hun havde fire
favoritter der alle hed "Morgenmad", hvoraf tre var den samme ret. Navnet i
gem-modalen foreslås ud fra måltidstypen, så en kunde der sætter flueben i
"Gem også som favorit" hver dag ender med en liste hun ikke kan læse.

**Løsningen.** `src/lib/content/favoritNavn.ts` afgør om navnet er optaget,
uden hensyn til store bogstaver og mellemrum. Er det, viser
`FavoritNavnAdvarsel.svelte` et ark med tre valg: opdater den favorit hun
har, gem en ny under et navn hun selv skriver, eller lad favoritterne være.

**Rækkefølgen er det vigtigste at forstå.** Måltidet skrives i dagbogen
FØR arket vises, og arket åbnes først når gem-modalen er lukket og
dagbog-fanen er valgt, så maden står synligt bagved. Teksten siger det
højt. Lukker hun arket, sker der ingenting med favoritterne. Uden den
sikkerhed ville hun trykke gem igen og lave dubletter, hvilket er præcis
den fejl der er rettet før i det her modul.

**Navnefeltet starter tomt og forudfyldes bevidst ikke med "Morgenmad 2".**
Det ville rydde listen teknisk og efterlade hende med navne hun stadig ikke
kan læse.

**De kunder der allerede har dubletter beholder dem.** Linns beslutning 4.
september. Vi kan ikke gætte hvilken de vil have.

App-hjælpen er opdateret med samme runde. Mad-afsnittet nævnte slet ikke
favorit-måltider før.

---

### Rettet 4. september 2026: appen siger nu fra når den ikke kan komme igennem

Under ventilen i regel 2, med Linns go. Commits `2866d7d` og `6a8678a`.

**LÆS DET HER FØR DU FEJLSØGER "MINE DATA FORSVANDT".** Det er den
mekanisme der kostede en kunde to hele dage, og den er ikke intuitiv.

**Årsagen er ikke en fejl i koden.** Den er indbygget i den måde Firestore
arbejder på. Gemmer kunden noget uden forbindelse, sker der to ting på én
gang:

1. Ændringen skrives i telefonens lokale kopi **med det samme**, så den ser
   gemt ud på skærmen. Læser man tilbage, får man den serveret fra den
   lokale kopi og tror alt er i orden.
2. Selve anmodningen til serveren går i stå og bliver stående. **Den melder
   ALDRIG fejl.** Løftet bliver bare aldrig indfriet, om så det er i dagevis.

Konsekvensen: hvert eneste `try/catch` omkring et gem i hele appen var
uden virkning uden forbindelse, og hver eneste gem-knap blev stående og
arbejdede i det uendelige. Kunden lagde telefonen fra sig i god tro.

#### Delene, og hvor de ligger

- **`src/lib/state/forbindelseState.svelte.ts`** er den eneste sandhed om
  forbindelsen. Ingen side må selv gætte. Den står på to ben: browserens
  `online`/`offline`-hændelser, som er hurtige men lyver på et hotelnet der
  ikke slipper noget igennem, og **Firestores eget `fromCache`-flag**, som
  er det pålidelige. Sidstnævnte kommer fra `lytTilForbindelse` i
  `src/lib/firestore/forbindelse.ts`, som lytter på kundens eget dokument
  med `includeMetadataChanges`. Begge sættes fra `app/+layout.svelte`.
- **`ForbindelseBaand.svelte`** ligger i `app/+layout.svelte` og virker
  derfor på **alle** sider på én gang. Rødt bånd mens forbindelsen er væk,
  grøn kvittering når alt er nået frem. **Båndet kan ikke lukkes.** Linns
  beslutning: et bånd hun kan klikke væk, klikker hun væk.
- **`src/lib/content/gemVentetid.ts`** holder op med at VENTE efter otte
  sekunder. Den giver ikke op på skrivningen, som stadig ligger i kø.
- **`meldSkrivningIGang()`** kaldes før hvert gem. Den bruger Firestores
  `waitForPendingWrites` til at vide hvornår ALT er kvitteret, og det er
  dét der udløser den grønne kvittering.
- **Mærket "Venter på at blive sendt"** kommer fra `hasPendingWrites` på
  det enkelte dokument, sat ved læsning i `hentMaaltiderForDato` og
  `hentMineSpoergsmaal`. Feltet hedder `ikkeSendt` og **gemmes aldrig i
  databasen**.

#### To ting du ikke må lave om

**Der må ALDRIG stå "Prøv igen" på de her beskeder.** Skrivningen ligger
allerede i kø. Trykker kunden gem en gang til, lægger hun nummer to i kø,
og når forbindelsen kommer tilbage får hun to ens måltider eller sender
den samme besked to gange. Det stod på den oprindelige tegning og blev
rettet inden der blev kodet.

**Mærket er ikke pynt.** Uden det ser en indtastning der ikke er nået frem
nøjagtig ud som en der er, og så er hele advarslen ingenting værd. I
Beskeder var det værst: en besked der aldrig blev sendt stod som "Afventer
svar", så kunden gik og ventede på et svar Linn aldrig havde set.

#### Hvad der er gennemgået

Mad, forsidens vaner og bonus, refleksionsdagen for både forløb og
abonnenter, egne små skridt, Beskeder inklusive "send til Linn" fra Linn
AI, og træningen: fremgang på forløb og abonnement, valg af program,
onboarding-valget, samt oprettelse, redigering og sletning af eget program.

**Den værste fælde lå i træningen.** `stopOgForlad` og `startForfra`
ventede på at pausen var gemt FØR de forlod skærmen. Uden forbindelse blev
kunden dermed **fanget på træningsskærmen og kunne ikke komme ud**. De to
har en kortere ventetid på tre sekunder, for der handler det om at slippe
ud, ikke om at få en kvittering.

#### Hvad der MANGLER

Båndet og den grønne kvittering virker overalt. Selve gem-behandlingen
mangler stadig på: symptomchecken, egne opskrifter, at lægge en opskrift i
dagbogen, biblioteket, Linn AI, opsætningen af vaner og profil-siden.
**Mønsteret er det samme hver gang**: `meldSkrivningIGang()`, pak
skrivningen i `gemMedVentetid`, kast videre ved `fejl`, og ved `venter`
enten slip knappen fri eller vis beskeden. Kig i `beskeder/+page.svelte`
for det fulde eksempel med mærke, og i `moduler/traening/+page.svelte` for
den korte udgave uden besked.

---

## 8. Beslutninger der ikke skal genopfindes

To beslutninger truffet 24. august 2026. Begge er den slags der bliver bygget igen om et halvt år hvis de ikke står skrevet ned.

### 8.1 Vi kontrollerer ikke fremmede databasers næringstal

**Linns beslutning.** Kommer der x gram fiber ind fra Open Food Facts, stoler vi på det. Appen skal ikke sætte sig til dommer over andres tal.

Anledningen var en LU-kiks der kom hjem med 52 gram fiber pr 100 gram uden en eneste advarsel. Det er åbenlyst forkert, men **det kan ikke fanges af et regnestykke**, for tallene modsiger ikke hinanden. Kalorierne passer til makroerne, og ingen enkelt værdi er umulig.

Hver grænse der ville fange kiksen, gav samtidig falsk alarm på Husk, chiafrø, kokosmel, kakaonibs og otte slags krydderier. Målt på alle 2.268 fælles fødevarer og 5.633 af kundernes egne. En advarsel på netop de fiberrige varer er det værst tænkelige, for så lærer kunden at klikke advarsler væk, og så virker de øvrige advarsler heller ikke.

Begrundelsen står også i `content/openFoodFacts.ts` lige der hvor grænsen ville have stået.

De øvrige advarsler er uændrede. "Kalorier mangler" og "produktet har ingen næringstal" påpeger at noget **mangler**, ikke at kildens tal er forkerte, og de er derfor noget andet end det der blev sagt nej til.

### 8.2 Den gamle app husker aldrig en mængde pr madvare, og det skal den ikke lære

Vælger kunden rugbrød, kommer det ind som "1 skive". Retter hun til 2 og vælger rugbrød igen i morgen, også fra fanen Seneste, står der "1 skive" igen. Hun skal taste tallet forfra hver dag.

Det er ikke en fejl, det er et hul. Og det forvirrer ekstra fordi et helt **måltid** gemt som favorit godt husker mængderne, mens en enkelt **madvare** aldrig gør. To ting der ligner hinanden på skærmen og opfører sig forskelligt.

**Byg det ikke ind i den gamle app.** Det er et rigtigt stykke arbejde, det rører den del af mad-modulet der bruges mest, og 3.0 har det færdigt. Se "Det du plejer" i `content/plejer3.ts`, hvor mængden huskes pr madvare. Målt på rigtige data dækker kundens 10 hyppigste madvarer 54 procent af alt hun taster, og 68,5 procent af alle registreringer er en gentagelse. Det løses når holdene flyttes over.

Skriver en kunde at appen ikke husker hendes mængde, er det eneste spørgsmål der skiller det fra fejlen i afsnit 7: **sker det når hun vælger madvaren igen en anden dag, eller inde i det samme måltid mens hun står med det.**

---

## 9. Åbne tråde i den gamle app

**Klaret 1. september:** AI'en i DEN HER app kender nu også kundens forløb.
Se "Rettet 1. september" i afsnit 7.

- **Tilbagefalds-reglen i `hentAktivProduktType`** sender udløbne kunder til Kickstart-skuffen. Kendt, ikke rettet. Se 6.3.
- **Ann og Lone** på Kropsro 24. maj havde kun én nul-dag hver, så deres forlængelse rakte kun til 18. august. Deres forløb er slut nu. Linn nåede ikke at tage stilling til om de skulle have mere tid.
- **`programValg` er tomt på KropsRo 16. aug.** 16 af holdets 17 kunder har en tom `programValg` i deres skuffe `kropsro_aug_26`. På maj-holdet var den udfyldt hos alle. Det blokerer intet i dag, fordi både forsiden og Moduler til Træning sender kunden til `traening/program/...`, som ikke bruger feltet. Kun den gamle mikrotrænings-side læser det, og går kunden derind via et gammelt bogmærke, bliver hun bedt om at vælge kettlebell en ekstra gang. Årsagen er ikke fundet endnu, og den bør findes før næste hold bygges.
- **Merete (transam78mp@icloud.com)** har et ubesvaret dublet-spørgsmål i `klientspoergsmaal`. Hun sendte det samme spørgsmål to gange, og kun det første blev besvaret.
- **Baseline-dagen i vaner-modulet** siger "vi starter med et baseline-tjek" og viser så ét fritekstfelt uden at nævne symptomchecken. Det var teksten der satte Meretes spørgsmål i gang. Ikke rettet.
- **Forløbskøb sker manuelt.** Der er ingen Simplero-webhook for forløb endnu, kun for abonnementer. **Delvist løst 30. august:** nye køb kan nu lande på holdet af sig selv, se afsnit 7, men fluebenet skal flyttes i hånden ved hver holdstart, se 6.12.
- **Appen siger ikke fra når en indtastning ikke kommer igennem.** Åbnet og **løst 4. september 2026**, se "Rettet 4. september: appen siger nu fra" i afsnit 7. Der er stadig sider der gemmer noget uden at være gennemgået, se samme afsnit for hvad der mangler.

### Åbnet 3. september 2026: den sorte skærm der forsvandt ved at logge ind igen

**Ikke fundet. Det her er den vigtigste åbne sag om træningen.**

Kunder melder træningsvideo der hakker eller er sort. Linn havde det selv
på **én iPhone 12 Pro Max**, mens en anden iPhone var fin i samme øjeblik,
med de samme filer fra det samme sted.

**Det er udelukket:** lydkontakten på siden af telefonen, strømsparetilstanden,
en genstart af appen, kopien bag ikonet på hjemmeskærmen (samme fejl i
Safari uden om ikonet), pladsen på telefonen (78 GB ledig), telefonens alder
og iOS-versionen (den fejlende var på den NYESTE, iOS 26.6.1), samt
lavdatatilstanden og automatisk afspilning af videoeksempler.

**Det er heller ikke serveren eller kvoten.** Var det trækket udefra, ville
begge telefoner fejle samtidig, og fejlen ville hedde `quota-exceeded`. Det
er set før, 26. juli.

**Fejlen forsvandt da Linn loggede ud og ind igen**, og blev derefter ved
med at være væk, også som en anden bruger. Det peger på noget der bygger
sig op i den kopi af appen der kører på telefonen, og som en frisk start
rydder. Det passer med kundernes ord: "nogle gange" og "i går virkede det".

**SÅDAN FANGES DEN NÆSTE GANG, og det er det eneste der mangler for at
kunne rette den:** åbn `/ny/admin/tjek-video` på telefonen MENS skærmen
stadig er sort, og tryk Kopier. **Log ikke ud først. Log ud sletter
beviset.** Siden siger om afspilningen blev blokeret og hvorfor, om filen
kom hjem og hvor hurtigt, og om uret på videoen tikker mens ruden er sort.
Se 9.71 i overdragelsen for 3.0.

Værd at vide til den kunde der ringer: luk appen helt, altså swipe den væk
fra listen over åbne apps, og åbn den igen. Hjælper det ikke, ligger
"Nulstil appen på denne enhed" under Din side.

### Åbnet 3. september 2026: to ting om video og lyd der ikke er rettet

Fundet under diagnosen ovenfor. **Ingen af dem er årsagen til den sorte
skærm på Linns egen telefon, og ingen af dem er rettet.**

- **Biblioteket starter øvelsesvideoen af sig selv MED lyd slået til**,
  `<video controls autoplay playsinline>` uden `muted`. Det blokerer alle
  browsere, og resultatet er en sort firkant indtil kunden selv trykker på
  play. Det er ikke en fejl der kommer og går, det er sådan siden er bygget.
- **Musikken under træningen startes af skærmen og ikke af kundens tryk.**
  Browsere afviser lyd der starter af sig selv, og om det lykkes afhænger
  af hvad den enkelte browser har lært om appen i forvejen. Derfor hører
  nogle kunder musik og andre ikke. **Og går det galt, siger appen det
  ikke:** den skriver en advarsel i udviklerkonsollen, mens lyd-knappen på
  skærmen bliver ved med at se tændt ud. Foreslået rettelse: start musikken
  på kundens tryk på Start og Fortsæt, og lad knappen vise sig som slukket
  hvis telefonen sagde nej, så hun selv kan tænde.

### Åbnet 4. september 2026: alt om Linn AI's grundlag

Kom ud af en gennemgang af hele kæden. **Intet af det er rettet.**

- **FAQ-teksten i videnbasen har fem tomme pladser.** Der står
  `[UDFYLD: ...]` i del 4 (vegetarisk, proteinguide), del 7 (kettlebell-vægte),
  og tre steder i del 8 (fibertilskud, kreatin-mærker, tilskudsliste med
  doseringer). AI'en læser dem hver gang. Kettlebell-svaret er det værste:
  teksten lover et konkret tal og leverer en tom plads, så modellen kan
  finde på at digte et
- **Samme FAQ modsiger regel 6.** Se punkt 3 ovenfor. Rettelsen hører hjemme
  i FAQ-teksten, ikke i reglerne. **De seks destillerede dokumenter kan
  ikke rettes varigt**, de skrives om hver gang "Lær af alle svar" køres,
  fordi de udledes af de gamle svar der stadig siger udsolgt
- **FAQ'en lover et personligt svar, appen gør ikke.** Tre steder står der
  at kunden skal skrive til Linn, og at de så kigger på det sammen.
  Beskeder-siden siger at spørgsmål besvares samlet og anonymt. AI'en læser
  FAQ'en. Kræver Linns beslutning om hvad der er sandt
- **Videnbasen er FÆLLES, men FAQ'en er skrevet til Kickstart.** Der står
  Kickstart i hver sidefod, "de 21 dage", og den slutter med "jeg håber vi
  ses på forløbet". En Kropsro-kunde får den altså med i sit grundlag, og
  det kolliderer med regel 1. Ikke akut, fordi der kun er ét sæt
  dokumenter. **Bliver akut den dag der lægges en FAQ nummer to ind.** Et
  dokument bør kunne høre til et forløb
- **Del 9 siger "det tager vi hul på efter Kickstart".** En antydning af
  hvad der kommer, altså i modstrid med regel 2
- **Kunde-chatten får de 30 NYESTE svar, ikke de mest relevante.**
  `vaelgRelevanteSvar` bruges kun af admin-svar-udkastene. Arkivet er 453
  besvarede spørgsmål plus 300 redigerede udkast, så chatten ser under en
  tiendedel, uanset emne. **Det er den enkeltting der ville løfte
  fagligheden mest**
- **Linn overvejede 200 svar i stedet for 30.** Målt: 30 svar fylder cirka
  5.800 tokens, 200 fylder cirka 40.200, videnbasen cirka 11.400. Prisen pr
  spørgsmål går fra cirka 0,15 kr til cirka 0,40 kr, altså fra cirka 280 kr
  til cirka 760 kr om måneden ved 2.000 spørgsmål. **Lagt på hylden**, fordi
  syv gange så mange gamle svar også er syv gange så mange chancer for at
  gentage noget forældet. Relevans først
- **DEN HER APP LOGGER IKKE HVAD AI'EN SVARER.** 3.0 skriver hvert svar til
  `nyAiLog` med det grundlag det byggede på, og der er en admin-side til
  det. `/api/linn-ai` skriver ingenting. Linn kan altså kun læse med der
  hvor kunderne ikke er endnu. Alt hvad vi ellers laver ved AI'en, kan
  derfor ikke måles

### Åbnet 27. til 31. august 2026

- **Opstarts-vagten er slukket og ikke tændt igen.** Den skulle opdage en app
  der satte sig fast, men Linn så "Det tager længere end normalt" tre gange i
  træk, og den er destruktiv. **Årsagen er ikke fundet.** Målingen den bygger
  på så anderledes ud på hendes telefon end på en computer. Tænd den ikke uden
  at have forstået hvorfor
- **Den ugentlige planlægger til "Lær af alle svar" mangler tre ting**, og de
  ligger alle på Linns egne konti: en nøgle i Cloudflare, den samme nøgle i
  GitHub, og selve filen op. Filen kunne ikke pushes, fordi adgangsnøglen
  mangler den rettighed. **Den ligger derfor som en usporet fil i repoet**, og
  det er den `.github`-mappe der står i `git status`. Linn valgte 30. august at
  prøve den manuelle knap og påmindelsen først
- **Købshistorikken på Kickstart August rummer 869 rækker, hvoraf kun 236 hører
  til holdet.** Rettelsen 30. august gør at de øvrige ikke længere rammes af
  forløbets begrænsninger, men **rækkerne står der stadig.** Måler du på holdet,
  så tæl ikke rækker
- **`programValg` er tomt på KropsRo 16. aug**, se ovenfor. Stadig ikke fundet

### Fundet ved gennemgangen af mad-modulet, 23. og 24. august

Resten af modulet blev kørt igennem mod rigtige data og virker. Regnestykker, enheder, søgning, dagbogens totaler, opskrifternes filtre og næringstal, indkøbslistens skalering og sammenlægning, stregkode-opslaget og mærkevaresøgningen. Det herunder er hvad der IKKE blev rettet.

- **152 måltids-linjer hos 31 kunder peger på en slettet fødevare.** Kunden ser databasens id, altså noget i stil med `1YfZiQ7rCVPhaupt0iPT`, hvor navnet burde stå, og linjen tæller 0 protein og 0 fiber. Det sker når hun sletter en af sine egne fødevarer efter at have brugt den. Ud af 32.366 måltider, så det er sjældent, men det ser i stykker ud når det rammer. Kræver en beslutning om hvad der skal stå i stedet, for eksempel navnet gemt sammen med linjen, eller bare "slettet fødevare". Se `{food?.name ?? item.foodId}` i mad-modulets dagbog.
- **Et tomt mængde-felt kan gemme det gamle tal.** `opdaterPortion` springer over opdateringen så længe feltet er tomt, så feltet og det gemte tal kan nå at pege hver sin vej. Taster kunden nye cifre, retter det sig selv. Gemmer hun mens feltet står tomt, gemmes det gamle tal uden varsel.
- **128 af 130 aktive opskrifter har intet billede** i den gamle app. Kun to har en `billedeUrl`. Billederne blev lagt ind i 3.0 i august, men den gamle app peger ikke på dem.
- **Mærkevaresøgningen springer gennemsynet over** når næringstallene ser rimelige ud, hvor scanneren altid viser det. Det er den eneste vej hvor tal fra en fremmed database kan ryge direkte i et måltid uden at kunden ser dem. Ikke besluttet.
- **Madplanen har ingen tests overhovedet.** Den er parkeret i 3.0, men den er stadig tændt for kunderne her. Det eneste modul i Mad uden testdækning.

---

## 10. Sådan laver du en diagnose

Scriptene mod rigtige kunder følger et fast mønster, se `CLAUDE.md` regel 9.

Læg scriptet i `scripts/_navn.ts`, kør det med `npx tsx scripts/_navn.ts`, og **slet det bagefter**. Nøglen ligger i `scripts/service-account-key.json` og bruges med `firebase-admin`. Der ligger allerede et generisk opslag i `scripts/_find-kunde.ts` der tager en mail og viser whitelist-række, Auth-konto og kunde-dokument.

Kør altid read-only eller tørkørsel først, og vis Linn resultatet. Skal der skrives til kundedata, kræver netop den kørsel et selvstændigt ja.

Vil du vide om en rettelse virker, så kald de rigtige funktioner fra `src/lib/content/` i scriptet i stedet for at skrive regnestykket af. De filer har ingen Firebase-afhængigheder og kan importeres direkte.

---

## 11. Test og udrulning

Før hver commit i den gamle app:

```
npx svelte-check --threshold error   # skal give 0 fejl
npm test                              # hele suiten, i dag 2665 tests
npm run build                         # ved alt kundefølsomt
```

Push til `main` deployer automatisk til kunderne. `firestore.rules` og `storage.rules` skal deployes særskilt, se `CLAUDE.md` regel 4.

Efter udrulning: verificér mod live med et engangs-script, og skriv i chatten hvordan Linn selv kan se at det virker. Hun har testbrugere på holdene, for eksempel `kropsro_aug_26@linnsacademy.dk`. **Alle testbrugere har koden `test1234`.**

### To regler der kom af fejl i ugen 27. til 31. august

**PRØV DET I EN BROWSER SOM EN RIGTIG KUNDE, FØR DU MELDER DET FÆRDIGT.** Ikke
kun tests og typetjek. Linns besked 29. august, og anledningen var uge-målene,
som blev leveret med alt grønt og en synlig fejl på skærmen, se fælde 6.10.

**Log ind som en testbruger og ikke som admin.** Admin går uden om flere ting,
blandt andet hjemmeskærms-skærmen og spærringerne, så du kan ikke se det kunden
ser. Gå hele vejen igennem, inklusive at gemme noget: en graf bliver først
tegnet når der er data.

**TJEK OM UDRULNINGEN OVERHOVEDET ER NÅET FREM, FØR DU LEDER EFTER FEJL I
KODEN.** Det skete to gange den 29. august, hvor Linn meldte at noget ikke
virkede, og der ingen fejl var. Cloudflare var bare ikke færdig.

Den installerede app kører desuden videre på sin gemte kopi og tjekker kun for
en ny hvert kvarter og ved fokus, og tager den først i brug ved næste klik
videre til en anden side. **Det er med vilje**, så en kunde ikke får siden
genindlæst midt i en video. Bed Linn lukke appen helt ned og åbne igen. Den
udrullede version kan slås op med `_app/version.json` og holdes op mod
tidspunktet på den seneste commit.
