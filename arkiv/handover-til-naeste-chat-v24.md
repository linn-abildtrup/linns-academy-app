# Handover til næste chat — v24

Status efter session 24 (12.-13. maj 2026). **12 commits siden v23.** Session dækker fem hovedtemaer:

1. **Simplero-webhook arkitektur** — splittet fra én generisk endpoint til 4 dedikerede event-routes (`/koeb`, `/fornyelse`, `/afbrudt`, `/betaling-fejlede`). Legacy-route bevaret indtil alle Simplero-konfigurationer er migreret. Køb-flow verificeret end-to-end med rigtige Simplero-events.
2. **Mine køb refaktor** — `koeb.ts` mapper nu på `activeProduct` (basisabo/premiumabo/kickstart/premiumforløb) i stedet for legacy `UserState`.
3. **Vanetracker + mikrotræning oversigt** — skjuler dage før brugerens vane-opsætning / konto-oprettelse, så nye brugere ikke ser tomme historiske datoer.
4. **Adgangs-flow forbedring** — signup blokerer nu emails uden registreret køb. IngenAdgangScreen skelner mellem "udløbet adgang" og "intet køb registreret".
5. **Diverse UI-finjusteringer** — modul-Kickstart-link til Simplero, månedsarkiv-overflow, bibliotek Links-fane, 30-30-forklaring, kontakt-email til kontakt@linnsacademy.dk, m.fl.

**Vigtige åbne tråde fra v23 — uændrede:**
1. Auto-eksport af besvarede klient-spørgsmål til Linn AI-videnbasen
2. Persona-prompt til Linn AI

**Nye åbne tråde:**
3. **Cancel-flow afklaring (HOVEDPRIORITET)** — Simperos opsigelses-event blev fulgt af et `purchase.made` 250ms efter. Uafklaret om det er forventet adfærd eller om vi skal håndtere det specifikt.
4. End-to-end test af fornyelse + betaling-fejlede med rigtige Simplero-events

---

## Status quo

**Live URL:** `https://linns-academy-app.pages.dev`
**Deploy:** Auto fra `main` på Cloudflare Pages
**Tests:** 367 tests passerer (2 nye siden v23), 0 type-fejl, 0 svelte-warnings.

### Test-brugere (uændrede fra v23)

Alle med password `test1234`:
- `forlob@linnsacademy.dk` — Maria, forløbskunde, Kickstart maj 2026
- `modul@linnsacademy.dk` — Anne, modulbruger
- `udlobet@linnsacademy.dk` — Sofia, udløbet
- `linnabildtrup00@gmail.com` — Linn, admin
- `bo_andersen1@icloud.com` — Bo, Simplero-test-kunde (oprindelig)
- `bo_andersen1@mac.com` — Bo, ny Simplero-test-kunde (oprettet via /koeb i denne session)
- `basis_app@linnsacademy.dk` — BasisApp, modulbruger, basis-abo
- `premium_app@linnsacademy.dk` — PremiumApp, modulbruger, premium-abo
- `kickstart@linnsacademy.dk` — Kickstart, forløbskunde
- `premium_forlob@linnsacademy.dk` — PremiumForlob, forløbskunde, premium-forløb test

### Webhook-aktivitet i sessionen

- 12. maj 17:24 — bo_andersen1@mac.com → `purchase.made` (basisabo) ✅
- 12. maj 21:10 — bo_andersen1@mac.com → `subscription.cancelled` + `purchase.made` (250ms efter, samme produkt)
- 12. maj 21:31 — bo_andersen1@icloud.com → `purchase.made` (basisabo) ✅

Simperos webhook-leveringstid målt til ~60 sek efter checkout.

---

## Simplero-webhook refaktor

### Hvad det er

Tidligere ramte alle Simplero-events samme endpoint `/api/simplero-webhook`, og koden udledte event-typen fra payload-felter (state, canceled_at, refunded_at). Det blev fragilt da vi tilføjede fornyelse og betaling-fejlede. Nu har hver event-type sin egen URL:

