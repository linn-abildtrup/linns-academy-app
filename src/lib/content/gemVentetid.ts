// Hjaelper der holder op med at lade som om et gem er i gang.
//
// Et gem uden forbindelse melder ALDRIG fejl. Firestore skriver aendringen i
// telefonens lokale kopi med det samme og lader anmodningen til serveren staa
// og vente, om saa det er i dagevis. Derfor bliver en gem-knap staaende paa
// "Gemmer..." i det uendelige, og derfor rammer appens egne fejlbeskeder
// aldrig. Se forbindelseState.svelte.ts for hele baggrunden.
//
// Her venter vi et stykke tid og giver saa op paa at VENTE. Vi giver ikke op
// paa selve skrivningen: den ligger stadig i koe og bliver sendt af sig selv.
//
// VIGTIGT: derfor maa der ikke staa "Proev igen" paa den besked kunden faar.
// Trykker hun gem igen, laegger hun en skrivning nummer to i koe, og naar
// forbindelsen kommer tilbage, faar hun to ens maaltider. Beskeden skal
// fortaelle at det er paa vej, ikke bede hende gentage sig selv.

/** Hvor laenge vi venter foer vi siger det hoejt. Et almindeligt gem tager
 *  under ét sekund, ogsaa paa et daarligt net. */
export const GEM_VENTETID_MS = 8000;

export type GemUdfald<T> =
	| { status: 'ok'; vaerdi: T }
	| { status: 'venter' }
	| { status: 'fejl'; fejl: unknown };

/**
 * Venter paa skrivningen, men hoejst `ms`.
 *
 * - `ok`: serveren har kvitteret.
 * - `venter`: der er gaaet for lang tid. Skrivningen ligger i koe og bliver
 *   sendt naar forbindelsen er tilbage. Det er IKKE en fejl.
 * - `fejl`: skrivningen blev afvist, fx af reglerne. Den kommer aldrig frem,
 *   og kunden skal proeve igen.
 */
export async function gemMedVentetid<T>(
	skrivning: Promise<T>,
	ms: number = GEM_VENTETID_MS
): Promise<GemUdfald<T>> {
	let ur: ReturnType<typeof setTimeout> | undefined;
	const venter = new Promise<GemUdfald<T>>((resolve) => {
		ur = setTimeout(() => resolve({ status: 'venter' }), ms);
	});
	try {
		return await Promise.race([
			skrivning.then((vaerdi) => ({ status: 'ok' as const, vaerdi })).catch((fejl) => ({
				status: 'fejl' as const,
				fejl
			})),
			venter
		]);
	} finally {
		if (ur) clearTimeout(ur);
	}
}
