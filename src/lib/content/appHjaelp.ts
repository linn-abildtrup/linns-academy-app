// App-hjælp AI — separat AI fra Linn AI med ét formål: at svare på
// spørgsmål om hvordan appen virker. Hver klient ser kun de features hun
// faktisk har adgang til, så basis-brugere ikke spørger om premium-features
// de ikke har, og forløbskunder ikke får svar om abonnement-features.
//
// Knowledge base lever som TypeScript-konstanter i denne fil — IKKE i
// Firestore-videnbase som Linn AI. Når Claude ændrer noget i appen, skal
// han samtidig opdatere de relevante sektioner her, så svarene bliver i sync
// med koden.

import { KICKSTART_PRODUCT_ID, KROPSRO_PRODUCT_ID, type ActiveProduct } from '$lib/types';

export const APP_HJAELP_MAX_QUERIES_PR_DAG = 30;

export function appHjaelpQuotaNoegle(dato: Date = new Date()): string {
	const aar = dato.getFullYear();
	const m = String(dato.getMonth() + 1).padStart(2, '0');
	const dag = String(dato.getDate()).padStart(2, '0');
	return `${aar}-${m}-${dag}`;
}

// Hvilke produkt-typer hver sektion gælder for. Inkluderer brugeren mindst
// ét af de listede produkter, vises sektionen. 'premiumforløb' = Kropsro
// (se KROPSRO_PRODUCT_ID i types.ts).
type Produkt = ActiveProduct;

const ALLE_PRODUKTER: Produkt[] = ['basisabo', 'premiumabo', KICKSTART_PRODUCT_ID, KROPSRO_PRODUCT_ID];
const MODULBRUGERE: Produkt[] = ['basisabo', 'premiumabo'];
const FORLOBSKUNDER: Produkt[] = [KICKSTART_PRODUCT_ID, KROPSRO_PRODUCT_ID];
const PREMIUM: Produkt[] = ['premiumabo', KROPSRO_PRODUCT_ID];

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
- Beskeder: kun synligt for forløbskunder
- Profil: kontoindstillinger, tekstskalering, log ud

Klik på et modul-kort eller en knap for at åbne den. Brug 'Tilbage'-pilen øverst til venstre på undersider for at komme tilbage.`
	},
	{
		titel: 'Forsiden — modulbrugere',
		visFor: MODULBRUGERE,
		indhold: `Forsiden viser:
- En dato-strip øverst med dage fra du oprettede kontoen til 3 dage frem. Klik på en dag for at åbne den dags log. Dage du ikke har indtastet noget på er fadet. Fremtidige dage er fadet og kan ikke åbnes.
- 'Dagens lektion' (hvis Linn har lagt en lektion op for den valgte dato) — klik for at åbne.
- 'Dagens små skridt' med tre kort: Mad, Mikrotræning og Vaner. Klik på et kort for at logge dagens indhold.
- 'Personlig coaching' med knap til at booke 1:1-samtale med Linn.
- 'App-hjælp' med spørgsmål til hvordan appen virker.`
	},
	{
		titel: 'Forsiden — forløbskunder',
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
		titel: 'Træning — overblik og vælg dit aktive program',
		visFor: ALLE_PRODUKTER,
		indhold: `Træning finder du under Moduler → Træning. Her ser du en samlet liste over alle dine programmer:

- Mikrotræning (det program der er knyttet til dit abonnement eller forløb).
- Tildelte programmer (programmer Linn har tildelt dig direkte eller via dit forløb) — vises under mikrotræning hvis Linn har givet dig adgang.
- Dine egne byggede programmer (custom-builder) — kun premium-funktioner.

Hvert program har en "Vælg"-knap. Det program du markerer som aktiv, vises på forsidens "Dagens træning"-kort. Klik på programmet for at se dets øvelser og starte træningen.`
	},
	{
		titel: 'Mikrotræning — abonnenter',
		visFor: MODULBRUGERE,
		indhold: `Mikrotræning finder du under Moduler → Træning → Mikrotræning. Programmet er løbende (14 dage i rotation), så du starter forfra når du har gennemført alle dage.

Knap 'Start dagens træning' åbner dagens session. Når du er færdig, kan du give feedback (Let / Tilpas / Udfordrende). Træningen logges automatisk.

