// ============================================================
// Soegning i foedevarer i 30-30. Se SPEC-3.0.md afsnit 26.16.
//
// PROBLEMET: korte ord drukner i stoej. Soeger hun "aeg", finder en bred
// soegning ogsaa Aeggenudler og paalaeg, og det er vaerst paa netop de
// ord folk soeger mest efter.
//
// Den gamle app loeser det med et afkryds der hedder "Kun hele ord".
// 3.0 loeser det med RAEKKEFOELGEN i stedet. Linns valg 12. august, og
// begrundelsen er vaerd at kende:
//
//   1. maalgruppen skal ikke kende en indstilling for at faa et godt
//      resultat. Et afkryds hun ikke forstaar, proever hun aldrig
//   2. sortering skjuler ingenting. Afkrydset er enten eller, saa
//      slaar hun det til, forsvinder Aeggenudler ogsaa naar det var den
//      hun ledte efter
//   3. det koster ingen plads paa skaermen
//
// Inden for hver gruppe staar det korteste navn foerst, saa "Skyr"
// kommer foer "Skyr med vanilje". Det er den enkle vare hun oftest er
// ude efter.
// ============================================================

import type { Fodevare } from './kost';

/** Hvor et ord slutter i et foedevare-navn. Samme som den gamle app. */
const ORD_SKEL = /[\s,;\-/&()]+/;

/** Antallet af traeffere skaermen viser. */
export const MAKS_TRAEF = 8;

/**
 * Er soegeordet et HELT ord i navnet.
 *
 * "aeg" er et helt ord i "Paalaeg med aeg", men ikke i "Aeggenudler".
 */
export function erHeltOrd(navn: string, ord: string): boolean {
	if (!ord) return false;
	return navn.toLowerCase().split(ORD_SKEL).includes(ord);
}

/**
 * Hvor godt en foedevare passer. Lavest er bedst.
 *   0 = soegeordet er et helt ord i navnet
 *   1 = det staar bare inde i navnet
 */
export function rang(navn: string, ord: string): number {
	return erHeltOrd(navn, ord) ? 0 : 1;
}

/**
 * Soegningen delt op i ord.
 *
 * Der deles ved MELLEMRUM saavel som komma. Foer 12. august blev hele
 * strengen slaaet op paa én gang, saa "skyr vanilje" gav NUL traeffere.
 * Praecis samme fejl som i opskrift-soegningen, hvor otte almindelige
 * to-ords-soegninger alle gav nul. Se SPEC-3.0.md 9.5.
 *
 * Den gamle app kraever komma for det samme. Her virker begge dele.
 */
export function soegetermer(soegeord: string): string[] {
	return (soegeord ?? '')
		.toLowerCase()
		.split(ORD_SKEL)
		.map((t) => t.trim())
		.filter((t) => t.length > 0);
}

/** Hvor mange af soegeordene der staar som HELE ord i navnet. */
export function antalHeleOrd(navn: string, termer: string[]): number {
	return termer.filter((t) => erHeltOrd(navn, t)).length;
}

// ------------------------------------------------------------
// Slaafejl. Linns beslutning 25. august
// ------------------------------------------------------------

/**
 * Hvor kort et soegeord maa vaere, foer der gives slaek.
 *
 * MAALT PAA DE 1.700 VARER EN NY KUNDE KAN SE, foer det blev bygget:
 *
 *   ét tegns slaek   æg, ost, tomat, laks: INGEN aendring
 *                    ris: én til, nemlig ribs
 *                    yogurt: fra 0 til 17. kartofel: fra 0 til 15
 *
 *   to tegns slaek   ost: fra 98 til 212, ind kommer aerter, amaranth
 *                    laks: fra 14 til 45, ind kommer baguette og kiks
 *                    ris: fra 107 til 190, ind kommer brie
 *
 * Derfor ét tegn og ikke to. Graensen paa fem tegn er en ekstra sikring:
 * paa et kort ord er ét tegn en stor del af ordet, og maalgruppen soeger
 * netop paa korte ord som aeg, ost og ris.
 *
 * DET HER LOESER IKKE "iceberg" MOD "isberg". De to er ikke en stavefejl,
 * de er to forskellige ord, og ingen grad af slaek faar dem til at moede
 * hinanden. Det kraever et soegeord-felt ved siden af navnet, og det er
 * ikke bygget.
 */
export const MIN_LAENGDE_FOR_SLAEK = 5;

