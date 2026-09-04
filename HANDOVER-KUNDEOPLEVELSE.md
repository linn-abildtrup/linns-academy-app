# Overdragelse: hvordan kunderne oplever appen

Skrevet 4. september 2026, da Linn sagde: **"vi skal arbejde videre med
hvordan kunderne oplever appen."**

De to andre overdragelser handler om hvad der er bygget.
`HANDOVER-3.0.md` dækker den nye app, `HANDOVER-GAMMEL-APP.md` dækker
driften. **Den her handler om hvad der sker i den anden ende**, altså hos
en kvinde på 52 der lige har købt Kickstart og åbner appen for første
gang.

Alt herunder er målt på rigtige kunder, ikke gættet. Tallene er fra
**Kickstart August 2026 på dag 5 af 21**, og de er et øjebliksbillede.
Kør målingerne igen før du bygger på dem.

---

## 1. Hvad tallene siger

### De falder fra før de kommer ind

| | antal |
|---|---|
| købte forløbet | 323 |
| oprettede en konto | 270 |
| kom aldrig ind | **53** |

**Hver sjette der betaler, kommer aldrig i gang.** Det er det største
enkelttal i hele dokumentet, og det er ikke et app-problem endnu, for vi
ved ikke om de har prøvet. Det ved vi først når vi måler på det.

### De der kom ind, bruger den faktisk

Af 315 konti på holdet:

- **8 har ikke gjort noget som helst** (3%)
- **63 har aldrig tastet et måltid** (20%)
- 303 har taget deres symptomtjek (96%)
- 1170 dage er besvaret, altså 3,7 pr kunde på fem dage
- 396 træninger, 1,3 pr kunde
- 426 faste måltider og 34 egne opskrifter er oprettet

**Symptomtjekket er det eneste næsten alle gør.** Det ligger i opstarten,
det er én gang, og det bliver gjort. Alt andet skal gentages hver dag, og
der er det halen falder af.

### Kurven falder allerede i uge 1

Antal kunder der tastede mad den dag:

```
30. aug   38    (startdagen)
31. aug  211
 1. sep  196
 2. sep  181
 3. sep  162
 4. sep   77    (dagen var ikke slut da der blev målt)
```

**Fra 211 til 162 på fire dage, altså 23% væk.** 34 kunder tastede
præcis én dag og aldrig igen. Det er dem der skal fanges, og det er dem
det er billigst at fange, fordi de allerede er inde.

### To ting bliver stort set aldrig brugt

- **1 ud af 315 har sat sine daglige mål.** Alle andre kører på
  standardtallene, altså 90 g protein og 30 g fiber
- **0 ud af 315 har udfyldt deres profil**, altså højde, vægt, alder og
  fase. Så wizarden "beregn mine mål automatisk" er reelt ubrugt

Det kan betyde at den er svær at finde, at den er for besværlig, eller at
standardtallene er gode nok og at wizarden ikke er nødvendig. **Vi ved det
ikke.** Se de åbne spørgsmål nederst.

---

## 2. Hvad kunderne selv skriver om

121 spørgsmål fra holdet på fem dage. **23 af dem handler om appen selv,
ikke om kost eller træning.** Det er næsten hver femte.

### Det klart største tema: at få appen på hjemmeskærmen

Mindst seks kunder har skrevet og bedt om hjælp til det. Ordret:

> "Hvordan får jeg denne side på min browser til at ligge som en app?"

> "Jeg ønsker også hjælp til at få appen på hjemmeskærmen"

> "Jeg vil gerne have din vejledning i hvordan appen virker på telefonen.
> Jeg kan kun få den til at virke på computeren"

**Vejledningen findes allerede.** 223 af de 314 nye konti har fået den
vist. De sidste 91 sad enten på en computer, hvor den med vilje ikke
vises, eller havde appen liggende i forvejen. **Alligevel skriver de.** Så
den bliver vist, men den lander ikke.

Det er værd at vide at på iPhone findes "Føj til hjemmeskærm" **kun i
Safari**. Sidder hun i Chrome, kan hun følge vejledningen helt korrekt og
stadig ikke finde knappen.

