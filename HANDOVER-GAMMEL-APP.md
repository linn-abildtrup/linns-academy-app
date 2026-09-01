# Overdragelse: den gamle app

Sidst opdateret 1. september 2026, sent på dagen.

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
