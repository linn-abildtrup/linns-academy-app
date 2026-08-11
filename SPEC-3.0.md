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

## 27. Åbne punkter på Mad

- Farve på plejer-fliserne: udskudt med vilje, og de holdes hvide indtil
  videre, fordi de fire veje allerede bærer farven
- ~~Madplanen~~. **Parkeret 11. august.** Ikonet er fjernet, motoren er urørt
- Gamle registreringer med enheder der ikke giver mening for varen, fx "1 spsk
  æg", dukker op som forslag under "det du plejer". Set hos test-profilen 11.
  august. Afklares om det også sker hos rigtige kunder
- **128 af 130 opskrifter mangler et billede.** Værktøjet er bygget, se 26.7.
  De to der har et, har kun den store udgave
- **`static/mockup/` skal slettes.** Var stillads til 30-30 og er ikke i brug

**Arbejdsform aftalt 9. august:** vi tager Mad ét skærmbillede ad gangen i
stedet for at tegne hele modulet på én gang. De første fem runder mockups
byggede på gæt om hvad Mad indeholdt, og det skal ikke gentages.
