// ============================================================
// Det AI'en skal vide om KUNDENS EGET FORLOEB.
//
// HVORFOR DEN FINDES. 1. september 2026 spurgte en testkunde hvornaar der
// er Q&A. Svaret staar ordret i hendes forloebs FAQ, med Zoom-tidspunkter
// og det hele, men AI'en fik kun en generel videnbase paa seks dokumenter
// at vide, og ingen af dem naevner Q&A. Den kunne altsaa ikke svare paa
// noget der laa én skuffe vaek.
//
// TRE REGLER, OG DE ER HELE FILEN:
//
// 1. AI'EN MAA ALDRIG FINDE PAA ET TIDSPUNKT. Det er den vaerste fejl her,
//    for saa moeder en kunde op paa det forkerte klokkeslaet. Staar
//    tidspunktet ikke i FAQ'en, skal den sige at hun ikke ved det og
//    tilbyde at sende spoergsmaalet videre til Linn.
//
// 2. KUN DET HUN SELV KAN FINDE I APPEN. FAQ hoerer til ét forloeb, og en
//    kunde kan have vaeret paa flere. Vi sender kun FAQ fra de forloeb hun
//    stadig har adgang til, samme regel som hjaelpe-siden bruger. Ellers
//    ville AI'en henvise til materiale hun ikke kan aabne.
//
// 3. DEN SKAL KENDE DAGS DATO OG HENDES DAGNUMMER. Uden det kan den ikke
//    se at "onsdag den 2/9" er i morgen, og saa laeser den bare en liste
//    op. Dagnummeret er det rettede, altsaa med pause traukket fra, saa
//    AI'en siger det samme som resten af appen.
//
// FILEN LAESER KUN og skriver ingenting.
// ============================================================

/** Ét spoergsmaal og svar fra et forloebs FAQ. */
export interface FaqPunkt {
	spoergsmaal: string;
	svar: string;
	/** Kategoriens navn, fx "Om Q&A-live og spoergsmaal". */
	kategori?: string;
	/** Hvilket forloeb det hoerer til, saa navnet kan naevnes. */
	forlobNavn?: string;
}

export interface ForlobViden {
	/** Fx "Kickstart August 2026". Tom naar hun ikke er paa et forloeb. */
	forlobNavn: string;
	/** Hendes dagnummer, med pause traukket fra. 0 naar der ikke er et forloeb. */
	dagNummer: number;
	antalDage: number;
	/** Dagens dato som ISO, altsaa 2026-09-01. */
	iDag: string;
	faq: FaqPunkt[];
}

/** Hvor meget forloebs-viden der maa fylde i prompten. */
export const MAX_FORLOB_TEGN = 6000;

const UGEDAGE = ['søndag', 'mandag', 'tirsdag', 'onsdag', 'torsdag', 'fredag', 'lørdag'];

