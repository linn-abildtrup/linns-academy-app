// Foreslå madplan endpoint — kører på Cloudflare Pages Workers runtime.
//
// Modtager brugerens daglige mål + en pre-filtreret pulje af kandidat-
// opskrifter og beder Claude vælge 1-3 forslag pr måltidstype.
//
// Auth: Firebase ID-token + premium-adgang.
// Rate-limit: deler kvota med Linn AI + analyser-opskrift (20/dag pr bruger).

import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { env } from '$env/dynamic/private';
import { PUBLIC_FIREBASE_API_KEY } from '$env/static/public';
import { hentDoc, gemDocMerge } from '$lib/server/firestoreRest';
import { MAX_QUERIES_PR_DAG, quotaNoegle } from '$lib/content/linnAi';
import {
	validerRequest,
	validerSvar,
	type ForeslaaRequest,
	type MadplanSvar
} from '$lib/content/foreslaaMadplan';
import type { UserDoc } from '$lib/types';
import { harPremium } from '$lib/utils/userAdgang';

const MODEL = 'claude-sonnet-4-5-20250929';
const MAX_TOKENS = 2048;

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

function byggSystemPrompt(req: ForeslaaRequest): string {
	const favoritLinje =
		req.favoritFoodNavne.length > 0
			? `\nHun har markeret disse som favorit-fødevarer (foretræk opskrifter der bruger dem hvis muligt): ${req.favoritFoodNavne.join(', ')}.`
			: '';
	const undgaaLinje =
		req.undgaaIngredienser.length > 0
			? `\nHun vil IKKE have disse ingredienser: ${req.undgaaIngredienser.join(', ')}.`
			: '';
	const glutenLinje = req.glutenfri
		? '\nKun glutenfri opskrifter må foreslås.'
		: '';

	return `Du er en dansk klinisk kostvejleder der bygger en madplan til én dag for en kvinde i overgangsalderen.

Hendes daglige næringsmål:
- Protein: ${req.maal.protein}g
- Fiber: ${req.maal.fiber}g
- Kulhydrater: ${req.maal.kh}g
- Fedt: ${req.maal.fedt}g
- Kalorier: ${req.maal.kcal} kcal${favoritLinje}${undgaaLinje}${glutenLinje}

Din opgave:
1. Modtag pulje af kandidat-opskrifter i bruger-beskeden (allerede filtreret efter glutenfri- og undgå-krav).
2. Vælg ${req.antalAlternativer} forslag til MORGENMAD, ${req.antalAlternativer} til FROKOST og ${req.antalAlternativer} til AFTENSMAD.
3. Vælg så kombinationen tilsammen (1 fra hver kategori) rammer dagens mål bedst muligt — særligt protein og fiber.
4. Prioriter variation: hvis brugeren får flere alternativer, så gør dem forskellige (forskellig protein-kilde, forskellige hovedingredienser).
5. Hvert forslag skal pege på et opskriftId fra puljen. Ingen påfund — vælg KUN fra de leverede opskrifter.
6. Skriv en kort 'hvorforPasser'-tekst (max 1 sætning) der forklarer hvorfor netop denne opskrift er god til hendes dag.
7. Hvis du ikke kan finde ${req.antalAlternativer} egnede til en kategori, så lever færre — bedre 1 godt forslag end 3 dårlige.

Returnér KUN JSON i dette format (intet andet, ingen markdown, ingen forklaring):

{
  "morgenmad": [
    {
      "opskriftId": "<id fra puljen>",
      "erEgen": <true hvis fra brugerens egen samling, ellers false>,
      "hvorforPasser": "<1 sætning>"
    }
  ],
  "frokost": [...],
  "aftensmad": [...],
  "samletBegrundelse": "<1-2 sætninger om hvordan kombinationen rammer dagens mål>",
  "advarsel": "<valgfri — kun hvis du ikke kunne overholde alle krav>"
}

Vær realistisk og praktisk. Brug danske ingredienser og portionsstørrelser.`;
}