/**
 * Redigeringsafstand med loft.
 *
 * Stopper saa snart afstanden er stoerre end `maks`, saa vi ikke regner
 * hele tabellen ud for to ord der aabenlyst ikke ligner hinanden. Det
 * her koeres tusindvis af gange for hvert bogstav hun taster.
 */
export function redigeringsafstand(a: string, b: string, maks = 1): number {
	if (a === b) return 0;
	// Er de for forskellige i laengde, kan de umuligt ligge inden for loftet.
	if (Math.abs(a.length - b.length) > maks) return maks + 1;
	const n = b.length;
	let forrige = Array.from({ length: n + 1 }, (_, j) => j);
	for (let i = 1; i <= a.length; i++) {
		const naeste = [i, ...Array(n).fill(0)];
		let bedst = i;
		for (let j = 1; j <= n; j++) {
			naeste[j] = Math.min(
				naeste[j - 1] + 1,
				forrige[j] + 1,
				forrige[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)
			);
			if (naeste[j] < bedst) bedst = naeste[j];
		}
		// Hele raekken er over loftet, saa slutresultatet bliver det ogsaa.
		if (bedst > maks) return maks + 1;
		forrige = naeste;
	}
	return forrige[n];
}

/**
 * Ligner soegeordet et af ordene i navnet, paa ét tegn naer.
 *
 * Kun ord der er lange nok, se MIN_LAENGDE_FOR_SLAEK. Og kun hvis ordet
 * ikke allerede indeholder soegeordet: saa er det et almindeligt traef
 * og skal ikke behandles som en slaafejl.
 */
export function naestenEns(navn: string, term: string): boolean {
	if (term.length < MIN_LAENGDE_FOR_SLAEK) return false;
	const lav = navn.toLowerCase();
	if (lav.includes(term)) return false;
	return lav
		.split(ORD_SKEL)
		.some((o) => o.length >= MIN_LAENGDE_FOR_SLAEK && redigeringsafstand(o, term) <= 1);
}

/**
 * Hendes hjerter, klar til soegningen.
 *
 * HENDES EGNE FOEDEVARER HOLDES UDE, og det er hele forudsaetningen for
 * at et hjerte kan bruges til at sortere efter.
 *
 * 72 % af de 6.855 hjerter i drift er varer hun selv har oprettet, og
 * dem satte den GAMLE app automatisk, uden at hun har valgt dem. Talte
 * de med, ville hendes soegning fyldes med gamle egne indtastninger, og
 * hjertet ville sige noget om hvad appen har gjort i stedet for hvad hun
 * vil have. Det er samme regel som `hjertedeFodevarer` i
 * hjerteFodevare3 allerede foelger, og de to skal blive ved med at vaere
 * enige.
 */
export function hjerterTilSoegning(hjerter: string[], egneIds: Set<string>): Set<string> {
	return new Set((hjerter ?? []).filter((id) => !egneIds.has(id)));
}

/**
 * Alt der skal ligge OEVERST naar hun soeger.
 *
 * Tre ting, og de har hver sin begrundelse:
 *
 *   1. HENDES HJERTER, altsaa det hun selv har markeret
 *   2. HENDES EGNE FOEDEVARER, dem hun har oprettet
 *   3. DE VARER HUN SELV HAR SCANNET
 *
 * LINNS OENSKE 25. august var oprindelig at en scannet vare skulle
 * saettes som favorit automatisk. Vi goer det HER i stedet, og det er en
 * bevidst forskel:
 *
 *   - 3.0 saetter ALDRIG hjertet automatisk, se hjerteFodevare3. Den
 *     regel kom af at den gamle app gjorde det, og 72 % af alle hjerter
 *     er derfor noget kunden aldrig har valgt. Gentog vi det, ville
 *     hjerte-listen blive ubrugelig igen
 *   - Et automatisk hjerte ville kun have virket paa HALVDELEN af
 *     scanningerne. Retter hun ét tal, bliver varen hendes egen, og
 *     hendes egne holdes ude af hjerte-gruppen. Den anden halvdel ville
 *     have set ud som noget der ikke virkede
 *
 * Paa skaermen faar hun praecis det hun bad om: varen ligger oeverst.
 * Forskellen er at hjertet stadig kun betyder hendes eget valg.
 */
