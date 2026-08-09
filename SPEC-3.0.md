# Linns Academy 3.0 — specifikation

**Dato:** 3. august 2026
**Status:** Specifikation. Der er IKKE skrevet kode.
**Baggrund:** Sparring med Linn og Bo, august 2026. Erstatter den ikke-implementerede 2.0-plan i `handover-til-naeste-chat-v27.md`.

> **Formål:** Appen skal kunne stå alene som et abonnements-produkt, samtidig med at Linns forløb kører videre inde i den. Det kræver, at kunden bliver omdrejningspunktet i stedet for forløbet.

---

## 0. Sammenfatning på ti linjer

> ## ⚠ UFRAVIGELIG REGEL: DEN EKSISTERENDE APP RØRES IKKE
> Der må under ingen omstændigheder ændres kode i den nuværende kundeflade eller i de delte moduler, den bruger. **Alt nyt er additivt: nye filer, nye funktioner, nyt rodtræ.** Ingen eksisterende fil redigeres, heller ikke "bare en linje". Cirka 760 kunder er i drift, og den gamle app skal opføre sig byte-for-byte som i dag, mens 3.0 bygges. Konsekvenserne af reglen er beskrevet i afsnit 5.2 og 6.

- Vi bygger en **ny kundeflade i den eksisterende kodebase**, ikke et nyt projekt og ikke en ombygning af den gamle.
- Den nuværende kundeflade under `src/routes/app/` **røres ikke**. Ikke fryses med undtagelser. Røres ikke.
- Al forretningslogik i `src/lib/` og hele admin-værktøjet **genbruges uændret**. Nyt lægges i nye moduler ved siden af.
- Kunden ejer sine data. Abonnement og forløb bliver **rækker med fra- og til-datoer**, og ingen af dem overskriver den anden.
- Et forløb bliver en **tilmelding**, der lægger lektioner og kalender ovenpå appen. Ikke en beholder for kundens data.
- Der er **ét app-niveau**. Basis og premium udgår som kundeskel.
- Udrulning sker **hold for hold** via et flag, der allerede findes i koden.
- Første hold i 3.0 er et **Kickstart-hold**.
- Fællesskab, podcast og betalingsflow er **ude af scope** i denne omgang.
- Et hold flyttes **aldrig midt i sit forløb**.

---

## 1. Låste beslutninger

| Beslutning | Valg |
|---|---|
| Platform | Web-app. Ikke App Store. |
| Kodebase | Én. Ny kundeflade ved siden af den gamle. |
| Eksisterende app | **Røres ikke.** Kun additive tilføjelser i nye filer. |
| Datamodel | Kunden i centrum. Adgange som rækker. |
| App-niveauer | Ét. **Der findes ikke premium i 3.0.** |
| Udrulning | Både pr person og pr hold, via flag. Ingen flyttedag. |
| Første hold | Kickstart. Startdato ikke fastlagt endnu. |
| Migrering af data | Ingen. Samme database, samme konti. |

---

## 2. Datamodellen

### 2.1 Problemet i den nuværende model

`UserDoc` bærer i dag cirka femten flade adgangsfelter, som overskriver hinanden. Beviset står i jeres egen kommentar til `aboProdukt` i `src/lib/types.ts`:

> *"Bevares så vi kan skifte tilbage til app efter et forløb. `activeProduct` overskrives af forløbet undervejs."*

Kunden kan kun være én ting ad gangen. Derfor findes skyggefelterne `aboProdukt` og `aboAccessLevel`, og derfor bliver app-køb under et aktivt forløb udskudt til dagen efter forløbets slut.

Samme tankegang står i `src/lib/content/adgangResolver.ts:49`:

```ts
// 1) Aktivt forløb vinder. Ved overlap: det med senest slut (mest adgang).
```

**I 3.0 vinder forløbet ikke. Det lægger sig ovenpå.**

### 2.2 Den nye model

Kunden er dokumentet. Alt hun har købt er rækker under hende.

```
users/{uid}
  firstName, lastName, email, brugerProfil, dagligeMaal, indstillinger

  adgange: Adgang[]          <- NYT. Kilden til sandhed. Intet overskrives.
  forlobIds: string[]        <- BEVARES som fladt søge-indeks (array-contains)
```

```ts
interface Adgang {
	art: 'abo' | 'forlob';
	produkt: string;          // 'app' | 'kickstart' | 'kropsro' | bygget forløbs-id
	forlobId?: string;        // kun for art='forlob'. Hvilket hold.
	fra: number;              // ms
	til: number | null;       // ms. null = løbende abo uden slutdato
	kilde: 'simplero' | 'manuel' | 'bonus';
	simpleroPurchaseId?: string;
	oprettet: number;
}
```

