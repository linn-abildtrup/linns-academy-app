// ============================================================
// Etape 2 af regnemaskinen. Fra skrevet ingrediensnavn til kernenavn.
//
// De 1105 ingrediens-linjer er skrevet i haanden over lang tid, og
// samme vare staar paa mange maader. Olivenolie staar som olivenolie,
// Olivenolie, olievenolie, olivenolie til stegning og olivenolie til
// topping. Det er fem navne for én vare.
//
// Filen her laver om paa NAVNET NAAR VI LAESER. Den skriver ikke i
// opskrifterne. Det er med vilje: de 760 kunder i den gamle app ser
// ingredienslisten som den staar, og de skal ikke opdage at avokado er
// blevet til avocado uden at faa noget ud af det. Se regel 10.
//
// DEN VIGTIGSTE REGEL I HELE FILEN
// Ord som frisk, hakket og revet er stoej. De beskriver hvordan varen
// er skaaret, ikke hvad den er.
//
// Men ordene toer, kogt og afdryppet er IKKE stoej for baelgfrugter,
// ris, pasta og korn. Toerre groenne linser har 20 g protein pr 100 g.
// Afdryppede har 5,7. Slaar man dem sammen, bliver makroen fire gange
// forkert.
//
// Det var praecis dét der gik galt i de fire tidligere forsoeg paa at
// koble ingredienser til foedevaredatabasen. Se SPEC-3.0.md 26.18.
// ============================================================

import { rensNavn } from './enhedsvaegt3';

/**
 * Varer hvor tilstanden aendrer naeringen saa meget at den er en del af
 * varens identitet. For alt andet er toer og kogt stoej.
 *
 * Baelgfrugter og korn suger vand naar de koges. 100 g toerre linser
 * bliver til cirka 250 g kogte, og naeringen fordeles derfor over
 * to en halv gang saa meget vaegt.
 */
const TILSTAND_BETYDER_NOGET =
	/linser|kikaert|boenner|aerter|ris\b|pasta|bulgur|quinoa|couscous|gryn|havregryn|byg|spelt|groed|noedler/;

/**
 * Undtagelserne. De her hedder boenner eller aerter, men de er friske
 * eller frosne groentsager og ikke toerrede baelgfrugter.
 *
 * Groenne boenner har 1,8 g protein pr 100 g. Toerre hvide boenner har
 * 21. Stempler man de foerste som toerre, bliver retten ti gange for
 * proteinrig.
 */
const FRISKE_BAELGE = /groenne boenner|haricot|sukkeraerter|edamame|spidskaal|boennespirer/;

/**
 * Ord der beskriver tilberedning eller udseende og ikke selve varen.
 * De skaeres af naar kernenavnet skal findes.
 */
const STOEJORD = new Set([
	'frisk', 'friske', 'friskkvaernet', 'friskrevet', 'hakket', 'hakkede', 'finthakket', 'snittet',
	'g', 'kg', 'ml', 'dl', 'stk', 'spsk', 'tsk',
	'revet', 'fintrevne', 'moden', 'modne', 'lille', 'sma', 'store', 'stor',
	'ristede', 'ristet', 'knuste', 'stoedt', 'moset', 'blandet', 'blanding',
	'i', 'tern', 'skiver', 'tynde', 'bundt', 'handfuld', 'stang', 'stykker',
	'buketter', 'scoop', 'dase', 'daase', 'pakke', 'poser', 'fed',
	'lidt', 'drys', 'ekstra', 'til', 'pynt', 'topping', 'servering', 'stegning',
	'efter', 'smag', 'og', 'eller', 'med', 'uden', 'af', 'fra', 'en', 'et', 'den',
	'natten', 'over', 'variant', 'kolestab', 'neutralt', 'vanilje'
]);

/**
 * Stavemaader og forkortelser der peger paa samme vare.
 * Noeglerne er allerede kort gennem rensNavn, altsaa uden aeoeaa.
 */
