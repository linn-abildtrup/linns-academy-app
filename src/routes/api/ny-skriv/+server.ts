// ============================================================
// Linn skriver til én kunde.
//
// HVORFOR DET SKER PAA SERVEREN. Beskeden gemmes som en traad i det
// samme sted som kundens egne spoergsmaal, saa hun ser den i Beskeder og
// Linn ser den i sin almindelige liste. Reglerne i databasen siger at
// KUN kunden selv maa oprette en traad med sit eget navn paa, og det er
// en god regel. I stedet skriver serveren den, hvor adgangen allerede er
// tjekket. Saa slap vi for at aabne noget for alle.
//
// TRAADEN LIGGER SOM BESVARET, med et tomt spoergsmaal. Saa lander den
// ikke i Linns liste over noget hun mangler at svare paa. Svarer kunden,
// bliver hendes svar en ny traad, og DEN hopper op i listen.
//
// Bygget 23. august 2026, se HANDOVER 9.43.
// ============================================================

import type { RequestHandler } from '@sveltejs/kit';
import { json, error } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import { PUBLIC_FIREBASE_API_KEY } from '$env/static/public';
import { hentDoc, gemDocMerge } from '$lib/server/firestoreRest';
import { mailOpsaetning3 } from '$lib/server/sendMail';
import { hvemErDet3, noeglerFra3, sendTilKunde3 } from '$lib/server/notiSend';
import { skrevetNoti3, uddrag3 } from '$lib/content/notifikation3';

interface Krop {
	uid: string;
	tekst: string;
}

/** Et id man kan se hvor kommer fra, naar man staar i databasen. */
function nytId(): string {
	const r =
		typeof crypto !== 'undefined' && 'randomUUID' in crypto
			? crypto.randomUUID().slice(0, 12)
			: Math.random().toString(36).slice(2, 14);
	return `linn-${r}`;
}

export const POST: RequestHandler = async ({ request }) => {
	const auth = request.headers.get('Authorization');
	if (!auth?.startsWith('Bearer ')) throw error(401, 'Manglende Bearer-token');
	const kalder = await hvemErDet3(auth.slice(7), PUBLIC_FIREBASE_API_KEY);
	if (!kalder?.erAdmin) throw error(403, 'Kun Linn kan skrive til en kunde');

	const krop = (await request.json().catch(() => null)) as Krop | null;
	const tekst = krop?.tekst?.trim() ?? '';
	if (!krop?.uid || !tekst) throw error(400, 'Mangler kunde eller tekst');

	const bruger = await hentDoc(`users/${krop.uid}`);
	if (!bruger) throw error(404, 'Kunden findes ikke');

	const nu = new Date();
	const forlobIds = bruger.forlobIds;
	const id = nytId();
	await gemDocMerge(`klientspoergsmaal/${id}`, {
		uid: krop.uid,
		email: String(bruger.email ?? ''),
		// Tomt spoergsmaal: hun har ikke spurgt om noget. Kundens skaerm
		// viser derfor ingen boble ovenover, se beskeder-siden.
		spoergsmaal: '',
		svar: tekst,
		status: 'besvaret',
		fraLinn: true,
		oprettet: nu,
		besvaretAt: nu,
		...(Array.isArray(forlobIds) && forlobIds.length ? { forlobId: String(forlobIds[0]) } : {})
	});

	// Beskeden er gemt. Prikket er en ekstra tjeneste, og fejler det, er
	// beskeden der stadig naeste gang hun aabner appen.
	const noegler = noeglerFra3(env);
	const udfald = noegler
		? await sendTilKunde3(krop.uid, skrevetNoti3(tekst), noegler, {
				tvang: true,
				mail: mailOpsaetning3(env)
			})
		: { uid: krop.uid, sendt: 0, sprunget: null, ryddet: 0 };

	return json({ ...udfald, id, uddrag: uddrag3(tekst) });
};
