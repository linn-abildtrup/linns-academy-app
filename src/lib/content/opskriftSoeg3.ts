// Soegning i opskrifter til 30-30 beregneren i 3.0.
//
// Modulet er rent: ingen Firestore, ingen Svelte. Alt kan testes.
//
// Baggrund, maalt paa de 130 aktive opskrifter 11. august 2026:
//
//  1. Flere ord virkede ikke. Den gamle app deler kun ved komma, saa et
//     mellemrum bliver en del af ordet og der ledes efter den praecise
//     saetning. Otte almindelige to-ords-soegninger gav ALLE nul traeffere,
//     fx "kylling broccoli" som der findes fire af. Her deles der ogsaa ved
//     mellemrum, og alle ord skal findes, uanset raekkefoelge.
//
//  2. 56% af alle traeffere har ikke ordet i titlen (149 i titel mod 188 kun
//     i ingredienser eller beskrivelse). Soeger man paa tomat kommer der 35
//     frem, og paa de 31 staar ordet kun i ingredienslisten. Derfor giver
//     traefFor() ogsaa GRUNDEN til at opskriften kom med, saa fliserne kan
//     skrive "broccoli i ingredienser" og aldrig se ud som en fejl.
//
// Bevidst fravalgt: stavefejls-tolerance. klientSoegeMatch i admin taaler
// stavefejl, hvilket er rigtigt til navne. Her er hoestakken hele
// ingredienslisten paa flere hundrede tegn, og med to tilladte fejl i et
// langt ord rammer den naesten hvad som helst. Besluttet med Linn 11/8 2026.

// ==============================================
// Normalisering
// ==============================================

/**
 * Folder ET tegn til sin soegbare form. Returnerer 0, 1 eller 2 tegn.
 *
 * Danske bogstaver foldes til ae/oe/aa og IKKE til a/o/a som i
 * klientSoegning.ts. Det er et bevidst brud, fordi hoestakken her er
 * madtekst: med a/o/a ville "aeg" blive til "ag" og dermed traeffe bagt,
 * mager, lagkage og asparges. Med ae/oe/aa traeffer baade "aeg" og "aeg"
 * skrevet uden danske tegn praecis det rigtige.
 */
function foldTegn(tegn: string): string {
	const lav = tegn.toLowerCase();
	if (lav === 'æ') return 'ae';
	if (lav === 'ø') return 'oe';
	if (lav === 'å') return 'aa';
	// Fjern diakritik, fx é til e. Er tegnet SELV et kombinerende maerke,
	// forsvinder det helt og bidrager med nul tegn.
	return lav.normalize('NFD').replace(/[̀-ͯ]/g, '');
}

/**
 * Normaliseret udgave af en tekst plus en oversaettelse tilbage til
 * originalen. `kort[i]` er indekset i den OPRINDELIGE tekst som tegn nummer
 * i i den normaliserede tekst kom fra. Kortet er noedvendigt for at kunne
 * fremhaeve det fundne ord det rigtige sted, ogsaa naar foldningen aendrer
 * laengden (ae fylder to tegn hvor ae fyldte ét).
 */
export interface NormaliseretTekst {
	normal: string;
	kort: number[];
}

export function normaliser(tekst: string): NormaliseretTekst {
	const original = tekst ?? '';
	let normal = '';
	const kort: number[] = [];
	for (let i = 0; i < original.length; i++) {
		const foldet = foldTegn(original[i]);
		for (let j = 0; j < foldet.length; j++) {
			normal += foldet[j];
			kort.push(i);
		}
	}
	return { normal, kort };
}

/** Kort form naar man kun skal bruge selve teksten. */
export function normaliserTekst(tekst: string): string {
	return normaliser(tekst).normal;
}

// ==============================================
// Soegetermer
// ==============================================

/**
 * Deler soegefeltet op i termer. Bade mellemrum og komma/semikolon deler,
 * saa "kylling broccoli" og "kylling, broccoli" giver det samme. Termerne er
 * normaliserede og uden dubletter, og tom soegning giver en tom liste.
 */
export function soegetermer(soegeord: string): string[] {
	const dele = (soegeord ?? '')
		.split(/[\s,;]+/)
		.map((d) => normaliserTekst(d.trim()))
		.filter((d) => d.length > 0);
	return Array.from(new Set(dele));
}

// ==============================================
// Traef
// ==============================================

/** De felter en term kan findes i, i den raekkefoelge vi foretraekker dem. */
export type Soegefelt = 'titel' | 'ingredienser' | 'beskrivelse';

/**
 * Et ord der IKKE stod i titlen, og hvor det saa blev fundet. Det er den
 * her liste flisen skriver sin lille forklarings-linje ud fra.
 */
export interface Grund {
	term: string;
	felt: 'ingredienser' | 'beskrivelse';
}

export interface Traef {
	/** Blev alle soegte ord fundet? Tom soegning er altid et traef. */
	traf: boolean;
	/** Ord der ikke stod i titlen. Tom naar alt stod i titlen. */
	grunde: Grund[];
}

/** Det soegningen har brug for at vide om en opskrift. */
export interface SoegbarOpskrift {
	titel?: string;
	beskrivelse?: string;
	ingredienser?: { navn: string }[];
}

function ingredienstekst(opskrift: SoegbarOpskrift): string {
	return (opskrift.ingredienser ?? []).map((i) => i?.navn ?? '').join(' ');
}

/**
 * Afgoer om en opskrift matcher soegetermerne, og hvorfor.
 *
 * ALLE termer skal findes, men de maa findes i hvert sit felt og i vilkaarlig
 * raekkefoelge. Ingredienser proeves foer beskrivelsen, fordi "broccoli i
 * ingredienser" siger kunden mere end "broccoli i beskrivelsen".
 */
