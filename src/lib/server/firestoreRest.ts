// Lille Firestore REST-klient der virker på Cloudflare Workers runtime.
// firebase-admin bruger Node-specifikke APIer (gRPC) som ikke kan køre i
// Workers, så vi taler direkte med Firestore REST API i stedet.
//
// Authentication-flow:
//   1. Generer en service-account JWT (RS256-signeret med private key)
//   2. Byt JWT'en til en OAuth-access-token via Google's token-endpoint
//   3. Brug access-token i Authorization-headeren mod Firestore REST API
//
// Access-tokens cacheres i hukommelsen i ~50 minutter (gyldige i 60).
// Cachen er per worker-instans — hver kald-region har sin egen cache.

import { env } from '$env/dynamic/private';

interface CachedToken {
	token: string;
	expiresAt: number;
}

let cachedToken: CachedToken | null = null;

interface ServiceAccount {
	projectId: string;
	clientEmail: string;
	privateKey: string;
}

function laesServiceAccount(): ServiceAccount {
	const projectId = env.FIREBASE_PROJECT_ID;
	const clientEmail = env.FIREBASE_CLIENT_EMAIL;
	// Cloudflare Pages env-vars kan ikke have linjeskift i UI'et, så
	// private-key forventes med \n som literal escape.
	const privateKey = env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');
	if (!projectId || !clientEmail || !privateKey) {
		throw new Error('Firebase service-account env-vars mangler');
	}
	return { projectId, clientEmail, privateKey };
}

