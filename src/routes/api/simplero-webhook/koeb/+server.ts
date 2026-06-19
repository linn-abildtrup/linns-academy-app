// Webhook for Simplero-event "Purchase made" — første køb af et produkt.
// Slår produktet op i PRODUKT_MAPPING og sætter accessLevel + tilhørende
// felter på users/{uid} eller allowedEmails/{email}. For forløbs-køb tilføjes
// 90 dages bibliotek-bonus efter forløbets slut.

import type { RequestHandler } from '@sveltejs/kit';
import { json } from '@sveltejs/kit';
import {
	parseOgVerificer,
	uddragEmail,
	uddragProduktId,
	uddragKundeId,
	uddragNavn,
	gemILog,
	opdaterBrugerEllerWhitelist,
	hentAktivtForlobSlut,
	parkerAboTilEfterForlob
} from '$lib/server/simpleroWebhook';
import { findProduktAdgang } from '$lib/simplero/produktMapping';

const EVENT = 'purchase.made';

export const POST: RequestHandler = async ({ request }) => {
	const res = await parseOgVerificer(request, EVENT);
	if (!res.ok) return res.response;
	const { payload } = res;

	const email = uddragEmail(payload);
	const produktId = uddragProduktId(payload);
	const kundeId = uddragKundeId(payload);

	if (!email) {
		await gemILog(EVENT, payload, 'skipped', 'mangler email');
		return json({ ok: true, status: 'skipped', reason: 'no email' });
	}
	if (!produktId) {
		await gemILog(EVENT, payload, 'skipped', 'mangler produktId');
		return json({ ok: true, status: 'skipped', reason: 'no productId' });
	}

	const adgang = findProduktAdgang(produktId);
	if (!adgang) {
		await gemILog(EVENT, payload, 'skipped', `ukendt produkt ${produktId}`);
		return json({ ok: true, status: 'skipped', reason: 'unknown product', produktId });
	}

	const opdatering: Record<string, unknown> = {
		accessLevel: adgang.accessLevel,
		accessSource: adgang.accessSource,
		activeProduct: adgang.activeProduct,
		activeSubscription: adgang.activeSubscription,
		// state-feltet skrives ikke laengere (A2 etape B) - effektivState
		// udleder tilstanden af accessLevel/accessSource.
		paymentFailedAt: null,
		updatedAt: Date.now()
	};
	if (kundeId) opdatering.simpleroCustomerId = kundeId;
	const navn = uddragNavn(payload);
	if (navn.firstName) opdatering.firstName = navn.firstName;
	if (navn.lastName) opdatering.lastName = navn.lastName;

	// A4-oprydning: webhook'en saetter IKKE laengere bonusPeriodEndsAt selv.
	// Den blev tidligere udledt af Simperos period_ends_at, mens login-sync
	// udleder den af forloebets startdato + antal dage. To kilder kunne give
	// forskellige datoer. Nu er login-sync (synkroniserForlobskundeStatus i
	// $lib/userDoc) den ENESTE kilde - den saetter expiresAt + bonus fra
	// forloebet foerste gang kunden logger ind (selv-helbredende).

	// Køber kunden et app-ABONNEMENT mens hun stadig er på et aktivt forløb,
	// skal appen først tage over DAGEN EFTER forløbet er afsluttet (hold-slut +
	// kundens pause-dage). Vi parkerer derfor abo'en på whitelisten med adgangFra
	// og holder forløbet åbent — login-synk aktiverer abo'en på det rigtige
	// tidspunkt. Gælder kun abonnementer (basis + premium), ikke forløbs-køb.
	if (adgang.accessSource === 'abonnement') {
		const forlobSlut = await hentAktivtForlobSlut(email);
		if (forlobSlut > Date.now()) {
			await parkerAboTilEfterForlob(email, opdatering, forlobSlut);
			await gemILog(
				EVENT,
				payload,
				'granted',
				`${adgang.navn} til ${email} — parkeret til ${new Date(forlobSlut).toISOString().slice(0, 10)} (aktivt forløb)`
			);
			return json({
				ok: true,
				status: 'granted',
				email,
				produkt: adgang.navn,
				accessLevel: adgang.accessLevel,
				parkeretTil: forlobSlut
			});
		}
	}

	await opdaterBrugerEllerWhitelist(email, opdatering, adgang.forlobId);
	await gemILog(EVENT, payload, 'granted', `${adgang.navn} til ${email}`);

	return json({
		ok: true,
		status: 'granted',
		email,
		produkt: adgang.navn,
		accessLevel: adgang.accessLevel
	});
};

// GET så Simperos test-ping rammer 200 OK før webhooken godkendes
export const GET: RequestHandler = async () => {
	return json({ ok: true, message: 'Simplero koeb-webhook klar' });
};
