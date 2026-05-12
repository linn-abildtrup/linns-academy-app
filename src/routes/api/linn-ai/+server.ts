// Linn AI endpoint — kører på Cloudflare Pages Workers runtime.
//
// Modtager bruger-besked + samtale-historik. Bygger system-prompt fra
// Linns videnbase (linnAiVidenbase-collection i Firestore) og kalder
// Anthropic Claude. Returnerer assistant-svar.
//
// Rate-limit: max 20 queries pr bruger pr dag (gemt i quotaer-collection).
//
// Auth: forventer Firebase ID-token i Authorization-headeren. Verificerer
// at brugeren er authenticated via Google's tokeninfo-endpoint.

import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { env } from '$env/dynamic/private';
import { PUBLIC_FIREBASE_API_KEY } from '$env/static/public';
import { hentAlleDocs, hentDoc, gemDocMerge } from '$lib/server/firestoreRest';
import { byggKontekst, byggSystemPrompt, MAX_QUERIES_PR_DAG, quotaNoegle } from '$lib/content/linnAi';
import type { VidenbaseDokument } from '$lib/content/linnAi';

const ANTHROPIC_MODEL = 'claude-sonnet-4-5-20250929';
const MAX_TOKENS = 1024;

interface IndkommendeBesked {
	rolle: 'user' | 'assistant';
	indhold: string;
}

async function verificerToken(idToken: string): Promise<string | null> {
	// Verificer Firebase ID-token via Google identity toolkit.
	// Returnerer brugerens UID hvis valid, null ellers.
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

	// Tjek bruger-adgang: skal være premium for at bruge AI'en
	const userDoc = (await hentDoc(`users/${uid}`)) as
		| { accessLevel?: string; adminKlientMode?: string }
		| null;
	const erPremium =
		userDoc?.accessLevel === 'premium' ||
		userDoc?.adminKlientMode === 'premiumapp';
	if (!erPremium) {
		throw error(403, 'Linn AI kræver premium-adgang');
	}

	// Rate-limit
	const noegle = quotaNoegle();
	const quotaPath = `users/${uid}/linnAiQuotaer/${noegle}`;
	const quotaDoc = (await hentDoc(quotaPath)) as { antal?: number } | null;
	const antalIDag = quotaDoc?.antal ?? 0;
	if (antalIDag >= MAX_QUERIES_PR_DAG) {
		throw error(429, `Du har brugt dine ${MAX_QUERIES_PR_DAG} daglige queries. Prøv igen i morgen.`);
	}

	// Hent videnbase
	const docs = await hentAlleDocs('linnAiVidenbase');
	const videnbaseDokumenter: VidenbaseDokument[] = docs.map((d) => ({
		id: d.id,
		navn: (d.data.navn as string) ?? d.id,
		kilde: ((d.data.kilde as string) ?? 'manual') as VidenbaseDokument['kilde'],
		tekst: (d.data.tekst as string) ?? ''
	}));

	const kontekst = byggKontekst(videnbaseDokumenter, besked);

	// Hent admin's custom system-prompt hvis sat
	const konfig = (await hentDoc('linnAiKonfiguration/aktiv')) as
		| { systemPrompt?: string }
		| null;
	const systemPrompt = byggSystemPrompt(kontekst, konfig?.systemPrompt);

	// Byg messages-array til Anthropic
	const messages: Array<{ role: 'user' | 'assistant'; content: string }> = [];
	for (const m of historik) {
		messages.push({ role: m.rolle, content: m.indhold });
	}
	messages.push({ role: 'user', content: besked });

	// Kald Anthropic
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

	// Opdater quota efter succesfuld kald (så fejlede kald ikke tæller)
	await gemDocMerge(quotaPath, { antal: antalIDag + 1, sidste: Date.now() });

	return json({ svar, queriesIDag: antalIDag + 1, queriesMaks: MAX_QUERIES_PR_DAG });
};
