// ============================================================
// 30-30 beregneren i 3.0.
//
// Metoden er 30 g protein pr maaltid og 30 g fiber over dagen. Den her
// fil samler dagens maaltider til det oversigten og maaltidsskaermen
// skal bruge. Ingen Firestore, kun regnestykker, saa den kan testes.
//
// TRE TING DER ER BESLUTTET, OG SOM IKKE MAA LAVES OM I FARTEN:
//
// 1. Snack har INTET maal. Der staar aldrig "mangler" paa en snack, og
//    den har ingen stribe. Den viser kun hvad den bidrog med. Men den
//    taeller med i BEGGE dagstal, baade protein og fiber. Ellers ville
//    hendes snack forsvinde ud af regnestykket for oejnene af hende.
//
// 2. Fiber har intet maal PR MAALTID, kun for dagen. En stribe paa
//    maaltidet ville love noget der ikke findes.
//
// 3. Maaltidet foldes sammen til én linje, uanset hvor meget der er i
//    det. Maalt 9. august 2026: 60 % af registreringerne er én enkelt
//    madvare, og medianen er 13 madvarer paa en dag. Uden sammenfoldning
//    ville oversigten vaere flere skaermlaengder lang.
// ============================================================

import { MAALTIDSTYPER, PROTEIN_MAALTIDS_MAAL, type Maaltidstype } from './kost';

/** Standard dagsmaal naar kunden ikke har sit eget. Se project-memoen: 90 aendres ikke. */
export const PROTEIN_DAGS_MAAL = 90;
export const FIBER_DAGS_MAAL = 30;

/** Snack har intet maal. Se punkt 1 i toppen. */
export function harProteinMaal(type: Maaltidstype): boolean {
	return type !== 'snack';
}

/** Det mindste vi skal bruge om et gemt maaltid. */
export interface MaaltidKilde {
	id: string;
	navn: string;
	type: Maaltidstype;
	totalP?: number;
	totalF?: number;
	/** Hvornaar det blev gemt. Bruges til at saette nyeste oeverst. */
	opdateretMs?: number;
}

export interface MaaltidsPlads {
	type: Maaltidstype;
	label: string;
	/** Det hun har lagt i, nyeste foerst. */
	poster: MaaltidKilde[];
	protein: number;
	fiber: number;
	/** Null for snack. Se punkt 1. */
	maal: number | null;
	/** 0 til 100. Null for snack, som ikke har nogen stribe. */
	procent: number | null;
	/** Hvor meget der mangler til de 30. Null naar der ikke er et maal, eller naar hun er i maal. */
	mangler: number | null;
	/** Sammenfoldet linje, fx "Skyr, havregryn og 2 mere". Tom naar pladsen er tom. */
	resume: string;
}

export interface DagsOpgoerelse {
	pladser: MaaltidsPlads[];
	proteinIAlt: number;
	fiberIAlt: number;
	proteinMaal: number;
	fiberMaal: number;
	/** Antal madvarer paa hele dagen. */
	antalPoster: number;
}

export const LABELS: Record<Maaltidstype, string> = {
	morgenmad: 'Morgenmad',
	frokost: 'Frokost',
	aftensmad: 'Aftensmad',
	snack: 'Snack'
};

/**
 * Den sammenfoldede linje. To navne og saa "og N mere".
 *
 * Vi presser bevidst IKKE saa mange navne ind som muligt. To navne plus
 * et tal er til at laese paa en telefon, seks afkortede navne er ikke.
 */
export function resumeAf(poster: { navn: string }[]): string {
	const navne = poster.map((p) => (p.navn ?? '').trim()).filter(Boolean);
	if (navne.length === 0) return '';
	if (navne.length === 1) return navne[0];
	if (navne.length === 2) return `${navne[0]} og ${navne[1]}`;
	return `${navne[0]}, ${navne[1]} og ${navne.length - 2} mere`;
}

/**
 * Bygger de fire pladser og dagens to tal.
 *
 * `tilladte` er maaltids-fokus: har Linn begraenset forloebet til
 * bestemte maaltider, vises kun dem. Null betyder alle fire.
 * Dagstallene taeller ALTID alt med, ogsaa maaltider fra en type der er
 * skjult. Ellers ville hendes tal se forkerte ud uden grund.
 */
export function opgoerDag(
	maaltider: MaaltidKilde[],
	opts: {
		proteinMaal?: number;
		fiberMaal?: number;
		tilladte?: Maaltidstype[] | null;
	} = {}
): DagsOpgoerelse {
	const proteinMaal = opts.proteinMaal && opts.proteinMaal > 0 ? opts.proteinMaal : PROTEIN_DAGS_MAAL;
	const fiberMaal = opts.fiberMaal && opts.fiberMaal > 0 ? opts.fiberMaal : FIBER_DAGS_MAAL;
	const synlige = opts.tilladte && opts.tilladte.length > 0 ? opts.tilladte : MAALTIDSTYPER;

	const pladser: MaaltidsPlads[] = synlige.map((type) => {
		const poster = maaltider
			.filter((m) => m.type === type)
			// Nyeste oeverst. Naar hun tilfoejer flere ting i traek, skal hun
			// kunne se at det hun lige trykkede faktisk landede.
			.sort((a, b) => (b.opdateretMs ?? 0) - (a.opdateretMs ?? 0));

		const protein = rund(poster.reduce((s, m) => s + (m.totalP ?? 0), 0));
		const fiber = rund(poster.reduce((s, m) => s + (m.totalF ?? 0), 0));
		const harMaal = harProteinMaal(type);
		const mangler = harMaal ? Math.max(0, PROTEIN_MAALTIDS_MAAL - protein) : 0;

		return {
			type,
			label: LABELS[type],
			poster,
			protein,
			fiber,
			maal: harMaal ? PROTEIN_MAALTIDS_MAAL : null,
			procent: harMaal ? Math.min(100, Math.round((protein / PROTEIN_MAALTIDS_MAAL) * 100)) : null,
			mangler: harMaal && mangler > 0 ? mangler : null,
			resume: resumeAf(poster)
		};
	});

	return {
		pladser,
		proteinIAlt: rund(maaltider.reduce((s, m) => s + (m.totalP ?? 0), 0)),
		fiberIAlt: rund(maaltider.reduce((s, m) => s + (m.totalF ?? 0), 0)),
		proteinMaal,
		fiberMaal,
		antalPoster: maaltider.length
	};
}

/** Hele gram. Kunden skal ikke se 23,4 g protein. */
function rund(n: number): number {
	return Math.round(n);
}

/** Teksten i hoejre side af en flise paa oversigten. */
export function pladsTal(p: MaaltidsPlads): string {
	if (p.maal === null) return `${p.protein} g`;
	if (p.poster.length === 0) return `mangler ${p.maal} g`;
	return `${p.protein} g`;
}

/** Linjen under navnet naar pladsen er tom. */
export const TOM_TEKST = 'Ikke noget endnu';