function byggBrugerBesked(req: ForeslaaRequest): string {
	// Komprimér kandidat-data så prompten ikke svulmer for meget.
	// Send id + titel + kategori + makro + de første 6 ingredienser.
	const forenklet = req.kandidater.map((k) => ({
		id: k.id,
		titel: k.titel,
		kategori: k.kategori,
		erEgen: k.erEgen ?? false,
		protein: k.protein,
		fiber: k.fiber,
		kalorier: k.kalorier,
		ingredienser: k.ingredienser.slice(0, 6).join(', ')
	}));
	return `Her er puljen af opskrifter at vælge fra (${forenklet.length} stk):\n\n${JSON.stringify(forenklet, null, 0)}\n\nVælg ${req.antalAlternativer} forslag pr måltidstype som beskrevet.`;
}

export const POST: RequestHandler = async ({ request }) => {
	const apiKey = env.ANTHROPIC_API_KEY;
	if (!apiKey) throw error(500, 'ANTHROPIC_API_KEY mangler i Cloudflare env');

	const auth = request.headers.get('Authorization');
	if (!auth?.startsWith('Bearer ')) throw error(401, 'Manglende Bearer-token');
	const uid = await verificerToken(auth.slice(7));
	if (!uid) throw error(401, 'Ugyldig token');

	let body: ForeslaaRequest;
	try {
		body = await request.json();
	} catch {
		throw error(400, 'Ugyldig JSON');
	}
	const valFejl = validerRequest(body);
	if (valFejl) throw error(400, valFejl);

	const userDoc = (await hentDoc(`users/${uid}`)) as UserDoc | null;
	const erPremium = harPremium(userDoc) || userDoc?.adminKlientMode === 'premiumapp';
	if (!erPremium) throw error(403, 'Funktionen kræver premium-adgang');

	const noegle = quotaNoegle();
	const quotaPath = `users/${uid}/linnAiQuotaer/${noegle}`;
	const quotaDoc = (await hentDoc(quotaPath)) as { antal?: number } | null;
	const antalIDag = quotaDoc?.antal ?? 0;
	if (antalIDag >= MAX_QUERIES_PR_DAG) {
		throw error(429, `Du har brugt dine ${MAX_QUERIES_PR_DAG} daglige AI-queries. Prøv igen i morgen.`);
	}

	const systemPrompt = byggSystemPrompt(body);
	const brugerBesked = byggBrugerBesked(body);

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
			system: systemPrompt,
			messages: [{ role: 'user', content: brugerBesked }]
		})
	});

	if (!anthropicRes.ok) {
		const errText = await anthropicRes.text();
		console.error('Anthropic foreslaa-fejl:', anthropicRes.status, errText);
		throw error(502, 'AI-tjenesten svarede ikke. Prøv igen.');
	}
	const anthropicData = (await anthropicRes.json()) as {
		content: Array<{ type: string; text?: string }>;
	};
	const tekst = anthropicData.content
		.filter((c) => c.type === 'text')
		.map((c) => c.text ?? '')
		.join('');

	let jsonTekst = tekst.trim();
	if (jsonTekst.startsWith('```')) {
		jsonTekst = jsonTekst.replace(/^```(?:json)?\s*/, '').replace(/\s*```$/, '');
	}
	let parsed: MadplanSvar;
	try {
		parsed = JSON.parse(jsonTekst) as MadplanSvar;
	} catch {
		console.error('Kunne ikke parse foreslaa-svar:', tekst.slice(0, 500));
		throw error(502, 'AI gav ugyldigt svar. Prøv igen.');
	}

	const kandidatIds = new Set(body.kandidater.map((k) => k.id));
	const svarFejl = validerSvar(parsed, body.antalAlternativer, kandidatIds);
	if (svarFejl) {
		console.error('Ugyldigt foreslaa-svar:', svarFejl, JSON.stringify(parsed).slice(0, 500));
		throw error(502, 'AI gav et svar i forkert format. Prøv igen.');
	}

	await gemDocMerge(quotaPath, { antal: antalIDag + 1, sidste: Date.now() });

	return json(parsed);
};