### De andre app-spørgsmål

- **"Jeg kan simpelthen ikke finde ud af hvor jeg skal registrere det jeg
  har spist"**
- **"tirsdag og onsdag forbliver min indtastning ikke"**, altså noget der
  ikke blev gemt
- **"Der er ikke lyd på min træningsvideoer"**
- **"øvelserne med kettlebell virker stadig ikke"**, fra en kunde der har
  valgt kettlebell-varianten
- **"kan ik sende billeder her"** i Beskeder
- **"Jeg er kommet til at udfylde et spørgsmål i mit første skema
  forkert. Kan jeg få lov til at rette i den"**, altså symptomtjekket der
  bevidst ikke kan rettes
- PDF-download der ikke virker, og en enhed der kun kunne sættes i gram

**De skriver ikke for at brokke sig.** De skriver fordi de gerne vil i
gang. Det er den bedste slags henvendelse man kan få, og det er også den
dyreste at besvare én ad gangen.

### 33 spørgsmål venter stadig på svar

Det er hver fjerde. Det er ikke et teknisk problem, men det er en del af
oplevelsen: en kunde der spørger på dag 2 og får svar på dag 6, er en
kunde der har taget en beslutning i mellemtiden.

---

## 3. Hvad der allerede er gjort på området

Så du ikke bygger noget der findes:

- **Hjemmeskærm-vejledning** for konti oprettet efter 29. august. Vises
  ikke til admin og ikke på computer. Se `content/hjemmeskaerm.ts`
- **Fire intro-skærme og info-knapper på ti sider** i 3.0. Se
  `project_intro_og_info` og afsnit i `HANDOVER-3.0.md`
- **Linn AI** kan svare på kundens eget forløb, dens FAQ og hendes egen
  historik. Den kan altså allerede tage en del af de 121 spørgsmål, hvis
  hun finder den
- **App-hjælp** i den gamle app, `content/appHjaelp.ts`. Den skal holdes
  ved lige i hånden hver gang kunde-siden ændres
- **Beskeder** er lavet om til at ligne en chat, 3. september
- **Kunde-opslaget i admin**, bygget 3. og 4. september, viser nu alt om
  én kunde. Det er værktøjet til at se hvad der sker hos den enkelte

---

## 4. Fire fælder jeg selv faldt i, som gælder alt arbejde her

De koster tid hver gang, og de er alle fundet den 3. og 4. september.

**1. Der er to apper, og de gemmer forskelligt.** Træning ligger ét sted
i 3.0 og et andet i den gamle app. Beskeder på telefonen findes **kun** i
3.0. Kigger du kun ét sted, får du et svar der ser rigtigt ud og er
forkert for to tredjedele af kunderne. Spørg altid: gælder det her også
den gamle app?

**2. Reglerne for hvem der må læse hvad er ikke det samme som hvad der
står i databasen.** En side der får nej, ser tom ud. Se afsnit 9.66 i
`HANDOVER-3.0.md`.

**3. En status må aldrig gætte.** Kunne et tal ikke hentes, skal der stå
det, ikke det værste. Og en status om et menneske må aldrig læse som en
anklage.

**4. Et tal der altid er sandt, betyder ingenting.** "Kan ikke nås på
telefonen" stod på alle 315 kunder, fordi funktionen ikke findes i deres
app. Et punkt der aldrig kan være falsk, er støj.

---

## 5. Sådan måler du det selv

Skriv scriptet som `scripts/_navn.ts`, kør med `npx tsx`, **slet det
bagefter**. Read-only altid først. Nøglen ligger i
`scripts/service-account-key.json`.

Det du skal kigge på for at forstå oplevelsen:

| spørgsmål | hvor |
|---|---|
| kom hun ind? | `allowedEmails` med `status`, mod `users` |
| har hun gjort noget? | `users/{uid}/maaltider`, `traeningHistorik`, `mrs_scores` |
| hvor mange dage i træk? | `maaltider`, felt `dato`, tæl unikke |
| har hun sat appen op? | `dagligeMaal`, `brugerProfil` på kunden |
| så hun vejledningen? | `hjemmeskaermVistAt` |
| hvad spørger hun om? | `klientspoergsmaal` med `forlobId` |
| hvor langt er hun? | `users/{uid}/products/{id}/vanedage` |

