// ============================================================
// Kundens egne opskrifter mod Firestore. Reglerne ligger i
// content/mineOpskrifter3.ts, den her fil laeser og skriver kun.
//
// VI BLIVER I DEN GAMLE SAMLING users/{uid}/privateOpskrifter, saa en
// opskrift virker begge steder mens kunderne flyttes hold for hold, og
// saa de 222 der findes virker i 3.0 fra dag ét.
//
// Feltet `kategorier3` er nyt og additivt. Den gamle app laeser kun de
// felter den kender og opdager ingenting, og dens egen gemning bruger
// merge, saa den kan ikke komme til at slette feltet igen.
//
// Der skal intet udgives i Firebase: reglerne daekker i forvejen baade
// dokumenterne og billederne i Storage, se firestore.rules og
// storage.rules under /users/{uid}/opskrift-billeder.
// ============================================================

import { collection, deleteDoc, doc, getDocs, serverTimestamp, setDoc } from 'firebase/firestore';
import { db } from '$lib/firebase';
import type { Kategori3 } from '$lib/content/opskriftKategori3';
import type {
	BrugtOpskrift,
	MinIngrediens,
	MinMakro,
	MinOpskrift3
} from '$lib/content/mineOpskrifter3';
import { hentHistorik } from '$lib/firestore/plejer3';

function samling(uid: string) {
	return collection(db, 'users', uid, 'privateOpskrifter');
}

function dokument(uid: string, id: string) {
	return doc(db, 'users', uid, 'privateOpskrifter', id);
}

/** Alle hendes egne opskrifter, nyeste foerst. */
export async function hentMineOpskrifter3(uid: string): Promise<MinOpskrift3[]> {
	const snap = await getDocs(samling(uid));
	return snap.docs
		.map((d) => {
			const data = d.data() as Partial<MinOpskrift3> & { oprettet?: { toMillis?: () => number } };
			return {
				id: d.id,
				navn: (data.navn ?? '').trim(),
				beskrivelse: data.beskrivelse,
				billedeUrl: data.billedeUrl,
				antalPortioner: data.antalPortioner ?? 1,
				ingredienser: data.ingredienser ?? [],
				makroPrPortion: data.makroPrPortion ?? {
					protein: 0,
					fiber: 0,
					kh: 0,
					fedt: 0,
					kcal: 0
				},
				kategorier3: data.kategorier3,
				_ms: data.oprettet?.toMillis?.() ?? 0
			};
		})
		.sort((a, b) => b._ms - a._ms)
		.map(({ _ms, ...rest }) => rest);
}

/**
 * Hendes maaltider, saa maaltidet kan gaettes paa de opskrifter der
 * ingen har faaet endnu.
 *
 * Genbruger plejer3's hentning og dermed dens cache, saa de 45 dage kun
 * hentes én gang pr side.
 */
export async function hentBrugteOpskrifter(uid: string): Promise<BrugtOpskrift[]> {
	const historik = await hentHistorik(uid);
	return historik.map((m) => ({ type: m.type, items: m.items ?? [] }));
}

/**
 * Saetter maaltiderne paa en opskrift. Linns beslutning 12. august:
 * kunden vaelger selv, hun maa gerne vaelge flere, og hun skal kunne
 * rette det bagefter.
 *
 * Merge, saa alt det AI'en har skrevet bliver staaende uroert.
 */
export async function saetKategorier3(
	uid: string,
	id: string,
	kategorier: Kategori3[]
): Promise<void> {
	await setDoc(
		dokument(uid, id),
		{ kategorier3: kategorier, opdateret: serverTimestamp() },
		{ merge: true }
	);
}

export async function sletMinOpskrift3(uid: string, id: string): Promise<void> {
	await deleteDoc(dokument(uid, id));
}

/**
 * Gemmer det hun har rettet. Merge, saa billedet og alt andet vi ikke
 * roerer bliver staaende.
 *
 * Kulhydrat, fedt og kalorier gemmes ALTID, ogsaa naar hun ikke maa se
 * dem og derfor ikke har kunnet rette dem. Ellers ville tallene falde
 * bort den dag Linn giver et hold adgang til udvidet naering. Se
 * SPEC-3.0.md 26.5.
 */
export async function gemMinOpskrift3(
	uid: string,
	id: string,
	data: {
		navn: string;
		beskrivelse: string;
		antalPortioner: number;
		ingredienser: MinIngrediens[];
		makroPrPortion: MinMakro;
	}
): Promise<void> {
	await setDoc(dokument(uid, id), { ...data, opdateret: serverTimestamp() }, { merge: true });
}
