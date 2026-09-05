# Overdragelse: kunderejsen i 3.0

**Dato:** 5. september 2026
**Status:** Produktmodel aftalt i dialog med Linn. **Der er ikke skrevet kode, og der må ikke skrives kode på det her grundlag uden at Linn siger ja.**
**Hører sammen med:** `SPEC-3.0.md` (datamodellen og den nye kundeflade) og `HANDOVER-3.0.md` (hvad der faktisk er bygget).

> Dette dokument beskriver **hvordan kunden bevæger sig gennem appen over tid**, og hvad der sælges hvornår. Det siger intet om, hvordan det skal bygges.

---

## 0. Illustrationerne

To tegninger hører til. De er den visuelle kilde, og de er mere præcise end prosa på flere punkter.

| Fil | Hvad den viser |
|---|---|
| `illustration-kunderejsen.html` | **Hovedtegningen.** Hele rejsen: de to veje ind, kæden af kapitler, urene, priserne, salget i uge 3, de 90 dage og lukningen. Alle beslutninger står i den. |
| `illustration-tre-strenge.html` | Den første tegning fra samme dag. De tre måder indhold kan tidsstyres på. Overhalet af hovedtegningen, men bevaret fordi den forklarer *hvorfor* modellen ser ud som den gør. |

Begge ligger **to steder**: her i repo-roden (så de er versionsstyrede) og i `~/Projekter/v3 app/linns-academy-design/` sammen med det øvrige designmateriale. Mappen `v3 app` er ikke et git-repo, så kopien her i repoet er den, der kan hentes tilbage.

Åbnes ved at dobbeltklikke. Ingen server, ingen afhængigheder.

---

## 1. Modellen på ti linjer

- Kunden følger **ét langt spor**, der internt er delt i kapitler. Hun ser aldrig kapitlerne.
- Der er **to indgange**: et købt Kickstart-hold, eller et abonnement på appen.
- De to veje **mødes** efter cirka to til tre måneder og fortsætter ens derefter.
- Kun **ét kapitel** har en fælles startdato for et hold. Alt andet kører på kundens eget ur.
- Kunden ser **datoer**, ikke dagnumre. Dagnumre findes kun i admin.
- Appen koster **299 kr/md** og indeholder hele kæden. Kickstart-holdet koster **1.497 kr** og er eneste tilkøb.
- Appen **sælges i forløbets sidste uge**. Ingen betaling starter af sig selv.
- Køber hun ikke, har hun **90 dages læse-adgang** under profilen. Derefter lukker login.
- Data gemmes i **fem år**. Hun kan få dem udleveret som PDF og kan bede om sletning.
- **Genkald og Kickstart i appen er ikke skrevet endnu.** Det er den største post i planen.

---

## 2. Kæden og de to veje

### Vej A — hun køber Kickstart-holdet

1. **Kickstart, holdet.** 21 dage. Fælles startdato. Købes særskilt for 1.497 kr. App-adgang følger med i de 21 dage.
2. **Genkald.** 2 måneder. Hendes eget ur. Repetitionen efter et gennemført hold.
3. **Kropsro.** Hendes eget ur. Her mødes de to veje.

### Vej B — hun køber kun appen

1. **Fundamentet.** 1 uge. Principperne og 30-30-3. For den, der kommer helt frisk ind uden at have været på et hold. **Kun vej B, og det kan ikke springes over.**
2. **Kickstart i appen.** 2 måneder. Den afledte udgave.
3. **Kropsro.** Samme som ovenfor.

### Efter Kropsro

Der kommer noget. Hvad, ved vi ikke endnu. Se afsnit 9.

---

## 3. Urene

Der findes tre måder, indhold kan være tidsstyret på. Det er den tekniske kerne i hele modellen.

| Ur | Hvad afgør hvad hun ser | Hvor det bruges |
|---|---|---|
| **Hold-ur** | Holdets fælles startdato. Alle på holdet ser det samme samme dag. | **Kun Kickstart-holdet.** |
| **Eget ur** | Den dag hun selv startede kapitlet. To kunder kan være samme sted med et halvt år imellem. | Fundamentet, Kickstart i appen, Genkald, Kropsro. |
| **Kalender-ur** | En dato. Alle med adgang ser det samme den dag, uanset hvornår de købte. | Det løbende app-indhold. **Endnu ikke besluttet bygget** — se afsnit 9. |

