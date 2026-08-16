# Linns Academy 3.0 — specifikation

**Dato:** 3. august 2026
**Status:** Specifikation. Der er IKKE skrevet kode.
**Baggrund:** Sparring med Linn og Bo, august 2026. Erstatter den ikke-implementerede 2.0-plan i `arkiv/handover-til-naeste-chat-v27.md`.

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
forløb får i stedet et honningfarvet diplom med hjerte og årstal, fordi det
er et større øjeblik end et flueben.

---

# Tilføjelse: etape 4, Mad. Gennemgang og beslutninger 9. august 2026

Kom ud af en gennemgang af det gamle Mad-modul blok for blok, sammen med
målinger på rigtige kundedata. Skrevet ned fordi vi ellers risikerede at
beslutte noget der skulle laves om senere.

## 22. Bundmenuen ændres

Moduler-fanen **udgår**. Den var en menu der førte til en menu, og alt andet
end Biblioteket kan nås fra forsiden.

Ny bundmenu: **Forside · 30-30 · Snak · Udvikling · Profil**

- **30-30** tager pladsen. Det er det mest brugte i appen og det eneste modul
  der ikke kan bo på forsiden. **Modulet hedder "30-30 beregner"**, og i
  bundmenuen står der kun **"30-30"**. Linns beslutning 9. august. Det gamle
  navn var "Mad (30-30-3 beregner)".
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
næring hvis kunden har adgang, favorit-måltider, hjerte på enkelt-fødevarer,
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

**Madplanen er PARKERET.** Linns beslutning 11. august, som afløser
beslutningen fra 9. august om at beholde den.

Baggrunden: madplanen er ikke blevet brugt en eneste gang af nogen kunde over
60 dage, mens 603 måltider i samme periode blev logget direkte fra en opskrift,
af 75 kunder. Da den skulle bygges, viste der sig desuden et problem med hvor
den hører hjemme: **den lægger en plan for hele dagen, men ikonet sad inde i ét
måltid.** Det er underligt at stå i Morgenmad og få forslag til aftensmad.

**Ikonet er fjernet helt**, ikke bare slået fra, så der ikke står noget der ser
halvfærdigt ud. Kunden kan ikke bruge madplanen i 3.0.

**Motoren er urørt** og kan tages op igen: `content/foreslaaMadplan.ts` og
`api/foreslaa-madplan`. Den kalder AI'en og koster derfor penge pr kald, ikke
kun et opslag. Tages den op, hører den formentlig hjemme på oversigten og ikke
inde i et måltid, for kunden åbner et måltid for at registrere noget hun HAR
spist, mens en plan lægges på et helt andet tidspunkt.

**Egne fødevarer skal have en synlig plads**, ikke kun dukke op i søgningen.
Kunden opretter dem når en vare ikke findes i databasen, typisk mærkevarer fra
supermarkedet som "Bearnaise (Coop)" eller "Kokosmælk (Asian kitchen)". Målt
9. august: **335 af 615 kunder** har oprettet egne fødevarer, 5.349 i alt,
median 9 pr kunde, flest 143. Det er halvdelen af kundegrundlaget, ikke et
hjørnetilfælde.

**Biblioteket ligger nederst på forsiden**, ikke under Profil.

## 26.1 Mad, skærm 1: oversigten. LÅST 9. august

Oversigten er **hele indgangen til Mad**. Fire måltidsfliser og ét
fiber-kort, ikke mere. Dybden ligger et lag nede.

- **Fire fliser:** morgenmad, frokost, aftensmad, snack. Hver viser hvad hun
  har spist, protein-summen og en stribe mod de 30 g.
- **Snack-flisen opfører sig anderledes:** ingen stribe, intet mål, roligt
  tal i stedet for grønt. Der står aldrig "mangler" på en snack.
- **To dagskort nederst: Protein i dag og Fiber i dag.** Protein i blomme,
  fiber i grønt, med linjen "Snacken tæller med i begge tal" under.

**Der er bevidst to slags tal på skærmen.** De tre striber er måltidsmål, 30 g
protein hver. De to kort er dagsmål. Snacken har kun det sidste: den har
hverken stribe eller mål, men alt hvad den bidrager med lander i begge
dagstal, både protein og fiber. Uden protein-kortet ville snackens bidrag
forsvinde ud af regnestykket for øjnene af kunden, og det var netop derfor
kortet kom til.

**Snacken tæller altid med, uanset klokken.** Ideen om at lade en snack lægge
sig til det nærmeste måltid blev overvejet og forkastet 9. august: så ville
morgenmaden pludselig vise 38 g når kunden kun havde tastet 32, og det er ikke
til at forstå.
- **Fliserne er foldet sammen.** Én linje uanset om der er 1 eller 13
  madvarer i måltidet. Medianen er 13 pr dag, så uden det ville siden være
  flere skærmlængder lang.
- **Datoen kan skiftes**, så hun kan taste noget hun glemte i går.
- **Er måltids-fokus aktivt**, vises kun de måltider Linn har åbnet.
  Fiber-kortet bliver stående.

**Det ligger bevidst IKKE på oversigten**, men inde i måltidet: søgning,
stregkode-scanner, det hun plejer, opskrifter, madplan, favoritter, egne
fødevarer og manuel tilføjelse. Prisen er at hun ikke kan hoppe direkte til
opskrifterne. Gevinsten er at oversigten aldrig bliver rodet, og at maden
altid lander rigtigt, fordi måltidet er valgt først.

**Egne fødevarer skal kunne søges i.** Én kunde har 143 af dem, så en liste
uden søgefelt er ubrugelig.

## 26.2 Mad, skærm 2: inde i måltidet. LÅST 9. august

Kunden har trykket på en flise, og alt indholdet hænger på den her skærm.
Udgave A valgt, med to rettelser.

**Øverst:** pil tilbage til oversigten og måltidets navn.

**Så datoen på sin egen linje**, med en pil i hver side. Kunden kan gå frem og
tilbage uden at forlade måltidet, så hun lander i samme måltid på den nye dag.
**Datoen skal have sin egen linje**, ikke stå ved siden af pilen tilbage.
Ellers står der to venstrepile på samme linje som betyder to forskellige ting.

**Så måltidets tal:** protein med mål og stribe, fiber uden mål og uden stribe,
kun tallet og teksten "i dagens 30".

**Så det hun allerede har lagt i måltidet.** Flyttet op hertil, så hun kan se
det uden at rulle. **Nyeste øverst**, og den lyser kort op i honning.
Tilføjer hun fire ting i træk, kan hun hver gang se at det hun lige trykkede
faktisk landede, uden at lede efter det i en liste.

**Så "det du plejer".** Fire fliser med hendes egne hyppigste madvarer til
netop det måltid, med den mængde hun plejer at bruge. Ét tryk, og maden er i
måltidet. Det dækker over halvdelen af alt hun taster, jf de 68,5 % i afsnit
24. Tre ting skal følge med, ellers virker det ikke: mængden huskes pr
madvare, listen er hendes egen og ikke en generel, og den nye kunde får de
mest brugte madvarer på tværs af alle kunder indtil hun har sine egne.

**Så ét søgefelt der leder i alt på én gang**, altså fødevarer, opskrifter,
favoritter og hendes egne, med et lille mærke der viser hvor tingen kommer
fra. Kunden skal ikke vide om "Grøn grød" er en opskrift eller en fødevare.
Stregkode-scanneren sidder i samme felt. Det løser samtidig kravet om at
egne fødevarer skal kunne søges i.

**Tre veje til at bladre:** opskrifter, favoritter og mine fødevarer.
Madplanen var oprindeligt den fjerde, men blev parkeret 11. august, se afsnit
26.

De vises som **runde ikoner på 44 px med navnet under**, farvet i to familier:
grøn er Linns ting, altså opskrifter, og blomme er kundens eget, altså
favoritter og mine fødevarer. **Farven bærer parringen**, så vi slipper for at
gruppere dem i layoutet og dermed slipper for et ekstra klik. Direkte veje i
stedet for grupper der hver åbner et valg.

**Navnet står altid med.** Ikoner alene er udelukket: et blyant-ikon betyder
ikke "mine fødevarer" for nogen der ikke har set det før, og målgruppen er
kvinder i 40erne og opefter. Af pladshensyn hedder den sidste "Mine".

**Alle fire åbner som et ark der glider op nedefra**, ikke som en ny side.
Måltidet bliver stående bagved, så kunden ikke mister fornemmelsen af hvad hun
var i gang med. Lukker hun arket, står hun præcis hvor hun slap.

**Plejer-fliserne holdes hvide.** Der er otte felter over hinanden på skærmen,
og får både plejer-fliserne og de fire veje farve, bliver det broget. Farven
bruges ét sted, ikke to.

**Måltidets tal:** protein med mål og stribe, fiber uden mål. Fiber er et
dagsmål og ikke et måltidsmål, så en stribe ville love noget der ikke findes.
Der står "i dagens 30" ved siden af fiber-tallet.

## 26.3 Mad, skærm 3: at registrere noget. LÅST 10. august

Alt hvad der sker inde i et måltid, når kunden vil have noget tilføjet.

### Fortryd, ikke bekræft

**Gennemgående regel i hele modulet:** handlingen sker med det samme, og
fortrydelsen er ét tryk væk. Der er ingen "er du sikker" nogen steder.

Grunden er målt: kunden registrerer 13 madvarer på en almindelig dag. Et
bekræftelses-trin ville fordoble antallet af klik på den vej der bruges mest.
Kvitteringen glider op nederst med navnet på det der skete, og forsvinder af
sig selv efter seks sekunder.

**Kvitteringen dækker begge veje.** Fortryd sletter enten det hun lige
tilføjede, eller gendanner det hun lige fjernede. Gendannelsen skriver
dokumentet tilbage med **samme id**, så madvaren lander præcis hvor den lå i
stedet for at hoppe øverst som noget nyt. Ellers ville en fortrudt fejl se ud
som en ny fejl.

**Kvitteringen nævner navnet.** Fordi "I dette måltid" ligger nederst på
skærmen, kan kunden ellers se *at* der skete noget, men ikke *hvad*.

### Tre veje ind

**1. Det du plejer.** Fire fliser med hendes egne hyppigste madvarer til netop
det måltid, med den mængde hun plejer. Ét tryk, og maden er registreret. Se
`content/plejer3.ts` for hvorfor det er modulets vigtigste del.

**2. Søgefeltet.** Fritekst i fødevare-databasen. Korteste navn først, så
"Skyr" kommer før "Skyr med vanilje". Valg åbner mængde-arket.

**3. De fire ikoner.** Opskrifter, madplan, favoritter og mine fødevarer.

### Mængde-arket

Glider op nedefra, så måltidet bliver stående bagved. En ny side ville koste
kunden fornemmelsen af hvad hun var i gang med.

- **Genveje først.** Madvarens egne portioner som knapper, med hendes
  sædvanlige mængde valgt på forhånd. Ni ud af ti gange er hun færdig her.
- **"Anden mængde" åbner plus og minus** med en enhed hun kan skifte. Linns
  valg 10. august, som en kombination af stepper og enhedsvalg.
- **Springet følger enheden**, godkendt 10. august: gram 5, styk og skive 1,
  spiseske og teske 1, deciliter og portion 0,5. Med 1 g pr tryk ville 40 til
  65 g være femogtyve tryk, og med 10 g kunne hun slet ikke ramme 65.
- **Tallet kan trykkes og tastes.** Plus og minus er hurtigst på små spring,
  men fra 5 til 200 g ville være niogtredive tryk. Feltet tager imod både
  komma og punktum, for begge dele bliver tastet.
- **Minus slukker ved det mindste** i stedet for at vise nul eller et negativt
  tal.
- **Tallene opdaterer sig levende** mens hun trykker. Det er halvdelen af
  pointen: hun lærer hvad 65 g havregryn giver, uden at nogen fortæller det.
- **Et kryds i hjørnet.** At trykke ved siden af arket lukker det også, men det
  er ikke til at gætte hvis man ikke ved det.

### De tre ark bag ikonerne

**Ét fælles ark** til opskrifter, favoritter og mine fødevarer, fordi de gør
det samme: viser en liste man kan søge i og vælge fra. Tre næsten ens ark ville
være tre steder at rette den samme fejl.

**Søgefeltet er altid der.** Én kunde har 143 egne fødevarer, og en liste uden
søgning er ubrugelig ved den størrelse. **Tastaturet springer ikke op af sig
selv**, for kunden vil oftest bladre først, og et tastatur ville dække
halvdelen af listen.

**De tre opfører sig forskelligt med vilje:**

- **Egne fødevarer** er almindelige madvarer og går gennem mængde-arket,
  præcis som et søgeresultat. Der skal stadig sættes en portion.
- **Favoritter** lægges direkte i. Kunden har selv sat dem sammen, så der er
  ikke noget nyt at se, og makroen er kendt.
- **Opskrifter SKAL kunne ses først.** En ret kan ikke vurderes ud fra titlen
  alene. Opskriften åbner i sit eget ark med billede, makro, ingredienser og
  fremgangsmåde. Antal portioner kan ændres i halve, og både makro og
  ingredienser skalerer med, fordi en halv portion er en almindelig mængde.
  Er der valgt andet end én portion, står det i navnet i dagbogen.

**Listerne hentes først når arket åbnes.** Ellers ville vi hente tre lister
hver gang kunden bare vil taste en banan.

### Sådan gemmes det

**Ét dokument pr madvare**, i samme form som den gamle app skriver, så begge
apps kan læse hinandens data. Det er også det der gør Fortryd præcis: den kan
slette netop det hun lige tilføjede uden at røre resten af måltidet.

Nye dokumenter får et tidsstempel. **De gamle har ingen**, og derfor kan
"nyeste øverst" kun virke fremadrettet. Poster uden tidsstempel falder bagerst
i stedet for at hoppe tilfældigt rundt.

**Historikken til "det du plejer" hentes én gang og huskes i ti minutter.** Et
opslag over 45 dage hver gang kunden åbner et måltid ville være spild, og
vaner ændrer sig ikke på et kvarter.

## 26.5 Udvidet næring: kulhydrat, fedt og kalorier

Linns beslutning 11. august, efter at have set de fire forslag.

### Hvor tallene står

**Protein og fiber står i kortet**, med striben mod de 30 g. Uændret. Det er
metodens tal, og de skal beholde deres vægt.

**Kulhydrat, fedt og kalorier står som en fri linje under kortet**, uden
baggrund, dæmpet. Udgave C af fire. Grunden til at den vandt: kortet beholder
sin vægt, og de tre andre føles som noget ekstra i stedet for som en del af
målet. Havde de stået inde i kortet, ville skærmen se ud som om alle fem tal
er lige vigtige.

**Samme opdeling i hver række under "I dette måltid":** mængde, protein og
fiber i normal farve, resten dæmpet bagefter. Og i mængde-arket når kunden
vælger en fødevare.

**Der står altid hvad tallene er.** Før stod der bare "5 g" ud for en madvare,
og man kunne ikke vide om de fem gram var protein, fiber eller vægten af
pastaen.

### Gemmes altid, vises efter adgang

**De tre tal gemmes ALTID når der registreres**, også for kunder der ikke må
se dem. Det er en bevidst beslutning, ikke et tilfælde.

Grunden: giver Linn en dag et hold adgang til udvidet næring, skal tallene
også være der for det de allerede har tastet. Ellers ville kunden få en
halvtom historik, og det ville ligne en fejl.

**Hvad der gemmes og hvad der vises er to forskellige ting.** Adgangen
afgøres i visningen. Rækker gemt før 11. august har ikke de tre felter. De
tæller nul med i summen i stedet for at vælte den, og felterne vises bare ikke
på den enkelte række.

### Hvem må se dem

**Linns regel 11. august:** Kickstart ser kun protein og fiber. Kropsro og
medlemmer ser det hele. Admin kan ændre det pr kundetype på
`/app/admin/feature-adgang`.

**Reglen er IKKE håndhævet endnu, og det er med vilje.** Skemaet siger i dag ja
til alle fire kundetyper, også Kickstart. Målt 11. august: **556 kunder har
Kickstart som seneste forløb, og 160 af dem har selv slået udvidet næring til**
og bruger den i den gamle app. De skal ikke miste noget uden varsel.

Reglen får først virkning den dag Linn ændrer skemaet i admin. Så gælder den
både i den gamle og den nye app, og hun bestemmer selv hvornår.

**Adgangen hentes i `firestore/featureAdgang3.ts`, ikke i skallen.** Første
forsøg lagde hentningen i `routes/ny/+layout.svelte`, altså det der omgiver
alle sider, og kort efter var appen helt blank uden at årsagen kunne findes.
Vi rullede tilbage og byggede det i mindre bidder. **Læg ikke noget nyt i
skallen uden en god grund.** Skemaet bruges ét sted og hentes ét sted, så en
fejl kun kan ramme måltidsskærmen.

## 26.4 To fælder i den nye flade, som kostede tid

Læs de her to inden du fejlsøger noget der ligner.

**Farverne forsvinder når noget flyttes ud af `.ny-app`.** Modaler og ark
flyttes til `document.body` for at bryde ud af en scrollende forælder på iOS.
Men tokens er defineret på `.ny-app`, så `var(--oat)` resolver til ingenting,
og arket bliver gennemsigtigt. Det skete for mængde-arket 10. august, og
challenge-stillingen havde samme fejl uden at nogen havde opdaget den.

**Løsningen:** tokens ligger nu på både `.ny-app` og `.ny-tokens`. Den sidste
bærer kun variablerne, ikke baggrund, farve og skrift. **Sæt `ny-tokens` på
rod-elementet i alt der portalles.**

**Knap-nulstillingen slog komponenternes egen stil ihjel.** `.ny-app button`
satte `font: inherit` og `background: none`, og reglen var stærkere end en
komponents egen klasse. Derfor mistede fliser deres baggrund og fik den
nedarvede skriftstørrelse i stedet for deres egen. Det så ud som tre
forskellige fejl.

**Løsningen:** reglen er pakket i `:where()`, så den er vægtløs. Skriver du en
ny global nulstilling, så gør det samme.

