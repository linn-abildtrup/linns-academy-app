// ============================================================
// Etape 3 af regnemaskinen. Fra kernenavn til foedevare i databasen.
//
// Det her er broen der aldrig har eksisteret. 1105 ingrediens-linjer i
// 133 opskrifter, og NUL af dem peger i dag paa en foedevare. Derfor
// har opskrifternes makro hidtil vaeret tal skrevet i teksten, og
// derfor kan ris ikke skiftes ud med kartofler.
//
// FIRE TIDLIGERE FORSOEG SLOG FEJL HER. Aarsagen var hver gang den
// samme: navnet blev matchet for loest. "aerter" ramte "kikaerter",
// "ris" ramte "riseddike", og toerre linser blev koblet til kogte.
//
// Derfor er filen bygget efter ét princip:
//
//   HELLERE INGEN KOBLING END EN FORKERT.
//
// Er der den mindste tvivl, saettes sikker til false, og linjen havner
// paa en admin-skaerm hvor Linn vaelger selv. En forkert kobling er
// vaerre end ingen, for en forkert kobling ser rigtig ud.
//
// Se SPEC-3.0.md 26.18 og 26.19.
// ============================================================

import type { Fodevare } from './kost';
import { kerneNavn, tilstand, type Tilstand } from './ingrediensNavn3';
import { rensNavn } from './enhedsvaegt3';

/**
 * Kun Frida-poster kobles automatisk.
 *
 * Databasen har 1381 poster fra den officielle foedevaredatabase og 840
 * uden kilde fra Kickstart-tiden. Maalingen 13. august viste at alle de
 * poster med umulige kalorier laa i gruppen uden kilde. Toerrede linser
 * med 70 kalorier og afdryppede kikaerter med 337.
 *
 * De maa gerne vaelges i haanden, men aldrig af en maskine.
 */
export const AUTO_KILDE = 'frida';

const ORD_SKEL = /[\s,()/]+/;

/**
 * Varer hvor tilstanden aendrer naeringen kraftigt. For dem gaelder den
 * strengeste matchning: kun hele ord, aldrig stumper af sammensatte ord.
 * Samme liste som i ingrediensNavn3.
 */
const TILSTAND_FOELSOM =
	/linser|kikaert|boenner|aerter|ris\b|pasta|bulgur|quinoa|couscous|gryn|byg|spelt|groed|noedler/;

/**
 * Ord der skiller sorter fra hinanden. Staar der ét af dem i baade
 * ingrediensen og varen, og er de forskellige, er det den forkerte vare.
 */
const SORTS_ORD = new Set([
	'hvide', 'hvid', 'groenne', 'groen', 'sorte', 'sort', 'roede', 'roed',
	'brune', 'brun', 'gule', 'gul', 'lyse', 'lys', 'moerk', 'moerke'
]);

function ord(s: string): string[] {
	return rensNavn(s).split(ORD_SKEL).filter(Boolean);
}

/** Om et helt ord staar i navnet. "aerter" rammer ikke "kikaerter". */
function harHeltOrd(navn: string, o: string): boolean {
	return ord(navn).includes(o);
}

/**
 * Laeser tilstanden ud af en foedevares navn i databasen.
 * Frida skriver den selv, fx "Linser, groenne, toerrede, raa" og
 * "Kikaerter, lyse, kogte, konserves".
 */
export function foedevareTilstand(navn: string): Tilstand {
	const n = rensNavn(navn);
	if (/\bkonserves\b|\bafdryppe(t|de)\b|\bdase\b|\bdraenet\b/.test(n)) return 'afdryppet';
	if (/\bkogt(e)?\b|\btilberedt(e)?\b|\bdampet\b/.test(n)) return 'kogt';
	if (/\btoerre(de|t)?\b|\btoer\b|\bra\b|\braa\b/.test(n)) return 'toer';
	return null;
}

/**
 * Tjekker om en foedevares egne tal haenger sammen.
 *
 * Atwater: kalorier er cirka protein gange 4, plus kulhydrat gange 4,
 * plus fedt gange 9, plus fiber gange 2. Passer varens kalorier ikke
 * med dens egen makro, er ét af tallene forkert.
 *
 * Det var saadan de daarlige poster blev fundet 13. august: toerrede
 * linser med 70 kalorier og afdryppede kikaerter med 337, som er
 * toervaegtens tal.
 *
 * Alkohol giver 7 kalorier pr gram og indgaar ikke i formlen, saa
 * drikkevarer kan ikke tjekkes paa den her maade og faar lov at passere.
 */
