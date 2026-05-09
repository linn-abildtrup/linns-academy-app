// Webhook-endpoint der modtager køb/refunderinger/cancelleringer fra Simplero
// og synkroniserer dem til Firestore.
//
// Flow når en kunde køber:
//   1. Simplero sender POST hertil med JSON-body om købet
//   2. Vi verificerer signaturen (hvis SIMPLERO_WEBHOOK_SECRET er sat)
//   3. Vi logger payload til 'webhookLog' for debugging
//   4. Vi slår produktet op i PRODUKT_MAPPING
//   5. Vi finder brugeren via email — opdater 'users/{uid}' hvis hun findes,
//      ellers 'allowedEmails/{email}' som whitelist for når hun logger ind
//   6. Returnerer 200 OK
//
// Endpoint URL: https://app.linnsacademy.dk/api/simplero-webhook
// (eller pages.dev-domænet hvis du ikke har custom domæne)

import type { RequestHandler } from '@sveltejs/kit';
import { json } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import { gemDocMerge, hentDocsHvorFeltLig } from '$lib/server/firestoreRest';
import { findProduktAdgang } from '$lib/simplero/produktMapping';
import { udledState } from '$lib/utils/userAdgang';

interface SimpleroPayload {
	event?: string;
	type?: string;
	data?: {
		customer?: { email?: string; id?: string | number };
		product?: { id?: string | number; title?: string; name?: string };
		purchase?: {
			id?: string | number;
			product_id?: string | number;
			customer_email?: string;
			customer_id?: string | number;
		};
		subscription?: { id?: string | number };
		[key: string]: unknown;
	};
	customer?: { email?: string; id?: string | number };
	product?: { id?: string | number; title?: string };
	[key: string]: unknown;
}

function uddragEvent(payload: SimpleroPayload): string {
	return (payload.event ?? payload.type ?? 'unknown').toString();
}

function uddragEmail(payload: SimpleroPayload): string | null {
	const e =
		payload.data?.customer?.email ??
		payload.data?.purchase?.customer_email ??
		payload.customer?.email;
	return e ? e.toLowerCase().trim() : null;
}

function uddragProduktId(payload: SimpleroPayload): string | null {
	const id =
		payload.data?.product?.id ??
		payload.data?.purchase?.product_id ??
		payload.product?.id;
	return id ? String(id) : null;
}

function uddragKundeId(payload: SimpleroPayload): string | null {
	const id =
		payload.data?.customer?.id ??
		payload.data?.purchase?.customer_id ??
		payload.customer?.id;
	return id ? String(id) : null;
}

async function verificerSignatur(rawBody: string, signatur: string | null): Promise<boolean> {
	const secret = env.SIMPLERO_WEBHOOK_SECRET;
	if (!secret) return true; // Verifikation skipped hvis ingen secret konfigureret
	if (!signatur) return false;
	const key = await crypto.subtle.importKey(
		'raw',
		new TextEncoder().encode(secret),
		{ name: 'HMAC', hash: 'SHA-256' },
		false,
		['sign']
	);
	const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(rawBody));
	const hex = Array.from(new Uint8Array(sig))
		.map((b) => b.toString(16).padStart(2, '0'))
		.join('');
	return hex === signatur || `sha256=${hex}` === signatur;
}

function loggerSafePath(email: string): string {
	// Firestore document-ids må ikke indeholde '/'
	return email.replace(/\//g, '_');
}

async function gemILog(payload: SimpleroPayload, status: string, note?: string): Promise<void> {
	try {
		const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
		await gemDocMerge(`webhookLog/${id}`, {
			modtaget: Date.now(),
			event: uddragEvent(payload),
			email: uddragEmail(payload) ?? '',
			produktId: uddragProduktId(payload) ?? '',
			status,
			note: note ?? '',
			payload: JSON.stringify(payload).slice(0, 9000)
		});
	} catch (e) {
		console.error('Kunne ikke skrive webhook-log:', e);
	}
}

export const POST: RequestHandler = async ({ request }) => {
	const rawBody = await request.text();
	const signatur =
		request.headers.get('x-simplero-signature') ??
		request.headers.get('x-webhook-signature');

	if (!(await verificerSignatur(rawBody, signatur))) {
		console.warn('Simplero-webhook: ugyldig signatur');
		return json({ ok: false, error: 'invalid signature' }, { status: 401 });
	}

	let payload: SimpleroPayload;
	try {
		payload = JSON.parse(rawBody);
	} catch {
		return json({ ok: false, error: 'invalid JSON' }, { status: 400 });
	}

	const event = uddragEvent(payload);
	const email = uddragEmail(payload);
	const produktId = uddragProduktId(payload);
	const kundeId = uddragKundeId(payload);

	// Cancel/refund-events fjerner adgangen øjeblikkeligt
	const erCancellering =
		event.includes('cancel') || event.includes('refund') || event.includes('expir');

	if (!email) {
		await gemILog(payload, 'skipped', 'mangler email');
		return json({ ok: true, status: 'skipped', reason: 'no email' });
	}

	if (erCancellering) {
		const opdatering = {
			accessLevel: 'none',
			activeSubscription: false,
			updatedAt: Date.now(),
			state: 'udlobet'
		};
		await opdaterBrugerEllerWhitelist(email, opdatering);
		await gemILog(payload, 'cancelled', `adgang fjernet for ${email}`);
		return json({ ok: true, status: 'cancelled', email });
	}

	if (!produktId) {
		await gemILog(payload, 'skipped', 'mangler produktId');
		return json({ ok: true, status: 'skipped', reason: 'no productId' });
	}

	const adgang = findProduktAdgang(produktId);
	if (!adgang) {
		await gemILog(payload, 'skipped', `ukendt produkt ${produktId}`);
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
	if (adgang.forlobId) opdatering.forlobIds = [adgang.forlobId];

	await opdaterBrugerEllerWhitelist(email, opdatering);
	await gemILog(payload, 'granted', `${adgang.navn} til ${email}`);

	return json({
		ok: true,
		status: 'granted',
		email,
		produkt: adgang.navn,
		accessLevel: adgang.accessLevel
	});
};

/**
 * Skriver opdateringen til users/{uid} hvis brugeren findes (fundet via
 * email-feltet), ellers til allowedEmails/{email} så hun får adgangen
 * når hun logger ind næste gang.
 */
async function opdaterBrugerEllerWhitelist(
	email: string,
	opdatering: Record<string, unknown>
): Promise<void> {
	const brugere = await hentDocsHvorFeltLig('users', 'email', email);
	if (brugere.length > 0) {
		// Opdater alle matchende user-dokumenter (skulle kun være ét i praksis)
		for (const b of brugere) {
			await gemDocMerge(`users/${b.id}`, opdatering);
		}
		return;
	}
	// Ingen aktiv konto endnu — gem på whitelist
	const whitelistOpdatering: Record<string, unknown> = {
		email,
		...opdatering
	};
	await gemDocMerge(`allowedEmails/${loggerSafePath(email)}`, whitelistOpdatering);
}

// GET-handler så Simplero kan teste at endpointet svarer (mange webhook-systemer
// gør et HEAD/GET-tjek før de sender det første event).
export const GET: RequestHandler = async () => {
	return json({ ok: true, message: 'Simplero webhook endpoint klar' });
};