**Kickstart-holdet slukker for kalender-uret.** I de 21 dage ser holdet ikke det løbende app-indhold. Forløbet har skærmen alene. Det gælder **kun** holdet — Genkald, Kickstart i appen og Kropsro ser det som alle andre.

**Under holdet er appen skåret ned til de moduler, forløbet har fået tildelt.** Linn holder dem i hånden og har bestemt langt det meste for dem. Resten af appen venter på den anden side.

---

## 4. Hvad kunden ser

**Datoer, ikke dagnumre.** Forsiden viser "tirsdag den 14. april", aldrig "dag 214". Det er dét, der gør "én lang rejse" til mere end en hensigt: har hun aldrig set et dagnummer, findes der intet tal, der kan afsløre, at hun er flyttet fra ét kapitel til det næste.

**Kickstart-holdet er eneste undtagelse, og den er additiv.** Datostriben er der stadig; dagnummeret ligger ved siden af, fordi holdet taler om "dag 5" i gruppen. Når de 21 dage er gået, falder dagnummeret bare væk. Ingen nulstilling — ét element mindre på skærmen.

**Kapitlernes navne er interne.** Fundamentet, Kickstart i appen, Genkald, Kropsro er vores ord, ikke hendes. De må aldrig stå i en overskrift, en påmindelse eller en mail. Se ordlisten i afsnit 11.

**Medlemstid hører hjemme under profilen.** "Du har været med i syv måneder" er en anerkendelse, ikke en position i et forløb.

### Tælleren bag skærmen

Selv om kunden ikke ser den, findes den, og reglerne er:

- Rejsen begynder den dag, hun **første gang er med** — på et forløb eller ved at købe appen.
- Den tæller **alle dage, hun har adgang**, ikke dage hun bruger appen. Er hun væk i tre uger, er tallet løbet 21 dage videre.
- **De 90 dages kigge-adgang tæller ikke med.** Der står tallet stille.
- Hopper en app-bruger over på et rigtigt Kickstart-hold, ser hun **dag 1 mens holdet kører** — hun står jo sammen med andre på dag 1. Bagefter **lægges holdets dage oveni** det tal, hun havde med ind. Var hun på dag 214, er hun på dag 235 efter de 21 dage. Ingenting går tabt.

---

## 5. Produkt og priser

| | Pris | Indeholder |
|---|---|---|
| **Appen** | 299 kr/md | Hele kæden: Fundamentet, Kickstart i appen, Genkald, Kropsro. Plus mad, vaner, træning, udvikling. |
| **Kickstart-holdet** | 1.497 kr | 21 dage med et hold, en startdato og Linn tæt på. App-adgang følger med i perioden. **Eneste særskilte køb.** |

**Kropsro udgår som betalt hold.** Det følger med appen. Hvad der sker med de nuværende Kropsro-hold-kunder, er ikke afklaret — se afsnit 9.

### To ting, tallene betyder

- **Fem måneders abonnement svarer til ét Kickstart-salg.** Bliver hun et år, er hun værd mere end det dobbelte.
- **299 lyder af meget lidt i uge 3.** Hun har netop betalt 1.497. At fortsætte for en femtedel om måneden er det letteste ja, der findes. Timingen er rigtig.

### Spændingen, modellen skal bære

Anne betaler 299 og får "Kickstart i appen". Maja betaler 1.497 og får Kickstart med et hold. **Materialet er i vidt omfang det samme.** Før eller siden opdager nogen det og siger det højt.

Så svaret må ikke være materialet. De 1.497 skal købe det, appen aldrig kan give: en startdato sammen med andre, et hold der går de samme 21 dage, beskeder direkte til Linn, og en skærm hvor intet andet forstyrrer. Det skal siges lige så tydeligt i salget, som det står her.

---

## 6. Salget i uge 3

Appen præsenteres og sælges i **forløbets sidste uge**. Hun skal aktivt vælge at fortsætte. Der starter ingen betaling af sig selv.

**Salget automatiseres ikke.** Det er noget Linn gør — ikke en blok appen skruer op for på dag 15. Det betyder, at der ikke skal bygges noget til det, og at det står og falder med, at det faktisk bliver gjort, hver gang et hold når uge 3.