**Login-datoen lyver.** En kunde med appen på hjemmeskærmen står logget
ind i månedsvis uden at åbne noget. Mål på hvad hun har registreret.

---

## 6. Det jeg ville gøre først, hvis det var mit valg

Rækkefølgen er efter hvor mange kunder det rammer, ikke efter hvor sjovt
det er at bygge.

**1. Find ud af hvorfor 53 aldrig kom ind.** Det er 16% af omsætningen på
et hold. Det kan være mailen, købsflowet, loginet eller noget helt
fjerde. Det kræver ikke kode at undersøge, det kræver at der bliver
spurgt.

**2. Gør hjemmeskærmen til noget der bliver løst, ikke noget der bliver
vist.** Seks kunder skrev om det på fem dage, og vejledningen blev vist
til 223. Overvej at spørge bagefter om det lykkedes, og at fange
iPhone-kunder i Chrome før de går i gang.

**3. Fang hende der tastede én dag.** 34 kunder gjorde præcis det. Der er
allerede beskeder på telefonen i 3.0 og en savn-besked bygget. Spørgsmålet
er hvad der skal stå, og det er Linns, ikke kodens.

**4. Gør "hvor taster jeg min mad" umuligt at overse.** Mindst én kunde
kunne slet ikke finde det, og det er den handling hele forløbet hviler på.

**5. Lad Linn AI tage de 23 app-spørgsmål.** Den kan allerede svare på
forløbet. Kan den også svare "sådan får du appen på hjemmeskærmen", er
hver femte henvendelse væk, og de resterende når hurtigere frem.

**6. Tag de tre konkrete fejl** som kunder har meldt: lyd på
træningsvideoer, kettlebell-øvelser der ikke kommer frem, og en
indtastning der ikke blev gemt. De skal først bekræftes, for de kan alle
tre være misforståelser.

---

## 7. Det jeg ikke ved, og som Linn skal svare på

- **Er standardmålene på 90 g protein og 30 g fiber det rigtige for
  alle?** 314 af 315 kører på dem. Enten er wizarden overflødig, eller
  også får en del kunder et mål der ikke passer til dem. Linn har allerede
  besluttet at 90 ikke ændres, men spørgsmålet om wizarden står åbent
- **Skal symptomtjekket kunne rettes?** En kunde har spurgt. Det er
  bevidst spærret, fordi det er forskningsdata, men hun sad med en
  fejludfyldt baseline hun skal måles op imod i tre uger
- **Hvor meget skal appen skubbe?** Der er bygget beskeder, savn-besked og
  vagt i 3.0. Grænsen mellem at hjælpe og at genere er Linns at trække
- **Hvad er en god uge for en kunde?** Uden et svar på det kan hverken
  appen eller admin sige om det går godt. I dag tæller vi bare

---

## 8. Tonen, som ikke er til forhandling

Den står i `CLAUDE.md` og i de andre overdragelser, men den hører hjemme
her, fordi den er hele forskellen på om kunden bliver:

- **En status må aldrig læse som en anklage.** En dag uden registrering er
  en dag vi ikke ved noget om, ikke en nul-dag
- **Snittet regnes på de dage hun har tastet**, ikke på alle dage
- **Et symptomtjek der går den forkerte vej** siger noget om en krop i en
  hård periode, ikke om en kunde der ikke gør sit arbejde
- **Tilbud er bløde, aldrig krav.** Facebook-gruppen er tegnet med tre
  svarmuligheder af netop den grund
- Målgruppen er kvinder i overgangsalderen, mange uden teknisk erfaring.
  **Tekst-skalering, læsbarhed og enkle flows er ikke pynt, det er kernen**

---

*Kør tallene igen før du bruger dem. Holdet er på dag 5 af 21 her, og
billedet ser anderledes ud i uge 3.*
