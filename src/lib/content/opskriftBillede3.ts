// Opskrift-billeder i 3.0: stoerrelser, filnavne og sortering.
//
// Modulet er rent: ingen Firestore, ingen browser, ingen Svelte.
//
// Hvorfor TO stoerrelser: flisen i gitteret er 62 px hoej og 170 bred. At
// sende et 1200 px billede til den er som at sende en plakat for at vise et
// frimaerke. Maalt paa hvad der faktisk vises:
//
//   3.0 flise i gitteret     170 x 62    = 510 px paa en 3x-skaerm
//   3.0 opskrift-arket       fuld x 150  = 1170 px
//   gammel bibliotek         56 x 56     = 168 px
//   gammel 30-30-3 liste     fuld, 4:3   = ~1080 px
//   gammel opskrift-side     beder om 800
//
// Med to stoerrelser koster foerste skaerm i listen 150 KB i stedet for 420,
// og hele listen 2,2 MB i stedet for 9,1 naar der er 130 billeder.
//
// Den STORE bliver liggende i billedeUrl, som den gamle app allerede bruger.
// Gjorde vi det felt lille, ville 760 kunder i drift faa slørede billeder.

export type Billedstoerrelse = 'lille' | 'stor';

export interface StoerrelseSpec {
	/** Laengste side i pixels. */
	maxDim: number;
	kvalitet: number;
	/** Hvad den bruges til. Staar paa admin-skaermen. */
	bruges: string;
}

export const STOERRELSER: Record<Billedstoerrelse, StoerrelseSpec> = {
	lille: { maxDim: 480, kvalitet: 0.78, bruges: 'fliserne i gitteret' },
	stor: { maxDim: 1000, kvalitet: 0.82, bruges: 'opskrift-arket og den gamle app' }
};

// ==============================================
// Format
// ==============================================

/**
 * Faelden ved webp: beder man en browser der ikke kan det om webp, faar man
 * IKKE en fejl. Man faar en PNG, som er stoerre end den jpeg man ville have
 * haft. Man tror man har sparet og har gjort det vaerre.
 *
 * Derfor spoerger vi hvad der FAKTISK kom ud, i stedet for at gaa ud fra det.
 * Er svaret ikke webp, skal der laves en jpeg i stedet.
 */
export function formatDuger(faaetType: string | undefined): boolean {
	return (faaetType ?? '').toLowerCase() === 'image/webp';
}

/** Filendelsen der hoerer til en mime-type. */
export function endelseFor(mime: string): string {
	const m = (mime ?? '').toLowerCase();
	if (m === 'image/webp') return 'webp';
	if (m === 'image/png') return 'png';
	return 'jpg';
}

// ==============================================
// Filnavne
// ==============================================

/**
 * Filnavn ud fra titlen, saa filerne er til at kende i Firebase Console.
 * Id'et sikrer at to opskrifter med samme navn ikke skriver oven i hinanden,
 * og stoerrelsen staar til sidst saa parret hoerer synligt sammen.
 */
export function billedeSti(
	titel: string,
	opskriftId: string,
	stoerrelse: Billedstoerrelse,
	endelse: string
): string {
	const stamme = (titel ?? '')
		.toLowerCase()
		.replace(/æ/g, 'ae')
		.replace(/ø/g, 'oe')
		.replace(/å/g, 'aa')
		.normalize('NFD')
		.replace(/[̀-ͯ]/g, '')
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-+|-+$/g, '')
		.slice(0, 50)
		.replace(/-+$/g, '');
	const kort = (opskriftId ?? '').slice(0, 6) || 'ukendt';
	return `opskrifter/${stamme || 'opskrift'}-${kort}-${stoerrelse}.${endelse}`;
}

// ==============================================
// Maal og tal til skaermen
// ==============================================

/** Ny stoerrelse naar laengste side skaleres ned til maxDim. Aldrig op. */
export function nyeMaal(
	bredde: number,
	hoejde: number,
	maxDim: number
): { bredde: number; hoejde: number } {
	if (bredde <= 0 || hoejde <= 0) return { bredde: 0, hoejde: 0 };
	if (bredde <= maxDim && hoejde <= maxDim) return { bredde, hoejde };
	if (bredde >= hoejde) {
		return { bredde: maxDim, hoejde: Math.round((hoejde / bredde) * maxDim) };
	}
	return { bredde: Math.round((bredde / hoejde) * maxDim), hoejde: maxDim };
}

/** Menneskeligt maal for en filstoerrelse. */
export function vaegtTekst(bytes: number): string {
	if (!Number.isFinite(bytes) || bytes < 0) return '—';
	if (bytes < 1024) return `${Math.round(bytes)} B`;
	if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
	return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** Hvor meget mindre det blev, i hele procent. */
export function sparetProcent(foer: number, efter: number): number {
	if (!Number.isFinite(foer) || foer <= 0) return 0;
	if (efter >= foer) return 0;
	return Math.round(((foer - efter) / foer) * 100);
}

// ==============================================
// Listen paa admin-skaermen
// ==============================================

export interface BilledePost {
	id: string;
	titel: string;
	billedeUrl: string | null;
	billedeUrlLille: string | null;
}

/** Har opskriften et billede overhovedet. */
export function harBillede(o: BilledePost): boolean {
	return Boolean(o.billedeUrl);
}

/**
 * Mangler den den lille udgave? De to billeder der blev flyttet fra Firestore
 * 11. august har kun den store, saa fliserne henter 38 KB hvor de kunne noejes
 * med 17. Det retter sig selv naar Linn laegger billedet paa igen.
 */
export function manglerLille(o: BilledePost): boolean {
	return Boolean(o.billedeUrl) && !o.billedeUrlLille;
}

/**
 * Manglende foerst, saa dem der kun har den store, og til sidst de faerdige.
 * Inden for hver gruppe alfabetisk, saa raekkefoelgen ikke hopper rundt naar
 * hun har lagt et billede paa.
 */
export function sorterTilAdmin<T extends BilledePost>(poster: T[]): T[] {
	const rang = (o: T) => (!harBillede(o) ? 0 : manglerLille(o) ? 1 : 2);
	return [...poster].sort(
		(a, b) => rang(a) - rang(b) || (a.titel ?? '').localeCompare(b.titel ?? '', 'da')
	);
}

export interface Optaelling {
	ialt: number;
	medBillede: number;
	uden: number;
	kunStor: number;
	procent: number;
}

/** Tallene i toppen af admin-skaermen. */
export function taelBilleder(poster: BilledePost[]): Optaelling {
	const ialt = poster.length;
	const medBillede = poster.filter(harBillede).length;
	const kunStor = poster.filter(manglerLille).length;
	return {
		ialt,
		medBillede,
		uden: ialt - medBillede,
		kunStor,
		procent: ialt === 0 ? 0 : Math.round((medBillede / ialt) * 100)
	};
}