**Regler:**

1. En række bliver **aldrig** overskrevet eller slettet. Opsigelse sætter `til`. Refusion tilføjer en note. Historikken er permanent.
2. En kunde kan have **flere aktive rækker samtidig**. Det er hele pointen.
3. Bonusperioden efter et forløb bliver sin egen række med `kilde: 'bonus'` i stedet for feltet `bonusPeriodEndsAt`.
4. `forlobIds` bevares som afledt fladt felt, fordi Firestore ikke kan lave `array-contains` på et underfelt i et array af objekter. Admin skal kunne finde "hvem er på hold X". Feltet skrives altid sammen med `adgange`.

### 2.2.1 Rækkerne udledes i første omgang, de skrives ikke

Reglen i afsnit 0 betyder, at Simplero-webhooken **ikke må ændres** til at skrive `Adgang[]`. Derfor gælder følgende i etape 1 til 5:

- 3.0 **udleder** rækkerne ved læsning, af de felter der allerede står på kunden i dag: `forlobIds`, `aboKoebtAt`, `aboSlutterAt`, `aboProdukt`, `bonusPeriodEndsAt` samt startdato og længde fra forløbs-dokumenterne.
- Udledningen ligger i et **nyt modul**, `src/lib/content/adgang3.ts`, og er en ren funktion uden Firestore, så den kan testes fuldt ud.
- Webhooken, `userDoc.ts` og `adgangResolver.ts` røres ikke. Den gamle app er uændret.

**Pris ved dette valg:** rækkerne beregnes ved hver læsning i stedet for at ligge fast i databasen, og udledningen skal kende de gamle felters særheder. Til gengæld kræver 3.0 ingen skrivninger til eksisterende kunder overhovedet.

**Senere:** når den gamle app er pensioneret, kan rækkerne skrives som rigtige data, og udledningen bliver til en engangs-migrering. Det er bevidst udskudt og er ikke en del af denne specifikation.

**Hvorfor array på kunde-dokumentet og ikke en subcollection:** en kunde har typisk 1 til 5 rækker. Array betyder ingen ekstra læsning ved login, atomisk opdatering sammen med resten af kundedokumentet, og ingen nye Firestore-regler eller indekser. Bliver det nogensinde mange rækker pr kunde, kan det flyttes uden at ændre resolverens kontrakt.

### 2.3 Tilmelding og adgang er to ting

Dette er den vigtigste sondring i hele specifikationen.

| | Hvad den siger | Hvad den driver |
|---|---|---|
| **Tilmelding** | Hun er på hold X med startdato Y | Kalenderen, dag-nummeret, hvornår lektioner åbner |
| **Adgang** | Hun må se dette indhold | Hvad der overhovedet vises |

De er smeltet sammen i dag i `forlobIds` og `activeProduct`. De skal skilles ad, fordi **tilmeldingen skal blive stående i historikken, når adgangen ophører**. Det er sådan, biblioteket bagefter kan vise "Kickstart, marts 2026" med hendes egne noter, uden at hun stadig får leveret dagens lektion.

### 2.4 Resolveren

`resolverAktuelAdgang` i `src/lib/content/adgangResolver.ts` er allerede den rigtige idé. Den skal skifte fra at returnere **én tilstand** til at returnere **et billede af hvad kunden har**.

```ts
interface AdgangBillede {
	harApp: boolean;              // må hun bruge app-funktionerne
	aktiveForlob: AktivtForlob[]; // 0, 1 eller flere. Med dagNummer pr forløb
	tidligereForlob: string[];    // til biblioteket
	harBibliotek: boolean;        // app-adgang eller bonusperiode
}
```

Reglerne, udledt af rækkerne og dagens dato:

- `harApp` er sand hvis der findes en aktiv `abo`-række **eller** en aktiv `forlob`-række. Forløbskunden får app-adgang under forløbet.
- `aktiveForlob` er alle aktive `forlob`-rækker. Ikke kun den ene, der "vinder".
- Ingen skriver længere adgang på kunden. Webhooken **tilføjer en række**, og alt andet bliver udledt.

Resolveren skal være en **ren funktion uden Firestore**, så alle overgange kan testes.

**Vigtigt:** den nye resolver er et **nyt modul**, `src/lib/content/adgang3.ts`, med sine egne tests i `adgang3.test.ts`. Den eksisterende `adgangResolver.ts` og dens tests **røres ikke**, fordi den gamle app kører videre på dem. De to lever side om side, indtil den gamle app pensioneres.

### 2.5 Kundens data flytter til kundeniveau

Vaner, træningsfremgang, måltider, noter og historik hører til kunden, ikke til et forløbs-id.

