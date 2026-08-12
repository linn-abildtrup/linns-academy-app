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
import { deleteObject, getDownloadURL, ref as storageRef, uploadBytes } from 'firebase/storage';
import { db, storage } from '$lib/firebase';
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

/**
 * Opretter en ny opskrift med hendes billede.
 *
 * BILLEDET LAEGGES OP FOERST, og dokumentet skrives bagefter. Fejler
 * uploaden, findes der ingen halv opskrift uden billede. Fejler
 * dokumentet, ligger der en foraeldreloes fil i Storage, og det er den
 * billige af de to fejl.
 *
 * Stien er den samme som den gamle app bruger, saa reglerne daekker den
 * i forvejen og der skal intet udgives i Firebase.
 */
export async function opretMinOpskrift3(
	uid: string,
	data: {
		navn: string;
		beskrivelse: string;
		antalPortioner: number;
		ingredienser: MinIngrediens[];
		makroPrPortion: MinMakro;
		kategorier3: Kategori3[];
	},
	billede: Blob | null
): Promise<string> {
	let billedeUrl: string | undefined;
	let billedeSti: string | undefined;

	if (billede) {
		// Tidsstempel plus tilfaeldige tegn, saa to billeder taget i samme
		// sekund ikke kan skrive oven i hinanden.
		const navn = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
		billedeSti = `users/${uid}/opskrift-billeder/${navn}`;
		const filRef = storageRef(storage, billedeSti);
		await uploadBytes(filRef, billede, { contentType: billede.type });
		billedeUrl = await getDownloadURL(filRef);
	}

	// Samme id-form som den gamle app bruger, saa de to ser ens ud.
	const id = `opskrift_${Date.now()}`;
	const nu = serverTimestamp();
	await setDoc(dokument(uid, id), {
		...data,
		...(billedeUrl ? { billedeUrl, billedeSti } : {}),
		oprettet: nu,
		opdateret: nu
	});
	return id;
}

/**
 * Laegger hendes foto af RETTEN paa opskriften, i to stoerrelser.
 *
 * Opskrift-fotoet i `billedeUrl` roeres ikke. Det er kogebogssiden
 * AI'en laeste, og da der ikke gemmes nogen fremgangsmaade er det
 * hendes eneste opskrift paa hvordan retten laves.
 *
 * Filerne laegges op FOER dokumentet opdateres, saa en halv fejl
 * efterlader det gamle billede intakt og opskriften virker som foer.
 * De gamle filer slettes bagefter, og kun hvis de nye ligger et andet
 * sted. Samme raekkefoelge som billed-uploaden i admin, se SPEC 26.7.
 */
export async function saetMadBillede(
	uid: string,
	id: string,
	billeder: { stor: Blob; lille: Blob },
	gamleStier: { stor?: string; lille?: string }
): Promise<{ madBilledeUrl: string; madBilledeUrlLille: string }> {
	const stamme = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
	const stiStor = `users/${uid}/opskrift-billeder/${stamme}_ret`;
	const stiLille = `users/${uid}/opskrift-billeder/${stamme}_ret_lille`;

	const refStor = storageRef(storage, stiStor);
	const refLille = storageRef(storage, stiLille);
	await uploadBytes(refStor, billeder.stor, { contentType: billeder.stor.type });
	await uploadBytes(refLille, billeder.lille, { contentType: billeder.lille.type });
	const madBilledeUrl = await getDownloadURL(refStor);
	const madBilledeUrlLille = await getDownloadURL(refLille);

	await setDoc(
		dokument(uid, id),
		{
			madBilledeUrl,
			madBilledeUrlLille,
			madBilledeSti: stiStor,
			madBilledeStiLille: stiLille,
			opdateret: serverTimestamp()
		},
		{ merge: true }
	);

	// Rydder op efter et tidligere billede af retten. Fejler det, er det
	// en foraeldreloes fil og ikke noget hun maerker, saa vi afbryder ikke.
	for (const gammel of [gamleStier.stor, gamleStier.lille]) {
		if (!gammel || gammel === stiStor || gammel === stiLille) continue;
		try {
			await deleteObject(storageRef(storage, gammel));
		} catch (e) {
			console.warn('[ny] kunne ikke slette det gamle billede', gammel, e);
		}
	}

	return { madBilledeUrl, madBilledeUrlLille };
}
