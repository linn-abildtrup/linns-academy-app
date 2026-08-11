// Gemmer og fjerner opskrift-billeder. Kun admin kommer her, se reglerne i
// `storage.rules` under /opskrifter/ og i `firestore.rules` under opskrifter.
//
// Filerne uploades FOER dokumentet opdateres. Gaar noget galt midtvejs, staar
// det gamle billede stadig i Firestore og opskriften virker som foer.
//
// De gamle filer slettes til sidst. Ellers samler der sig filer ingen bruger,
// og om et aar toer ingen rydde op fordi ingen ved hvad der er i brug.

import { doc, updateDoc } from 'firebase/firestore';
import { deleteObject, getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import { db, storage } from '$lib/firebase';
import { billedeSti } from '$lib/content/opskriftBillede3';
import type { BilledeSaet } from '$lib/utils/billede3';
import { ryOpskrifter3Cache } from './opskrifter3';
import { ryAlleOpskrifterCache } from './opskrifter';

export interface GemtBillede {
	billedeUrl: string;
	billedeUrlLille: string;
	billedeSti: string;
	billedeStiLille: string;
}

/** Stierne paa de filer der laa der i forvejen, og som skal ryddes bagefter. */
export interface GamleFiler {
	billedeSti?: string | null;
	billedeStiLille?: string | null;
}

async function sletStille(sti: string | null | undefined): Promise<void> {
	if (!sti) return;
	try {
		await deleteObject(ref(storage, sti));
	} catch {
		// Filen er allerede vaek, eller stien er gammel. Det maa aldrig vaelte
		// en upload der ellers lykkedes, for billedet ER skiftet.
	}
}

/**
 * Laegger begge stoerrelser i Storage og peger opskriften paa dem.
 * Rydder de gamle filer op til sidst.
 */
export async function gemBillede(
	opskriftId: string,
	titel: string,
	saet: BilledeSaet,
	gamle: GamleFiler = {}
): Promise<GemtBillede> {
	const stiLille = billedeSti(titel, opskriftId, 'lille', saet.lille.endelse);
	const stiStor = billedeSti(titel, opskriftId, 'stor', saet.stor.endelse);

	// Billederne aendrer sig ikke bag en given sti, saa de maa caches laenge.
	const indstilling = { contentType: '', cacheControl: 'public, max-age=31536000, immutable' };

	const [lille, stor] = await Promise.all([
		uploadBytes(ref(storage, stiLille), saet.lille.blob, {
			...indstilling,
			contentType: saet.lille.mime
		}),
		uploadBytes(ref(storage, stiStor), saet.stor.blob, {
			...indstilling,
			contentType: saet.stor.mime
		})
	]);

	const [urlLille, urlStor] = await Promise.all([
		getDownloadURL(lille.ref),
		getDownloadURL(stor.ref)
	]);

	await updateDoc(doc(db, 'opskrifter', opskriftId), {
		billedeUrl: urlStor,
		billedeUrlLille: urlLille,
		billedeSti: stiStor,
		billedeStiLille: stiLille
	});

	// Kun de gamle filer der IKKE lige er blevet overskrevet. Skifter hun et
	// jpeg ud med et webp, faar den nye fil et andet navn, og det gamle skal
	// vaek. Har filen samme navn, er den allerede erstattet.
	if (gamle.billedeSti && gamle.billedeSti !== stiStor) await sletStille(gamle.billedeSti);
	if (gamle.billedeStiLille && gamle.billedeStiLille !== stiLille) {
		await sletStille(gamle.billedeStiLille);
	}

	ryddCacher();
	return {
		billedeUrl: urlStor,
		billedeUrlLille: urlLille,
		billedeSti: stiStor,
		billedeStiLille: stiLille
	};
}

/** Fjerner billedet helt: felterne nulstilles og filerne slettes. */
export async function fjernBillede(opskriftId: string, gamle: GamleFiler = {}): Promise<void> {
	await updateDoc(doc(db, 'opskrifter', opskriftId), {
		billedeUrl: null,
		billedeUrlLille: null,
		billedeSti: null,
		billedeStiLille: null
	});
	await sletStille(gamle.billedeSti);
	await sletStille(gamle.billedeStiLille);
	ryddCacher();
}

/**
 * Begge apper holder opskrifterne i hukommelsen pr session. Uden det her
 * ville billedet foerst dukke op naar man genindlaeser siden, og saa tror man
 * at uploaden mislykkedes.
 */
function ryddCacher(): void {
	ryOpskrifter3Cache();
	ryAlleOpskrifterCache();
}