**Strategi: baglæns-kompatible læsere, ikke datamigrering.** Vi flytter ikke eksisterende data. Læserne i `src/lib/firestore/` udvides, så de samler kundens historik på tværs af de gamle forløbs-stier og den nye kundesti. Det er markant billigere og uden risiko for de cirka 760 kunder i drift.

---

## 3. Funktioner: den nye todeling

`src/lib/content/features.ts` er den fil, der mest direkte bærer den gamle model. `kundetypeFor` gætter kundens type ud fra en tekststreng:

```ts
return aktivtForlobId(userDoc)?.startsWith('kropsro_') ? 'kropsro' : 'kickstart';
```

Og matrixen definerer app-kunden som fraværet af alt:

```ts
app: alleFeatures(false)
```

Det er omvendt af den forretning, appen skal bære. I 3.0 deles funktionerne i to slags:

### 3.1 App-funktioner — tændt for alle med app-adgang

Mad og 30-30-3, vaner, træning og mikrotræning, udvikling, bibliotek, scanner, udvidet næring, Linn AI, egne opskrifter.

Ingen matrix. Ingen niveauer. Ingen kundetyper. **Det er produktet.**

### 3.2 Forløbs-mekanikker — følger tilmeldingen

Dagens lektion, forløbs-kalenderen, uge-check-in, nul-dage, små skridt, og beskeder direkte til Linn.

**Beskeder direkte til Linn hører til her af forretningsmæssige grunde, ikke tekniske.** Det er en coaching-ydelse, der ikke kan skaleres til flere hundrede abonnenter. I appen er Linn AI svaret. Det er samme skillelinje, som allerede er trukket i `fleksibelt`-kolonnen i den nuværende matrix.

### 3.3 Konsekvens

3.0 bruger hverken `kundetypeFor` eller den type-baserede feature-matrix. Der er ingen matrix for app-funktioner, fordi de alle er tændt.

**Der findes ikke premium i 3.0.** Hverken som kundeskel, som felt eller som gate. Alle med app-adgang har det samme.

`features.ts` **røres ikke**, fordi den gamle app bruger den. Den lever videre uændret, indtil den gamle flade pensioneres. 3.0 læser den ikke.

Pr forløb kan admin fortsat slå mekanikker til og fra, sådan som `Forlob.features` allerede gør det for byggede forløb. Det felt læses af 3.0, men skrives af admin som i dag.

---

## 4. Den nye kundeflade

### 4.1 Én forside

I dag har `src/routes/app/+page.svelte` 3.910 linjer og rummer tre layouts: forløbskunde, modulbruger og udløbet.

I 3.0 er der **én forside for alle**. Har kunden en aktiv tilmelding, ligger dagens lektion som en blok øverst. Har hun ikke, er blokken der ikke. Ingen forgrening på kundetype.

### 4.2 Sider der falder sammen

Der findes i dag parallelle sider for samme funktion, alene fordi kunden er delt i to typer:

| Forløbs-udgave | App-udgave | Bliver til |
|---|---|---|
| `vaner/[dag]` | `vaner/abo/[dato]` | én side |
| `mikrotraening/[dag]` + `/spil` | `mikrotraening/abo/[dato]` + `/spil` | én side + ét spil |

Cirka 4.500 linjer i to udgaver. De kollapser, fordi det i 3.0 er den samme kunde med eller uden en tilmelding ovenpå.

### 4.3 Sideliste for 3.0

Nyt rodtræ. Den gamle flade under `src/routes/app/` røres ikke.

```
/ny                        forside (én for alle)
/ny/mad                    30-30-3, dagbog, opskrifter, min opskrift
/ny/vaner                  én udgave, med eller uden forløbs-vaner
/ny/traening               mikrotræning, tildelte og master-programmer
/ny/udvikling              grafer og historik, på tværs af forløb
/ny/bibliotek              faner pr gennemført forløb, med kundens noter
/ny/linn-ai                chat
/ny/beskeder               kun ved aktiv tilmelding
/ny/symptomcheck           kadence følger aktivt forløb
/ny/profil                 konto, mål, tekstskalering, adgange
/ny/hjaelp                 app-hjælp
```

Den endelige sti afgøres ved implementering. Kunden ser den ikke, fordi hun sendes videre fra `/app` ved login.

---

## 5. Flag og udrulning

### 5.1 Mekanismen findes allerede

- Felt: `UserDoc.testerFeatures: string[]`
- Funktion: `harTestAdgang(userDoc, 'ny-app')` i `src/lib/utils/userAdgang.ts:180`
- Admin: `/app/admin/testere`

**Udrulning skal kunne ske på to niveauer:**

