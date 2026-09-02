// ============================================================
// Estimer naering ud fra en SKREVEN opskrift.
//
// Linns oenske 1. september 2026: naar kunden skriver en opskrift selv,
// skal hun spoerges om appen skal proeve at gaette tallene, eller om hun
// selv vil skrive dem.
//
// EGET ENDEPUNKT, og ikke en gren i /api/analyser-opskrift. Den laeser
// billeder for 925 kunder i drift, og en ny gren derinde ville roere noget
// der virker. Det her er en ny fil ved siden af.
//
// Den deler til gengaeld ALT det der betyder noget med den: samme
// token-tjek, samme daglige pulje og samme svarform, saa skaermen kan
// behandle de to svar ens.
//
// DEN GAETTER, OG DET SKAL SIGES HOEJT PAA SKAERMEN. Tallene er et skoen
// ud fra ingrediensernes navne og maengder, ikke en opslag i en database.
// Kunden skal se dem og kunne rette dem, foer der gemmes.
// ============================================================

import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { env } from '$env/dynamic/private';
import { PUBLIC_FIREBASE_API_KEY } from '$env/static/public';
import { hentDoc, gemDocMerge } from '$lib/server/firestoreRest';
import { MAX_QUERIES_PR_DAG, quotaNoegle } from '$lib/content/linnAi';

const MODEL = 'claude-sonnet-4-6';
// Loeftet fra 2048 den 2. september 2026. Svaret indeholder et regnestykke
// pr ingrediens, saa en lang opskrift lob toer for plads midtvejs, og et
// halvt JSON-svar kunne ikke laeses. 60 ingredienser er loftet i forvejen,
// og de fylder cirka 4000 tokens, saa der er rigelig luft nu.
const MAX_TOKENS = 8192;
const MAX_INGREDIENSER = 60;

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
		console.warn('[estimer-opskrift] token fejlede:', e);
		return null;
	}
}

const SYSTEM_PROMPT = `Du estimerer naeringsindhold i en madopskrift ud fra en liste af ingredienser med maengder.

Du faar rettens navn, hvor mange portioner den raekker til, og ingredienserne. Der er INGEN billede. Du skal regne paa det du faar.

Saadan regner du:
1. Slaa hver ingrediens op i din viden om almindelige danske foedevarer
2. Regn hver ingrediens' bidrag for HELE den maengde der staar
3. Laeg dem sammen, og del med antal portioner

VIGTIGT om praecision:
- Undervurdér ALDRIG kalorie- og fedttaette ingredienser. Noedder, froe, olie, smoer, fede mejeriprodukter, ost, avocado og moerk chokolade bidrager med meget fedt (9 kcal/g) og dermed mange kalorier selv i smaa maengder.
- Regn additivt ud fra de faktiske ingredienser og maengder, aldrig ud fra et gaet paa hvad "en salat plejer at indeholde".
- Er en maengde ikke oplyst, saa antag en almindelig portion og regn med den.
- Sanity-tjek til sidst: kcal pr portion skal cirka svare til protein x 4 + kulhydrat x 4 + fedt x 9. Justér hvis det ikke passer.
- Salt, peber, krydderier og vand bidrager med nul. Tag dem med i listen, men med nuller.

Returnér KUN JSON i dette format, intet andet, ingen markdown og ingen forklaring:

{
  "makroPrIngrediens": [
    {"navn": "<ingrediens>", "kcal": <tal for HELE maengden>, "protein": <g>, "fedt": <g>, "kh": <g>, "fiber": <g>}
  ],
  "makroPrPortion": {
    "protein": <gram>,
    "fiber": <gram>,
    "kh": <gram kulhydrater>,
    "fedt": <gram>,
    "kcal": <kalorier>
  }
}

makroPrIngrediens er dit additive regnestykke for HELE opskriften, altsaa alle portioner. makroPrPortion skal vaere summen af makroPrIngrediens delt med antal portioner.

Kan du slet ikke regne paa det du har faaet, returnér:
{"error": "Der er ikke nok at regne paa"}`;

