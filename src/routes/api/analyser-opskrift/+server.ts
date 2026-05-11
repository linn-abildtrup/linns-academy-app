// Analyser-opskrift endpoint — kører på Cloudflare Pages Workers runtime.
//
// Modtager base64-billede + media-type. Sender til Claude Sonnet med vision
// for at læse opskriften og estimere makro-næring pr portion. Returnerer
// JSON svar som klienten kan vise + redigere før gem.
//
// Auth: Firebase ID-token + premium-adgang.
// Rate-limit: deler quota med Linn AI (samme 20/dag-grænse for at undgå
// uventet høje cost).

import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { env } from '$env/dynamic/private';
import { PUBLIC_FIREBASE_API_KEY } from '$env/static/public';
import { hentDoc, gemDocMerge } from '$lib/server/firestoreRest';
import { MAX_QUERIES_PR_DAG, quotaNoegle } from '$lib/content/linnAi';

const MODEL = 'claude-sonnet-4-5-20250929';
const MAX_TOKENS = 2048;
const MAX_IMAGE_BYTES = 5 * 1024 * 1024; // 5 MB

async function verificerToken(idToken: string): Promise<string | null> {
	if (!PUBLIC_FIREBASE_API_KEY) return null;
	try {
		const res = await fetch(
			`https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${PUBLIC_FIREBASE_API_KEY}`,
			{
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ idToken })
			}
		);
		if (!res.ok) return null;
		const data = (await res.json()) as { users?: Array<{ localId: string }> };
		return data.users?.[0]?.localId ?? null;
	} catch (e) {
		console.warn('Token-verifikation fejlede:', e);
		return null;
	}
}

const SYSTEM_PROMPT = `Du analyserer billeder af madopskrifter og estimerer næringsindhold.

Du får et billede af en opskrift (kogebog, blad, screenshot, hjemmeside, håndskrift osv).

Din opgave:
1. Læs opskriftens navn (titel)
2. Find antallet af portioner. Hvis ikke angivet, antag 4 personer.
3. List alle ingredienser med mængder og enheder (gram, dl, spsk, stk osv.)
4. Estimér samlede makro for HELE opskriften (alle portioner), så divider med antal portioner for at få MAKRO PR PORTION.
5. Brug danske kost-tabeller (Frida) som reference.

Returnér KUN JSON i dette format (intet andet, ingen markdown, ingen forklaring):

{
  "navn": "<opskriftens titel>",
  "antalPortioner": <tal>,
  "ingredienser": [
    {"navn": "<ingrediens>", "maengde": <tal>, "enhed": "<g|dl|spsk|tsk|stk|...>"}
  ],
  "makroPrPortion": {
    "protein": <gram>,
    "fiber": <gram>,
    "kh": <gram kulhydrater>,
    "fedt": <gram>,
    "kcal": <kalorier>
  }
}

Hvis billedet ikke indeholder en opskrift, returnér:
{"error": "Billedet indeholder ikke en madopskrift"}

Vær realistisk i dine estimater. En portion kødfrikadeller med kartofler kan typisk være 400-600 kcal. En portion salat 150-400 kcal.`;

export const POST: RequestHandler = async ({ request }) => {
	const apiKey = env.ANTHROPIC_API_KEY;
	if (!apiKey) throw error(500, 'ANTHROPIC_API_KEY mangler i Cloudflare env');

	const auth = request.headers.get('Authorization');
	if (!auth?.startsWith('Bearer ')) throw error(401, 'Manglende Bearer-token');
	const uid = await verificerToken(auth.slice(7));
	if (!uid) throw error(401, 'Ugyldig token');

	let body: { billedeBase64: string; mediaType: string };
	try {
		body = await request.json();
	} catch {
		throw error(400, 'Ugyldig JSON');
	}
	if (!body.billedeBase64 || !body.mediaType) throw error(400, 'Mangler billede');
	// Sanity-check størrelse — base64 er ~33% større end binær
	const estStr = body.billedeBase64.length * 0.75;
	if (estStr > MAX_IMAGE_BYTES) throw error(413, 'Billedet er for stort (max 5 MB)');

	// Premium-adgang
	const userDoc = (await hentDoc(`users/${uid}`)) as
		| { accessLevel?: string; adminKlientMode?: string }
		| null;
	const erPremium =
		userDoc?.accessLevel === 'premium' ||
		userDoc?.adminKlientMode === 'premiumapp' ||
		userDoc?.adminKlientMode === 'forlob';
	if (!erPremium) throw error(403, 'Funktionen kræver premium-adgang');

	// Rate-limit (deler kvota med Linn AI)
	const noegle = quotaNoegle();
	const quotaPath = `users/${uid}/linnAiQuotaer/${noegle}`;
	const quotaDoc = (await hentDoc(quotaPath)) as { antal?: number } | null;
	const antalIDag = quotaDoc?.antal ?? 0;
	if (antalIDag >= MAX_QUERIES_PR_DAG) {
		throw error(429, `Du har brugt dine ${MAX_QUERIES_PR_DAG} daglige AI-queries. Prøv igen i morgen.`);
	}

	// Kald Anthropic med vision
	const anthropicRes = await fetch('https://api.anthropic.com/v1/messages', {
		method: 'POST',
		headers: {
			'x-api-key': apiKey,
			'anthropic-version': '2023-06-01',
			'content-type': 'application/json'
		},
		body: JSON.stringify({
			model: MODEL,
			max_tokens: MAX_TOKENS,
			system: SYSTEM_PROMPT,
			messages: [
				{
					role: 'user',
					content: [
						{
							type: 'image',
							source: {
								type: 'base64',
								media_type: body.mediaType,
								data: body.billedeBase64
							}
						},
						{
							type: 'text',
							text: 'Analysér denne opskrift og returnér det specificerede JSON.'
						}
					]
				}
			]
		})
	});

	if (!anthropicRes.ok) {
		const errText = await anthropicRes.text();
		console.error('Anthropic vision-fejl:', anthropicRes.status, errText);
		throw error(502, 'AI-tjenesten svarede ikke. Prøv igen.');
	}
	const anthropicData = (await anthropicRes.json()) as {
		content: Array<{ type: string; text?: string }>;
	};
	const tekst = anthropicData.content
		.filter((c) => c.type === 'text')
		.map((c) => c.text ?? '')
		.join('');

	// Parse JSON — fjern eventuel markdown
	let jsonTekst = tekst.trim();
	if (jsonTekst.startsWith('```')) {
		jsonTekst = jsonTekst.replace(/^```(?:json)?\s*/, '').replace(/\s*```$/, '');
	}
	let parsed: unknown;
	try {
		parsed = JSON.parse(jsonTekst);
	} catch (e) {
		console.error('Kunne ikke parse vision-svar:', tekst.slice(0, 500));
		throw error(502, 'AI gav ugyldigt svar. Prøv igen med et tydeligere billede.');
	}

	// Opdater quota efter succes
	await gemDocMerge(quotaPath, { antal: antalIDag + 1, sidste: Date.now() });

	return json(parsed);
};
