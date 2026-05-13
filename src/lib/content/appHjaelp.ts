// App-hjælp AI — separat AI fra Linn AI med ét formål: at svare på
// spørgsmål om hvordan appen virker. Hver klient ser kun de features hun
// faktisk har adgang til, så basis-brugere ikke spørger om premium-features
// de ikke har, og forløbskunder ikke får svar om abonnement-features.
//
// Knowledge base lever som TypeScript-konstanter i denne fil — IKKE i
// Firestore-videnbase som Linn AI. Når Claude ændrer noget i appen, skal
// han samtidig opdatere de relevante sektioner her, så svarene bliver i sync
// med koden.

import type { ActiveProduct } from '$lib/types';

export const APP_HJAELP_MAX_QUERIES_PR_DAG = 30;

export function appHjaelpQuotaNoegle(dato: Date = new Date()): string {
	const aar = dato.getFullYear();
	const m = String(dato.getMonth() + 1).padStart(2, '0');
	const dag = String(dato.getDate()).padStart(2, '0');
	return `${aar}-${m}-${dag}`;
}

// Hvilke produkt-typer hver sektion gælder for. Inkluderer brugeren mindst
// ét af de listede produkter, vises sektionen.
type Produkt = ActiveProduct; // 'basisabo' | 'premiumabo' | 'kickstart' | 'premiumforløb'

const ALLE_PRODUKTER: Produkt[] = ['basisabo', 'premiumabo', 'kickstart', 'premiumforløb'];
const MODULBRUGERE: Produkt[] = ['basisabo', 'premiumabo'];
const FORLOBSKUNDER: Produkt[] = ['kickstart', 'premiumforløb'];
const PREMIUM: Produkt[] = ['premiumabo', 'premiumforløb'];

export interface AppHjaelpSektion {
	titel: string;
	visFor: Produkt[];
	indhold: string;
}

// =============================================================================
// KNOWLEDGE BASE — opdateres samtidig med kode-ændringer
// =============================================================================

