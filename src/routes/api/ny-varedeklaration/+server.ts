// ============================================================
// Laeser en VAREDEKLARATION af et billede. Kun 3.0.
//
// Se HANDOVER-3.0.md 9.51 og content/varedeklaration3.ts. Koerer i
// Cloudflares Workers-runtime, saa firebase-admin virker IKKE her, og
// alt mod Firestore gaar gennem firestoreRest.
//
// FORSKELLE FRA /api/analyser-opskrift, og de er med vilje:
//
//   INGEN PREMIUM-GATE. Alle kunder skal kunne scanne. Det er hele
//   grunden til at maerkevarer kan forlade den faelles liste: kunden
//   henter dem selv. Kraevede det premium, ville vi tage varer fra
//   nogen og ikke give dem en vej tilbage.
//
//   EGEN DAGLIG TAELLER. Den deler ikke kvota med Linn AI. En kunde der
//   har snakket med AI'en om sin ryg skal ikke kunne blive spaerret fra
//   at registrere sin morgenmad. Graensen er hoej, for et enkelt kald
//   er billigt og hun scanner en vare én gang i hele varens levetid.
//
//   ÉT BILLEDE. En varedeklaration staar paa én side af pakken.
//
// Endpointet DOEMMER IKKE tallene og gemmer ingenting. Det laeser bare
// hvad der staar. Vurderingen ligger i content/varedeklaration3.ts, og
// kunden godkender inden der gemmes.
// ============================================================

import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { env } from '$env/dynamic/private';
import { PUBLIC_FIREBASE_API_KEY } from '$env/static/public';
import { hentDoc, gemDocMerge } from '$lib/server/firestoreRest';

const MODEL = 'claude-sonnet-4-6';
const MAX_TOKENS = 1024;
const MAX_BILLEDE_BYTES = 5 * 1024 * 1024;
/** Hoej med vilje. Et kald er billigt, og en vare scannes én gang. */
const MAKS_PR_DAG = 40;

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
		console.warn('[ny-varedeklaration] token-verifikation fejlede:', e);
		return null;
	}
}

/** Noeglen til dagens taeller, i dansk tid saa doegnet skifter naar hun sover. */
function dagsNoegle(): string {
	return new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Copenhagen' });
}

const SYSTEM_PROMPT = `Du læser næringsdeklarationer på danske fødevarepakker. Du skal KUN aflæse hvad der står, aldrig gætte eller regne.

DE TO VIGTIGSTE REGLER:

1. KOLONNEN. Mange pakker har to kolonner: "pr. 100 g" og "pr. portion". Læs ALTID kolonnen "pr. 100 g" hvis den findes, og skriv "pr100" i feltet kolonne. Findes kun en portions-kolonne, læs den, skriv "prPortion", og skriv portionens vægt i gram i portionGram. Er du i tvivl om hvilken kolonne du læste, skriv "ukendt".

2. FIBRE ER FRIVILLIGE på en dansk deklaration. Står der ingen kostfibre, skal feltet fiber være null. Skriv ALDRIG 0 når der ikke stod noget. Forskellen er afgørende: 0 betyder at produktet ikke har fibre, null betyder at pakken ikke oplyser det.

Det samme gælder alle andre felter: står tallet ikke på pakken, er feltet null.

Energi skrives typisk som "201 kJ / 48 kcal". Brug KCAL-tallet, ikke kJ.

Returnér KUN JSON, intet andet, ingen markdown:

{
  "navn": "<produktets navn som det står på pakken, eller null>",
  "kolonne": "pr100" | "prPortion" | "ukendt",
  "portionGram": <tal eller null>,
  "naering": {
    "kcal": <tal eller null>,
    "protein": <gram eller null>,
    "fiber": <gram eller null>,
    "kh": <gram kulhydrat eller null>,
    "fedt": <gram eller null>,
    "maettetFedt": <gram eller null>,
    "sukkerarter": <gram eller null>,
    "salt": <gram eller null>
  }
}

Er billedet ikke en næringsdeklaration, returnér:
{"fejl": "Billedet viser ikke en varedeklaration"}`;

export const POST: RequestHandler = async ({ request }) => {
	const apiKey = env.ANTHROPIC_API_KEY;
	if (!apiKey) throw error(500, 'ANTHROPIC_API_KEY mangler');

	const auth = request.headers.get('Authorization');
	if (!auth?.startsWith('Bearer ')) throw error(401, 'Manglende token');
	const uid = await verificerToken(auth.slice(7));
	if (!uid) throw error(401, 'Ugyldig token');

	let body: { billedeBase64?: string; mediaType?: string };
	try {
		body = await request.json();
	} catch {
		throw error(400, 'Ugyldig JSON');
	}
	if (!body.billedeBase64 || !body.mediaType) throw error(400, 'Mangler billede');
	if (body.billedeBase64.length * 0.75 > MAX_BILLEDE_BYTES) {
		throw error(413, 'Billedet er for stort. Prøv at tage det igen.');
	}

	// Egen taeller. Deler IKKE kvota med Linn AI, se toppen af filen.
	const noegle = dagsNoegle();
	const sti = `users/${uid}/deklarationKvote3/${noegle}`;
	const kvote = (await hentDoc(sti)) as { antal?: number } | null;
	const brugt = kvote?.antal ?? 0;
	if (brugt >= MAKS_PR_DAG) {
		throw error(429, `Du har scannet ${MAKS_PR_DAG} varer i dag. Prøv igen i morgen.`);
	}

	const svar = await fetch('https://api.anthropic.com/v1/messages', {
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
							source: { type: 'base64', media_type: body.mediaType, data: body.billedeBase64 }
						},
						{ type: 'text', text: 'Aflæs næringsdeklarationen og returnér det specificerede JSON.' }
					]
				}
			]
		})
	});

	if (!svar.ok) {
		console.error('[ny-varedeklaration] Anthropic svarede', svar.status, await svar.text());
		throw error(502, 'Kunne ikke læse billedet. Prøv igen.');
	}
	const data = (await svar.json()) as { content: Array<{ type: string; text?: string }> };
	let tekst = data.content
		.filter((c) => c.type === 'text')
		.map((c) => c.text ?? '')
		.join('')
		.trim();
	if (tekst.startsWith('```')) {
		tekst = tekst.replace(/^```(?:json)?\s*/, '').replace(/\s*```$/, '');
	}
	let laest: unknown;
	try {
		laest = JSON.parse(tekst);
	} catch {
		console.error('[ny-varedeklaration] ugyldigt svar:', tekst.slice(0, 400));
		throw error(502, 'Jeg kunne ikke læse tabellen. Prøv at tage billedet igen.');
	}

	// Taelleren skrives EFTER et lykket kald, saa et fejlet kald ikke
	// koster hende en scanning.
	await gemDocMerge(sti, { antal: brugt + 1, opdateret: new Date().toISOString() });

	return json(laest);
};