export function taleneErUmulige(v: Fodevare): boolean {
	const p = v.p ?? 0;
	const fib = v.f ?? 0;
	const kh = v.kh;
	const fedt = v.fedt;
	const kcal = v.kcal;

	// Fysisk umuligt uanset alt andet.
	if (p < 0 || fib < 0 || p > 100 || (kh ?? 0) > 100 || (fedt ?? 0) > 100) return true;
	if ((kcal ?? 0) > 950) return true;

	// Mangler tallene, er de UKENDTE og ikke forkerte. Det er en vigtig
	// forskel: en vare uden registreret fedt skal ikke behandles som en
	// vare med umuligt fedt.
	if (kh === undefined || fedt === undefined || kcal === undefined) return false;

	const beregnet = p * 4 + kh * 4 + fedt * 9 + fib * 2;
	if (beregnet < 15 && kcal < 30) return false; // naesten nul i begge ender
	if (beregnet < 15) return true;
	return Math.abs(kcal - beregnet) / beregnet > 0.25;
}

/**
 * Om en vare er god nok til at blive koblet af en maskine.
 * Kraever baade at tallene er der OG at de haenger sammen.
 */
export function sundVare(v: Fodevare): boolean {
	if (taleneErUmulige(v)) return false;
	return v.kh !== undefined && v.fedt !== undefined && v.kcal !== undefined;
}

export interface Kandidat {
	vare: Fodevare;
	/** Hoejere er bedre. */
	point: number;
	/** Kort dansk begrundelse, vises i admin. */
	hvorfor: string;
}

export interface Kobling {
	kerne: string;
	/** Den foedevare vi foreslaar, eller null hvis intet duer. */
	foodId: string | null;
	/**
	 * true betyder at koblingen kan saettes uden at Linn ser paa den.
	 * Kraever eksakt navn, én vinder, Frida som kilde og enighed om
	 * tilstand.
	 */
	sikker: boolean;
	hvorfor: string;
	/** De naeste bud, saa admin kan vaelge uden at soege. */
	forslag: Kandidat[];
}

/**
 * Giver point til én foedevare mod ét kernenavn.
 * Returnerer null hvis varen er direkte uegnet.
 */