const SYNONYMER: Record<string, string> = {
	avokado: 'avocado',
	avokadoer: 'avocado',
	avocadoer: 'avocado',
	olievenolie: 'olivenolie',
	tahin: 'tahini',
	soja: 'sojasauce',
	mayo: 'mayonnaise',
	kikaert: 'kikaerter',
	guleroedder: 'gulerod',
	gulerodder: 'gulerod',
	cherrytomat: 'cherrytomater',
	tomater: 'tomat',
	boenne: 'boenner',
	radise: 'radiser',
	aebler: 'aeble',
	kartoffel: 'kartofler',
	valnoedder: 'valnoed',
	valnoed: 'valnoed',
	mandel: 'mandler',
	graeskarkerne: 'graeskarkerner',
	solsikkefroe: 'solsikkekerner',
	hoerfroe: 'hoerfroe',
	fuldkornsris: 'fuldkornsris',
	broccolibuketter: 'broccoli'
};

export type Tilstand = 'toer' | 'kogt' | 'afdryppet' | null;

/**
 * Laeser varens tilstand ud af navnet. Bruges kun naar varen staar paa
 * listen over dem hvor tilstand betyder noget.
 */
export function tilstand(navn: string): Tilstand {
	const n = rensNavn(navn);
	if (!TILSTAND_BETYDER_NOGET.test(n)) return null;
	// Friske og frosne baelge er groentsager. De har ingen toer tilstand.
	if (FRISKE_BAELGE.test(n) || /\bfrosne\b|\bfrossen\b|\bfriske?\b/.test(n)) return null;
	if (/\bafdryppe(de|t)\b|\bdraenet\b|\bkonserves\b|\bdase\b|\bdaase\b/.test(n)) return 'afdryppet';
	if (/\bkogt(e)?\b|\btilberedt(e)?\b/.test(n)) return 'kogt';
	if (/\btoer(re|rede|ret)?\b|\bra\b|\butilberedt\b/.test(n)) return 'toer';
	// Staar der intet, er en baelgfrugt eller et korn toert som udgangspunkt.
	// Det er saadan opskrifterne er skrevet: raavarer er raa. Linns
	// praecisering 12. august.
	return 'toer';
}

/**
 * Finder kernenavnet, altsaa varen uden tilberedning og pynt.
 *
 * For baelgfrugter, ris og korn bliver tilstanden haengende paa navnet,
 * saa toerre og afdryppede linser aldrig bliver det samme opslag.
 */
export function kerneNavn(navn: string): string {
	const renset = rensNavn(navn);
	const t = tilstand(navn);

	const ord = renset
		.replace(/,/g, ' ')
		.split(/\s+/)
		.filter((o) => o && !STOEJORD.has(o) && !/^\d/.test(o) && !/^\d+%$/.test(o));

	// Tilstands-ordene fjernes ogsaa fra selve navnet, for de laegges
	// tilbage paa en fast maade nedenfor. Ellers ville toerre og toer
	// give to forskellige kernenavne.
	const udenTilstand = ord.filter(
		(o) => !/^(toer|toerre|toerret|toerrede|ra|kogt|kogte|afdryppet|afdryppede|draenet|konserves|tilberedt|tilberedte)$/.test(o)
	);

	const oversat = udenTilstand.map((o) => SYNONYMER[o] ?? o);
	const unikke = [...new Set(oversat)].sort();
	const kerne = unikke.join(' ');

	return t ? `${kerne} ${t}` : kerne;
}

/**
 * To ingrediens-navne der peger paa samme vare og samme tilstand.
 * Bruges til at samle linjer der skal have samme foedevare.
 */
export function sammeVare(a: string, b: string): boolean {
	return kerneNavn(a) === kerneNavn(b);
}

/**
 * Grupperer en raekke navne efter kernenavn. Returnerer en liste hvor
 * hver gruppe har kernenavnet og de skrevne varianter der hoerer til.
 */
export function grupper(navne: string[]): { kerne: string; varianter: string[]; antal: number }[] {
	const kort = new Map<string, Map<string, number>>();
	for (const n of navne) {
		const k = kerneNavn(n);
		if (!k) continue;
		if (!kort.has(k)) kort.set(k, new Map());
		const g = kort.get(k)!;
		g.set(n, (g.get(n) ?? 0) + 1);
	}
	return [...kort.entries()]
		.map(([kerne, g]) => ({
			kerne,
			varianter: [...g.keys()],
			antal: [...g.values()].reduce((a, b) => a + b, 0)
		}))
		.sort((a, b) => b.antal - a.antal);
}
