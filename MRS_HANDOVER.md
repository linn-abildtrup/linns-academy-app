# MRS Symptomcheck: Handover til implementering i linns-academy-app

## Hvad er dette?

Linn's Academy kører et 21-dages forløb ("Kickstart en sund overgangsalder") via en SvelteKit-app. Vi skal bygge en Menopause Rating Scale (MRS) symptomcheck ind i appen, så deltagerne udfylder den tre gange: dag 0 (startpunkt), dag 10-11 (midtvejs) og dag 21 (afslutning). Det giver os validerede data til at måle effekten af forløbet.

## Tech stack

- **Framework:** SvelteKit
- **Hosting:** Cloudflare Pages
- **Auth:** Firebase Auth (email/password)
- **Database:** Firestore
- **Projekt-ID:** vanetracker

## Hvad skal bygges

### 1. Svelte-komponent: MRSCheck.svelte

Konverter den medfølgende HTML-fil (`MRS_Kickstart.html`) til en Svelte-komponent. Al logik, styling og indhold er komplet i HTML-filen. Nøglepunkter:

- 11 spørgsmål fordelt på 3 grupper (Krop og søvn, Humør og energi, Underliv og blære)
- 5 sværhedsgrader per spørgsmål: Ingen (0), Lidt (1), En del (2), Meget (3), Voldsomt (4)
- Scoring: total 0-44, tre subskala-scorer
- Resultatside med bar-visualisering per symptom
- Tre målepunkter vælges via knapper: Startpunkt (dag 0), Midtvejs (dag 10-11), Afslutning (dag 21)

### 2. Firestore-struktur

Gem hvert udfyldt MRS-skema som et dokument:

```
Collection: mrs_scores
Document ID: auto-generated
{
  uid: "brugerens firebase auth uid",
  email: "brugerens email",
  measurePoint: "baseline" | "midtvejs" | "afslutning",
  timestamp: Firestore serverTimestamp,
  scores: {
    1: 2,    // Hedeture: "En del"
    2: 0,    // Hjertebanken: "Ingen"
    3: 3,    // Søvnproblemer: "Meget"
    4: 1,    // Nedtrykthed: "Lidt"
    5: 2,    // Irritabilitet: "En del"
    6: 1,    // Uro: "Lidt"
    7: 3,    // Træthed: "Meget"
    8: 1,    // Sexlyst: "Lidt"
    9: 0,    // Blære: "Ingen"
    10: 2,   // Tørhed: "En del"
    11: 2    // Led/muskel: "En del"
  },
  subscales: {
    somatisk: 7,      // items 1+2+3+11, max 16
    psykologisk: 7,   // items 4+5+6+7, max 16
    urogenital: 3     // items 8+9+10, max 12
  },
  total: 17           // sum af alle, max 44
}
```

### 3. Firestore Security Rules

Tilføj til eksisterende regler:

```
match /mrs_scores/{docId} {
  allow create: if request.auth != null
    && request.resource.data.uid == request.auth.uid;
  allow read: if request.auth != null
    && resource.data.uid == request.auth.uid;
  allow update, delete: if false;
}
```

Bemærk: ingen update/delete. Hvert skema er immutable. Hvis en bruger udfylder samme målepunkt to gange, gemmes begge (vi bruger den nyeste ved visning).

### 4. Route i appen

Placer komponenten som en side der kan tilgås fra den eksisterende 21-dages path:

- Route: `/mrs` eller integrer direkte i den eksisterende dag-visning
- Komponenten skal vide hvilken bruger der er logget ind (brug eksisterende Firebase Auth context)
- Efter submit: gem til Firestore, vis resultat, og vis en "Tilbage til forløbet"-knap

### 5. Sammenligninsvisning (kan bygges som fase 2)

Når brugeren har 2+ udfyldelser, vis en sammenligning:

- Hent alle `mrs_scores` dokumenter for brugeren, sorteret efter timestamp
- Vis side-by-side: baseline vs. midtvejs vs. afslutning
- Vis delta (forbedring/forværring) per symptom og total
- Farvekod: grøn = forbedring, rød = forværring, grå = uændret

## Brand-styling (allerede i HTML-filen)

- Fonts: Playfair Display (overskrifter), DM Sans (brødtekst)
- Farver: plum #2A0F1E, terracotta #C4624A, dusty rose #FDF4F7
- Subskala-farver: somatisk #C4624A, psykologisk #2A0F1E, urogenital #8B5E3C

## De 11 MRS-spørgsmål (dansk tilpasning)

For reference, her er alle spørgsmål med ID, gruppe og tekst:

| ID | Gruppe | Symptom | Beskrivelse |
|----|--------|---------|-------------|
| 1 | Krop og søvn | Hedeture og svedeture | Pludselige varmebølger, svedanfald, nattesved |
| 2 | Krop og søvn | Hjertebanken | Hjertet der banker hårdt, springer et slag over, løber hurtigt, eller trykken for brystet |
| 3 | Krop og søvn | Søvnproblemer | Svært ved at falde i søvn, vågner midt om natten, vågner for tidligt |
| 4 | Humør og energi | Nedtrykthed og humørsvingninger | Føler mig nede, trist, tårer tæt på, mangler drivkraft, humøret svinger |
| 5 | Humør og energi | Irritabilitet | Kort lunte, indre spænding, let til at blive frustreret |
| 6 | Humør og energi | Uro og ængstelse | Indre uro, bekymringstanker, følelse af panik |
| 7 | Humør og energi | Træthed og hjernetåge | Mangler overskud, dårlig hukommelse, svært ved at koncentrere mig, glemsomhed |
| 8 | Underliv og blære | Ændringer i sexlyst | Mindre lyst til sex, ændret seksuel tilfredshed |
| 9 | Underliv og blære | Blæreproblemer | Skal tisse oftere, svært ved at holde sig, lidt urinlækage |
| 10 | Underliv og blære | Tørhed nedadtil | Tørhed eller svien i skeden, ubehag ved samleje |
| 11 | Krop og søvn | Led- og muskelsmerter | Ømhed i led, stivhed, muskelsmerter, gigtlignende gener |

## Sværhedsgrader

| Værdi | Label |
|-------|-------|
| 0 | Ingen |
| 1 | Lidt |
| 2 | En del |
| 3 | Meget |
| 4 | Voldsomt |

## Scoring og fortolkning

| Total score | Fortolkning |
|-------------|-------------|
| 0-4 | Ingen eller meget få gener |
| 5-8 | Lette gener |
| 9-16 | Mærkbare gener |
| 17-24 | Tydelige gener i hverdagen |
| 25-44 | Kraftige gener der fylder meget |

## Arbejdsgang

1. Læs `MRS_Kickstart.html` for komplet UI-reference (al styling, logik og tekst er der)
2. Opret Svelte-komponenten baseret på HTML-filen
3. Tilføj Firestore-integration (gem ved submit)
4. Tilføj Firestore security rules
5. Integrer i eksisterende navigation/path
6. Test: udfyld som testbruger, verificer data i Firestore console

## Vigtigt

- Bo arbejder step-by-step via terminalen. Giv én kommando ad gangen med forklaring.
- Giv komplette filer, ikke partielle edits med "find linje X og erstat."
- Sæt eksplicitte stop-punkter før irreversible handlinger (deploy, Firestore rules push).
- Appen ligger i mappen `linns-academy-app` på Linns MacBook.
