// ============================================================
// Hvornaar en lektion er set.
//
// LINNS BESLUTNING 22. august: fluebenet skal foelge selve VIDEOEN og
// ikke dagen. Paa Kropsro ligger den samme film paa alle syv dage i en
// uge, og hun skulle saette flueben paa den syv gange.
//
// HVER DAG HAR SIN EGEN LEKTION. Det er ikke det samme dokument der gaar
// igen: dag 1 til 7 har hver sin lektion med sit eget id, der bare peger
// paa den samme film. Derfor kan id'et ikke bruges, og vi maa se paa
// videoens adresse.
//
// TO NOEGLER PR LEKTION. Naar hun ser noget, gemmer vi baade lektionens
// eget id og en noegle for videoen. Lektionen taeller som set hvis én af
// dem er der. Saa virker det ogsaa for det der ALLEREDE var markeret
// foer 22. august, hvor kun id'et blev gemt.
//
// KONSEKVENSEN, og Linn er blevet spurgt: har hun set mandagens video,
// staar hele ugen som set. Det er meningen.
// ============================================================

/** En lektion, kun de to felter det her handler om. */
export interface SetLektion3 {
	id: string;
	url?: string;
}

/**
 * Adressen renset for det der ikke aendrer hvad man ser.
 *
 * Den samme film ligger med `?share=copy` det ene sted og `#t=0` det
 * andet. Uden rensningen ville de to taelle som hver sin video.
 */
function rensUrl3(url: string): string {
	return url.trim().toLowerCase().split('#')[0].split('?')[0].replace(/\/+$/, '');
}

/**
 * Kort, stabil noegle for en video. Bruges som dokument-navn, saa den
 * maa hverken indeholde skraastreg eller vaere lang.
 *
 * Det er ikke en sikkerhedsnoegle, kun en maade at kende den samme film
 * igen paa. Simpel og forudsigelig slaar smart her: den skal give det
 * samme svar om et aar.
 */
export function videoNoegle3(url: string | undefined | null): string | null {
	if (!url) return null;
	const ren = rensUrl3(url);
	if (!ren) return null;
	let h1 = 5381;
	let h2 = 52711;
	for (let i = 0; i < ren.length; i++) {
		const c = ren.charCodeAt(i);
		h1 = (h1 * 33) ^ c;
		h2 = (h2 * 31) ^ c;
	}
	const del = (n: number) => (n >>> 0).toString(36);
	return `v-${del(h1)}${del(h2)}`;
}

/**
 * De noegler der skrives naar hun saetter eller fjerner fluebenet.
 *
 * Lektionens eget id er altid med. Uden det ville en lektion uden video,
 * altsaa en tekst, slet ikke kunne markeres.
 */
export function setNoegler3(lektion: SetLektion3): string[] {
	const v = videoNoegle3(lektion.url);
	return v ? [lektion.id, v] : [lektion.id];
}

/** Er lektionen set. Enten paa sit eget id eller paa videoen. */
export function erSet3(klaret: Set<string>, lektion: SetLektion3): boolean {
	if (klaret.has(lektion.id)) return true;
	const v = videoNoegle3(lektion.url);
	return v ? klaret.has(v) : false;
}

/** Er alle lektioner paa dagen set. Tom dag er ikke "alt taget". */
export function alleSet3(klaret: Set<string>, lektioner: SetLektion3[]): boolean {
	return lektioner.length > 0 && lektioner.every((l) => erSet3(klaret, l));
}
