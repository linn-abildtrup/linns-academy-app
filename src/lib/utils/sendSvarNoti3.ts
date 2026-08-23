// ============================================================
// Beskeden der siger "Linn har svaret dig".
//
// HVORFOR DEN LIGGER FOR SIG. Linn svarer inde i den GAMLE apps admin,
// og den maa kun laeses, ikke aendres, se regel 2. Det her er derfor en
// ny fil som de skaerme kan kalde med ÉN linje, uden at der skal skrives
// noget som helst andet ind i dem.
//
// DEN FEJLER ALDRIG OPAD. Gaar afsendelsen galt, er svaret stadig gemt,
// og det er dét der betyder noget. En besked der ikke kom frem maa
// ALDRIG kunne se ud som om svaret ikke blev sendt.
//
// Alt det svaere ligger bagved: om kunden overhovedet er paa 3.0, om hun
// har sagt ja, og om der er gaaet nok tid siden sidst. Se
// routes/api/ny-noti. Her er kun turen derhen.
//
// Bygget 23. august 2026, se HANDOVER 9.39.
// ============================================================

import { auth } from '$lib/firebase';
import { svarNoti3 } from '$lib/content/notifikation3';

/**
 * Siger til paa kundens telefon at der er kommet svar.
 *
 * Kaldes EFTER at svaret er gemt. Returnerer stille, ogsaa naar der ikke
 * blev sendt noget: det er helt normalt, fx hvis hun ikke har sagt ja.
 */
export async function sendSvarNoti3(uid: string, svar: string): Promise<void> {
	try {
		const bruger = auth.currentUser;
		if (!bruger || !uid || !svar.trim()) return;
		const token = await bruger.getIdToken();
		await fetch('/api/ny-noti', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
			body: JSON.stringify({ uid, besked: svarNoti3(svar) })
		});
	} catch (e) {
		// Med vilje kun en note i loggen. Se toppen af filen.
		console.warn('[noti] kunne ikke sige til om svaret', e);
	}
}
