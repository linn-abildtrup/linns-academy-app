// ============================================================
// Proev igen, naar kundens adgang ikke kan hentes.
//
// HVORFOR. Ved opstart henter appen kundens adgang. Fejler det kald, blev
// fejlen foer bare skrevet i loggen, og kunden blev lukket ind UDEN adgang.
// Var hun helt ny, moedte hun skaermen "Vi kan ikke finde dit koeb" og
// beskeden om at tjekke sin email. For en der lige har betalt er det den
// vaerst taenkelige besked.
//
// Det skete for Marianne Vangberg 30. august 2026 kl 13.24, én ud af 168
// nye kunder den dag. Hun kom ikke igen. Et enkelt daarligt oejeblik paa
// forbindelsen maa ikke kunne saette en kunde fast.
//
// HVOR LAENGE. Tre forsoeg med 0,4 og 1,2 sekunders pause. Under to
// sekunder i alt, saa en kunde med en fin forbindelse ikke maerker noget,
// og en kunde i en elevator faar en reel chance til.
// ============================================================

/** Pauserne mellem forsoegene. Laengden bestemmer ogsaa antallet: 3 forsoeg. */
export const VENT_MS = [400, 1200] as const;

/** Antal forsoeg i alt, altsaa foerste plus gentagelserne. */
export const ANTAL_FORSOEG = VENT_MS.length + 1;

/**
 * Ventetiden foer forsoeg nummer `forsoeg` (1-indekseret).
 * Nul for det foerste, og nul hvis vi er loebet toer for forsoeg.
 */
export function ventetidFor(forsoeg: number): number {
	if (forsoeg <= 1) return 0;
	return VENT_MS[forsoeg - 2] ?? 0;
}

const sovStandard = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/**
 * Koerer opgaven og proever igen ved fejl.
 *
 * `opgave` faar forsoegsnummeret med, saa kalderen kan goere noget andet
 * anden gang. Opstarten bruger det til at hente kundens raekke forfra i
 * stedet for at genbruge den den allerede havde.
 *
 * Fejler alle forsoeg, kastes den SIDSTE fejl videre, saa kalderen kan
 * fortaelle kunden sandheden.
 */
export async function medGentagelse<T>(
	opgave: (forsoeg: number) => Promise<T>,
	sov: (ms: number) => Promise<void> = sovStandard
): Promise<T> {
	let sidsteFejl: unknown;
	for (let forsoeg = 1; forsoeg <= ANTAL_FORSOEG; forsoeg++) {
		const vent = ventetidFor(forsoeg);
		if (vent > 0) await sov(vent);
		try {
			return await opgave(forsoeg);
		} catch (e) {
			sidsteFejl = e;
		}
	}
	throw sidsteFejl;
}
