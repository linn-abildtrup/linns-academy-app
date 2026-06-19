// Delte hjælpere for de fire Simplero-webhook-routes
// (koeb / fornyelse / afbrudt / betaling-fejlede) plus den oprindelige
// /api/simplero-webhook-route. Indeholder signatur-verifikation,
// payload-typer, felt-udtræk, log-skrivning og bruger/whitelist-opdatering.

import { json } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import {
	gemDocMerge,
	hentDoc,
	hentDocsHvorFeltLig,
	hentHeleCollection
} from '$lib/server/firestoreRest';
import { forlobSlutMs } from '$lib/content/forlobAdgang';
import { nulDageDatoer } from '$lib/content/forlob';

const DAG_MS = 24 * 60 * 60 * 1000;

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
	// Simplero sender first_names + last_name på top-niveau
	first_names?: string;
	last_name?: string;
	data?: {
		customer?: { email?: string; id?: string | number; first_names?: string; last_name?: string };
		product?: { id?: string | number; title?: string; name?: string };
		purchase?: {
			id?: string | number;
			product_id?: string | number;
			customer_email?: string;
			customer_id?: string | number;
			name?: string;
		};
		[key: string]: unknown;
	};
	customer?: { email?: string; id?: string | number; first_names?: string; last_name?: string };
	product?: { id?: string | number; title?: string };
	purchase?: { email?: string; product_id?: string | number; name?: string };
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

/**
 * Udvinder kundens for- og efternavn fra Simplero-payload. Simplero bruger
 * 'first_names' (med s) på top-niveau, og purchase.name som fallback for
 * et samlet navn der splittes på første mellemrum.
 */