Under 'Seneste dage'-griddet kan du se hvilke dage du har trænet (grøn). I dag er markeret med terra-kant. Klik på en dag for at åbne den dags træning igen.`
	},
	{
		titel: 'Mikrotræning — Kickstart',
		visFor: [KICKSTART_PRODUCT_ID],
		indhold: `Mikrotræning finder du under Moduler → Træning → Mikrotræning. Det er et 21-dages program der følger forløbet. Hver dag er låst op i takt med forløbet — du kan ikke springe frem. Du kan altid gå tilbage til tidligere dage.

Du kan vælge program (med eller uden udstyr) under Profil → Mikrotræning — program. Første gang du åbner Mikrotræning bliver du spurgt om du har kettlebells.

På forsiden vises en lille trænings-video til venstre på Træningskortet — det er dagens første øvelse der allerede er klar at se. Klik kortet for at åbne hele dagens session.`
	},
	{
		titel: 'Mikrotræning — Kropsro',
		visFor: [KROPSRO_PRODUCT_ID],
		indhold: `Mikrotræning finder du under Moduler → Træning → Mikrotræning. Programmet følger hele Kropsro-forløbets længde (84 dage). Hver dag er låst op i takt med forløbet — du kan ikke springe frem. Du kan altid gå tilbage til tidligere dage.

Du kan vælge program (med eller uden kettlebells) under Profil → Mikrotræning — program. Første gang du åbner Mikrotræning bliver du spurgt om du har kettlebells.

På forsiden vises en lille trænings-video til venstre på Træningskortet — det er dagens første øvelse der allerede er klar at se. Klik kortet for at åbne hele dagens session.`
	},
	{
		titel: 'Byg dit eget træningsprogram',
		visFor: PREMIUM,
		indhold: `Som premium-bruger kan du bygge dit eget træningsprogram. Du finder funktionen som det grønne kort nederst på Moduler → Træning ("Byg dit eget program").

I builderen:
- Skriv et navn på programmet (fx 'Ben og balder').
- Klik 'Tilføj øvelse' og søg/vælg fra øvelses-katalog (samme øvelser som mikrotræning).
- For hver øvelse sætter du Sæt, Tid (sekunder pr sæt) og Pause (sekunder mellem sæt).
- Brug op/ned-pilene til at omarrangere rækkefølgen.

Når du gemmer, dukker programmet op på Moduler → Træning. Klik 'Vælg' for at sætte det som dit aktive program — så viser forsidens "Dagens træning" det. Klik selve programmet for at se en oversigt og trykke 'Start træning'. Spil-flowet matcher mikrotræning (ring-timer, lyde, nedtælling de sidste 3 sek).

Du kan altid redigere eller slette et program du har bygget.`
	},
	{
		titel: 'Tildelte træningsprogrammer',
		visFor: FORLOBSKUNDER,
		indhold: `Hvis Linn har tildelt dig et træningsprogram (enten direkte eller via dit forløb), dukker det op under Moduler → Træning sammen med dine andre programmer.

Klik på det for at se dagens øvelser med en stor 'Start træning'-knap. Spil-flowet er det samme som mikrotræning — ring-timer, lyde, fuldskærm-mulighed. Du kan til enhver tid trykke pause, lukke appen og fortsætte hvor du slap.

Hvis du sætter et tildelt program som dit aktive program, bliver det forsidens "Dagens træning".`
	},
	{
		titel: 'Pause og genoptag træning',
		visFor: ALLE_PRODUKTER,
		indhold: `Mens du er midt i en træning kan du:
- Trykke Pause for at fryse timeren.
- Slå lyd til/fra (musik og nedtælling).
- Slå skærm-vågen til/fra.
- Skifte til fuldskærm for stort video-billede.
- Trykke Stop for at forlade træningen — den gemmes som "i gang".

Når du kommer tilbage til samme træning senere, bliver du spurgt "Du fortsætter hvor du slap" og kan vælge at fortsætte eller starte forfra.

På forsidens "Dagens træning"-kort vises et grønt flueben når du har gennemført dagens træning.`
	},
	{
		titel: 'Scan stregkode paa foedevarer (premium-feature)',
		visFor: PREMIUM,
		indhold: `Som premium-bruger kan du scanne stregkoden paa en faerdigvare i stedet for at indtaste protein/fiber-tallene manuelt. Det er praktisk naar du staar i koekkenet med en pakke yoghurt eller en daase tun.

HVOR FINDER DU SCAN-KNAPPEN:
1. Aabn Moduler → Mad (30-30-3 beregner)
2. Gaa til 'Slaa op'-fanen
3. Tryk paa 'Scan'-knappen (med stregkode-ikon ved siden af 'Gem i dagbog')