**`vh` gør ark højere end skærmen på mobil.** Mobilbrowsere regner `vh` ud som
om adresselinjen var væk. Et ark på 86vh blev derfor højere end det Linn kunne
se, og toppen med søgefelt og luk-kryds havnede uden for skærmen. Hun kunne
hverken søge eller lukke. `.op-ark` stod på 88vh og havde fejlen uden at nogen
havde ramt den endnu.

**Løsningen:** brug `dvh`, som er den SYNLIGE højde, med `vh` som reserve for
browsere uden `dvh`:

```css
height: 84vh;
height: 86dvh;
max-height: calc(100dvh - 10px);
```

Rettet 11. august på `.ol-ark`, `.ma-ark`, `.va-ark` og `.op-ark`. `.henter` og
`.side-ramme` bruger stadig `vh` med vilje, for de er ikke ark.

**Et valgfrit felt i en type kan skjule en filtrerings-fejl.** `Opskrift3` har
feltet `kategorier3`, men `filtrerOpskrifter3` læste `kategorier`. Feltet var
valgfrit, så TypeScript sagde ikke fra: tallet ud for Morgenmad stod rigtigt
på 24, men et tryk på knappen tømte skærmen. **Gør felter som en filtrering
afhænger af PÅKRÆVEDE**, se `FiltrerbarOpskrift`.

## 26.6 Opskrifter. LÅST 11. august

Skærmen bag Opskrifter-ikonet i måltidet, se 26.2. Alle tal herunder er målt
på de 130 aktive opskrifter 11. august.

### Gitteret

**To i bredden med farvet flise efter måltid.** Grøn er morgenmad, honning er
frokost, blomme er aftensmad, ler er snack, og andet er gråt.

**Titlen fylder tre linjer.** Medianen er 36 tegn og den længste 83, så én
linje ville klippe halvdelen midt i navnet. Prisen er fire opskrifter på
skærmen i stedet for seks. Det er den rigtige handel, for navnene er Linns
stemme.

**Billede og farve har samme plads og facon.** Flisens top er 62 px høj og
tager enten et foto eller en farvet bogstav-flise. Den dag der kommer flere
fotos, glider de ind uden at layoutet flytter sig. Dækker fotoet farven, står
måltidet som et lille mærkat i hjørnet.

**Gitteret skifter ikke facon når hun søger.** Fliserne bliver, der bliver
bare færre. Et layout der skifter under fingrene er forvirrende, især når man
leder efter noget bestemt. Linn afviste bevidst et forslag om at skifte til
én i bredden ved søgning.

### Søgningen, se `src/lib/content/opskriftSoeg3.ts`

**Der deles ved mellemrum, og alle ord skal findes, uanset rækkefølge.** Den
gamle app deler kun ved komma, så et mellemrum blev en del af ordet og der
blev ledt efter den præcise sætning. Otte almindelige to-ords-søgninger gav
ALLE nul træffere, fx "kylling broccoli" som der findes fire af. Enkelt-ord
giver præcis samme resultat som før, så intet forsvinder.

**Hver flise siger hvorfor den kom med.** 56% af alle træffere har ikke ordet
i titlen (149 i titel mod 188 kun i ingredienser eller beskrivelse). "tomat"
giver 35 træffere hvoraf 31 kun har ordet i ingredienslisten. Står ordet i
titlen, er det fremhævet. Ellers står der en lille linje: "broccoli i
ingredienser". Uden den ville over halvdelen af fliserne ligne en fejl.

**Danske bogstaver foldes til ae, oe og aa. IKKE til a, o, a** som
`klientSoegeMatch` i admin gør. Med a/o/a ville "æg" blive til "ag" og ramme
bagt, mager, lagkage og asparges. Tjekket på alle 36 æg-træffere: nul manglede
bogstavet. Sidegevinst: "aeg" og "groed" virker også.

**Ingen stavefejls-tolerance.** Besluttet med Linn. Høstakken er hele
ingredienslisten på flere hundrede tegn, og med to tilladte fejl i et langt
ord rammer den nærmest hvad som helst.

### Kategorier, se `src/lib/content/opskriftKategori3.ts`

**Snack er sin egen kategori i 3.0.** Den gamle indlæser folder snack, salat,
dessert og tilbehør sammen til "andet", så 15 snack-opskrifter ikke kunne
findes som snack. Den gamle må ikke rettes, så `opskrifter3.ts` læser de samme
dokumenter på ny.

**Salat, dessert og tilbehør foldes fortsat til Andet.** De er ikke måltider
på samme måde, og et filter der rammer fem opskrifter er ikke en knap værd.
Fordelingen er morgenmad 24, frokost 51, aftensmad 46, snack 15, andet 8.

**Ukendte værdier lander i Andet**, så en opskrift aldrig falder ud af alle
filtre og bliver usynlig.

**Farven følger filteret når der er filtreret.** Så er farven altid sand for
det hun kigger på. Ellers fast rækkefølge: morgenmad, frokost, aftensmad,
snack, andet.

### Filtrene ligger i eget ark, se `OpskriftFiltre.svelte`

Filtrene lå først som tre rækker knapper over listen. Overskrift, søgefelt og
filtre åd **215 px**, altså over en fjerdedel af arket, før den første
opskrift kom til syne. De ligger nu i et ark bag en knap ved siden af
søgefeltet, og hovedet er nede på **92 px**.

**Måltidet er forvalgt ud fra den skærm hun kom fra.** Åbner hun listen inde
fra Frokost, står den på frokost og hun møder 51 opskrifter i stedet for 130.
Hun står i køkkenet og skal bruge noget at spise nu, ikke bladre i et
opslagsværk. Det almindelige tilfælde koster nul tryk.

**Prisen ved at gemme filtre væk er at de bliver brugt mindre. Den betales
tre steder, så begrænsningen aldrig er usynlig:**

- overskriften siger "Opskrifter til frokost", ikke bare "Opskrifter"
- filter-knappen bærer et tal når der er filtre i brug
- "Vis alle 130" står ved overskriften, så vejen ud er ét tryk

Søgefeltet siger hvad hun søger i, og en tom skærm har altid en knap der
fjerner filtrene, så hun aldrig skal gætte hvad der står i vejen.

**Tallene ud for hvert filter tælles UDEN filteret selv**, så tallet siger
hvad hun får hvis hun trykker, ikke hvad hun allerede har.

### Billeder hører hjemme i Storage, aldrig i dokumentet

Opskrift-billederne lå som base64-tekst inde i selve Firestore-dokumentet. To
billeder vejede **189 KB, altså halvdelen af hele samlingens 379 KB**, og de
blev hentet hver gang listen blev åbnet, uanset om nogen rullede ned til dem.
Tinnas kyllingesalat vejede 99 KB hvor de 128 andre vejer 2-3 KB.

**Flyttet 11. august til `opskrifter/{filnavn}` i Firebase Storage.** Samlingen
vejer nu 195 KB. Den gamle app henter de samme opskrifter i Biblioteket og
30-30-3, så alle kunder fik den samme forbedring.

Dokumentet har nu `billedeUrl` med en adresse og `billedeSti` med filens sti.
Storage-reglen står i `storage.rules` under `/opskrifter/`. Sikkerhedskopi af
de gamle værdier ligger i `backup/`, som er uden for git.

**Læg aldrig et billede ind i et Firestore-dokument igen.** Læg det i Storage
og gem adressen.

**Etape-hentning blev vurderet og fravalgt.** Efter flytningen var listen hurtig
nok, og maskineriet ville koste kompleksitet for altid. Firestore-klienten kan
i øvrigt ikke hente et dokument uden ét felt: man får hele dokumentet eller
ingenting. Kun `src/lib/server/firestoreRest.ts` kan bede om bestemte felter,
og det ville kræve et endpoint plus tabt offline-cache.

## 26.7 Billede-upload i admin. LÅST 11. august

Siden ligger på `/ny/admin/opskrift-billeder`. Den gamle admin-side under
`app/admin/opskrifter` må ikke røres, og der står stadig at upload tilføjes
senere. Intet menupunkt, samme løsning som challenges.

### To størrelser, og hvorfor

Beslutningen kom af et spørgsmål fra Linn: "vi kan lige så godt sørge for at
forberede appen til 130+ billeder". Det første forslag var én størrelse, og
det var forkert. Målt på hvad der FAKTISK vises:

| Hvor | Vist størrelse | På en 3x-skærm |
|---|---|---|
| 3.0 flise i gitteret | 170 × 62 | 510 px |
| 3.0 opskrift-arket | fuld bredde × 150 | 1170 px |
| Gammel bibliotek | 56 × 56 | 168 px |
| Gammel 30-30-3 liste | fuld bredde, 4:3 | ~1080 px |
| Gammel opskrift-side | beder om 800 | ~1170 px |

Flisen er 62 px høj. At sende et 1200 px billede til den er som at sende en
plakat for at vise et frimærke.

| | Bredde | Vejer | Felt | Bruges af |
|---|---|---|---|---|
| Lille | 480 px | ~17 KB | `billedeUrlLille` (nyt) | 3.0 fliserne i gitteret |
| Stor | 1000 px | ~38 KB | `billedeUrl` | 3.0 opskrift-arket og hele den gamle app |

**Ved 130 billeder:** første skærm i listen koster 150 KB i stedet for 420, og
hele listen 2,2 MB i stedet for 9,1.

**Den store bliver liggende i `billedeUrl`, og det er ikke tilfældigt.** Den
gamle opskrift-side beder specifikt om 800 px, og dens liste viser billedet i
fuld bredde. Gjorde man det felt lille, ville **760 kunder i drift få slørede
billeder**. Det nye felt er additivt, og den gamle app opdager ingenting.

**Den store er 1000 px og ikke 1200** af hensyn til den gamle app. Dens
opskriftliste viser billeder i fuld bredde, og når der kommer 130, bliver den
liste tung for kunderne. Filen må ikke ændres, så det eneste vi kan gøre er at
holde filen så let som muligt. **Det er en kendt omkostning ved at tilføje
billeder overhovedet, ikke en fejl.**

### WebP med sikkerhedsnet

WebP fylder cirka 30 % mindre end JPEG ved samme kvalitet.

**Fælden:** beder man en browser der ikke kan WebP om WebP, får man ikke en
fejl. Man får en **PNG**, som er større end den JPEG man ville have haft. Man
tror man har sparet og har gjort det værre.

`formatDuger()` spørger hvad der faktisk kom ud, og koden laver en JPEG hvis
svaret ikke er WebP. Der er tests på begge veje.

### Én ret ad gangen

Det første forslag havde bulk-upload: slip 20 filer, og appen gætter hvilken
opskrift hver fil hører til ud fra filnavnet.

**Linn droppede det**, og med rette. Gættet bygger på at filerne hedder noget i
retning af `gron-grod.jpg`. Men fotograferer man en ret, hedder filen
`IMG_4821.jpg`, og så kan gættet ikke bruges til noget. **Genopfind det ikke
uden at spørge.**

### Se først, gem bagefter

Når filen er valgt, vises billedet i **flisens naturlige størrelse**, 170 × 62,
og i opskrift-arkets 150 px høje bånd. Ikke som ét stort billede.

**Det er hele pointen.** Flisen er kun 62 px høj, så hovedet på en rejecocktail
kan sagtens blive skåret af uden at man opdager det på et stort billede.
**Fjern ikke den forhåndsvisning.**

Under står hvad der skete med filen: `2,4 MB · 4032 × 3024 → 480 px 17 KB webp
+ 1000 px 38 KB webp · sparet 98 %`.

### Rækkefølge og oprydning

**Filerne uploades FØR dokumentet opdateres.** Går noget galt midtvejs, står
det gamle billede stadig i Firestore og opskriften virker som før.

**Gamle filer slettes til sidst**, men kun hvis det nye filnavn er et andet.
Skifter man et jpeg ud med et webp, får den nye fil et andet navn, og det
gamle skal væk. Ellers samler der sig filer ingen bruger, og om et år tør
ingen rydde op fordi ingen ved hvad der er i brug.

**Fjern spørger først**, fordi den også sletter i Storage.

**Begge apper får ryddet deres cache** efter en ændring. Uden det ville
billedet først dukke op ved en genindlæsning, og så tror man at uploaden
mislykkedes.

### Smal først

Siden er bygget til en telefon og bliver bredere på en laptop. Grunden er at
billedet ligger i telefonen lige efter maden er lavet. Se
`@media (min-width: 720px)` i `ny.css`.

### To kendte kanter

**HEIC fra iPhone kan ikke åbnes i Chrome på Mac.** Vælges billedet på selve
telefonen, laver iOS det om til jpeg undervejs. Sker det alligevel, får man en
besked der siger netop det, ikke en teknisk fejl.

**Ryddes URL-feltet i den GAMLE admin**, forsvinder den store men ikke den
lille, og så viser 3.0 et billede hvor den gamle app ikke gør. Brug Fjern på
den nye side i stedet, den rydder begge dele plus filerne.

### Status

**De to billeder fra flytningen har kun den store udgave.** De markeres "kun
stor udgave" i listen. De virker, men fliserne henter 38 KB hvor de kunne nøjes
med 17. Det retter sig når billedet lægges på igen.

## 26.8 Favorit på opskrifter. LÅST 12. august

Kunden kan markere en opskrift som favorit og finde den igen på en egen fane.
Bygget i to bidder, se `favoritOpskrift3.ts`.

### Målingerne der kom først

Opgaven startede et andet sted. Spørgsmålet var hvordan en opskrift kunne
gentages, fordi 30-30 hviler på at 68,5 % af alt kunderne registrerer er en
gentagelse, og den regel slet ikke var anvendt på opskrifter. En måling på
9.347 måltider fra 204 aktive kunder over 60 dage flyttede så hele samtalen:

| Tal | Hvad det betyder |
|---|---|
| **62 %** af opskrift-registreringer er gentagelser | Mekanikken er sund. En opskrift bruges typisk 3 gange, en enkelt kunde 26 gange |
| **0,9 %** af alt registreret er en opskrift | 249 ud af 28.319 linjer. Vi taler om at gøre noget nemmere som knap nogen gør |
| **23 %** af kunderne har brugt en opskrift | 46 af 204 |
| **86 %** af kunderne har favoritter | 2.905 favoritter fordelt på 366 kunder, median 4 |

**Konklusionen var ikke den forventede.** Favoritter er den suverænt mest brugte
hylde i modulet, og opskrifter en af de mindst brugte. Derfor blev genvejen
bygget dér hvor kunden allerede er, i stedet for som en ny hylde eller som en
femte plejer-flise.

**Fravalgt undervejs:** at lade opskrifter konkurrere om de fire
plejer-fliser. Målingen viste at en opskrift kun ville nå top fire i 58 % af
tilfældene, og tallet er endda for optimistisk, fordi de kunder der bruger
opskrifter taster få enkelte madvarer og derfor har lidt at konkurrere med.

### En favorit er et BOGMÆRKE, ikke et gemt måltid

Den vigtigste beslutning, og den kom af et andet svar.

Linn valgte at et tryk på en favorit skal **åbne opskriften som i dag**, så hun
kan sætte portioner. Dermed skal protein og fiber ikke kopieres nogen steder
hen. Makroen læses fra opskriften i det øjeblik hun trykker "Læg i", altså den
kode der allerede kørte.

**Det var ikke en detalje.** Var favoritten i stedet gemt som et færdigt måltid
i `favoritmaaltider`, ville makroen skulle med, og den samling har ikke plads
til den: den gemmer kun navn og varelinjer, og protein og fiber regnes ud ved
at slå hver linje op. En opskrift har ingen linjer der kan slås op. En
favorit-opskrift ville derfor **stille og roligt logge 0 g protein og 0 g
fiber** i et modul der handler om præcis de to tal.

Bemærk at det problem allerede findes i drift: **178 af de 2.905 favoritter,
altså 6 %, indeholder mindst én manuel linje uden makro.** De kunder logger
mindre end de spiste. Det er en grænse i den gamle model, ikke en fejl vi har
lavet, og det er ikke løst her.

### Hvor bogmærkerne ligger

`userDoc.favoritOpskrifter`, et array af opskrift-id'er. Samme mønster som
`favoritFodevarer` der allerede findes i den gamle app, så der er ikke opfundet
noget nyt. Feltet er additivt og den gamle app læser det ikke.

`arrayUnion` og `arrayRemove` i stedet for at skrive hele listen, så to enheder
kan markere hver sin opskrift samtidig uden at overskrive hinanden.

**Der skal intet udgives i Firebase Console.** Reglerne tillader i forvejen at
kunden skriver sit eget dokument og validerer ikke felter, se `firestore.rules`
linje 19. Tjekket 12. august.

**`lib/types.ts` er IKKE ændret**, selv om feltet er nyt. Filen er delt med den
app der er i drift. Feltet læses derfor gennem `favoritterFra()`, så castet
ligger ét sted og er testet, herunder at det tåler et manglende felt, forkert
type, dubletter og mellemrum.

### Hjertet, se `OpskriftArk.svelte`

**Det sidder til højre for "Læg i måltid", ikke oppe i hjørnet ved krydset.**
Linns valg 12. august ud fra fire tegnede forslag. Hånden er der i forvejen.
Fyldt hjerte bruger samme blomme som knappen ved siden af, så de to tydeligt
hører sammen og hjertet ikke ligner en anden slags handling.

**Hjertet skifter med det samme og venter ikke på serveren.** Fejler
skrivningen, rulles visningen tilbage. Der vises ingen fejlbesked: hun har ikke
mistet noget, og et bogmærke er ikke vigtigt nok til at afbryde hende midt i at
registrere mad.

**Knappens navn skifter med vilje ikke med tilstanden.** Den er en kontakt, og
tilstanden meldes af `aria-pressed`, så VoiceOver siger "Favorit, til" og
"Favorit, fra". Første udgave skiftede navnet med, og så blev både handling og
tilstand læst op på én gang.

### Fanerne, se `OpskriftListe.svelte`

**Alle er forvalgt**, så hun lander præcis hvor hun landede før favoritterne
fandtes, og intet ændrer sig for den der ikke bruger dem.

