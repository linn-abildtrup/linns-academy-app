// ============================================================
// "Spørg om appen" i 3.0.
//
// HVORFOR DEN FINDES OG IKKE BARE BRUGER /api/app-hjaelp: det gamle
// endpoint bygger sin prompt af content/appHjaelp.ts, som beskriver den
// GAMLE flade. Begge dele bruges af de 760 kunder i drift og maa ikke
// roeres. Derfor et nyt endpoint ved siden af.
//
// Forskellen paa de to er kun hvilken videnbase der sendes med, og
// hvordan kunden beskrives. Modellen, kvoten og resten er ens.
// ============================================================

import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { env } from '$env/dynamic/private';
import { PUBLIC_FIREBASE_API_KEY } from '$env/static/public';
import { hentDoc, hentAlleDocs, gemDocMerge } from '$lib/server/firestoreRest';
import {
	byggHjaelpPrompt3,
	hjaelpQuotaNoegle3,
	HJAELP_MAX_PR_DAG_3,
	type HjaelpKunde3
} from '$lib/content/appHjaelp3';
import { harFeatureAdgang, type FeatureMatrix } from '$lib/content/features';
import { forlobSlutMs } from '$lib/content/forlob';
import type { UserDoc } from '$lib/types';

const ANTHROPIC_MODEL = 'claude-haiku-4-5-20251001';
const MAX_TOKENS = 1024;

interface IndkommendeBesked {
	rolle: 'user' | 'assistant';
	indhold: string;
}

async function verificerToken(idToken: string): Promise<string | null> {
	if (!PUBLIC_FIREBASE_API_KEY) {
		console.error('[ny-app-hjaelp] PUBLIC_FIREBASE_API_KEY mangler ved build-tid');
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
		if (!res.ok) return null;
		const data = (await res.json()) as { users?: Array<{ localId?: string }> };
		return data.users?.[0]?.localId ?? null;
	} catch (e) {
		console.error('[ny-app-hjaelp] kunne ikke verificere token', e);
		return null;
	}
}

/**
 * Et tidsstempel til millisekunder.
 *
 * FAELDEN: firestoreRest giver en timestamp som en ISO-STRENG, ikke som
 * det _seconds-objekt firebase-admin bruger. Foerste udgave af den her
 * fil laeste _seconds, fik undefined, og saa saa hver eneste kunde ud
 * som om hun ikke havde et forloeb. Hjaelpen fortalte derfor aldrig en
 * forloebskunde at hun kunne skrive til Linn. Fanget i en proeve mod den
 * koerende app, ikke af typerne, for castet skjulte det.
 */
function tilMs(v: unknown): number {
	if (typeof v === 'string') {
		const t = Date.parse(v);
		return Number.isNaN(t) ? 0 : t;
	}
	if (typeof v === 'number') return v;
	const s = (v as { _seconds?: number } | null | undefined)?._seconds;
	return typeof s === 'number' ? s * 1000 : 0;
}

/**
 * Hvad hun faktisk har. De samme spoergsmaal som onboarding og
 * rundvisningen stiller, saa hjaelpen ikke kan komme til at forklare
 * noget hun ikke har paa skaermen.
 *
 * Fejler et opslag, falder vi tilbage paa det snaevre svar. Saa
 * fortaeller hjaelpen for lidt i stedet for at love for meget.
 */
