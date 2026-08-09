// ============================================================
// Nul-dage i 3.0.
//
// En nul-dag er en dag kunden har sat forloebet paa pause, fordi hun
// var syg eller paa ferie. Dagen taeller ikke med i forloebet: hendes
// dagnummer staar stille, og forloebet slutter en dag senere.
//
// HVORFOR DEN HER FIL FINDES
//
// 3.0 taalte rene kalenderdage fra start og kendte slet ikke til
// nul-dage. En kunde med 21 pause-dage ville derfor faa dag 63 hvor
// hun skulle have dag 42, altsaa tre ugers forkerte lektioner, forkerte
// smaa skridt og forkert refleksion. Og hendes forloeb ville lukke 21
// dage for tidligt. Maalt 9. august 2026: 12 kunder har brugt nul-dage,
// fra 1 til 21 dage, alle paa Kropsro.
//
// Nul-dage gaelder KUN Kropsro, altsaa premiumforløb. Det er en
// bevidst beslutning fra Linn 9. august 2026. En Kickstart-kunde kan
// ikke holde pause, og hendes dagnummer maa aldrig forskydes.
//
// Ingen datamigrering. Vi laeser de intervaller der allerede ligger paa
// kunden i products/{produkt}.nulDage.intervaller.
// ============================================================

import { KROPSRO_PRODUCT_ID } from '$lib/types';

const MS_PER_DAG = 86_400_000;

export interface NulDagInterval {
	fra: string;
	til: string;
}

/**
 * Kun Kropsro har nul-dage. Alt andet skal regne rent i kalenderdage.
 */
export function produktHarNulDage(produkt: string | null | undefined): boolean {
	return produkt === KROPSRO_PRODUCT_ID;
}

/** YYYY-MM-DD i lokal tid. Samme noegle som resten af 3.0 bruger. */
function datoNoegle(d: Date): string {
	const m = `${d.getMonth() + 1}`.padStart(2, '0');
	const dag = `${d.getDate()}`.padStart(2, '0');
	return `${d.getFullYear()}-${m}-${dag}`;
}

/**
 * Alle enkeltdatoer intervallerne daekker, uden dubletter og sorteret.
 *
 * Bevidst samme opfoersel som nulDageDatoer i den gamle content/forlob.ts,
 * saa de to apps aldrig kan vise hvert sit dagnummer for samme kunde.
 * Den gamle maa ikke rettes, derfor staar logikken her ogsaa.
 */
export function nulDatoer(intervaller: NulDagInterval[]): string[] {
	const sat = new Set<string>();
	for (const iv of intervaller ?? []) {
		const f = new Date(iv.fra);
		const t = new Date(iv.til);
		if (isNaN(f.getTime()) || isNaN(t.getTime())) continue;
		const cur = new Date(f.getFullYear(), f.getMonth(), f.getDate());
		const slut = new Date(t.getFullYear(), t.getMonth(), t.getDate());
		// Et interval hvor til ligger foer fra giver ingen dage.
		while (cur.getTime() <= slut.getTime()) {
			sat.add(datoNoegle(cur));
			cur.setDate(cur.getDate() + 1);
		}
	}
	return Array.from(sat).sort();
}

/**
 * Hvor mange nul-dage der er passeret til og med et tidspunkt. Det er
 * det tal dagnummeret skal skubbes tilbage med.
 *
 * Fremtidige pause-dage taeller ikke. Har hun meldt ferie i naeste uge,
 * skal dagens dagnummer ikke aendre sig foer ferien faktisk er der.
 */
export function passeredeNulDage(datoer: string[], nu: number): number {
	const iDag = datoNoegle(new Date(nu));
	return datoer.filter((d) => d <= iDag).length;
}

/**
 * Dagnummeret rettet for pause. Kropsro-kunden staar stille de dage hun
 * har holdt fri.
 *
 * raat er det kalenderbaserede dagnummer 3.0 allerede regner ud.
 */
export function dagNummerMedNulDage(
	raat: number,
	antalDage: number,
	datoer: string[],
	nu: number
): number {
	const traek = passeredeNulDage(datoer, nu);
	return Math.min(antalDage, Math.max(0, raat - traek));
}

/**
 * Forloebets slut, forlaenget med de pause-dage hun har brugt.
 *
 * Vi forlaenger med ALLE hendes nul-dage, ogsaa dem der ligger i
 * fremtiden. Ellers ville slutdatoen rykke sig under hende hen over
 * ferien, og en kunde der planlaegger frem skal kunne se hvornaar hun
 * er faerdig.
 */
export function forlobSlutMedNulDage(
	startMs: number,
	antalDage: number,
	datoer: string[]
): number {
	if (startMs <= 0 || antalDage <= 0) return 0;
	return startMs + (antalDage + 1 + datoer.length) * MS_PER_DAG;
}

/** Er den her dato en pause-dag. Bruges af datostrimlen. */
export function erNulDag(datoer: Set<string>, noegle: string): boolean {
	return datoer.has(noegle);
}
