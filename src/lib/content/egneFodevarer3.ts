// ============================================================
// Kundens egne foedevarer i 3.0. Se SPEC-3.0.md afsnit 26.12.
//
// I 3.0 kunne hun SE sine egne foedevarer, men ikke lave dem. Det var
// det eneste hul i Mad uden en omvej: staar hun med en vare der ikke
// findes i databasen, kan hun ikke komme videre.
//
// TALLENE ER PR 100 G. Det er den vigtigste detalje i hele filen. Hun
// taster dem af varedeklarationen, og der staar de netop pr 100 g.
// Staar det ikke tydeligt paa skaermen, taster hun tallene for hele
// pakken, og saa er hendes protein tre gange for hoejt resten af aaret.
//
// DEN ANDEN GRUND TIL AT DET HER ER VIGTIGT: en manuelt tastet linje
// uden makro taeller NUL gram i hendes dagbog uden at nogen siger det.
// Det er den fejl der staar paa 178 af de 2.905 faste maaltider i
// drift. Hver gang hun laver en rigtig foedevare i stedet, kan den fejl
// ikke opstaa.
// ============================================================

import type { Fodevare, Kategori } from './kost';
import { talFra, talTil, udregnetKcal } from './tal3';

/** Slagsene, i den raekkefoelge de staar i listen. Samme som den gamle app. */
export const KATEGORIER: Kategori[] = [
	'mejeri',
	'koed',
	'fisk',
	'baelg',
	'korn',
	'gront',
	'baer',
	'noedder',
	'prot',
	'drikke',
	'andet'
];

export const KATEGORI_NAVN: Record<Kategori, string> = {
	mejeri: 'Mejeri',
	koed: 'Kød',
	fisk: 'Fisk',
	baelg: 'Bønner og linser',
	korn: 'Korn og brød',
	gront: 'Grønt',
	baer: 'Frugt og bær',
	noedder: 'Nødder og frø',
	prot: 'Proteinprodukter',
	drikke: 'Drikkevarer',
	andet: 'Andet'
};

/**
 * Slagsen er forvalgt til Andet. Linns beslutning 12. august: feltet
 * skal vaere der, men hun skal kunne springe det over. 3.0 bruger det
 * ikke til noget, men den gamle app grupperer efter det, og kunderne
 * flyttes hold for hold.
 */
export const START_KATEGORI: Kategori = 'andet';

export interface FodevareUdkast {
	navn: string;
	kategori: Kategori;
	/** Alle fem er tekst mens hun skriver. Se tal3.ts. */
	protein: string;
	fiber: string;
	kh: string;
	fedt: string;
	kcal: string;
	/** Kan hun taste den i deciliter. */
	flydende: boolean;
}

export function tomtUdkast(navn = ''): FodevareUdkast {
	return {
		navn: navn.trim(),
		kategori: START_KATEGORI,
		protein: '',
		fiber: '',
		kh: '',
		fedt: '',
		kcal: '',
		flydende: false
	};
}

export function tilUdkast(f: Fodevare): FodevareUdkast {
	return {
		navn: f.name,
		kategori: f.cat ?? START_KATEGORI,
		protein: talTil(f.p ?? 0),
		fiber: talTil(f.f ?? 0),
		kh: talTil(f.kh ?? 0),
		fedt: talTil(f.fedt ?? 0),
		kcal: talTil(f.kcal ?? 0),
		flydende: !!f.liquid
	};
}

/**
 * Udkastet om til det der gemmes.
 *
 * Kalorier: skriver hun dem ikke selv, regnes de af makroerne. Samme
 * formel som den gamle apps dialog, saa de to apper aldrig kan give
 * hver sit tal for den samme vare.
 */
export function fraUdkast(udkast: FodevareUdkast): Omit<Fodevare, 'id'> {
	const protein = talFra(udkast.protein);
	const fiber = talFra(udkast.fiber);
	const kh = talFra(udkast.kh);
	const fedt = talFra(udkast.fedt);
	const tastet = talFra(udkast.kcal);
	const kcal = tastet > 0 ? Math.round(tastet) : udregnetKcal(protein, kh, fedt);

	return {
		name: udkast.navn.trim().replace(/\s+/g, ' '),
		cat: udkast.kategori,
		p: protein,
		f: fiber,
		kh,
		fedt,
		kcal,
		liquid: udkast.flydende,
		kilde: 'custom'
	};
}

/**
 * Hvad der mangler, foer den kan gemmes. Tom tekst betyder at den duer.
 *
 * Vi kraever kun et navn. En vare uden protein er ikke en fejl: salt,
 * kaffe og krydderier har ingen, og at spaerre for dem ville vaere at
 * bestemme over hendes egen mad.
 */
export function hvadMangler(udkast: FodevareUdkast): string {
	if (udkast.navn.trim().length === 0) return 'Fødevaren skal have et navn.';
	return '';
}

export function udkastDuger(udkast: FodevareUdkast): boolean {
	return hvadMangler(udkast) === '';
}

/**
 * Kalorierne som de bliver, saa skaermen kan vise dem mens hun taster.
 * Nul betyder at der ikke er noget at vise endnu.
 */
export function kalorierNu(udkast: FodevareUdkast): number {
	const tastet = talFra(udkast.kcal);
	if (tastet > 0) return Math.round(tastet);
	return udregnetKcal(talFra(udkast.protein), talFra(udkast.kh), talFra(udkast.fedt));
}

/** Linjen under navnet i listen over hendes egne. */
export function underTekst(f: Fodevare): string {
	return `${f.p ?? 0} g protein pr 100 g`;
}

/** Har hun allerede en vare der hedder det samme. */
export function findesAllerede(egne: Fodevare[], navn: string, undtagenId?: string): boolean {
	const n = navn.trim().toLowerCase();
	if (!n) return false;
	return egne.some((f) => f.id !== undtagenId && f.name.trim().toLowerCase() === n);
}
