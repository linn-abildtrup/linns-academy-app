// Relevans-udvaelgelse i Linns svar-arkiv.
//
// Naar en klient stiller et spoergsmaal, vil vi finde de svar Linn tidligere
// har givet paa noget lignende, paa tvaers af ALLE forloeb og hele
// historikken, i stedet for bare "de nyeste fra samme hold".
//
// Metoden er BM25, en veletableret maade at score tekst-lighed paa. Den
// vaegter sjaeldne ord hoejt (forstoppelse siger mere end spise) og straffer
// lange dokumenter, saa et kort praecist svar kan slaa et langt vidtloeftigt.
// Alt koerer i vores egen kode, ingen ekstra tjeneste og ingen ekstra pris.
//
// Modulet er rent: ingen Firestore, ingen netvaerk, kun tekst ind og et
// udvalg ud. Det goer det testbart.

/** Ét besvaret spoergsmaal i arkivet, uanset forloeb. */
export interface KorpusSvar {
	id: string;
	spoergsmaal: string;
	svar: string;
	forlobId: string;
	tidsstempel: number;
}

/** Almindelige danske ord der ikke siger noget om hvad et spoergsmaal handler om. */
const STOPORD = new Set([
	'og', 'i', 'jeg', 'det', 'at', 'en', 'den', 'til', 'er', 'som', 'paa', 'på',
	'de', 'med', 'han', 'af', 'for', 'ikke', 'der', 'var', 'mig', 'sig', 'men',
	'et', 'har', 'om', 'vi', 'min', 'havde', 'ham', 'hun', 'nu', 'over', 'da',
	'fra', 'du', 'ud', 'sin', 'dem', 'os', 'op', 'man', 'hans', 'hvor', 'eller',
	'hvad', 'skal', 'selv', 'her', 'alle', 'vil', 'blev', 'kunne', 'ind', 'naar',
	'når', 'vaere', 'være', 'dog', 'noget', 'ville', 'jo', 'deres', 'efter',
	'ned', 'skulle', 'denne', 'end', 'dette', 'mit', 'ogsaa', 'også', 'under',
	'have', 'dig', 'anden', 'hende', 'mine', 'alt', 'meget', 'sit', 'sine',
	'vor', 'mod', 'disse', 'hvis', 'din', 'nogle', 'hos', 'blive', 'mange',
	'ad', 'bliver', 'hendes', 'vaeret', 'været', 'thi', 'jer', 'saa', 'så',
	'hej', 'tak', 'kaere', 'kære', 'hilsen', 'linn', 'godt', 'lige', 'bare',
	'kan', 'ved', 'faa', 'få', 'gerne', 'noejagtigt', 'altsaa', 'altså'
]);

/**
 * Reducerer et ord til sin stamme, saa "maaltider" og "maaltid" taeller som
 * det samme. Groft, men konsistent i begge ender af sammenligningen, og det
 * er alt hvad der skal til for at matche.
 */
function stamme(ord: string): string {
	let o = ord;
	for (const endelse of ['ernes', 'erne', 'enes', 'ene', 'ers', 'ens', 'ets']) {
		if (o.length > endelse.length + 3 && o.endsWith(endelse)) {
			return o.slice(0, -endelse.length);
		}
	}
	for (const endelse of ['er', 'en', 'et', 'es']) {
		if (o.length > endelse.length + 3 && o.endsWith(endelse)) {
			o = o.slice(0, -endelse.length);
			break;
		}
	}
	if (o.length > 4 && (o.endsWith('e') || o.endsWith('s'))) o = o.slice(0, -1);
	return o;
}

/** Deler tekst op i meningsbaerende ord-stammer. Tal og enkeltbogstaver ryger ud. */
export function ordstammer(tekst: string): string[] {
	return tekst
		.toLowerCase()
		.split(/[^a-zæøåäöéèü]+/i)
		.filter((o) => o.length >= 3 && !STOPORD.has(o))
		.map(stamme)
		.filter((o) => o.length >= 3);
}