**Fanen er bygget som endnu et filter, lagt først.** Derfor virker måltid, kost
og søgning nøjagtig ens på begge faner, uden at nogen af dem skal vide at
fanerne findes. Alt regnes ud fra `grundliste`.

**Tallet på hver fane er det SAMLEDE antal**, ikke det måltids-filtrerede,
præcis som "Alle 130" også er totalen.

**Måltids-forvalget gælder BEGGE faner.** Linns valg 12. august, hvor hun
vendte forslaget om at favoritter skulle vises på tværs af måltider. Det holder
de to faner konsekvente, så begrænsningen betyder det samme hvor hun end står.

**Den beslutning skabte en ny tilstand:** hun kan have seks favoritter og se en
tom skærm, fordi ingen af dem er markeret til det måltid hun kom fra. Derfor er
"Vis alle N" nødvendig på Favoritter, og derfor siger den tomme tekst hvor
mange hun har i alt. Uden det ville tallet på fanen modsige skærmen.

**Tre tomme tilstande, og de er ikke ens:**

| Tilstand | Hvad der står, og hvorfor |
|---|---|
| Ingen favoritter overhovedet | Fortæller hvor hjertet sidder, med en vej tilbage til alle opskrifter. Der er intet filter at rydde, så "Vis alle" ville være forkert |
| Favoritter, men ingen til måltidet | Antal i alt plus "Vis alle N" |
| Søgning uden træffere | Siger favoritter i stedet for opskrifter når hun står på den fane |

**Rækkefølgen på fanen Favoritter er listens, ikke bogmærkernes.**
Opskrift-listen er alfabetisk, og den orden skal ikke skifte fordi hun står et
andet sted. Ellers ville de samme seks retter ligge to forskellige steder
afhængigt af fanen.

**Fanerne bruger `role="group"` med `aria-pressed`, ikke `tablist` og `tab`.**
De rigtige fane-roller lover en skærmlæser at der hører et panel til hver fane,
og at piletasterne skifter mellem dem. Det er ikke bygget, og et løfte vi ikke
holder er værre end ingen rolle. Det er også samme mønster som
filter-knapperne bruger.

### Hvad der ikke blev bygget

~~Der er stadig ingen vej til at gemme et MÅLTID som favorit i 3.0.~~
**Klaret senere samme dag, se 26.10.** Hylden hedder nu Faste måltider, netop
for at de to slags favoritter ikke hedder det samme: hjertet på en opskrift er
et bogmærke på `userDoc.favoritOpskrifter`, et fast måltid er varelinjer i
`favoritmaaltider`.

## 26.9 Portioner og makro. LÅST 12. august

Dagens vigtigste fund, og det eneste sted hvor de to apps skrev forskellige tal
i kundens dagbog for den samme handling.

### De to konventioner, som alt hviler på

**1. Makroen er PR PORTION.** Altid, også på de opskrifter der er skrevet til
fire. Målt 12. august på alle 130.

**2. Ingredienslisten rækker til `defaultPortioner`.** De 8 flerportioners har
500 til 800 g kød, de 122 énportioners har 50 til 250 g.

Deraf følger reglen i én sætning: **`defaultPortioner` bruges på
ingredienserne og ALDRIG på makroen.**

**Sådan blev det bevist**, for det var ikke oplagt:

- De 8 flerportioners ligger i **samme leje** som de 122, altså protein median
  38 mod 30 g. Var tallet for hele retten, skulle de ligge fire gange højere
- "Kylling med broccoli" erklærer 475 kcal, mens råvarerne alene er omkring
  1.400. Tallet **kan** altså ikke dække hele retten
- Kalorier stemmer med protein, kulhydrat og fedt inden for 10 % på 103 af 130,
  median 6 % afvigelse. Makro-blokken er troværdig i sig selv

### Fejlen den afdækkede

Reglen var spredt ud over tre skærme i to apps, og de var uenige:

| Sted | Makro | Ingredienser |
|---|---|---|
| Gammel app, opskrift-side | **Deler** med `defaultPortioner` | Rigtigt |
| Gammel app, madplan-vej | Ganger ikke, deler ikke | Ikke relevant |
| 3.0, opskrift-ark | Rigtigt | **Gangede** uden at dele |

På de 122 énportioners gav det samme svar, for at dele med 1 ændrer ingenting.
På de 8 gav det svar der lå 2, 4 og 12 gange fra hinanden. En kunde fik
krediteret 12 g protein hvor hun spiste 48.

**3.0 er rettet 12. august.** Regnereglen ligger nu ét sted, i
`content/opskriftPortion3.ts` med 14 tests, og kommentaren i filens hoved
bærer målingerne, så den næste ikke skal regne det ud forfra.

**Den gamle app er IKKE rettet.** Se 27.

### Arket åbner ALTID på én portion. OMGJORT 13. august

**Den her beslutning blev vendt.** Frem til 13. august åbnede arket på
opskriftens eget tal, altså 1 for de fleste og 4 for familieretterne, så
ingredienslisten kunne læses direkte som opskrift. Det var Linns valg 12.
august efter fire tegnede forslag.

**Nu åbner den altid på én portion.** Linns valg 13. august, og begrundelsen er
stærkere end den oprindelige:

- **Spørgsmålet i arket er "hvor meget spiste du".** Det almindelige svar er én
  portion, ikke hele gryden
- **Starttallet er også dét der gemmes.** Åbnede arket på 4, og hun ikke
  opdagede det, ville hun logge fire gange for meget
- **Opskriftens eget tal er en oplysning hun ikke skal bruge til noget.**
  Ingredienserne skalerer med det antal hun vælger, så ved 1 portion står der
  75 g linser i stedet for 150. Det ER en opskrift til én person

Jeg foreslog at skrive "Opskriften rækker til 2 portioner" på skærmen som
oplysning. **Linn afviste det, og hun havde ret:** når mængderne følger det
valgte antal, er opskriftens egen ydelse en intern detalje.

Gem-knappen siger stadig antallet når det ikke er 1, altså "Læg 2 portioner i
aftensmad", for da har hun selv skruet op.

**En fælde der kostede fire faldne tests undervejs:** `startPortioner` gjorde
TO ting. Den sagde både hvad arket åbner på OG hvad ingredienslisten er skrevet
til. Da den blev sat til altid at give 1, troede `ingrediensMaengde` at alle
lister var skrevet til én portion, så 600 g kylling i en ret til fire blev til
2.400 g. De to hedder nu `startPortioner` og `listenErSkrevetTil`, og de må
aldrig smelte sammen igen.

### Alle fem tal, og de gemmes altid

Opskrift-arket var den sidste flade der kun kendte protein og fiber. Kulhydrat
og fedt står nu dæmpet på samme linje, kalorier for sig under, og det hele er
skjult uden udvidet næring. Samme opdeling som mængde-arket, se 26.5. Rækken
ombryder, for fire tal kan ikke stå på én linje på en iPhone SE.

**`gemSammensat` gemte kun protein og fiber.** Almindelige madvarer har hele
tiden gemt alle fem, så opskrifter og favoritter brød en regel resten af
modulet fulgte. Rettet 12. august. Rækker gemt før da har ikke felterne og
tæller nul med, som beskrevet i 26.5.

### Makro-linjen er væk fra fremgangsmåden

Tallene lå som en tekstlinje nederst i `instruktioner` og blev vist råt, så
kunden læste dem to gange, anden gang som en teknisk streng midt i
madlavningen.

**Data er urørt.** Linjen ER kilden til alle fem tal. Slettes den, mister alle
130 opskrifter deres næringstal i begge apps. Den klippes derfor kun ud af
visningen, se `content/opskriftTekst3.ts`.

**Tiden trækkes ud og vises ved titlen** med et lille ur. Den lå inde i samme
linje og ville ellers være røget med. 129 af 130 har feltet.

### Trinnene står hver for sig

Fremgangsmåden var én blok, så trinnene løb sammen. **Opskrifterne er ikke
skrevet ens:** nogle har hvert trin på sin egen linje, andre har alle fire i
én lang linje. Derfor deles der på selve numrene og ikke på linjeskift.

**Reglen kan ikke ødelægge en sætning.** Kun en række der begynder på 1 og
tæller ét op accepteres, så "hvile i 5 minutter", "mindst 3 timer" og "skær
kålen i 4" ikke åbner falske trin. Der er test på alle tre. Nummererede trin
får hængende indrykning, så tallene står frit i venstre kant.

### Gennemgang af makro-tallene, 12. august

Alle 130 er gennemgået. **Ingen umulige tal**, ingen med mere fiber end
kulhydrat, og protein udgør 28 % af kalorierne i median.

**En prøve blev kasseret.** Et forsøg på at regne makro af råvarerne og
sammenligne pegede på 59 opskrifter som forkerte. **De er det ikke.**
Fødevare-databasen har både tørre og kogte udgaver, og matcheren valgte
systematisk den tørre: "kikærter" blev til *tørrede, rå* med 337 kcal, og
"bouillon" blev til *koncentreret terning*, så 300 g suppe blev til 480 kcal.
**Skriv ikke den prøve igen uden at koble ingredienserne til bestemte
fødevarer.**

**Én rigtig fejl fundet og rettet:** "Den grønne grød - isterninger" havde
hele holdets makro stående som om det var pr terning. De to grønne grød har
fuldstændig identiske ingredienslister, og tallene var kopieret over uden at
blive delt med 12. I 3.0 stod der derfor 144 g protein og 4.800 kcal ud for
75 g avocado. Rettet i data 12. august efter tørløb, med sikkerhedskopi i
`backup/`. Kontrol mod råvarerne: ingredienserne giver cirka 12,4 g protein og
380 kcal, så holdets tal var rigtige, kun delingen manglede.

## 26.10 Faste måltider. LÅST 12. august

Kunden kan gemme det måltid hun lige har tastet, og lægge det i igen med ét
tryk. Det den gamle app kalder "byg måltid" og gemmer i `favoritmaaltider`.

### Målingerne der kom først

En læs-kun måling af alle 616 kunder 12. august, med brug målt over 90 dage.

| Tal | Hvad det betyder |
|---|---|
| **2.905** faste måltider hos **365** kunder, 59 % | Den mest brugte hylde i modulet. Median 4 pr kunde, højeste 60 |
| Median **5** varelinjer, men **33 %** har kun ÉN | De 945 med én linje er ikke måltider, de er genveje til en madvare |
| **49 %** af dem med to linjer eller flere er brugt | Målt strengt, se nedenfor. Det er et gulv, ikke et facit |
| **76 %** bruges ALTID til det samme måltid | Derfor skal måltidstypen med |
| **48 %** af al brug er morgenmad, aftensmad kun 9 % | Knappen skal virke bedst på morgenmaden |
| Kun **3 %** er nogensinde redigeret | Derfor er der ingen redigér-skærm |

**Om de 49 %, og hvorfor tallet ikke er skarpere.** Vi kan ikke se i data om
hun trykkede på en favorit. Vi kan kun se om der ligger et måltid med de samme
varelinjer. Retter hun én ting undervejs, tæller det ikke med. Den løse
måling, hvor kun navnene blev sammenlignet, sagde 83 %, men den tæller også
alt hvad der bare hedder "Morgenmad", og det gør 739 af de 2.905. Sandheden
ligger imellem. **Skriv ikke navne-målingen igen og tro på den.**

### De seks beslutninger

**1. Det hedder Faste måltider.** Ordet favorit er reserveret til hjertet på
opskrifter, se 26.8. To ting med samme navn i samme modul er en fælde.

**2. Et fast måltid må gerne være én madvare.** Linns valg, som vendte
forslaget om at skjule de 945. Følgen er at den samme skyr kan stå to steder
på skærmen på én gang, både som flise under "Det du plejer" og på hylden.
Måltids-inddelingen og mest brugte øverst holder det nede.

**3. Knappen står OVER den første ingrediens**, lige under overskriften "I
dette måltid". Linns valg, og begrundelsen er god: ligger den under listen,
falder den uden for skærmen så snart måltidet fylder noget, og en knap man
skal rulle efter bliver aldrig brugt. En fjerdedel af de faste måltider har
mellem syv og ti ting i sig. Prisen er at hun ser knappen før sin mad.

**Knappen findes kun når der er noget at gemme**, og den skjuler sig igen mens
båndet står der, for så er spørgsmålet et andet.

**4. Det lægges i som ÉN LINJE PR MADVARE**, ikke som én samlet linje.

Det er den vigtigste ændring, for den retter noget der allerede var galt. Før
12. august lagde 3.0 en favorit i som én linje med de fem tal lagt sammen, og
det havde tre følger: hun kunne ikke fjerne én enkelt ting, en linje uden
makro talte lydløst nul, og **"Det du plejer" lærte ingenting**. Brugte hun
genvejen hver morgen, blev hendes fire fliser ved med at være tomme, fordi de
tæller `foodId` og den samlede linje ikke har nogen.

**5. Retter hun i det bagefter, spørger et blødt bånd** om det faste måltid
skal opdateres. Linns idé, og den erstatter en redigér-skærm med noget bedre:
hun vedligeholder listen mens hun bruger den. Det forklarer også hvorfor kun
3 % nogensinde har redigeret i den gamle app, hvor funktionen ligger et sted
hun aldrig kommer forbi.

**Et bånd og IKKE en pop-up.** En pop-up ville lægge sig hen over
kvitteringen med Fortryd, og det er præcis den knap hun skal bruge hvis hun
kom til at fjerne noget ved et uheld.

**Tre regler, og de er der for at beskytte hendes eget måltid:**

- vi spørger **én gang**, ikke pr ændring
- standarden er **kun i dag**. Gør hun ingenting, sker der ingenting
- der står **fremover** i teksten, så det er tydeligt at det gælder alle de
  næste dage og ikke dagens registrering

De fleste ændringer er engangs-ting. Hun har ikke flere blåbær i dag, men i
morgen har hun. Et "opdatér" der lyser mest ville langsomt tygge hendes eget
faste måltid i stykker uden at nogen opdagede det.

**6. Sletning sker på kortet i hylden**, med et kryds der spørger først. Det
er med vilje anderledes end resten af modulet, hvor handlingen sker straks og
Fortryd er ét tryk væk. Her er der ingen Fortryd, og hun mister noget hun selv
har bygget. Bekræftelsen ligger inde i selve rækken og ikke i en boks ovenpå,
fordi arket er portalled ud af `.ny-app`.

### Tre fælder i koden

**En linje uden `foodId` kan ikke gemmes.** En opskrift har ingen enkelte
varer at slå op, så makroen ville blive nul. Arket siger det højt i stedet for
at droppe linjen i stilhed. Det er præcis den fejl der findes på **178 af de
2.905 i drift**, hvor kunden logger mindre end hun spiste. Den er ikke løst
her, se ventelisten.

**Båndet må ikke spørge om noget hun ikke har gjort.** To steder:

- `foerIds` husker hvad der lå i måltidet FØR hun lagde det faste måltid i.
  Uden dem ville en æggemad hun tastede i forvejen blive regnet som en del af
  hendes morgengrød
- er en madvare forsvundet fra databasen, springes den over, og så holder vi
  slet ikke øje. Ellers ville båndet spørge med det samme om hun ville gemme
  måltidet uden den linje, og et ja ville klippe hendes faste måltid ned

**Vi holder kun øje så længe hun bliver på skærmen.** Lukker hun appen og
fjerner noget tre dage senere, spørger vi ikke. Hun kan alligevel ikke huske
hvad hun lagde i, og et spørgsmål om noget hun ikke kan huske er værre end
intet spørgsmål.

### Hvordan brug tælles

Den gamle app skriver ét dokument med alle linjerne i, 3.0 skriver ét pr
madvare. Derfor kan vi ikke sammenligne dokument for dokument. Vi lægger hele
dagens måltid sammen først, og et fast måltid tæller med hvis ALLE dets
madvarer står der. At der også står en banan ved siden af betyder ikke at hun
ikke brugte det. Der er test på begge former, så de to apper aldrig kan give
hvert sit svar.

Tallet tælles på de 45 dage `plejer3` henter i forvejen, derfor står der
"brugt 12 gange **på det seneste**". Historikken fik et frivilligt `dato`-felt
netop for det, så de 45 dage kun hentes én gang.

### Hvor det ligger

Vi bliver i den gamle samling `users/{uid}/favoritmaaltider`, så et fast
måltid lavet i 3.0 også virker i den app der er i drift, og de 2.905 der
findes virker i 3.0 fra dag ét. Feltet `maaltid` er nyt og additivt, og de
gamle har det ikke. Derfor gættes måltidstypen ud af hendes egen historik når
feltet mangler, og det rammer som regel, fordi 76 % altid bruges til det
samme. **Der skal intet udgives i Firebase Console**, reglerne tillader det i
forvejen, se `firestore.rules` linje 62. Tjekket 12. august.

| Fil | Hvad | Tests |
|---|---|---|
| `content/fasteMaaltider3.ts` | Reglerne, sorteringen og båndets betingelse | 36 |
| `firestore/fasteMaaltider3.ts` | Læsning og skrivning | |
| `components/ny/FasteMaaltiderArk.svelte` | Hylden | |
| `components/ny/GemFastMaaltidArk.svelte` | Gem-arket | |

### En fælde i arbejdsformen, ikke i koden

Første udgave så halvfærdig ud på skærmen: arket åbnede tomt uden en eneste
fejl. Årsagen var at komponenten var skrevet, testet og **importeret, men
aldrig sat ind i markup**. Det gamle Vælg-ark åbnede i stedet, med den nye
titel på og uden en tom tekst at vise. Hverken `svelte-check` eller testene
fanger det, for koden er korrekt, den bliver bare aldrig brugt. **Tjek at en
ny komponent faktisk står i markup, ikke kun at den er importeret.**

## 26.11 Mine opskrifter. LÅST 12. august

Kundens egne opskrifter, altså dem hun har fotograferet og fået AI'en til at
læse. De lå i den gamle app og fandtes slet ikke i 3.0. Afsnit 23 havde
noteret at de skulle have enten en plads eller et bevidst nej, og de havde
fået ingen af delene. Det blev opdaget fordi Linn spurgte.

### Målingerne der kom først

Læs-kun måling af alle 616 kunder 12. august, brug målt over 90 dage.

