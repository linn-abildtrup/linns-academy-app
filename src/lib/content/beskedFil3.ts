// ============================================================
// Filer i en personlig besked fra Linn til én kunde: billeder nu, lyd
// senere. Rent modul: ingen Firestore, ingen Storage, ingen browser, saa
// baade siden og serveren kan bruge de samme regler.
//
// HVORFOR FILERNE LIGGER FOR SIG SELV og ikke sammen med lektionernes
// lyd: en lektion er den samme for alle, en besked er til én kunde. Den
// forskel skal kunne ses paa stien, ellers kan reglerne i Storage ikke
// skelne dem, og saa kan enhver kunde aabne enhver andens billede.
//
// Bygget 1. september 2026.
// ============================================================

/** Hvad en fil i en besked kan vaere. */
export type BeskedFilSlags = 'billede' | 'lyd';

/** Laengste side paa billedet, samme som opskrifternes store udgave. */
export const BILLEDE_MAX_DIM = 1000;

/** Lyden stopper af sig selv her. Se skaermen: "Højst 5 minutter". */
export const LYD_MAKS_SEKUNDER = 300;

/**
 * Loftet i Storage-reglerne. Fem minutter tale fylder omkring 3 MB, saa
 * her er rigelig luft, og en fejl kan stadig ikke fylde lageret.
 */
export const FIL_MAKS_BYTES = 20 * 1024 * 1024;

/**
 * Mappen ligger under kundens eget id. DET ER HELE LAASEN: reglen i
 * Storage siger at kun den kunde hvis id staar i stien, og Linn, maa
 * laese filen.
 */
export function beskedFilSti(
	uid: string,
	slags: BeskedFilSlags,
	endelse: string,
	nu: number = Date.now()
): string {
	if (!uid) throw new Error('beskedFilSti: uid er paakraevet');
	const ren = (endelse || 'bin').replace(/[^a-z0-9]/gi, '').toLowerCase() || 'bin';
	return `beskeder/${uid}/${nu}-${slags}.${ren}`;
}

/**
 * Er den her adresse en fil vi selv har lagt i KUNDENS egen mappe.
 *
 * Serveren skriver adressen ind i beskeden, og den skal ikke kunne pege
 * paa en anden kundes mappe eller et sted ude i verden. Det er ikke en
 * mistanke til Linn: det er en spaerre mod en tastefejl der ellers ville
 * ende i en kundes besked og ikke kunne kaldes tilbage.
 */
export function erVoresBeskedFil(url: string, uid: string): boolean {
	if (!url || !uid) return false;
	if (!url.startsWith('https://firebasestorage.googleapis.com/')) return false;
	// getDownloadURL koder skraastregerne i stien, saa mappen staar som
	// beskeder%2F{uid}%2F. Store og smaa bogstaver i %2F varierer.
	return url.toLowerCase().includes(`beskeder%2f${uid.toLowerCase()}%2f`);
}

/**
 * Filendelsen der hoerer til en lydoptagelse.
 *
 * Browserne optager i hver sit format: Chrome laver webm, Safari laver
 * mp4. Begge kan afspilles af begge, saa vi laver ikke om paa filen. Vi
 * skal bare give den det navn den fortjener, ellers gaetter telefonen
 * paa hvad den har faaet.
 */
export function lydEndelseFor(mime: string): string {
	const m = (mime ?? '').toLowerCase();
	if (m.includes('webm')) return 'webm';
	if (m.includes('mp4') || m.includes('m4a') || m.includes('aac')) return 'm4a';
	if (m.includes('ogg')) return 'ogg';
	if (m.includes('wav')) return 'wav';
	if (m.includes('mpeg') || m.includes('mp3')) return 'mp3';
	return 'lyd';
}

/** "2,4 MB" eller "61 KB". Til linjen under filen paa admin-skaermen. */
export function filStoerrelse(bytes: number): string {
	if (!Number.isFinite(bytes) || bytes < 0) return '';
	if (bytes < 1024) return `${Math.round(bytes)} B`;
	if (bytes < 950 * 1024) return `${Math.round(bytes / 1024)} KB`;
	return `${(bytes / (1024 * 1024)).toFixed(1).replace('.', ',')} MB`;
}

/** "1:12". Bruges baade paa admin-skaermen og i kundens traad. */
export function formaterSekunder(sekunder: number): string {
	const hele = Math.max(0, Math.floor(Number.isFinite(sekunder) ? sekunder : 0));
	const m = Math.floor(hele / 60);
	const s = hele % 60;
	return `${m}:${String(s).padStart(2, '0')}`;
}
