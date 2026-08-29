// ============================================================
// "Laeg appen paa din hjemmeskaerm" i den gamle app.
//
// Skaermen vises ÉN gang, foerste gang en ny kunde er logget ind, og
// foer kettlebell-spoergsmaalet saa hun ikke faar to ting paa én gang.
//
// Ordlyden er den samme som i 3.0 (hjemmeskaermTrin3 i
// utils/notiTilmeld3.ts). Teksterne staar med vilje ogsaa her i stedet
// for at blive importeret derfra: 3.0-modulet traekker push-beskeder og
// Firestore med sig ind i den gamle apps bundt, og det er en langt
// stoerre kobling end tre linjer tekst er vaerd. Aendrer du dem ét sted,
// saa aendr dem begge, ellers siger de to apper hver sit.
// ============================================================

/**
 * Kunder oprettet FOER dette tidspunkt ser aldrig skaermen.
 *
 * Linns valg 29. august 2026: kun nye kunder. De knap 760 der allerede
 * er inde, har for laengst indrettet sig, og en ekstra skaerm ved
 * naeste aabning ville ligne at noget var gaaet i stykker.
 *
 * Graensen er en dato frem for et felt paa hver kunde, saa vi slipper
 * for at skrive til 760 dokumenter for at markere en skaerm de aldrig
 * skal se. Sat til udrulningsdagen.
 */
export const HJEMMESKAERM_FRA_MS = Date.UTC(2026, 7, 29, 0, 0, 0); // 29. august 2026

/**
 * Feltet paa bruger-dokumentet: hvornaar hun blev faerdig med skaermen,
 * i ms. Sat baade naar hun trykker "Det er gjort" og "Spring over" —
 * det er ét spoergsmaal hun kun skal se én gang, uanset svaret.
 */
export interface HjemmeskaermKilde {
	hjemmeskaermVistAt?: number;
}

export interface HjemmeskaermVilkaar {
	/** userDoc.createdAt. Undefined for gamle konti uden feltet. */
	oprettetAt?: number;
	/** Har hun allerede vaeret igennem skaermen. */
	vistAt?: number;
	/** Er admin. Linn aabner appen oftest af alle og skal udenom. */
	erAdmin: boolean;
	/** Ligger appen allerede paa hjemmeskaermen. */
	paaHjemmeskaerm: boolean;
	/** Er det overhovedet en telefon eller tablet. */
	erMobil: boolean;
}

/**
 * Skal skaermen vises lige nu.
 *
 * Raekkefoelgen er valgt saa det billigste og mest sikre tjek kommer
 * foerst, og saa vi aldrig kan komme til at vise den til en kunde der
 * var her foer skaermen fandtes.
 */
export function skalViseHjemmeskaerm(v: HjemmeskaermVilkaar): boolean {
	if (v.erAdmin) return false;
	// Har hun svaret én gang, er den overstaaet for altid.
	if (typeof v.vistAt === 'number' && v.vistAt > 0) return false;
	// Mangler createdAt, er kontoen fra foer feltet fandtes, altsaa gammel.
	if (typeof v.oprettetAt !== 'number') return false;
	if (v.oprettetAt < HJEMMESKAERM_FRA_MS) return false;
	// Ligger den der allerede, er der intet at bede om.
	if (v.paaHjemmeskaerm) return false;
	// Paa en computer giver vejledningen ingen mening.
	if (!v.erMobil) return false;
	return true;
}

export interface HjemmeskaermVejledning {
	trin: string[];
	note: string;
}

/**
 * Vejledningen. Den ene halvdel afhaenger af hvilken telefon hun har.
 * Samme ord som 3.0 bruger.
 */
export function hjemmeskaermVejledning(erApple: boolean): HjemmeskaermVejledning {
	if (erApple) {
		return {
			trin: [
				'Tryk på Del-knappen nederst i Safari',
				'Rul ned og vælg "Føj til hjemmeskærm"',
				'Tryk Tilføj. Nu ligger den som en app'
			],
			note: 'Åbn så appen fra det nye ikon, så fortsætter vi hvor vi slap.'
		};
	}
	return {
		trin: [
			'Tryk på menuen med de tre prikker',
			'Vælg "Installer app" eller "Føj til startskærm"',
			'Bekræft. Nu ligger den som en app'
		],
		note: 'Åbn så appen fra det nye ikon, så fortsætter vi hvor vi slap.'
	};
}

/** Er appen aabnet fra hjemmeskaermen og ikke inde i browseren. */
export function erPaaHjemmeskaerm(vindue: Window | undefined): boolean {
	if (!vindue) return false;
	// Den foerste virker alle steder. Den anden er Safaris egen, som
	// iPhone brugte foer standarden kom, og den skal blive staaende.
	const svarer = vindue.matchMedia?.('(display-mode: standalone)').matches ?? false;
	const safari = (vindue.navigator as { standalone?: boolean }).standalone === true;
	return svarer || safari;
}

/** iPhone og iPad. De kan ikke installere med ét tryk. */
export function erApplePhone(brugerAgent: string): boolean {
	return /iphone|ipad|ipod/i.test(brugerAgent);
}

/**
 * Er det en telefon eller tablet. Vi spoerger efter en grov pegepind
 * (fingeren) frem for skaermbredde, saa et lille browservindue paa en
 * computer ikke bliver taget for en telefon.
 */
export function erMobilEnhed(vindue: Window | undefined): boolean {
	if (!vindue) return false;
	const finger = vindue.matchMedia?.('(pointer: coarse)').matches ?? false;
	const agent = /iphone|ipad|ipod|android/i.test(vindue.navigator.userAgent);
	return finger || agent;
}
