// ============================================================
// "Den her ingrediens har jeg set efter."
//
// LINNS OENSKE 1. SEPTEMBER 2026. Siden kunne foer kun vise om et tal var
// RETTET. Men de fleste ingredienser skal ikke rettes, de skal bare ses
// efter én gang, og bagefter kunne Linn ikke se forskel paa "ikke kigget
// paa endnu" og "kigget paa, tallet var fint". Det er praecis den
// forskel der afgoer hvor hun skal fortsaette i morgen.
//
// MARKERINGEN HAENGER PAA KERNENAVNET og ikke paa foedevaren. Tre grunde:
//  1. Raekker UDEN kobling har ingen foedevare, og de er netop dem der
//     skal ses efter foerst.
//  2. "Toerre linser" og "kogte linser" er to raekker der kan pege paa
//     hver sin vare, og de gennemgaas hver for sig.
//  3. Foedevarerne er det kunderne laeser. Der skal ikke ligge admin-
//     bogholderi i noget 925 kunder henter hver dag.
//
// MARKERINGEN FALDER IKKE AF NAAR TALLET RETTES. Linns valg samme dag.
// Hun har set paa varen, og det bliver ved med at gaelde. Alternativet
// ville betyde at hun skulle markere den samme vare igen hver gang nogen
// roerte den, og saa ville fluebenet ikke betyde noget.
//
// FILEN REGNER KUN. Skrivningen ligger i firestore/ingrediensGennemgang3.
// ============================================================

/** Én markering. Hvem der satte den, og hvornaar. */
export interface Gennemgang {
	/** uid paa den admin der markerede. */
	af: string;
	/** ISO-dato, altsaa 2026-09-01T09:12:00.000Z. */
	naar: string;
}

/** Kernenavn -> markering. Kun de gennemgaaede staar i kortet. */
export type Gennemgangskort = Record<string, Gennemgang>;

export function erGennemgaaet(kort: Gennemgangskort, kerne: string): boolean {
	return Boolean(kort[kerne]);
}

/**
 * Saetter én markering. Rent, saa siden kan vise resultatet med det
 * samme og skrivningen kan ske bagefter.
 */
export function markerGennemgaaet(
	kort: Gennemgangskort,
	kerne: string,
	af: string,
	naar: Date = new Date()
): Gennemgangskort {
	return { ...kort, [kerne]: { af, naar: naar.toISOString() } };
}

/** Fjerner én markering. */
export function fjernGennemgaaet(kort: Gennemgangskort, kerne: string): Gennemgangskort {
	const nyt = { ...kort };
	delete nyt[kerne];
	return nyt;
}

/**
 * Hvor mange af de viste raekker der er gennemgaaet.
 *
 * Der taelles paa RAEKKERNE og ikke paa kortet. Kortet kan indeholde
 * navne der ikke laengere staar i nogen opskrift, fordi Linn har rettet
 * teksten paa en ingrediens efter at have markeret den, og de maa ikke
 * taelle med i "57 af 412".
 */
export function antalGennemgaaet(raekker: { kerne: string }[], kort: Gennemgangskort): number {
	return raekker.filter((r) => erGennemgaaet(kort, r.kerne)).length;
}

/** Kun dem der mangler at blive set efter. Til filter-knappen. */
export function kunIkkeGennemgaaede<T extends { kerne: string }>(
	raekker: T[],
	kort: Gennemgangskort
): T[] {
	return raekker.filter((r) => !erGennemgaaet(kort, r.kerne));
}

const MAANEDER = [
	'januar',
	'februar',
	'marts',
	'april',
	'maj',
	'juni',
	'juli',
	'august',
	'september',
	'oktober',
	'november',
	'december'
];

/**
 * "1. september 2026". Egen formatering og ikke toLocaleDateString, saa
 * teksten er den samme uanset hvilken maskine siden aabnes paa.
 */
export function datoTekst(naar: string): string {
	const d = new Date(naar);
	if (Number.isNaN(d.getTime())) return '';
	return `${d.getDate()}. ${MAANEDER[d.getMonth()]} ${d.getFullYear()}`;
}
