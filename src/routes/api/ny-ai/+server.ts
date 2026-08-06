// ============================================================
// AI-endepunktet til Linns Academy 3.0. Koerer paa Cloudflare Workers.
//
// To tilstande i ét endepunkt, fordi de deler videnbase, persona og log:
//   samtale    — kunden skriver, AI'en svarer
//   inspirator — AI'en skriver uopfordret, ud fra hendes egne tal
//
// VIGTIGT: /api/linn-ai er UROERT. Dette er et nyt endepunkt ved siden af,
// fordi 3.0 har en anden adgangsregel (der findes ikke premium) og fordi
// inspiratoren har sine egne ufravigelige regler for tonen.
//
// Alt hvad AI'en siger, logges i nyAiLog saa Linn kan laese med. Det er
// hendes stemme den laaner.
// ============================================================

import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { env } from '$env/dynamic/private';
import { PUBLIC_FIREBASE_API_KEY } from '$env/static/public';
import { hentAlleDocs, hentDoc, gemDocMerge } from '$lib/server/firestoreRest';
import { byggKontekst, byggSystemPrompt, parseSikkerhed, quotaNoegle } from '$lib/content/linnAi';
import type { VidenbaseDokument } from '$lib/content/linnAi';
import { INSPIRATOR_REGLER, SITUATION_BESKRIVELSE, type Fakta } from '$lib/content/inspirator3';
import type { UserDoc } from '$lib/types';

const ANTHROPIC_MODEL = 'claude-haiku-4-5-20251001';
const MAX_TOKENS_SAMTALE = 1024;
const MAX_TOKENS_INSPIRATOR = 220;

/** Samme daglige graense som Linn AI. Besluttet af Linn 6. august 2026. */
const MAX_SAMTALER_PR_DAG = 20;

/** Under dette tal tilbyder vi at sende spoergsmaalet videre til Linn. */
const USIKKER_UNDER = 60;

interface Besked {
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
		if (!res.ok) return null;
		const data = (await res.json()) as { users?: Array<{ localId: string }> };
		return data.users?.[0]?.localId ?? null;
	} catch (e) {
		console.warn('[ny-ai] token-verifikation fejlede:', e);
		return null;
	}
}

/** Kalder Anthropic og returnerer den raa tekst. */
async function spoerg(
	apiKey: string,
	system: string,
	beskeder: Array<{ role: 'user' | 'assistant'; content: string }>,
	maxTokens: number
): Promise<string> {
	const res = await fetch('https://api.anthropic.com/v1/messages', {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
			'x-api-key': apiKey,
			'anthropic-version': '2023-06-01'
		},
		body: JSON.stringify({
			model: ANTHROPIC_MODEL,
			max_tokens: maxTokens,
			system,
			messages: beskeder
		})
	});
	if (!res.ok) {
		const tekst = await res.text();
		console.error('[ny-ai] Anthropic-fejl:', res.status, tekst);
		throw error(502, 'AI-tjenesten svarer ikke lige nu. Prøv igen om lidt.');
	}
	const data = (await res.json()) as { content: Array<{ type: string; text?: string }> };
	return data.content
		.filter((c) => c.type === 'text')
		.map((c) => c.text ?? '')
		.join('');
}

/**
 * Bygger persona + videnbase, praecis som Linn AI goer det.
 * `emne` bruges til at vaelge de mest relevante dokumenter fra videnbasen.
 */
async function byggGrundlag(emne: string): Promise<string> {
	const docs = await hentAlleDocs('linnAiVidenbase');
	const videnbase: VidenbaseDokument[] = docs.map((d) => ({
		id: d.id,
		navn: (d.data.navn as string) ?? d.id,
		kilde: (d.data.kilde as VidenbaseDokument['kilde']) ?? 'manuel',
		tekst: (d.data.tekst as string) ?? '',
		tags: (d.data.tags as string[]) ?? []
	}));
	const konf = (await hentDoc('linnAiKonfiguration/aktiv')) as { systemPrompt?: string } | null;
	return byggSystemPrompt(byggKontekst(videnbase, emne), konf?.systemPrompt);
}

/**
 * Skriver til loggen, saa Linn kan laese med. Doc-id er tid plus en
 * tilfaeldig hale, samme moenster som webhookLog. Fejler aldrig udadtil,
 * for en log der driller maa ikke spaerre for et svar.
 */
async function log(felter: Record<string, unknown>): Promise<void> {
	try {
		const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
		await gemDocMerge(`nyAiLog/${id}`, { ...felter, tidspunkt: Date.now() });
	} catch (e) {
		console.warn('[ny-ai] kunne ikke skrive log', e);
	}
}