export const APP_HJAELP_SEKTIONER: AppHjaelpSektion[] = [
	{
		titel: 'Sådan navigerer du i appen',
		visFor: ALLE_PRODUKTER,
		indhold: `Appen har en TabBar nederst med fire-fem faner:
- Forside: dagens overblik
- Moduler: liste over alle dine moduler
- Udvikling: din udvikling i kost-tal over tid
- Beskeder: kun synligt for forløbskunder (Kickstart + Premium-forløb)
- Profil: kontoindstillinger, tekstskalering, log ud

Klik på et modul-kort eller en knap for at åbne den. Brug 'Tilbage'-pilen øverst til venstre på undersider for at komme tilbage.`
	},
	{
		titel: 'Forsiden — modulbrugere (Basis-app + Premium-app)',
		visFor: MODULBRUGERE,
		indhold: `Forsiden viser:
- En dato-strip øverst med dage fra du oprettede kontoen til 3 dage frem. Klik på en dag for at åbne den dags log. Dage du ikke har indtastet noget på er fadet. Fremtidige dage er fadet og kan ikke åbnes.
- 'Dagens lektion' (hvis Linn har lagt en lektion op for den valgte dato) — klik for at åbne.
- 'Dagens små skridt' med tre kort: Mad, Mikrotræning og Vaner. Klik på et kort for at logge dagens indhold.
- 'Personlig coaching' med knap til at booke 1:1-samtale med Linn.
- 'App-hjælp' med spørgsmål til hvordan appen virker.`
	},
	{
		titel: 'Forsiden — forløbskunder (Kickstart + Premium-forløb)',
		visFor: FORLOBSKUNDER,
		indhold: `Forsiden viser:
- Forløbs-badge øverst med dit aktuelle forløbs-navn og dagnummer.
- En strip med alle dage i forløbet (typisk dag 0-21). Du kan klikke tilbage på tidligere dage. Dag 0 er baseline-check-in.
- 'Dagens lektion' — den lektion der hører til dagen. Klik for at åbne i lektion-overlay.
- 'Dagens små skridt' med Mad, Mikrotræning og Vaner-genveje.
- 'Personlig coaching' med knap til at booke 1:1.
- 'App-hjælp' med spørgsmål til hvordan appen virker.`
	},
	{
		titel: 'Mikrotræning — abonnenter',
		visFor: MODULBRUGERE,
		indhold: `Mikrotræning finder du under Moduler → Træning → Mikrotræning. Programmet er løbende (14 dage i rotation), så du starter forfra når du har gennemført alle dage.

Knap 'Start dagens træning' åbner dagens session. Når du er færdig, kan du give feedback (Let / Tilpas / Udfordrende). Træningen logges automatisk.

Under 'Seneste dage'-griddet kan du se hvilke dage du har trænet (grøn). I dag er markeret med terra-kant. Klik på en dag for at åbne den dags træning igen.`
	},
	{
		titel: 'Mikrotræning — forløbskunder',
		visFor: FORLOBSKUNDER,
		indhold: `Mikrotræning er bygget op som et 21-dages program der følger forløbet. Du finder det under Moduler → Træning → Mikrotræning.

Hver dag er låst op i takt med forløbet — du kan ikke springe frem. Du kan altid gå tilbage til tidligere dage. Når du har gennemført alle 21 dage, er du færdig med programmet.

Du kan vælge program (med eller uden udstyr) under Profil → Mikrotræning — program.`
	},
	{
		titel: 'Mad — 30-30 beregner og dagbog',
		visFor: ALLE_PRODUKTER,
		indhold: `Mad-modulet finder du under Moduler → Mad (30-30 beregner). Det er bygget op af faner:

- Slå op: søg i fødevarebanken og se protein/fiber-indhold pr 100g.
- Byg måltid: sammensæt et måltid af enkelte fødevarer og se hvor meget protein og fiber det giver. Gem det i dagbogen når du er klar.
- Opskrifter: bladrer i opskriftsbiblioteket. Klik en opskrift for at se ingredienser og næring.
- Dagbog: se dine gemte måltider for en valgt dato. Brug pile/dato-input til at skifte dag. Klik 'Byg måltid for denne dag' for at oprette et måltid på en specifik dato (i stedet for dagens dato).

Målet med 30-30 er minimum 30g protein pr måltid og 30g fiber i alt over dagen.`
	},
	{
		titel: 'Vaner — basis tracker',
		visFor: MODULBRUGERE,
		indhold: `Vaner finder du under Moduler → Vaner. Som basis-bruger kan du vælge 3 vaner du vil arbejde med dagligt.

Første gang sætter du dine vaner op under 'Vælg dine vaner'. Bagefter kan du tjekke ind hver dag — knap 'Tjek ind for i dag' på forsiden eller modul-siden.

På modul-siden ser du:
- Et 'Seneste dage'-grid med farvekoder for hvor mange vaner du ramte (mørkegrøn = alle, grøn = de fleste, brun = halvdelen, lys-brun = få, sand = næsten ingen).
- Et 'Måneds-arkiv' du kan folde ud pr måned for at se historik.
- Din udvikling i velvære-spørgsmål over tid.

Vaner kan redigeres via 'Rediger vaner' nederst på siden.`
	},
	{
		titel: 'Vaner — premium tracker',
		visFor: PREMIUM,
		indhold: `Som premium-bruger kan du vælge op til 7 vaner i stedet for 3. Du finder Vaner under Moduler → Vaner.

Du har desuden adgang til udvidet næringsdata og kan se hvordan dine vaner og kost spiller sammen i din udvikling.

Resten af vanetrackeren virker som basis: tjek ind dagligt, se farvekoder for hvor mange vaner du ramte, og scroll i månedsarkivet for historik.`
	},
	{
		titel: 'Mit forløb (Kickstart og Premium-forløb)',
		visFor: FORLOBSKUNDER,
		indhold: `Mit forløb finder du under Moduler → Mit forløb. Her ser du:
- Alle dage i forløbet (typisk 21 dage) med status: gennemført, i gang eller låst.
- Dagens lektion med video/lyd/læsestof.
- En note fra Linn for nogle dage.

Klik på en dag for at åbne lektionen. Forløbet låser dagene op én ad gangen — du kan ikke springe frem.

Når forløbet er gennemført, har du 90 dages bonusperiode hvor du stadig kan se materialet (læseadgang).`
	},
	{
		titel: 'Beskeder — spørgsmål til Linn',
		visFor: FORLOBSKUNDER,
		indhold: `Beskeder finder du som en fane i TabBar nederst. Her kan du stille spørgsmål direkte til Linn — hun svarer typisk inden for et par dage.

Brug 'Stil et nyt spørgsmål'-knappen øverst. Du kan se alle dine tidligere spørgsmål og Linns svar i listen. Når Linn har besvaret et nyt spørgsmål, vises det også som notifikation på forsiden.`
	},
	{
		titel: 'Bibliotek',
		visFor: ALLE_PRODUKTER,
		indhold: `Biblioteket finder du under Moduler → Biblioteket. Det indeholder forskellige faner afhængigt af din adgang:
- Links: små links til relevante artikler/værktøjer.
- Lektioner: indhold fra forløb du har gennemført. Tom hvis du ikke har været på et forløb.
- Træningsøvelser: bibliotek over alle øvelser med video og vejledning.
- Opskrifter: alle opskrifter — klik for at se ingredienser og næring.

Forløbskunder ser også en FAQ-fane med svar på de typiske spørgsmål for forløbet.`
	},
	{
		titel: 'FAQ-fanen i bibliotek',
		visFor: FORLOBSKUNDER,
		indhold: `Som forløbskunde har du en FAQ-fane i biblioteket med typiske spørgsmål om forløbet — fx 'Hvad gør jeg hvis jeg falder fra?', 'Kan jeg starte forfra?' osv. Klik på spørgsmålet for at folde svaret ud.

Hvis dit spørgsmål ikke står i FAQ, så stil det i Beskeder-fanen.`
	},
	{
		titel: 'Linn AI',
		visFor: PREMIUM,
		indhold: `Linn AI er en premium-feature der finder du under Moduler → Linn AI. Den svarer som om hun var Linn selv og bygger på Linns ekspertise og materialer.

Stil spørgsmål om kost, træning, motivation, livsstil, overgangsalder, hormoner, mental sundhed, stress, søvn — alt det Linn arbejder med. Du har 20 spørgsmål pr dag.

Linn AI er IKKE den samme som App-hjælp. App-hjælp svarer kun på spørgsmål om hvordan appen virker, Linn AI svarer på fagligt indhold.`
	},
	{
		titel: 'Udvikling-fanen',
		visFor: ALLE_PRODUKTER,
		indhold: `Udvikling-fanen i TabBar viser din udvikling over tid:
- Næring: hvordan dine protein/fiber-tal har udviklet sig dag for dag.
- Du kan vælge mellem forskellige tidsperioder (7 dage, 30 dage, 90 dage osv).

Det kræver at du har logget måltider i Mad-modulet over en periode for at se grafer.`
	},
	{
		titel: 'Profil — indstillinger',
		visFor: ALLE_PRODUKTER,
		indhold: `Profil-fanen i TabBar viser:
- Dit fornavn og initialer.
- Dine køb (Basis-app, Premium-app, Kickstart osv) med status.
- Tekstskalering (Normal/Stor/Ekstra stor) — gør hele appens tekst større hvis du har svært ved at læse.
- Mikrotræning-program (kun forløbskunder) — vælg om du træner med eller uden udstyr.
- Log ud-knappen nederst.`
	},
	{
		titel: 'Min opskrift — gem og redigér egne opskrifter',
		visFor: PREMIUM,
		indhold: `Som premium-bruger kan du gemme dine egne opskrifter under Moduler → Mad → Mine. Du kan også uploade et foto af et måltid og lade AI'en estimere makronæring automatisk.

Klik 'Læg ind som måltid' for hurtigt at lægge en gemt privat opskrift ind i dagbogen.`
	},
	{
		titel: 'Optimér min mad — AI-forslag',
		visFor: PREMIUM,
		indhold: `Som premium-bruger har du en 'Optimér min mad'-knap på dagbog-fanen. Den lader AI'en kigge på dagens måltider og foreslå små bytter eller tilføjelser så du rammer dit protein/fiber-mål inden for dit kcal-budget. Klik 'Anvend ændringer' for at føje forslagene ind i dagbogen automatisk.`
	},
	{
		titel: 'Hvis du ikke kan finde noget',
		visFor: ALLE_PRODUKTER,
		indhold: `Hvis du leder efter en feature der ikke er nævnt her, eller noget ikke virker som forventet, kan du:
- Skrive til kontakt@linnsacademy.dk
- Forløbskunder kan stille spørgsmål direkte til Linn under Beskeder-fanen.`
	}
];