| Niveau | Status |
|---|---|
| **Pr person** | Virker allerede i dag. Admin-siden Testere kan sætte og fjerne flaget på en enkelt kunde, med fuzzy søgning. Nul nyt arbejde. |
| **Pr hold** | Mangler. Kræver en knap der sætter flaget på alle kunder i et forløb på én gang. |

Individuel udrulning er altså det, der virker først, og det er også det, der skal bruges til de allerførste testpersoner. Hold-knappen er en ren tilføjelse.

### 5.2 Indgangen til den nye app

Reglen i afsnit 0 betyder, at der **ikke må lægges en omdirigering i `src/routes/app/+layout.svelte`**. Den nye app får derfor sin egen indgang med sit eget layout og sin egen adgangskontrol, i nye filer.

**Det virker, fordi det første hold består af nye kunder.** Et nyt Kickstart-hold har aldrig haft den gamle app installeret. De får linket til den nye flade fra start, installerer PWA'en derfra, og ser aldrig den gamle app.

For **eksisterende** kunder, der senere skal flyttes individuelt, gælder:

- Kunden har flaget og får linket til den nye flade, som hun lægger på hjemmeskærmen.
- Den gamle PWA-genvej bliver liggende og virker uændret, indtil hun selv fjerner den.
- Der er ingen automatisk omdirigering, så længe reglen i afsnit 0 står ved magt.

Skal der på et senere tidspunkt være automatisk omdirigering, kræver det ét linjeindgreb i det gamle layout, og det skal godkendes særskilt af Linn. **Det er ikke en del af denne specifikation.**

### 5.3 Regler for udrulning

1. **Et hold flyttes aldrig midt i sit forløb.** Et hold starter enten i den gamle eller den nye app og bliver der, til forløbet er slut.
2. Første hold i 3.0 er et **Kickstart-hold**, der starter direkte i den nye app. Startdatoen er ikke fastlagt endnu.
3. Enkeltpersoner kan flyttes når som helst, hvis de ikke er midt i et forløb.
4. App-kunder flytter derefter, i etaper, uden tidspres.
5. Rul tilbage: fjern flaget. Kunden er i den gamle app igen, med alle data i behold, fordi det er den samme database.

### 5.4 Hvorfor Kickstart er det rigtige første hold

`STANDARD_MATRIX` i `features.ts` viser, at Kickstart har de fire tungeste specialfunktioner slået fra: `linn-ai`, `nul-dage`, `byg-eget-program` og `ai-madplan`. 21 dage, 0-baseret dagkonvention, ingen nul-dage-mekanik. Det er den smalleste forløbs-flade, I har.

---

## 6. Hvad deles, og hvad bygges nyt

Kun én regel: **eksisterende filer læses, de redigeres ikke.** Skal noget opføre sig anderledes i 3.0, sker det i en ny fil ved siden af.

| Område | Handling |
|---|---|
| `src/lib/firestore/` (25 moduler) | **Læses som de er.** Nye kundeniveau-læsere lægges i nye moduler |
| `src/lib/content/` beregning, vaner, kost, forløb | **Læses som de er** |
| `src/lib/content/adgangResolver.ts` | **Røres ikke.** Ny logik i `adgang3.ts` |
| `src/lib/content/features.ts` | **Røres ikke.** 3.0 læser den ikke |
| `src/lib/utils/`, `src/lib/components/` | **Læses som de er.** Nye komponenter i egen mappe |
| `src/routes/app/admin/` (37 sider) | **Røres ikke.** Hold-knappen lægges som ny side eller nyt script |
| `src/routes/api/` (19 endpoints) | **Røres ikke.** Heller ikke webhooken. Se 2.2.1 |
| `src/routes/app/` kundeflade (32 sider) | **Røres ikke** |
| Nyt rodtræ: forside, navigation, layout, forløbs-levering | **Bygges nyt** |

**Det reelt nye er rygraden:** udledningen af adgange, den ene forside, navigationen og forløbs-leveringen. Modulerne er allerede bygget mod det fælles lag og skal kobles på en ny skal, ikke skrives forfra.

**Bemærk om admin:** reglen læses som at den kunde-vendte app og de delte moduler ikke må ændres. Admin-værktøjet er Linns eget værktøj uden kundepåvirkning, men for en sikkerheds skyld lægges hold-knappen som en **ny** admin-side eller et engangs-script, ikke som en ændring i den eksisterende Testere-side. Skal det være anderledes, siger Linn til.

---

## 7. Etaper

Rækkefølgen er styret af, at det første hold er et forløbs-hold. Forløbs-sporet skal virke først.

