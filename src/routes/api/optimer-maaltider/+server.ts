// Optimér min mad endpoint — kører på Cloudflare Pages Workers runtime.
//
// Modtager dagens måltider + brugerens daglige næringsmål + diet-tags.
// Sender til Claude Sonnet og beder den foreslå små bytter/tilføjelser
// så protein- og fiber-målet rammes uden at sprænge kcal-budgettet.
//
// Auth: Firebase ID-token + premium-adgang (samme tjek som analyser-opskrift).
// Rate-limit: deler kvota med Linn AI + analyser-opskrift (20/dag pr bruger).

import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { env } from '$env/dynamic/private';
import { PUBLIC_FIREBASE_API_KEY } from '$env/static/public';
import { hentDoc, gemDocMerge } from '$lib/server/firestoreRest';
import { MAX_QUERIES_PR_DAG, quotaNoegle } from '$lib/content/linnAi';
import {
	kcalTolerance,
	valierOptimerSvar,
	type OptimerSvar
} from '$lib/content/optimerMaaltider';
import type { DagligeMaal, UserDoc } from '$lib/types';
import type { GemtMaaltid } from '$lib/content/kost';
import { harPremium } from '$lib/utils/userAdgang';

const MODEL = 'claude-sonnet-4-5-20250929';
const MAX_TOKENS = 2048;

interface IndkommendeRequest {
	maaltider: GemtMaaltid[];
	maal: DagligeMaal;
	dietTags?: string[];
}

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

function byggSystemPrompt(maal: DagligeMaal, dietTags: string[]): string {
	const tolerance = kcalTolerance(maal.kcal);
	const dietLinje = dietTags.length > 0 ? `\nDiæt-krav: ${dietTags.join(', ')}.` : '';

	return `Du er en dansk klinisk kostvejleder der hjælper en klient med at optimere dagens måltider.

Klientens daglige mål:
- Protein: ${maal.protein}g
- Fiber: ${maal.fiber}g
- Kulhydrater: ${maal.kh}g
- Fedt: ${maal.fedt}g
- Kalorier: ${maal.kcal} kcal${dietLinje}

Din opgave:
1. Kig på dagens måltider (sendes som JSON i bruger-beskeden).
2. Foreslå små, realistiske bytter, tilføjelser eller fjernelser så **protein og fiber** rammer målet.
3. Kalorierne SKAL forblive inden for ±${tolerance} kcal af målet (${maal.kcal} kcal). Hvis et tilføjet element ville sprænge kcal-budgettet, så fjern eller byt noget andet i stedet for kun at tilføje.
4. Hvis du ikke kan ramme protein/fiber-målet inden for kcal-budgettet, så vær ærlig om det i 'advarsel'-feltet og foreslå det bedste kompromis.
5. Vær konservativ: foretrækker små bytter (fx "byt almindelig pasta til proteinpasta", "tilføj 30g valnødder") frem for at omskrive hele måltidet.
6. Hvis et måltid allerede er optimalt, så lad det stå — du behøver ikke ændre noget i hvert måltid.
7. Du må gerne foreslå at tilføje en snack hvis brugeren ikke har en, og det hjælper med at ramme målet — brug da maaltidId='NY_snack' og maaltidType='snack'.

Returnér KUN JSON i dette format (intet andet, ingen markdown, ingen forklaring):

{
  "diff": [
    {
      "maaltidId": "<id fra input, eller 'NY_snack' for nyt måltid>",
      "maaltidNavn": "<navn på måltidet>",
      "maaltidType": "morgenmad" | "frokost" | "aftensmad" | "snack",
      "handling": "tilfoej" | "fjern" | "byt",
      "tekst": "<kort beskrivelse, fx 'Tilføj 30g valnødder'>",
      "begrundelse": "<hvorfor, fx 'Bidrager med 5g protein og 3g fiber'>",
      "makroDelta": {
        "protein": <gram, positiv eller negativ>,
        "fiber": <gram>,
        "kh": <gram>,
        "fedt": <gram>,
        "kcal": <kalorier>
      }
    }
  ],
  "resultatMakro": {
    "protein": <samlet dags-makro EFTER ændringer>,
    "fiber": <...>,
    "kh": <...>,
    "fedt": <...>,
    "kcal": <...>
  },
  "samletBegrundelse": "<1-2 sætninger, fx 'Du rammer nu både protein og fiber inden for dit kcal-budget ved at bytte pastaen og tilføje skyr som snack.'>",
  "advarsel": "<valgfri — kun hvis du ikke kunne ramme målet>"
}

Vær realistisk og praktisk. Brug danske ingredienser og portionsstørrelser.`;
}

