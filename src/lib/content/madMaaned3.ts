// ============================================================
// Mad paa Udvikling, maaned mod maaned. Ren logik, ingen database.
//
// DEN REGEL DER STYRER DET HELE, og som Linn satte 18. august:
// en side der goer status maa ALDRIG kunne laeses som en anklage.
//
// Her er faelden en anden end paa traening. Den gamle side tegner en
// tom soejle for hver dag hun ikke fik tastet. Hun SPISTE jo, hun skrev
// det bare ikke ned, og en tom soejle laeser som om hun ikke spiste.
//
// Derfor: gennemsnittet regnes pr DAG HUN HAR REGISTRERET, ikke pr dag
// i maaneden. En uge uden madregistrering traekker hende ikke ned.
//
// Maalet paa 105 g protein staar med som en rolig linje, aldrig som en
// karakter. Der staar aldrig "du ramte det ikke".
// ============================================================

import { maanedOverblik, stortNavn, type DagPunkt, type MaanedOverblik } from './maanedTal3';

export type { Maaned, MaanedOverblik } from './maanedTal3';
export { ANTAL_MAANEDER, soejleBredde, stoersteMaaned } from './maanedTal3';

/** Kun det Mad skal bruge om ét gemt maaltid. */
export interface MaaltidKilde {
	/** YYYY-MM-DD. */
	dato: string;
	/** Protein i gram. */
	totalP?: number;
	/** Fiber i gram. */
	totalF?: number;
}

export interface MadOverblik {
	protein: MaanedOverblik;
	/** Fiber. null naar hun aldrig har registreret fiber. */
	fiber: MaanedOverblik | null;
}

function punkterFor(maaltider: MaaltidKilde[], felt: 'totalP' | 'totalF'): DagPunkt[] {
	return maaltider
		.filter((m) => typeof m[felt] === 'number' && Number.isFinite(m[felt]))
		.map((m) => ({ dato: m.dato, vaerdi: m[felt] as number }));
}

/**
 * Maaned mod maaned paa protein og fiber.
 *
 * Der regnes GENNEMSNIT og ikke sum. En maaned hvor hun har tastet ti
 * dage skal kunne sammenlignes med en hvor hun tastede tredive.
 */
export function madOverblik(maaltider: MaaltidKilde[], nu: number): MadOverblik | null {
	const protein = maanedOverblik(punkterFor(maaltider, 'totalP'), nu, 'gennemsnit');
	if (!protein) return null;
	return {
		protein,
		fiber: maanedOverblik(punkterFor(maaltider, 'totalF'), nu, 'gennemsnit')
	};
}

/**
 * Linjen under soejlerne.
 *
 * Aldrig et maal at ramme ved siden af. Naar maalet naevnes, er det som
 * en oplysning og ikke som en dom.
 */
export function madTekst(o: MaanedOverblik | null, maal: number): string {
	if (!o) return 'Når du har registreret din mad, kan du følge det her.';

	if (o.denne.dage === 0) {
		return o.forrige
			? `${stortNavn(o.denne.navn)} er lige begyndt for dig. I ${o.forrige.navn} fik du i snit ${o.forrige.vaerdi} g protein om dagen.`
			: `${stortNavn(o.denne.navn)} er lige begyndt for dig.`;
	}

	const dage = `${o.denne.dage} ${o.denne.dage === 1 ? 'dag' : 'dage'}`;

	if (o.bedste) {
		return `Det er dit bedste snit indtil nu, ${o.denne.vaerdi} g om dagen over ${dage}.`;
	}

	if (o.forskel !== null && o.forskel > 0 && o.forrige) {
		return `Du får i snit ${o.forskel} g mere protein om dagen end i ${o.forrige.navn}.`;
	}

	if (o.denne.vaerdi >= maal) {
		return `Du får i snit ${o.denne.vaerdi} g protein om dagen. Det er over dine ${maal} g.`;
	}

	// Ingen anklage. Hvad hun faar, og hvor mange dage det bygger paa.
	return `Du får i snit ${o.denne.vaerdi} g protein om dagen over ${dage}.`;
}

/** Den lille linje om fiber. Tom naar der ikke er noget at sige. */
export function fiberTekst(o: MaanedOverblik | null): string {
	if (!o || o.denne.dage === 0) return '';
	if (o.forskel !== null && o.forskel > 0 && o.forrige) {
		return `Fiber: ${o.denne.vaerdi} g om dagen, ${o.forskel} g mere end i ${o.forrige.navn}.`;
	}
	return `Fiber: ${o.denne.vaerdi} g om dagen.`;
}
