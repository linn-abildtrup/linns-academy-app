// ============================================================
// Laegger en fil fra en personlig besked i Storage.
//
// Kun admin kommer her. Reglerne i storage.rules under /beskeder/{uid}/
// siger at kun Linn maa skrive, og at kun Linn og den kunde stien peger
// paa maa laese.
//
// FILEN LAEGGES FOER beskeden skrives. Gaar noget galt undervejs, er der
// ingen besked hos kunden der peger paa en fil der ikke kom frem. En
// ubrugt fil i lageret er til at leve med, en tom besked er ikke.
//
// Bygget 1. september 2026.
// ============================================================

import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import { storage } from '$lib/firebase';
import { beskedFilSti, lydEndelseFor } from '$lib/content/beskedFil3';
import { laesBillede, skalerTil } from '$lib/utils/billede3';

export interface LagtOp {
	url: string;
	bytes: number;
}

export interface LagtOpBillede extends LagtOp {
	bredde: number;
	hoejde: number;
	/** Hvad filen fyldte foer den blev skrumpet. Staar paa skaermen. */
	kildeBytes: number;
}

/**
 * Skrumper billedet i browseren og laegger det i kundens mappe.
 *
 * KUN ÉN STOERRELSE. Opskrifterne har to, fordi de vises baade som en
 * lille flise og i fuld bredde. Et billede i en besked vises ét sted, og
 * den store udgave er den samme fil hun aabner i fuld skaerm.
 */
export async function gemBeskedBillede(uid: string, fil: File): Promise<LagtOpBillede> {
	if (!uid) throw new Error('gemBeskedBillede: uid er paakraevet');
	if (!fil.type.startsWith('image/')) throw new Error('Filen skal vaere et billede.');

	const img = await laesBillede(fil);
	const skaleret = await skalerTil(img, 'stor');
	const sti = beskedFilSti(uid, 'billede', skaleret.endelse);

	await uploadBytes(ref(storage, sti), skaleret.blob, {
		contentType: skaleret.mime,
		// Filen aendrer sig aldrig bag sin adresse, saa telefonen maa gemme
		// den saa laenge den vil.
		cacheControl: 'public, max-age=31536000, immutable'
	});

	return {
		url: await getDownloadURL(ref(storage, sti)),
		bytes: skaleret.blob.size,
		bredde: skaleret.bredde,
		hoejde: skaleret.hoejde,
		kildeBytes: fil.size
	};
}

/**
 * Laegger en lydbesked i kundens mappe.
 *
 * Lyden laves IKKE om undervejs. Fem minutters tale fra en browser
 * fylder omkring 3 MB, og det er ikke vaerd at bygge en omkodning for.
 */
export async function gemBeskedLyd(uid: string, blob: Blob): Promise<LagtOp> {
	if (!uid) throw new Error('gemBeskedLyd: uid er paakraevet');
	if (!blob.size) throw new Error('Optagelsen er tom.');

	const mime = blob.type || 'audio/webm';
	const sti = beskedFilSti(uid, 'lyd', lydEndelseFor(mime));

	await uploadBytes(ref(storage, sti), blob, {
		contentType: mime,
		cacheControl: 'public, max-age=31536000, immutable'
	});

	return { url: await getDownloadURL(ref(storage, sti)), bytes: blob.size };
}