/** "tirsdag den 1. september 2026". AI'en skal kunne regne fra en rigtig dag. */
export function datoTekst(iso: string): string {
	const d = new Date(`${iso}T12:00:00`);
	if (Number.isNaN(d.getTime())) return iso;
	const maaneder = [
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
	return `${UGEDAGE[d.getDay()]} den ${d.getDate()}. ${maaneder[d.getMonth()]} ${d.getFullYear()}`;
}

/**
 * Ord der ikke siger noget om hvad hun spoerger om.
 *
 * DEN HER LISTE ER IKKE PYNT. Uden den vandt et langt svar om at spise
 * nok mad over selve Q&A-svaret, da en kunde spurgte "hvornaar er der
 * Q&A". Grunden var ordet "der": det stod 40 gange i det lange svar og
 * ogsaa inde i "maaltider", mens Q&A-svaret er kort. Et almindeligt
 * bindeord maa aldrig kunne afgoere hvilket svar kunden faar.
 */
const FYLDORD = new Set([
	'og','eller','men','som','der','det','den','de','en','et','er','var',
	'har','have','kan','skal','vil','maa','må','jeg','du','hun','han','vi',
	'ikke','for','med','til','fra','paa','på','ved','om','af','i','at','saa','så',
	'min','mit','mine','din','dit','dine','sig','selv','hvad','hvis','naar','når',
	'ogsaa','også','meget','mere','mest','godt','goer','gør','bliver','blive'
]);

/**
 * Ordene i hendes besked, klar til at soege med.
 *
 * Der deles paa MELLEMRUM og ikke paa alt der ikke er et bogstav. Ellers
 * bliver "Q&A" til "q" og "a", som begge er for korte til at taelle, og
 * saa kan appen ikke finde det ene svar hun spoerger om.
 */
export function soegeOrd(spoergsmaal: string): string[] {
	return spoergsmaal
		.toLowerCase()
		.split(/\s+/)
		.map((w) => w.replace(/^[^\wæøå&]+|[^\wæøå&]+$/g, ''))
		.filter((w) => w.length >= 2 && !FYLDORD.has(w));
}

/**
 * Vaelger de FAQ-punkter der ligner det hun spoerger om.
 *
 * ET ORD TAELLER ÉN GANG PR FELT, ikke hver gang det staar der. Ellers
 * vinder det laengste svar naesten altid, bare fordi der er flere ord i
 * det. Vi leder efter det svar der HANDLER om hendes spoergsmaal, ikke
 * det der naevner ordet flest gange.
 *
 * Spoergsmaalet vejer tungest, saa kategorien, saa selve svaret. Linns
 * overskrift siger mere om hvad punktet handler om end fire hundrede ord
 * broedtekst.
 *
 * ET PUNKT DER IKKE RAMMER NOGET KOMMER STADIG MED, hvis der er plads.
 * Hun spoerger tit skaevt af de ord Linn har skrevet.
 */
export function vaelgFaq(
	faq: FaqPunkt[],
	spoergsmaal: string,
	maksTegn: number = MAX_FORLOB_TEGN
): FaqPunkt[] {
	const ord = soegeOrd(spoergsmaal);

	const findes = (tekst: string, ord: string[]): number => {
		let s = 0;
		for (const o of ord) if (tekst.includes(o)) s++;
		return s;
	};

	const score = (p: FaqPunkt): number => {
		if (ord.length === 0) return 0;
		return (
			findes(p.spoergsmaal.toLowerCase(), ord) * 5 +
			findes((p.kategori ?? '').toLowerCase(), ord) * 3 +
			findes(p.svar.toLowerCase(), ord)
		);
	};

	const sorteret = [...faq]
		.map((p, i) => ({ p, s: score(p), i }))
		.sort((a, b) => b.s - a.s || a.i - b.i)
		.map((x) => x.p);

	const ud: FaqPunkt[] = [];
	let total = 0;
	for (const p of sorteret) {
		const laengde = p.spoergsmaal.length + p.svar.length + 40;
		if (total + laengde > maksTegn) continue;
		ud.push(p);
		total += laengde;
	}
	return ud;
}

/**
 * Selve teksten AI'en faar med.
 *
 * Bemaerk instruktionen om tidspunkter. Den staar HER og ikke kun i
 * system-prompten, fordi den skal staa lige ved siden af de tidspunkter
 * den handler om.
 */
export function byggForlobKontekst(v: ForlobViden, spoergsmaal: string): string {
	const dele: string[] = [];

	dele.push(`I DAG ER DET ${datoTekst(v.iDag)}.`);

	if (v.forlobNavn) {
		dele.push(
			`KUNDEN ER PÅ FORLØBET "${v.forlobNavn}" og er på dag ${v.dagNummer} ud af ${v.antalDage}.`
		);
	} else {
		dele.push('KUNDEN ER IKKE PÅ ET FORLØB lige nu. Hun har appen som medlem.');
	}

	const valgt = vaelgFaq(v.faq, spoergsmaal);
	if (valgt.length > 0) {
		dele.push(
			'SPØRGSMÅL OG SVAR FRA HENDES EGET FORLØB. Det her er Linns egne ord, og de gælder præcis det hold kunden går på:'
		);
		for (const p of valgt) {
			const kat = p.kategori ? ` (${p.kategori})` : '';
			dele.push(`Spørgsmål${kat}: ${p.spoergsmaal}\nSvar: ${p.svar}`);
		}
	}

	// Staar til sidst, saa den er det sidste modellen laeser foer den
	// svarer. En instruktion der drukner midt i 25 svar bliver overset.
	dele.push(
		[
			'REGLER FOR DET HER AFSNIT:',
			'- Datoer, klokkeslæt og mødelinks må du KUN nævne hvis de står ordret ovenfor. Find aldrig et tidspunkt på.',
			'- Står tidspunktet ikke der, så sig at du ikke kan se det, og tilbyd at sende spørgsmålet videre til Linn.',
			'- Brug dagens dato til at sige om noget er i dag, i morgen eller overstået.',
			'- Nævn kun materiale fra hendes eget forløb. Andre hold har andre tidspunkter.'
		].join('\n')
	);

	return dele.join('\n\n') + '\n\n---\n';
}
