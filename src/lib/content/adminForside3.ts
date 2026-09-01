// ============================================================
// ÉN admin-forside for BEGGE apper.
//
// Linns beslutning 1. september 2026, efter tegningen i
// mockups-admin.html. Foer den dag laa der to forsider, én pr app, og
// man skulle vide om et vaerktoej hoerte til den gamle eller den nye app
// for at kunne finde det. Med 34 sider er det ikke til at holde ud.
//
// FORMEN ER TAGET FRA TESLAS SKAERM, MEN I LINNS EGNE FARVER. Hendes
// valg samme dag. Det vi tog med er ikke det moerke, men maaden at
// taenke paa: skaermen viser TILSTANDEN og ikke et katalog, der er
// naesten ingen streger, og kun én ting er fremhaevet ad gangen.
//
// INGEN AF DE 34 SIDER ER ROERT. Forsiden peger bare paa dem. Det er den
// mindst risikable maade, se regel 10.
//
// Filen er ren logik og laeser ingenting.
// ============================================================

/** De omraader skinnen er delt op i. Raekkefoelgen er Linns. */
export type Omraade = 'forside' | 'kunder' | 'forlob' | 'mad' | 'traening' | 'beskeder' | 'system';

export interface Vaerktoej {
	navn: string;
	under: string;
	rute: string;
	omraade: Omraade;
	/**
	 * Sand for de vaerktoejer Linn bruger oftest. De staar ogsaa paa
	 * forsiden under "Det du bruger mest". Hendes valg 1. september:
	 * kunder og sp&#248;rgsm&#229;l, samt beskeder og forl&#248;b.
	 */
	oftest?: boolean;
	/** Ligger i den gamle app. Kun til en daempet note, ikke en advarsel. */
	gammel?: boolean;
}

export const OMRAADE_NAVN: Record<Omraade, string> = {
	forside: 'Forside',
	kunder: 'Kunder',
	forlob: 'Forløb',
	mad: 'Mad',
	traening: 'Træning',
	beskeder: 'Beskeder',
	system: 'System'
};

/**
 * Alle 34 vaerktoejer, paa tvaers af begge apper.
 *
 * NAAR DER KOMMER EN NY ADMIN-SIDE, SKAL DEN IND HER. Ellers findes den
 * kun for den der kender adressen, og saadan er det gaaet med challenges,
 * opskrift-billeder og scannede varer, der alle sammen laa uden
 * menupunkt i uger.
 */