**Hvorfor uge 3 er det rigtige tidspunkt:** hun sælges til, mens hun står inde i noget, der virker. Og fordi kæden kører på hendes eget ur, kan hun starte Genkald på dag 1, uanset om hun køber i uge 3 eller først to måneder senere. Hun kommer aldrig bagud.

**Risikoen:** et forløb, der slutter, føles færdigt. Siger hun nej, er der ingen app til at holde fast i hende. Derfor er de 90 dage vigtige.

**Maja er den eneste, der mærker en overgang.** Hun har betalt for noget med en ende, og i uge 3 skal hun tage stilling. Det brud kan ikke skjules og skal det heller ikke. Men efter hun har sagt ja, skal hun ind i den samme ubrudte rejse som Anne.

---

## 7. De 90 dage, og hvad der sker bagefter

Køber hun ikke i uge 3:

- Hun beholder **90 dages adgang** til forløbets materiale **og til sit eget** — noter, udvikling og registreringer.
- Alt ligger **under profilen**, ikke på forsiden. Forløbet flytter fysisk væk fra det sted, hvor man bruger appen, og ind det sted, hvor man ser tilbage. Hun skal ikke have forklaret, at hun ikke længere er i gang — hun kan se det.
- **Hun kan læse, ikke bruge.** Intet kan registreres. Ikke et måltid, ikke et flueben. Det er dét, der gør arkivet til et arkiv, og dét, der forhindrer, at hun bare udskyder købet til dag 89.
- **Forsiden er tom** med et høfligt link til at købe appen.
- **Det løbende indhold, hun gik glip af under holdet, er væk.** Kun forløbets eget materiale ligger under profilen.
- **Dag 91: hun kan ikke længere logge ind.** Derfor skal det høflige tilbud også stå på login-skærmen — ellers er hendes sidste oplevelse af Linn en afvisning.
- **Data gemmes i fem år**, derefter slettes de. Køber hun sig ind igen inden da, står hendes noter og udvikling klar.

**Påmindelserne er automatiske.** Det er den eneste automatik i modellen. Forslag: en venlig besked omkring dag 60, en tydeligere omkring dag 83, en sidste omkring dag 89. På mail, fordi hun sjældent åbner en app hun ikke bruger — og i appen for dem der gør.

**To ting skal stå i påmindelserne, ikke kun under profilen:**

- At hun kan **hente sine noter og sin udvikling ud som en pæn PDF**, hun kan gemme og printe. Ikke en rå datafil. Hun kan ikke logge ind bagefter, så det skal gøres mens hun er inde.
- At hun kan **bede om at få sine data slettet** før de fem år er gået. Det sker ved at skrive til Linn, da hun ikke kan logge ind.

> Fem år er lang tid at gemme registreringer om mad, vægt og symptomer på et menneske, der ikke længere er kunde. Det er ikke forbudt, men muligheden for sletning skal stå et sted, hun kan finde.

---

## 8. Tilbagevenden, pauser og hold midt i det hele

- **En tilbagevendende kunde må altid selv vælge, hvilken dag hun starter fra** — blandt de dage, hun allerede har haft. Det gælder generelt, ikke kun efter en pause. Hun kan ikke springe fremad.
- **Siger hun op, kører hun måneden færdig.** Perioden, hun har betalt for, får hun.
- **Køber en app-kunde et Kickstart-hold midt i det hele, trumfer holdet.** Det sætter Kickstart i appen på pause og overtager skærmen.
- **Bagefter genoptager hun Kickstart i appen præcis dér, hvor hun slap.** Ikke Genkald.

---

## 9. Det der stadig er åbent