| Event | URL | Effekt |
|---|---|---|
| Purchase made | `/api/simplero-webhook/koeb` | Sætter accessLevel + activeProduct, gemmer simpleroCustomerId |
| Recurring payment made | `/api/simplero-webhook/fornyelse` | Bekræfter adgang, rydder paymentFailedAt |
| Subscription cancelled | `/api/simplero-webhook/afbrudt` | activeSubscription=false, bevarer accessLevel til period_ends_at |
| Payment failed | `/api/simplero-webhook/betaling-fejlede` | Markerer paymentFailedAt, bevarer adgang |

### Delt logik

`src/lib/server/simpleroWebhook.ts` har de fælles hjælpere: signatur-verifikation, payload-typer, felt-udtræk (uddragEmail, uddragProduktId, uddragKundeId), webhookLog-skrivning og opdaterBrugerEllerWhitelist. Hver sub-route importerer derfra og handler kun sin egen forretningslogik (typisk 50-70 linjer pr fil).

### Adgang via allowedEmails-whitelist

Når en kunde køber FØR hun har oprettet konto, gemmer webhook'en hendes adgang i `allowedEmails/{email}`. Når hun bagefter signer op, kopieres felterne over på `users/{uid}` via `synkroniserForlobskundeStatus`. Med signup-blokken (se nedenfor) er det også den eneste vej til at få adgang.

### Legacy-route bevaret

`/api/simplero-webhook` (uden suffix) er stadig live og bruger samme delte logik. Den udleder event-typen fra payload og dispatcher til samme handlere. Når alle Simplero-konfigurationer peger på de nye sub-paths, kan filen slettes.

### Beslutninger

**Hvorfor sub-paths i stedet for at se på payload-felter**: routing bliver eksplicit i Simperos UI, det er nemmere at se i log hvilken event-type der kom ind, og hver handler kan have sin egen test-suite. Trade-off: 4 filer i stedet for 1, men de er små og deler 90% af logikken via helpers.

**Hvorfor `/afbrudt` IKKE rydder accessLevel**: kunden beholder adgangen til perioden er kørt ud (period_ends_at). Adgangen forsvinder først når en eventuel udløb-batch eller manuel oprydning sætter accessLevel=none.

**Hvorfor `/betaling-fejlede` ikke fjerner adgang**: Simplero retry'er typisk selv. Vi markerer paymentFailedAt så UI'et kan vise advarsel, men beholder adgangen indtil eventuelt subscription.cancelled-event kommer ind.

### Filer (nye i v24)

- `src/lib/server/simpleroWebhook.ts` — delt logik
- `src/routes/api/simplero-webhook/koeb/+server.ts`
- `src/routes/api/simplero-webhook/fornyelse/+server.ts`
- `src/routes/api/simplero-webhook/afbrudt/+server.ts`
- `src/routes/api/simplero-webhook/betaling-fejlede/+server.ts`
- `scripts/inspect-webhook-log.ts` — diagnose-script til at inspicere webhookLog/users/allowedEmails for en given email

### Ændrede filer

- `src/routes/api/simplero-webhook/+server.ts` — refaktoreret til at bruge delt logik, mærket som legacy

---

## Mine køb refaktor

`src/lib/content/koeb.ts` mappede tidligere på legacy `UserState` (modulbruger → hardcoded "Mikrotræning + Kost-modul"). Nu mapper den på `userDoc.activeProduct`:

- basisabo → "Basis-app"
- premiumabo → "Premium-app"
- kickstart → "Kickstart en sund overgangsalder"
- premiumforløb → "Premium-forløb"

I bonus-periode efter forløb-slut: vises som "Læseadgang" med udløbsdato.

Profil-siden kalder nu `getKoebForUser(userDoc)` i stedet for `getKoebForUser(state)`. Tests opdateret tilsvarende.

---

## Adgangs-flow forbedring

### Signup blokerer ukendte emails

`src/routes/login/+page.svelte` tjekker nu `allowedEmails/{email}` efter Firebase-Auth har oprettet kontoen. Hvis ikke fundet:

1. `cred.user.delete()` rydder auth-kontoen
2. Brugeren ser fejlmeddelelsen: *"Vi kan ikke finde et køb registreret på {email}. Tjek at du bruger samme email som ved købet på Simplero. Spørgsmål? Skriv til kontakt@linnsacademy.dk."*

Auth-kontoen oprettes først så vi kan læse `allowedEmails/{email}` under brugerens token (Firestore-rules tillader `request.auth.token.email == email`). Uden auth-oprettelse ville vi enten skulle bygge en server-side API eller løsne rules.