export function traefFor(opskrift: SoegbarOpskrift, termer: string[]): Traef {
	if (termer.length === 0) return { traf: true, grunde: [] };

	const titel = normaliserTekst(opskrift.titel ?? '');
	const ingredienser = normaliserTekst(ingredienstekst(opskrift));
	const beskrivelse = normaliserTekst(opskrift.beskrivelse ?? '');

	const grunde: Grund[] = [];
	for (const term of termer) {
		if (titel.includes(term)) continue;
		if (ingredienser.includes(term)) {
			grunde.push({ term, felt: 'ingredienser' });
		} else if (beskrivelse.includes(term)) {
			grunde.push({ term, felt: 'beskrivelse' });
		} else {
			return { traf: false, grunde: [] };
		}
	}
	return { traf: true, grunde };
}

/**
 * Den lille linje paa flisen, fx "broccoli i ingredienser". Flere ord i samme
 * felt samles til én linje. Returnerer tom streng naar alt stod i titlen, og
 * saa skal linjen slet ikke tegnes.
 */
export function grundTekst(grunde: Grund[]): string {
	if (grunde.length === 0) return '';
	const felter: Soegefelt[] = ['ingredienser', 'beskrivelse'];
	const stykker: string[] = [];
	for (const felt of felter) {
		const ord = grunde.filter((g) => g.felt === felt).map((g) => g.term);
		if (ord.length === 0) continue;
		const liste =
			ord.length === 1 ? ord[0] : ord.slice(0, -1).join(', ') + ' og ' + ord[ord.length - 1];
		stykker.push(`${liste} i ${felt === 'ingredienser' ? 'ingredienser' : 'beskrivelsen'}`);
	}
	return stykker.join(', ');
}

// ==============================================
// Fremhaevning
// ==============================================

/**
 * Et stykke tekst der enten skal fremhaeves eller ej. Skaermen tegner
 * traef-stykker i <mark> og resten som almindelig tekst.
 */
export interface Tekststykke {
	tekst: string;
	traef: boolean;
}

/**
 * Deler en tekst op i stykker efter hvor soegetermerne staar. Fremhaevningen
 * sker paa den ORIGINALE tekst, saa "æg" bliver fremhaevet med sit ae selv om
 * der blev soegt paa aeg, og overlappende traef bliver slaaet sammen til ét.
 */
export function fremhaev(tekst: string, termer: string[]): Tekststykke[] {
	const original = tekst ?? '';
	if (original.length === 0) return [];
	if (termer.length === 0) return [{ tekst: original, traef: false }];

	const { normal, kort } = normaliser(original);
	// Marker hvert ORIGINAL-tegn der indgaar i mindst ét traef.
	const markeret = new Array<boolean>(original.length).fill(false);
	for (const term of termer) {
		if (term.length === 0) continue;
		let fra = normal.indexOf(term);
		while (fra !== -1) {
			for (let i = fra; i < fra + term.length; i++) markeret[kort[i]] = true;
			fra = normal.indexOf(term, fra + 1);
		}
	}

	// Saml nabotegn med samme tilstand til stykker.
	const stykker: Tekststykke[] = [];
	let start = 0;
	for (let i = 1; i <= original.length; i++) {
		if (i === original.length || markeret[i] !== markeret[start]) {
			stykker.push({ tekst: original.slice(start, i), traef: markeret[start] });
			start = i;
		}
	}
	return stykker;
}

// ==============================================
// Samlet filtrering
// ==============================================

export interface SoegeFiltre {
	soegeord?: string;
	/** Tom liste betyder ingen begraensning. */
	kategorier?: string[];
	/** Tom liste betyder ingen begraensning. ALLE valgte tags skal vaere sat. */
	dietTags?: string[];
}

/**
 * Det filtreringen skal kunne se paa en opskrift. Felterne er PAAKRAEVEDE med
 * vilje: var de valgfrie, ville en opskrift uden dem tavst falde ud af alle
 * kategori-filtre i stedet for at give en type-fejl. Praecis den fejl slap
 * igennem én gang, hvor feltet hed kategorier3 og filteret laeste kategorier,
 * saa tallet stod rigtigt men et tryk paa knappen tomte skaermen.
 */
export interface FiltrerbarOpskrift extends SoegbarOpskrift {
	kategorier3: string[];
	dietTags: string[];
}

export interface FiltreretOpskrift<T> {
	opskrift: T;
	grunde: Grund[];
}

/**
 * Filtrerer en liste efter soegeord, kategorier og diaet-tags og giver
 * grunden med tilbage pr opskrift. Raekkefoelgen fra input bevares.
 */
export function filtrerOpskrifter3<T extends FiltrerbarOpskrift>(
	opskrifter: T[],
	filtre: SoegeFiltre
): FiltreretOpskrift<T>[] {
	const termer = soegetermer(filtre.soegeord ?? '');
	const kategorier = filtre.kategorier ?? [];
	const dietTags = filtre.dietTags ?? [];

	const ud: FiltreretOpskrift<T>[] = [];
	for (const o of opskrifter) {
		if (kategorier.length > 0) {
			if (!o.kategorier3.some((k) => kategorier.includes(k))) continue;
		}
		if (dietTags.length > 0) {
			if (!dietTags.every((t) => o.dietTags.includes(t))) continue;
		}
		const traef = traefFor(o, termer);
		if (!traef.traf) continue;
		ud.push({ opskrift: o, grunde: traef.grunde });
	}
	return ud;
}