SAADAN VIRKER DET:
1. Foerste gang du trykker Scan, spoerger telefonen om at give appen kamera-adgang. Tryk 'Tillad'.
2. Bagside-kameraet aabner i fuld skaerm. Hold telefonen over stregkoden saa den fylder rammen — ikke for taet, ikke for langt vaek (typisk 10-15 cm).
3. Naar appen laeser koden, slaar den automatisk op i en aaben foedevare-database (Open Food Facts) og udfylder navn, protein, fiber, kulhydrater, fedt og kalorier pr 100g.
4. Du faar et bekraeftelses-vindue hvor du kan rette tallene hvis de ser forkerte ud, og tilfoeje produktet til dit maaltid.
5. Naeste gang du scanner samme produkt, springer appen direkte til at tilfoeje det — den husker scannede produkter.

HVIS SCANNER IKKE AABNER, ELLER SKAERMEN ER SORT — KAMERA-ADGANG MANGLER:
Det er den hyppigste arsag. Saadan giver du appen lov til kameraet:

iPhone:
1. Indstillinger paa telefonen
2. Scroll ned til 'Safari' (hvis du bruger appen via Safari) ELLER til 'Linn's Academy' (hvis du har gemt den som hjemmeskaerm-app)
3. Find 'Kamera' og saet det til 'Tillad' eller 'Spoerg'
4. Gaa tilbage til appen og pr0v Scan igen

Android:
1. Indstillinger → Apps (eller Apps og notifikationer)
2. Find Chrome (hvis du bruger appen i Chrome) eller Linn's Academy
3. Tilladelser → Kamera → vaelg 'Tillad'
4. Gaa tilbage til appen og pr0v Scan igen

HVIS STREGKODEN IKKE LAESES:
1. Sorg for godt lys — solskin eller laeselys virker bedst, halvmoerke er kameraets fjende
2. Hold telefonen stille — ryst gor det svaert at laese koden
3. Juster afstanden — pr0v at flytte telefonen langsomt ind og ud (typisk 10-15 cm)
4. Tjek at stregkoden ikke er kroellet, doelvt, eller skadet
5. Hvis det stadig ikke virker: luk scanneren og brug 'Tilfoej manuelt'-knappen i samme fane — der indtaster du selv tallene fra naerings-deklarationen paa pakken

HVIS PRODUKTET IKKE FINDES I DATABASEN:
Open Food Facts indeholder de fleste daglige varer, men ind imellem er et produkt nyt eller meget specialiseret. Saa kommer dialogen op med tomme felter — du kan selv indtaste tallene fra pakken, og produktet bliver gemt til naeste gang du scanner det.

SCANNET PRODUKT GEMMES TIL ALLE:
Naar du scanner et produkt og bekraefter naeringstallene, gemmes det i en faelles-database saa andre klienter ogsaa kan bruge det. Du behoever derfor aldrig at scanne samme produkt to gange — heller ikke selvom det er foerste gang i appen totalt.`
	},
	{
		titel: 'Stjerner paa opskrifter',
		visFor: ALLE_PRODUKTER,
		indhold: `Naar du aabner en opskrift under Moduler → Mad → Opskrifter, ser du fem stjerner under titlen. Klik paa antallet af stjerner du synes opskriften fortjener (1 = ikke for mig, 5 = perfekt).

Under stjernerne vises gennemsnittet af alle klienters vurderinger. Hvis ingen har vurderet endnu, staar der "Ingen vurderinger endnu — vaer den foerste".

Du kan altid aendre din egen stjerne ved at klikke paa et nyt antal — kun den nyeste taeller med i gennemsnittet.

Paa selve opskrift-listen vises et lille stjerne-maerke i hjoernet af hver opskrift med gennemsnittet, saa du hurtigt kan se hvilke opskrifter andre klienter er glade for.`
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
		titel: 'Vaner fra dit forløb (Linn-tildelte) — Kickstart',
		visFor: [KICKSTART_PRODUCT_ID],
		indhold: `Ud over dine selvvalgte vaner kan Linn tildele ekstra vaner til alle deltagere paa dit forløb. Du genkender dem på et lille "Fra forløb"-tag ved siden af navnet.

Disse vaner kommer oveni dine egne tre — de tæller IKKE med i din tre-grænse, så du kan stadig vælge tre selv. Du kan ikke fjerne dem (de er låste), men du tjekker ja/delvist/nej på dem hver dag på samme måde som dine egne.`
	},
	{
		titel: 'Vaner fra dit forløb (Linn-tildelte) — Kropsro',
		visFor: [KROPSRO_PRODUCT_ID],
		indhold: `På Kropsro arbejder du med ugentlige vaner som Linn lægger ind. Hver uge (mandag til søndag) får du nye vaner — typisk op til fem.

