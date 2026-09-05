// ============================================================
// Hvilke dokumenter appen selv maa hente og vise.
//
// PROBLEMET, Linn 5. september. En PDF-lektion var den eneste type hvor
// siden IKKE leverede sit indhold: kunden trykkede paa flisen, landede
// paa en side der bad hende trykke igen, og forlod saa appen. Video, lyd
// og de skrevne lektioner giver alle indholdet med det samme.
//
// PDF'erne ligger paa Simplero, og de kan ikke vises direkte i en ramme
// derfra. Men vores egen server kan hente dem, og en fil fra vores eget
// domaene KAN vises. Derfor gaar de gennem api/ny-dokument.
//
// DEN HER FIL ER LAASEN. Et endpoint der henter vilkaarlige adresser er
// en aaben doer, og saa kan enhver bruge vores server til at hente hvad
// som helst. Reglerne staar her, saa de kan testes uden en server.
// ============================================================

/**
 * De vaerter vi henter dokumenter fra.
 *
 * Simplero er hvor Linns egne filer ligger i dag. Firebase er vores egen
 * lagerplads, som de skrevne lektioner allerede bruger. Alt andet
 * afvises.
 *
 * Bemaerk at der IKKE staar simplerousercontent.net alene: uden det
 * foerste punktum ville "ondsindetsimplerousercontent.net" ogsaa slippe
 * igennem, og det er den klassiske maade at snyde en saadan liste paa.
 */
const TILLADTE_VAERTER = [
	'us.simplerousercontent.net',
	'simplerousercontent.net',
	'firebasestorage.googleapis.com',
	'storage.googleapis.com'
];

/** Stoerste dokument vi henter. Over det er det ikke en lektion. */
export const DOKUMENT_MAKS_BYTE = 25 * 1024 * 1024;

export interface DokumentTjek {
	ok: boolean;
	/** Hvorfor det blev afvist. Kun til logning, aldrig til kunden. */
	grund?: string;
}

/**
 * Maa vi hente den her adresse.
 *
 * Tre krav, og alle tre skal vaere opfyldt:
 *   1. Det skal vaere https. En http-adresse kan aendres undervejs
 *   2. Vaerten skal staa paa listen, og det skal vaere HELE vaerten
 *   3. Filen skal ende paa .pdf, ogsaa naar der staar noget efter ?
 */
export function maaHentes3(raa: string): DokumentTjek {
	if (!raa) return { ok: false, grund: 'tom adresse' };

	let u: URL;
	try {
		u = new URL(raa);
	} catch {
		return { ok: false, grund: 'ikke en adresse' };
	}

	if (u.protocol !== 'https:') return { ok: false, grund: 'ikke https' };

	// Hele vaerten skal matche. Et endsWith alene ville lukke
	// "minsimplerousercontent.net" ind.
	if (!TILLADTE_VAERTER.includes(u.hostname)) {
		return { ok: false, grund: `vaert ikke tilladt: ${u.hostname}` };
	}

	const sti = u.pathname.toLowerCase();
	if (!sti.endsWith('.pdf')) return { ok: false, grund: 'ikke en pdf' };

	return { ok: true };
}

/**
 * Vores egen lagerplads. Filer herfra kan vises i en ramme som de er.
 * Det er der de skrevne lektioner allerede ligger.
 */
const EGNE_VAERTER = ['firebasestorage.googleapis.com', 'storage.googleapis.com'];

/**
 * Adressen appen skal bruge for at vise dokumentet i en ramme.
 *
 * LIGGER FILEN HOS OS, bruges den som den er. Der er ingen grund til at
 * sende 762 KB gennem vores egen server for at faa den tilbage igen.
 *
 * LIGGER DEN UDE, gaar den gennem api/ny-dokument. Simplero tillader
 * ikke at deres filer vises i en ramme, og det er den eneste vej udenom.
 * Naar Linns dokumenter er lagt op hos os, bruges den vej ikke laengere.
 */
export function dokumentUrl3(kilde: string): string {
	try {
		if (EGNE_VAERTER.includes(new URL(kilde).hostname)) return kilde;
	} catch {
		// Ikke en adresse vi kan laese. Lad laasen i endpointet afvise den.
	}
	return `/api/ny-dokument?url=${encodeURIComponent(kilde)}`;
}
