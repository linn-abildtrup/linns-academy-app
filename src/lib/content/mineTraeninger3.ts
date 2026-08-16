// Kundens egne traeningsprogrammer. Bid 6, 16. august 2026.
//
// Hun bygger et program med flere traeninger, praecis som Linn goer i
// admin, bare paa en telefon. Linns valg 16. august.
//
// HENDES PROGRAM HAR SAMME FORM SOM LINNS. Det er hele pointen: saa
// virker afspilleren, fremgangen og listen uden en eneste ny regel.
// Forskellen er kun hvor det ligger, og at hun ejer det.
//
// ID'ET AFSLOERER KILDEN. Hendes programmer faar id'er der starter med
// "egen_". Saa kan enhver skaerm se paa id'et alene om den skal hente
// fra traeningsprogrammer3 eller fra hendes egen samling, uden at slaa
// op to steder. Uden det ville afspilleren skulle gaette.
//
// TRAENINGERNE LIGGER I SELVE DOKUMENTET og ikke i en undersamling.
// Linns 84-dages programmer skal kunne listes uden at traekke 84
// traeninger med, men hendes egne hentes altid helt, saa ét dokument er
// baade enklere og hurtigere.

import type { TrainingDay } from './mikrotraening';
import {
	dagensMinutter,
	justerAntalDage,
	tomDag3,
	type Traeningsprogram3
} from './traeningsprogram3';

/** Alle egne programmer har id'er der starter med denne. */
export const EGET_PRAEFIKS = 'egen_';

export interface MinTraening3 {
	id: string;
	navn: string;
	/** Traeningerne. Samme form som Linns, saa afspilleren er den samme. */
	dage: TrainingDay[];
	oprettetAt: number;
	opdateretAt: number;
}

export const MAX_EGET_NAVN = 60;

/** Er det her et program kunden selv har bygget. */
export function erEgetProgram3(programId: string): boolean {
	return programId.startsWith(EGET_PRAEFIKS);
}

/** Et nyt id til et eget program. Tilfaeldigheden kommer udefra, saa
 *  funktionen kan testes. */
export function nytEgetId3(tilfaeldig: string): string {
	return `${EGET_PRAEFIKS}${tilfaeldig}`;
}

export function validerMinTraening3(navn: string, antalTraeninger: number): string | null {
	const rent = navn.trim();
	if (!rent) return 'Giv dit program et navn.';
	if (rent.length > MAX_EGET_NAVN) return `Navnet må højst være ${MAX_EGET_NAVN} tegn.`;
	if (!Number.isInteger(antalTraeninger) || antalTraeninger < 1) {
		return 'Der skal være mindst én træning.';
	}
	return null;
}

/**
 * Hendes program i den form resten af 3.0 kender.
 *
 * `egen` er sat, saa listen kan saette maerkatet paa, og saa
 * udstyrs-filteret kan springe den over. Hun har selv valgt oevelserne,
 * saa der er ingen kategori at filtrere paa.
 *
 * `starterForfra` er altid sand. Hendes eget program er noget hun tager
 * igen, ikke noget der slutter.
 */
export function tilProgram3(min: MinTraening3): Traeningsprogram3 {
	return {
		id: min.id,
		navn: min.navn,
		beskrivelse: '',
		kategoriId: '',
		antalDage: min.dage.length,
		starterForfra: true,
		klar: true,
		tommeDage: min.dage.filter((d) => d.exercises.length === 0).length,
		egen: true,
		oprettetAt: min.oprettetAt,
		opdateretAt: min.opdateretAt
	};
}

/** Et nyt, tomt program med det antal traeninger hun bad om. */
export function nytEgetProgram3(
	id: string,
	navn: string,
	antalTraeninger: number,
	nu: number
): MinTraening3 {
	return {
		id,
		navn: navn.trim(),
		dage: justerAntalDage([], Math.max(1, antalTraeninger)),
		oprettetAt: nu,
		opdateretAt: nu
	};
}

/** Laegger én tom traening til sidst. */
export function tilfoejTraening3(dage: TrainingDay[]): TrainingDay[] {
	return [...dage, tomDag3(dage.length + 1)];
}

/**
 * Fjerner én traening og nummererer resten om, saa der ikke bliver
 * huller. Den sidste traening kan ikke fjernes: et program uden
 * traeninger er ikke et program.
 */
export function fjernTraening3(dage: TrainingDay[], nr: number): TrainingDay[] {
	if (dage.length <= 1) return dage;
	return dage
		.filter((d) => d.dagNummer !== nr)
		.map((d, i) => ({ ...d, dagNummer: i + 1 }));
}

/** Anslaaet tid for hele programmet i minutter. */
export function samletMinutter3(dage: TrainingDay[]): number {
	return dage.reduce((sum, d) => sum + dagensMinutter(d), 0);
}

/**
 * Linjen under navnet paa hendes program.
 *
 * Tiden er den ærlige konsekvens af at der ingen graense er paa antal
 * oevelser. Linns valg 16. august: ingen spaerre, men hun skal kunne se
 * hvad hun har bygget.
 */
export function egetProgramTekst3(min: MinTraening3): string {
	const antal = min.dage.length;
	const tomme = min.dage.filter((d) => d.exercises.length === 0).length;
	const dele = [antal === 1 ? '1 træning' : `${antal} træninger`];
	if (tomme === antal) dele.push('ingen øvelser endnu');
	else if (tomme > 0) dele.push(tomme === 1 ? '1 er tom' : `${tomme} er tomme`);
	return dele.join(' · ');
}

/** Traeningerne der er noget at kopiere fra. Den man staar paa er ikke med. */
export function kopiKandidater3(dage: TrainingDay[], nr: number): TrainingDay[] {
	return dage.filter((d) => d.dagNummer !== nr && d.exercises.length > 0);
}