Du tjekker ja/delvist/nej på dem hver dag på samme måde som dine egne vaner. Du kan ikke fjerne dem (de er låste fra Linn).

Når en ny uge starter, kommer de nye vaner automatisk frem på forsiden under 'Dagens små skridt' og i Vaner-modulet. Tidligere ugers vaner forsvinder fra dagens visning — men dine tidligere svar bevares i historikken.`
	},
	{
		titel: 'Mit forløb',
		visFor: FORLOBSKUNDER,
		indhold: `Mit forløb finder du under Moduler → Mit forløb. Her ser du:
- Alle dage i forløbet med status: gennemført, i gang eller låst.
- Dagens lektion med video/lyd/læsestof.
- En note fra Linn for nogle dage.

Klik på en dag for at åbne lektionen. Forløbet låser dagene op én ad gangen — du kan ikke springe frem.

Når forløbet er gennemført, har du 90 dages bonusperiode hvor du stadig kan se materialet (læseadgang).`
	},
	{
		titel: 'Dagens refleksion på forsiden',
		visFor: FORLOBSKUNDER,
		indhold: `Lige over 'Dagens små skridt' på forsiden vises et 'Dagens refleksion'-kort med et refleksionsspørgsmål Linn har skrevet til dagen. Klik 'Skriv dit svar' for at åbne dagen i Vaner-modulet hvor du kan skrive dit eget svar i tekstfeltet under refleksionen.

Refleksionen vises kun hvis Linn har lagt en op for den dag. Baseline-dagen (dag 0) har ingen refleksion — kun selve baseline-check-in.`
	},
	{
		titel: 'Vaner-oversigt — dagsfarver',
		visFor: FORLOBSKUNDER,
		indhold: `I Vaner-modulet ser du et grid over alle dage i forløbet. Når du har udfyldt en dags vaner, farves cellen efter hvor godt det gik:
- Grøn: 75% eller flere af dagens vaner blev til 'ja' (eller halv-score for 'delvist')
- Orange: 50-74% blev til 'ja'
- Rød: under 50% blev til 'ja'
- Hvid: dagen er endnu ikke udfyldt (eller fremtidig — så er den låst)

Klik en dag for at åbne den og se dine svar (du kan også redigere dem). Baseline-dagen (dag 0) bliver ikke farvet — den har sin egen visning.`
	},
	{
		titel: 'Nul-dage (pause-dage) på Kropsro',
		visFor: [KROPSRO_PRODUCT_ID],
		indhold: `Hvis du holder ferie, bliver syg eller har en travl uge, kan du markere en periode som 'nul-dage'. Forløbet sættes på pause i de dage, og slutdatoen rykker tilsvarende fremad.

Du finder funktionen under Profil → Nul-dage. Vælg fra-dato og til-dato (fremtidige datoer eller i dag). Du kan bruge maks 21 nul-dage i alt i hele forløbet.

