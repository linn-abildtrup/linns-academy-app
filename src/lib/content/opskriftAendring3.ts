// ============================================================
// HUN RETTER I EN AF LINNS OPSKRIFTER, INDEN HUN LAEGGER DEN I.
//
// Tegningen er mockups-ret-maengde-i-opskrift.html, og Linns svar
// staar der. Forslag A, "Dine maengder" i dagbogen, hun spoerges om
// maengderne skal huskes (D1), og hun kan laegge en ingrediens til.
//
// TRE TING DER ER DYRE AT GENOPDAGE
//
// 1. HUN RETTER DET HUN SER, IKKE DET DER STAAR I OPSKRIFTEN.
//    Ingredienslisten vises allerede skaleret til det antal portioner
//    hun har valgt, se ingrediensMaengde i opskriftPortion3. Retter hun
//    "37,5 g kylling" til 50, mener hun 50 g til SIG SELV. Derfor
//    regner den her fil paa de VISTE maengder og deler ALDRIG med
//    portionstallet bagefter. Gjorde vi det, ville en familieret give
//    hende en fjerdedel af den feta hun lige har lagt i.
//
// 2. TALLET REGNES PAA STEDET, MEN KUN NAAR HUN HAR ROERT NOGET.
//    Uden aendringer viser arket det gemte tal fra
//    ingrediensKobling/beregninger, som med vilje er frosset. Med
//    aendringer regner vi forfra. De to kan give en lille forskel paa
//    den samme mad, og Linn har sagt ja til det 25. august. Alternativet
//    var en omvej der kostede mere end forskellen er vaerd.
//
// 3. HENDES EGNE LINJER ER IKKE LINNS LINJER.
//    Linns kan skrues til nul, men ikke fjernes, ellers kan hun ikke
//    fortryde. Hendes egne kan fjernes helt. De to staar i hver sin
//    farve paa skaermen af praecis den grund.
//
// Filen roerer ingen opskrift og ingen foedevare. Den regner ved siden af.
// ============================================================

import type { Fodevare } from './kost';
import type { Ingrediens } from './opskrifter';
import { regnLinje, type KoblingsOpslag, type Makro, TOM_MAKRO, afrund } from './opskriftMakro3';
import { naeringFor } from './maengde3';

/** En linje hun selv har lagt til. Den peger paa en rigtig foedevare. */
export interface LagtTil {
	/** Foedevarens id. Det er den der giver naeringstallene. */
	foodId: string;
	/** Navnet som det skal staa paa skaermen. */
	navn: string;
	portion: number;
	enhedId?: string;
}

/**
 * Alt hun har aendret paa én opskrift.
 *
 * `maengder` er noeglet paa ingrediensens PLADS i listen og ikke paa
 * navnet, fordi den samme raavare godt kan staa to gange i en opskrift.
 * Nul betyder "jeg tog den ikke i", ikke "ingen aendring": en linje der
 * ikke er roert, staar slet ikke i kortet.
 */
export interface Aendring {
	maengder: Record<number, number>;
	lagtTil: LagtTil[];
}

export const TOM_AENDRING: Aendring = { maengder: {}, lagtTil: [] };

export function tomAendring(): Aendring {
	return { maengder: {}, lagtTil: [] };
}

// ------------------------------------------------------------
// Springet, altsaa hvor meget et tryk paa plus flytter
// ------------------------------------------------------------

/**
 * Enhederne i Linns opskrifter, og hvad et tryk skal flytte.
 *
 * Gram springer 5 ad gangen. Et gram ad gangen ville betyde tredive tryk
 * for at gaa fra 150 til 200, og finere end 5 g kan ingen alligevel
 * maale i et koekken. Alt der taelles i stykker springer en halv, saa en
 * halv avokado er et enkelt tryk.
 */
const SPRING_ENHED: Record<string, number> = {
	g: 5,
	ml: 5,
	dl: 0.5,
	l: 0.25,
	kg: 0.1,
	spsk: 0.5,
	tsk: 0.5,
	stk: 0.5,
	skive: 0.5,
	skiver: 0.5,
	fed: 1,
	haandfuld: 0.5,
	knivspids: 1
};

/** Bruges naar enheden ikke staar i tabellen. En halv er det mildeste gaet. */
export const STANDARD_SPRING_ENHED = 0.5;

export function springForEnhed(enhed: string | undefined): number {
	if (!enhed) return STANDARD_SPRING_ENHED;
	return SPRING_ENHED[enhed.trim().toLowerCase()] ?? STANDARD_SPRING_ENHED;
}

