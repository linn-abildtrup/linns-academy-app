// Webhook for Simplero-event "Recurring payment made" — månedlig fornyelse
// af et abonnement. Brugeren har allerede adgang; vi bekræfter at
// abonnementet løber videre og rydder evt. paymentFailedAt-flag fra et
// tidligere fejlforsøg.

import type { RequestHandler } from '@sveltejs/kit';
import { json } from '@sveltejs/kit';
import {
	parseOgVerificer,
	uddragEmail,
	uddragProduktId,
	gemILog,
	opdaterBrugerEllerWhitelist
} from '$lib/server/simpleroWebhook';
import { findProduktAdgang } from '$lib/simplero/produktMapping';

const EVENT = 'purchase.renewed';

export const POST: RequestHandler = async ({ request }) => {
	const res = await parseOgVerificer(request, EVENT);
	if (!res.ok) return res.response;
	const { payload } = res;

	const email = uddragEmail(payload);
	const produktId = uddragProduktId(payload);

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
		activeSubscription: true,
		// state-feltet skrives ikke laengere (A2 etape B).
		paymentFailedAt: null,
		updatedAt: Date.now()
	};

	await opdaterBrugerEllerWhitelist(email, opdatering);
	await gemILog(EVENT, payload, 'renewed', `${adgang.navn} fornyelse for ${email}`);

	return json({
		ok: true,
		status: 'renewed',
		email,
		produkt: adgang.navn
	});
};

export const GET: RequestHandler = async () => {
	return json({ ok: true, message: 'Simplero fornyelse-webhook klar' });
};