| Spørgsmål | Status | Hvorfor det betyder noget |
|---|---|---|
| **Deler Genkald og Kickstart i appen ét lektionsbibliotek?** | Udskudt | De bruger meget af det samme stof, og **ingen af dem er skrevet endnu**. Det koster ingenting at beslutte nu og bliver dyrt at lave om, når begge findes som tekst. Bliver det to adskilte samlinger, skal hver rettelse laves to steder — og før eller siden bliver kun det ene rettet. |
| **Hvad ser hun ved kanten af kæden?** | Udskudt | Anne bruger cirka en uge plus to måneder plus Kropsro. Er Kropsro tre måneder, står den første kunde ved kanten **cirka fem en halv måned efter hun købte**. Det er ikke et åbent spørgsmål — det er en deadline. Hun må ikke møde en tom skærm eller ordet "slut". |
| **Hvad kommer efter Kropsro?** | Ved vi ikke endnu | Se ovenfor. |
| **Møder Anne det samme stof to gange efter et hold?** | Åben observation | Hun genoptager Kickstart i appen dér hvor hun slap, men har lige gået de 21 dage med holdet. Hun kan kun springe tilbage, ikke fremad, så hun kan ikke selv gå udenom en gentagelse. Værd at holde øje med, når materialet skrives. |
| **Bygges det løbende kalender-spor overhovedet?** | Ikke besluttet | Det er slukket for holdet i 21 dage, og de næste måneder bæres af kæden. Det har reelt ingen kunder, der har brug for det, før tidligst måned tre. Samtidig er det den dyreste vane at holde i live, fordi det kræver noget hver uge for evigt. **Anbefaling: byg kæden først.** |
| **De nuværende Kropsro-hold-kunder** | Forholder vi os ikke til nu | Kropsro er i dag et betalt hold med kunder i drift. De bør blive på hold-uret, til de er færdige — et hold flyttes aldrig midt i sit forløb. |

---

## 10. Hvad det betyder for det, der allerede findes

Dette er pegepinde til den, der senere skal koble modellen til koden. Ingen af dem er undersøgt til bunds.

- **Adgange som rækker** (`SPEC-3.0.md` afsnit 2.2) er den rigtige grundmodel til det her. Kæden kræver netop, at abonnement og forløb kan ligge oven på hinanden uden at overskrive hinanden — for eksempel når et Kickstart-hold pauser Kickstart i appen.
- **Der findes allerede en "opstart"** (`HANDOVER-3.0.md` afsnit 9.20): fire spørgsmål og en rundvisning, som møder alle første gang de logger ind. Den tager minutter og handler om **appen**. Fundamentet tager en uge og handler om **metoden**. **De må ikke komme til at hedde det samme.** Forslag: den eksisterende beholder navnet *Opstarten*, som den allerede har i profilen.
- **Gennemførte forløb i biblioteket** er allerede tænkt til at ligge under profilen. De 90 dages arkiv er samme sted, ikke et nyt begreb.
- **Nul-dage og forløbs-forlængelse** findes i dag. Hvordan de forholder sig til kæden, er ikke afklaret ud over reglen om, at hun selv vælger sin startdag ved tilbagevenden.
- **Forløb-dato-konventionen** (startdato = dag 0) gælder fortsat for Kickstart-holdet. Den er ikke ændret.

---

## 11. Ordliste — interne navne, der aldrig må ud til kunden

| Internt navn | Hvad det er |
|---|---|
| **Fundamentet** | Uge 0 for app-kunden. Principperne og 30-30-3. Navnet er et forslag; det vigtigste er, at det ikke hedder onboarding. |
| **Kickstart i appen** | Den afledte udgave af Kickstart, to måneder, eget ur. Kun vej B. |
| **Genkald** | Repetitionen efter et gennemført hold. To måneder, eget ur. Kun vej A. Navnet er Linns arbejdstitel. |
| **Kropsro** | Kapitlet efter de to Kickstart-spor. Navnet ændres sandsynligvis. |
| **Kapitel / kæden / rejsen** | Vores ord for strukturen. Kunden oplever bare, at der er noget nyt i dag. |

**Reglen:** ingen af disse må stå i en kundetekst, en overskrift, en påmindelse eller en mail. Det er den slags, der lækker et halvt år senere, når nogen skriver en ny tekst og bruger det ord, alle bruger internt.

---

## 12. Arbejdsgang herfra

1. Modellen er **aftalt, ikke bygget**. Der skrives ikke kode, før Linn siger ja til det konkrete stykke.
2. **Diagnose først.** Alt nyt sammenholdes med den gamle app blok for blok, så intet bliver glemt.
3. **Mockup før kode.** Linn skal se og godkende en tegning, før noget bygges — og tegningen åbnes i browseren for hende.
4. Rettelser til modellen skrives **her i dette dokument og i illustrationen**, ikke i en ny fil. Der må kun findes én version.