På forsidens dato-strip vises pause-dage som stiplede 'Pause'-kasser, og 'Dag X af Y'-tælleren springer dem over. Du kan fortryde en pause-periode på samme dag du satte den, men ikke bagefter.`
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
- En tab pr forløb du har været på (fx "Kickstart maj 2026", "Kropsro"). Indeholder alle lektionerne fra det forløb.
- Træningsøvelser: bibliotek over alle øvelser med video og vejledning.
- Opskrifter: alle opskrifter — klik for at se ingredienser og næring.

Forløbskunder ser også en FAQ-fane med svar på de typiske spørgsmål for forløbet.

Lektion-noter: når du åbner en lektion, kan du skrive personlige refleksioner i 'Mine noter'-feltet nederst. Det gemmes automatisk efter du holder en kort pause i skrivningen. En lille terra-prik ved siden af lektion-titlen viser hvilke lektioner du har skrevet noter til.`
	},
	{
		titel: 'FAQ-fanen i bibliotek',
		visFor: FORLOBSKUNDER,
		indhold: `Som forløbskunde har du en FAQ-fane i biblioteket med typiske spørgsmål om forløbet — fx 'Hvad gør jeg hvis jeg falder fra?', 'Kan jeg starte forfra?' osv. Klik på spørgsmålet for at folde svaret ud.`
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
		titel: 'Profil — indstillinger (basis-app)',
		visFor: ['basisabo'],
		indhold: `Profil-fanen i TabBar viser:
- Dit fornavn og initialer.
- Dit Basis-app-køb med status.
- Tekstskalering (Normal/Stor/Ekstra stor) — gør hele appens tekst større hvis du har svært ved at læse.
- Log ud-knappen nederst.`
	},
	{
		titel: 'Profil — indstillinger (premium-app)',
		visFor: ['premiumabo'],
		indhold: `Profil-fanen i TabBar viser:
- Dit fornavn og initialer.
- Dit Premium-app-køb med status.
- Tekstskalering (Normal/Stor/Ekstra stor) — gør hele appens tekst større hvis du har svært ved at læse.
- Log ud-knappen nederst.`
	},
	{
		titel: 'Profil — indstillinger (forløb)',
		visFor: FORLOBSKUNDER,
		indhold: `Profil-fanen i TabBar viser:
- Dit fornavn og initialer.
- Dine forløbs-køb med status.
- Tekstskalering (Normal/Stor/Ekstra stor) — gør hele appens tekst større hvis du har svært ved at læse.
- Mikrotræning-program — vælg om du træner med eller uden udstyr.
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
		titel: 'Symptomcheck (MRS + sliders) — mål dine symptomer og velvære over tid',
		visFor: ALLE_PRODUKTER,
		indhold: `Symptomcheck finder du under Moduler → Symptomcheck. Den kombinerer:
- 5-slider velvære-check (energi, mave, cravings, humør, søvn) på skala 1-10
- 11-punkts symptomtjekliste (Menopause Rating Scale / MRS) der måler overgangsalder-symptomer i tre områder: krop og søvn, humør og energi, underliv og blære

Hvor ofte (altid om søndagen efter første udfyldelse):
- App-kunde uden tidligere forløb: første udfyldelse må tages med det samme som baseline, derefter hver 4. søndag.
- App-kunde der TIDLIGERE har været på forløb: cyklen arves fra forløbet (sidste udfyldelse lå allerede på en søndag), så fremtidige udfyldelser bliver automatisk hver 4. søndag.
- Kickstart-kunde: dag 0 (søndag), derefter hver søndag gennem forløbet.
- Kropsro-kunde: dag 0 (søndag), derefter hver 4. søndag gennem forløbet.

Når det er tid til at udfylde, vises et terra "Tag din symptomcheck"-kort på din forside. Klik for at åbne modulet. Når du har udfyldt, viser kortet i stedet datoen for næste udfyldelse — du kan ikke tage en ny check før den dato, så grafen forbliver retvisende.

For Kropsro: når du åbner en dag i Vaner-modulet der er en MRS-checkin-dag (dag 0, 28, 56, 84), vises også et "Tid til symptomcheck"-kort øverst med direkte link til modulet.

I selve checken udfylder du først de 5 sliders (træk fra 1-10), så de 11 MRS-spørgsmål (Ingen / Lidt / En del / Meget / Voldsomt). I alt 16 svar. Resultatet viser:
- Din MRS total-score (0-44) med fortolkning fra internationalt anerkendt MRS-skala.
- Score pr de tre symptom-områder med deres egen fortolkning.
- Bar-visualisering pr enkelt symptom.
- Dine 5 sliders-værdier som bars nederst.

Når du har udfyldt 2+ gange, vises en udviklings-graf på forsiden af modulet så du kan se hvordan dine symptomer udvikler sig over tid. Du kan altid klikke på en tidligere udfyldelse for at se den.

Bemærk: Den ugentlige slider-check inde i Vaner-modulet (om søndagen) fortsætter uændret. Symptomcheck er en separat dybere vurdering der inkluderer både sliders OG MRS.`
	},
	{
		titel: 'Planter til tarmmikrobiom (challenge)',
		visFor: [KROPSRO_PRODUCT_ID],
		indhold: `Når Linn starter en challenge i Kropsro-forløbet, vises et lille challenge-kort på din forside hver dag i perioden. Det går ud på at spise så mange forskellige planter som muligt — frugt, grøntsager, bælgfrugter, nødder, korn, krydderier og fermenteret mad tæller alle med. Jo flere forskellige du får, jo mere mangfoldigt bliver dit tarmmikrobiom.

SÅDAN GØR DU:
1. Tryk 'Indtast frugt/grøntsag' på challenge-kortet
2. Søg efter den plante du har spist (fx 'æble' eller 'kanel') og tryk på den
3. Du kan tilføje flere ad gangen — de dukker op som små chips øverst
4. Hvis du har spist noget der ikke er på listen, kan du bare skrive navnet i søgefeltet og trykke '+ Tilføj' øverst
5. Når du er færdig, tryk 'Gem'

Hver plante tæller kun én gang i alt for hele challenge-perioden, så det handler om at få så mange forskellige slags som muligt — ikke om at spise samme æble fem gange.

STILLINGEN:
Når du trykker 'Gem' (eller 'Se stillingen') vises en fuld-skærm med top-3 podium øverst og resten af deltagerne nedenfor. Du ser fornavn + første bogstav i efternavn på alle andre. Din egen placering er fremhævet. Tryk krydset øverst for at lukke og komme tilbage til forsiden.

Når challenge-perioden er forbi, forsvinder kortet automatisk fra forsiden.`
	},
	{
		titel: 'Buddy-gruppe på Kropsro',
		visFor: [KROPSRO_PRODUCT_ID],
		indhold: `Ved første login på Kropsro bliver du spurgt om du vil være med i en buddy-gruppe på fire til fem personer fra forløbet, der holder hinanden oppe i hverdagen. En slags minifællesskab indenfor det store fællesskab.

I skriver sammen, deler hvad der er svært, fejrer jeres små wins og holder hinanden ansvarlig. Det er frivilligt at deltage.

Hvis du svarer ja, sætter Linn dig manuelt sammen med en gruppe. Du kan altid skifte mening senere.

Du bliver kun spurgt én gang ved første login. Når du har sagt ja eller nej, popper modalen ikke op igen.`
	},
	{
		titel: 'Facebook-gruppe på Kropsro',
		visFor: [KROPSRO_PRODUCT_ID],
		indhold: `På dag 0 eller derefter bliver du spurgt om du er kommet ind i Kropsros Facebook-gruppe. Gruppen er hvor deltagerne mødes, deler oplevelser og stiller spørgsmål til Linn.

Svar Ja hvis du er inde — så spørger vi ikke igen. Svar "Ikke endnu" hvis du stadig leder efter linket (du finder det i din velkomst-mail fra Linn).

Modalen vises kun én gang, så når du har svaret er den væk.`
	},
	{
		titel: 'Forsidens "Dagens træning"-kort',
		visFor: ALLE_PRODUKTER,
		indhold: `På forsiden vises et "Træning"-kort der viser:
- Navnet på det program du har valgt som aktiv (Mikrotræning som default, eller dit eget/tildelt program).
- Et grønt flueben hvis du har trænet i dag.
- Klik åbner det aktive program direkte.

Hvis du har valgt en historisk dato i datostripen øverst, viser kortet det program du faktisk trænede den dag — også hvis du siden har skiftet aktivt program.

For at skifte aktivt program: gå til Moduler → Træning og klik "Vælg" ved siden af det program du vil have som default.`
	},
	{
		titel: 'Hvis appen ikke virker som forventet (tekniske problemer)',
		visFor: ALLE_PRODUKTER,
		indhold: `Hvis brugeren beskriver et teknisk problem — knapper der ikke reagerer på tryk, appen er langsom, billeder eller video loader ikke, noget hænger fast, hun bliver logget ud uventet, eller hvis hun bare siger "det virker ikke" — så GUIDE hende pædagogisk gennem fejlfinding.

START ALTID med at spørge venligt hvilken telefon hun bruger og hvilken system-version. Skriv fx: "For at jeg kan hjælpe dig bedst, kan du fortælle mig hvilken telefon du har, og hvilken version dit system kører? Det står i indstillinger:
- iPhone: Indstillinger → Generelt → Om (kig efter 'Software-version')
- Android: Indstillinger → Om telefonen (kig efter 'Android-version')"

Når du kender system + version, vejled skridt for skridt — pædagogisk, varmt, ingen teknik-jargon. Målgruppen er kvinder i overgangsalderen, ikke teknisk vante. Skriv ikke "cache", "WebView", "browser-engine" — sig fx "den lille indbyggede motor der kører apps".

FØRSTE-TRIN DER OFTE HJÆLPER (uanset problem):
1. Luk appen helt. Ikke bare gem den i baggrunden — luk den helt ned.
  - iPhone: swipe op fra bunden af skærmen og hold, swipe Linn's Academy-vinduet væk
  - Android: tryk på firkant-knappen nederst (eller swipe op og hold), og swipe appen væk
2. Åbn appen igen.
3. Tjek om problemet stadig er der.

HVIS PROBLEMET ER PÅ ANDROID OG NOGET REAGERER MÆRKELIGT (knapper, scroll, indtastning):
Mange Android-telefoner har en lille "indbygget webbrowser" der bestemmer hvordan apps som vores kører. Hvis den er gammel, kan ting holde op med at virke korrekt. Vejled hende sådan her:
1. Åbn Google Play Butik på telefonen.
2. Tryk på dette link (eller sæt det ind i adressefeltet i browseren): https://play.google.com/store/apps/details?id=com.google.android.webview
3. Hvis der står "Opdater" på knappen, tryk på den. Hvis der står "Åbn", er hun allerede opdateret.
4. Gør det samme her: https://play.google.com/store/apps/details?id=com.android.chrome
5. Luk Linn's Academy-appen helt ned og åbn den igen.

Det tager max 2 minutter og koster ingenting. Forklar det som "at give telefonens lille indbyggede motor en smøre".

HVIS PROBLEMET ER PÅ IPHONE:
Først prøv luk-app + åbn igen (se første-trin ovenfor). Hvis det ikke hjælper, foreslå softwareopdatering:
1. Indstillinger
2. Generelt
3. Softwareopdatering
4. Hvis der ligger en opdatering, installer den. Det kan tage 10-30 min.

HVIS HUN BLIVER LOGGET UD UVENTET:
Det er normalt. Vi logger automatisk brugere ud efter længere tids inaktivitet for sikkerhedens skyld. Bed hende logge ind igen med samme e-mail og adgangskode.

HVIS BILLEDER ELLER VIDEO IKKE LOADER:
Det er som regel internet-forbindelsen. Vejled:
1. Tjek om hun er på WiFi eller mobil-data. Prøv at skifte mellem dem.
2. Hvis hun er på svagt WiFi, bed hende gå tættere på routeren.
3. Luk app + åbn igen og prøv igen.

HVIS APPEN ER LANGSOM ELLER HÆNGER:
1. Luk app + åbn igen.
2. Bed hende genstarte hele telefonen (sluk + tænd).
3. Tjek at hendes telefon har plads tilbage (Indstillinger → Lager).
4. Tjek at app + system er opdateret (se ovenfor).

ANDRE TEKNISKE PROBLEMER (ikke specifikt nævnt her):
Brug din almindelige sunde fornuft. Første-trin er altid: spørg om telefon + version, foreslå luk-og-åbn, foreslå opdatering hvis relevant. Vær altid varm og tålmodig.

HVIS PROBLEMET IKKE LØSES EFTER DE VISTE SKRIDT:
Da er det ude over hvad du kan hjælpe med her, og du må undtagelsesvis henvise hende videre (dette er den ENESTE situation hvor du må foreslå kontakt til Linn):
- Forløbskunder: foreslå at hun stiller spørgsmålet i Beskeder-fanen nederst i appen
- App-kunder uden forløb: foreslå at hun skriver til kontakt@linnsacademy.dk

Skriv det venligt: "Det her er desværre ude over hvad jeg kan hjælpe med her. [For forløbskunder:] Skriv det i Beskeder-fanen nederst i appen, så kigger Linn på det. [For app-kunder:] Skriv en mail til kontakt@linnsacademy.dk, så kigger Linn på det."`
	},
	{
		titel: 'Hvis du ikke kan finde noget',
		visFor: ALLE_PRODUKTER,
		indhold: `Hvis du leder efter en feature der ikke er nævnt her, så findes den sandsynligvis ikke i appen endnu. Prøv at lukke og åbne appen igen hvis noget ikke virker som forventet.`
	}
];

// =============================================================================
// PROMPT-BYGNING
// =============================================================================

function fagligRedirect(activeProduct: ActiveProduct | undefined): string {
	const erPremium = activeProduct === 'premiumabo' || activeProduct === KROPSRO_PRODUCT_ID;
	if (erPremium) {
		return 'henvis til Linn AI (premium-feature i Moduler)';
	}
	return 'forklar venligt at App-hjælp kun svarer på spørgsmål om hvordan appen virker';
}

function brugerKontekst(activeProduct: ActiveProduct | undefined): string {
	switch (activeProduct) {
		case KICKSTART_PRODUCT_ID:
			return `KUNDE-KONTEKST: Denne bruger er forløbskunde paa Kickstart (21-dages forløb). Svar ALTID ud fra Kickstart-flowet — daglige vaner, 21-dages mikrotraening, ugentlige check-ins (dag 7, 14, 21), MRS dag 0/10-11/21. Naevn ALDRIG Kropsro-specifikke features (ugentlige vaner, nul-dage, 84 dage).`;
		case KROPSRO_PRODUCT_ID:
			return `KUNDE-KONTEKST: Denne bruger er forløbskunde paa Kropsro (84-dages forløb). Svar ALTID ud fra Kropsro-flowet — UGENTLIGE vaner mandag-soendag (op til 5 pr uge), refleksioner hver dag paa forsiden, MRS-checkin paa dag 0/28/56/84, nul-dage til pauser. Naevn ALDRIG Kickstart-specifikke features (daglige admin-vaner, 21 dage, ugentlige check-ins).`;
		case 'basisabo':
			return `KUNDE-KONTEKST: Denne bruger har Basis-abonnement (modulbruger uden forløb). Svar ud fra abonnementsbruger-flowet. Naevn ALDRIG forløbs-features eller premium-features.`;
		case 'premiumabo':
			return `KUNDE-KONTEKST: Denne bruger har Premium-abonnement (modulbruger uden forløb). Svar ud fra premium-abonnementsbruger-flowet. Naevn ALDRIG forløbs-features.`;
		default:
			return `KUNDE-KONTEKST: Brugerens praecise produkt-type er ukendt — hold svaret generelt om appens navigation og undlad at naevne forløbs- eller premium-features.`;
	}
}

function byggSystemPromptBase(activeProduct: ActiveProduct | undefined): string {
	return `Du er App-hjælp — en assistent der svarer på spørgsmål om hvordan Linn's Academy-appen virker. Dit ENESTE formål er at hjælpe brugeren med at navigere og bruge appen.

${brugerKontekst(activeProduct)}

VIGTIGE REGLER:
- Du må KUN svare på spørgsmål om appen og dens features, OG på tekniske problemer (knapper, performance, video, login, opdatering osv.) — se sektionen 'Hvis appen ikke virker som forventet' nedenfor for hvordan du guider tekniske problemer.
- Hvis brugeren spørger om noget fagligt (kost, træning, helbred, overgangsalder, hormoner, motivation, livsstil etc.) — afvis venligt og ${fagligRedirect(activeProduct)}.
- Hvis brugeren spørger om en FEATURE der ikke findes i din videnbase nedenfor — sig venligt at du ikke ved det, og at featuren sandsynligvis ikke findes i appen endnu. (Tekniske problemer er undtaget — der må du bruge din almindelige sunde fornuft til at hjælpe også når problemet ikke står eksplicit beskrevet, jf. sektionen 'Hvis appen ikke virker som forventet'.)
- REGEL OM KONTAKT TIL LINN: Foreslå ALDRIG under normale omstændigheder at brugeren kontakter Linn — hverken via Beskeder-fanen, e-mail, support-mail, kontaktformular eller anden form. Dette gælder ALLE brugere, INKLUSIV forløbskunder. Også selvom du ikke kan svare på et fagligt spørgsmål, så sig det venligt uden at foreslå nogen form for kontakt-vej til Linn. Den eneste tilladte 'next step' er Linn AI (kun hvis premium-bruger). ÉN UNDTAGELSE: Hvis spørgsmålet handler om et TEKNISK problem og du IKKE kan løse det med de skridt der står i sektionen 'Hvis appen ikke virker som forventet', SÅ må du undtagelsesvis foreslå kundekontakt som beskrevet i den sektion.
- Du ved kun om de features brugeren faktisk har adgang til (se VIDENBASE nedenfor). Nævn ALDRIG features, produkter, abonnementer eller forløb hun ikke har — det skaber forvirring og er imod hendes interesse. Sammenlign aldrig med andre produkt-typer.
- Svar kort, konkret og praktisk. Brug 'du' og 'din'. Skriv på dansk.
- Brug ikke tegn som em-dash (—), semikolon (;) eller engelsk-stil typografi. Skriv almindeligt dansk med bindestreger og punktum.

VIDENBASE — sådan virker appen for DENNE bruger:`;
}

/**
 * Bygger system-prompten med kun de sektioner brugerens produkt giver adgang til.
 */
export function byggAppHjaelpSystemPrompt(activeProduct: ActiveProduct | undefined): string {
	const base = byggSystemPromptBase(activeProduct);
	if (!activeProduct) {
		return (
			base +
			'\n\n(Brugerens adgang kunne ikke afgøres — svar generelt om appens grundlæggende navigation.)'
		);
	}
	const synlige = APP_HJAELP_SEKTIONER.filter((s) => s.visFor.includes(activeProduct));
	const videnbase = synlige
		.map((s) => `\n## ${s.titel}\n${s.indhold}`)
		.join('\n');
	return base + videnbase;
}
