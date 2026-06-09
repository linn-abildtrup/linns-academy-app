// Legacy Simplero-webhook — bevares så eksisterende webhooks i Simperos UI
// (fx "App Basis - køb gennemført") stadig virker indtil de er migreret over
// til de fire dedikerede routes:
//   /api/simplero-webhook/koeb              (Purchase made)
//   /api/simplero-webhook/fornyelse         (Recurring payment made)
//   /api/simplero-webhook/afbrudt           (Subscription cancelled)
//   /api/simplero-webhook/betaling-fejlede  (Payment failed)
//
// Denne handler udleder event-typen ud fra payload-felter (state, canceled_at,
// refunded_at, object_type) og dispatcher til samme logik som de nye routes.
// Når alle Simplero-webhooks peger på de nye URL'er, kan denne fil slettes.

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
	type SimpleroPayload
} from '$lib/server/simpleroWebhook';
import { findProduktAdgang } from '$lib/simplero/produktMapping';
import { udledState } from '$lib/utils/userAdgang';

function uddragEvent(payload: SimpleroPayload): string {
	if (payload.event) return String(payload.event);
	if (payload.type) return String(payload.type);
	if (payload.refunded_at) return 'purchase.refunded';
	if (payload.canceled_at || payload.state === 'canceled') return 'purchase.cancelled';
	if (payload.object_type === 'Purchase' && payload.state === 'paid') return 'purchase.paid';
	if (payload.object_type) return String(payload.object_type).toLowerCase();
	return 'unknown';
}

export const POST: RequestHandler = async ({ request }) => {
	const res = await parseOgVerificer(request, 'legacy');
	if (!res.ok) return res.response;
	const { payload } = res;

	const event = uddragEvent(payload);
	const email = uddragEmail(payload);
	const produktId = uddragProduktId(payload);
	const kundeId = uddragKundeId(payload);

	const erCancellering =
		event.includes('cancel') || event.includes('refund') || event.includes('expir');

	if (!email) {
		await gemILog(event, payload, 'skipped', 'mangler email');
		return json({ ok: true, status: 'skipped', reason: 'no email' });
	}

	if (erCancellering) {
		await opdaterBrugerEllerWhitelist(email, {
			accessLevel: 'none',
			activeSubscription: false,
			updatedAt: Date.now(),
			state: 'udlobet'
		});
		await gemILog(event, payload, 'cancelled', `adgang fjernet for ${email}`);
		return json({ ok: true, status: 'cancelled', email });
	}

	if (!produktId) {
		await gemILog(event, payload, 'skipped', 'mangler produktId');
		return json({ ok: true, status: 'skipped', reason: 'no productId' });
	}

	const adgang = findProduktAdgang(produktId);
	if (!adgang) {
		await gemILog(event, payload, 'skipped', `ukendt produkt ${produktId}`);
		return json({ ok: true, status: 'skipped', reason: 'unknown product', produktId });
	}

	const opdatering: Record<string, unknown> = {
		accessLevel: adgang.accessLevel,
		accessSource: adgang.accessSource,
		activeProduct: adgang.activeProduct,
		activeSubscription: adgang.activeSubscription,
		state: udledState(adgang.accessLevel, adgang.accessSource),
		updatedAt: Date.now()
	};
	if (kundeId) opdatering.simpleroCustomerId = kundeId;
	const navn = uddragNavn(payload);
	if (navn.firstName) opdatering.firstName = navn.firstName;
	if (navn.lastName) opdatering.lastName = navn.lastName;

	// A4-oprydning: bonusPeriodEndsAt saettes ikke laengere her. Login-sync
	// (synkroniserForlobskundeStatus i $lib/userDoc) er nu eneste kilde og
	// udleder bonus af forloebets startdato + antal dage. Se koeb-handleren.

	await opdaterBrugerEllerWhitelist(email, opdatering, adgang.forlobId);
	await gemILog(event, payload, 'granted', `${adgang.navn} til ${email}`);

	return json({
		ok: true,
		status: 'granted',
		email,
		produkt: adgang.navn,
		accessLevel: adgang.accessLevel
	});
};

export const GET: RequestHandler = async () => {
	return json({ ok: true, message: 'Simplero webhook endpoint klar (legacy)' });
};