/**
 * Naeste maengde efter et tryk. Gaar aldrig under nul, for negativ mad
 * findes ikke, og nul er et gyldigt svar der betyder "ikke i".
 */
export function naesteMaengde(maengde: number, enhed: string | undefined, retning: 1 | -1): number {
	const spring = springForEnhed(enhed);
	const ny = maengde + spring * retning;
	if (ny <= 0) return 0;
	// Rundes af, saa 0.1 + 0.2 ikke bliver til 0.30000000000000004 paa
	// skaermen. Tre decimaler raekker til alt hvad der staar i en opskrift.
	return Math.round(ny * 1000) / 1000;
}

// ------------------------------------------------------------
// Hvad hun har aendret
// ------------------------------------------------------------

/** Saetter en ny maengde paa en af Linns linjer. Nul er tilladt. */
export function saetMaengde(a: Aendring, plads: number, maengde: number): Aendring {
	return { ...a, maengder: { ...a.maengder, [plads]: Math.max(0, maengde) } };
}

/** Fortryder én linje, saa den staar som Linn har skrevet den igen. */
export function nulstilLinje(a: Aendring, plads: number): Aendring {
	const uden = { ...a.maengder };
	delete uden[plads];
	return { ...a, maengder: uden };
}

export function laegTil(a: Aendring, ny: LagtTil): Aendring {
	return { ...a, lagtTil: [...a.lagtTil, ny] };
}

export function fjernLagtTil(a: Aendring, plads: number): Aendring {
	return { ...a, lagtTil: a.lagtTil.filter((_, i) => i !== plads) };
}

export function antalAendret(a: Aendring): number {
	return Object.keys(a.maengder).length;
}

export function antalLagtTil(a: Aendring): number {
	return a.lagtTil.length;
}

export function harAendringer(a: Aendring): boolean {
	return antalAendret(a) > 0 || antalLagtTil(a) > 0;
}

/**
 * Teksten i baandet inde i opskriften.
 *
 * Den siger hvad der er sket og ikke hvad hun har gjort forkert. Der
 * staar aldrig et tal hun ikke naaede, se Linns regel om at en side
 * aldrig maa laese som en anklage.
 */
export function aendringsTekst(a: Aendring): string {
	const r = antalAendret(a);
	const t = antalLagtTil(a);
	if (r === 0 && t === 0) return '';
	if (t === 0) return `Du har ændret ${r} ${r === 1 ? 'ingrediens' : 'ingredienser'}.`;
	if (r === 0) return `Du har lagt ${t} ${t === 1 ? 'ingrediens' : 'ingredienser'} til.`;
	return `Du har ændret ${r} og lagt ${t} til.`;
}

/**
 * Linjen under rettens navn i hendes dagbog. Linns valg 25. august.
 *
 * Uden den kan hverken hun eller Linn se at hun spiste noget andet end
 * det der staar, og om tre uger ligner det en fejl i tallene.
 */
export function dagbogsTekst(a: Aendring): string {
	if (!harAendringer(a)) return '';
	const dele: string[] = [];
	const r = antalAendret(a);
	const t = antalLagtTil(a);
	if (r > 0) dele.push(`${r} rettet`);
	if (t > 0) dele.push(`${t} lagt til`);
	return `Dine mængder · ${dele.join(', ')}`;
}

// ------------------------------------------------------------
// Selve regnestykket
// ------------------------------------------------------------

export interface AendretLinje {
	/** Pladsen i Linns liste. Undefined naar linjen er hendes egen. */
	plads?: number;
	navn: string;
	/** Maengden som den skal staa paa skaermen. */
	maengde: number;
	enhed: string;
	/** Linns oprindelige maengde, saa skaermen kan vise hvad der stod foer. */
	foer?: number;
	aendret: boolean;
	egen: boolean;
	makro: Makro;
}

export interface AendretBeregning {
	linjer: AendretLinje[];
	/** Summen af det hun faktisk spiser. IKKE delt med portionstallet. */
	makro: Makro;
}

/**
 * Regner ud hvad hun faktisk spiser.
 *
 * `viste` er Linns ingredienser SOM DE STAAR PAA SKAERMEN, altsaa
 * allerede skaleret til hendes antal portioner. Se punkt 1 i toppen af
 * filen: der deles ikke med noget bagefter.
 */
