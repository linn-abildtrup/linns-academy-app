// ============================================================
// Beskeder til flere paa én gang.
//
// HVEM DER OVERHOVEDET KAN NAAS. Vi starter ikke med kundelisten, men
// med TELEFONERNE: kun dem der har sagt ja har en, og de er faa. En
// gennemgang af alle 760 kunder for at finde de faa der kan naas ville
// vaere spild, og den ville vokse med kundetallet.
//
// ALT DET SVAERE LIGGER STADIG I sendTilKunde3: om hun er paa 3.0, om
// hun har slaaet den slags fra, og karantaenen. Her er kun listen.
//
// DEN GIVER ALDRIG OP UNDERVEJS. Fejler én telefon, fortsaetter vi til
// den naeste. En enkelt doed adresse maa ikke standse en morgen.
//
// Bygget 23. august 2026, se HANDOVER 9.45.
// ============================================================

import { hentCollectionGroupAlle, hentDoc } from './firestoreRest';
import { sendTilKunde3, type SendUdfald3, type SendValg3 } from './notiSend';
import type { PushNoegler } from './webPush';
import type { Noti3 } from '$lib/content/notifikation3';

/** Alle der har mindst én levende telefon. */
export async function medTelefon3(): Promise<string[]> {
	const alle = await hentCollectionGroupAlle('pushTelefon3', 'users');
	const uids = new Set<string>();
	for (const t of alle) {
		if (t.data.doed === true) continue;
		if (t.parentId) uids.add(t.parentId);
	}
	return [...uids];
}

export interface HoldUdfald3 {
	forsoegt: number;
	sendt: number;
	/** Hvor mange der IKKE fik noget, og hvorfor. Til admin-kvitteringen. */
	sprunget: Record<string, number>;
}

/**
 * Sender til en liste af kunder.
 *
 * `byg` faar bruger-dokumentet og bestemmer hvad hun skal have, eller
 * null hvis hun ikke skal have noget. Det er der morgen-beskeden
 * afgoer om der overhovedet er noget nyt til hende i dag.
 */
export async function sendTilFlere3(
	uids: string[],
	byg: (uid: string, bruger: Record<string, unknown>) => Promise<Noti3 | null> | Noti3 | null,
	noegler: PushNoegler,
	valg: SendValg3 = {}
): Promise<HoldUdfald3> {
	const ud: HoldUdfald3 = { forsoegt: 0, sendt: 0, sprunget: {} };

	for (const uid of uids) {
		try {
			const bruger = await hentDoc(`users/${uid}`);
			if (!bruger) continue;
			const besked = await byg(uid, bruger);
			if (!besked) {
				ud.sprunget['intet-nyt'] = (ud.sprunget['intet-nyt'] ?? 0) + 1;
				continue;
			}
			ud.forsoegt += 1;
			const r: SendUdfald3 = await sendTilKunde3(uid, besked, noegler, valg);
			if (r.sendt > 0) ud.sendt += 1;
			else if (r.sprunget) ud.sprunget[r.sprunget] = (ud.sprunget[r.sprunget] ?? 0) + 1;
		} catch (e) {
			// Én kunde maa ikke vaelte resten af holdet.
			console.error('[noti] sprang en kunde over', uid, e);
			ud.sprunget['fejl'] = (ud.sprunget['fejl'] ?? 0) + 1;
		}
	}

	return ud;
}

/** Er hun paa det her forloeb lige nu. Laeses af begge udsendelser. */
export function paaForlob3(bruger: Record<string, unknown>, forlobId: string): boolean {
	const ids = bruger.forlobIds;
	return Array.isArray(ids) && ids.map(String).includes(forlobId);
}

/** Har hun slet ingen forloeb, altsaa er hun medlem. */
export function erMedlem3(bruger: Record<string, unknown>): boolean {
	const ids = bruger.forlobIds;
	return !Array.isArray(ids) || ids.length === 0;
}