async function hentKunde(uid: string, userDoc: UserDoc | null): Promise<HjaelpKunde3> {
	let harAktivtForlob = false;
	let harGennemfoertForlob = false;
	let forlobNavn: string | undefined;
	const nu = Date.now();

	try {
		// Forloebene staar paa BRUGER-dokumentet som forlobIds, ikke i
		// products. Foerste udgave laeste products, som er TOM for
		// forloebskunder, saa alle saa ud som om de ikke havde et forloeb.
		// Samme regel som udledAdgange i adgang3.ts: en forloebs-raekke
		// kraever baade forlobIds paa kunden OG selve forloebs-dokumentet.
		for (const forlobId of userDoc?.forlobIds ?? []) {
			const f = (await hentDoc(`forlob/${forlobId}`)) as {
				navn?: string;
				startDato?: unknown;
				antalDage?: number;
			} | null;
			const startMs = tilMs(f?.startDato);
			if (!startMs || !f?.antalDage) continue;

			// Regn ALDRIG selv. forlobSlutMs gulver starten til midnat og
			// laegger en dag til, saa kunden faar HELE den sidste dag. Uden
			// det lukkede forloebet om morgenen paa sidste dag, og hjaelpen
			// sagde til en kvinde paa dag 84 af 84 at hun ikke var paa et
			// forloeb. Se kommentaren i content/forlob.ts.
			//
			// Pause-dage taelles med som nul her. En Kropsro-kunde der har
			// holdt pause kan derfor helt til sidst miste linjen om at
			// skrive til Linn i HJAELPEN. Selve appen regner rigtigt.
			const slutMs = forlobSlutMs(startMs, f.antalDage, 0);
			if (nu >= startMs && nu < slutMs) {
				harAktivtForlob = true;
				forlobNavn = f.navn;
			} else if (nu >= slutMs) {
				// Slut betyder gennemfoert, uanset hvor meget hun naaede. Samme
				// regel som gennemfoerteForlob i adgang3.ts.
				harGennemfoertForlob = true;
			}
		}
	} catch (e) {
		console.warn('[ny-app-hjaelp] kunne ikke afgoere forloeb', e);
	}

	// Traening og byg-eget hviler paa tildelingerne, ikke paa skemaet.
	// Se HANDOVER 9.18: byg-eget styres af en tildeling og IKKE af
	// feature-noeglen med samme navn.
	let harTraening = false;
	let maaByggeEget = false;
	try {
		const tildelinger = (await hentAlleDocs('traeningTildelinger3')).map(
			(r) => r.data as { type?: string; modtagerType?: string; modtagerId?: string }
		);
		const mine = tildelinger.filter(
			(t) =>
				t.modtagerType === 'alle-app' ||
				(t.modtagerType === 'kunde' && t.modtagerId === uid) ||
				(t.modtagerType === 'medlemmer' && !harAktivtForlob)
		);
		harTraening = mine.some((t) => t.type === 'program');
		maaByggeEget = mine.some((t) => t.type === 'byg-eget');
	} catch (e) {
		console.warn('[ny-app-hjaelp] kunne ikke afgoere traening', e);
	}

	let maaSeKalorier = false;
	try {
		const matrix = (await hentDoc('featureAdgang/aktiv')) as FeatureMatrix | null;
		maaSeKalorier = harFeatureAdgang(userDoc, matrix, 'udvidet-naering');
	} catch (e) {
		console.warn('[ny-app-hjaelp] kunne ikke hente adgangs-skemaet', e);
	}

	return {
		harAktivtForlob,
		harGennemfoertForlob,
		forlobNavn,
		harTraening,
		// Samme regel som resten af 3.0, se content/beskedside3.ts. Den
		// ligger bevidst IKKE i det delte skema, som ogsaa styrer den
		// gamle app.
		maaSkriveTilLinn: harAktivtForlob,
		maaSeKalorier,
		maaByggeEget
	};
}

export const POST: RequestHandler = async ({ request }) => {
	const apiKey = env.ANTHROPIC_API_KEY;
	if (!apiKey) throw error(500, 'ANTHROPIC_API_KEY mangler i Cloudflare Pages env-vars');

	const auth = request.headers.get('Authorization');
	if (!auth?.startsWith('Bearer ')) throw error(401, 'Manglende Bearer-token');
	const uid = await verificerToken(auth.slice(7));
	if (!uid) throw error(401, 'Ugyldig token');

	let body: { besked?: string; samtaleHistorik?: IndkommendeBesked[] };
	try {
		body = await request.json();
	} catch {
		throw error(400, 'Ugyldig JSON');
	}

	const besked = body.besked?.trim();
	if (!besked) throw error(400, 'Tom besked');

	const userDoc = (await hentDoc(`users/${uid}`)) as UserDoc | null;

	// Samme port som resten af 3.0. Har hun ikke flaget, hoerer hun ikke
	// til her endnu.
	if (!(userDoc?.testerFeatures ?? []).includes('ny-app')) {
		throw error(403, 'Den nye app er ikke åben for dig endnu');
	}

	const quotaSti = `users/${uid}/nyHjaelpQuotaer/${hjaelpQuotaNoegle3()}`;
	const quota = (await hentDoc(quotaSti)) as { antal?: number } | null;
	const brugt = quota?.antal ?? 0;
	if (brugt >= HJAELP_MAX_PR_DAG_3) {
		throw error(
			429,
			`Du har brugt dine ${HJAELP_MAX_PR_DAG_3} spørgsmål om appen i dag. Vi ses i morgen.`
		);
	}

	const kunde = await hentKunde(uid, userDoc);

	const messages = (body.samtaleHistorik ?? []).map((m) => ({
		role: m.rolle,
		content: m.indhold
	}));
	messages.push({ role: 'user', content: besked });

	const svarRes = await fetch('https://api.anthropic.com/v1/messages', {
		method: 'POST',
		headers: {
			'x-api-key': apiKey,
			'anthropic-version': '2023-06-01',
			'content-type': 'application/json'
		},
		body: JSON.stringify({
			model: ANTHROPIC_MODEL,
			max_tokens: MAX_TOKENS,
			system: byggHjaelpPrompt3(kunde),
			messages
		})
	});

	if (!svarRes.ok) {
		console.error('[ny-app-hjaelp] Anthropic svarede', svarRes.status, await svarRes.text());
		throw error(502, 'AI-tjenesten svarede ikke. Prøv igen om lidt.');
	}

	const data = (await svarRes.json()) as { content: Array<{ type: string; text?: string }> };
	const svar = data.content
		.filter((c) => c.type === 'text')
		.map((c) => c.text ?? '')
		.join('');

	await gemDocMerge(quotaSti, { antal: brugt + 1, sidste: Date.now() });

	return json({ svar, brugtIDag: brugt + 1, maksIDag: HJAELP_MAX_PR_DAG_3 });
};