### IngenAdgangScreen skelner

Komponenten tager nu `userDoc` som prop og viser to varianter baseret på om `simpleroCustomerId` eller `forlobIds` er sat:

- **"Velkommen tilbage" / "Din adgang er udløbet"** — havde tidligere adgang
- **"Vi kan ikke finde dit køb"** — aldrig haft et køb registreret

### Kontakt-email opdateret

`linn@linnsacademy.dk` → `kontakt@linnsacademy.dk` i IngenAdgangScreen og signup-fejlmeddelelsen.

---

## Vanetracker + mikrotræning oversigt

### Vaner abo

`/app/moduler/vaner` filtrerer nu `sidste7Dage`-griddet så dage før `aboOpsaetning.oprettetAt` skjules. Fremgang-tæller og progress-bar bruger faktisk antal synlige dage (ikke hardcoded 7). Label skifter til "Siden du startede" hvis færre end 7 dage er synlige.

### Mikrotræning abo

Samme princip i `/app/moduler/traening/mikrotraening` — dog baseret på `userDoc.createdAt` da der ikke er nogen eksplicit setup-step for mikrotræning.

### Bemærkning

Direkte URL-adgang til gamle datoer (fx `/app/moduler/vaner/abo/2025-01-01`) er IKKE blokeret. Linn nævnte det og besluttede at lade den ligge for nu.

---

## Mindre UI-finjusteringer

### Vaner månedsarkiv overflow

Fjernet negative margins på `.maaned-knap.aaben` og `.maaned-dage` der lod sektionen række ud over card-kanten. Tilføjet border-radius så den åbne sektion danner et samlet rundt panel.

### Bibliotek Links-fane

Skjules nu hvis `sorteredeGuideKats.some(k => harGuidesIKategori(k.id))` er false. Hvis brugeren lander direkte på `?tab=guides` med tom liste, skiftes automatisk via `$effect` til FAQ (forløbskunde) eller Opskrifter (modulbruger).

### Kickstart-link på moduler

Tilføjet `kobUrl?: string` til `Modul`-typen. Sat til `https://linn.simplero.com/21dage` for låste forløbs- og udløbs-moduler. Moduler-siden gør rækker med `kobUrl` klikbare og åbner i ny fane.

### 30-30-beregner

- Header-tekst ændret fra "30-30-3" til "30-30" (også på udvikling/næring)
- Tilføjet kort forklaring under titlen: *"Sigt efter mindst 30g protein pr. måltid og 30g fiber i alt over dagen. Det holder dig mæt længere og støtter et stabilt blodsukker gennem overgangsalderen."*

### Forside + login oprydning

Fjernet "Hurtig adgang"-overskrift fra modulbruger-forsiden og "Allerede medlem? Genoptag rejse"-linket fra login welcome-skærm. Ubrugt CSS oprydet samtidig.

---

## Dagbog: byg måltid for valgt dato

På `/app/moduler/30-30-3` dagbog-fanen er der nu en terra-farvet knap *"+ Byg måltid for denne dag"* lige under dato-navigatoren. Klik:

1. Sætter `forhaandsValgtDato = dagbogDato`
2. Skifter til Byg måltid-fanen

Når brugeren bagefter klikker Gem, bruges `forhaandsValgtDato` som default `gemDato`. Pre-valget ryddes:
- Efter vellykket save
- Hvis brugeren manuelt klikker "Byg måltid"-tabben (så hun ikke utilsigtet ender med en gammel dato)

På Byg måltid-fanen vises en lille info-besked når en pre-valgt dato er aktiv: *"Du bygger måltid for [dato]. Gem-datoen er pre-valgt."*

---

## Tekniske gotchas (nye i v24)

