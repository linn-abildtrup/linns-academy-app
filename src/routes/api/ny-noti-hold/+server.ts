// ============================================================
// Prikket til et helt hold. Kun admin.
//
// Bruges naar Linn saetter en besked op paa forsiden og har slaaet "sig
// ogsaa til paa telefonen" til. Beskeden staar i appen uanset hvad;
// prikket er en ekstra tjeneste.
//
// TRYKKET LANDER PAA FORSIDEN, hvor beskeden faktisk staar. Ikke i
// Beskeder, hvor der ikke ville staa noget. Det var praecis det der gik
// galt foerste gang, se HANDOVER 9.43.
//
// Se HANDOVER 9.45.
// ============================================================

import type { RequestHandler } from '@sveltejs/kit';
import { json, error } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import { PUBLIC_FIREBASE_API_KEY } from '$env/static/public';
import { mailOpsaetning3 } from '$lib/server/sendMail';
import { hvemErDet3, noeglerFra3 } from '$lib/server/notiSend';
import { erMedlem3, medTelefon3, paaForlob3, sendTilFlere3 } from '$lib/server/notiHold';
import { uddrag3 } from '$lib/content/notifikation3';
import type { Modtager3 } from '$lib/content/forsidebesked3';

interface Krop {
	modtager: Modtager3;
	tekst: string;
}

export const POST: RequestHandler = async ({ request }) => {
	const auth = request.headers.get('Authorization');
	if (!auth?.startsWith('Bearer ')) throw error(401, 'Manglende Bearer-token');
	const kalder = await hvemErDet3(auth.slice(7), PUBLIC_FIREBASE_API_KEY);
	if (!kalder?.erAdmin) throw error(403, 'Kun Linn kan sende til et hold');

	const noegler = noeglerFra3(env);
	if (!noegler) throw error(500, 'Noeglerne mangler i miljoeet. Se HANDOVER 9.39.');

	const krop = (await request.json().catch(() => null)) as Krop | null;
	const tekst = krop?.tekst?.trim() ?? '';
	if (!krop?.modtager || !tekst) throw error(400, 'Mangler modtager eller tekst');

	const m = krop.modtager;
	const alle = await medTelefon3();

	const udfald = await sendTilFlere3(
		alle,
		(_uid, bruger) => {
			// Er hun ikke i maalgruppen, faar hun ingenting. Reglen er den
			// samme som paa forsiden, se content/forsidebesked3.
			if (m.slags === 'forlob' && !paaForlob3(bruger, m.forlobId)) return null;
			if (m.slags === 'medlemmer' && !erMedlem3(bruger)) return null;
			return {
				titel: 'Nyt fra Linn',
				tekst: uddrag3(tekst),
				// Forsiden, hvor beskeden staar.
				sti: '/ny',
				slags: 'dag' as const
			};
		},
		noegler,
		// Linn har lige trykket send. Karantaenen er til det der sker af sig
		// selv, ikke til det hun selv beder om.
		{ tvang: true, mail: mailOpsaetning3(env) }
	);

	return json(udfald);
};
