// Webhook for Simplero-event "Payment failed" — kortet blev afvist.
// Vi rydder IKKE adgangen straks (kunden får chance for at opdatere kortet),
// men markerer paymentFailedAt så UI kan vise advarsel og evt. besked-flowet
// kan trigge. Hvis fornyelse efterfølgende går igennem, nulstilles flaget i
// /fornyelse-handleren.

import type { RequestHandler } from '@sveltejs/kit';
import { json } from '@sveltejs/kit';
import {
	parseOgVerificer,
	uddragEmail,
	gemILog,
	opdaterBrugerEllerWhitelist
} from '$lib/server/simpleroWebhook';

const EVENT = 'payment.failed';

export const POST: RequestHandler = async ({ request }) => {
	const res = await parseOgVerificer(request, EVENT);
	if (!res.ok) return res.response;
	const { payload } = res;

	const email = uddragEmail(payload);
	if (!email) {
		await gemILog(EVENT, payload, 'skipped', 'mangler email');
		return json({ ok: true, status: 'skipped', reason: 'no email' });
	}

	await opdaterBrugerEllerWhitelist(email, {
		paymentFailedAt: Date.now(),
		updatedAt: Date.now()
	});
	await gemILog(EVENT, payload, 'payment_failed', `betalingsfejl markeret for ${email}`);

	return json({ ok: true, status: 'payment_failed', email });
};

export const GET: RequestHandler = async () => {
	return json({ ok: true, message: 'Simplero betaling-fejlede-webhook klar' });
};
