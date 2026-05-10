# Handover til næste chat — v20

Status efter session 20 (10. maj 2026). **15 commits siden v19.** Sessionen handler primært om to store områder:

1. **Simplero-webhook integration** — fuldt sat op, testet ende-til-ende, første rigtige test-køb gik igennem
2. **Adgangsmodel og bibliotek-rebuild** — 4 produkter, 90-dages bibliotek-bonus, "ingen adgang"-side, lektioner per forløbs-type

Plus R2 audio-upload, refactor af `userDoc.state` til `userAdgang`-helpers, og et 5-års data-sletnings-script.

**Der er ÉT vigtigt åbent punkt:** Simplero-cancel-trigger er ikke sat op endnu. Når det er på plads er hele købs/cancel-flowet automatiseret. Se afsnit nedenfor.

---

## Status quo

**Live URL:** `https://linns-academy-app.pages.dev`
**Deploy:** Auto fra `main` på Cloudflare Pages, 2-4 min pr commit
**Tests:** 298 tests passerer, 0 type-fejl, 0 svelte-warnings
**Test-brugere (uændret + 1 ny):**
- `forlob@linnsacademy.dk` — Maria, forløbskunde, Kickstart maj 2026
- `modul@linnsacademy.dk` — Anne, modulbruger
- `udlobet@linnsacademy.dk` — Sofia, udløbet
- `linnabildtrup00@gmail.com` — Linn, admin (modulbruger som default)
- `bo_andersen1@icloud.com` — **Bo, første rigtige Simplero-test-kunde** (basis-abo via produkt 255519). Oprettet via webhook → access-felter automatisk syncet ved login.

---

## ⚠️ Simplero-webhook integration — vigtigt at læse fuldt

### Datamodel (i Firestore)

På `users/{uid}` doc:
```
accessLevel: 'none' | 'basis' | 'premium'
accessSource: 'abonnement' | 'forløb'
activeProduct: 'kickstart' | 'premiumforløb' | 'basisabo' | 'premiumabo'
activeSubscription: boolean
simpleroCustomerId: string  (Simperos egen kunde-id)
expiresAt: number | null
bonusPeriodEndsAt: number | null  (forløb-slut + 90 dage)
forlobIds: string[]  (ALDRIG overskrives — append-only via arrayUnion)
state: 'modulbruger' | 'forlobskunde' | 'udlobet'  (legacy, holdes i sync via udledState helper)
updatedAt: number
```

På `allowedEmails/{email}` doc — bruges som whitelist for kunder der ikke har en konto endnu:
```
email, accessLevel, accessSource, activeProduct, activeSubscription,
simpleroCustomerId, forlobId (singular), state
```

Når brugeren logger ind første gang, kører `synkroniserForlobskundeStatus(uid, email, current)` (i `src/lib/userDoc.ts`) og kopierer felterne over på `users/{uid}`. **VIGTIGT:** `forlobId` (string) på allowedEmails konverteres til `forlobIds` (string[]) på userDoc via `arrayUnion` — så historik bevares hvis kunden har været på flere forløb.

### Endpoint

**URL:** `https://linns-academy-app.pages.dev/api/simplero-webhook`
**Filer:** `src/routes/api/simplero-webhook/+server.ts`

GET returnerer status-besked (`{"ok":true,"message":"Simplero webhook endpoint klar"}`). Bruges til at verificere at endpointet er live.

POST modtager Simperos webhook-payload, parser det, og opdaterer Firestore.

### Authentication mod Firestore

Cloudflare Pages-funktioner kører på Workers runtime — `firebase-admin` (Node-baseret) virker IKKE der. I stedet bruger vi en custom Firestore REST-klient i `src/lib/server/firestoreRest.ts` der:

1. Genererer service-account JWT (RS256-signeret med Web Crypto API)
2. Bytter JWT til OAuth-access-token via Google's token-endpoint
3. Cacher token i ~50 minutter (60 min gyldigt) per Worker-instans
4. Bruger token mod Firestore REST API

