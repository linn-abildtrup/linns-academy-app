// ============================================================
// Symptomer paa Udvikling. Ren logik, ingen database.
//
// DEN REGEL DER STYRER DET HELE, og som Linn satte 18. august:
// en side der goer status maa ALDRIG kunne laeses som en anklage.
//
// Linns valg: S1. Tallet staar som det er, altsaa 0 til 44 hvor 0 er
// bedst, praecis som naar hun udfylder maalingen. Vi vender det IKKE om
// til et "ro"-tal, for saa ville de to sider vise forskellige tal for
// det samme. Til gengaeld er farven og ordene vendt: faerre gener er
// fremgang, og det skal staa med rene ord under kurven.
//
// DET ER OMVENDT AF ALT ANDET PAA SIDEN. Overskuddet er 1 til 10 hvor ti
// er bedst, og en stigende kurve er en sejr. Her er en FALDENDE kurve
// sejren. Roerer du det her, saa husk det.
//
// Blokken hedder "Symptomer". Linns valg 18. august.
// ============================================================

import type { Graenser } from './forside3';
import { formatTal } from './udvikling3';

/**
 * MRS-skalaen. Elleve spoergsmaal a 0 til 4, altsaa 0 til 44 i alt, hvor
 * 0 er bedst. Den staar HER og ikke i forside3, fordi det er symptomernes
 * skala og ikke tegnefladens.
 */
export const GRAENSER_SYMPTOMER: Graenser = { min: 0, max: 44 };

/** Kun det Symptomer skal bruge om én maaling. */
export interface SymptomKilde {
	timestamp: number;
	/** MRS-totalen, 0 til 44. Lavere er bedre. */
	total?: number;
	/** Sand naar udfyldelsen kun har de fem skydere og ingen symptomer. */
	kunSliders?: boolean;
}

export interface SymptomPunkt {
	ms: number;
	vaerdi: number;
}

/**
 * Maalinger der faktisk har svar paa de elleve symptom-spoergsmaal.
 *
 * Udfyldelser der KUN har de fem skydere springes over. De blev flyttet
 * over fra vaner-modulet i sommeren 2026 og har ingen symptom-score, saa
 * de ville laegge sig som nuller i bunden af kurven og ligne en kunde
 * der pludselig var helt rask.
 */
export function symptomKurve(scores: SymptomKilde[]): SymptomPunkt[] {
	return scores
		.filter((s) => !s.kunSliders && typeof s.total === 'number' && Number.isFinite(s.total))
		.slice()
		.sort((a, b) => a.timestamp - b.timestamp)
		.map((s) => ({ ms: s.timestamp, vaerdi: s.total as number }));
}

export interface SymptomOverblik {
	/** Seneste total, 0 til 44. */
	nu: number;
	/** Foerste total. */
	foer: number;
	/** foer minus nu. POSITIV er fremgang, altsaa faerre gener. */
	faerre: number | null;
}

export function symptomOverblik(scores: SymptomKilde[]): SymptomOverblik | null {
	const kurve = symptomKurve(scores);
	if (kurve.length === 0) return null;
	const foer = kurve[0].vaerdi;
	const nu = kurve[kurve.length - 1].vaerdi;
	if (kurve.length === 1) return { nu, foer, faerre: null };
	return { nu, foer, faerre: foer - nu };
}

/**
 * Linjen under kurven.
 *
 * Den skal sige hvad der er godt, for en faldende kurve er sejren her og
 * det modsatte alle andre steder paa siden. Og den maa aldrig bebrejde
 * hende noget: gaar det den forkerte vej, er det kroppen der har haft en
 * haard periode, ikke hende der har gjort noget forkert.
 */
export function symptomTekst(o: SymptomOverblik | null): string {
	if (!o) return '';
	if (o.faerre === null) {
		return 'Det her er dit udgangspunkt. Færre gener er bedre, så kurven skal gerne pege nedad.';
	}
	if (o.faerre > 0) {
		return `Du mærker ${formatTal(o.faerre)} point færre gener end da du startede. Kurven går den rigtige vej.`;
	}
	if (o.faerre === 0) {
		return 'Du ligger på samme sted som da du startede.';
	}
	return 'Din krop har haft en hårdere periode end da du startede. Det svinger for de fleste, og det siger ikke noget om hvor godt du gør det.';
}