// BM25-parametre. k styrer hvor meget gentagelser af samme ord taeller,
// b hvor haardt lange dokumenter straffes. Standardvaerdier.
const BM25_K = 1.2;
const BM25_B = 0.5;

/**
 * Spoergsmaalet vejer tungere end svaret: to klienter der spoerger om det
 * samme ligner hinanden mere end to svar der tilfaeldigvis deler ord.
 */
const SPOERGSMAAL_VAEGT = 2;

export interface RelevansValg {
	/** Hoejeste antal svar der maa vaelges. */
	maks: number;
	/** Id'er der allerede er med et andet sted i prompten. */
	ekskluder?: Set<string>;
	/**
	 * Mindste score et svar skal have for at komme med. Et lavt tal lukker
	 * stoej ind, et hoejt giver for faa eksempler paa nye hold.
	 */
	minScore?: number;
	/**
	 * Hvor taet paa det bedste match et svar skal ligge for at komme med,
	 * som andel af topscoren. Uden den fylder udvalget altid op til `maks`,
	 * ogsaa naar kun tre svar reelt handler om det samme. Lange spoergsmaal
	 * scorer hoejere end korte, saa en fast graense alene raekker ikke.
	 */
	relativGraense?: number;
}

/** Ét udvalgt svar med den score det blev valgt paa. */
export interface RelevantSvar extends KorpusSvar {
	score: number;
}

/**
 * Finder de svar i arkivet der ligner spoergsmaalet mest. Returnerer dem
 * sorteret med det mest relevante foerst, og aldrig flere end `maks`.
 */
export function vaelgRelevanteSvar(
	korpus: KorpusSvar[],
	spoergsmaal: string,
	valg: RelevansValg
): RelevantSvar[] {
	const forespoergsel = [...new Set(ordstammer(spoergsmaal))];
	if (forespoergsel.length === 0 || korpus.length === 0) return [];

	const kandidater = korpus.filter((k) => !valg.ekskluder?.has(k.id));
	if (kandidater.length === 0) return [];

	// Ordene i hvert svar taelles én gang, saa vi ikke goer det forfra pr ord.
	const dokumenter = kandidater.map((k) => {
		const ord = [
			...Array(SPOERGSMAAL_VAEGT).fill(k.spoergsmaal).flatMap((t: string) => ordstammer(t)),
			...ordstammer(k.svar)
		];
		const taelling = new Map<string, number>();
		for (const o of ord) taelling.set(o, (taelling.get(o) ?? 0) + 1);
		return { svar: k, taelling, laengde: ord.length };
	});

	const gennemsnitsLaengde =
		dokumenter.reduce((sum, d) => sum + d.laengde, 0) / (dokumenter.length || 1);

	// Hvor sjaeldent er hvert ord i forespoergslen? Sjaeldne ord vejer tungest.
	const idf = new Map<string, number>();
	for (const ord of forespoergsel) {
		const antal = dokumenter.reduce((n, d) => n + (d.taelling.has(ord) ? 1 : 0), 0);
		idf.set(ord, Math.log(1 + (dokumenter.length - antal + 0.5) / (antal + 0.5)));
	}

	const minScore = valg.minScore ?? 3;
	const scoret: RelevantSvar[] = [];
	for (const d of dokumenter) {
		let score = 0;
		for (const ord of forespoergsel) {
			const tf = d.taelling.get(ord);
			if (!tf) continue;
			const naevner = tf + BM25_K * (1 - BM25_B + (BM25_B * d.laengde) / (gennemsnitsLaengde || 1));
			score += (idf.get(ord) ?? 0) * ((tf * (BM25_K + 1)) / naevner);
		}
		if (score >= minScore) scoret.push({ ...d.svar, score });
	}

	// Ved samme score vinder det nyeste svar, saa Linns aktuelle formuleringer
	// bliver foretrukket frem for et aar gammelt svar paa det samme.
	scoret.sort((a, b) => b.score - a.score || b.tidsstempel - a.tidsstempel);
	if (scoret.length === 0) return [];
	const graense = scoret[0].score * (valg.relativGraense ?? 0.45);
	return scoret.filter((s) => s.score >= graense).slice(0, valg.maks);
}