export const VAERKTOEJER: Vaerktoej[] = [
	// ── Kunder ────────────────────────────────────────────────
	{ navn: 'Spørgsmål fra kunder', under: 'Svar, og send som besked', rute: '/ny/admin/spoergsmaal', omraade: 'kunder', oftest: true },
	{ navn: 'Slå en kunde op', under: 'Se hvad hun kan se, og hvorfor', rute: '/ny/admin/traening/kunde', omraade: 'kunder', oftest: true },
	{ navn: 'Abonnenter', under: 'Abonnenter fra Simplero, plus gratis kunder og udløb', rute: '/ny/admin/abonnenter', omraade: 'kunder' },
	{ navn: 'Abonnenter, gammel udgave', under: 'Vejen tilbage hvis den nye driller', rute: '/app/admin/abonnenter', omraade: 'system', gammel: true },
	{ navn: 'Testere', under: 'Giv adgang til noget der er under udvikling', rute: '/ny/admin/testere', omraade: 'kunder' },
	// Den gamle staar under System indtil den nye har vaeret brugt. Se den
	// samme ordning for Spoergsmaal.
	{ navn: 'Testere, gammel udgave', under: 'Vejen tilbage hvis den nye driller', rute: '/app/admin/testere', omraade: 'system', gammel: true },
	{ navn: 'Nulstil adgangskode', under: 'Sæt en midlertidig kode for en kunde', rute: '/ny/admin/nulstil-adgang', omraade: 'kunder' },
	{ navn: 'Nulstil adgangskode, gammel udgave', under: 'Vejen tilbage hvis den nye driller', rute: '/app/admin/nulstil-adgang', omraade: 'system', gammel: true },
	{ navn: 'Refleksioner', under: 'Læs svarene på dagens refleksion', rute: '/ny/admin/refleksioner', omraade: 'kunder' },

	// ── Forløb ────────────────────────────────────────────────
	{ navn: 'Forløb', under: 'Alle hold. Indholdet åbnes inde i det enkelte forløb', rute: '/ny/admin/forlob', omraade: 'forlob', oftest: true },
	{ navn: 'Forløb, gammel udgave', under: 'Vejen tilbage hvis den nye driller', rute: '/app/admin/forlob', omraade: 'system', gammel: true },
	{ navn: 'Challenges', under: 'Opret én og giv den til et hold eller til alle', rute: '/ny/admin/challenges', omraade: 'forlob', oftest: true },
	{ navn: 'Dashboard', under: 'Kundernes udvikling og tallene på forretningen', rute: '/ny/admin/dashboard', omraade: 'forlob' },
	{ navn: 'Dashboard, gammel udgave', under: 'Vejen tilbage hvis den nye driller', rute: '/app/admin/dashboard', omraade: 'system', gammel: true },
	{ navn: 'Lektioner til abonnenter', under: 'Én lektion pr dag til dem uden forløb', rute: '/ny/admin/modulbruger-lektioner', omraade: 'forlob' },
	{ navn: 'Små skridt til abonnenter', under: 'Vaneliste og bonus-pulje', rute: '/ny/admin/abo-vaner', omraade: 'forlob' },

	// ── Mad ───────────────────────────────────────────────────
	{ navn: 'Opskrifter', under: 'Opret, ret og godkend', rute: '/ny/admin/opskrifter', omraade: 'mad' },
	{ navn: 'Ingrediensernes tal', under: 'Ét sted at kontrollere alle næringstal', rute: '/ny/admin/ingrediens-tal', omraade: 'mad' },
	{ navn: 'Ingredienser', under: 'Kobl en ingrediens til en fødevare', rute: '/ny/admin/ingredienser', omraade: 'mad' },
	{ navn: 'Regnestykket bag en opskrift', under: 'Gå herhen når et makro-tal ser forkert ud', rute: '/ny/admin/opskrift-makro', omraade: 'mad' },
	{ navn: 'Billeder på opskrifter', under: 'Læg et billede på én ret ad gangen', rute: '/ny/admin/opskrift-billeder', omraade: 'mad' },
	{ navn: 'Scannede varer', under: 'Din nødbremse, ikke en godkendelse', rute: '/ny/admin/scannede', omraade: 'mad' },
	{ navn: 'Fællesskabs-fødevarer', under: 'Varer kunderne har oprettet', rute: '/ny/admin/fodevarer', omraade: 'mad' },
	{ navn: 'Næring', under: 'Hvem ser udvidet næring, og hvem må rette sine mål', rute: '/ny/admin/naering', omraade: 'mad' },
	{ navn: 'Opskrift-vurderinger', under: 'Hvilke retter kunderne giver lavest og højest', rute: '/ny/admin/opskrift-ratings', omraade: 'mad' },

	// ── Træning ───────────────────────────────────────────────
	{ navn: 'Træningsprogrammer', under: 'Byg programmer og sæt dem til klar', rute: '/ny/admin/traening', omraade: 'traening' },
	{ navn: 'Hold og dækning', under: 'Hvem har fået hvad, og mangler nogen noget', rute: '/ny/admin/traening/hold', omraade: 'traening' },
	{ navn: 'Kategorier', under: 'Det udstyr kunden kan vælge imellem', rute: '/ny/admin/traening/kategorier', omraade: 'traening' },
	{ navn: 'Byg eget program', under: 'Hvem må sætte deres egen træning sammen', rute: '/ny/admin/traening/byg-eget', omraade: 'traening' },
	{ navn: 'Øvelsesbanken', under: 'Opret og ret de enkelte øvelser. Fælles for begge apper', rute: '/ny/admin/oevelser', omraade: 'traening' },
	{ navn: 'Mine programmer', under: 'De gamle mikrotrænings-programmer', rute: '/ny/admin/programmer', omraade: 'traening' },
	{ navn: 'Træning til abonnenter', under: 'Fire programmer, dagene laves automatisk', rute: '/ny/admin/abo-traening', omraade: 'traening' },

	// ── Beskeder ──────────────────────────────────────────────
	{ navn: 'Skriv til en kunde', under: 'Lander i hendes Beskeder. Hun kan svare', rute: '/ny/admin/skriv', omraade: 'beskeder', oftest: true },
	{ navn: 'Besked på forsiden', under: 'Til et hold eller alle. Ingen samtale', rute: '/ny/admin/forsidebesked', omraade: 'beskeder', oftest: true },
	{ navn: 'Notifikationer', under: 'Beskeder på telefonen, og hvem der får dem', rute: '/ny/admin/noti', omraade: 'beskeder' },
	{ navn: 'Det AI en svarer ud fra', under: 'Videnbasen og AI ens stemme. Gælder begge apper', rute: '/ny/admin/videnbase', omraade: 'beskeder' },
	{ navn: 'Videnbase, gammel udgave', under: 'Vejen tilbage hvis den nye driller', rute: '/app/admin/linn-ai', omraade: 'system', gammel: true },
	{ navn: 'AI-vurderinger', under: 'Hvad kunderne synes om AI ens svar', rute: '/ny/admin/ai-ratings', omraade: 'beskeder' },

	// ── System ────────────────────────────────────────────────
	{ navn: 'Funktioner og adgang', under: 'Hvem må hvad i den gamle app, pr kundetype', rute: '/ny/admin/feature-adgang', omraade: 'system' },
	{ navn: 'Funktioner og adgang, gammel udgave', under: 'Vejen tilbage hvis den nye driller', rute: '/app/admin/feature-adgang', omraade: 'system', gammel: true },
	// Den gamle udgave bliver staaende som en vej tilbage, saa laenge den
	// nye er ny. Fjern den naar Linn har brugt den nye i en uge.
	{ navn: 'Spørgsmål, gammel udgave', under: 'Den gamle side. Vejen tilbage hvis den nye driller', rute: '/app/admin/spoergsmaal', omraade: 'system', gammel: true }
];