| Tal | Hvad det betyder |
|---|---|
| **222** egne opskrifter hos **53** kunder, 9 % | En minoritets-funktion. Median 2 pr kunde, en enkelt har 27 |
| **87 %** af de 53 har logget en af deres egne | Men de der har dem, bruger dem |
| **9 %** af alt de taster er en egen opskrift | Til sammenligning: hele Linns bibliotek er **0,9 %** af alt der registreres |
| **100 %** har et foto | Af Linns 130 har 2 |
| **71 %** af de 222 er brugt mindst én gang | Kvaliteten er høj: alle har ingredienser, én mangler protein |
| **24 %** er rettet efter oprettelsen | Derfor skal hun kunne rette |

**Det tal der vendte samtalen er de 9 mod 0,9.** Hendes egne opskrifter bruges
cirka ti gange så meget som hele Linns bibliotek gør. Fotoet er formentlig en
del af forklaringen, og det peger tilbage på at 128 af de 130 mangler et
billede, se ventelisten.

**Det tal der styrer designet er derimod de 91 %** der ingen egne har. For dem
må intet ændre sig. Derfor findes fanen slet ikke når hun ingen har.

**En fælde i selve målingen, værd at kende:** feltet `opdateret` sættes også
ved oprettelsen, se `opretMinOpskrift`. Første kørsel sagde derfor at 100 % var
rettet. En rigtig rettelse er først når `opdateret` og `oprettet` er
forskellige, og så er tallet 24 %.

### De fire beslutninger

**1. En tredje fane i opskrift-listen**, ved siden af Alle og Favoritter. Linns
valg 12. august ud fra fire tegnede forslag. De tre fravalgte var: alt i ét
blandet gitter, hendes ting samlet under "Mine", og et fjerde ikon. Det sidste
blev valgt fra fordi ikon-rækken er den dyreste plads i modulet, og 9 % af
kunderne skal ikke have en fjerdedel af den.

**2. Kunden sætter selv måltidet**, og hun må vælge flere. Linns idé, og den er
bedre end de to jeg foreslog, som begge byggede på et gæt. En suppe er tit både
frokost og aftensmad. Kategorierne er **de samme fem som på Linns opskrifter og
i samme feltform**, så hendes egne løber gennem præcis den samme søgning og de
samme filtre. Der er ikke én undtagelse i filter-koden.

**3. Hun skal kunne rette det bagefter.** Linns tilføjelse. Uden den ville de
222 der findes aldrig kunne få et måltid, for de har ingen og kan ikke få et af
sig selv. Måltiderne gemmes med det samme når hun trykker på en chip, præcis som
hjertet på Linns opskrifter, og rulles tilbage uden fejlbesked hvis skrivningen
går galt.

**4. Rette, slette og oprette skal alt sammen med.** Linns valg, hvor hun
vendte mit forslag om at nøjes med at finde og logge. Bygget i tre bidder samme
dag: finde og logge, så rette og slette, så oprette med kamera og AI.

### Rediger-arket bruges to steder

`RetOpskriftArk` arbejder på et **udkast** og ikke på dokumentet, fordi den
samme skærm bruges både når hun retter en opskrift hun har, og når hun
gennemgår det AI'en har læst af et billede. Så bygges og vedligeholdes den ét
sted.

**Felterne er tekst mens hun skriver, ikke tal.** Et talfelt der bliver til NaN
midt i en indtastning er en klassisk måde at tabe det hun har skrevet på. Dansk
komma virker, og "1," midt i "1,5" giver 1 og ikke nul, så hendes tal ikke
nulstilles mens hun skriver det.

### At oprette en ny

**Hun gennemgår ALTID svaret før der gemmes noget.** AI'en gætter makro ud fra
et billede, og et gæt der lander direkte i dagbogen uden at hun har set det
ville være den forkerte slags automatik i et modul der handler om præcis to
tal.

**Knappen ligger ved fanerne og findes også når hun ingen egne har.** Ellers
kunne den første aldrig laves, for Mine-fanen findes jo ikke endnu.

**Alt hvad AI'en svarer læses defensivt**, se `fraAiSvar`. Mangler navnet, får
den et. Kommer tallene som tekst, læses de alligevel. Er der ingen
ingredienser, får hun en tom linje at skrive i. Svaret er skrevet af en model
og ikke af vores kode, og hun har lige taget et billede hun ikke vil miste.

**Billedet lægges op FØR dokumentet skrives.** Fejler uploaden, findes der ingen
halv opskrift uden billede. Fejler dokumentet, ligger der en forældreløs fil i
Storage, og det er den billige af de to fejl. Samme rækkefølge som
billed-uploaden i admin, se 26.7.

**Funktionen er styret af `ai-opskrift`** og deler daglig kvote med Linn AI,
fordi det er det samme endpoint. Det er den gamle apps regler, og de er ikke
rørt.

### Et foto af retten, til flisen

**Det erstatter ikke opskrift-fotoet, det får selskab.** `billedeUrl` er fotoet
af selve opskriften, altså kogebogssiden eller skærmbilledet AI'en læste. Da
der **ikke gemmes nogen fremgangsmåde** nogen steder, er det billede hendes
eneste opskrift på hvordan retten laves. Blev det skiftet ud med et foto af
maden, ville hun miste metoden uden at nogen sagde det. Derfor ligger fotoet af
retten i egne felter, `madBilledeUrl` og de tre der hører til.

**To størrelser, samme grund som på Linns opskrifter, se 26.7.** Flisen er
62 px høj, og at sende et 1000 px billede til den er som at sende en plakat for
at vise et frimærke. Rækkefølgen er: filerne op først, dokumentet bagefter, og
de gamle filer slettes til sidst.

**Rækkefølgen på flisen er madfoto, så opskriftfoto, så bogstavet.** Så ser
gitteret rigtigt ud fra dag ét for de 222 der findes, og bliver bedre efterhånden
som hun tager billeder af maden.

### Den vigtigste regel

**En opskrift uden måltid vises ALTID**, uanset hvilket filter der er sat.

De 222 fra den gamle app har intet måltid. Faldt de ud af kategori-filteret,
ville hendes egen mad forsvinde fra skærmen fordi hun aldrig er blevet bedt om
at udfylde et felt. **Det er bedre at vise en aftensmad under morgenmad end at
skjule noget hun selv har lavet.** Undtagelsen ligger ét sted, i `filtrerMine`,
og der er test på den. Søgningen gælder også dem, det er kun måltidet der
springes over.

### Portioner og makro

Samme regel som på Linns opskrifter, se 26.9, og det er ikke tilfældigt:

- `makroPrPortion` er **pr portion** og ganges med det antal hun spiser
- `antalPortioner` siger kun hvor mange portioner **ingredienslisten** rækker
  til, og må ALDRIG bruges på makroen

De to skalerer derfor hver sin vej på skærmen: skruer hun ned fra fire til to
portioner, halveres ingrediens-mængderne, mens makroen falder til to gange
tallet pr portion. Brydes det, skriver de to slags opskrifter forskellige tal i
den samme dagbog for den samme handling.

### Hvor det ligger

`users/{uid}/privateOpskrifter`, altså den gamle samling, så en opskrift virker
begge steder mens kunderne flyttes hold for hold. Feltet `kategorier3` er nyt og
additivt, og den gamle apps egen gemning bruger merge, så den kan ikke komme til
at slette det igen.

**Der skal intet udgives i Firebase.** Både dokumenterne og billederne i Storage
er dækket i forvejen, se `firestore.rules` og `/users/{uid}/opskrift-billeder` i
`storage.rules`. Tjekket 12. august.

**AI-motoren findes allerede** som `/api/analyser-opskrift`. 3.0 kalder den, og
at kalde et endpoint er ikke at ændre det. Det der mangler at bygges er
skærmene, ikke motoren.

| Fil | Hvad | Tests |
|---|---|---|
| `content/mineOpskrifter3.ts` | Måltider, filtrering, portioner, makro, udkast og AI-svaret | 61 |
| `firestore/mineOpskrifter3.ts` | Læsning, måltider, gem, opret og sletning | |
| `components/ny/MinOpskriftArk.svelte` | Arket hun ser opskriften i | |
| `components/ny/RetOpskriftArk.svelte` | Rediger og gennemgang. Bruges to steder | |
| `components/ny/NyOpskriftArk.svelte` | Vælg billeder og send til AI'en | |
| `OpskriftListe.svelte` | Fik den tredje fane | |

## 26.12 Egne fødevarer. LÅST 12. august

I 3.0 kunne hun **se** sine egne fødevarer, men ikke lave dem. Det var det
eneste hul i Mad uden en omvej: står hun med en vare der ikke findes i
databasen, kan hun ikke komme videre.

**Her blev der ikke målt først, og det var med vilje.** Spørgsmålet er ikke hvor
mange der bruger funktionen, men om en kunde kan gå i stå midt i sin dag. Alt
andet på listen har en løsning hun kan bruge i mellemtiden.

### To veje ind, og den anden findes ikke i den gamle app

1. En **+ Ny fødevare** knap i Mine-arket
2. **Når søgningen ikke finder noget.** Det er dér hun står i stå: varen i
   hånden, en tom skærm og ingen vej videre. Ordet hun søgte på følger med ind
   i navnefeltet

Vej 2 er den vigtigste. Vej 1 er den man finder hvis man leder.

### Tallene er pr 100 g, og det står tre steder

Hun taster dem af varedeklarationen, hvor de netop står pr 100 g. Står det ikke
på skærmen, taster hun tallene for hele pakken, og så er hendes protein tre
gange for højt resten af året. Derfor står det i overskriften over felterne, i
hjælpeteksten under dem, og i listen bagefter.

### Fire beslutninger

**1. Slagsen er med, men forvalgt til Andet.** Linns valg: feltet skal være der,
men hun skal kunne springe det over. 3.0 bruger kategorien til ingenting, men
den gamle app grupperer efter den, og kunderne flyttes hold for hold.

**2. Mængde-arket åbner af sig selv når hun har gemt en ny.** Den gamle app
lægger varen i på 100 g uden at spørge, og det passer ikke til 3.0, hvor
mængden altid vælges. Hun er jo midt i at taste sit måltid.

**3. "Det er noget man drikker"**, ét afkryds. Den gamle app sætter altid nej
til det felt, selv om datamodellen har det, så en kunde med proteinshake skal
taste i gram. Fluebenet giver hende deciliter i mængde-arket.

**4. Kalorier regnes af makroerne** hvis hun ikke selv skriver dem. Samme
Atwater-formel som den gamle apps dialog, så de to apper aldrig kan give hver
sit tal for den samme vare.

### Retter hun en vare hun allerede har brugt

**Hendes gamle registreringer ændrer sig ikke.** Hvert måltid gemmer sine egne
tal da det blev registreret, så en rettelse rammer kun fremtiden. Det er den
rigtige opførsel, og der står bevidst ingenting om det på skærmen: en forklaring
om historik ville forvirre mere end den gavner. Linns valg 12. august.

### Hvorfor det også lukker et hul i noget andet

En **manuelt tastet linje uden makro** tæller nul gram i dagbogen uden at nogen
siger det. Det er fejlen på 178 af de 2.905 faste måltider i drift. Hver gang
hun laver en rigtig fødevare i stedet, kan den fejl ikke opstå.

| Fil | Hvad | Tests |
|---|---|---|
| `content/egneFodevarer3.ts` | Felter, kalorier, dubletter | 22 |
| `content/tal3.ts` | Dansk komma og Atwater, delt med opskrifterne | via de to |
| `firestore/egneFodevarer3.ts` | Læsning, gem og sletning | |
| `components/ny/MineFodevarerArk.svelte` | Hylden | |
| `components/ny/NyFodevareArk.svelte` | Formularen | |

## 26.13 Ret mængden på en linje. LÅST 12. august

**Kan hun vælge noget til sit måltid, skal hun også kunne rette det.** Linns
beslutning. Før kunne hun kun slette linjen og taste den igen.

Et tryk på linjen åbner mængde-arket med det tal der står, og knappen siger Gem
mængden. Fortryd sætter det gamle tilbage.

**Vi opdaterer det SAMME dokument** i stedet for at slette og skrive et nyt. Så
bliver linjen liggende hvor den står og beholder sit tidsstempel. Sletter man og
skriver nyt, hopper den øverst, og så ser det ud som om hun har tastet den en
gang til.

**Linjen ser ud præcis som før:** ingen ramme, ingen farve, intet ikon. Det er
ikke en knap man skal lede efter, det er linjen selv. Krydset er stadig sit
eget, så hun ikke rammer forkert.

**En linje fra en opskrift kan ikke rettes.** Den har hverken en madvare eller
en mængde at skrue på, kun et samlet tal. Det gælder også de gamle rækker fra
før 12. august, hvor et fast måltid blev lagt i som én samlet linje.

## 26.14 De bevidste nej i Mad. LÅST 12. august

Det her afsnit findes for at beslutningerne ikke bliver taget op igen om tre
måneder. Alt herunder er fravalgt med et tal bag.

### Stregkode-scanneren: nej

Målt 12. august på hele fødevare-databasen: der ligger **49 varer i den fælles
samling**, og de så ved første øjekast ud som scanninger.

**Kun 3 af dem har en rigtig stregkode.** De øvrige 46 er tastet manuelt og fik
bare et id der lignede. **Scanneren har altså været brugt tre gange i appens
levetid.**

Det er ikke nok til et fuldskærms kamera-lag, en tilladelses-flow og en
fejlhåndtering når koden ikke findes. Og behovet er dækket: hun kan nu selv
oprette en fødevare, se 26.12.

**Bygges den alligevel en dag**, findes delene: `BarcodeScanner.svelte` med
`@zxing/browser`, opslaget i `/api/off-search`, og Open Food Facts-læsningen i
`content/openFoodFacts.ts`. Kun kamera-laget skal kobles på det ark vi har.

### Kopiér et måltid til en anden dag: nej

Faste måltider gør det bedre, se 26.10: hun lægger den samme morgenmad i på
hvilken som helst dag med ét tryk, og hun kan skifte dato på måltidsskærmen.
Kopiér-funktionen var den gamle apps måde at gøre det på, fordi den ikke havde
faste måltider.

### Rediger et helt måltid: nej

Giver ikke mening i 3.0. I den gamle app er et måltid ét dokument med mange
varelinjer, så det skal kunne redigeres. I 3.0 er hver madvare sin egen post.
Det der var værd at redde fra punktet, er bygget, se 26.13.

### De 49 fælles fødevarer, og hvad der blev gjort ved dem

**Kilden er allerede lukket.** `gemCommunityFodevare` kaldes ikke fra nogen
skærm længere, så både scannede og manuelt oprettede varer havner i dag privat
under kunden selv. De 49 stammer fra en tidligere udgave.

**Linns regel 12. august: en fødevare hun opretter eller scanner må kun kunne
ses af hende selv.** Begrundelsen er erfaring med at folk ikke opretter dem
korrekt, og data gav hende ret: 45 af de 49 mangler kalorier, 46 mangler
kulhydrat. Folk taster protein og fiber, som er det 30-30 handler om, og
springer resten over.

**Men protein-tallene holdt.** Clear Whey med 80 g passer for pulver, Optifiber
med 83 g fiber passer for loppefrøskaller. Kun fire så forkerte ud, og den ene
af dem, Pepsi Max med nul i alt, var faktisk rigtig.

**Tre blev rettet 12. august efter Linns go**, med sikkerhedskopi i `backup/`:

| Vare | Hvad | Brug |
|---|---|---|
| Æg | protein 26 → 13 g pr 100 g | 71 gange, 30 kunder |
| Æg, alle tal nul | slettet | 1 gang |
| Advokado, alle tal nul | slettet | 0 gange |

**Historikken blev ikke rørt**, og det var betingelsen. Hvert måltid gemmer sine
egne tal, så de 71 registreringer med det gamle tal står præcis som de gjorde.
Kun fremtiden er rettet.

**En ting værd at huske fra oprydningen:** ægget med de forkerte 26 gram var
markeret som **verificeret**. Tre kunder havde stemt ok på tallet. Det siger
hvad den stemme-mekanik er værd, og det bekræfter at den blev droppet i 3.0.

## 26.15 Hjertet på en fødevare. LÅST 12. august

**Jeg troede den var dobbeltarbejde ved siden af "Det du plejer", og målingen
viste at det passer ikke.** Derfor blev den bygget i stedet for droppet.

### Målingen 12. august, alle 616 kunder

| Tal | Hvad det betyder |
|---|---|
| **305** kunder, altså halvdelen, har hjertet noget | Median 13 hjerter, én har 150 |
| **72 %** af hjerterne er hendes EGNE fødevarer | Sat automatisk af den gamle app hver gang hun oprettede en vare. Dem har hun ikke valgt |
| Kun **18 %** af de hjertede ville stå på fliserne | Fliserne viser fire pr måltid, og hun har tretten hjerter |
| **11 %** har hun ikke brugt de sidste 90 dage | Nogle hjerter er en huskeseddel, ikke en genvej |

Når hendes egne varer trækkes fra, er der cirka **seks bevidst valgte hjerter
pr kunde**.

### Beslutningerne

**Hjertet står i søgeresultatet**, ikke i mængde-arket. Linns valg 12. august,
hvor hun vendte mit forslag. Den står for sig til højre med sit eget felt på
44 punkter, så et tryk på selve linjen stadig åbner mængden. Samme opdeling som
krydset i "I dette måltid".

**De hjertede har en gruppe i Mine-arket**, forslag A af tre tegnede. Ingen ny
hylde og intet nyt ikon. Har hun hjerter OG egne varer, hedder arket Mine ting
og har to grupper. Har hun ingen hjerter, ser det ud præcis som før.

**Forslag B og C blev valgt fra.** B lagde hjerterne som fliser sammen med Det
du plejer, men der er fire pladser og hun har tretten. C lod hjertet ændre
rækkefølgen i søgningen uden en hylde, men så kan hun ikke se sine hjerter
nogen steder, og de 11 % der hjerter noget de ikke bruger, gør det netop for
at kunne finde det igen.

### To regler der følger af målingen, begge med test