export function foerstISoegning(args: {
	hjerter: string[];
	/** Id'erne paa de foedevarer hun selv har oprettet. */
	egneIds: Set<string>;
	/** Id'erne paa de varer hun selv har scannet. */
	scannedeAfHende?: string[];
}): Set<string> {
	const ud = hjerterTilSoegning(args.hjerter, args.egneIds);
	for (const id of args.egneIds) ud.add(id);
	for (const id of args.scannedeAfHende ?? []) ud.add(id);
	return ud;
}

/**
 * Hvilke af de delte, scannede varer hun selv har scannet.
 *
 * Feltet `scannetAf` skrives af `delScanning` og laeses kun her, saa
 * castet ligger ét sted.
 */
export function mineScanninger(varer: { id: string }[], uid: string | undefined): string[] {
	if (!uid) return [];
	return varer
		.filter((v) => (v as { scannetAf?: unknown }).scannetAf === uid)
		.map((v) => v.id);
}

/**
 * Soeger og sorterer.
 *
 * ALLE ord skal findes, men de maa staa i hvert sit hjoerne af navnet og
 * i vilkaarlig raekkefoelge: "vanilje skyr" finder ogsaa Skyr med
 * vanilje. Et enkelt ord giver praecis samme traeffere som foer, saa
 * ingenting forsvandt da flere ord blev muligt.
 *
 * Raekkefoelgen: HENDES EGET foerst, saa flest hele ord, saa korteste
 * navn. `foerst` er hjerter, hendes egne varer og hendes egne
 * scanninger, se foerstISoegning.
 *
 * HVORFOR HJERTET VINDER OVER HELE ORD. Linns beslutning 25. august.
 * Reglen om hele ord er et gaet paa hvad hun mon mener, og den findes
 * fordi vi ellers ikke ved noget. Hjertet er hendes EGET valg, og et
 * gaet skal aldrig slaa et svar hun selv har givet. Soeger hun "feta"
 * og faar tre slags, er hjertet det eneste sted appen ved hvilken der er
 * hendes.
 *
 * Det kan ikke oversvoemme listen: medianen er 13 hjerter pr kunde, og
 * de skal ogsaa ramme soegeordet for overhovedet at komme med.
 *
 * Sorteringen SKJULER ingenting, praecis som da hele ord blev indfoert.
 * Alle traeffere er der stadig, de staar bare i en anden raekkefoelge.
 */
export function soegFodevarer(
	foods: Fodevare[],
	soegeord: string,
	maks: number = MAKS_TRAEF,
	foerst: Set<string> = new Set()
): Fodevare[] {
	const termer = soegetermer(soegeord);
	if (termer.length === 0) return [];

	const traef = foods.filter((f) => {
		const navn = f.name.toLowerCase();
		return termer.every((t) => navn.includes(t));
	});

	const sorteret = sorter(traef, termer, foerst).slice(0, maks);

	// SLAAFEJL KOMMER ALTID BAGEFTER, og kun naar der er plads tilbage.
	//
	// To grunde. Et naesten-traef maa aldrig skubbe det rigtige svar ned,
	// og har hun allerede otte rigtige traeffere, er der ingen grund til
	// at regne paa noget som helst. Det her koeres for hvert bogstav hun
	// taster.
	if (sorteret.length >= maks) return sorteret;
	const brugte = new Set(sorteret.map((f) => f.id));
	const naesten = foods.filter(
		(f) => !brugte.has(f.id) && termer.every((t) => naestenEns(f.name, t) || f.name.toLowerCase().includes(t))
	);
	return [...sorteret, ...sorter(naesten, termer, foerst)].slice(0, maks);
}

/** Raekkefoelgen, brugt baade paa de noejagtige og paa slaafejlene. */
function sorter(liste: Fodevare[], termer: string[], foerst: Set<string>): Fodevare[] {
	return liste
		.slice()
		.sort((a, b) => {
			// Hendes eget foerst. Se hvorfor ovenfor.
			const ja = foerst.has(a.id);
			const jb = foerst.has(b.id);
			if (ja !== jb) return ja ? -1 : 1;
			const ha = antalHeleOrd(a.name, termer);
			const hb = antalHeleOrd(b.name, termer);
			// Flest hele ord foerst, saa "aeg" ikke drukner i Aeggenudler.
			if (ha !== hb) return hb - ha;
			// Kortest navn foerst inden for hver gruppe: "Skyr" foer
			// "Skyr med vanilje". Det er den enkle vare hun oftest vil have.
			if (a.name.length !== b.name.length) return a.name.length - b.name.length;
			return a.name.localeCompare(b.name, 'da');
		});
}