/**
 * Ét tal paa forsiden.
 *
 * `vaerdi` er null saa laenge tallet hentes. Det er IKKE nul: nul betyder
 * at der ikke er noget at se til, og det er en helt anden besked end at
 * vi ikke ved det endnu.
 */
export interface StatusTal {
	id: string;
	vaerdi: number | null;
	mrk: string;
	under: string;
	rute: string;
	/**
	 * Fremhaevet i ploomme. KUN naar der er noget der venter paa hende.
	 * Er alt i orden, er intet fremhaevet, og skaermen falder til ro. Det
	 * er hele grunden til at fremhaevelsen betyder noget.
	 */
	vigtig?: boolean;
	/** Daempet honning. Noget der bør ses paa, men som ikke haster i dag. */
	ro?: boolean;
}

export interface StatusInput {
	ubesvarede: number | null;
	holdUdenTraening: number | null;
	ingredienserUdenKobling: number | null;
	opskrifterIkkeGodkendt: number | null;
	aeldsteSpoergsmaalDage: number | null;
	holdNavn: string | null;
	opskrifterIAlt: number | null;
}

/**
 * De fire tal, i den raekkefoelge Linn godkendte 1. september.
 *
 * FELTET ER LAVET TIL AT VOKSE. Linns ord: gem fliserne til andre ting vi
 * finder. Der skal ikke laves om paa noget for at haenge et femte tal op,
 * der skal kun laegges en raekke til her.
 */
export function byggStatus(i: StatusInput): StatusTal[] {
	return [
		{
			id: 'spoergsmaal',
			vaerdi: i.ubesvarede,
			mrk: i.ubesvarede === 1 ? 'spørgsmål venter' : 'spørgsmål venter',
			under:
				i.aeldsteSpoergsmaalDage && i.aeldsteSpoergsmaalDage > 0
					? `ældste er ${i.aeldsteSpoergsmaalDage} ${i.aeldsteSpoergsmaalDage === 1 ? 'dag' : 'dage'} gammelt`
					: 'ingen venter lige nu',
			rute: '/ny/admin/spoergsmaal',
			// Kun naar der FAKTISK venter noget.
			vigtig: (i.ubesvarede ?? 0) > 0
		},
		{
			id: 'hold',
			vaerdi: i.holdUdenTraening,
			mrk: i.holdUdenTraening === 1 ? 'hold uden træning' : 'hold uden træning',
			under: i.holdNavn ?? 'alle aktive hold har et program',
			rute: '/ny/admin/traening/hold',
			// Den farligste af dem alle: der kommer ingen fejl naar det
			// glemmes, der kommer bare ingenting. Se 9.32.
			ro: (i.holdUdenTraening ?? 0) > 0
		},
		{
			id: 'kobling',
			vaerdi: i.ingredienserUdenKobling,
			mrk: 'ingredienser uden kobling',
			under:
				(i.ingredienserUdenKobling ?? 0) > 0
					? 'tæller ikke med i nogen opskrift'
					: 'alle er koblet',
			rute: '/ny/admin/ingrediens-tal'
		},
		{
			id: 'godkendt',
			vaerdi: i.opskrifterIkkeGodkendt,
			mrk: 'opskrifter ikke godkendt',
			under: i.opskrifterIAlt ? `af ${i.opskrifterIAlt}` : '',
			rute: '/app/admin/opskrifter'
		}
	];
}

/** Vaerktoejerne i ét omraade. */
export function iOmraade(omraade: Omraade): Vaerktoej[] {
	return VAERKTOEJER.filter((v) => v.omraade === omraade);
}

/** Dem Linn bruger oftest, til forsiden. */
export function oftestBrugte(): Vaerktoej[] {
	return VAERKTOEJER.filter((v) => v.oftest);
}

/** Folder ae, oe og aa, saa der kan soeges uden danske bogstaver. */
function fold(s: string): string {
	return s.toLowerCase().replace(/æ/g, 'ae').replace(/ø/g, 'oe').replace(/å/g, 'aa');
}

/**
 * Soegningen i toppen.
 *
 * Med 34 vaerktoejer er det hurtigste at skrive to bogstaver. Der ledes i
 * baade navnet og undertitlen, for Linn husker tit hvad et vaerktoej GOER
 * og ikke hvad det hedder.
 */
export function soegVaerktoej(ord: string): Vaerktoej[] {
	const termer = fold(ord)
		.split(/\s+/)
		.map((t) => t.trim())
		.filter((t) => t.length > 0);
	if (termer.length === 0) return [];
	return VAERKTOEJER.filter((v) => {
		const tekst = fold(`${v.navn} ${v.under} ${OMRAADE_NAVN[v.omraade]}`);
		return termer.every((t) => tekst.includes(t));
	});
}

/** Hilsenen, efter klokken. Linn arbejder ofte om aftenen. */
export function hilsen(time: number): string {
	if (time < 10) return 'Godmorgen, Linn';
	if (time < 17) return 'Goddag, Linn';
	return 'Godaften, Linn';
}