**1. Hendes EGNE fødevarer holdes UDE af hjerte-gruppen.** De står i forvejen
under Mine egne, og uden filteret ville halvdelen af listen være en kopi af den
anden halvdel.

**2. 3.0 sætter ALDRIG hjertet automatisk.** Den gamle app gør det hver gang
hun opretter en vare, og det er derfor 72 % af tallet er støj. Gjorde vi det
samme, ville listen igen fyldes med noget hun ikke har valgt, og så er tallet
ubrugeligt næste gang nogen måler.

Feltet er `userDoc.favoritFodevarer`, samme som den gamle app, så de 6.855
hjerter der findes virker fra dag ét. Der skal intet udgives i Firebase.

## 26.16 Søgningen i fødevarer. LÅST 12. august

To ting blev rettet samme dag, og begge er fejl vi har set før i opskrifterne.

### Hele ord først, i stedet for et afkryds

**Problemet:** korte ord drukner i støj. Søger hun "æg", finder en bred søgning
også Æggenudler og pålæg, og det er værst på netop de ord folk søger mest efter.

**Den gamle app løser det med et afkryds der hedder "Kun hele ord".** 3.0 løser
det med rækkefølgen. Linns valg 12. august, og begrundelsen er værd at kende:

1. **Målgruppen skal ikke kende en indstilling for at få et godt resultat.** Et
   afkryds hun ikke forstår, prøver hun aldrig
2. **Sortering skjuler ingenting.** Afkrydset er enten eller, så slår hun det
   til, forsvinder Æggenudler også de gange det var den hun ledte efter
3. **Det koster ingen plads.** Søgefeltet står lige over de tre ikoner

Inden for hver gruppe står korteste navn først, så Skyr kommer før Skyr med
vanilje.

### To ord gav nul

**Præcis samme fejl som i opskrift-søgningen**, se 9.5, hvor otte almindelige
to-ords-søgninger alle gav nul træffere. Hele strengen blev slået op på én gang,
så "skyr vanilje" fandt ingenting.

Nu deles der ved **mellemrum såvel som komma**, og alle ord skal findes, uanset
rækkefølge. Den gamle app kræver komma for det samme. **Et enkelt ord giver
præcis samme træffere som før**, og der er test på det, for det var vigtigt at
ingenting forsvandt da flere ord blev muligt.

| Fil | Hvad | Tests |
|---|---|---|
| `content/hjerteFodevare3.ts` | Hjertet, og filteret der holder hendes egne ude | 15 |
| `content/fodevareSoeg3.ts` | Hele ord, flere ord, rækkefølge | 24 |
| `firestore/hjerteFodevare3.ts` | Skriver hjertet | |

## 26.17 Måltidsskærmen lagt om. LÅST 12. august

Kom ud af en kritisk gennemgang af selve designet, ikke af funktionerne.

**Skærmen var vokset fra fem lag til ni på én dag:** tal, udvidet næring, det du
plejer, søgefelt, træffere, tre hylder, overskrift, gem-knap og så endelig
maden. **Hun læste fem afsnit før hun så sin egen mad.**

Seks forslag blev tegnet. Linn valgte nummer 2: **ét felt der åbner alt.**

Skærmen er nu måltidets navn, datoen, tallene, **én knap** og maden. De fem
afsnit ligger i `TilfoejArk`.

**Arket er en FORDELING, ikke et sted hun bliver.** Vælger hun en madvare, en
hylde eller lav-selv, lukker det. Så er der kun ét ark åbent ad gangen,
kvitteringen med Fortryd kan ses, og hun ser sin mad vokse.

**Prisen er ét tryk mere på den vej der bruges mest.** Hun taster cirka tre
madvarer pr måltid. Det kan ikke regnes ud, kun mærkes, og derfor blev det
sendt live samme aften.

**Gem som fast måltid er flyttet ned under maden**, hvor den hører til. Den lå
mellem overskriften og den første ingrediens, fordi den ellers faldt uden for
skærmen. Det problem findes ikke når der ikke er fem afsnit ovenover.

**De fravalgte fem:** maden først (hun skal rulle langt for at tilføje mere),
faner (handling og resultat på hver sin skærm), vandret rulle (sparer 50 px og
indfører en bevægelse appen ikke bruger), fast bundlinje (strider mod at
bundmenuen skal ligge forrest), og den nuværende trimmet (mindre gevinst).

### Tre ting der også kom ud af gennemgangen

**Hjertet betød to ting.** Det var ikonet for hylden Faste måltider, det var på
knappen Gem som fast måltid, OG det var bogmærket på en opskrift. Oveni var
bogmærket på en fødevare en stjerne. Faste måltider har nu en **tallerken**, og
stjernen er blevet et **hjerte** i samme blomme. Det løste også at honning
betød både advarsel og bogmærke.

**"Mine" var ikke et ord for noget.** De to andre etiketter er ting. Hedder nu
**Mine madvarer**, som er appens eget ord: fliserne siger "13 madvarer". Og
arket skifter ikke længere navn efter indhold.

**Knappen siger hvad der sker**, ikke hvad man gør. "Gem" alene er væk.

### Det der IKKE blev rettet

Måltidsskærmen har stadig små etiketter: PROTEIN og FIBER på 9,5 punkter, DET
DU PLEJER på 10,5. Der er tre af dem over hinanden. **Oversigten er stadig den
roligste skærm i appen og den resten skal måles imod.**

## 26.18 Hvor opskrifterne kommer fra, og hvorfor tallene ikke går op

**Det her afsnit er det vigtigste i hele Mad-delen at læse, før nogen regner på
en opskrift igen.** Det kostede en hel dag og fire runder at finde ud af.

### Anledningen

Kunder vil kunne rette i en opskrift, fx bytte ris ud med kartofler. Det kræver
at ingredienserne kan kobles til fødevare-databasen, så makroen kan regnes om.
Fire forsøg på den kobling fejlede, og forklaringen var ikke den forventede.

### Hvad der faktisk ligger i data

Opskrifterne blev fundet på **navngivne danske opskriftssider**. Kilde-kolonnen
i den oprindelige `opskrifter-30-30-3.csv` hedder "Inspireret af":

| Kilde | Antal |
|---|---|
| Valdemarsro | 23 |
| I Form | 9 |
| Spis Bedre | 8 |
| Arla | 6 |
| Mummum | 1 |
| To kilder i kombination | 17 |

Linjen "Inspireret af" blev senere fjernet fra `instruktioner` af
`_fjern-inspireret-af.ts`, så den står ikke i appen. Den ligger stadig i
CSV-filen fra 22. maj 2026.

### Og så det afgørende

**CSV'ens kolonner hedder:**

```
Estimeret protein (g/portion)
Estimeret fiber (g/portion)
Estimeret kalorier (kcal/portion)
```

**Der står "Estimeret" i selve kolonne-navnet.** Protein, fiber og kalorier har
aldrig været målte tal.

**Mængderne er også estimater.** `_estimer-opskrifter-mangder.ts` brugte Claude
til at gætte mængder på de ingredienser der kun stod som ord.
`estimater-opskrifter-mangder.json` indeholder **820 estimerede
ingredienslinjer**.

**Og kulhydrat, fedt og de manglende kalorier blev beriget med AI 24. maj**, se
memory-noten om makro-data.

**Der findes altså ikke ét målt tal i en opskrift.** Mængderne er ét estimat,
makroen er et andet, og de to blev lavet uafhængigt med en måneds mellemrum.
**Det er hele forklaringen på at de ikke går op.**

### Hvad målingerne viste undervejs

Fire runder på ti opskrifter, med AI-kobling til fødevare-databasen:

| Runde | Antagelse | Ramte |
|---|---|---|
| 1 | navne-match, blandet | 5 af 10 |
| 2 | foretræk tilberedte former | 2 af 10 |
| 3 | råvarer er rå | 2 af 10 |
| 4 | rå, og kun den officielle database | 2 af 10 |

**Da koblingen blev BEDRE, blev resultatet DÅRLIGERE.** Runde 1 klarede sig kun
bedre fordi den sprang de svære ingredienser over. Det var held, ikke kvalitet.

På alle 130 opskrifter: **63 ligger tæt på 1**, altså regnestykket stemmer.
**15 ligger tæt på 2**, altså ingredienslisten rækker nok til to portioner.
**52 ligger i et bånd omkring 1,2 til 1,6** som hverken portioner eller
tilstand forklarer.

### Bælgfrugterne, som er den ene ting der KAN rettes billigt

**Opskrifterne er ikke konsekvente om linser, kikærter og bønner er tørre eller
kogte.** Kalkun-rugbrødet skriver "afdryppede". 35 opskrifter skriver ingenting
på i alt 38 linjer.

Forskellen er en faktor tre: 150 g tørre linser giver 37 g protein, 150 g
afdryppede giver 13.

**To uafhængige kilder siger cirka 63 g tørre linser pr person.** Valdemarsros
egen linsesalat er til 4 personer med 3 dl linser, og en anden dansk linsegryde
bruger 250 g til fire. Flere af Linns opskrifter har 150 g til én portion.

### Hvad der IKKE skal prøves igen

**Kobl ikke ingredienser til fødevare-databasen for at verificere makroen.**
Det er prøvet fire gange på to dage. Muren er ikke koblingen, den er at der
ikke findes et facit at holde den op mod.

**Og sammenlign ikke kalorier.** De er AI-estimeret, og 22 af dem stemmer ikke
med deres egen makro.

### Hvad der BLEV rettet 13. august

**38 ingredienslinjer på 35 opskrifter fik tilstanden skrevet ind:** tørre eller
afdryppede. Sikkerhedskopi i `backup/opskrifter-ingredienser-foer-baelgfrugt.json`.

Reglerne der blev brugt, i den rækkefølge:

1. **Røde linser er ALTID tørre.** De sælges ikke på dåse i Danmark. Første
   udgave af scriptet foreslog "afdryppede" på en rød linsesuppe, og det er
   forkert
2. **Siger instruktionen at de skal koges, er de tørre**
3. **Ellers afgør mængden:** 100 g eller mere er en dåse, altså afdryppede

Efter rettelsen har alle 55 bælgfrugt-linjer et ord, ingen er dobbelt-mærket.

**Ordet er ren tekst, og ingen beregning hænger på det**, så ingen kundes tal
flyttede sig. Det er derfor rettelsen kunne laves med det samme, hvor
portionstallet ikke kunne.

### Portionstallet der IKKE blev rettet, og hvorfor

**Seks opskrifter rækker til to personer, men står som én portion.** Linn
bekræftede det 13. august, og regnestykket bekræfter det: 150 g tørre linser
delt med to er 75 g pr person, hvilket ligger tæt på de 63 g som både
Valdemarsro og en anden dansk opskrift bruger.

**De må alligevel ikke sættes til 2 endnu**, og det er vigtigt at forstå
hvorfor, for det ser ud som en simpel rettelse:

- **Den gamle app DELER makroen med portionstallet.** `skala = portioner /
  defaultPortioner` i `routes/app/moduler/30-30-3/opskrifter/[id]`. Sætter vi
  2, viser og gemmer den **16 g protein i stedet for 32**
- **3.0 åbner arket på opskriftens eget portionstal.** Den ville åbne på 2
  portioner og logge **64 g**

**De to apper ville tage fejl i hver sin retning på samme tid**, på seks
opskrifter, for 760 kunder.

**Rækkefølgen er derfor:** først punkt 1 på ventelisten, altså den gamle apps
deling. Så kan de seks portionstal sættes til 2. Ikke omvendt.

De seks er: Grøn salat med linser og rødbeder, Linsesalat med blødkogt æg,
Ørredfilet med lun linsesalat, Stegt laks på grønne linser, Krydret ovnkylling
med linser, og Vegetarisk lasagne.

### Punkt 1 blev rettet 13. august, og hvad det låste op

**Den gamle app delte makroen med portionstallet.** `skala = portioner /
defaultPortioner` i `routes/app/moduler/30-30-3/opskrifter/[id]`. Makroen er pr
portion, så divisionen var forkert. Rettet til `skala = portioner`.

På de 122 opskrifter med portionstal 1 ændrede det ingenting. På de 8 andre:

| Opskrift | Viste | Viser nu |
|---|---|---|
| Kylling med broccoli i grøn pestosauce | 12,0 g | 48 g |
| Kyllingefrikadeller med tzatziki | 10,5 g | 42 g |
| Mættende oksekødsbowl | 21,0 g | 42 g |
| Tex-mex bowl med krydret oksekød | 9,5 g | 38 g |
| Sojamarineret laks med sesam | 9,5 g | 38 g |
| Plancha grøntsager med flankesteak | 8,0 g | 32 g |
| Hjemmebagte energikugler | 1,3 g | 5 g |
| Den grønne grød, isterninger | 0,1 g | 1 g |

Det var ventilen i `CLAUDE.md` regel 2: egen opgave, eget go, egen commit.
Ingredienserne blev ikke rørt, de skaleres af `skalerMaengde`. Historikken blev
ikke rettet, se punkt 3 på ventelisten.

**Og så kunne de seks portionstal endelig sættes til 2.** Ørredfilet med lun
linsesalat, Grøn salat med linser og rødbeder, Linsesalat med blødkogt æg,
Stegt laks på grønne linser, Krydret ovnkylling med linser, og Vegetarisk
lasagne. Sikkerhedskopi i `backup/opskrifter-portionstal-foer.json`.

**Ørred-opskriften hænger nu sammen:** 150 g tørre linser og 130 g ørred til to
personer giver cirka 32 g protein pr portion, og det er præcis det der står.

### Den beslutning der ligger og venter

**Skal makroen regnes ud af ingredienslisten, så de to endelig taler sammen?**

Gør vi det, får hver opskrift ét sammenhængende tal, kunden kan skrue op og ned
for portioner, hun kan bytte en ingrediens ud, og indkøbslisten bliver mulig.
Det er punkt 9 på ventelisten.

**Prisen er at tallene ændrer sig for 760 kunder i drift**, og at nogle af dem
vil stige mærkbart.

**Rækkefølgen er ikke til forhandling:** bælgfrugt-ordet skal ind FØRST. Regnes
makroen om mens tilstanden er ukendt, bages tvetydigheden ind i de nye tal og
kan aldrig findes igen.

## 27. Åbne punkter på Mad

- Farve på plejer-fliserne: udskudt med vilje, og de holdes hvide indtil
  videre, fordi de fire veje allerede bærer farven
- ~~Madplanen~~. **Parkeret 11. august.** Ikonet er fjernet, motoren er urørt
- Gamle registreringer med enheder der ikke giver mening for varen, fx "1 spsk
  æg", dukker op som forslag under "det du plejer". Set hos test-profilen 11.
  august. Afklares om det også sker hos rigtige kunder
- **128 af 130 opskrifter mangler et billede.** Værktøjet er bygget, se 26.7.
  De to der har et, har kun den store udgave. **Det er formentlig den vigtigste
  enkeltting på hele listen.** Målingen 12. august viste at kun 23 % af
  kunderne overhovedet bruger opskrifter, og gitteret er 128 farvede felter med
  ét bogstav i. Ingen vælger aftensmad ud fra bogstavet K
- ~~Makro-linjen står midt i fremgangsmåden~~. **Klaret 12. august**, se 26.9.
  Den klippes ud af visningen, og data er urørt
- ~~Otte opskrifter viser en ingrediensliste der ikke passer til portionen~~.
  **Klaret i 3.0 12. august**, se 26.9. Står stadig i den gamle app, se
  listen nedenfor
- **Et løsrevet "stk" på 30 opskrifter.** 23 % har mindst én ingrediens uden
  mængde. Koden skjuler tallet når det mangler, men ikke enheden, så linjen
  bliver til "Salt og peber ... stk" og "Saft fra 1/2 lime ... stk"
- **Hun kan kun nå opskrifter inde fra et måltid.** Der er ingen vej fra
  forsiden, så vil hun bare se hvad der findes, skal hun først vælge om det er
  morgenmad eller aftensmad. Biblioteket, som er den vej i den gamle app, er
  bevidst udskudt
- ~~Egne fødevarer kan kun ses, ikke laves~~. **Klaret 12. august**, se 26.12
- ~~Stregkode-scanneren mangler~~. **Bevidst nej 12. august**, se 26.14. Brugt
  tre gange i appens levetid
- ~~Ret og kopiér et måltid mangler~~. **Afgjort 12. august.** Mængden kan
  rettes, se 26.13. Resten er et bevidst nej, se 26.14
- ~~Hjerte på en enkelt fødevare~~. **Bygget 12. august**, se 26.15
- ~~"Kun hele ord" i søgningen~~. **Løst 12. august med rækkefølge i stedet for
  et afkryds**, se 26.16. To ord virker nu også
- **Indkøbslisten mangler.** Den bygger på det mindst brugte i modulet:
  opskrifter er 0,9 % af alt der registreres, og kun 23 % af kunderne har brugt
  én. Og den har en forudsætning der ikke er opfyldt, nemlig at 128 af 130
  opskrifter mangler et billede. **Anbefaling: tag den op igen når billederne er
  på**, for da bliver opskrifterne noget man browser
- **Madplanen mangler stadig et ja eller et endeligt nej.** Parkeret 11. august,
  ikonet er fjernet, motoren er urørt
- ~~Bælgfrugter siger ikke om de er tørre eller kogte~~. **Klaret 13. august**,
  se 26.18. 38 linjer på 35 opskrifter
- **Punkt 1 på ventelisten er rykket op i vigtighed.** Den gamle apps deling af
  makroen med portionstallet blokerer nu også for at rette portionstallet på de
  seks opskrifter der rækker til to personer, se 26.18
- **Kunder vil kunne rette i en opskrift**, fx bytte ris ud med kartofler. Vejen
  er IKKE at koble ingredienser til fødevare-databasen, se 26.18. Den skal
  bygges som "Lav min egen udgave", hvor opskriften kopieres til hendes egne og
  AI'en regner næringen forfra ud fra hele ingredienslisten
- **Skærmen ser tom ud mens fødevare-databasen hentes.** 2.268 dokumenter tager
  tid på en telefon, og imens er søgefeltet der uden at der sker noget. Set af
  Linn 12. august, hvor det lignede at alt var forsvundet. Samme klasse som
  opstarts-problemet i afsnit 28: appen fortæller ikke hvad den laver
