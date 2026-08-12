// ============================================================
// Kundens egne opskrifter i 3.0. Se SPEC-3.0.md afsnit 26.11.
//
// Hun fotograferer en opskrift, AI'en laeser ingredienserne og regner
// makroen, og opskriften ligger privat under
// users/{uid}/privateOpskrifter. Den gamle app kalder dem "Mine
// opskrifter".
//
// MAALT PAA RIGTIGE DATA 12. august 2026, alle 616 kunder:
//   222 egne opskrifter hos 53 kunder, altsaa 9 %
//   87 % af de 53 har logget en af deres egne de sidste 90 dage
//   9 % af alt de taster er en egen opskrift. Linns eget bibliotek er 0,9 %
//   100 % har et foto. Af Linns 130 har 2
//
// DE TO TAL DER STYRER DESIGNET:
//   1. de 91 % der INGEN har. For dem maa intet aendre sig, saa fanen
//      findes slet ikke naar hun ingen har
//   2. de 9 mod 0,9. Hendes egne bruges cirka ti gange saa meget som
//      hele Linns bibliotek. Det er ikke en lille funktion for dem
//
// KATEGORIERNE ER DE SAMME SOM PAA LINNS OPSKRIFTER, og de ligger i
// samme feltform. Derfor loeber hendes egne gennem praecis den samme
// soegning og de samme filtre, uden en eneste undtagelse i filter-koden.
// Linns beslutning 12. august: kunden saetter selv maaltidet, hun maa
// gerne vaelge flere, og hun skal kunne rette det bagefter.
// ============================================================

import {
	filtrerOpskrifter3,
	type FiltrerbarOpskrift,
	type FiltreretOpskrift,
	type SoegeFiltre
} from './opskriftSoeg3';
import { KATEGORIER3, type Kategori3 } from './opskriftKategori3';

export interface MinIngrediens {
	navn: string;
	maengde: number;
	enhed: string;
}

export interface MinMakro {
	protein: number;
	fiber: number;
	kh: number;
	fedt: number;
	kcal: number;
}

/**
 * Én af hendes egne opskrifter, som 3.0 laeser den.
 *
 * `kategorier3` er NYT og findes ikke paa de 222 der er lavet i den
 * gamle app. Feltet er additivt, saa den gamle app laeser det ikke og
 * opdager ingenting.
 */
export interface MinOpskrift3 {
	id: string;
	navn: string;
	beskrivelse?: string;
	billedeUrl?: string;
	antalPortioner: number;
	ingredienser: MinIngrediens[];
	makroPrPortion: MinMakro;
	kategorier3?: Kategori3[];
}

/** Det filtreringen og soegningen ser. Se FiltrerbarOpskrift. */
export interface MinListePost {
	id: string;
	titel: string;
	beskrivelse: string;
	ingredienser: { navn: string }[];
	kategorier3: Kategori3[];
	/** Hun har ingen diaet-maerker, saa kost-filteret rammer hende aldrig. */
	dietTags: string[];
	billedeUrl: string | null;
	/** Findes ikke paa hendes egne. Feltet er her, saa den samme flise i
	    gitteret kan vise baade Linns og hendes uden en undtagelse. */
	billedeUrlLille: string | null;
	protein: number | null;
	fiber: number | null;
	/** Hele opskriften, saa arket kan vise den. */
	min: MinOpskrift3;
}

// ============================================================
// Hvilket maaltid hoerer den til
// ============================================================

/** Ét maaltid hun har registreret, med referencen til opskriften. */
export interface BrugtOpskrift {
	type: Kategori3 | string;
	items?: { opskriftRef?: { id?: string; erEgen?: boolean } }[];
}

/**
 * Gaetter hvilke maaltider hendes egne opskrifter hoerer til, ud fra
 * hvad hun rent faktisk har logget dem som.
 *
 * Gaettet er praecist her, i modsaetning til de fleste gaet: logger hun
 * en af sine egne, skrives opskriftens id med i maaltidet, saa vi
 * behoever ikke gaette paa navnet. Se opskriftRef i kost.ts.
 */
export function gaetKategorier(historik: BrugtOpskrift[]): Map<string, Kategori3[]> {
	const taelling = new Map<string, Map<Kategori3, number>>();
	for (const m of historik) {
		const type = m.type as Kategori3;
		if (!KATEGORIER3.includes(type)) continue;
		for (const it of m.items ?? []) {
			const r = it.opskriftRef;
			if (!r?.erEgen || !r.id) continue;
			const pr = taelling.get(r.id) ?? new Map<Kategori3, number>();
			pr.set(type, (pr.get(type) ?? 0) + 1);
			taelling.set(r.id, pr);
		}
	}

	const ud = new Map<string, Kategori3[]>();
	for (const [id, pr] of taelling) {
		// Alle de maaltider hun faktisk har brugt den til, i fast
		// raekkefoelge. Spiser hun suppen baade til frokost og aftensmad,
		// hoerer den til begge.
		const k = KATEGORIER3.filter((kat) => (pr.get(kat) ?? 0) > 0);
		if (k.length > 0) ud.set(id, k);
	}
	return ud;
}