function byggBrugerBesked(maaltider: GemtMaaltid[]): string {
	const forenklet = maaltider.map((m) => ({
		id: m.id,
		navn: m.navn,
		type: m.type,
		makro: {
			protein: Math.round(m.totalP * 10) / 10,
			fiber: Math.round(m.totalF * 10) / 10,
			kh: Math.round((m.totalKh ?? 0) * 10) / 10,
			fedt: Math.round((m.totalFedt ?? 0) * 10) / 10,
			kcal: Math.round(m.totalKcal ?? 0)
		},
		ingredienser: m.items.map((i) => {
			if (i.manuel) return `${i.manuel.navn} (${i.portion} ${i.manuel.enhed})`;
			return `${i.foodId} (${i.portion}${i.enhedId ?? 'g'})`;
		})
	}));

	if (forenklet.length === 0) {
		return 'Brugeren har ikke logget nogen måltider endnu i dag. Foreslå en samlet dagsplan ud fra hendes mål.';
	}

	return `Her er dagens måltider:\n\n${JSON.stringify(forenklet, null, 2)}\n\nOptimer dem så protein- og fiber-målet rammes inden for kcal-budgettet.`;
}

export const POST: RequestHandler = async ({ request }) => {
	const apiKey = env.ANTHROPIC_API_KEY;
	if (!apiKey) throw error(500, 'ANTHROPIC_API_KEY mangler i Cloudflare env');

	const auth = request.headers.get('Authorization');
	if (!auth?.startsWith('Bearer ')) throw error(401, 'Manglende Bearer-token');
	const uid = await verificerToken(auth.slice(7));
	if (!uid) throw error(401, 'Ugyldig token');

	let body: IndkommendeRequest;
	try {
		body = await request.json();
	} catch {
		throw error(400, 'Ugyldig JSON');
	}
	if (!Array.isArray(body.maaltider)) throw error(400, 'maaltider mangler');
	if (!body.maal || typeof body.maal !== 'object') throw error(400, 'maal mangler');

	// Premium-adgang. harPremium håndterer udlobet/bonus-periode korrekt.
	const userDoc = (await hentDoc(`users/${uid}`)) as UserDoc | null;
	const erPremium =
		harPremium(userDoc) || userDoc?.adminKlientMode === 'premiumapp';
	if (!erPremium) throw error(403, 'Funktionen kræver premium-adgang');

	// Rate-limit (deler kvota med Linn AI + analyser-opskrift)
	const noegle = quotaNoegle();
	const quotaPath = `users/${uid}/linnAiQuotaer/${noegle}`;
	const quotaDoc = (await hentDoc(quotaPath)) as { antal?: number } | null;
	const antalIDag = quotaDoc?.antal ?? 0;
	if (antalIDag >= MAX_QUERIES_PR_DAG) {
		throw error(429, `Du har brugt dine ${MAX_QUERIES_PR_DAG} daglige AI-queries. Prøv igen i morgen.`);
	}

	const systemPrompt = byggSystemPrompt(body.maal, body.dietTags ?? []);
	const brugerBesked = byggBrugerBesked(body.maaltider);

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
		console.error('Anthropic optimer-fejl:', anthropicRes.status, errText);
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
	let parsed: unknown;
	try {
		parsed = JSON.parse(jsonTekst);
	} catch {
		console.error('Kunne ikke parse optimer-svar:', tekst.slice(0, 500));
		throw error(502, 'AI gav ugyldigt svar. Prøv igen.');
	}

	const valideringsFejl = valierOptimerSvar(parsed);
	if (valideringsFejl) {
		console.error('Ugyldigt optimer-svar:', valideringsFejl, JSON.stringify(parsed).slice(0, 500));
		throw error(502, 'AI gav et svar i forkert format. Prøv igen.');
	}

	// Opdater quota efter succes
	await gemDocMerge(quotaPath, { antal: antalIDag + 1, sidste: Date.now() });

	return json(parsed as OptimerSvar);
};