- ~~Der er stadig ingen vej til at gemme et MÅLTID som favorit i 3.0~~.
  **Klaret 12. august**, se 26.10. Hylden hedder nu Faste måltider, og teksten
  i arket lover ikke længere noget appen ikke holder
- ~~**`static/mockup/` skal slettes.**~~ **Klaret 11. august.** Syv filer og
  808 KB stillads til 30-30. Static gik fra 1,1 MB til 280 KB, og alt i static
  hentes ned til hver kunde ved hver udrulning. Se 28.5

**Arbejdsform aftalt 9. august:** vi tager Mad ét skærmbillede ad gangen i
stedet for at tegne hele modulet på én gang. De første fem runder mockups
byggede på gæt om hvad Mad indeholdt, og det skal ikke gentages.

---

# Ventelisten. Sat på pause 12. august 2026

**Linns beslutning 12. august: det herunder tages FØRST når hele appen er
designet færdig.** Ikke fordi punkterne er ligegyldige, men fordi det er
dyrere at rette den gamle app og kundedata undervejs end at gøre det samlet,
og fordi designet stadig kan flytte på hvad der overhovedet skal rettes.

Listen er sorteret efter hvor meget det gør ondt at lade den ligge. Den
øverste skriver forkerte tal ind i kunders dagbøger lige nu.

### Rammer kunder i drift

**1.** ~~Den gamle app deler makroen med `defaultPortioner`.~~ **RETTET 13.
august**, se 26.18. Det var det eneste punkt der skrev forkerte tal ind i
kunders dagbøger lige nu. Den oprindelige tekst stod: På de 8
retter der er skrevet til flere portioner skriver den for lidt protein i
dagbogen, fx 12 g hvor kunden spiste 48. 3.0 er rettet, den gamle er ikke.
Rettelsen ligger i `routes/app/moduler/30-30-3/opskrifter/[id]/+page.svelte`
omkring `skaleretMakro`, og den er ventilen i `CLAUDE.md` regel 2, altså en
selvstændig opgave med eget go.

**2.** ~~Nye opskrifter starter på 4 portioner i admin.~~ **RETTET 13. august.**
`defaultPortioner` er nu 1 ved oprettelse. 122 af de 130 er skrevet til én
person, så fire var ikke normen, og hver ny opskrift var forkert indtil feltet
blev rettet i hånden. De 122 er sat ned én ad gangen af netop den grund.

**3.** ~~Gamle registreringer har for lidt protein.~~ **BEVIDST NEJ 13. august.
Vi retter ikke bagud.**

Gennemgangen af hele historikken, 31.136 måltider, fandt **8 registreringer hos
7 kunder** hvor tallet er tre til tolv gange for lavt. Den tidligere måling 12.
august sagde 15 hos 13, og forskellen blev ikke afklaret, fordi beslutningen
gjorde den ligegyldig.

**Linns beslutning: der rettes ikke i det kunderne har registreret.** Det er
deres egen dagbog, ingen af dem har bedt om det, og de ville se dagstal fra juni
stige uden varsel.

**Kilden er lukket**, se punkt 1 og 2, så tallet kan ikke vokse.

**En ting værd at kende, hvis nogen tager det op igen:** efter rettelsen 13.
august kan en post på 48 g protein både betyde "hun spiste én portion i dag" og
"hun spiste fire portioner før rettelsen". De to kan kun skilles ad på datoen.
En eventuel senere oprydning skal derfor kun se på poster fra før 13. august.

### Data og indhold

**4. 128 af 130 opskrifter mangler et billede.** Se 26.7. Formentlig den
vigtigste enkeltting på hele listen, fordi kun 23 % af kunderne overhovedet
bruger opskrifter og gitteret er 128 farvede felter med ét bogstav i. Værktøjet
er bygget og virker. Det er Linns arbejde, ikke kodearbejde.

**5. 22 opskrifter har kalorier der ikke passer med deres egen makro**, mere
end 12 % fra. **21 af de 22 har kalorierne sat for højt**, hvilket tyder på at
tallet er sat uafhængigt af de andre fire snarere end regnet ud af dem.
Protein og fiber, som 30-30 faktisk bruger, er ikke berørt. Betyder mere nu,
hvor kalorier vises for dem med udvidet næring. Listen kan genskabes med et
Atwater-tjek, se 26.9.

**6. De 8 opskrifters portionstal.** Linn overvejede 12. august at sætte
frokost og aftensmad til 4 portioner og morgenmad og snack til 1. **Det blev
IKKE gjort**, fordi ingredienslisterne i dag er skrevet til én person: 59 af de
65 der kunne vurderes har 50 til 250 g kød. Skulle de være familiemad, skal
cirka 700 mængder ganges med fire, og det ændrer hvad 760 kunder ser. Den
modsatte vej, altså at sætte de 8 ned til 1 og dele deres mængder med fire, er
cirka 60 tal og gør data mere ensartet.

**7. Beskrivelsen på "Den grønne grød" er kopieret** fra isterninge-udgaven.
Den siger "Fryses i isterninger", men instruktionerne slutter med "Server med
det samme". Linns indhold.

**8. Et løsrevet "stk" på 30 opskrifter**, se listen ovenfor.

### Struktur, når der alligevel skal ryddes

**9. Makro bør ligge i egne felter på opskriften** i stedet for at være gemt
som tal inde i en tekst. Så forsvinder både parsing, udklipning af linjen og
hele klassen af fejl vi har fundet i dag. Det er en migrering der rører den
gamle app, og den bør laves samtidig med punkt 1.

**10.** ~~Der er stadig ingen vej til at gemme et MÅLTID som favorit i 3.0.~~
**Klaret 12. august**, se 26.10. Det der stadig står tilbage er de **178 af
2.905 faste måltider der har en linje uden makro** og derfor logger for lidt.
Det er en grænse i den gamle model, og 3.0 kan ikke længere lave nye af dem,
men de gamle er ikke rettet.

**11. Opskrifter kan kun nås inde fra et måltid.** Se listen ovenfor.

### Sådan bør punkt 1, 3 og 9 gribes an

De tre hænger sammen og bør tages i én omgang, i den rækkefølge: først flyt
makro ud i egne felter, så ret begge apps til at læse dem, og først derefter
ret de 15 gamle poster. Rettes den gamle app først, skal den samme kode rettes
to gange.

**Verificering af protein og fiber mod ingredienserne er IKKE gjort**, og det
kræver at hver ingrediens kobles til en bestemt fødevare. Forsøget 12. august
på at gætte koblingen ud fra navnet gav 59 falske alarmer, se 26.9.

---

# Tilføjelse: opstart og indlæsning. Beslutninger truffet 11. august 2026

Det her afsnit handler ikke om en skærm, men om det der sker før den første
skærm overhovedet kommer frem. Det kom af en konkret oplevelse: Linns telefon
stod i **over ét minut** på logoet og "Et øjeblik" den 11. august om aftenen.

En gennemgang af hele opstarts-kæden fandt fem flaskehalse. Fire af dem ligger
i den app der er i drift, ikke i 3.0, og de er derfor rettet gennem ventilen i
`CLAUDE.md` regel 2, som selvstændige opgaver med eget go og egne commits.

**Det vigtigste at forstå på forhånd:** appen tegnes helt i browseren,
`ssr = false`, og næsten alt i opstarten var lagt i kø uden nogen tidsgrænse.
Firestore gemmer i forvejen hvert dokument i telefonens egen hukommelse, se
`localCache` i `lib/firebase.ts`, men det almindelige `getDoc` spørger
serveren alligevel. Det var det gennemgående mønster: **appen ventede på
netværket, selv om svaret lå lokalt.**

## 28. Opstart. LÅST 11. august

### 28.1 App-skallen får en tidsgrænse

**Problemet.** Service workeren spurgte altid nettet først om selve HTML-skallen
og faldt kun tilbage til den gemte kopi hvis nettet sagde klart nej. Der var
ingen tidsgrænse. Er forbindelsen der, men død, hvilket er normalt når en
telefon lige er vågnet eller skifter mellem wifi og mobilnet, kan browseren
bruge et minut før den giver op. Kopien lå klar hele tiden og blev ikke brugt.

**Løsningen.** Nettet får `NAV_TIMEOUT_MS`, altså 3 sekunder. Derefter serveres
kopien, og hentningen løber færdig i baggrunden så cachen er frisk til næste
opstart. Uden kopi, fx allerførste besøg, ventes der på nettet som før. Se
`navigationSvar` i `src/service-worker.ts`.

**Hvorfor 3 sekunder.** En almindelig hentning af skallen tager 0,2 til 0,5
sekunder. 3 sekunder er rigelig plads til en langsom forbindelse uden at nogen
når at opfatte det som ventetid.

**Den bevidste byttehandel.** På en langsom forbindelse lige efter en udrulning
kan kunden få den forrige version én gang. Baggrunds-hentningen opdaterer
kopien, og de mekanismer der allerede findes, altså SW-update ved focus,
`controllerchange` og `vite:preloadError`-selvhelbredelsen i
`routes/+layout.svelte`, bringer hende videre. Ét ekstra gensyn med den gamle
version vejer mindre end et minuts sort skærm.

**En fælde der opstod undervejs.** Første udgave lagde cache-opslaget på den
kritiske vej for hver eneste navigation, uden at tage højde for at det opslag
kan fejle. Kaster `caches`, fx i et privat vindue, ved fuld kvota eller på en
iPhone der har ryddet op, ville hele svaret afvise, og kunden ville få en
fejlside i stedet for appen. **Alt cache-arbejde i en navigation skal være
pakket ind**, og selve gemningen skal ligge uden for det svar kunden får.

### 28.2 Skrifterne må ikke blokere den første optegning

**Problemet.** `src/app.html` hentede Playfair Display og DM Sans fra Googles
server som et almindeligt stylesheet. Browseren nægter at tegne noget som helst
før sådan et svar er hjemme. Det var **den eneste ting i hele appen der stadig
blev hentet udefra**, og service workeren må ikke gemme den, fordi den ligger
på et fremmed domæne.

Skrifterne bruges **kun af den gamle app**. 3.0 har Fraunces og Plus Jakarta
Sans indlejret som data-URI i `ny.css`, se regel om skrifter i `CLAUDE.md`. På
`/ny` var ventetiden altså ren spildtid.

**Løsningen.** Linket hentes med `media="print"` plus `onload="this.media='all'"`,
med et `<noscript>` som reserve. Browseren henter filen uden at vente på den og
sætter den i brug når den er hjemme. Teksten tegnes imens med reserve-skriften,
præcis som `display=swap` allerede gjorde.

**Sikkerhedstjek før det blev valgt:** der er ingen CSP sat op i projektet,
hverken i `svelte.config.js` eller som `_headers`, så en inline `onload` er
sikker. Ændrer det sig, skal den her løsning skrives om.

**Fravalgt:** at hoste skrifterne selv. Det ville kræve en ændring i
`src/app.css`, som er et delt modul, og gevinsten var lille sammenlignet med
risikoen.

### 28.3 Hurtig opstart: læs kundens egen kopi først

**Problemet.** Efter Auth havde svaret, hentede skallen bruger-dokumentet fra
serveren og kørte derefter forløbs-synkroniseringen, som selv er 2 til 4 ture
mere frem og tilbage plus skrivninger. Alt i kø, alt uden tidsgrænse. Først
derefter forsvandt "Et øjeblik". Dokumentet lå hele tiden i telefonens kopi.

**Løsningen.** Kopien læses lokalt med `getDocFromCache`, hvilket aldrig rører
netværket, og den rigtige kæde kapløber mod et ur på `HURTIG_START_MS`, altså
2,5 sekunder. Vinder kæden, er forløbet uændret. Trækker den ud, lukkes kunden
ind på kopien mens kæden løber færdig i baggrunden. **Serveren har altid det
sidste ord.**

**Hvorfor 2,5 sekunder.** Bruger-dokumentet tager typisk 0,15 til 0,4 sekunder,
og synkroniseringen lægger 2 til 4 ture oveni, altså 0,5 til 1,5 sekunder i
alt. 2,5 sekunder giver rigelig luft, så opstarten ser fuldstændig ud som før
for alle andre end dem der faktisk sidder og venter. **Det er hele pointen: vi
ændrer kun noget for den kunde der ellers ville stirre på en spinner.**

**SIKKERHEDSREGLEN, og den er vigtigere end hastigheden.** En **lukket dør**
åbnes aldrig på en kopi. Ville kopien føre til skærmen "du har ingen adgang",
venter vi på serveren. En betalende kunde må ALDRIG risikere at få den skærm
at se, bare fordi telefonen lå med en gammel kopi. Den anden vej er ufarlig:
åbner vi på en kopi der viser lidt for lidt, retter serveren det et øjeblik
efter. Se `maaAabnePaaKopi` i `content/hurtigStart.ts`, og der er test på.

**Sidegevinst.** Kan serveren slet ikke nås, kommer kunden nu ind på kopien i
stedet for at stå med spinneren for evigt.

**Udrulning bag flag, og så åbnet for alle.** Det her ligger i den gamle apps
login-flow, altså noget alle cirka 760 kunder i drift går igennem hver gang.
Derfor fik kun admin og kunder med `ny-app`-flaget den først, mens alle andre
kørte videre på præcis den kæde de kørte på før.

**Åbnet for alle 12. august**, efter at have kørt bag flaget siden 11. august
uden problemer. Kontakten er én linje:

```ts
export const HURTIG_START_FOR_ALLE = true;  // content/hurtigStart.ts
```

**Kontakten bliver stående med vilje.** Dukker der noget op, sættes den til
`false`, og så er alle andre end testerne øjeblikkeligt tilbage på den gamle
opstart. Det er den eneste linje der skal ændres, begge veje. Der er en test
der fælder hvis nogen kommer til at vippe den uden at ville det.

**De to sikkerhedsregler gælder uanset kontakten:** der åbnes aldrig uden en
lokal kopi, og aldrig på en kopi der ville føre til en lukket dør.

**Filer:** `content/hurtigStart.ts` er reglen og tidsgrænsen, ren logik uden
database. `userDocCache.ts` læser kopien. `userDoc.ts` er bevidst **urørt**,
fordi det er et delt modul.

### 28.4 Fælden i /ny, som den gamle app ikke havde

**Kuren kunne ikke kopieres direkte.** Spærringen i 3.0 hviler på regel 1 i
`spaerring3.ts`: **et aktivt forløb vinder over alt.** Havde vi kun hentet
bruger-dokumentet fra kopien og ladet forløbene vente, ville en Kropsro-kunde
med udløbet abonnement se ud som om hun slet ikke havde noget forløb, og så
ville hun få **"Din adgang er udløbet" at se midt i sit forløb.**

**Løsningen.** `firestore/hurtigStart3.ts` henter **hele** billedet fra kopien,
altså bruger-dokument, forløb og pause-dage, og ikke kun det første led. Der er
fire tests der holder det på plads, og de tjekker begge veje: er forløbene med,
spærres hun ikke, og mangler de, nægter reglen at åbne på kopien i stedet for
at vise den forkerte skærm.

**Én udregning, ikke to.** Udregningen af adgang og spærring er flyttet ud af
skallen og ind i `content/hurtigStart3.ts` som `opstartsBillede()`. Reglerne er
uændrede, linje for linje. Grunden er at den hurtige opstart skal stille
**nøjagtig samme spørgsmål** om kopien som skallen stiller om serverens svar.
To udgaver af den regel ville kunne drive fra hinanden, og så ville kopien og
serveren vise hver sin skærm. Sidegevinsten er at der er mindre i skallen,
hvilket HANDOVER afsnit 7 udtrykkeligt beder om.

**En antagelse der blev fanget af en test.** En forløbs-række kræver **begge
ben**: `forlobIds` på kunden OG selve forløbs-dokumentet, se `udledAdgange` i
`adgang3.ts`. Har man kun det ene, findes rækken ikke. Det er præcis derfor
kopien skal hente det hele. Der ligger nu en test der holder den antagelse
fast.

**Ingen udrulning bag flag her.** `/ny` er allerede kun åben for admin og konti
med `ny-app`-flaget, så publikum ER testerne.

### 28.5 Gemning på forhånd må ikke være alt-eller-intet

**Problemet.** Service workeren brugte `cache.addAll()`, som er alt-eller-intet.
Knækkede forbindelsen på fil nummer 200, eller nåede en fil at forsvinde midt i
en udrulning, blev HELE hentningen kastet væk. Der blev ikke gemt noget som
helst, og så prøvede den forfra ved hver eneste app-start indtil den lykkedes.
På en dårlig forbindelse kan den tilstand blive ved længe.

**Løsningen.** Filerne hentes i hold af `HOLD_STOERRELSE`, altså 12 ad gangen,
og de får lov at stå ved hver for sig via `Promise.allSettled`. Én fil der ikke
kan hentes koster nu netop den ene fil, og den gemmes af sig selv næste gang
nogen bruger den, se den cache-first fetch-håndtering der allerede var der.

**Hold i stedet for alle på én gang** betyder at hentningen tager lidt længere i
alt, men fylder mindre undervejs, så appens egne kald får en fair andel af
forbindelsen. Det er det rigtige bytte for noget der kører i baggrunden.

**En præcisering der er værd at have med.** Den her hentning går først i gang
**efter** siden er indlæst. Den konkurrerer altså med appens data-kald og ikke
med selve opstarten. Det her punkt er robusthed og oprydning, ikke en kur mod
ventetiden. Under diagnosen blev det først beskrevet som en medvirkende årsag
til ventetiden, og det var forkert.

**Samtidig blev `static/mockup/` slettet**, se 27. Alt i `static/` bliver hentet
ned til hver kunde ved hver udrulning, så 808 KB stillads kostede alle.

### 28.6 Åbne punkter på opstarten

- ~~Åbne den hurtige opstart for alle 760~~. **Klaret 12. august.** Se 28.3.
  Kontakten står nu på `true`, og den bliver stående så den kan vippes tilbage
  med én linje