- **Cancel-flow sender 2 events**: når Bo annullerede sit abonnement på Simplero (12. maj 21:10), fyrede den BÅDE `subscription.cancelled` OG `purchase.made` 250ms efter hinanden for samme product_id. Slutresultat: activeSubscription=true (kunden er stadig aktiv fordi purchase.made overskrev cancellen). Uafklaret om det er Simperos forventede flow eller om vi skal håndtere det specifikt (fx ignorere purchase.made hvis subscription.cancelled lige er kommet for samme product).
- **Signatur-verifikation skippes hvis SIMPLERO_WEBHOOK_SECRET ikke er sat**: bevidst for dev-mode. I prod bør secret være konfigureret som env-variabel i Cloudflare Pages — i øjeblikket ikke sat.
- **Auth-konto oprettes før whitelist-tjek under signup**: bevidst (Firestore-rules kræver auth-token for at læse allowedEmails). Auth-kontoen slettes igen hvis tjekket fejler, så vi får ikke orphan-konti — men hvis delete() fejler logges advarsel og kontoen kan blive liggende.
- **Direkte URL-adgang til gamle vane-/mikrotræning-datoer er IKKE blokeret**: kun oversigts-griddet filtrerer. Hvis brugeren manuelt indtaster `/app/moduler/vaner/abo/2020-01-01` åbnes siden stadig (men der vil ikke være data).
- **Webhook log query kræver index**: `where(email).orderBy(modtaget)` kræver composite index i Firestore. `inspect-webhook-log.ts` undgår det ved at hente seneste 30 og filtrere i hukommelse.
- **Pre-valgt dato i 30-30 ryddes ved manuelt tab-klik**: hvis du udvider feature-sættet med flere indgangspunkter til byg-måltid, så husk at sætte `forhaandsValgtDato` på dem du vil bevare pre-valg fra.

---

## Hvad du skal gøre lige nu

### Cloudflare deploy

Alle commits er pushed, auto-deployer.

### Test-flow

- Køb-flow er verificeret med rigtige Simplero-events for `bo_andersen1@mac.com` og `bo_andersen1@icloud.com`
- Opsigelses-event'en er modtaget korrekt, men efterfulgt af et purchase.made-event (se gotchas)
- Fornyelse og betaling-fejlede er IKKE end-to-end-testet med rigtige events endnu

---

## Næste session — prioriteret

### 1. Cancel-flow afklaring (NY HOVEDPRIORITET)

Find ud af om Simperos cancel sender to events bevidst (re-aktivering / gen-trækning) eller om vi skal:
- Ignorere purchase.made hvis subscription.cancelled lige er kommet ind for samme product
- Sætte expiresAt på den senere purchase.made
- Eller noget tredje

Tjek Simplero's webhook-history på selve cancel-event'en, læs deres docs om "cancel subscription"-flow, eller spørg deres support. Test også de tre Simplero cancel-varianter (Cancel immediately, Cancel at period end, Refund).

### 2. End-to-end test af fornyelse + betaling-fejlede

Trigger fornyelses-event manuelt i Simplero eller vent på en faktisk fornyelse. Verificer at `paymentFailedAt`-flag opfører sig korrekt på tværs af subscription-states.

### 3. Slet legacy webhook-route

Når alle Simplero-webhooks peger på de nye sub-paths (verificer i Simperos UI at ingen webhook stadig bruger `/api/simplero-webhook` uden suffix), kan `src/routes/api/simplero-webhook/+server.ts` slettes.

### 4. Adgangs-flow ved første login (uændret fra v23)

Verificer at alle fire produkter (kickstart, premiumforløb, basisabo, premiumabo) håndteres korrekt i copy-flow fra allowedEmails til users/{uid}. Specielt:
- Upgrade-paths: basis-bruger køber premium
- Downgrade-paths: premium-bruger nedgrader

### 5. Persona-prompt til Linn AI (uændret fra v23)

### 6. Auto-eksport af klient-spørgsmål til Linn AI-videnbasen (uændret fra v23)

### Mulige udvidelser

7. Blokér direkte URL-adgang til vane-/mikrotræning-datoer før brugerens start-dato (samme princip som griddet)
8. Sæt `SIMPLERO_WEBHOOK_SECRET` som env-variabel i Cloudflare Pages og slå signatur-verifikation til
9. RAG/embeddings til Linn AI når videnbasen vokser
10. Streaming responses i Linn AI-chat

---

## CLAUDE-instruktion: Læs IKKE handover v17-v23 inden du starter

v24 er det fulde aktuelle tillæg til v23. v22 dækker fødevare-berigelse + Min opskrift; v23 dækker frokost-kategori-fix + Optimér min mad + premium-gating-stramning; v24 dækker Simplero-webhook split + mine-køb-refaktor + adgangs-flow-stramning + UX-fixes. De tre handovers tilsammen er det fulde billede oven på v21.
