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

/**
 * Statisk del af system-prompten — rolle + JSON-format + generelle regler.
 * Ændrer sig ikke mellem requests, så Anthropic kan caches den (~600 tokens).
 */
const STATIC_SYSTEM = `Du er en dansk klinisk kostvejleder der bygger en madplan til én dag for en kvinde i overgangsalderen.

Din opgave:
1. Modtag en pulje af kandidat-opskrifter (kommer i den næste system-blok) plus klientens daglige mål og filtre (kommer i bruger-beskeden).
2. Vælg det ønskede antal forslag til MORGENMAD, FROKOST og AFTENSMAD.
3. Filtrer kandidaterne efter reglerne:
   - Hvis bruger har angivet "kun glutenfri", så vælg KUN opskrifter der har 'glutenfri' i deres dietTags.
   - Hvis bruger har angivet ingredienser at undgå, så udelad opskrifter hvor en af deres ingredienser indeholder de angivne ord (case-insensitive substring-match).
4. Vælg så kombinationen tilsammen (1 fra hver kategori) rammer MINDST 80% af klientens protein-mål OG 80% af hendes fiber-mål. Dette er et hårdt krav — vælg ikke kombinationer der ligger under, hvis det er muligt at undgå.
5. Prioriter variation: hvis brugeren får flere alternativer, så gør dem forskellige (forskellig protein-kilde, forskellige hovedingredienser).
6. Hvis brugeren har favorit-fødevarer, foretræk opskrifter der bruger dem hvis muligt.
7. Hvert forslag skal pege på et opskriftId fra puljen. Ingen påfund — vælg KUN fra de leverede opskrifter.
8. Skriv en kort 'hvorforPasser'-tekst (max 1 sætning) der forklarer hvorfor netop denne opskrift passer.
9. Hvis du ikke kan finde nok egnede til en kategori, så lever færre — bedre 1 godt forslag end 3 dårlige.

10. Lav også en liste af 3-5 NEMME snack-suppleringer ("snacks") brugeren kan tilføje i løbet af dagen for at nå 100% af sit mål. Eksempler:
    - "Et æble" (0.5 g protein, 4 g fiber)
    - "Et hårdkogt æg" (6 g protein, 0 g fiber)
    - "100g græsk yoghurt med 30g hindbær" (10 g protein, 2 g fiber)
    - "En gulerod" (1 g protein, 3 g fiber)
    - "Lille håndfuld mandler (15g)" (3 g protein, 2 g fiber)
    - "30g hummus med 1 stang selleri" (2 g protein, 2 g fiber)
    Snacks skal være KORTE, KONKRETE og INDEN FOR rimelige portionsstørrelser. Brug danske ingredienser.

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
  "snacks": [
    { "tekst": "Et æble", "protein": 0.5, "fiber": 4 },
    { "tekst": "Et hårdkogt æg", "protein": 6, "fiber": 0 }
  ],
  "samletBegrundelse": "<1-2 sætninger om hvordan kombinationen rammer dagens mål>",
  "advarsel": "<valgfri — kun hvis du ikke kunne overholde alle krav>"
}

Vær realistisk og praktisk. Brug danske ingredienser og portionsstørrelser.`;

/**
 * Bygger kandidat-katalog som JSON-streng. Hvis klienten sender samme pool
 * to gange inden for 5 minutter, får anden request cache-hit på dette block
 * (90% billigere på input-tokens for denne del).
 */
function byggKandidatKatalog(kandidater: ForeslaaRequest['kandidater']): string {
	const forenklet = kandidater.map((k) => ({
		id: k.id,
		titel: k.titel,
		kategori: k.kategori,
		erEgen: k.erEgen ?? false,
		protein: k.protein,
		fiber: k.fiber,
		kalorier: k.kalorier,
		dietTags: k.dietTags,
		ingredienser: k.ingredienser.slice(0, 8).join(', ')
	}));
	return `KANDIDAT-POOL (${forenklet.length} opskrifter at vælge fra):\n\n${JSON.stringify(forenklet, null, 0)}`;
}

/**
 * Bruger-besked med de variabler der ændrer sig fra request til request:
 * mål, filtre, antal alternativer, favoritter. Ikke cacheable.
 */
function byggBrugerBesked(req: ForeslaaRequest): string {
	const favoritLinje =
		req.favoritFoodNavne.length > 0
			? `Favorit-fødevarer (foretræk hvis muligt): ${req.favoritFoodNavne.join(', ')}.`
			: 'Ingen særlige favorit-fødevarer.';
	const undgaaLinje =
		req.undgaaIngredienser.length > 0
			? `Udelad opskrifter med disse ingredienser: ${req.undgaaIngredienser.join(', ')}.`
			: 'Ingen ingredienser at undgå.';
	const glutenLinje = req.glutenfri
		? 'Kun glutenfri (vælg kun opskrifter med "glutenfri" i dietTags).'
		: 'Glutenfri er ikke et krav.';

	return `Klientens daglige næringsmål:
- Protein: ${req.maal.protein}g
- Fiber: ${req.maal.fiber}g
- Kulhydrater: ${req.maal.kh}g
- Fedt: ${req.maal.fedt}g
- Kalorier: ${req.maal.kcal} kcal

Filtre:
- ${glutenLinje}
- ${undgaaLinje}
- ${favoritLinje}

Vælg ${req.antalAlternativer} forslag pr måltidstype (morgenmad, frokost, aftensmad) fra kandidat-poolen ovenfor.`;
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

	const kandidatKatalog = byggKandidatKatalog(body.kandidater);
	const brugerBesked = byggBrugerBesked(body);

	// System-promtet sendes som array af blocks så vi kan sætte cache_control
	// på kandidat-katalog. Anthropic cacher alt fra start til markøren — så
	// både STATIC_SYSTEM og kandidat-katalog cached i 5 min. Cache-hit giver
	// ~90% billigere input-tokens for den cachede del. Hvis to brugere kører
	// foreslå-madplan inden for 5 min med samme opskrift-pool, betaler den
	// anden kun en brøkdel for de ~7000 tokens katalog.
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
			system: [
				{ type: 'text', text: STATIC_SYSTEM },
				{
					type: 'text',
					text: kandidatKatalog,
					cache_control: { type: 'ephemeral' }
				}
			],
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