| Etape | Indhold | Færdig når |
|---|---|---|
| **1. Modellen** | `Adgang`-typen, udledningen i `adgang3.ts`, baglæns-kompatible læsere | Tests grønne. Ingen skærm bygget. Ingen eksisterende fil rørt |
| **2. Skallen** | Egen indgang, eget layout, flag, navigation, én forside | Linn kan se den nye app som testperson |
| **3. Forløbs-sporet** | Tilmelding, kalender, dagens lektion, bibliotek, beskeder | Et Kickstart-forløb kan gennemføres fra dag 0 til 21 |
| **4. Modulerne** | Vaner, træning, mad, udvikling koblet på. Parallelsider slået sammen | Alle moduler virker for både app- og forløbskunde |
| **5. Resten** | Symptomcheck, Linn AI, profil, hjælp. Admin styrer begge flader | Fuld flade |
| **6. Test** | Linn gennemgår alt i klient-mode, som app-kunde og som tilmeldt | Klar til første hold |

Etape 1 og 2 er fundamentet. Bliver de forkerte, arver 3.0 den gamle apps kobling.

---

## 8. Ude af scope

Alt herunder er gode idéer, som ikke må komme i vejen. De bygges, når 3.0 står, og det første hold er kommet godt igennem.

- Podcast
- Fællesskab og beskeder mellem kunder
- Nyt betalingsflow
- Migrering af de nuværende kunder
- Oprydning i den gamle kode
- Byg-selv-træning

---

## 9. Det der ikke genskabes i 3.0

Bemærk: intet af dette **fjernes** fra den gamle app. Det bliver bare ikke bygget i den nye.

- **Premium.** Findes ikke i 3.0. Hverken som kundeskel, felt eller gate
- Basis som kundeskel
- De tre forsider. Bliver til én
- Modulet "Mit forløb" som selvstændigt sted. Dagens lektion hører hjemme på forsiden
- `kundetypeFor` og den type-baserede feature-matrix
- Admin-klient-mode med tre varianter. I 3.0 er der én app, så det bliver to knapper: se som app-kunde, eller se som tilmeldt et bestemt hold

---

## 10. Risici

| Risiko | Håndtering |
|---|---|
| En eksisterende fil bliver rørt ved et uheld | `git diff` gennemgås før hver commit. Rører den noget uden for det nye rodtræ, er den forkert |
| Rygraden bliver forkert, og 3.0 arver den gamle kobling | Etape 1 og 2 tages først, med tests, før nogen skærm bygges |
| Udledningen af adgange rammer forkert på en gammel kunde | Tør audit mod live-data på alle cirka 760 kunder, hvor udledningen sammenlignes med den nuværende resolvers svar. Read-only |
| Scope vokser | Afsnit 8 er bindende |
| Gammel og ny kode side om side bliver rodet | Accepteret pris. Ryddes op, når ingen er på den gamle flade |
| Et hold rammes midt i forløbet | Reglen i 5.3.1 er ufravigelig |
| Baglæns-kompatible læsere overses | Hver ny læser får en test med gammelt datamønster |

---

## 11. Åbne punkter

Afklares undervejs, ikke nu:

- **Startdatoen for det første Kickstart-hold i 3.0.** Ikke fastlagt. Etaperne er derfor sat i "færdig når", ikke i uger
- **Hvad en app-kunde uden forløb møder på forsiden.** Afklares når vi bygger forsiden i etape 2
- **Prismodel for app-abonnementet.** Ikke relevant nu
- **Hvornår rækkerne går fra udledte til skrevne.** Først når den gamle app pensioneres. Se 2.2.1

---

## 12. Arbejdsgang

Uændret fra v33.

- Dansk i al UI og alle kommentarer. Ingen tankestreg eller semikolon i tekst til Linn
- Diagnose først. Kod aldrig uden et klart go
- Før commit: `npx svelte-check --threshold error` og `npm test`
- Ved kunde-følsomt: også `npm run build` og en integrationstest mod live via engangs-script, der slettes bagefter
- Commit og push kun når Linn beder om det

---

# Tilføjelse: beslutninger truffet 5. august 2026

Skrevet efter en dags designarbejde med Linn. Alt herunder er besluttet og
bygget i etape 1 og 2. Afsnittene ovenfor er uændrede, dette er et lag
oveni, ikke en rettelse.

## 13. Forsiden

Rækkefølgen ovenfra og ned. Er hun ikke på et forløb, er de tre
forløbs-blokke der bare ikke.

1. Dato, hilsen, Linns billede
2. Statuslinje: forløbets navn og dagnummer, plus ordet Medlem med den samlede tid
3. **Dit overskud** med kurve og målingens bånd
4. Uge-strimmel, som ligger inde i kortet med små skridt
5. Dagens små skridt
6. **Forløb:** dagens lektioner
7. Dagens træning
8. **Forløb:** dagens refleksion
9. Dagens tal
10. **Medlem uden forløb:** næste hold
11. **Forløb:** Skriv til Linn
12. AI-hjælp