**3 env vars i Cloudflare Pages (alle som "Secret"):**
```
FIREBASE_PROJECT_ID = linns-academy-app
FIREBASE_CLIENT_EMAIL = firebase-adminsdk-fbsvc@linns-academy-app.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY = -----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----
```

Private key kan have linjeskift som de er i Cloudflare's textarea — koden håndterer både rigtige newlines og `\n`-escapede.

### Simperos faktiske payload-format

⚠️ **Simperos AI-chat gav et FORKERT format-svar.** Det rigtige format er HELT FLADT (alle felter på top-level), ikke `data.customer.email` som AI'en påstod. Faktisk payload fra et test-køb:

```json
{
  "object_type": "Purchase",
  "id": 47584899,
  "product_id": 255519,
  "customer_id": 45600153,
  "email": "bo_andersen1@icloud.com",
  "state": "paid",
  "first_names": "bo_test",
  "last_name": "andersen_test",
  "purchased_at": "2026-05-09T22:24:42.000+02:00",
  "period_ends_at": "2026-06-09T22:24:42.000+02:00",
  "auto_renew": true,
  "canceled_at": null,
  "refunded_at": null,
  "currency_code": "DKK",
  "received_total_cents": 300,
  "purchase": { /* duplikat af data + entrants[] med contact-info */ },
  "transactions": [ /* charge-detaljer */ ]
}
```

Min parser (`uddragEvent`, `uddragEmail`, `uddragProduktId`, `uddragKundeId`) håndterer både dette flade format OG mit gamle "test-format" (`data.customer.email`) for at gøre unit-test simplere. Det er bevidst defensiv kodning.

**Event-type udledes** via en simpel prioriteret tjek:
1. Hvis `payload.event` eller `payload.type` er sat → brug det
2. Hvis `refunded_at` er ikke-null → `purchase.refunded`
3. Hvis `canceled_at` er ikke-null eller `state === 'canceled'` → `purchase.cancelled`
4. Hvis `object_type === 'Purchase'` og `state === 'paid'` → `purchase.paid`

Cancel/refund/expired-detektion sker via substring-match (`event.includes('cancel')` osv.) så Simplero-variationer fanges.

### Trigger-konfiguration i Simplero

