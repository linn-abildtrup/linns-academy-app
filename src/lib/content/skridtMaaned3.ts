// ============================================================
// Smaa skridt paa Udvikling, maaned mod maaned. Ren logik, ingen
// database.
//
// DEN REGEL DER STYRER DET HELE, og som Linn satte 18. august:
// en side der goer status maa ALDRIG kunne laeses som en anklage.
//
// Faelden her er den vaerste af dem alle. Den gamle side skriver
// "3 af 5" ud for hver eneste dag, altsaa TO NEJ hver dag hun har
// svaret. Det er en daglig paamindelse om det hun ikke naaede.
//
// Derfor taeller vi kun JA'erne, og vi naevner aldrig hvor mange hun
// kunne have sagt ja til. Et snit paa 3,4 ja om dagen er et tal hun kan
// vaere stolt af. "3,4 af 5" er en karakter.
//
// Og som paa mad: gennemsnittet regnes pr dag HUN HAR SVARET. En uge
// hvor hun ikke aabnede appen traekker hende ikke ned.
// ============================================================

import { maanedOverblik, stortNavn, type MaanedOverblik } from './maanedTal3';

export type { Maaned, MaanedOverblik } from './maanedTal3';
export { ANTAL_MAANEDER, soejleBredde, stoersteMaaned } from './maanedTal3';

/** Kun det Smaa skridt skal bruge om én dag. */
export interface SkridtDag {
	/** YYYY-MM-DD. */
	dato: string;
	/** Hvor mange hun sagde ja til den dag. */
	ja: number;
}

/**
 * Traekker antallet af ja ud af en dags svar.
 *
 * Kun de vaner hun selv har valgt taeller med. Har hun fjernet en vane
 * siden, skal et gammelt ja paa den ikke pludselig dukke op.
 */
export function jaPaaDagen(checks: Record<string, string> | undefined, valgte: string[]): number {
	if (!checks) return 0;
	return valgte.filter((id) => checks[id] === 'ja').length;
}

/**
 * Maaned mod maaned. Gennemsnit af ja pr dag hun har svaret.
 *
 * Dage helt uden svar udelades. De betyder at hun ikke aabnede appen,
 * ikke at hun sagde nej til alting.
 */
export function skridtOverblik(dage: SkridtDag[], nu: number): MaanedOverblik | null {
	return maanedOverblik(
		dage.map((d) => ({ dato: d.dato, vaerdi: d.ja })),
		nu,
		'gennemsnit'
	);
}

/** "3,4 små skridt" med dansk komma og rigtigt ental. */
export function skridtTal(v: number): string {
	const tekst = Number.isInteger(v) ? String(v) : String(v).replace('.', ',');
	return `${tekst} ${v === 1 ? 'lille skridt' : 'små skridt'}`;
}

/**
 * Linjen under soejlerne.
 *
 * Naevner ALDRIG hvor mange hun kunne have sagt ja til. Se filens hoved.
 */
export function skridtTekst(o: MaanedOverblik | null): string {
	if (!o) return 'Når du har svaret på dine små skridt, kan du følge det her.';

	if (o.denne.dage === 0) {
		return o.forrige
			? `${stortNavn(o.denne.navn)} er lige begyndt for dig. I ${o.forrige.navn} tog du i snit ${skridtTal(o.forrige.vaerdi)} om dagen.`
			: `${stortNavn(o.denne.navn)} er lige begyndt for dig.`;
	}

	const dage = `${o.denne.dage} ${o.denne.dage === 1 ? 'dag' : 'dage'}`;

	if (o.bedste) {
		return `Det er dit bedste snit indtil nu, ${skridtTal(o.denne.vaerdi)} om dagen.`;
	}

	if (o.forskel !== null && o.forskel > 0 && o.forrige) {
		const mere = Number.isInteger(o.forskel)
			? String(o.forskel)
			: String(o.forskel).replace('.', ',');
		return `Du tager ${mere} flere om dagen end i ${o.forrige.navn}.`;
	}

	// Ingen anklage, og intet "af fem". Hvad hun tog, over hvor mange dage.
	return `Du tager i snit ${skridtTal(o.denne.vaerdi)} om dagen over ${dage}.`;
}
