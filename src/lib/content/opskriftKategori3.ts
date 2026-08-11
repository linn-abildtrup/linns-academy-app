// Opskrift-kategorier i 3.0.
//
// Hvorfor det her modul findes: den gamle indlaeser folder snack, salat,
// dessert og tilbehor sammen til "andet" (se normaliserKategorier i
// opskrifter.ts). Det betyder at 15 snack-opskrifter og 5 salater IKKE kan
// findes som det de er. Maalt 11. august 2026 paa de 130 aktive.
//
// I 3.0 beholder vi snack som sin egen kategori, fordi snack er et rigtigt
// maaltid i beregneren og har sin egen flise paa oversigten. Salat, dessert
// og tilbehor foldes fortsat ind under andet: de er ikke maaltider paa samme
// maade, og et filter der kun rammer fem opskrifter er ikke en knap vaerd.
//
// Den gamle app roeres ikke. Det her er en NY laesning af de samme felter.

export type Kategori3 = 'morgenmad' | 'frokost' | 'aftensmad' | 'snack' | 'andet';

/** Raekkefoelgen filtrene staar i, og den der afgoer farven. */
export const KATEGORIER3: Kategori3[] = [
	'morgenmad',
	'frokost',
	'aftensmad',
	'snack',
	'andet'
];

export const KATEGORI_NAVN: Record<Kategori3, string> = {
	morgenmad: 'Morgenmad',
	frokost: 'Frokost',
	aftensmad: 'Aftensmad',
	snack: 'Snack',
	andet: 'Andet'
};

/** Gamle ids der stadig staar i Firestore og skal blive til andet. */
const TIL_ANDET = new Set(['salat', 'dessert', 'tilbehor', 'tilbehør']);

/**
 * Laeser kategori-feltet som det staar i Firestore og giver 3.0-kategorierne.
 * Ukendte vaerdier bliver til andet, saa en opskrift aldrig falder ud af alle
 * filtre og bliver usynlig. Raekkefoelgen er altid KATEGORIER3, uanset hvordan
 * de stod i dokumentet.
 */
export function kategorier3(raa: unknown): Kategori3[] {
	if (!Array.isArray(raa) || raa.length === 0) return [];
	const fundet = new Set<Kategori3>();
	for (const k of raa) {
		if (typeof k !== 'string') continue;
		const lav = k.trim().toLowerCase();
		if (lav === 'morgenmad' || lav === 'frokost' || lav === 'aftensmad' || lav === 'snack') {
			fundet.add(lav);
		} else if (lav === 'andet' || TIL_ANDET.has(lav)) {
			fundet.add('andet');
		} else {
			fundet.add('andet');
		}
	}
	return KATEGORIER3.filter((k) => fundet.has(k));
}

/**
 * Hvilken kategori bestemmer flisens farve.
 *
 * Har hun filtreret, vinder filteret: saa er alt paa skaermen den farve hun
 * har valgt, og farven er altid sand for det hun kigger paa. Ellers tager vi
 * den foerste i fast raekkefoelge, saa den samme opskrift har den samme farve
 * hver gang. Besluttet med Linn 11/8 2026.
 */
export function farveKategori(
	egne: Kategori3[],
	valgte: Kategori3[] = []
): Kategori3 | null {
	if (egne.length === 0) return null;
	const aktivtFilter = valgte.filter((v) => egne.includes(v));
	if (aktivtFilter.length > 0) {
		return KATEGORIER3.find((k) => aktivtFilter.includes(k)) ?? null;
	}
	return KATEGORIER3.find((k) => egne.includes(k)) ?? null;
}

/**
 * Antal opskrifter pr kategori, saa tallet kan staa ud for hvert filter og
 * hun kan se om det kan betale sig at trykke. Talt paa den liste der er
 * tilbage efter de OEVRIGE filtre, ikke paa hele samlingen.
 */
export function antalPrKategori(
	opskrifter: { kategorier3: Kategori3[] }[]
): Record<Kategori3, number> {
	const ud: Record<Kategori3, number> = {
		morgenmad: 0,
		frokost: 0,
		aftensmad: 0,
		snack: 0,
		andet: 0
	};
	for (const o of opskrifter) {
		for (const k of o.kategorier3) ud[k] += 1;
	}
	return ud;
}

/**
 * Bogstavet paa flisen naar der ikke er et billede. Foerste bogstav i titlen,
 * i stort. Tom titel giver en prik, saa flisen aldrig staar helt tom.
 */
export function fliseBogstav(titel: string): string {
	const t = (titel ?? '').trim();
	if (t.length === 0) return '·';
	return t[0].toUpperCase();
}

/**
 * Kategorien der skal vaere forvalgt naar hun aabner opskrift-listen inde fra
 * et maaltid. Aabner hun fra Frokost, er listen sat til frokost med det samme.
 *
 * Alle fire maaltidstyper findes som kategori, saa det er en ren oversaettelse.
 * Funktionen findes for at et femte maaltid ikke stille kan holde op med at
 * virke: testen gaar igennem MAALTIDSTYPER og kraever et svar for hver.
 */
export function kategoriForMaaltid(maaltid: string): Kategori3 | null {
	const k = kategorier3([maaltid]);
	// kategorier3 lader ukendte vaerdier lande i andet. Det maa IKKE ske her,
	// for saa ville et ukendt maaltid forvaelge Andet og skjule alt det andet.
	if (k.length === 1 && k[0] !== 'andet') return k[0];
	return null;
}