⚠️ **VIGTIGT: I Simplero hedder det "Triggers", IKKE "Webhooks"!** Den naive forventning (Settings → Webhooks → tilføj events på webhook'en) virker ikke fordi webhook'en under Settings KUN er en URL-definition.

**Den rigtige sti:** `Marketing → Triggers`

Hver trigger har:
- **When this happens** = event-type (fx "Purchase: Activated/Renewed")
- **For this object** = produktet (fx "Linn's Academy App")
- **Action** = "Post to webhook" + URL eller webhook-navn

**Aktuel konfiguration (per maj 2026):**

| Trigger | Event | Produkt | Webhook URL |
|---|---|---|---|
| Linn's Academy — Køb aktiveret | Purchase: Activated/Renewed | Linn's Academy App | `linns-academy-worker.linnabildtrup00.workers.dev/simplero-webhook?secret=LA_WEBHOOK_2026_xK9mQpR4` (gammel app) |
| Linn's Academy — Adgang deaktiveret | (?) | Linn's Academy App | Samme gamle worker |
| (Vores nye — purchase) | Purchase: Activated/Renewed | Linn's Academy App | `https://linns-academy-app.pages.dev/api/simplero-webhook` ✅ |

**Cancel-trigger er IKKE oprettet endnu.** Det er det vigtigste åbne punkt.

### Hvad der skal gøres i Simplero (åbent)

1. **Opret cancel-trigger:** `Marketing → Triggers → Create trigger`
   - Event: "Purchase: Cancelled" (eller "Subscription: Cancelled" — afhænger af hvad Simplero kalder det)
   - Produkt: Linn's Academy App
   - Action: Post to webhook → `https://linns-academy-app.pages.dev/api/simplero-webhook`
2. **Opret refund-trigger** (samme mønster, event = Refund)
3. **Sæt webhook signing-secret** hvis Simplero understøtter det → tilføj som Cloudflare Pages env var `SIMPLERO_WEBHOOK_SECRET`. Min parser tjekker både `X-Simplero-Signature` og `X-Webhook-Signature` headers og verificerer HMAC-SHA256 (med eller uden `sha256=`-prefix). Hvis SECRET ikke er sat, springes verifikation over (det er OK mens vi tester).
4. **Opret triggers for de andre 3 produkter** (premium-app, Kickstart-forløb, Premium-forløb) når de findes i Simplero. Tilføj produkt-ID til `src/lib/simplero/produktMapping.ts` (en linje pr produkt).

### Testet ende-til-ende

Følgende er bekræftet at virke:
1. **Manuel POST med test-data** → bruger oprettet med korrekte felter
2. **Cancel-event manuelt** → accessLevel='none', state='udlobet'
3. **Rigtigt køb fra Simplero** (Bo, 9. maj 22:24) → allowedEmails oprettet → Bo loggede ind → access-felter syncet til hans userDoc
4. **Rigtig Bo-konto** har: accessLevel='basis', accessSource='abonnement', activeProduct='basisabo', simpleroCustomerId='45600153', state='modulbruger'

### Webhook-log

Alle webhook-events (godkendte og afviste) logges til `webhookLog/{timestamp-randId}` i Firestore. Felter:
- `modtaget` (timestamp), `event`, `email`, `produktId`
- `status` ('granted' / 'cancelled' / 'skipped')
- `note` (forklaring)
- `payload` (JSON string, max 9000 chars)

Bruges til debugging når noget mystisk sker.

### Kendte gotchas

- **Webhook-tæller i Simplero kan stå "1 use"** uden at noget er kommet igennem — det er fordi rod-URL svarer 405 (Method Not Allowed). Hvis Use-tæller stiger men `webhookLog` er tom → URL'en mangler `/api/simplero-webhook`-stien.
- **API-tokenen til R2** ligger på samme Cloudflare-konto. Ikke samme som Firebase-credentials. Forveksl ikke.
- **CORS på R2-bucket** skal være sat hvis vi nogensinde gør PUT direkte fra browser (det gør vi til lyd-uploads). Konfiguration ligger i bucket settings i Cloudflare Dashboard.

---

## Adgangs-modellen (4 produkter)

Single source of truth: **`src/lib/content/produkter.ts`**

| Produkt | accessLevel | accessSource | activeProduct | Simplero-ID |
|---|---|---|---|---|
| Basis-app (abonnement) | basis | abonnement | basisabo | **255519** |
| Premium-app (abonnement) | premium | abonnement | premiumabo | (TBD) |
| Kickstart-forløb (engangs) | basis | forløb | kickstart | (TBD) |
| Premium-forløb (engangs) | premium | forløb | premiumforløb | (TBD) |

Når Linn opretter et nyt produkt i Simplero, skal kun `simpleroProduktId` opdateres i `produkter.ts`. Webhook + mapping bruger den config automatisk.

### Adgangs-helpers (`src/lib/utils/userAdgang.ts`)

```ts
effektivState(userDoc) → 'modulbruger' | 'forlobskunde' | 'udlobet' | null
erForlobsklient(userDoc) → boolean
erModulbruger(userDoc) → boolean
erUdlobet(userDoc) → boolean
harPremium(userDoc) → boolean
harBasisAdgang(userDoc) → boolean  (basis ELLER premium)
harGennemfoertForlob(userDoc) → boolean  (forlobIds.length > 0)
erIBonusPeriode(userDoc) → boolean  (bonusPeriodEndsAt > now)
harBibliotekAdgang(userDoc) → boolean  (basis ELLER bonus aktiv)
harIngenAdgang(userDoc) → boolean  (ingen basis OG ingen bonus)
udledState(level, source) → UserState  (mapping fra nye felter til legacy state)
```

Etape 2 er færdig: alle 6 callsites af `userDoc.state` er refactoreret til `effektivState(userDoc)` eller specifikke helpers. Legacy `state`-felt holdes i sync så bagudkompatibilitet bevares.

### Adgangs-matrix per kunde-type

Vises også i kommentarerne i `produkter.ts`. Hvis du opdaterer adgangen, opdater BÅDE matrixen i kommentaren og koden.

| Funktion | Basis-abo | Premium-abo | Kickstart aktiv | Kickstart bonus (0-90 dage) | Efter 90 dage | Premium-forløb |
|---|---|---|---|---|---|---|
| Mikrotræning (modul) | ✅ | ✅ | ✅ | 🔒 | 🔒 | ✅ |
| Kost (modul) | ✅ | ✅ | ✅ | 🔒 | 🔒 | ✅ |
| Vaner | ✅ | ✅ | ✅ | 🔒 | 🔒 | ✅ |
| Mit forløb | 🔒 | 🔒 | ✅ | 🔒 | 🔒 | ✅ |
| Beskeder | 🔒 | 🔒 | ✅ | 🔒 | 🔒 | ✅ |
| **Bibliotek (alle faner)** | ✅ | ✅ | ✅ | ✅ | 🔒 | ✅ |
| **App-adgang overhovedet** | ✅ | ✅ | ✅ | ✅ | ❌ IngenAdgangScreen | ✅ |

### 90-dages bibliotek-bonus

Når et **forløbs-køb** registreres i webhook'en, sætter vi:
```
bonusPeriodEndsAt = period_ends_at + 90 dage
```

(`period_ends_at` kommer fra Simperos payload — for Kickstart er det "sidste dag i forløbet"). Det er KUN for forløbs-køb; abonnementer mister adgang øjeblikkeligt ved cancel som normal SaaS-adfærd.

I løbet af bonus-perioden har brugeren bibliotek-adgang selv uden aktivt abonnement. Efter 90 dage vises `IngenAdgangScreen` (en venlig "Køb adgang"-side med Simplero-link).

**Eksisterende kunder har IKKE bonusPeriodEndsAt sat retroaktivt** — Linn har valgt ikke at gøre det. De vil have ubegrænset adgang indtil deres næste Simplero-event.

---

## Bibliotek-modul (kraftig udvidelse)

Bibliotek er nu det centrale sted for alt brugerens personlige indhold. Faner i rækkefølge:

| Fane | Vises for | Indhold |
|---|---|---|
| **FAQ** | Forløbskunder kun | FAQ fra aktive forløb |
| **Links** | Alle med adgang | Links/guides fra alle forløb |
| **Kickstart lektioner** | Brugere med userProducts/kickstart | Lektioner fra Kickstart-forløb |
| **Premium lektioner** | Brugere med userProducts/premiumforløb | (kommer når Premium-forløb findes) |
| **Træningsøvelser** | Brugere der har gennemført forløb | Alle øvelser, in-page video-afspiller |
| **Opskrifter** | Alle med adgang | Globale opskrifter med søgefelt |

### Lektioner per forløbs-type

Lektioner er IKKE længere én sammenflyttet liste — de er grupperet per `userProducts/{productId}`. Hver type får sin egen fane med label fra `LEKTION_TAB_LABELS`-mappen i `bibliotek/+page.svelte`. Når en bruger har været på flere forløbs-typer (Kickstart + Premium), ser hun begge faner samtidigt.

Fallback: Hvis en bruger har `userDoc.forlobIds` men ingen `users/{uid}/products/{productId}` med forlobId-felt (legacy/test-data), vises lektioner under "Kickstart lektioner".

### Søgefelt for opskrifter

Søger i `titel`, `beskrivelse` og `kategorier`. Live filter mens man skriver.

### "Tilføj til byg-måltid" skjult fra bibliotek

Når brugeren klikker en opskrift i biblioteket → URL får `?fra=bibliotek` query-param. Detaljesiden tjekker `page.url.searchParams.get('fra') === 'bibliotek'` og skjuler tilføj-knappen. Hvis hun går samme vej via Kost-modulet, vises knappen som før.

### Aggregering på tværs af forløb

`hentBrugerensForlobIds(uid)` læser primært `userDoc.forlobIds` (autoritativ kilde) og falder tilbage til at scanne `users/{uid}/products` hvis arrayet er tomt (dækker brugere oprettet før `forlobIds`-feltet kom). Dette bruges af FAQ + Links + Træningsøvelser-loadingen.

`hentForlobIdsPerProduct(uid)` returnerer `Map<productType, string[]>` ved at scanne userProducts. Bruges af lektion-loadingen til at gruppere per type.

---

## Andre væsentlige ændringer

### R2 audio-upload (admin)

Drag-drop af lydfiler direkte til admin-lektion-editoren og bibliotek-admin (under Links/guides):
- `POST /api/r2-upload-url` returnerer pre-signed PUT-URL (10 min gyldig)
- Browser uploader filen direkte til R2 (data går ikke gennem vores worker)
- Public URL udfyldes automatisk i URL-feltet på lektionen

5 env vars i Cloudflare: `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_ENDPOINT`, `R2_BUCKET_NAME=linnsacademy-lyd`, `R2_PUBLIC_URL=https://pub-4f526394523f42d585b00199ea52c091.r2.dev`.

CORS-policy på bucket'en tillader PUT fra `linns-academy-app.pages.dev` + `localhost:5173`.

### TabBar-ændringer

- **Admin-indstillinger-ikon** (settings-ikon) ved siden af klient-toggle. Kun synlig når admin er IKKE i klient-mode.
- **Klient-tabs (Forside/Moduler/Udvikling) skjules** når admin er i admin-mode. Vises igen i klient-mode for at teste klientoplevelsen.
- **Beskeder låst for modulbrugere** (`lockedFor: ['udlobet', 'modulbruger']`). Admin omgås tjekket selvom Linns egen state er 'modulbruger'.

### IngenAdgangScreen

Komponent: `src/lib/components/IngenAdgangScreen.svelte`. Vises i `/app/+layout.svelte` *før* normalt indhold renderes hvis `harIngenAdgang(userDoc)` er true. Admin omgås tjekket. Indeholder logo, "Se tilbud"-knap (åbner linn.simplero.com), log-ud-knap, og kontakt-link.

### 5-års data-sletnings-script

`scripts/slet-inaktive-brugere.ts` — kør årligt med `npx tsx scripts/slet-inaktive-brugere.ts --skriv`.

Tjekker disse felter for "sidste aktivitet": `updatedAt`, `bonusPeriodEndsAt`, `expiresAt`, `createdAt`, og seneste `koebt` på userProducts. Kandidater er brugere hvor seneste er > 5 år.

For hver kandidat slettes:
- `users/{uid}` doc + alle sub-collections (rekursivt)
- `allowedEmails/{email}`
- `klientspoergsmaal` hvor uid matcher
- Firebase Auth-konto

Default-tærskel er 5 år, kan justeres med `--aar=4`. Kører dry-run uden `--skriv`.

### State→access migration (kørt)

`scripts/migrer-state-til-access.ts --skriv` blev kørt 9. maj. 5 brugere + 1 allowedEmail fik tilføjet `accessLevel`/`accessSource`/`activeProduct`. Gammelt `state`-felt blev bevaret til bagudkompatibilitet.

### allowedEmails-cleanup (kørt)

`scripts/ryd-allowedemails.ts --skriv` blev kørt 8. maj. 342 leftover allowedEmails fra gammel CSV-import slettet. Kun 1 tilbage (forlob@linnsacademy.dk).

### userAdgang refactor (etape 2 færdig)

Alle 6 callsites af `userDoc.state` er refactoreret til at bruge helpers fra `userAdgang.ts`. Filer rørt: TabBar, +page.svelte (forsiden), profil/+page.svelte, beskeder/+page.svelte, moduler/+page.svelte, moduler/traening/+page.svelte. Legacy `state`-felt bevares så ingen 3rd-party kode brækker.

---

## Adgangs-livscyklus (visuel oversigt)

### Forløbskunde (Maria-flow)

```
Kickstart køb              forløb-slut         +90 dage           +5 år
     |                         |                  |                 |
     ↓                         ↓                  ↓                 ↓
  Aktiv ────────────────► Bonus periode ───► IngenAdgang ────► Data slettet
  Alt                     Bibliotek åbent     Login virker      via cron
                          Andre låst          Intet andet       (manuel årligt)
```

### Abonnent (Bo-flow)

```
Basis-abo køb              cancel/refund                          +5 år
     |                          |                                   |
     ↓                          ↓                                   ↓
  Aktiv ───────────────► IngenAdgang (straks) ─────────────► Data slettet
  Mikrotræning, kost,    Login virker
  vaner, bibliotek       Intet andet
```

### Hybrid (Maria køber Kickstart + senere basis-abo)

```
Kickstart           forløb-slut    cancel basis    +90 dage fra forløb
   |                    |                |                |
   ↓                    ↓                ↓                ↓
Aktiv ──► Aktiv (forløb) ──► Aktiv (abo) ──► Bonus ──► IngenAdgang
                              ELLER hvis hun ikke har abo:
                              Bonus ──────────────────► IngenAdgang
```

Hvis hun cancellerer abonnement *inden* 90 dage er gået: bibliotek bliver tilgængeligt fordi bonus stadig er aktiv. Hvis hun cancellerer *efter* 90 dage: total lockout med det samme.

---

## Hvad mangler / næste session

### Højeste prioritet (Simplero-ting)

1. **Opret cancel-trigger i Simplero** (Marketing → Triggers → Create) for "Purchase: Cancelled" → vores webhook URL. Test ved at refundere et test-køb.
2. **Opret refund-trigger** (samme mønster).
3. **Tilføj `SIMPLERO_WEBHOOK_SECRET`** som secret i Cloudflare Pages hvis Simplero giver en signing-secret. Endpointet vil straks begynde at verificere signaturer.
4. **Opret de 3 manglende produkter i Simplero** når Linn er klar. Tilføj produkt-ID i `produkter.ts` for hver. Opret triggers parallelt med basis-app's eksisterende.

### Medium prioritet

5. **Bagudfyld bonusPeriodEndsAt for Maria** — hun har ingen bonus-dato sat, så hun vil have ubegrænset adgang. Hvis Linn vil have realistisk udløb skal vi sætte det manuelt eller via et migrations-script. (Linn sagde nej til dette i denne session, men det kan ændre sig.)
6. **Auto-planlæg `slet-inaktive-brugere.ts`** som en månedlig Cloud Function eller GitHub Action, så Linn ikke skal huske at køre det manuelt.

### Lavere prioritet

7. **Premium-features** når premium-forløbet/abonnementet kommer:
   - Træning: premium kan vælge andre programmer + sammensætte sit eget
   - Næring: udvidet visning (kh/fedt/kcal)
   - Vaner: udvidet vanetracker
   - Linn AI (chatbot)
   - Alle skal bruge `harPremium(userDoc)` til at låse op.
8. **Tilføj testdækning** for `synkroniserForlobskundeStatus` med de nye access-felter.

---

## Tekniske gotchas

- **Cloudflare Pages-funktioner = Workers runtime.** `firebase-admin` virker ikke. Brug `src/lib/server/firestoreRest.ts`-helperen i stedet.
- **`forlobIds` er append-only.** Brug ALDRIG `setDoc` direkte med array-værdi — brug `arrayUnion` så historik bevares. Webhook bruger read-then-merge fordi REST-API'et ikke har arrayUnion-transform.
- **userProducts slettes ALDRIG.** Cancel-flow rører kun access-felter, ikke userProducts. Bibliotek læser fra alle gamle userProducts.
- **`state`-feltet er deprecated** men holdes i sync med accessLevel/accessSource via `udledState` helper. Læs altid via `effektivState(userDoc)`, skriv altid begge dele.
- **Admin-mode override** i `/app/+layout.svelte`: når admin er i klient-mode, override'r vi `state='forlobskunde'` + `accessLevel='basis'` + `accessSource='forløb'` + `activeProduct='kickstart'` på det context-objekt undermoduler læser. Den rigtige userDoc i Firestore ændres ikke.
- **Tab-id'er i bibliotek er strenge** (ikke union-type) — `'lektioner-{productType}'` er dynamisk per userProducts-doc. tabFraQuery() håndterer både gamle og nye id'er.
- **Webhook-payload kan være op til ~10 KB** — hver event logges trunkateret til 9000 chars i webhookLog så vi ikke rammer Firestore's 1 MiB doc-limit.
- **Service account-private-key bør aldrig committes.** Den er i `scripts/service-account-key.json` (gitignored). I Cloudflare ligger den som "Secret" env var.
- **CSV-import-flow er stadig relevant** for migration af eksisterende kunder — `parseSimpleroCsv` i `lib/content/forlobAdgang.ts` virker. Webhook erstatter dette for FREMTIDIGE køb.

---

## Filer der er ramt (udvalg)

**Nye filer:**
- `src/routes/api/simplero-webhook/+server.ts`
- `src/routes/api/r2-upload-url/+server.ts`
- `src/lib/server/firestoreRest.ts`
- `src/lib/simplero/produktMapping.ts`
- `src/lib/content/produkter.ts`
- `src/lib/utils/userAdgang.ts`
- `src/lib/components/IngenAdgangScreen.svelte`
- `scripts/slet-inaktive-brugere.ts`
- `scripts/migrer-state-til-access.ts`
- `scripts/ryd-allowedemails.ts`

**Ændret væsentligt:**
- `src/lib/types.ts` (nye access-felter på UserDoc, forlobIds, AllowedEmail)
- `src/lib/userDoc.ts` (synkroniserForlobskundeStatus udvidet til access-felter + arrayUnion)
- `src/lib/content/moduler.ts` (modulbruger får bibliotek; udlobet → kun bibliotek hvis bonus)
- `src/lib/components/TabBar.svelte` (Beskeder låst for modulbruger; admin-indstillinger; skjul klient-tabs i admin-mode)
- `src/routes/app/+layout.svelte` (IngenAdgangScreen wrapper; admin-mode access-override)
- `src/routes/app/moduler/bibliotek/+page.svelte` (per-product lektion-tabs; Træningsøvelser; Opskrifter; søgefelt; aggregering på tværs af forløb)
- `src/routes/app/moduler/30-30-3/opskrifter/[id]/+page.svelte` (skjul tilføj-til-byg-måltid hvis ?fra=bibliotek)

---

## CLAUDE-instruktion: Læs IKKE handover v17/v18/v19 inden du starter

De er ikke længere autoritative — denne v20 er den fulde aktuelle status. v17-v19 kan læses for historisk kontekst hvis et specifikt emne kommer op (fx onboarding-flow, fødevarer-cleanup, audio-player-design), men adgangs-modellen og Simplero-integrationen er fuldstændigt re-arkitekteret i denne session.
