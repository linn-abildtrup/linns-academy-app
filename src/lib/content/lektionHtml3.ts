// ============================================================
// En skreven lektion pillet ned til blokke, saa den kan blive en pdf.
//
// HVORFOR VI IKKE BARE FOTOGRAFERER SIDEN. En lektion ligger som en
// almindelig html-fil et sted paa nettet. At gengive den som den ser ud
// ville kraeve en hel browser paa serveren. Det er stort, dyrt og noget
// der gaar i stykker naar siden bruger noget vi ikke havde regnet med.
//
// I stedet tager vi det der betyder noget: overskrifter, afsnit,
// punkter og citater. Det saettes op i Linns eget design, saa filen
// ligner hende og ikke en udskrift fra en browser. Se
// server/lektionPdf3.ts.
//
// FUNKTIONEN ER REN. Ingen DOM, ingen netvaerk. Derfor kan den testes
// helt, og derfor kan den koere baade paa serveren og i en test.
//
// Linns beslutning 5. september: kun skrevne sider og filer der allerede
// er pdf kan sendes. Video naevnes ikke, heller ikke som et link.
// ============================================================

export type BlokSlags = 'overskrift' | 'underoverskrift' | 'afsnit' | 'punkt' | 'citat';

export interface Blok {
	slags: BlokSlags;
	tekst: string;
}

/** De tegn en html-fil skriver i stedet for sig selv. */
const NAVNE: Record<string, string> = {
	amp: '&',
	lt: '<',
	gt: '>',
	quot: '"',
	apos: "'",
	nbsp: ' ',
	aelig: 'æ',
	oslash: 'ø',
	aring: 'å',
	AElig: 'Æ',
	Oslash: 'Ø',
	Aring: 'Å',
	hellip: '…',
	ndash: '–',
	mdash: '—',
	laquo: '«',
	raquo: '»',
	ldquo: '"',
	rdquo: '"',
	lsquo: "'",
	rsquo: "'",
	deg: '°',
	middot: '·',
	bull: '·',
	eacute: 'é',
	egrave: 'è',
	uuml: 'ü',
	ouml: 'ö',
	auml: 'ä'
};

/**
 * Skriver tegnene tilbage til sig selv.
 *
 * En lektion om maaltider er fuld af aa, ae og oe, og de staar tit som
 * &aring; i filen. Uden det her ville pdf'en vaere fuld af kode.
 */
export function afkodTegn(s: string): string {
	return s
		.replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
		.replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
		.replace(/&([a-zA-Z]+);/g, (hele, navn) => NAVNE[navn] ?? hele);
}

/** Fjerner maerkerne og klemmer mellemrummene sammen. */
function rentTekst(html: string): string {
	return afkodTegn(
		html
			// Et linjeskift skrevet som maerke skal ikke klistre to ord sammen.
			.replace(/<br\s*\/?>/gi, ' ')
			.replace(/<[^>]*>/g, '')
	)
		.replace(/\s+/g, ' ')
		.trim();
}

/**
 * Alt det der ikke er indhold.
 *
 * Hoved, typografi og kode maa ikke ende i pdf'en. Menuer og sidefoedder
 * ryger ogsaa: de hoerer til siden, ikke til lektionen.
 */
function fjernStoej(html: string): string {
	return html
		.replace(/<!--[\s\S]*?-->/g, '')
		.replace(/<head[\s\S]*?<\/head>/gi, '')
		.replace(/<script[\s\S]*?<\/script>/gi, '')
		.replace(/<style[\s\S]*?<\/style>/gi, '')
		.replace(/<noscript[\s\S]*?<\/noscript>/gi, '')
		.replace(/<svg[\s\S]*?<\/svg>/gi, '')
		.replace(/<nav[\s\S]*?<\/nav>/gi, '')
		.replace(/<header[\s\S]*?<\/header>/gi, '')
		.replace(/<footer[\s\S]*?<\/footer>/gi, '');
}

/** Rammer der ikke skal skrives to gange, fordi de kun holder om noget. */
const MAERKER = /<(h1|h2|h3|h4|p|li|blockquote)\b[^>]*>([\s\S]*?)<\/\1>/gi;

/**
 * Titlen paa siden, hvis den staar der.
 *
 * Bruges kun naar lektionen selv ikke har en titel i appen. Den fra
 * appen er den Linn har skrevet, og den vinder.
 */
export function titelFraHtml(html: string): string {
	const m = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
	return m ? rentTekst(m[1]) : '';
}

/**
 * Lektionen som en raekke blokke, i den raekkefoelge de staar.
 *
 * En overskrift der er tom springes over. Det samme goer et afsnit paa
 * ét tegn: det er naesten altid et mellemrum der er blevet staaende.
 */
export function blokkeFraHtml(html: string): Blok[] {
	if (!html) return [];
	const krop = fjernStoej(html);
	const ud: Blok[] = [];
	let m: RegExpExecArray | null;
	MAERKER.lastIndex = 0;
	while ((m = MAERKER.exec(krop)) !== null) {
		const maerke = m[1].toLowerCase();
		const tekst = rentTekst(m[2]);
		if (tekst.length < 2) continue;
		let slags: BlokSlags = 'afsnit';
		if (maerke === 'h1') slags = 'overskrift';
		else if (maerke === 'h2' || maerke === 'h3' || maerke === 'h4') slags = 'underoverskrift';
		else if (maerke === 'li') slags = 'punkt';
		else if (maerke === 'blockquote') slags = 'citat';
		// To ens blokke i traek er naesten altid den samme tekst faldet
		// igennem to gange, fordi et afsnit laa inde i et andet maerke.
		const sidste = ud[ud.length - 1];
		if (sidste && sidste.tekst === tekst) continue;
		ud.push({ slags, tekst });
	}
	return ud;
}

/**
 * Er der nok til at det giver mening at sende noget.
 *
 * LINNS REGEL 5. september: knappen skjules, naar der ikke er nok at
 * sende. Paa selve siden afgoeres det af lektionens art, og her af hvad
 * der faktisk stod i filen. En side der viser sig at vaere tom, skal
 * ikke blive til en pdf med en overskrift og ingenting under.
 */
export const MINDST_TEGN = 120;

export function harNokIndhold(blokke: Blok[]): boolean {
	const tegn = blokke.reduce((n, b) => n + b.tekst.length, 0);
	return tegn >= MINDST_TEGN;
}

/**
 * Fjerner overskriften naar den bare gentager titlen.
 *
 * En skreven lektion begynder naesten altid med sin egen overskrift, og
 * titlen staar allerede oeverst i pdf'en. Uden det her stod den samme
 * saetning to gange lige under hinanden.
 *
 * Vi ser kun paa den foerste blok, og kun hvis den er en overskrift.
 * Staar den samme tekst laengere nede, er det fordi den hoerer til dér.
 */
export function udenDobbeltTitel(blokke: Blok[], titel: string): Blok[] {
	const foerste = blokke[0];
	if (!foerste || foerste.slags !== 'overskrift') return blokke;
	const ens = (s: string) =>
		s
			.toLowerCase()
			.replace(/[^a-z0-9æøå]+/gi, '')
			.trim();
	if (!titel || ens(foerste.tekst) !== ens(titel)) return blokke;
	return blokke.slice(1);
}