/**
 * Maaltiderne paa én opskrift, i den raekkefoelge de afgoeres:
 *   1. hendes eget valg vinder altid
 *   2. ellers gaettet ud af historikken
 *   3. ellers ingen, og saa vises den ALTID, se filtrerMine
 */
export function kategorierFor(
	min: MinOpskrift3,
	gaet: Map<string, Kategori3[]> | undefined
): Kategori3[] {
	const egne = (min.kategorier3 ?? []).filter((k) => KATEGORIER3.includes(k));
	if (egne.length > 0) return KATEGORIER3.filter((k) => egne.includes(k));
	return gaet?.get(min.id) ?? [];
}

export function tilListePost(min: MinOpskrift3, kategorier: Kategori3[]): MinListePost {
	return {
		id: min.id,
		titel: min.navn,
		beskrivelse: min.beskrivelse ?? '',
		ingredienser: (min.ingredienser ?? []).map((i) => ({ navn: i.navn })),
		kategorier3: kategorier,
		dietTags: [],
		billedeUrl: min.billedeUrl ?? null,
		billedeUrlLille: null,
		protein: min.makroPrPortion?.protein ?? null,
		fiber: min.makroPrPortion?.fiber ?? null,
		min
	};
}

// ============================================================
// Filtrering
// ============================================================

/**
 * Hendes egne, filtreret som alt andet, MED ÉN UNDTAGELSE:
 * en opskrift uden maaltid vises altid.
 *
 * Hvorfor undtagelsen findes: de 222 der er lavet i den gamle app har
 * intet maaltid, og de kan ikke faa et af sig selv. Faldt de ud af
 * kategori-filteret, ville hendes egen mad forsvinde fra skaermen fordi
 * hun aldrig er blevet bedt om at udfylde et felt. Det er bedre at vise
 * en aftensmad under morgenmad end at skjule noget hun selv har lavet.
 *
 * Soegningen gaelder ogsaa dem. Det er kun maaltidet der springes over.
 */
export function filtrerMine<T extends FiltrerbarOpskrift>(
	poster: T[],
	filtre: SoegeFiltre
): FiltreretOpskrift<T>[] {
	const orden = new Map<T, number>(poster.map((p, i) => [p, i] as const));
	const uden = poster.filter((p) => p.kategorier3.length === 0);
	const med = poster.filter((p) => p.kategorier3.length > 0);

	const traefMed = filtrerOpskrifter3(med, filtre);
	// Samme filtre, men uden kategorierne.
	const traefUden = filtrerOpskrifter3(uden, {
		soegeord: filtre.soegeord,
		dietTags: filtre.dietTags
	});

	// Input-raekkefoelgen bevares, praecis som filtrerOpskrifter3 lover.
	return [...traefMed, ...traefUden].sort(
		(a, b) => (orden.get(a.opskrift) ?? 0) - (orden.get(b.opskrift) ?? 0)
	);
}

/** Har hun overhovedet nogen. Er svaret nej, findes fanen ikke. */
export function harEgne(poster: MinListePost[]): boolean {
	return poster.length > 0;
}

// ============================================================
// Portioner og makro
// ============================================================

/**
 * DEN VIGTIGE REGEL, og den er den samme som paa Linns opskrifter:
 *
 *   makroPrPortion er PR PORTION og ganges med det antal hun spiser.
 *   antalPortioner fortaeller kun hvor mange portioner INGREDIENS-
 *   LISTEN raekker til, og maa ALDRIG bruges paa makroen.
 *
 * Brydes den, kommer de to slags opskrifter til at skrive forskellige
 * tal i den samme dagbog for den samme handling. Se SPEC 26.9, hvor
 * praecis den fejl kostede en kunde 36 g protein.
 */
export function makroForPortioner(prPortion: number, portioner: number): number {
	return Math.round(prPortion * portioner * 10) / 10;
}

export function makroFor(min: MinOpskrift3, portioner: number): MinMakro {
	const m = min.makroPrPortion;
	return {
		protein: makroForPortioner(m?.protein ?? 0, portioner),
		fiber: makroForPortioner(m?.fiber ?? 0, portioner),
		kh: makroForPortioner(m?.kh ?? 0, portioner),
		fedt: makroForPortioner(m?.fedt ?? 0, portioner),
		kcal: Math.round((m?.kcal ?? 0) * portioner)
	};
}

/**
 * Ingredienserne skalerer den ANDEN vej: listen raekker til
 * antalPortioner, saa vil hun have to og listen er til fire, skal
 * maengderne halveres.
 */
export function ingrediensMaengde(
	maengde: number,
	antalPortioner: number,
	portioner: number
): number {
	if (!antalPortioner || antalPortioner <= 0) return maengde;
	const ny = (maengde * portioner) / antalPortioner;
	// To decimaler, saa en tredjedel af en spsk ikke bliver til en roman.
	return Math.round(ny * 100) / 100;
}

/** Startværdien i arket: hendes opskrift er skrevet til én portion. */
export const START_PORTIONER = 1;

/** Navnet der havner i dagbogen. */
export function dagbogsNavn(min: MinOpskrift3, portioner: number): string {
	if (portioner === 1) return min.navn;
	const tal = Number.isInteger(portioner) ? String(portioner) : String(portioner).replace('.', ',');
	return `${min.navn} (${tal} port.)`;
}
