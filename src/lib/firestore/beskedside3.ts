// ============================================================
// Firestore-laget til Beskeder i 3.0.
//
// HELE POINTEN MED DEN HER FIL: den bygger ikke noget nyt. Den kobler
// 3.0 til de to steder der allerede findes, og oversaetter dem til de
// rene former i content/beskedside3.ts.
//
//   users/{uid}/linnAiSamtaler/{id}   samtalen med AI'en
//   klientspoergsmaal/{id}            det hun har sendt videre til Linn
//
// Begge er den GAMLE apps samlinger, og de maa kun laeses og skrives
// gennem de helpers der findes i forvejen. Derfor er der ingen nye
// regler at udgive i Firebase, og derfor ser Linns admin-vaerktoej
// praecis de samme spoergsmaal som foer.
// ============================================================

import { Timestamp } from 'firebase/firestore';
import {
	hentSamtale,
	hentSamtaler,
	opretSamtale,
	tilfojBeskeder,
	opdaterSamtaleTitel
} from '$lib/firestore/linnAi';
import type { AiBesked } from '$lib/content/linnAi';
import {
	fortsaetSamtale3,
	type SamtaleKilde3,
	type SamtaleBesked3,
	type SvarKilde3
} from '$lib/content/beskedside3';
import {
	hentMineSpoergsmaal,
	markerSpoergsmaalLaest,
	type KlientSpoergsmaal
} from '$lib/firestore/spoergsmaal';

/** Hvor mange tegn af det foerste spoergsmaal der bliver samtalens titel. */
const TITEL_LAENGDE = 60;

// ── Samtalen med AI'en ───────────────────────────────────────

function tilSamtaleBesked3(b: AiBesked): SamtaleBesked3 {
	return {
		rolle: b.rolle === 'assistant' ? 'assistant' : 'user',
		indhold: b.indhold,
		// Aeldre beskeder kan mangle tidspunkt. Falder de tilbage paa 0,
		// ville datolinjen sige 1970, saa de faar dagen i dag i stedet.
		ms: b.tidspunkt?.toDate?.().getTime() ?? Date.now()
	};
}

export interface AabenSamtale3 {
	id: string;
	beskeder: SamtaleBesked3[];
	/** Hvor mange aeldre samtaler der ligger bagved. Styrer "Se tidligere". */
	antalTidligere: number;
}

/**
 * Henter den samtale hun skal skrive videre i, og opretter en hvis der
 * ingen er. Den nyeste der ikke er fuld, se fortsaetSamtale3.
 */
export async function aabenSamtale3(uid: string): Promise<AabenSamtale3> {
	const samtaler = await hentSamtaler(uid);
	const kilder: SamtaleKilde3[] = samtaler.map((s) => ({
		id: s.id,
		antalBeskeder: s.beskeder?.length ?? 0,
		opdateretMs: s.opdateretAt?.toDate?.().getTime() ?? 0
	}));

	const fortsaet = fortsaetSamtale3(kilder);
	if (!fortsaet) {
		const id = await opretSamtale(uid, 'Samtale');
		return { id, beskeder: [], antalTidligere: samtaler.length };
	}

	const hel = samtaler.find((s) => s.id === fortsaet.id);
	return {
		id: fortsaet.id,
		beskeder: (hel?.beskeder ?? []).map(tilSamtaleBesked3),
		antalTidligere: samtaler.length - 1
	};
}

/** En aeldre samtale, aabnet fra "Se tidligere samtaler". */
export async function hentTidligereSamtale3(
	uid: string,
	samtaleId: string
): Promise<SamtaleBesked3[]> {
	const s = await hentSamtale(uid, samtaleId);
	return (s?.beskeder ?? []).map(tilSamtaleBesked3);
}

export interface TidligereSamtale3 {
	id: string;
	titel: string;
	opdateretMs: number;
	antalBeskeder: number;
}

/** Listen til "Se tidligere samtaler". Nyeste foerst, den aabne er ikke med. */
export async function tidligereSamtaler3(
	uid: string,
	udenId: string
): Promise<TidligereSamtale3[]> {
	const samtaler = await hentSamtaler(uid);
	return samtaler
		.filter((s) => s.id !== udenId)
		.map((s) => ({
			id: s.id,
			titel: s.titel || 'Samtale',
			opdateretMs: s.opdateretAt?.toDate?.().getTime() ?? 0,
			antalBeskeder: s.beskeder?.length ?? 0
		}));
}

/**
 * Gemmer én udveksling, altsaa hendes spoergsmaal og AI'ens svar.
 *
 * De to skrives sammen og ikke hver for sig. Gik forbindelsen tabt midt
 * imellem, ville samtalen ellers staa med et spoergsmaal uden svar, og
 * naeste gang hun aabnede siden ville det ligne at AI'en ignorerede
 * hende.
 *
 * Er samtalen ny, faar den sit navn af det foerste spoergsmaal, saa
 * listen over tidligere samtaler kan laeses.
 */
export async function gemUdveksling3(
	uid: string,
	samtaleId: string,
	spoergsmaal: string,
	svar: string,
	erFoerste: boolean
): Promise<void> {
	const nu = Timestamp.now();
	await tilfojBeskeder(uid, samtaleId, [
		{ rolle: 'user', indhold: spoergsmaal, tidspunkt: nu },
		{ rolle: 'assistant', indhold: svar, tidspunkt: nu }
	]);
	if (erFoerste) {
		const titel = spoergsmaal.slice(0, TITEL_LAENGDE).trim();
		await opdaterSamtaleTitel(uid, samtaleId, titel || 'Samtale');
	}
}

// ── Det hun har sendt videre til Linn ────────────────────────

/** En traad paa fanen Linn, med det skaermen skal bruge. */
export interface LinnTraad3 {
	id: string;
	spoergsmaal: string;
	svar?: string;
	sendtMs: number;
	besvaretMs?: number;
}

function tilTraad3(q: KlientSpoergsmaal): LinnTraad3 {
	return {
		id: q.id,
		spoergsmaal: q.spoergsmaal,
		svar: q.svar,
		sendtMs: q.oprettet?.toDate?.().getTime() ?? 0,
		besvaretMs: q.besvaretAt?.toDate?.().getTime()
	};
}

/** Alt hun har sendt videre. Nyeste foerst, samme raekkefoelge som foer. */
export async function hentLinnTraade3(uid: string): Promise<LinnTraad3[]> {
	const liste = await hentMineSpoergsmaal(uid);
	return liste.map(tilTraad3);
}

/** Den rene form beskedside3.ts regner paa. */
export function tilSvarKilder3(traade: LinnTraad3[]): SvarKilde3[] {
	return traade.map((t) => ({
		id: t.id,
		spoergsmaal: t.spoergsmaal,
		svar: t.svar,
		besvaretMs: t.besvaretMs
	}));
}

/**
 * Markerer at hun har set svarene.
 *
 * Skriver `senestSpoergsmaalLaestAt` paa hendes bruger, altsaa det
 * SAMME felt som den gamle app bruger. Derfor forsvinder "Nyt svar fra
 * Linn" begge steder paa én gang, og de to flader kan ikke komme til at
 * sige hver sit.
 */
export async function markerLinnSvarLaest3(uid: string): Promise<void> {
	await markerSpoergsmaalLaest(uid);
}