function pointFor(kerne: string, oensketTilstand: Tilstand, vare: Fodevare): Kandidat | null {
	const kerneOrd = ord(kerne).filter((o) => !/^(toer|kogt|afdryppet)$/.test(o));
	if (kerneOrd.length === 0) return null;

	const vareOrd = ord(vare.name);
	const vareTilstand = foedevareTilstand(vare.name);

	// Alle ord i kernenavnet skal staa som hele ord i varen. Uden den
	// regel rammer "aerter" baade kikaerter og sukkeraerter.
	const traef = kerneOrd.filter((o) => vareOrd.includes(o));

	let point = 0;
	const grunde: string[] = [];
	let sammensatTraef = false;

	if (traef.length === 0) {
		// Ingen hele ord. Paa dansk staar hovedordet sidst i et
		// sammensat ord, saa olivenolie ER en slags olie. Den slags
		// tillades som et SVAGT bud, saa admin faar noget at vaelge
		// imellem naar ingrediensen bare hedder "olie".
		//
		// Men ALDRIG for baelgfrugter og korn. Kikaerter er ogsaa
		// aerter efter samme regel, og dér er naeringen vidt
		// forskellig. Det var netop den slaeknings der vaeltede de fire
		// tidligere forsoeg.
		if (TILSTAND_FOELSOM.test(kerne)) return null;
		const halerTraef = kerneOrd.filter((o) => o.length >= 4 && vareOrd.some((w) => w.endsWith(o)));
		if (halerTraef.length === 0) return null;
		sammensatTraef = true;
		point -= 60;
		grunde.push('kun del af et sammensat ord');
		traef.push(...halerTraef);
	}

	// Hvor stor en del af kernenavnet der er daekket.
	const daekning = traef.length / kerneOrd.length;
	point += daekning * 100;
	if (daekning === 1) grunde.push('alle ord passer');
	else grunde.push(`${traef.length} af ${kerneOrd.length} ord passer`);

	// Eksakt navn er det staerkeste signal der findes.
	if (rensNavn(vare.name) === rensNavn(kerne)) {
		point += 100;
		grunde.push('navnet er praecis det samme');
	}

	// Kilden. Kun Frida kan vinde automatisk.
	if (vare.kilde === AUTO_KILDE) {
		point += 30;
		grunde.push('fra Frida');
	} else {
		point -= 20;
	}

	// Tilstanden. Det er her de fire tidligere forsoeg gik galt.
	if (oensketTilstand) {
		if (vareTilstand === oensketTilstand) {
			point += 60;
			grunde.push(`begge er ${oensketTilstand}`);
		} else if (vareTilstand === null) {
			point -= 10;
		} else {
			// Toerre linser mod kogte linser er fire gange forkert.
			// Den maa aldrig vinde.
			point -= 200;
			grunde.push(`varen er ${vareTilstand}, ikke ${oensketTilstand}`);
		}
	} else if (vareTilstand === 'toer' || vareTilstand === 'kogt' || vareTilstand === 'afdryppet') {
		// Ingrediensen siger ingenting om tilstand, saa en vare der
		// insisterer paa én er et daarligere bud end en neutral.
		point -= 15;
	}

	// Modstridende sorts-ord. Siger ingrediensen hvide boenner og varen
	// siger groenne boenner, er det den forkerte vare, selv om ordet
	// boenner passer. Hvide boenner har 7 g protein, groenne har 1,5.
	const kerneSort = kerneOrd.filter((o) => SORTS_ORD.has(o));
	const vareSort = vareOrd.filter((o) => SORTS_ORD.has(o));
	if (kerneSort.length && vareSort.length && !kerneSort.some((o) => vareSort.includes(o))) {
		point -= 120;
		grunde.push(`varen er ${vareSort[0]}, ikke ${kerneSort[0]}`);
	}

	// Varer hvis egne tal ikke haenger sammen skal LAENGST NED, ikke bare
	// have en advarsel paa. Foer 13. august vandt den oedelagte "Salt"
	// med 100 kalorier over Fridas "Salt, bordsalt" med 0, fordi navnet
	// passede praecist. Advarslen stod der, men forslaget laa oeverst,
	// og det er bagvendt.
	if (taleneErUmulige(vare)) {
		point -= 90;
		grunde.push('varens egne tal haenger ikke sammen');
	}

	// Jo faerre ekstra ord varen har, jo mere praecist er det.
	// "Kikaerter" slaar "Kikaertemel, groft".
	const ekstra = vareOrd.length - traef.length;
	point -= ekstra * 8;

	// Sammensatte ord er ikke det samme som varen. "kikaertemel" er ikke
	// kikaerter, selv om ordet staar der.
	if (!sammensatTraef) {
		// Straffen gaelder KUN ord der ikke ogsaa staar som hele ord.
		// "Salt, bordsalt (jodberiget)" har baade salt og bordsalt, og
		// den skal ikke straffes for det. Det er "Kikaertemel" uden
		// ordet kikaerter der er problemet.
		const sammensat = kerneOrd
			.filter((o) => !vareOrd.includes(o))
			.some((o) => vareOrd.some((v) => v.includes(o) && v.length > o.length + 2));
		if (sammensat) point -= 40;
	}

	return { vare, point, hvorfor: grunde.join(', ') };
}

/**
 * Finder de bedste foedevarer til ét kernenavn.
 * Sorteret med den bedste foerst.
 */
export function kandidater(kerne: string, oensketTilstand: Tilstand, varer: Fodevare[], maks = 6): Kandidat[] {
	const alle: Kandidat[] = [];
	for (const v of varer) {
		const k = pointFor(kerne, oensketTilstand, v);
		if (k && k.point > 0) alle.push(k);
	}
	alle.sort((a, b) => b.point - a.point || a.vare.name.length - b.vare.name.length);
	return alle.slice(0, maks);
}

/**
 * Hvor stort et forspring vinderen skal have foer koblingen saettes
 * automatisk. Er nummer to taet paa, er valget reelt et skoen, og saa
 * skal et menneske se paa det.
 */