- **Det er ikke bekræftet på en rigtig telefon endnu** at ventetiden faktisk er
  væk. Fem flaskehalse er fundet i koden og fjernet, men problemet er aldrig
  set ske under måling. Hænger den stadig, er næste skridt at måle i stedet for
  at gætte videre, og det første spørgsmål er om skærmen er **helt blank**,
  altså skallen eller skrifterne, eller viser **logoet og "Et øjeblik"**, altså
  Firebase-kæden
- **`/ny` har fået samme kur**, se 28.4, men er heller ikke bekræftet på telefon
- **Firebase Auth selv er ikke undersøgt.** Hænger noget dér, altså før kæden
  overhovedet går i gang, er intet af det her dækket

## 29. Træning. Modellen låst 15. august, bid 1 til 6 bygget

Hele modulet blev gennemgået 15. august, først som diagnose af den gamle app,
så som mockups, og derefter blev bid 1 til 5 bygget. Afsnittet her er
beslutningerne og hvorfor de er som de er.

**Arbejdsformen var mockups før kode, hver gang.** Hver bid blev tegnet i
`v3 app/linns-academy-design/`, gennemgået med Linn, rettet efter hendes svar,
og først derefter kodet. Det er ikke pynt: tildelingen blev tegnet om én gang
undervejs, fordi hun ville have ét bestemt hold i stedet for forløbet
generelt, og den ændring ville have været dyr at opdage i koden.

### 29.1 Hvad der er galt med træningen i dag

Diagnosen er lavet på koden, ikke på et gæt.

**Omfanget.** Kunde-siderne under `app/moduler/traening/` er 9.901 linjer
fordelt på elleve filer. Admin-siderne er 6.930 linjer. Til sammenligning er
hele 30-30 modulet i 3.0 mindre end det.

**Fire slags programmer, tre steder.** Abo-mikrotræningen ligger i
`aboMikrotraening/{premium|basis}`, forløbets egne i
`forlob/{id}/mikrotraeningProgrammer`, master-programmerne i `trainingPrograms`
og kundens egne i `users/{uid}/mineProgrammer`. To af de tre steder er bundet
til enten et forløb eller et abonnement, og det er præcis den binding 3.0
skiller sig af med.

**Tre forskellige regler for hvilken dag hun står på.** Abo regner kalenderdage
siden `aboStartDato` modulo 21. Forløb bruger forløbets dag med nul-dage trukket
fra. Master og eget låser op efterhånden som hun gennemfører. Samme spørgsmål,
tre svar.

**Fremgangen ligger fem steder.** `products/{produkt}.fremgang.mikrotraening`,
`aboMikrotraeningFremgang/aktiv`, `aboMikrotraeningTraeninger/{dato}`,
`programFremgang/{id}` og `traeningHistorik`. Kun den sidste er bundet til en
dato på tværs af alle kilder, og det er den 3.0's forside allerede læser.

**Fire afspillere på cirka 1.400 linjer hver.** En for abo, en for forløb, en
for master og en for byg-eget. Cirka 5.700 linjer der gør det samme. De bliver
til én.

### 29.2 Beslutningerne, truffet af Linn 15. august

1. **Ét sted at bygge programmer.** Uafhængigt af forløb og abonnement
2. **Kategorierne er data, ikke kode.** Linn opretter dem selv. I dag findes
   kun kettlebell og uden kettlebell, og de står hårdkodet flere steder i den
   gamle app
3. **Kunden vælger sit udstyr** første gang og siden i Profil, og ser derefter
   kun de tildelte programmer der passer. Hun må vælge flere slags på én gang
4. **Uden redskaber vises altid.** Hun har altid sin egen krop med
5. **Ét program har én kategori.** Kræver det en stol, skriver Linn det i
   beskrivelsen. Alternativet var et filter kunden ikke kan gennemskue
6. **Dagen rykker først når hun har trænet**, ikke når kalenderen skifter. Det
   gælder også forløbskunder. Én regel i stedet for tre
7. **Hun er ikke låst til ét program** og kan skifte frit. Hvert program husker
   sin egen plads, så hun kan gå frem og tilbage uden at miste noget
8. **Hun bliver altid spurgt** når hun går væk fra en træning, også efter ti
   sekunder. Svarene er Ja, Nej og Gem hvor jeg er kommet til
9. **Efter en gennemført træning kommer hun tilbage til træningens forside.**
   Vil hun tage en mere, starter hun den derfra. Ingen næste dag-knap
10. **Hun ser aldrig programmer hun ikke har fået.** Ingen grå låste kasser
11. **Fjernes et program, beholder hun sin historik**, og får hun det igen,
    starter hun hvor hun slap
12. **Tildeling kan gælde fra og til.** Standarden er uden slutdato
13. **Byg eget program styres af de samme tildelinger** som programmerne
14. **Kladde og Klar.** Kun et program der er sat til klar kan tildeles
15. **Fire slags modtagere**, besluttet 15. august da tildelingen blev tegnet:
    ét bestemt hold, én person, alle medlemmer, eller alle. Medlem betyder
    aktivt app-abonnement. Se 29.5
16. **Det hedder træning og ikke dag.** Ordet dag er forbeholdt kalenderdage
    i et forløb. Se 29.6
17. **Udstyrsvalget hører hjemme i onboarding**, ikke i træningen. Se 29.6.1

### 29.3 Datamodellen

Alt nyt ligger i sit eget hjørne som kun 3.0 læser. Den gamle app kender
ingenting af det, og de 760 kunder i drift mærker ingenting.

```
traeningKategorier3/{id}                kategorierne
traeningsprogrammer3/{id}               programmet
traeningsprogrammer3/{id}/dage/{dagN}   træningerne med øvelser
traeningTildelinger3/{id}               hvem får hvad, og hvornår

users/{uid}/traeningFremgang3/{programId}   hvor langt hun er
users/{uid}/traeningPlads3/{programId}      gemt plads i en træning
userDoc.traeningsudstyr3                    hendes udstyrsvalg
```

Alt herover er bygget og i drift pr 15. august 2026.

**Undersamlingen hedder `dage` og feltet hedder `antalDage`**, selv om det
kunden ser hedder træninger. Navnene stammer fra før omdøbningen i 29.6 og
bliver stående: et skift ville kræve en migrering uden at kunden fik noget ud
af det. Brug `antalTraeninger3()` i UI-kode, så ordet dag ikke sniger sig
tilbage på skærmen.

**Dagene ligger i en undersamling** og ikke i selve programmet. Et 84-dages
program med fem øvelser om dagen er for stort til ét dokument, og listen over
programmer skal kunne hentes uden at trække 420 dage med.

**En dag genbruger den gamle form**, altså `TrainingDay` med `DayExercise`.
Det er med vilje. Udkast-generatoren fra den gamle app kan bruges som den er,
afspilleren kan bygges på den samme form, og skulle nogen alligevel få brug
for at hente et gammelt program ind, kan det gøres uden at skrive det om.

**Fremgangen ligger pr program.** Det er dét der gør at hun kan skifte mellem
programmer uden at miste noget, og at fremgangen overlever at et program bliver
fjernet fra hende.

**Øvelsesbanken genbruges** som den er. Der er ingen grund til at lave 200
øvelser og deres videoer om.

### 29.4 Kategorierne

En kategori er det udstyr kunden træner med. Feltet `visesAltid` sættes på
Uden redskaber, og det er ikke pynt: uden det kunne hun vælge håndvægte og stå
tilbage med en tom skærm.

`udstyrTag` kobler kategorien til de mærkater øvelserne allerede har, altså
ingen, kettlebell, elastik, håndvægte og forhøjning. Koblingen bruges **kun**
til at forudfiltrere når Linn vælger øvelser eller beder om et udkast.

**Filteret må aldrig spærre.** Et nyt redskab som sjippetov findes ikke som
mærkat i banken, og så står `udstyrTag` til null og hun vælger frit fra hele
listen. At sætte nye mærkater på øvelserne rører den gamle app og skal være sin
egen opgave med sit eget go.

**Et redskabs-program indeholder også kropsvægt.** Derfor giver
`filtrerOevelserTilKategori` både øvelser med det valgte redskab og øvelser
der intet kræver. Øvelser der kræver et ANDET redskab falder fra, for dem har
hun ikke.

### 29.5 Tildelingen. LÅST og bygget 15. august

Mockups i `v3 app/linns-academy-design/mockups-traening-tildeling.html`,
gennemgået i to runder før der blev kodet.

**Fire slags modtagere.** Linns valg 15. august, hvor "medlemmer" kom til
undervejs:

| Modtager | Hvem |
|---|---|
| Hold | Ét bestemt hold, fx Kickstart juni 2026 |
| Én person | En enkelt kunde |
| Medlemmer | Alle med et aktivt app-abonnement |
| Alle | Alle der kan åbne appen, både forløb og abonnement |

**Medlem betyder aktivt app-abonnement**, også hvis hun samtidig er på et
forløb. Linns definition 15. august. Det rammer sjældent nogen, fordi et
abonnement købt under et forløb først starter dagen efter forløbet, se
afsnittet om udskudte app-køb.

**Hold er ÉT bestemt hold og ikke forløbet generelt.** Linns valg, og det
vendte den anbefaling der stod her først. Prisen er reel og skal kendes:
**hvert nyt hold starter på nul.** Opretter Linn Kickstart januar 2027, har
det ingen træning før hun selv giver det nogle. Derfor findes to ting:
dæknings-siden viser tomme hold øverst og med farve, og der er en knap der
kopierer et tidligere holds tildelinger over med de samme dage.

**Tiden måles to steder.** Til et hold i DAGE, fordi holdet har sin egen
startdato. Til en person, til medlemmer og til alle i DATOER. Det er den
eneste rigtige forskel mellem de fire.

**Dagen er den samme som resten af appen regner med**, altså den
`getCurrentDay` giver, hvor startdatoen er dag 0. Der laves ingen omregning.
En omregning er præcis det der gav en off-by-one i træningen 12. juni.
Skærmen skriver "Dag 0 er forløbets første dag" så der ikke er tvivl.

**Standarden er fra første dag og uden slutdato**, altså den Linn bruger
mest. Der skal fjernes et flueben for at der overhovedet kommer en dato i
spil.

**Kun et program der er sat til klar kan gives ud.** Spærren fra bid 1 gælder
også her, og knappen er slukket med en linje der siger hvorfor.

**Fem regler der ikke har en skærm, men som afgør hvad kunden ser:**

- Får hun det samme program to veje, ser hun det én gang. En aktiv tildeling
  vinder over en der venter
- Er hun på to forløb, tælles dagen i det forløb tildelingen gælder
- Tildeler du fra dag 15 til et hold der er nået til dag 40, får de det med
  det samme. Ikke om 15 dage
- Slutter en tildeling, forsvinder programmet fra hendes liste, men hendes
  fremgang bliver liggende
- Slettes et program, slettes dets tildelinger med. Ellers ligger der rækker
  der peger på ingenting og tæller med i dækningen

**Byg eget program ligger i den samme tabel** som en tildeling uden program,
så adgangen styres med de samme fire knapper. Linns valg.

#### Dækning pr hold

Den skærm der forhindrer at en kunde ender med en tom træningsside. Kunden
vælger sit udstyr og ser kun de programmer der passer, så et hold med fem
redskabs-programmer efterlader en kvinde uden redskaber med ingenting.

Oversigten viser hvert hold plus medlemmer og alle, med Tom, Hul eller OK.
Tomme først. Inde på ét hold står hver kategori med de programmer den har,
og en linje der siger hvad et hul betyder for kunden. **Et hul er ikke altid
en fejl**, og teksten siger derfor følgen og ikke at Linn har gjort noget
forkert.

#### Slå en kunde op

Til den dag hun skriver at hun ikke kan se sin træning. Viser hendes forløb
og dag, om hun har abonnement, hvilket udstyr hun har valgt, hvad hun ser, og
**hvad hun ikke ser og hvorfor**, på almindeligt dansk.

**Svaret regnes med `programmerForKunde3`, altså nøjagtig den samme funktion
kundens egen liste bruger i bid 3.** Ikke en kopi. To udgaver af den regel
ville drive fra hinanden, og så ville admin sige noget andet end kunden
oplever.

**En tom udstyrsliste betyder ja til alt.** Hun har ikke valgt endnu, og
indtil valget findes i bid 3 har ingen kunde valgt noget. Skjulte vi alt for
dem, ville opslaget påstå at 700 kunder ingen træning har.

#### Filerne

| Fil | Hvad | Tests |
|---|---|---|
| `content/traeningTildeling3.ts` | Hvem, hvornår, dækning, kopiering | 49 |
| `firestore/traeningTildeling3.ts` | Tildelingerne |  |
| `firestore/traeningKunde3.ts` | Kunderne set fra admin, med adgang og forløbsdag |  |
| `components/ny/TildelPanel.svelte` | Vælg modtager og periode. Bruges to steder |  |
| `/ny/admin/traening/[id]/tildel` | Hvem har programmet |  |
| `/ny/admin/traening/hold` | Dækning for alle hold |  |
| `/ny/admin/traening/hold/[id]` | Ét hold, plus kopiér-knappen |  |
| `/ny/admin/traening/kunde` | Slå en kunde op |  |
| `/ny/admin/traening/byg-eget` | Hvem må bygge selv |  |

**Adgangen udledes med de samme funktioner som resten af 3.0.**
`adgangsbilledeFor` giver hendes aktive forløb med dagnummer, og
`udledAdgange` giver rækkerne så vi kan se om hun har et aktivt abonnement.

**Firestore-reglerne er KUN admin**, både læsning og skrivning, og det er
anderledes end programmerne i bid 1. Grunden er at en tildeling indeholder
**navnet på den kunde der har fået noget**. Måtte alle indloggede læse
samlingen, kunne en kunde læse hvilke andre kunder der har fået hvad.

**Åben tråd til bid 3:** kunden skal kunne læse sine egne tildelinger. Det
skal ske på en måde hvor hun kun kan hente de rækker der handler om hende,
enten med målrettede forespørgsler plus en skarpere regel, eller gennem et
endpoint. Beslutningen er bevidst udskudt til den skærm findes.

### 29.6 Det hedder træning, ikke dag. LÅST 15. august

Linns rettelse, og den er vigtigere end den lyder.

**Programmets numre rykker kun når hun har trænet.** "Dag 5" ville derfor
lyde som om hun er bagud efter en uges pause. Det er hun ikke, hun har bare
trænet fire gange.

**Og den rydder op i en tvetydighed der lå gemt i modulet:** ordet dag betød
to forskellige ting.

| Hvor | Ordet | Fordi |
|---|---|---|
| Kunden, inde i et program | Træning 5 af 21 | Det er femte gang hun træner |
| Admin, når der bygges | Træning 1, 2, 3 | Samme ord begge steder |
| Admin, når der tildeles | Fra dag 15 i forløbet | Det ER en kalenderdag på holdet |

Rettet overalt i 3.0, også i admin fra bid 1 og 2. **Kun tekst, ingen data.**
Feltet hedder stadig `antalDage` i databasen, og det bliver stående: et
navneskift ville kræve en migrering uden at kunden fik noget ud af det. Brug
`antalTraeninger3()` i UI-kode i stedet, så ordet dag ikke sniger sig tilbage.

### 29.6.1 Kundens side. LÅST og bygget 15. august, bid 3

Mockups i `v3 app/linns-academy-design/mockups-traening-kunde.html`, tegnet
om én gang efter Linns svar.

**Siden hedder Mikrotræning.** Det hun sidst trænede står øverst under "Du er
i gang med", resten nedenunder. Rækkefølgen er: i gang, ikke begyndt,
færdige. Inden for "i gang" står den hun sidst trænede øverst.

**Ingen Vælg-knap.** Hun skal ikke først udpege et program og så starte det,
det er to trin til det samme.

**Filtreringen bruger `programmerForKunde3`**, altså nøjagtig den samme
funktion som admin-opslaget i bid 2. Ikke en kopi.

#### Udstyrsvalget

**Spørgsmålet hører hjemme i onboarding**, første gang en ny kunde logger på,
sammen med resten af det hun skal spørges om. Linns beslutning 15. august.
Onboarding er ikke bygget, så vælgeren bor indtil videre kun i Profil, som
"Sådan træner jeg".

**Vælgeren er derfor en komponent**, `UdstyrValg.svelte`, så onboarding kan
genbruge præcis den skærm i stedet for at få sin egen.

**Kategorier der vises altid kan ikke slås fra.** Uden den lås kunne hun
fjerne alle flueben og stå uden træning, og det er netop det kropsvægt-
kategorien er til for at forhindre.

**En tom udstyrsliste betyder "hun har ikke valgt endnu", og så ser hun
alt.** Det er ikke en midlertidig nødløsning, det er den rigtige regel: at
skjule hendes træning fordi hun ikke er blevet spurgt ville være at straffe
hende for noget vi ikke har bygget. De eksisterende kunder kommer aldrig
gennem onboarding og vil derfor blive stående med tom liste, indtil de selv
vælger i Profil.

#### Den tomme skærm

Der findes **kun én**: "Du har ikke fået nogen træning endnu."

Skærmen om at intet passer til hendes udstyr blev bevidst fjernet 15. august.
Linns pointe: hun har altid sin egen krop, så der er altid noget til hende,
så længe holdet har et program uden redskaber. **Det er dækningssiden fra bid
2 der er værnet**, og den skal bruges.

Konsekvensen skal kendes: har et hold KUN fået programmer med redskaber, ser
en kvinde uden redskaber ingenting, og der står "du har ikke fået nogen
træning endnu", hvilket teknisk set er forkert. Det er accepteret, fordi det
ikke bør kunne ske.

### 29.6.2 Afspilleren. LÅST og bygget 15. august, bid 4

**ÉN afspiller.** Den gamle app har fire næsten ens på cirka 1.400 linjer
hver, én for abo, én for forløb, én for master og én for byg-eget. Her er der
ét program og én afspiller.

**Tilstands-maskinen ligger i `content/afspiller3.ts` som ren logik**, uden
timere, uden lyd og uden video, med 38 tests. Siden tæller kun ned og tegner.
Faserne følger den gamle afspiller nøjagtigt, så træningen føles ens for de
kunder der flyttes over:

```
klar   →  arbejd
arbejd →  hvil      når der er flere sæt tilbage
       →  skift     når sættene er brugt og der er en øvelse mere
       →  færdig    når det var sidste sæt på sidste øvelse
hvil   →  arbejd    med ét sæt mere
skift  →  arbejd    på næste øvelse, første sæt
```

**Når hun går væk, spørges der altid.** Linns krav, og "spørg altid" var også
hendes svar på om vi skulle lade være efter ti sekunder.

| Svar | Hvad der sker |
|---|---|
| Ja | Træningen tæller som gennemført, ryger i historikken, pladsen slettes |
| Nej | Intet gemmes. Den samme træning ligger der igen |
| Gem hvor jeg er | Pladsen gemmes. Træningen tæller ikke |

Gem-knappen vises kun når der faktisk er noget at gemme. Er hun kun nået til
"gør dig klar", er der ingenting at vende tilbage til.

**Kører hun træningen helt færdig, spørges der ikke.** Så er den gennemført,
og hun kommer tilbage til Mikrotræning. Ingen næste træning-knap, Linns valg.

**Hun må tage en træning om, men ikke springe frem.** Linns valg: ellers
betyder "hvor langt er jeg" ingenting. Det tjekkes både i listen og i
afspilleren, så en adresse skrevet i hånden heller ikke kan springe over.

**Den gemte plads er en tilgift.** Kan den ikke hentes, startes træningen
forfra i stedet for at gå i stå. En træning der ikke kan startes er meget
værre end en glemt plads. En plads fra en anden træning genoptages aldrig, så
hun kan ikke blive markeret færdig med noget hun ikke har lavet.

**Historikken skrives i den delte `traeningHistorik`**, så fluebenet passer
uanset hvilken app hun har trænet i. Kilden sættes til `mikrotraening`, fordi
den gamle app kun kender sine egne programtyper og ellers ville bygge et link
til ingenting. Programnavnet gemmes med, så den gamle app viser det rigtige
navn på en historisk dato.

**Skærmen holdes vågen** mens hun træner, og der er baggrundsmusik plus en
lyd tre sekunder før hvert skift. Lyden kan slås fra.

### 29.6.3 Forsidens flise. LÅST og bygget 15. august, bid 5

Flisen fandtes i forvejen, men læste `userDoc.aktivtTraeningsprogram` og
viste den GAMLE apps programmer. Nu viser den det samme som
Mikrotræning-siden, og den er blevet et link.

**Tre tilstande, og de skal se forskellige ud:**

| Tilstand | Hvad hun ser |
|---|---|
| Ingen | Flisen vises slet ikke |
| Vælg | "Vælg din træning · 3 programmer er klar til dig" |
| Program | Navnet · "Træning 5 · 3 øvelser · ca. 8 min", med video |

**Har hun kun ét program, springes "vælg" over.** Der er ikke noget at vælge
imellem, og det ville være et ekstra tryk uden indhold.

**Flisen fører ind i programmet, ikke direkte ind i træningen.** Så ser hun
hvor hun er, før hun starter, og det er den samme vej som fra listen.

**Hentningen kaster aldrig.** Går noget galt, vises ingen flise i stedet for
at vælte forsiden. Træningen er én blok blandt mange, og resten af dagen skal
stadig kunne ses. Selve træningen hentes for sig, så flisen kan vise navnet
selv om dagene ikke når frem.

`videoForDag` er eksporteret fra `forside3.ts`, så flisen bruger nøjagtig den
samme video-hentning med den samme frist. To udgaver ville betyde at den ene
kunne blokere forsiden mens den anden gav op.

**`hentDagensTraening` i `forside3.ts` kaldes ikke længere.** Den står tilbage
nogle dage som fortryd-mulighed og er mærket tydeligt i koden. Holder den nye
flise, slettes den sammen med `DagensTraening`, `FULDT_PROGRAM` og
`RESERVE_PROGRAM`.

**VIGTIGT FØR ET HOLD FLYTTES.** Nu hvor flisen læser den nye model, får en
kunde ingen træningsflise før hun har fået et program tildelt i det nye
system. Det gælder også det første Kickstart-hold der flyttes til 3.0. Programmerne
skal derfor være **bygget og tildelt** før et hold flyttes over. De gamle
kopieres ikke, se 29.9.

### 29.7 Bid 1. LÅST og bygget 15. august

Mockups ligger i `v3 app/linns-academy-design/mockups-traening-admin.html` og
blev gennemgået før der blev kodet.

| Fil | Hvad | Tests |
|---|---|---|
| `content/traeningsprogram3.ts` | Programmer, dage, validering, udkast-fletning | 41 |
| `content/traeningKategori3.ts` | Kategorier, rækkefølge, øvelsesfilter | 27 |
| `firestore/traeningsprogram3.ts` | Programmer og dage | |
| `firestore/traeningKategori3.ts` | Kategorier | |
| `/ny/admin/traening` | Programlisten med kategori-chips | |
| `/ny/admin/traening/kategorier` | Kategorierne | |
| `/ny/admin/traening/[programId]` | Dagene, rediger, fyld ud, sæt til klar | |
| `/ny/admin/traening/[programId]/[dag]` | Øvelserne på én dag | |

**Fire ting der er værd at kende:**

- **Udkast-knappen er ikke pynt.** Et 84-dages program er en hel aften i
  hånden. Generatoren er den samme som den gamle app bruger, og den rører som
  standard KUN de tomme dage. Ellers kunne ét tryk kaste en aftens arbejde væk
- **Programmet husker selv hvor mange dage der mangler øvelser.** Uden det tal
  skulle listen hente 84 dage for hvert program bare for at kunne advare.
  Mangler tallet, går vi ud fra at ALLE dage er tomme. En manglende advarsel er
  værre end en overflødig
- **Opret-formularen ligger på siden og ikke i et ark.** Ark skal portalles ud
  af det område der ruller, og det har kostet en aften før. En admin-side har
  ikke brug for den risiko
- **Øvelserne flyttes med pil op og pil ned**, ikke med træk og slip. Træk er
  upræcist med en finger, og der er sjældent mere end fem øvelser på en dag

**Firestore-reglerne blev udgivet 15. august** efter samme fremgangsmåde som
altid: de live regler blev læst og sammenlignet med repoet først, og igen
bagefter. 67 blokke begge steder, og de er ens.

### 29.8 Rækkefølgen

| Bid | Hvad | Tilstand |
|---|---|---|
| 1 | Datamodel, kategorier, admin så programmer kan bygges | **Færdig 15. august** |
| 2 | Tildeling, dækning pr hold, kunde-opslag, byg-eget-adgang | **Færdig 15. august** |
| 3 | Kundens udstyrsvalg og hendes programliste | **Færdig 15. august** |
| 4 | Afspilleren med Ja, Nej og Gem | **Færdig 15. august** |
| 5 | Forsidens flise kobles på | **Færdig 15. august** |
| 6 | Byg eget program | **Færdig 16. august**, se 29.11 |
| 7 | De seks programmer kopieres over | **Udgår.** Linns valg 16. august, se 29.9 |

**AI-værktøjet til at bygge programmer ligger uden for rækken**, se 29.10. Det
er besluttet og tegnet, og Linns valg er at det kommer efter bid 2. Det kan
altså bygges når som helst herfra, uden at det spærrer for noget andet.

**Udstyrsvalget hører hjemme i onboarding**, første gang en ny kunde logger på.
Linns beslutning 15. august. Onboarding er ikke bygget, så vælgeren bor indtil
videre kun i Profil, og den er lavet som en komponent så onboarding kan
genbruge præcis den skærm. Se 29.6.1.

### 29.9 De gamle programmer kopieres IKKE. Besluttet 16. august

Planen var at kopiere de gamle programmer over med fremgang og det hele.
**Linn droppede det 16. august**, efter en diagnose af hvad der faktisk ligger.
Programmerne bygges i stedet forfra i det nye værktøj.

**Originalerne bliver liggende urørte**, så beslutningen kan tages om. Alt
herunder er målt 16. august og er stadig sandt hvis nogen får brug for det.

#### Hvad der faktisk ligger, og hvorfor "de seks" var forkert

**19 programmer, hvoraf kun 13 er forskellige.** Samme program-id går igen på
flere hold, men indholdet er ikke altid det samme.

| Program | Træninger | Hvor |
|---|---|---|
| Mikrotræning med kettlebell | 21 | Kickstart juni **og** september |
| Mikrotræning uden udstyr | 21 | Kickstart juni **og** september |
| Mikrotræning med kettlebell | 21 | Kickstart maj **og** Lise_Render |
| Mikrotræning uden udstyr | 21 | Kickstart maj **og** Lise_Render |
| 84 dage med kettlebell | 84 | Kropsro maj **og** 16. aug |
| 84 dage uden kettlebell | 84 | Kropsro maj **og** 16. aug |
| SommerRo med kettlebell | 55 | SommerRo |
| SommerRo uden kettlebell | 55 | SommerRo |
| Daglig mikrotræning | 14 | Abo, den gamle |
| Daglig mikrotræning kettlebell | 21 | Abo basis |
| Daglig mikrotræning uden udstyr | 21 | Abo basis |
| Daglig mikrotræning kettlebell | 21 | Abo premium |
| Daglig mikrotræning uden udstyr | 21 | Abo premium |

**Tre ting der overraskede:**

- **Kickstart findes i to udgaver.** Maj og Lise_Render deler én version med
  64 øvelses-poster, juni og september deler en anden med 84. De er ikke ens
- **SommerRo var slet ikke nævnt** i den oprindelige plan. To programmer på 55
- **Abo har fem dokumenter, ikke to**, og premium og basis er ikke samme
  indhold, selv om de hidtil er blevet omtalt som samme program i to udgaver

**Alle øvelser findes i banken.** Intet peger på ingenting, så en kopiering
ville ikke give brudte referencer, hvis beslutningen tages om.

#### Hvad det betyder

**Et hold der flyttes til 3.0 skal have programmer bygget og tildelt først.**
Ikke kopieret, men bygget i det nye værktøj. Ellers har holdet ingen træning,
og forsidens flise er tom.

**Kunderne starter på træning 1.** Uden kopiering er der ingen fremgang at
tage med, så en Kropsro-kunde midt i sit forløb begynder forfra i det nye
program. Det er accepteret.

### 29.10 AI-værktøjet til at bygge programmer. Besluttet 15. august, ikke bygget

Linn skriver sit ønske i fri tekst og snakker sig frem til et program.
Mockups i `v3 app/linns-academy-design/mockups-traening-ai.html`, gennemgået
før noget blev besluttet.

**Til Linn nu, til kunden senere.** Hendes valg. Motoren bygges så den kan
genbruges, men kunden kan først få den når bid 3, 4 og 6 er på plads, altså
når hun har en træningsside, en afspiller og lov til at bygge selv.

**Rækkefølge:** efter bid 2. Linns valg, fordi et program man ikke kan give
til nogen stadig ikke er i brug.

#### Den regel der bærer det hele

**AI'en må aldrig finde på en øvelse.** Beder man en model om et
træningsprogram, foreslår den glad en øvelse der ikke findes i banken, ikke
har en video og ikke kan afspilles. Så ville kunden stå med en tom skærm
midt i en træning.

Løsningen er den samme som `/api/foreslaa-madplan` allerede bruger: øvelserne
sendes med som en pulje, prompten siger at der kun må vælges derfra, og
svaret valideres på serveren. Alt der ikke findes, smides væk.

**Det er samtidig sikkerhedsnettet.** Alle øvelser i banken er Linns egne,
med hendes videoer og hendes forklaringer. AI'en kan sammensætte dem, men den
kan ikke opfinde træning til en kvinde med en dårlig skulder. Fagligheden
bliver ved med at være hendes.

#### Hvad der er besluttet

- **Model: Claude Opus 5.** De øvrige AI-funktioner i appen kører på en
  mindre model, fordi de svarer på korte spørgsmål. Her skal den forstå
  "skånsomt for knæ" og oversætte det til de rigtige øvelser fra flere
  hundrede
- **Prisen** er under 1 krone pr besked, 2 til 4 kroner pr program, og under
  100 kroner for tyve programmer. Til sammenligning koster videoerne i appen
  100 til 130 kroner om måneden. Får kunderne den engang, skal der regnes
  igen, og formentlig bruges en mindre model til dem
- **Forslaget står som et kort med rigtige øvelsesnavne**, ikke som tekst
  inde i samtalen. Linn skal kunne se hvad hun får uden at læse et afsnit
- **Resultatet er et helt almindeligt program i kladde.** Ingen særlig
  AI-type, ingenting er låst, og hun retter i det bagefter som i alt andet
- **Der gemmes ingenting før hun trykker Opret**
- **Et flueben pr samtale afgør om AI'en også skriver dagenes titler og en
  kort tekst.** Linns valg
- **AI'en opretter ikke kategorier.** Beder hun om sjippetov og kategorien
  ikke findes, siger AI'en det. Linn beholder styringen over den liste
  kunden ser
- **Samtalerne gemmes en måned**, så det kan opklares hvad der gik galt hvis
  et program bliver mærkeligt
- **Den daglige grænse genbruges** fra de øvrige AI-funktioner, så en fejl i
  koden ikke kan køre løbsk og koste penge natten over. Kan sættes op for
  admin hvis den bliver for lav

#### At rette et program der findes

Den svære af de to. Linns krav 15. august: den skal både kunne lave nye
programmer og rette dem der findes.

**Der vises altid præcis hvilke dage der bliver ændret, før der gemmes**, med
før og efter, plus en linje om hvad der er urørt. Den linje er lige så vigtig
som listen.

**Kun de dage sætningen handler om sendes til AI'en.** "Uge 3" oversættes
til dag 15 til 21 på vores side. Et 84-dages program kan ikke sendes afsted
hver gang hun skriver en sætning, hverken i tid eller i penge. Kan det ikke
regnes ud, spørger AI'en hvilke dage hun mener i stedet for at gætte.

#### En teknisk beslutning der sparer både penge og kvalitet

**AI'en vælger øvelserne og opbygningen. Den eksisterende generator fordeler
dem over de 84 dage.** Beder man en model skrive 84 dage ud i ét svar, bliver
de sidste tredive sjuskede, og det koster mange penge. Lader man den designe
en uge og lader koden variere den, bliver det både bedre og billigere.

#### Det der ikke er afgjort endnu

- Endpointet. Det bliver et nyt ved siden af, så `/api/ny-ai` og
  `/api/linn-ai` er urørte, men navnet er ikke valgt
- Hvad kunden må, den dag hun får den. Et program hun selv har snakket sig
  frem til er ikke gennemgået af Linn, og det skal der tages stilling til


### 29.11 Bid 6. Kunden bygger sit eget program. LÅST og bygget 16. august

Mockup i `v3 app/linns-academy-design/mockups-traening-byg-eget.html`,
gennemgået og godkendt før der blev kodet.

**Hendes program har præcis samme form som Linns.** Det er hele pointen.
Afspilleren, fremgangen, listen og forsidens flise virker på hendes egne
uden en eneste ny regel. Havde hun fået sin egen lille type, skulle alle
fem steder kende to slags programmer, og de ville drive fra hinanden.

**Id'et afslører hvor programmet ligger.** Hendes får præfikset `egen_`.
Så kan enhver skærm se på id'et alene om den skal hente fra
`traeningsprogrammer3` eller fra hendes egen samling, uden at slå op to
steder først. `hentProgramMedTraeninger3` er det ene sted der router, og
både program-siden og afspilleren går gennem den.

**Træningerne ligger i selve dokumentet**, ikke i en undersamling som
Linns. Linns programmer på 84 dage skal kunne listes uden at trække 84
træninger med. Hendes hentes altid helt, så ét dokument er både enklere
og hurtigere.

#### Beslutningerne, truffet af Linn 16. august

- **Hun bygger flere træninger**, ikke én. Samme slags program som Linns
- **Ingen grænse** på antal træninger eller antal øvelser. Tiden står
  nederst i stedet, så en træning på halvanden time ikke kommer bag på
  hende midt i den
- **Hun kan tilføje og fjerne træninger bagefter.** Den sidste kan ikke
  fjernes, et program uden træninger er ikke et program
- **"Lav et forslag til mig" er sat på forhånd** når hun opretter. Så har
  hun noget at rette i frem for et tomt program, og det er den vej de
  fleste går. Genbruger `genererProgramMedConfig` fra den gamle app
- **Kun øvelser hendes udstyr dækker.** Ingen "vis alle"-knap. Admin har
  den knap, fordi Linn skal kunne bygge til udstyr øvelsesbanken endnu
  ikke kender. Kunden skal ikke se en kettlebell-øvelse hun ikke har
  redskabet til, den er kun i vejen. `oevelserTilKunde3` er reglen
- **Hendes egne filtreres omvendt ikke på udstyr** når de vises i listen.
  Hun har selv valgt øvelserne, så der er ingen kategori at filtrere på.
  Derfor har de `kategoriId: ''` og `egen: true`
- **De står under Linns i listen** med mærkatet "Din egen"
- **Ingen adgang giver ingen knap.** Ikke en grå boks der forklarer hvad
  hun ikke må
- **Tages retten fra hende, bliver programmerne skjult, ikke slettet.**
  Får hun retten igen, er de der stadig
- **Admin kan se dem i kunde-opslaget, men ikke rette i dem.** De er
  hendes

#### Skærmene

| Adresse | Hvad |
|---|---|
| `/ny/traening/byg-eget` | Opret: navn, antal træninger, forslag ja eller nej |
| `/ny/traening/byg-eget/[programId]` | Ret programmet: navn, tilføj og fjern træninger, samlet tid, slet |
| `/ny/traening/byg-eget/[programId]/[nr]` | Ret én træning: øvelser, rækkefølge, sæt og tid |

Adgangen tjekkes på alle tre plus på program-siden og i afspilleren, ikke
kun på knappen i listen. En adresse skrevet i hånden må ikke åbne noget
hun ikke har fået.

#### Firestore

`users/{uid}/mineTraeninger3/{egen_xxx}` med felterne `navn`, `dage`,
`oprettetAt` og `opdateretAt`. Reglen blev udgivet 16. august: hun skriver
selv, admin må også læse.
