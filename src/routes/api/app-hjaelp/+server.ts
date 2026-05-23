// App-hjælp endpoint — separat fra Linn AI. Svarer KUN på spørgsmål om
// hvordan appen virker. Knowledge base ligger som TypeScript-konstanter
// i $lib/content/appHjaelp og bygges dynamisk pr bruger så vi kun viser
// features hun faktisk har adgang til (basis vs premium, abo vs forløb).
//
// Auth: Firebase ID-token i Authorization-header.
// Rate-limit: 30 queries pr bruger pr dag (egen quota, separat fra Linn AI).

import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { env } from '$env/dynamic/private';
import { PUBLIC_FIREBASE_API_KEY } from '$env/static/public';
import { hentDoc, gemDocMerge } from '$lib/server/firestoreRest';
import {
	APP_HJAELP_MAX_QUERIES_PR_DAG,
	appHjaelpQuotaNoegle,
	byggAppHjaelpSystemPrompt
} from '$lib/content/appHjaelp';
import type { ActiveProduct } from '$lib/types';

const ANTHROPIC_MODEL = 'claude-haiku-4-5-20251001';
const MAX_TOKENS = 1024;

interface IndkommendeBesked {
	rolle: 'user' | 'assistant';
	indhold: string;
}

async function verificerToken(idToken: string): Promise<string | null> {
	if (!PUBLIC_FIREBASE_API_KEY) {
		console.error('PUBLIC_FIREBASE_API_KEY mangler ved build-tid');
		return null;
	}
	try {
		const res = await fetch(
			`https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${PUBLIC_FIREBASE_API_KEY}`,
			{
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ idToken })
			}
		);
		if (!res.ok) {
			const errText = await res.text();
			console.warn('Token-verifikation HTTP-fejl:', res.status, errText);
			return null;
		}
		const data = (await res.json()) as { users?: Array<{ localId: string }> };
		return data.users?.[0]?.localId ?? null;
	} catch (e) {
		console.warn('Token-verifikation fejlede:', e);
		return null;
	}
}

export const POST: RequestHandler = async ({ request }) => {
	const apiKey = env.ANTHROPIC_API_KEY;
	if (!apiKey) {
		throw error(500, 'ANTHROPIC_API_KEY mangler i Cloudflare Pages env-vars');
	}

	const auth = request.headers.get('Authorization');
	if (!auth?.startsWith('Bearer ')) {
		throw error(401, 'Manglende Bearer-token');
	}
	const idToken = auth.slice(7);
	const uid = await verificerToken(idToken);
	if (!uid) throw error(401, 'Ugyldig token');

	let body: { besked: string; samtaleHistorik?: IndkommendeBesked[] };
	try {
		body = await request.json();
	} catch {
		throw error(400, 'Ugyldig JSON');
	}

	const besked = body.besked?.trim();
	if (!besked) throw error(400, 'Tom besked');
	const historik = body.samtaleHistorik ?? [];

	// Hent bruger-doc så vi ved hvilke features hun har adgang til.
	// App-hjælp er tilgængeligt for ALLE betalende kunder, men knowledge base
	// filtreres efter activeProduct så hun ikke får svar om features hun
	// ikke har adgang til.
	const userDoc = (await hentDoc(`users/${uid}`)) as
		| { activeProduct?: ActiveProduct; adminKlientMode?: string; accessLevel?: string }
		| null;

	// Admin kan teste i klient-mode — vi udleder activeProduct fra mode
	let activeProduct = userDoc?.activeProduct;
	if (userDoc?.adminKlientMode === 'basisapp') activeProduct = 'basisabo';
	else if (userDoc?.adminKlientMode === 'premiumapp') activeProduct = 'premiumabo';

	// Rate-limit
	const noegle = appHjaelpQuotaNoegle();
	const quotaPath = `users/${uid}/appHjaelpQuotaer/${noegle}`;
	const quotaDoc = (await hentDoc(quotaPath)) as { antal?: number } | null;
	const antalIDag = quotaDoc?.antal ?? 0;
	if (antalIDag >= APP_HJAELP_MAX_QUERIES_PR_DAG) {
		throw error(
			429,
			`Du har brugt dine ${APP_HJAELP_MAX_QUERIES_PR_DAG} daglige spørgsmål til App-hjælp. Prøv igen i morgen.`
		);
	}

	const systemPrompt = byggAppHjaelpSystemPrompt(activeProduct);

	const messages: Array<{ role: 'user' | 'assistant'; content: string }> = [];
	for (const m of historik) {
		messages.push({ role: m.rolle, content: m.indhold });
	}
	messages.push({ role: 'user', content: besked });

	const anthropicRes = await fetch('https://api.anthropic.com/v1/messages', {
		method: 'POST',
		headers: {
			'x-api-key': apiKey,
			'anthropic-version': '2023-06-01',
			'content-type': 'application/json'
		},
		body: JSON.stringify({
			model: ANTHROPIC_MODEL,
			max_tokens: MAX_TOKENS,
			system: systemPrompt,
			messages
		})
	});

	if (!anthropicRes.ok) {
		const errorText = await anthropicRes.text();
		console.error('Anthropic API fejl:', anthropicRes.status, errorText);
		throw error(502, 'AI-tjenesten svarede ikke. Prøv igen om lidt.');
	}

	const anthropicData = (await anthropicRes.json()) as {
		content: Array<{ type: string; text?: string }>;
	};
	const svar = anthropicData.content
		.filter((c) => c.type === 'text')
		.map((c) => c.text ?? '')
		.join('');

	await gemDocMerge(quotaPath, { antal: antalIDag + 1, sidste: Date.now() });

	return json({
		svar,
		queriesIDag: antalIDag + 1,
		queriesMaks: APP_HJAELP_MAX_QUERIES_PR_DAG
	});
};