function base64UrlEncode(input: string | Uint8Array): string {
	const bytes = typeof input === 'string' ? new TextEncoder().encode(input) : input;
	let str = '';
	for (let i = 0; i < bytes.length; i++) str += String.fromCharCode(bytes[i]);
	return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function importerPrivateKey(pem: string): Promise<CryptoKey> {
	const renset = pem
		.replace(/-----BEGIN PRIVATE KEY-----/, '')
		.replace(/-----END PRIVATE KEY-----/, '')
		.replace(/\s/g, '');
	const der = Uint8Array.from(atob(renset), (c) => c.charCodeAt(0));
	return crypto.subtle.importKey(
		'pkcs8',
		der,
		{ name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
		false,
		['sign']
	);
}

async function genererJwt(sa: ServiceAccount): Promise<string> {
	const header = { alg: 'RS256', typ: 'JWT' };
	const now = Math.floor(Date.now() / 1000);
	const claim = {
		iss: sa.clientEmail,
		scope: 'https://www.googleapis.com/auth/datastore',
		aud: 'https://oauth2.googleapis.com/token',
		exp: now + 3600,
		iat: now
	};
	const headerB64 = base64UrlEncode(JSON.stringify(header));
	const claimB64 = base64UrlEncode(JSON.stringify(claim));
	const signing = `${headerB64}.${claimB64}`;
	const key = await importerPrivateKey(sa.privateKey);
	const signature = await crypto.subtle.sign(
		'RSASSA-PKCS1-v1_5',
		key,
		new TextEncoder().encode(signing)
	);
	return `${signing}.${base64UrlEncode(new Uint8Array(signature))}`;
}

async function hentAccessToken(): Promise<string> {
	const now = Date.now();
	if (cachedToken && cachedToken.expiresAt > now + 60_000) {
		return cachedToken.token;
	}
	const sa = laesServiceAccount();
	const jwt = await genererJwt(sa);
	const res = await fetch('https://oauth2.googleapis.com/token', {
		method: 'POST',
		headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
		body: new URLSearchParams({
			grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
			assertion: jwt
		})
	});
	if (!res.ok) {
		const tekst = await res.text();
		throw new Error(`OAuth-token-exchange fejlede (${res.status}): ${tekst}`);
	}
	const data = (await res.json()) as { access_token: string; expires_in: number };
	cachedToken = {
		token: data.access_token,
		expiresAt: now + data.expires_in * 1000
	};
	return data.access_token;
}

// ============================================================
// Firestore-værdi-konvertering (REST format ⇄ JS-objekter)
// ============================================================

type FirestoreValue =
	| { stringValue: string }
	| { integerValue: string }
	| { doubleValue: number }
	| { booleanValue: boolean }
	| { nullValue: null }
	| { timestampValue: string }
	| { mapValue: { fields: Record<string, FirestoreValue> } }
	| { arrayValue: { values: FirestoreValue[] } };

function tilFirestoreValue(v: unknown): FirestoreValue {
	if (v === null) return { nullValue: null };
	if (typeof v === 'string') return { stringValue: v };
	if (typeof v === 'boolean') return { booleanValue: v };
	if (typeof v === 'number') {
		return Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v };
	}
	if (Array.isArray(v)) {
		return { arrayValue: { values: v.map(tilFirestoreValue) } };
	}
	if (typeof v === 'object') {
		const fields: Record<string, FirestoreValue> = {};
		for (const [k, val] of Object.entries(v as Record<string, unknown>)) {
			if (val === undefined) continue;
			fields[k] = tilFirestoreValue(val);
		}
		return { mapValue: { fields } };
	}
	return { stringValue: String(v) };
}

function fraFirestoreValue(v: FirestoreValue): unknown {
	if ('stringValue' in v) return v.stringValue;
	if ('integerValue' in v) return Number(v.integerValue);
	if ('doubleValue' in v) return v.doubleValue;
	if ('booleanValue' in v) return v.booleanValue;
	if ('nullValue' in v) return null;
	if ('timestampValue' in v) return v.timestampValue;
	if ('mapValue' in v) {
		const out: Record<string, unknown> = {};
		for (const [k, val] of Object.entries(v.mapValue.fields ?? {})) {
			out[k] = fraFirestoreValue(val);
		}
		return out;
	}
	if ('arrayValue' in v) {
		return (v.arrayValue.values ?? []).map(fraFirestoreValue);
	}
	return null;
}

function konverterFields(data: Record<string, unknown>): Record<string, FirestoreValue> {
	const fields: Record<string, FirestoreValue> = {};
	for (const [k, v] of Object.entries(data)) {
		if (v === undefined) continue;
		fields[k] = tilFirestoreValue(v);
	}
	return fields;
}

// ============================================================
// Public API
// ============================================================

function dbBaseUrl(projectId: string): string {
	return `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents`;
}

/** Hent et dokument. Returnerer null hvis det ikke findes. */
export async function hentDoc(path: string): Promise<Record<string, unknown> | null> {
	const sa = laesServiceAccount();
	const token = await hentAccessToken();
	const res = await fetch(`${dbBaseUrl(sa.projectId)}/${path}`, {
		headers: { Authorization: `Bearer ${token}` }
	});
	if (res.status === 404) return null;
	if (!res.ok) {
		throw new Error(`Firestore GET fejlede (${res.status}): ${await res.text()}`);
	}
	const data = (await res.json()) as { fields?: Record<string, FirestoreValue> };
	if (!data.fields) return {};
	const out: Record<string, unknown> = {};
	for (const [k, v] of Object.entries(data.fields)) {
		out[k] = fraFirestoreValue(v);
	}
	return out;
}

/**
 * Opret eller flet et dokument med merge-semantik (PATCH med updateMask).
 * Skal bruges for at undgå at overskrive eksisterende felter.
 */
export async function gemDocMerge(path: string, data: Record<string, unknown>): Promise<void> {
	const sa = laesServiceAccount();
	const token = await hentAccessToken();
	const fields = konverterFields(data);
	const updateMask = Object.keys(fields)
		.map((k) => `updateMask.fieldPaths=${encodeURIComponent(k)}`)
		.join('&');
	const url = `${dbBaseUrl(sa.projectId)}/${path}?${updateMask}`;
	const res = await fetch(url, {
		method: 'PATCH',
		headers: {
			Authorization: `Bearer ${token}`,
			'Content-Type': 'application/json'
		},
		body: JSON.stringify({ fields })
	});
	if (!res.ok) {
		throw new Error(`Firestore PATCH fejlede (${res.status}): ${await res.text()}`);
	}
}

/** Hent alle dokumenter i en collection (uden filter). */
export async function hentAlleDocs(
	collection: string
): Promise<Array<{ id: string; data: Record<string, unknown> }>> {
	const sa = laesServiceAccount();
	const token = await hentAccessToken();
	const res = await fetch(`${dbBaseUrl(sa.projectId)}/${collection}?pageSize=300`, {
		method: 'GET',
		headers: { Authorization: `Bearer ${token}` }
	});
	if (!res.ok) {
		throw new Error(`Firestore list fejlede (${res.status}): ${await res.text()}`);
	}
	const data = (await res.json()) as {
		documents?: Array<{ name: string; fields?: Record<string, FirestoreValue> }>;
	};
	const result: Array<{ id: string; data: Record<string, unknown> }> = [];
	for (const d of data.documents ?? []) {
		const id = d.name.split('/').pop() ?? '';
		const out: Record<string, unknown> = {};
		for (const [k, v] of Object.entries(d.fields ?? {})) {
			out[k] = fraFirestoreValue(v);
		}
		result.push({ id, data: out });
	}
	return result;
}

/**
 * Hent ALLE dokumenter i en collection — følger nextPageToken til der ikke er
 * flere sider. hentAlleDocs() stopper ved 300; denne bruges når en collection
 * kan være større (fx mrsCache med 500+ kunder).
 */
export async function hentHeleCollection(
	collection: string
): Promise<Array<{ id: string; data: Record<string, unknown> }>> {
	const sa = laesServiceAccount();
	const token = await hentAccessToken();
	const result: Array<{ id: string; data: Record<string, unknown> }> = [];
	let pageToken: string | undefined;
	do {
		const url = new URL(`${dbBaseUrl(sa.projectId)}/${collection}`);
		url.searchParams.set('pageSize', '300');
		if (pageToken) url.searchParams.set('pageToken', pageToken);
		const res = await fetch(url.toString(), {
			method: 'GET',
			headers: { Authorization: `Bearer ${token}` }
		});
		if (!res.ok) {
			throw new Error(`Firestore list fejlede (${res.status}): ${await res.text()}`);
		}
		const data = (await res.json()) as {
			documents?: Array<{ name: string; fields?: Record<string, FirestoreValue> }>;
			nextPageToken?: string;
		};
		for (const d of data.documents ?? []) {
			const id = d.name.split('/').pop() ?? '';
			const out: Record<string, unknown> = {};
			for (const [k, v] of Object.entries(d.fields ?? {})) {
				out[k] = fraFirestoreValue(v);
			}
			result.push({ id, data: out });
		}
		pageToken = data.nextPageToken;
	} while (pageToken);
	return result;
}

/**
 * Collection-group-query: find alle FORÆLDRE-ids hvor en subcollection har et
 * dokument med timestampFelt > siden. Bruges af "Opdater tal" til at finde
 * præcis de kunder der har lavet en ny måling siden sidste snapshot — så vi
 * slipper for at læse alle kunders historik igen.
 *
 * NB: collection-group-queries med et range-filter kræver et collection-group-
 * index. Første gang queryen kører returnerer Firestore en fejl med en URL der
 * opretter indexet i Console (skal gøres manuelt én gang).
 */
export async function hentForaeldreIdsMedNyereEnd(
	subcollectionId: string,
	foraeldreCollection: string,
	timestampFelt: string,
	siden: number
): Promise<string[]> {
	const sa = laesServiceAccount();
	const token = await hentAccessToken();
	const body = {
		structuredQuery: {
			from: [{ collectionId: subcollectionId, allDescendants: true }],
			where: {
				fieldFilter: {
					field: { fieldPath: timestampFelt },
					op: 'GREATER_THAN',
					value: { integerValue: String(Math.floor(siden)) }
				}
			},
			// Vi behøver kun dokument-stierne (for at udlede forælder-id'erne),
			// ikke felterne — så projektér til kun __name__.
			select: { fields: [{ fieldPath: '__name__' }] }
		}
	};
	const res = await fetch(`${dbBaseUrl(sa.projectId)}:runQuery`, {
		method: 'POST',
		headers: {
			Authorization: `Bearer ${token}`,
			'Content-Type': 'application/json'
		},
		body: JSON.stringify(body)
	});
	if (!res.ok) {
		throw new Error(
			`Firestore collection-group-query fejlede (${res.status}): ${await res.text()}`
		);
	}
	const data = (await res.json()) as Array<{ document?: { name: string } }>;
	const ids = new Set<string>();
	for (const row of data) {
		if (!row.document) continue;
		const dele = row.document.name.split('/');
		const i = dele.lastIndexOf(foraeldreCollection);
		if (i >= 0 && i + 1 < dele.length) ids.add(dele[i + 1]);
	}
	return [...ids];
}

/** Søg efter dokumenter i en collection hvor et felt matcher en værdi. */
export async function hentDocsHvorFeltLig(
	collection: string,
	felt: string,
	vaerdi: string
): Promise<Array<{ id: string; data: Record<string, unknown> }>> {
	const sa = laesServiceAccount();
	const token = await hentAccessToken();
	const body = {
		structuredQuery: {
			from: [{ collectionId: collection }],
			where: {
				fieldFilter: {
					field: { fieldPath: felt },
					op: 'EQUAL',
					value: { stringValue: vaerdi }
				}
			},
			limit: 10
		}
	};
	const res = await fetch(`${dbBaseUrl(sa.projectId)}:runQuery`, {
		method: 'POST',
		headers: {
			Authorization: `Bearer ${token}`,
			'Content-Type': 'application/json'
		},
		body: JSON.stringify(body)
	});
	if (!res.ok) {
		throw new Error(`Firestore runQuery fejlede (${res.status}): ${await res.text()}`);
	}
	const data = (await res.json()) as Array<{
		document?: { name: string; fields?: Record<string, FirestoreValue> };
	}>;
	const result: Array<{ id: string; data: Record<string, unknown> }> = [];
	for (const row of data) {
		if (!row.document) continue;
		const id = row.document.name.split('/').pop() ?? '';
		const out: Record<string, unknown> = {};
		for (const [k, v] of Object.entries(row.document.fields ?? {})) {
			out[k] = fraFirestoreValue(v);
		}
		result.push({ id, data: out });
	}
	return result;
}

export interface QueryOpts {
	where?: { felt: string; vaerdi: string };
	orderBy?: { felt: string; retning?: 'ASCENDING' | 'DESCENDING' };
	limit?: number;
}

/**
 * Generisk query — bruges fx til at hente seneste N svar fra et forløb
 * sorteret efter oprettelsestidspunkt.
 *
 * NB: hvis du både har where + orderBy på FORSKELLIGE felter kræver
 * Firestore et composite index. Vi bruger (forlobId, oprettet) for
 * svarHistorik — det index skal oprettes manuelt i Firebase Console
 * første gang queryen kører (Firestore returnerer en URL i fejlen).
 */
export async function runQuery(
	collection: string,
	opts: QueryOpts
): Promise<Array<{ id: string; data: Record<string, unknown> }>> {
	const sa = laesServiceAccount();
	const token = await hentAccessToken();
	const structuredQuery: Record<string, unknown> = {
		from: [{ collectionId: collection }]
	};
	if (opts.where) {
		structuredQuery.where = {
			fieldFilter: {
				field: { fieldPath: opts.where.felt },
				op: 'EQUAL',
				value: { stringValue: opts.where.vaerdi }
			}
		};
	}
	if (opts.orderBy) {
		structuredQuery.orderBy = [
			{
				field: { fieldPath: opts.orderBy.felt },
				direction: opts.orderBy.retning ?? 'DESCENDING'
			}
		];
	}
	if (opts.limit) structuredQuery.limit = opts.limit;

	const res = await fetch(`${dbBaseUrl(sa.projectId)}:runQuery`, {
		method: 'POST',
		headers: {
			Authorization: `Bearer ${token}`,
			'Content-Type': 'application/json'
		},
		body: JSON.stringify({ structuredQuery })
	});
	if (!res.ok) {
		throw new Error(`Firestore runQuery fejlede (${res.status}): ${await res.text()}`);
	}
	const data = (await res.json()) as Array<{
		document?: { name: string; fields?: Record<string, FirestoreValue> };
	}>;
	const result: Array<{ id: string; data: Record<string, unknown> }> = [];
	for (const row of data) {
		if (!row.document) continue;
		const id = row.document.name.split('/').pop() ?? '';
		const out: Record<string, unknown> = {};
		for (const [k, v] of Object.entries(row.document.fields ?? {})) {
			out[k] = fraFirestoreValue(v);
		}
		result.push({ id, data: out });
	}
	return result;
}
