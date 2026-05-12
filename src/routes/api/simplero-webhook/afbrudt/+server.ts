// Webhook for Simplero-event "Subscription cancelled" — kunden har sagt op
// men beholder adgang til perioden er kørt ud. Vi sætter activeSubscription
// = false så systemet ved den ikke fornyes, men accessLevel bevares så hun
// kan bruge appen indtil period_ends_at.

import type { RequestHandler } from '@sveltejs/kit';
import { json } from '@sveltejs/kit';
import {
	parseOgVerificer,
	uddragEmail,
	gemILog,
	opdaterBrugerEllerWhitelist
} from '$lib/server/simpleroWebhook';

const EVENT = 'subscription.cancelled';

export const POST: RequestHandler = async ({ request }) => {
	const res = await parseOgVerificer(request, EVENT);
	if (!res.ok) return res.response;
	const { payload } = res;

	const email = uddragEmail(payload);
	if (!email) {
		await gemILog(EVENT, payload, 'skipped', 'mangler email');
		return json({ ok: true, status: 'skipped', reason: 'no email' });
	}

	const opdatering: Record<string, unknown> = {
		activeSubscription: false,
		cancelledAt: Date.now(),
		updatedAt: Date.now()
	};

	// Hvis Simplero sender period_ends_at, gemmes den så front-end kan vise
	// hvornår adgangen udløber, og en separat udløbs-job senere kan rydde op.
	const periodEndsAt = payload.period_ends_at;
	if (periodEndsAt) {
		const slut = new Date(periodEndsAt).getTime();
		if (Number.isFinite(slut)) {
			opdatering.expiresAt = slut;
		}
	}

	await opdaterBrugerEllerWhitelist(email, opdatering);
	await gemILog(EVENT, payload, 'cancelled', `opsigelse registreret for ${email}`);

	return json({ ok: true, status: 'cancelled', email });
};

export const GET: RequestHandler = async () => {
	return json({ ok: true, message: 'Simplero afbrudt-webhook klar' });
};
