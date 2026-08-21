// ============================================================
// Maerkerne paa oevelserne, gemt ét sted.
//
// ÉT DOKUMENT OG IKKE ÉT PR OEVELSE. Der er 62 oevelser, og kortet
// laeses altid som helhed. Ét dokument er én laesning i stedet for 62,
// og der er ingen situation hvor vi kun skal bruge maerkerne paa én.
//
// VI SKRIVER IKKE PAA exercises. Den samling bruges af den GAMLE app, og
// den maa ikke roeres. Se regel 2 i CLAUDE.md. Maerkerne ligger derfor
// for sig selv, praecis som ingrediens-koblingerne goer for opskrifter.
//
// KUN ADMIN SKRIVER. Kunden laeser, for at kunne bede om hensyn.
// ============================================================

import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '$lib/firebase';
import { erGyldigtHensyn3, type HensynKort3 } from '$lib/content/oevelseHensyn3';

const STI = 'oevelseHensyn3/aktiv';

/**
 * Alle maerker. Tomt kort hvis Linn ikke har sat nogen endnu.
 *
 * Kaster aldrig. Uden maerker kommer alle oevelser med, se
 * filtrerPaaHensyn3, og det er den rigtige opfoersel: hellere en oevelse
 * for meget end et program der pludselig er tomt.
 */
export async function hentHensyn3(): Promise<HensynKort3> {
	try {
		const snap = await getDoc(doc(db, STI));
		if (!snap.exists()) return {};
		const raa = (snap.data()?.maerker ?? {}) as Record<string, unknown>;
		const ud: HensynKort3 = {};
		for (const [id, vaerdi] of Object.entries(raa)) {
			if (!Array.isArray(vaerdi)) continue;
			ud[id] = vaerdi.filter((v): v is string => typeof v === 'string' && erGyldigtHensyn3(v));
		}
		return ud;
	} catch (e) {
		console.warn('[ny] kunne ikke hente oevelsernes maerker', e);
		return {};
	}
}

/** Gemmer hele kortet. Kun admin. */
export async function gemHensyn3(kort: HensynKort3, adminUid: string): Promise<void> {
	await setDoc(
		doc(db, STI),
		{ maerker: kort, opdateretAt: Date.now(), opdateretAf: adminUid },
		{ merge: true }
	);
}