export const POST: RequestHandler = async ({ request }) => {
	const apiKey = env.ANTHROPIC_API_KEY;
	if (!apiKey) throw error(500, 'ANTHROPIC_API_KEY mangler i Cloudflare env');

	const auth = request.headers.get('Authorization');
	if (!auth?.startsWith('Bearer ')) throw error(401, 'Manglende Bearer-token');
	const uid = await verificerToken(auth.slice(7));
	if (!uid) throw error(401, 'Ugyldig token');

	let body: {
		navn?: string;
		antalPortioner?: number;
		ingredienser?: Array<{ navn?: string; maengde?: number; enhed?: string }>;
	};
	try {
		body = await request.json();
	} catch {
		throw error(400, 'Ugyldig JSON');
	}

	const ingredienser = (body.ingredienser ?? [])
		.filter((i) => (i?.navn ?? '').trim())
		.slice(0, MAX_INGREDIENSER);
	if (ingredienser.length === 0) throw error(400, 'Skriv mindst én ingrediens først');

	const antalPortioner = Math.max(1, Math.round(Number(body.antalPortioner) || 1));

	// INGEN FEATURE-GATE. Linns beslutning 1. september: alle kunder skal
	// kunne skrive en opskrift selv OG bruge appen til at gaette tallene.
	// Den daglige pulje er tilbage, saa det stadig ikke kan loebe loebsk.
	const noegle = quotaNoegle();
	const quotaPath = `users/${uid}/linnAiQuotaer/${noegle}`;
	const quotaDoc = (await hentDoc(quotaPath)) as { antal?: number } | null;
	const antalIDag = quotaDoc?.antal ?? 0;
	if (antalIDag >= MAX_QUERIES_PR_DAG) {
		throw error(429, `Du har brugt dine ${MAX_QUERIES_PR_DAG} forsøg i dag. Prøv igen i morgen.`);
	}

	// MAENGDEN SKRIVES KUN NAAR DEN ER DER. Foer 2. september sendte vi
	// "- 0 g Aeg" naar kunden ikke havde skrevet en maengde, og saa fik
	// modellen at vide at der var nul gram aeg. Den svarede helt korrekt at
	// der ikke var noget at regne paa, og kunden saa en app der ikke kunne
	// regne. Uden maengde antager systemprompten en almindelig portion.
	const linjer = ingredienser
		.map((i) => {
			const maengde = Number(i.maengde);
			const harMaengde = Number.isFinite(maengde) && maengde > 0;
			const enhed = (i.enhed ?? '').trim();
			const navn = (i.navn ?? '').trim();
			return harMaengde ? `- ${maengde} ${enhed} ${navn}`.replace(/\s+/g, ' ').trim() : `- ${navn}`;
		})
		.join('\n');
	const besked = `Ret: ${(body.navn ?? '').trim() || 'Uden navn'}\nAntal portioner: ${antalPortioner}\n\nIngredienser:\n${linjer}`;

	const res = await fetch('https://api.anthropic.com/v1/messages', {
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
			messages: [{ role: 'user', content: besked }]
		})
	});

	if (!res.ok) {
		console.error('[estimer-opskrift] Anthropic svarede', res.status, await res.text());
		throw error(502, 'Kunne ikke regne på opskriften lige nu');
	}

	const data = (await res.json()) as {
		content?: Array<{ type: string; text?: string }>;
		stop_reason?: string;
	};

	// Loeb svaret alligevel toer for plads, saa sig det som det er i stedet
	// for at fejle paa et halvt JSON-svar.
	if (data.stop_reason === 'max_tokens') {
		console.error('[estimer-opskrift] svaret blev afkortet');
		throw error(502, 'Opskriften er for lang til at regne på i ét stykke. Skriv tallene selv');
	}
	const raa = data.content?.find((c) => c.type === 'text')?.text ?? '';

	// Modellen kan finde paa at pakke svaret i markdown, selv om den er bedt
	// om at lade vaere. Vi klipper det vaek i stedet for at fejle.
	const renset = raa
		.trim()
		.replace(/^```(?:json)?/i, '')
		.replace(/```$/, '')
		.trim();

	let svar: unknown;
	try {
		svar = JSON.parse(renset);
	} catch {
		console.error('[estimer-opskrift] kunne ikke laese svaret:', renset.slice(0, 300));
		throw error(502, 'Kunne ikke læse svaret. Prøv igen, eller skriv tallene selv');
	}

	// Kvitteringen taeller foerst NAAR der er et svar. Fejler kaldet, skal
	// kunden ikke have brugt et forsoeg.
	await gemDocMerge(quotaPath, { antal: antalIDag + 1, sidste: Date.now() });

	return json(svar);
};