// =============================================================================
// PROMPT-BYGNING
// =============================================================================

const APP_HJAELP_SYSTEM_PROMPT = `Du er App-hjælp — en assistent der svarer på spørgsmål om hvordan Linn's Academy-appen virker. Dit ENESTE formål er at hjælpe brugeren med at navigere og bruge appen.

VIGTIGE REGLER:
- Du må KUN svare på spørgsmål om appen og dens features.
- Hvis brugeren spørger om noget fagligt (kost, træning, helbred, overgangsalder, hormoner, motivation, livsstil etc.) — afvis venligt og henvis til Linn AI (hvis premium) eller til Beskeder-fanen (hvis forløbskunde).
- Hvis brugeren spørger om en feature der ikke findes i din videnbase nedenfor — sig at du ikke ved det, og foreslå at hun skriver til kontakt@linnsacademy.dk.
- Du ved kun om de features brugeren faktisk har adgang til (se VIDENBASE nedenfor). Nævn ikke features hun ikke har — det skaber forvirring.
- Svar kort, konkret og praktisk. Brug 'du' og 'din'. Skriv på dansk.
- Brug ikke tegn som em-dash (—), semikolon (;) eller engelsk-stil typografi. Skriv almindeligt dansk med bindestreger og punktum.

VIDENBASE — sådan virker appen for DENNE bruger:`;

/**
 * Bygger system-prompten med kun de sektioner brugerens produkt giver adgang til.
 */
export function byggAppHjaelpSystemPrompt(activeProduct: ActiveProduct | undefined): string {
	if (!activeProduct) {
		return (
			APP_HJAELP_SYSTEM_PROMPT +
			'\n\n(Brugerens adgang kunne ikke afgøres — svar generelt om appens grundlæggende navigation.)'
		);
	}
	const synlige = APP_HJAELP_SEKTIONER.filter((s) => s.visFor.includes(activeProduct));
	const videnbase = synlige
		.map((s) => `\n## ${s.titel}\n${s.indhold}`)
		.join('\n');
	return APP_HJAELP_SYSTEM_PROMPT + videnbase;
}
