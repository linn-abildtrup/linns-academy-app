// ============================================================
// Sender ÉN besked til én telefon. Kun admin, plus proeven.
//
// Reglerne bag ligger i server/notiSend.ts, samme sted som det
// endpoint der skriver en besked til en kunde bruger. Laa de to hver
// sit sted, ville "kun 3.0" og karantaenen drive fra hinanden.
//
// TO SLAGS KALDERE:
//  - Linn maa sende til hvem som helst
//  - Kunden maa sende PROEVEN til sig selv, i opstarten. Uden den kunne
//    hun ikke afproeve noget, og saa opdager vi foerst at noget er galt
//    den dag et rigtigt svar aldrig kom frem
//
// Se HANDOVER 9.39.
// ============================================================

import type { RequestHandler } from '@sveltejs/kit';
import { json, error } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import { PUBLIC_FIREBASE_API_KEY } from '$env/static/public';
import { mailOpsaetning3 } from '$lib/server/sendMail';
import { hvemErDet3, noeglerFra3, sendTilKunde3, PROEVE3 } from '$lib/server/notiSend';
import type { Noti3 } from '$lib/content/notifikation3';

interface Krop {
	uid: string;
	besked: Noti3;
	/** Spring karantaenen over. Kun naar Linn selv trykker send. */
	tvang?: boolean;
}

export const POST: RequestHandler = async ({ request }) => {
	const auth = request.headers.get('Authorization');
	if (!auth?.startsWith('Bearer ')) throw error(401, 'Manglende Bearer-token');
	const kalder = await hvemErDet3(auth.slice(7), PUBLIC_FIREBASE_API_KEY);
	if (!kalder) throw error(403, 'Kunne ikke genkende dig');

	const noegler = noeglerFra3(env);
	if (!noegler) throw error(500, 'Noeglerne til beskeder mangler i miljoeet. Se HANDOVER 9.39.');

	const krop = (await request.json().catch(() => null)) as Krop | null;
	if (!krop?.uid || !krop.besked?.titel) throw error(400, 'Mangler uid eller besked');

	const erProeve = krop.besked.slags === PROEVE3;
	if (!kalder.erAdmin && !(erProeve && kalder.uid === krop.uid)) {
		throw error(403, 'Du maa kun sende proeven til dig selv');
	}

	const udfald = await sendTilKunde3(krop.uid, krop.besked, noegler, {
		tvang: krop.tvang,
		erProeve,
		mail: mailOpsaetning3(env)
	});
	return json(udfald);
};