export function uddragNavn(payload: SimpleroPayload): { firstName: string; lastName: string } {
	const first =
		payload.first_names?.trim() ??
		payload.data?.customer?.first_names?.trim() ??
		payload.customer?.first_names?.trim() ??
		'';
	const last =
		payload.last_name?.trim() ??
		payload.data?.customer?.last_name?.trim() ??
		payload.customer?.last_name?.trim() ??
		'';
	if (first || last) return { firstName: first, lastName: last };
	// Fallback: split purchase.name på første mellemrum
	const samlet = (payload.purchase?.name ?? payload.data?.purchase?.name ?? '').trim();
	if (samlet) {
		const idx = samlet.indexOf(' ');
		if (idx === -1) return { firstName: samlet, lastName: '' };
		return { firstName: samlet.slice(0, idx).trim(), lastName: samlet.slice(idx + 1).trim() };
	}
	return { firstName: '', lastName: '' };
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

// Skriver opdateringen til BÅDE users/{uid} (hvis brugeren findes) OG
// allowedEmails/{email}. Tidligere blev allowedEmails sprunget over når en
// users-doc fandtes, men det betyder at admin-tællingen mister fortegnelser
// for migrerede kunder der senere køber basis-abo (deres users-doc får abo-
// felterne, men allowedEmails er stadig kun migrations-defaults). Nu holdes
// begge dokumenter altid i sync.
//
// Hvis nytForlobId er givet merges det ind i forlobIds-arrayet på users uden
// at overskrive tidligere forløb; for allowedEmails gemmes det i forlobId-
// feltet.
export async function opdaterBrugerEllerWhitelist(
	email: string,
	opdatering: Record<string, unknown>,
	nytForlobId?: string
): Promise<void> {
	const brugere = await hentDocsHvorFeltLig('users', 'email', email);

	// Skriv altid til allowedEmails så admin-tællinger og whitelist-flow er konsistente.
	const whitelistOpdatering: Record<string, unknown> = {
		email,
		...opdatering
	};
	if (nytForlobId) whitelistOpdatering.forlobId = nytForlobId;
	await gemDocMerge(`allowedEmails/${loggerSafePath(email)}`, whitelistOpdatering);

	// Skriv også til users-doc hvis brugeren har logget ind.
	if (brugere.length > 0) {
		for (const b of brugere) {
			const opd = { ...opdatering };
			if (nytForlobId) {
				const eksisterende = (b.data.forlobIds as string[] | undefined) ?? [];
				opd.forlobIds = Array.from(new Set([...eksisterende, nytForlobId]));
			}
			await gemDocMerge(`users/${b.id}`, opd);
		}
	}
}

function tilMs(v: unknown): number {
	if (typeof v === 'number') return v;
	if (typeof v === 'string') {
		const t = new Date(v).getTime();
		return isNaN(t) ? 0 : t;
	}
	return 0;
}

/**
 * Hvis kunden er paa et AKTIVT forloeb, returneres tidspunktet hvor appen skal
 * tage over: forloebets EFFEKTIVE slut (hold-slut = start + (antalDage+1) dage,
 * PLUS kundens brugte pause-dage). Er kunden paa flere aktive forloeb, bruges
 * det seneste. Returnerer 0 hvis kunden ikke er paa et aktivt forloeb (saa skal
 * abo'en aktiveres med det samme).
 */
export async function hentAktivtForlobSlut(email: string): Promise<number> {
	const brugere = await hentDocsHvorFeltLig('users', 'email', email);
	if (brugere.length === 0) return 0;
	const now = Date.now();
	let maxSlut = 0;
	for (const b of brugere) {
		const forlobIds = (b.data.forlobIds as string[] | undefined) ?? [];
		if (forlobIds.length === 0) continue;
		// Pause-dage pr forlobId fra kundens products-skuffer.
		const prods = await hentHeleCollection(`users/${b.id}/products`);
		const nulPerForlob = new Map<string, number>();
		for (const p of prods) {
			const fId = p.data.forlobId as string | undefined;
			const iv =
				(p.data.nulDage as { intervaller?: { fra: string; til: string }[] } | undefined)
					?.intervaller ?? [];
			if (fId) nulPerForlob.set(fId, nulDageDatoer(iv).length);
		}
		for (const fId of forlobIds) {
			const f = await hentDoc(`forlob/${fId}`);
			if (!f) continue;
			const startMs = tilMs(f.startDato);
			const antalDage = (f.antalDage as number) ?? 0;
			if (!startMs || !antalDage) continue;
			const nulBrugt = nulPerForlob.get(fId) ?? 0;
			const slut = forlobSlutMs(startMs, antalDage) + nulBrugt * DAG_MS;
			if (slut > now && slut > maxSlut) maxSlut = slut;
		}
	}
	return maxSlut;
}

/**
 * Parkerer et abo-koeb til EFTER kundens forloeb: abo-felterne (+ adgangFra)
 * skrives KUN paa whitelisten, saa login-synk foerst aktiverer dem naar
 * adgangFra er passeret. Samtidig holdes forloebet aabent ved at saette
 * userDoc.expiresAt = adgangFra. Abo-felterne (accessSource/accessLevel/
 * activeProduct) skrives IKKE paa userDoc endnu — saa kunden bliver paa
 * forloebet indtil appen tager over.
 */
export async function parkerAboTilEfterForlob(
	email: string,
	opdatering: Record<string, unknown>,
	adgangFra: number
): Promise<void> {
	await gemDocMerge(`allowedEmails/${loggerSafePath(email)}`, {
		email,
		...opdatering,
		adgangFra
	});
	const brugere = await hentDocsHvorFeltLig('users', 'email', email);
	for (const b of brugere) {
		// Hold forloebet aabent indtil appen tager over. Skriv IKKE abo-felterne.
		const userOpd: Record<string, unknown> = { expiresAt: adgangFra };
		if (opdatering.simpleroCustomerId) userOpd.simpleroCustomerId = opdatering.simpleroCustomerId;
		await gemDocMerge(`users/${b.id}`, userOpd);
	}
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
