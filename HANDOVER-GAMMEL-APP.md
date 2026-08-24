# Overdragelse: den gamle app

Sidst opdateret 24. august 2026.

**Denne fil handler KUN om den app der er i drift på `/app`.** Den må ikke blandes sammen med `HANDOVER-3.0.md`, der handler om den nye kundeflade på `/ny`. To apps, to filer, to arbejdsspor. Retter du noget i den gamle app, hører det til her. Bygger du på 3.0, hører det til der.

**Læs i denne rækkefølge hvis du er ny:** afsnit 2 om hvornår du overhovedet må røre den, afsnit 6 om fælderne, og så afsnit 9 om hvad der er åbent. Resten slås op efter behov.

Læs den sammen med `CLAUDE.md` i repo-roden. Det er arbejdsreglerne, og de gælder begge apps. Gamle overdragelser fra 1.0 og 2.0 ligger i `arkiv/` og er forældede.

---

## 1. Hvad den gamle app er

Kundefladen på `/app`. Målt 18. august 2026 er der **618 kunde-dokumenter** og **621 mails på whitelisten**. Det er den app kunderne betaler for lige nu, og den der skal blive ved med at virke mens 3.0 bygges.

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

- **Tilbagefalds-reglen i `hentAktivProduktType`** sender udløbne kunder til Kickstart-skuffen. Kendt, ikke rettet. Se 6.3.
- **Ann og Lone** på Kropsro 24. maj havde kun én nul-dag hver, så deres forlængelse rakte kun til 18. august. Deres forløb er slut nu. Linn nåede ikke at tage stilling til om de skulle have mere tid.
- **`programValg` er tomt på KropsRo 16. aug.** 16 af holdets 17 kunder har en tom `programValg` i deres skuffe `kropsro_aug_26`. På maj-holdet var den udfyldt hos alle. Det blokerer intet i dag, fordi både forsiden og Moduler til Træning sender kunden til `traening/program/...`, som ikke bruger feltet. Kun den gamle mikrotrænings-side læser det, og går kunden derind via et gammelt bogmærke, bliver hun bedt om at vælge kettlebell en ekstra gang. Årsagen er ikke fundet endnu, og den bør findes før næste hold bygges.
- **Merete (transam78mp@icloud.com)** har et ubesvaret dublet-spørgsmål i `klientspoergsmaal`. Hun sendte det samme spørgsmål to gange, og kun det første blev besvaret.
- **Baseline-dagen i vaner-modulet** siger "vi starter med et baseline-tjek" og viser så ét fritekstfelt uden at nævne symptomchecken. Det var teksten der satte Meretes spørgsmål i gang. Ikke rettet.
- **Forløbskøb sker manuelt.** Der er ingen Simplero-webhook for forløb endnu, kun for abonnementer.

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
npm test                              # hele suiten, i dag 1777 tests
npm run build                         # ved alt kundefølsomt
```

Push til `main` deployer automatisk til kunderne. `firestore.rules` og `storage.rules` skal deployes særskilt, se `CLAUDE.md` regel 4.

Efter udrulning: verificér mod live med et engangs-script, og skriv i chatten hvordan Linn selv kan se at det virker. Hun har testbrugere på holdene, for eksempel `kropsro_aug_26@linnsacademy.dk`.