export const KRAEVET_FORSPRING = 25;

/** Mindste pointtal foer vi overhovedet tor foreslaa noget automatisk. */
export const KRAEVET_POINT = 150;

/**
 * Afgoer hvad ét kernenavn skal kobles til.
 *
 * Automatisk kobling kraever ALLE fire:
 *   1. vinderen er en Frida-post
 *   2. vinderen har nok point
 *   3. vinderen har forspring nok til nummer to
 *   4. tilstanden er enten enig eller ligegyldig
 */
export function foreslaaKobling(kerne: string, oensketTilstand: Tilstand, varer: Fodevare[]): Kobling {
	const forslag = kandidater(kerne, oensketTilstand, varer);
	if (forslag.length === 0) {
		return { kerne, foodId: null, sikker: false, hvorfor: 'Ingen foedevare ligner.', forslag: [] };
	}

	const vinder = forslag[0];
	const toer = forslag[1];
	const forspring = toer ? vinder.point - toer.point : 999;

	// Kilden. Frida er altid god nok. En post uden kilde kan ogsaa kobles
	// automatisk, men kun naar navnet er praecis det samme OG varens egne
	// tal haenger sammen.
	//
	// Uden den aabning blev aeg, avocado, loeg, broccoli, tomat og
	// gulerod alle afvist, netop fordi navnet passede perfekt. Frida
	// hedder "AEg, hoenseaeg, raa", mens posten der bare hedder "AEg" er
	// fra Kickstart-tiden. Maalt 13. august.
	const eksaktNavn = rensNavn(vinder.vare.name) === rensNavn(kerne.replace(/\s+(toer|kogt|afdryppet)$/, ''));
	if (vinder.vare.kilde !== AUTO_KILDE) {
		if (!eksaktNavn) {
			return { kerne, foodId: vinder.vare.id, sikker: false, hvorfor: 'Bedste bud er ikke fra Frida og navnet er ikke praecist.', forslag };
		}
		if (!sundVare(vinder.vare)) {
			return { kerne, foodId: vinder.vare.id, sikker: false, hvorfor: 'Navnet passer, men varens kalorier passer ikke med dens egen makro.', forslag };
		}
	}
	if (vinder.point < KRAEVET_POINT) {
		return { kerne, foodId: vinder.vare.id, sikker: false, hvorfor: 'Ligner kun delvist.', forslag };
	}
	if (forspring < KRAEVET_FORSPRING) {
		return { kerne, foodId: vinder.vare.id, sikker: false, hvorfor: `To bud ligger taet, ${vinder.vare.name} mod ${toer.vare.name}.`, forslag };
	}
	if (oensketTilstand && foedevareTilstand(vinder.vare.name) !== oensketTilstand) {
		return { kerne, foodId: vinder.vare.id, sikker: false, hvorfor: `Tilstanden er ikke bekraeftet, ingrediensen er ${oensketTilstand}.`, forslag };
	}

	return { kerne, foodId: vinder.vare.id, sikker: true, hvorfor: vinder.hvorfor, forslag };
}

/**
 * Koerer hele ingredienslisten igennem og samler ét forslag pr
 * kernenavn. Navne der optraeder mange gange fylder ikke mere end
 * navne der optraeder én gang, for koblingen er pr vare og ikke pr
 * linje.
 */
export function foreslaaAlle(
	ingrediensNavne: string[],
	varer: Fodevare[]
): { koblinger: Kobling[]; sikre: number; tilGodkendelse: number } {
	const kerner = new Map<string, { tilstand: Tilstand; antal: number }>();
	for (const n of ingrediensNavne) {
		const k = kerneNavn(n);
		if (!k) continue;
		const t = tilstand(n);
		if (!kerner.has(k)) kerner.set(k, { tilstand: t, antal: 0 });
		kerner.get(k)!.antal++;
	}

	const koblinger = [...kerner.entries()]
		.sort((a, b) => b[1].antal - a[1].antal)
		.map(([k, v]) => foreslaaKobling(k, v.tilstand, varer));

	return {
		koblinger,
		sikre: koblinger.filter((k) => k.sikker).length,
		tilGodkendelse: koblinger.filter((k) => !k.sikker).length
	};
}