export function regnMedAendringer(
	viste: Ingrediens[],
	a: Aendring,
	koblinger: Record<string, KoblingsOpslag>,
	varer: Map<string, Fodevare>
): AendretBeregning {
	const linjer: AendretLinje[] = [];
	let sum: Makro = { ...TOM_MAKRO };

	viste.forEach((ing, plads) => {
		const oprindelig = Number(ing.maengde);
		const harNy = Object.prototype.hasOwnProperty.call(a.maengder, plads);
		const maengde = harNy ? a.maengder[plads] : oprindelig;

		// Nul betyder at hun ikke tog den i. Linjen bliver staaende paa
		// skaermen, streget ud, saa hun kan fortryde, men den bidrager
		// ikke med noget.
		const l = regnLinje({ ...ing, maengde }, koblinger, varer);
		if (maengde > 0) sum = laeg(sum, l.makro);

		linjer.push({
			plads,
			navn: ing.navn ?? '',
			maengde,
			enhed: String(ing.enhed ?? ''),
			foer: harNy ? oprindelig : undefined,
			aendret: harNy,
			egen: false,
			makro: maengde > 0 ? l.makro : { ...TOM_MAKRO }
		});
	});

	a.lagtTil.forEach((t) => {
		const vare = varer.get(t.foodId);
		// naeringFor er den samme funktion maengde-arket bruger, saa en
		// ingrediens hun lagger til giver noejagtig de samme tal som hvis
		// hun havde lagt varen direkte i sit maaltid.
		const n = naeringFor(vare, t.portion, t.enhedId);
		const makro: Makro = {
			protein: n.protein,
			fiber: n.fiber,
			kh: n.kh,
			fedt: n.fedt,
			kalorier: n.kcal
		};
		sum = laeg(sum, makro);
		linjer.push({
			navn: t.navn,
			maengde: t.portion,
			enhed: t.enhedId ?? 'g',
			aendret: false,
			egen: true,
			makro
		});
	});

	return { linjer, makro: afrund(sum) };
}

function laeg(a: Makro, b: Makro): Makro {
	return {
		protein: a.protein + b.protein,
		fiber: a.fiber + b.fiber,
		kh: a.kh + b.kh,
		fedt: a.fedt + b.fedt,
		kalorier: a.kalorier + b.kalorier
	};
}

// ------------------------------------------------------------
// At huske hendes maengder til naeste gang
// ------------------------------------------------------------

/**
 * Et aftryk af den ingrediensliste hendes maengder blev sat paa.
 *
 * RETTER LINN OPSKRIFTEN, SKAL HENDES GEMTE MAENGDER FALDE BORT.
 * Ellers sidder hun med 200 g kylling i en ret der er lavet om til
 * fisk, og ingen opdager det. Aftrykket er navn og enhed, ikke maengde:
 * skruer Linn 150 g op til 180, er det stadig den samme ret, og hendes
 * "jeg tog ikke avokado i" skal overleve.
 */
export function aftryk(ingredienser: Ingrediens[]): string {
	return (ingredienser ?? [])
		.map((i) => `${(i.navn ?? '').trim().toLowerCase()}|${String(i.enhed ?? '').trim().toLowerCase()}`)
		.join('¤');
}

/** Det der ligger gemt paa hende for én opskrift. */
export interface GemtAendring {
	aftryk: string;
	maengder: Record<number, number>;
	lagtTil: LagtTil[];
}

export function tilGemt(a: Aendring, ingredienser: Ingrediens[]): GemtAendring {
	return { aftryk: aftryk(ingredienser), maengder: a.maengder, lagtTil: a.lagtTil };
}

/**
 * Laeser det gemte tilbage. Passer aftrykket ikke, er opskriften rettet
 * siden, og saa faar hun Linns udgave i stedet for noget forkert.
 */
export function fraGemt(gemt: GemtAendring | undefined, ingredienser: Ingrediens[]): Aendring {
	if (!gemt) return tomAendring();
	if (gemt.aftryk !== aftryk(ingredienser)) return tomAendring();
	return {
		maengder: { ...(gemt.maengder ?? {}) },
		lagtTil: [...(gemt.lagtTil ?? [])]
	};
}

/**
 * Skal hun spoerges om maengderne skal huskes?
 *
 * D1 fra tegningen. Der spoerges KUN naar hun faktisk har aendret noget,
 * og kun én gang pr opskrift: har hun allerede svaret, hverken ja eller
 * nej, spoerges der ikke igen. Ellers bliver det en pop-up der aldrig
 * holder op.
 */
export function skalSpoerge(a: Aendring, alleredeSvaret: boolean): boolean {
	return harAendringer(a) && !alleredeSvaret;
}
