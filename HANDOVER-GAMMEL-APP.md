# Overdragelse: den gamle app

Sidst opdateret 18. august 2026.

**Denne fil handler KUN om den app der er i drift på `/app`.** Den må ikke blandes sammen med `HANDOVER-3.0.md`, der handler om den nye kundeflade på `/ny`. To apps, to filer, to arbejdsspor. Retter du noget i den gamle app, hører det til her. Bygger du på 3.0, hører det til der.

**Læs i denne rækkefølge hvis du er ny:** afsnit 2 om hvornår du overhovedet må røre den, afsnit 6 om fælderne, og så afsnit 8 om hvad der er åbent. Resten slås op efter behov.

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

## 7. Rettet 17. og 18. august 2026

To akutte rettelser, begge under ventilen i regel 2, begge udrullet.

**Symptomchecken måler nu på Kropsro-forløbets egne datoer.** Commit `caeadd4`. Målepunkterne er startdagen og hver 28. dag, for KropsRo 16. aug altså 16/8, 13/9, 11/10 og 8/11, så hele holdet udfylder samme dag. Kickstart, abonnenter og byggede forløb er uændrede og kører videre på kundens eget ur. Fejlen var at fem kunder startede et 84-dages forløb uden startmåling, fordi 28-dages-uret fra deres forrige forløb stadig løb. Se `kropsroMaalepunkter` i `src/lib/content/mrs.ts`.

**Nul-dage tælles nu med i kontoens adgang.** Commits `adc647e`, `f691f7b` og `b1d0e61`. `forlobSlutMs` og `bibliotekBonusSlutMs` fik et frivilligt tredje argument, `hentNulDagePrForlob(uid)` slår kundens pauser op med mellemlager, login-tjekket bruger dem to steder, og ti sider sender kundens uid med. 883 af 895 dataskuffer i basen har ingen pauser og er dermed helt uberørte.

Sussi og Ann-Brigitt fik deres slettede træningsprogram skrevet tilbage manuelt bagefter.

---

## 8. Åbne tråde i den gamle app

- **Tilbagefalds-reglen i `hentAktivProduktType`** sender udløbne kunder til Kickstart-skuffen. Kendt, ikke rettet. Se 6.3.
- **Ann og Lone** på Kropsro 24. maj har kun én nul-dag hver, så deres forlængelse er kort. Linn skulle tage stilling til om de skal have mere tid.
- **Berit (berit@adg-fysioterapi.dk) og Lene (leneskud@gmail.com)** står på KropsRo 16. aug men har ikke åbnet appen siden holdstart, så deres konto står stadig på SommerRo. Det retter sig selv når de logger ind, men de ved det ikke selv.
- **Merete (transam78mp@icloud.com)** har et ubesvaret dublet-spørgsmål i `klientspoergsmaal`. Hun sendte det samme spørgsmål to gange, og kun det første blev besvaret.
- **Baseline-dagen i vaner-modulet** siger "vi starter med et baseline-tjek" og viser så ét fritekstfelt uden at nævne symptomchecken. Det var teksten der satte Meretes spørgsmål i gang. Ikke rettet.
- **Forløbskøb sker manuelt.** Der er ingen Simplero-webhook for forløb endnu, kun for abonnementer.

---

## 9. Sådan laver du en diagnose

Scriptene mod rigtige kunder følger et fast mønster, se `CLAUDE.md` regel 9.

Læg scriptet i `scripts/_navn.ts`, kør det med `npx tsx scripts/_navn.ts`, og **slet det bagefter**. Nøglen ligger i `scripts/service-account-key.json` og bruges med `firebase-admin`. Der ligger allerede et generisk opslag i `scripts/_find-kunde.ts` der tager en mail og viser whitelist-række, Auth-konto og kunde-dokument.

Kør altid read-only eller tørkørsel først, og vis Linn resultatet. Skal der skrives til kundedata, kræver netop den kørsel et selvstændigt ja.

Vil du vide om en rettelse virker, så kald de rigtige funktioner fra `src/lib/content/` i scriptet i stedet for at skrive regnestykket af. De filer har ingen Firebase-afhængigheder og kan importeres direkte.

---

## 10. Test og udrulning

Før hver commit i den gamle app:

```
npx svelte-check --threshold error   # skal give 0 fejl
npm test                              # hele suiten, i dag 1777 tests
npm run build                         # ved alt kundefølsomt
```

Push til `main` deployer automatisk til kunderne. `firestore.rules` og `storage.rules` skal deployes særskilt, se `CLAUDE.md` regel 4.

Efter udrulning: verificér mod live med et engangs-script, og skriv i chatten hvordan Linn selv kan se at det virker. Hun har testbrugere på holdene, for eksempel `kropsro_aug_26@linnsacademy.dk`.
