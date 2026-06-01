// Lille REST-klient til Firebase Identity Toolkit (Auth) der virker på
// Cloudflare Workers runtime. Bruger samme service-account JWT-flow som
// firestoreRest.ts, men med 'cloud-platform'-scope der dækker både
// Firestore OG Identity Toolkit/Auth.
//
// Bruges af admin-endpoints der skal sætte/nulstille brugeres password,
// fx /api/admin/set-temp-password.

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
		// cloud-platform scope dækker både Firestore + Identity Toolkit
		scope: 'https://www.googleapis.com/auth/cloud-platform',
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

/**
 * Slår en bruger op via email-feltet i Firebase Auth. Returnerer brugerens
 * localId (UID) hvis hun findes, ellers null.
 */
export async function findUidByEmail(email: string): Promise<string | null> {
	const sa = laesServiceAccount();
	const token = await hentAccessToken();
	const res = await fetch(
		`https://identitytoolkit.googleapis.com/v1/projects/${sa.projectId}/accounts:lookup`,
		{
			method: 'POST',
			headers: {
				Authorization: `Bearer ${token}`,
				'Content-Type': 'application/json'
			},
			body: JSON.stringify({ email: [email] })
		}
	);
	if (!res.ok) {
		const tekst = await res.text();
		throw new Error(`accounts:lookup fejlede (${res.status}): ${tekst}`);
	}
	const data = (await res.json()) as { users?: Array<{ localId: string }> };
	return data.users?.[0]?.localId ?? null;
}

/**
 * Sætter et nyt password på brugerens Firebase Auth-konto. Brugerens
 * eksisterende sessions invalideres ikke automatisk — hun forbliver
 * logget ind på enheder hvor token-cachen stadig er gyldig (typisk op
 * til 1 time). Hvis du vil tvinge re-login, brug også revokeRefreshTokens.
 */
export async function setUserPassword(uid: string, newPassword: string): Promise<void> {
	const sa = laesServiceAccount();
	const token = await hentAccessToken();
	const res = await fetch(
		`https://identitytoolkit.googleapis.com/v1/projects/${sa.projectId}/accounts:update`,
		{
			method: 'POST',
			headers: {
				Authorization: `Bearer ${token}`,
				'Content-Type': 'application/json'
			},
			body: JSON.stringify({ localId: uid, password: newPassword })
		}
	);
	if (!res.ok) {
		const tekst = await res.text();
		throw new Error(`accounts:update fejlede (${res.status}): ${tekst}`);
	}
}

/**
 * Genererer en 6-cifret midlertidig adgangskode. Kun tal — nemt at taste
 * paa en telefon (ingen skift mellem caps/lowercase/tal-tastatur) og
 * nemt at laese op. Firebase Auth har rate-limiting indbygget mod
 * brute-force, saa 6 cifre er sikkerhedsmaessigt tilstraekkeligt for
 * en midlertidig kode der erstattes straks efter login.
 */
export function genererTempPassword(laengde = 6): string {
	const tegn = '0123456789';
	const buffer = new Uint8Array(laengde);
	crypto.getRandomValues(buffer);
	let kode = '';
	for (let i = 0; i < laengde; i++) {
		kode += tegn[buffer[i] % tegn.length];
	}
	return kode;
}