**Intet logo på forsiden.** Brandet bæres af Linns ansigt, skrifterne og
farverne. Logoet bruges som ventetegn, se 17.

**Diplomer for gennemførte forløb bor på Profil**, ikke i forsidens hoved.
De fyldte for meget ved siden af dagens status.

## 14. Dit overskud

Kundens ene tal på forsiden. Gennemsnittet af de fem velvære-skydere
(energi, mave, cravings, humør, søvn) fra `mrs_scores`, hvor højt er godt.
Symptom-tallet (MRS) hører hjemme på Udvikling, hvor der er plads til at
forklare det. Aldrig to tal på forsiden.

**Kurven går altid fra første måling til den nyeste**, uanset om der er
gået tre uger eller tre år. Kun mængden af prikker og datoer ændrer sig:

- Op til fire målinger: prik, tal og dato ved hvert punkt
- Fem til tolv: prik og tal ved alle, dato ved første, midterste og sidste
- Over tolv: linjen gennem alle, prik på nogle få, tal og dato kun i enderne

Perioder med forløb markeres med et lyst felt og en farvet streg med en
mindstebredde, så et forløb på tre uger ikke forsvinder i et to-års-billede.
En pause, altså tid uden adgang, tegnes som et stiplet hul uden prikker.

## 15. Din måling

Erstatter ordet symptomcheck ude mod kunden. **Ét samlet skema med alle
seksten spørgsmål**: de elleve symptomspørgsmål og de fem skydere, altid
sammen. Bagved gemmes de fortsat i samme `mrs_scores`-dokument som i dag,
så Linns tal og dashboards er uændrede.

**Kadence:** Kickstart hver uge. Kropsro, øvrige forløb og alle uden forløb
hver fjerde uge.

Er målingen åben, ligger båndet nederst på score-kortet. **Det står en uge
og forsvinder derefter**, så hun ikke møder en bebrejdelse hver dag.
Skemaet kan afbrydes og fortsættes, og der står at det tager cirka to
minutter.

## 16. Medlemstid og foldning

**Medlemstid** er al den tid hun har haft adgang, abonnement og forløb lagt
sammen, hvor overlap kun tælles én gang. **Pauser tælles ikke med.** Melder
hun sig ud og kommer igen, lukkes den gamle række med en til-dato, og der
lægges en ny til. Hun starter aldrig forfra.

**Foldning:** en sektion hun har klaret, folder sig til én linje med
flueben og en sætning om hvad der skete. Reglerne:

- Kun opgaver folder. Dit overskud, Skriv til Linn og næste hold folder aldrig
- **Foldede sektioner bliver liggende på deres plads.** Rækkefølgen ændrer
  sig aldrig i løbet af dagen. Forudsigelighed er vigtigere end de sparede
  centimeter, især for målgruppen
- Et tryk folder ud igen, og så står den åben resten af dagen
- Dagens tal folder først når begge mål er nået
- Er alt klaret, kommer et kort grønt panel øverst og overskriften Klaret i dag

## 17. Ventetegnet

Det fulde logo bruges der hvor der er tid til at se på det: login, første
hentning, og når noget trækker ud. **Evighedstegnet løber rundt i sit eget
otte-tal** imens. Inde i appen bruges kun tegnet, aldrig ordene.

**Fremdriften tæller rigtige trin, ikke sekunder.** Forsiden henter seks
ting, og tallet flytter sig når én er hjemme. Den gamle apps timer-baserede
procent, der bliver stående på 99, gentages ikke. Tegnet vises først efter
et halvt sekund, og efter fire sekunder kommer en linje om at forbindelsen
måske er langsom. Ved `prefers-reduced-motion` står tegnet stille.

## 18. Træning og lektioner

**Dagens træning** vises for begge kundetyper. Dagens første øvelse kører
lydløst i loop som flisens billede, i videoens eget format 16:9, så hele
øvelsen er synlig i både højde og bredde. Resten af dagens videoer hentes i
baggrunden. Egress koster cirka tre til ni øre pr kunde pr måned.

**Programmet vælges af kunden selv**, første gang hun trykker træning, og
kan skiftes løbende efter hvad hun har mulighed for. Bygges i etape 4.
Forsiden læser allerede `aktivtTraeningsprogram`, så den skal ikke laves
om. Indtil vælgeren findes, falder appen tilbage på mikrotræningen.

