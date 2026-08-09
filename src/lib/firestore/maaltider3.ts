// ============================================================
// Laesning til 30-30 beregneren i 3.0.
//
// Maaltiderne ligger praecis hvor de altid har ligget, i
// users/{uid}/maaltider. Vi laeser dem, vi flytter ingenting, og den
// gamle app bliver ved med at virke uaendret.
//
// Bemaerk stien: det er maaltider under brugeren direkte. Og de gamle
// dokumenter har ikke noget tidsstempel, saa "nyeste oeverst" falder
// tilbage paa dokumentets id naar tidspunktet mangler. Se hentDagen.
// ============================================================

import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '$lib/firebase';
import type { GemtMaaltid, Maaltidstype } from '$lib/content/kost';
import { opgoerDag, type DagsOpgoerelse, type MaaltidKilde } from '$lib/content/maaltider3';
import { tilladteMaaltiderForDag } from '$lib/content/maaltidsFokus';
import type { MaaltidsFokusPeriode } from '$lib/content/maaltidsFokus';
import type { UserDoc } from '$lib/types';

/** Alle maaltider paa en dato. Kun laesning. */
export async function hentMaaltider(uid: string, dato: string): Promise<GemtMaaltid[]> {
	const snap = await getDocs(
		query(collection(db, 'users', uid, 'maaltider'), where('dato', '==', dato))
	);
	return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as GemtMaaltid);
}

/**
 * Hele dagen, klar til oversigten.
 *
 * `fokus` er Linns maaltids-fokus paa forloebet, og `dagNummer` er den
 * dag kunden er paa. Er der ikke sat fokus, vises alle fire maaltider.
 */
export async function hentDagen(
	uid: string,
	dato: string,
	userDoc: UserDoc | null,
	fokus?: { perioder: MaaltidsFokusPeriode[] | null | undefined; dagNummer: number | null }
): Promise<DagsOpgoerelse> {
	const raa = await hentMaaltider(uid, dato);

	const kilder: MaaltidKilde[] = raa.map((m) => ({
		id: m.id,
		navn: m.navn ?? '',
		type: m.type,
		totalP: m.totalP,
		totalF: m.totalF,
		opdateretMs: tidspunktFor(m)
	}));

	const tilladte =
		fokus && fokus.dagNummer !== null
			? tilladteMaaltiderForDag(fokus.perioder, fokus.dagNummer)
			: null;

	return opgoerDag(kilder, {
		proteinMaal: userDoc?.dagligeMaal?.protein,
		fiberMaal: userDoc?.dagligeMaal?.fiber,
		tilladte
	});
}

/**
 * Hvornaar maaltidet blev gemt, saa nyeste kan staa oeverst.
 *
 * De gamle dokumenter har intet tidsstempel. Firestores auto-id'er er
 * ikke tidssorterede, saa vi kan ikke udlede noget af dem. Mangler
 * tidspunktet, giver vi 0, og saa falder posten bagerst i stedet for at
 * hoppe tilfaeldigt rundt. Nye maaltider skrevet af 3.0 faar et rigtigt
 * tidsstempel, og saa virker det som det skal fremover.
 */
function tidspunktFor(m: GemtMaaltid & { opdateret?: unknown; oprettet?: unknown }): number {
	for (const felt of [m.opdateret, m.oprettet]) {
		const ms = (felt as { toMillis?: () => number } | undefined)?.toMillis?.();
		if (typeof ms === 'number' && ms > 0) return ms;
	}
	return 0;
}

/** Maaltiderne i én bestemt plads, til maaltidsskaermen. */
export async function hentMaaltidsPlads(
	uid: string,
	dato: string,
	type: Maaltidstype
): Promise<GemtMaaltid[]> {
	const alle = await hentMaaltider(uid, dato);
	return alle
		.filter((m) => m.type === type)
		.sort((a, b) => tidspunktFor(b) - tidspunktFor(a));
}