export const POST: RequestHandler = async ({ request }) => {
	const apiKey = env.ANTHROPIC_API_KEY;
	if (!apiKey) throw error(500, 'ANTHROPIC_API_KEY mangler i Cloudflare Pages env-vars');

	const auth = request.headers.get('Authorization');
	if (!auth?.startsWith('Bearer ')) throw error(401, 'Manglende Bearer-token');
	const uid = await verificerToken(auth.slice(7));
	if (!uid) throw error(401, 'Ugyldig token');

	let body: {
		tilstand?: 'samtale' | 'inspirator';
		besked?: string;
		historik?: Besked[];
		fakta?: Fakta;
	};
	try {
		body = await request.json();
	} catch {
		throw error(400, 'Ugyldig JSON');
	}

	const userDoc = (await hentDoc(`users/${uid}`)) as UserDoc | null;

	// Adgangsregel i 3.0: har hun adgang til den nye flade, har hun adgang
	// til AI'en. Der findes ikke premium, og der er derfor ingen feature-gate.
	const maaBruge = (userDoc?.testerFeatures ?? []).includes('ny-app');
	if (!maaBruge) throw error(403, 'Den nye app er ikke åben for dig endnu');

	// Kontakten der slukker for det hele, hvis AI'en opfoerer sig daarligt.
	const konf = (await hentDoc('nyAiKonfiguration/aktiv')) as { slukket?: boolean } | null;
	if (konf?.slukket) throw error(503, 'AI-hjælpen er slået fra lige nu.');

	const tilstand = body.tilstand ?? 'samtale';

	// ── Inspiratoren ────────────────────────────────────────────
	if (tilstand === 'inspirator') {
		const f = body.fakta;
		if (!f) throw error(400, 'Mangler fakta');

		const fakta = [
			`Situation: ${SITUATION_BESKRIVELSE[f.situation]}`,
			f.overskudNu !== null ? `Hendes overskud er nu ${f.overskudNu} ud af 10.` : null,
			f.overskudStart !== null && f.overskudNu !== null && f.overskudStart !== f.overskudNu
				? `Da hun startede, var det ${f.overskudStart}.`
				: null,
			f.fald !== null ? `Det er faldet ${f.fald} over de seneste maalinger.` : null,
			f.forlobNavn ? `Hun er paa forloebet ${f.forlobNavn}, dag ${f.dagNummer}.` : null,
			f.smaaSkridt.length
				? `Hendes egne smaa skridt lige nu: ${f.smaaSkridt.join(', ')}.`
				: null
		]
			.filter(Boolean)
			.join('\n');

		const grundlag = await byggGrundlag(f.smaaSkridt.join(' ') || 'overskud energi hverdag');
		const raat = await spoerg(
			apiKey,
			`${grundlag}\n\n${INSPIRATOR_REGLER}`,
			[{ role: 'user', content: `Skriv beskeden. Her er hvad du ved om hende:\n${fakta}` }],
			MAX_TOKENS_INSPIRATOR
		);
		const { svar } = parseSikkerhed(raat);

		await log({ uid, tilstand: 'inspirator', situation: f.situation, svar, fakta });
		return json({ svar });
	}

	// ── Samtalen ────────────────────────────────────────────────
	const besked = body.besked?.trim();
	if (!besked) throw error(400, 'Tom besked');

	// Samme daglige pulje som Linn AI, saa der kun er ét budget at holde
	// styr paa. Inspiratoren taeller ikke med, for det er ikke hende der spoerger.
	const quotaSti = `users/${uid}/linnAiQuotaer/${quotaNoegle()}`;
	const quota = (await hentDoc(quotaSti)) as { antal?: number } | null;
	const brugt = quota?.antal ?? 0;
	if (brugt >= MAX_SAMTALER_PR_DAG) {
		throw error(429, `Du har brugt dine ${MAX_SAMTALER_PR_DAG} spørgsmål i dag. Vi ses i morgen.`);
	}

	const grundlag = await byggGrundlag(besked);
	const historik = (body.historik ?? []).map((b) => ({
		role: b.rolle === 'user' ? ('user' as const) : ('assistant' as const),
		content: b.indhold
	}));

	const raat = await spoerg(
		apiKey,
		grundlag,
		[...historik, { role: 'user', content: besked }],
		MAX_TOKENS_SAMTALE
	);
	const { svar, sikkerhed } = parseSikkerhed(raat);

	await gemDocMerge(quotaSti, { antal: brugt + 1, sidste: Date.now() });
	await log({ uid, tilstand: 'samtale', spoergsmaal: besked, svar, sikkerhed });

	return json({
		svar,
		// Sikkerheds-procenten er KUN til Linn og gaar aldrig til kunden.
		// Klienten faar kun at vide OM den er usikker, saa vi kan tilbyde
		// at sende spoergsmaalet videre.
		usikker: sikkerhed !== null && sikkerhed < USIKKER_UNDER,
		brugtIDag: brugt + 1,
		maksIDag: MAX_SAMTALER_PR_DAG
	});
};
