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
// LYD OG BILLEDE, 1. september 2026. Beskeden kan baere ÉN lydbesked
// eller ÉT billede ved siden af teksten. Selve filen ligger allerede i
// Storage naar vi kommer her: siden lagde den op, saa der ikke gaar en
// stor fil gennem den her funktion. Serveren tjekker at adressen
// virkelig peger paa netop DEN kundes egen mappe, saa en tastefejl ikke
// kan sende et billede til den forkerte.
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
import { medFilNoti3, skrevetNoti3, uddrag3 } from '$lib/content/notifikation3';
import { erVoresBeskedFil, LYD_MAKS_SEKUNDER } from '$lib/content/beskedFil3';

interface Krop {
	uid: string;
	tekst: string;
	/** Adressen paa et billede der allerede ligger i kundens egen mappe. */
	billedUrl?: string;
	/** Adressen paa en lydbesked der allerede ligger samme sted. */
	lydUrl?: string;
	/** Hvor lang lyden er. Staar paa afspilleren foer hun trykker play. */
	lydSekunder?: number;
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
	const billedUrl = krop?.billedUrl?.trim() ?? '';
	const lydUrl = krop?.lydUrl?.trim() ?? '';
	if (!krop?.uid) throw error(400, 'Mangler kunde');
	// EN TOM BESKED MAA IKKE KUNNE SENDES. Foer var tekst det eneste der
	// fandtes; nu er lyd eller et billede ogsaa nok.
	if (!tekst && !billedUrl && !lydUrl) throw error(400, 'Beskeden er tom');
	if (billedUrl && lydUrl) throw error(400, 'Kun én fil pr besked');
	if (billedUrl && !erVoresBeskedFil(billedUrl, krop.uid))
		throw error(400, 'Billedet ligger ikke i kundens egen mappe');
	if (lydUrl && !erVoresBeskedFil(lydUrl, krop.uid))
		throw error(400, 'Lyden ligger ikke i kundens egen mappe');

	const lydSekunder = Math.round(Number(krop?.lydSekunder ?? 0));
	if (lydUrl && (!Number.isFinite(lydSekunder) || lydSekunder < 0))
		throw error(400, 'Lydens laengde giver ikke mening');
	if (lydSekunder > LYD_MAKS_SEKUNDER + 5) throw error(400, 'Lyden er for lang');

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
		...(billedUrl ? { billedUrl } : {}),
		...(lydUrl ? { lydUrl, lydSekunder } : {}),
		...(Array.isArray(forlobIds) && forlobIds.length ? { forlobId: String(forlobIds[0]) } : {})
	});

	// Beskeden er gemt. Prikket er en ekstra tjeneste, og fejler det, er
	// beskeden der stadig naeste gang hun aabner appen.
	const noegler = noeglerFra3(env);
	const besked = lydUrl
		? medFilNoti3('lyd', tekst)
		: billedUrl
			? medFilNoti3('billede', tekst)
			: skrevetNoti3(tekst);
	const udfald = noegler
		? await sendTilKunde3(krop.uid, besked, noegler, {
				tvang: true,
				mail: mailOpsaetning3(env)
			})
		: { uid: krop.uid, sendt: 0, sprunget: null, ryddet: 0 };

	return json({ ...udfald, id, uddrag: uddrag3(tekst) });
};
