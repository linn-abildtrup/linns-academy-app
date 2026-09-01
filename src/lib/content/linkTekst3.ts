// ============================================================
// Deler en tekst op i almindelig tekst og links, saa et link kan trykkes.
//
// HVORFOR DEN FINDES. Linns oenske 1. september 2026: skriver Linn AI et
// link, skal man kunne trykke paa det. Zoom-linket til Q&A staar i FAQ'en
// og kom ud som doed tekst, saa kunden skulle markere det og kopiere det
// i haanden paa en telefon.
//
// DEN VIGTIGSTE REGEL: DER LAVES ALDRIG HTML AF TEKSTEN.
// Teksten kommer fra en sprogmodel og fra Linns egne felter, og en
// sprogmodel kan skrive hvad som helst. Blev svaret sat ind som HTML,
// kunne et svar indeholde noget der koerte i kundens browser. Derfor
// giver filen en LISTE af stumper, som skaermen tegner med almindelige
// Svelte-elementer. Saa kan der pr definition ikke komme kode ud.
//
// OG KUN http OG https. En adresse der begynder med javascript: er et
// angreb og ikke et link. Der er test paa det.
// ============================================================

export interface TekstDel {
	slags: 'tekst' | 'link';
	tekst: string;
	/** Kun paa links. Den adresse der aabnes. */
	url?: string;
}

/**
 * Tegn der ofte staar LIGE EFTER et link og hoerer til saetningen og ikke
 * til adressen. "Se linket her: https://zoom.us/j/123." skal ikke tage
 * punktummet med, for saa virker adressen ikke.
 */
const HALE = '.,;:!?';

/**
 * Finder links i en tekst.
 *
 * Genkender http://, https:// og bare www. Sidstnaevnte fordi folk
 * skriver det saadan, og et link uden protokol er stadig et link kunden
 * gerne vil trykke paa.
 */
const MOENSTER = /(https?:\/\/[^\s<>"']+|www\.[^\s<>"']+)/gi;

/**
 * Klipper de tegn af enden der hoerer til saetningen.
 *
 * Parenteser taelles, for et link kan selv indeholde dem. FAQ'en skriver
 * fx "(Optages, saa du kan se det)" lige efter et link, og uden det her
 * ville slutparentesen blive en del af adressen.
 */
export function trimHale(raa: string): { url: string; hale: string } {
	let url = raa;
	let hale = '';
	while (url.length > 0) {
		const sidste = url[url.length - 1];
		if (HALE.includes(sidste)) {
			hale = sidste + hale;
			url = url.slice(0, -1);
			continue;
		}
		if (sidste === ')') {
			const aabne = (url.match(/\(/g) ?? []).length;
			const lukke = (url.match(/\)/g) ?? []).length;
			if (lukke > aabne) {
				hale = sidste + hale;
				url = url.slice(0, -1);
				continue;
			}
		}
		break;
	}
	return { url, hale };
}

/** Adressen der faktisk aabnes. Null naar den ikke maa aabnes. */
export function tilAdresse(url: string): string | null {
	const lav = url.toLowerCase();
	if (lav.startsWith('http://') || lav.startsWith('https://')) return url;
	if (lav.startsWith('www.')) return `https://${url}`;
	return null;
}

/**
 * Deler teksten i stumper. Skaermen tegner hver stump for sig.
 *
 * Linjeskift bevares i teksten, for boblen viser dem allerede.
 */
export function delOpILinks(tekst: string): TekstDel[] {
	if (!tekst) return [];
	const ud: TekstDel[] = [];
	let sidst = 0;

	for (const m of tekst.matchAll(MOENSTER)) {
		const start = m.index ?? 0;
		const raa = m[0];
		const { url, hale } = trimHale(raa);
		const adresse = tilAdresse(url);

		if (start > sidst) ud.push({ slags: 'tekst', tekst: tekst.slice(sidst, start) });

		if (adresse) {
			ud.push({ slags: 'link', tekst: url, url: adresse });
		} else {
			// Ikke en adresse vi vil aabne. Den staar som almindelig tekst,
			// saa kunden stadig kan se hvad der stod.
			ud.push({ slags: 'tekst', tekst: url });
		}
		if (hale) ud.push({ slags: 'tekst', tekst: hale });
		sidst = start + raa.length;
	}

	if (sidst < tekst.length) ud.push({ slags: 'tekst', tekst: tekst.slice(sidst) });
	return ud;
}

/** Er der overhovedet et link. Sparer skaermen for at dele teksten op. */
export function harLink(tekst: string): boolean {
	MOENSTER.lastIndex = 0;
	return MOENSTER.test(tekst ?? '');
}