**Der findes ikke premium.** Alle har den samme app og får det samme
program. Doc-id'erne `premium` og `basis` i de gamle mikrotrænings-data er
kun nøgler, ikke et kundeskel.

**Lektioner** henter deres billede fra Vimeo eller YouTube. Den første
ikke-klarede lektion står som stor flise, resten som liste. Bliver den
klarede, glider den ned i listen med flueben og teksten se igen, og den
næste rykker op. Ingenting forsvinder.

## 19. Dagens refleksion

Kun for kunder på et forløb, fordi spørgsmålet står på forløbets programdag.
Hun skriver svaret **direkte på forsiden**. Der skrives kun `note`-feltet,
aldrig hele dagen, fordi refleksionssiden i den gamle app bruger samme
dokument.

## 20. AI-hjælp

Kort på forsiden og egen chatside i den nye flade. Samme motor, samme
endepunkt og samme kvote på 30 spørgsmål om dagen som i dag. Endepunktet er
uændret. Kunden forlader aldrig det nye design.

## 21. Ét flueben

Fyldt salviegrøn cirkel med hvidt kryds, brugt ens alle steder hvor noget er
gennemført: små skridt, lektioner, træning, foldede sektioner. Et gennemført
forløb får i stedet et honningfarvet diplom med stjerne og årstal, fordi det
er et større øjeblik end et flueben.

---

# Tilføjelse: etape 4, Mad. Gennemgang og beslutninger 9. august 2026

Kom ud af en gennemgang af det gamle Mad-modul blok for blok, sammen med
målinger på rigtige kundedata. Skrevet ned fordi vi ellers risikerede at
beslutte noget der skulle laves om senere.

## 22. Bundmenuen ændres

Moduler-fanen **udgår**. Den var en menu der førte til en menu, og alt andet
end Biblioteket kan nås fra forsiden.

Ny bundmenu: **Forside · Mad · Snak · Udvikling · Profil**

- **Mad** tager pladsen. Det er det mest brugte i appen og det eneste modul
  der ikke kan bo på forsiden.
- **Træning** nås fra dagens træning på forsiden, hvor kunden også vælger og
  skifter program.
- **Biblioteket** bliver et kort nederst på forsiden, kun for dem der har
  adgang. Ingen grå, låste kasser.
- Vaner, Forløb og Symptomcheck nås fra forsiden som nu.

## 23. Det Mad indeholder i dag

Fem faner i `routes/app/moduler/30-30-3/`, 5.212 linjer plus tre undersider.
Alt herunder skal have en plads i 3.0, eller et bevidst nej.

**Byg måltid.** Søgning i fødevare-databasen med fire kilder (Kickstart,
Frida, egne, community), opslag i Open Food Facts efter mærkevarer,
stregkode-scanner med kameraet (åben for alle, ikke længere premium), manuel
tilføjelse, valg af portion og enhed, løbende protein og fiber, udvidet
næring hvis kunden har adgang, favorit-måltider, stjerne på enkelt-fødevarer,
egne fødevarer med opret/ret/slet, seneste-liste, valg af måltidstype og dato
ved gem, redigering af et måltid fra dagbogen, redigering af en favorit, og
et kladde-gem i browseren så et halvfærdigt måltid ikke går tabt.

**Opskrifter.** 128 opskrifter med søgning, kategori-filter og diet-tags.
Egen side pr opskrift med ingredienser, fremgangsmåde og makro. Antal
portioner kan ændres og makroen skalerer. Log som måltid i dagbogen. Vælg
flere opskrifter og få en samlet indkøbsliste.

**Mine opskrifter.** Feature-styret. Egne opskrifter oprettet ved at
fotografere eller vælge et billede, hvorefter AI læser ingredienser og
beregner makro. Ret, slet og log som måltid.

**Madplan.** Foreslår en plan ud fra opskrifterne. Skjules automatisk når
måltids-fokus er aktivt.

**Dagbog.** Dagens måltider grupperet efter type, dato frem og tilbage,
totaler, samt redigér, slet og kopiér et måltid til en anden dag eller type.

**På tværs.** Måltids-fokus lader admin begrænse hvilke måltidstyper kunden
ser i en forløbs-periode. Feature-adgang styrer udvidet næring og AI-opskrift.

## 24. Sådan spiser kunderne faktisk

Målt over 60 dage, 11.201 måltider, 222 aktive kunder. Tallene har ændret
designet flere gange undervejs, så de står her.

| | |
|---|---|
| Registreringer der er én enkelt madvare | 60 % |
| Madvarer pr dag, median | 13 |
| De travleste 10 % af dagene | over 23 madvarer |
| Dage hvor en måltidstype går igen | 38 % |
| Registreringer der er en gentagelse | **68,5 %** |
| Hendes 10 hyppigste madvarer dækker | 54 % |
| Hendes 20 hyppigste dækker | 74 % |
| Fordeling: morgenmad / frokost / aftensmad / snack | 38 / 30 / 20 / 12 % |

