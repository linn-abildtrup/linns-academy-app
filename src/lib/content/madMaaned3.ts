// ============================================================
// Mad paa Udvikling, maaned mod maaned. Ren logik, ingen database.
//
// VI TAELLER DAGE HVOR HUN SPISTE EFTER 30-30, ikke et gennemsnit.
// Linns valg 18. august, og det er en bedre maalestok end den jeg havde:
// "86,6 g protein i snit" er et tal ingen kunde taenker i. Metoden er
// 30 g protein pr maaltid og 30 g fiber over dagen, og DET er det hun
// goer noget ved.
//
// EN 30-30-DAG ER:
//   mindst 90 g protein over hele dagen
//   OG mindst 30 g fiber over hele dagen
//
// De 90 er tre gange de 30 fra metoden, men vi maaler dem SAMLET og
// ikke pr maaltid. Linns aendring 18. august, og den var rigtig: vi
// maalte foer om hvert enkelt maaltid ramte sine 30, og det gjorde
// naesten ingen dage. Nu taeller det ogsaa hvis hun tog det meste til
// aftensmad, eller hentede det sidste i en snack.
//
// Snacken taeller derfor med i BEGGE tal nu. Foer taalte den kun i
// fiberen, fordi den ikke har sit eget protein-maal.
//
// DEN REGEL DER STYRER DET HELE, og som Linn satte 18. august:
// en side der goer status maa ALDRIG kunne laeses som en anklage.
// Der staar derfor "9 dage", aldrig "9 af 18 dage". Vi taeller sejre.
// ============================================================

import { PROTEIN_MAALTIDS_MAAL } from './kost';
import { FIBER_DAGS_MAAL } from './maaltider3';
import { maanedOverblik, stortNavn, type DagPunkt, type MaanedOverblik } from './maanedTal3';

export type { Maaned, MaanedOverblik } from './maanedTal3';
export { ANTAL_MAANEDER, soejleBredde, stoersteMaaned } from './maanedTal3';

/**
 * Dagens protein-maal i metoden: tre maaltider a 30 g.
 *
 * Det er skrevet som et regnestykke og ikke som 90, saa det er tydeligt
 * hvor tallet kommer fra. Aendrer de 30 sig, foelger det her med.
 */
export const METODE_PROTEIN_DAG = 3 * PROTEIN_MAALTIDS_MAAL;

/** Kun det Mad skal bruge om ét gemt maaltid. */
export interface MaaltidKilde {
	/** YYYY-MM-DD. */
	dato: string;
	/** morgenmad, frokost, aftensmad eller snack. */
	type: string;
	/** Protein i gram. */
	totalP?: number;
	/** Fiber i gram. */
	totalF?: number;
}

/** Én dags samlede tal, som metoden maales paa. */
export interface Dagstal {
	dato: string;
	/** Protein for hele dagen. Snacken taeller med. */
	protein: number;
	/** Fiber for hele dagen. Snacken taeller med. */
	fiber: number;
}

/** Laegger dagens maaltider sammen. Alle typer taeller, ogsaa snack. */
export function samlDage(maaltider: MaaltidKilde[]): Dagstal[] {
	const prDag = new Map<string, Dagstal>();
	for (const m of maaltider) {
		const d = prDag.get(m.dato) ?? { dato: m.dato, protein: 0, fiber: 0 };
		d.protein += m.totalP ?? 0;
		d.fiber += m.totalF ?? 0;
		prDag.set(m.dato, d);
	}
	return [...prDag.values()].sort((a, b) => a.dato.localeCompare(b.dato));
}

/**
 * Spiste hun efter 30-30 den dag.
 *
 * 90 g protein og 30 g fiber over HELE dagen. Det er ligegyldigt hvordan
 * det var fordelt. Linns aendring 18. august.
 */
export function erTredveTredve(dag: Dagstal): boolean {
	return dag.protein >= METODE_PROTEIN_DAG && dag.fiber >= FIBER_DAGS_MAAL;
}

/** Hvad der manglede den dag. Tom naar dagen var i maal. */
export function hvadManglede(dag: Dagstal): string[] {
	const ud: string[] = [];
	if (dag.protein < METODE_PROTEIN_DAG) ud.push('protein');
	if (dag.fiber < FIBER_DAGS_MAAL) ud.push('fiber');
	return ud;
}

export interface MadOverblik extends MaanedOverblik {
	/** Hvor mange dage hun overhovedet har registreret mad denne maaned. */
	registrerede: number;
}

/**
 * Maaned mod maaned paa antal 30-30-dage.
 *
 * Der laegges SAMMEN og ikke tages snit: ni gode dage er ni gode dage.
 */
export function madOverblik(maaltider: MaaltidKilde[], nu: number): MadOverblik | null {
	const dage = samlDage(maaltider);
	if (dage.length === 0) return null;

	const punkter: DagPunkt[] = dage.filter(erTredveTredve).map((d) => ({ dato: d.dato, vaerdi: 1 }));

	// Har hun registreret mad, men ingen dag naaede metoden, skal kortet
	// stadig staa der og sige det roligt. Derfor et punkt med nul.
	const o = maanedOverblik(
		punkter.length > 0 ? punkter : dage.map((d) => ({ dato: d.dato, vaerdi: 0 })),
		nu,
		'sum'
	);
	if (!o) return null;

	const maaned = o.denne.noegle;
	const registrerede = dage.filter((d) => d.dato.slice(0, 7) === maaned).length;
	return { ...o, registrerede };
}

/**
 * Linjen under soejlerne.
 *
 * Aldrig "9 af 18". Vi taeller sejre, og naevner hvor mange dage hun har
 * registreret som en oplysning, ikke som en naevner.
 */
export function madTekst(o: MadOverblik | null): string {
	if (!o) return 'Når du har registreret din mad, kan du følge det her.';

	if (o.registrerede === 0) {
		return o.forrige
			? `${stortNavn(o.denne.navn)} er lige begyndt for dig. I ${o.forrige.navn} spiste du efter 30-30 ${dagOrd(o.forrige.vaerdi)}.`
			: `${stortNavn(o.denne.navn)} er lige begyndt for dig.`;
	}

	// Hvor mange dage hun har registreret staar i sin egen linje under
	// kortet. Den maa ikke ogsaa staa her, ellers staar det samme to
	// gange lige efter hinanden. Set 18. august.
	if (o.denne.vaerdi === 0) {
		return `${METODE_PROTEIN_DAG} g protein og ${FIBER_DAGS_MAAL} g fiber på en dag er et stykke arbejde. Det kommer.`;
	}

	if (o.bedste) {
		return `Det er dine fleste 30-30-dage indtil nu. ${stortNavn(dagOrd(o.denne.vaerdi))} i ${o.denne.navn}.`;
	}

	if (o.forskel !== null && o.forskel > 0 && o.forrigeSammeTid) {
		return `Du har ${dagOrd(o.denne.vaerdi)} efter 30-30 i ${o.denne.navn}. Det er ${o.forskel} mere end på samme tid i ${o.forrigeSammeTid.navn}.`;
	}

	return `Du har spist efter 30-30 ${dagOrd(o.denne.vaerdi)} i ${o.denne.navn}.`;
}

/** "9 dage" eller "1 dag". */
export function dagOrd(antal: number): string {
	return `${antal} ${antal === 1 ? 'dag' : 'dage'}`;
}
