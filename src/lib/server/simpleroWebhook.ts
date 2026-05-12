// Delte hjælpere for de fire Simplero-webhook-routes
// (koeb / fornyelse / afbrudt / betaling-fejlede) plus den oprindelige
// /api/simplero-webhook-route. Indeholder signatur-verifikation,
// payload-typer, felt-udtræk, log-skrivning og bruger/whitelist-opdatering.

import { json } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import { gemDocMerge, hentDocsHvorFeltLig } from '$lib/server/firestoreRest';

// Simperos faktiske format er fladt — alle felter ligger på top-level.
// "Test-format"-felterne (event/type/data/customer/product/purchase) bevares
// så ældre unit-tests stadig kan ramme handlerne.
export interface SimpleroPayload {
	object_type?: string;
	state?: string;
	email?: string;
	product_id?: string | number;
	customer_id?: string | number;
	canceled_at?: string | null;
	refunded_at?: string | null;
	period_ends_at?: string | null;
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
		[key: string]: unknown;
	};
	customer?: { email?: string; id?: string | number };
	product?: { id?: string | number; title?: string };
	purchase?: { email?: string; product_id?: string | number };
	[key: string]: unknown;
}

export async function verificerSignatur(
	rawBody: string,
	signatur: string | null
): Promise<boolean> {
	const secret = env.SIMPLERO_WEBHOOK_SECRET;
	if (!secret) return true; // skipped hvis ingen secret konfigureret
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

export function uddragEmail(payload: SimpleroPayload): string | null {
	const e =
		payload.email ??
		payload.purchase?.email ??
		payload.data?.customer?.email ??
		payload.data?.purchase?.customer_email ??
		payload.customer?.email;
	return e ? String(e).toLowerCase().trim() : null;
}

export function uddragProduktId(payload: SimpleroPayload): string | null {
	const id =
		payload.product_id ??
		payload.purchase?.product_id ??
		payload.data?.product?.id ??
		payload.data?.purchase?.product_id ??
		payload.product?.id;
	return id ? String(id) : null;
}

export function uddragKundeId(payload: SimpleroPayload): string | null {
	const id =
		payload.customer_id ??
		payload.data?.customer?.id ??
		payload.data?.purchase?.customer_id ??
		payload.customer?.id;
	return id ? String(id) : null;
}

// Firestore document-ids må ikke indeholde '/'
function loggerSafePath(email: string): string {
	return email.replace(/\//g, '_');
}

export async function gemILog(
	event: string,
	payload: SimpleroPayload,
	status: string,
	note?: string
): Promise<void> {
	try {
		const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
		await gemDocMerge(`webhookLog/${id}`, {
			modtaget: Date.now(),
			event,
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

// Skriver opdateringen til users/{uid} hvis brugeren findes (slået op via email-
// feltet), ellers til allowedEmails/{email} som whitelist når hun logger ind.
// Hvis nytForlobId er givet merges det ind i forlobIds-arrayet på users uden
// at overskrive tidligere forløb; for allowedEmails gemmes det i forlobId-feltet
// og aggregeres over på userDoc første gang brugeren logger ind.
export async function opdaterBrugerEllerWhitelist(
	email: string,
	opdatering: Record<string, unknown>,
	nytForlobId?: string
): Promise<void> {
	const brugere = await hentDocsHvorFeltLig('users', 'email', email);
	if (brugere.length > 0) {
		for (const b of brugere) {
			const opd = { ...opdatering };
			if (nytForlobId) {
				const eksisterende = (b.data.forlobIds as string[] | undefined) ?? [];
				opd.forlobIds = Array.from(new Set([...eksisterende, nytForlobId]));
			}
			await gemDocMerge(`users/${b.id}`, opd);
		}
		return;
	}
	const whitelistOpdatering: Record<string, unknown> = {
		email,
		...opdatering
	};
	if (nytForlobId) whitelistOpdatering.forlobId = nytForlobId;
	await gemDocMerge(`allowedEmails/${loggerSafePath(email)}`, whitelistOpdatering);
}

// Læser raw body, verificerer signatur og parser JSON. Returnerer enten
// den parsede payload eller en færdig Response som kalderen kan returnere
// direkte til Simplero.
export async function parseOgVerificer(
	request: Request,
	event: string
): Promise<
	{ ok: true; payload: SimpleroPayload; rawBody: string } | { ok: false; response: Response }
> {
	const rawBody = await request.text();
	const signatur =
		request.headers.get('x-simplero-signature') ?? request.headers.get('x-webhook-signature');

	if (!(await verificerSignatur(rawBody, signatur))) {
		console.warn(`Simplero-${event}: ugyldig signatur`);
		return {
			ok: false,
			response: json({ ok: false, error: 'invalid signature' }, { status: 401 })
		};
	}

	let payload: SimpleroPayload;
	try {
		payload = JSON.parse(rawBody);
	} catch {
		return {
			ok: false,
			response: json({ ok: false, error: 'invalid JSON' }, { status: 400 })
		};
	}

	return { ok: true, payload, rawBody };
}