**Det vigtigste tal er de 68,5 %.** Kunderne taster de samme ting igen og
igen. Den hurtigste vej er derfor ikke en bedre søgning, det er at hun slet
ikke skal søge.

**Bemærk også at "et måltid" oftest er én ingrediens**, ikke en ret. Navnene
i data er "Banan", "Gulerod", "Rugbrød med solsikke". Et design der går ud fra
at en plads indeholder én linje pr måltid, knækker på en almindelig dag.

## 25. Sådan bygges Mad i 3.0

**Kunden starter på en oversigt og vælger måltid.** Morgenmad, frokost,
aftensmad eller snack. Linns beslutning 9. august. Så ved appen hvor maden
skal hen, og hele gætteriet om måltidstype forsvinder. Det koster ét tryk og
fjerner den fejl hvor mad lander forkert.

Inde i et måltid kan hun søge, scanne, vælge en opskrift, tage en favorit
eller bruge det hun plejer.

**De fire pladser er skærmens ryggrad**, fordi de underviser i metoden, altså
30 g protein pr måltid og 30 g fiber om dagen. Men de skal kunne rumme mere
end én ting, og de skal foldes sammen: én linje pr plads uanset om der er 1
eller 13 ting i den, med detaljerne ét tryk væk.

**Snack har intet mål.** Der står aldrig "mangler 30 g" på en snack. Den
viser kun hvad den bidrog med og tæller med i dagens total. Der skal ikke
stå noget der kan læses som en bebrejdelse for at have spist en håndfuld
mandler.

**Det du plejer.** Hendes egne hyppigste madvarer som store trykflader, så
over halvdelen af alle registreringer bliver ét tryk. Tre ting skal følge
med, ellers virker det ikke: mængden huskes pr madvare, listen er hendes
egen og ikke en generel, og den nye kunde får de mest brugte madvarer på
tværs af alle kunder indtil hun har sine egne.

**Fortryd, ikke bekræft.** Ét tryk registrerer med det samme, og der glider
en kvittering op med Fortryd. Et "er du sikker" ville fordoble antallet af
klik. Godkendt af Linn 9. august.

## 26. Beslutninger truffet 9. august

**Indkøbslisten hører sammen med opskrifterne**, fordi den giver mening når
man vil have en samlet liste ud af flere opskrifter. Den er ikke sin egen
plads.

**Udvidet næring**, altså kulhydrater, fedt og kalorier, er som udgangspunkt
**kun for medlemmer**, ikke for kunder der har købt et forløb. Admin skal
kunne tildele den til et helt forløb. Det er ikke premium ad bagvejen, det er
den admin-styrede adgangsmatrix, se `content/features.ts`.

**Favoritter skal kunne vælges og ses.** De skal have en synlig plads, ikke
kun dukke op i søgningen.

**Madplanen bliver i 3.0.** Linns beslutning 9. august, truffet med tallene
på bordet: madplanen er ikke blevet brugt en eneste gang af nogen kunde de
sidste 60 dage, mens 603 måltider i samme periode blev logget direkte fra en
opskrift, af 75 kunder.

At den ikke bruges betyder ikke nødvendigvis at den ikke er ønsket. Den ligger
som fjerde fane ude i højre kant på en telefon, og den skjules helt når
måltids-fokus er aktivt. Det er værd at give den en bedre plads i 3.0 frem for
at gentage den placering der gav nul.

**Egne fødevarer skal have en synlig plads**, ikke kun dukke op i søgningen.
Kunden opretter dem når en vare ikke findes i databasen, typisk mærkevarer fra
supermarkedet som "Bearnaise (Coop)" eller "Kokosmælk (Asian kitchen)". Målt
9. august: **335 af 615 kunder** har oprettet egne fødevarer, 5.349 i alt,
median 9 pr kunde, flest 143. Det er halvdelen af kundegrundlaget, ikke et
hjørnetilfælde.

**Biblioteket ligger nederst på forsiden**, ikke under Profil.

## 27. Åbne punkter på Mad

- Farve på fliserne: fire udgaver er tegnet, valget er udskudt med vilje
- Hvor madplanen skal ligge, nu hvor den ikke må gentage sin nuværende placering

**Arbejdsform aftalt 9. august:** vi tager Mad ét skærmbillede ad gangen i
stedet for at tegne hele modulet på én gang. De første fem runder mockups
byggede på gæt om hvad Mad indeholdt, og det skal ikke gentages.
