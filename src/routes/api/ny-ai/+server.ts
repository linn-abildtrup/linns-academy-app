// ============================================================
// AI-endepunktet til Linns Academy 3.0. Koerer paa Cloudflare Workers.
//
// Én tilstand: samtale, altsaa kunden skriver og AI'en svarer.
//
// Der var ogsaa en inspirator, hvor AI'en skrev uopfordret paa forsiden ud
// fra hendes egne tal. Linn fjernede kortet 20. august 2026, og hele grenen
// er taget ud her.
//
// VIGTIGT: /api/linn-ai er UROERT. Dette er et nyt endepunkt ved siden af,
// fordi 3.0 har en anden adgangsregel (der findes ikke premium).
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
import { byggForlobKontekst, type FaqPunkt, type Lektion } from '$lib/content/forlobKontekst3';
import { nulDatoer, dagNummerMedNulDage, produktHarNulDage } from '$lib/content/nulDage3';
import type { UserDoc } from '$lib/types';

const ANTHROPIC_MODEL = 'claude-haiku-4-5-20251001';
const MAX_TOKENS_SAMTALE = 1024;

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
const MS_PER_DAG = 86400000;

/**
 * Hvad AI'en skal vide om kundens eget forloeb.
 *
 * TRE FAELDER I firestoreRest, alle tre fundet 16. august, og alle tre
 * ligger i den her funktion:
 *  - hentAlleDocs giver { id, data } og IKKE dokumentet selv
 *  - et tidsstempel kommer som en ISO-STRENG, ikke som _seconds
 *  - forloebene staar paa BRUGER-dokumentet som forlobIds. Samlingen
 *    products er TOM for forloebskunder
 *
 * Fejler noget her, svarer AI'en som foer i stedet for slet ikke. Et
 * manglende forloebs-afsnit er daarligere svar, en fejl er intet svar.
 */
async function hentForlobViden(
	uid: string,
	userDoc: UserDoc | null
): Promise<{
	forlobNavn: string;
	dagNummer: number;
	antalDage: number;
	faq: FaqPunkt[];
	lektioner: Lektion[];
} | null> {
	try {
		const ids = (userDoc as unknown as { forlobIds?: string[] })?.forlobIds ?? [];
		if (ids.length === 0) return null;

		const nu = Date.now();
		let valgt: { id: string; navn: string; start: number; antalDage: number } | null = null;

		for (const id of ids) {
			const f = (await hentDoc(`forlob/${id}`)) as Record<string, unknown> | null;
			if (!f) continue;
			// ISO-streng, ikke _seconds. Se fael­den ovenfor.
			const start = new Date(String(f.startDato ?? '')).getTime();
			const antalDage = Number(f.antalDage) || 0;
			if (!Number.isFinite(start) || start <= 0 || antalDage <= 0) continue;
			// Det AKTIVE forloeb, altsaa det hun staar midt i lige nu.
			const slut = start + (antalDage + 1) * MS_PER_DAG;
			if (nu >= start && nu <= slut) {
				valgt = { id, navn: String(f.navn ?? id), start, antalDage };
				break;
			}
		}
		if (!valgt) return null;

		const raat = Math.floor((nu - valgt.start) / MS_PER_DAG) + 1;
		let dagNummer = Math.min(valgt.antalDage, Math.max(1, raat));

		// Pause. Kun Kropsro kan holde pause, se nulDage3. Uden det ville
		// AI'en sige et andet dagnummer end resten af appen.
		if (produktHarNulDage(valgt.id)) {
			const p = (await hentDoc(`users/${uid}/products/${valgt.id}`)) as Record<
				string,
				unknown
			> | null;
			const intervaller = (p?.nulDage as { intervaller?: [] } | undefined)?.intervaller ?? [];
			if (intervaller.length > 0) {
				dagNummer = dagNummerMedNulDage(raat, valgt.antalDage, nulDatoer(intervaller), nu);
			}
		}

		// FAQ hoerer til forloebet, og kategorien staar i sin egen samling.
		const [punkter, kategorier] = await Promise.all([
			hentAlleDocs(`forlob/${valgt.id}/faqItems`),
			hentAlleDocs(`forlob/${valgt.id}/faqKategorier`)
		]);
		const katNavn: Record<string, string> = {};
		for (const k of kategorier) katNavn[k.id] = String(k.data.navn ?? '');

		const faq: FaqPunkt[] = punkter
			// Kun det UDGIVNE. Et svar Linn stadig arbejder paa maa ikke
			// komme ud af munden paa AI'en foer hun har udgivet det.
			.filter((d) => d.data.udgivet === true)
			.map((d) => ({
				spoergsmaal: String(d.data.spoergsmaal ?? ''),
				svar: String(d.data.svar ?? ''),
				kategori: katNavn[String(d.data.kategoriId ?? '')] || undefined
			}))
			.filter((p) => p.spoergsmaal && p.svar);

		// Lektionerne, KUN til og med i dag. Se noten paa ForlobViden.
		const dage = await hentAlleDocs(`forlob/${valgt.id}/forlobsdage`);
		const lektioner: Lektion[] = [];
		for (const d of dage) {
			const nr = Number(d.data.dagNummer ?? String(d.id).replace(/\D/g, ''));
			if (!Number.isFinite(nr) || nr > dagNummer) continue;
			for (const l of (d.data.lektioner ?? []) as Record<string, unknown>[]) {
				const titel = String(l.titel ?? '').trim();
				if (!titel) continue;
				lektioner.push({
					dag: nr,
					titel,
					beskrivelse: String(l.beskrivelse ?? '').trim() || undefined
				});
			}
		}

		return { forlobNavn: valgt.navn, dagNummer, antalDage: valgt.antalDage, faq, lektioner };
	} catch (e) {
		console.warn('[ny-ai] kunne ikke hente forloebs-viden', e);
		return null;
	}
}

async function byggGrundlag(emne: string, forlobBlok: string): Promise<string> {
	const docs = await hentAlleDocs('linnAiVidenbase');
	const videnbase: VidenbaseDokument[] = docs.map((d) => ({
		id: d.id,
		navn: (d.data.navn as string) ?? d.id,
		kilde: (d.data.kilde as VidenbaseDokument['kilde']) ?? 'manuel',
		tekst: (d.data.tekst as string) ?? '',
		tags: (d.data.tags as string[]) ?? []
	}));
	const konf = (await hentDoc('linnAiKonfiguration/aktiv')) as { systemPrompt?: string } | null;
	// Forloebs-blokken staar FOERST, saa den ikke bliver skaaret vaek naar
	// videnbasen fylder. Det er den der indeholder tidspunkterne.
	return byggSystemPrompt(forlobBlok + byggKontekst(videnbase, emne), konf?.systemPrompt);
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
		besked?: string;
		historik?: Besked[];
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

	// ── Samtalen ────────────────────────────────────────────────
	const besked = body.besked?.trim();
	if (!besked) throw error(400, 'Tom besked');

	// Samme daglige pulje som Linn AI, saa der kun er ét budget at holde
	// styr paa.
	const quotaSti = `users/${uid}/linnAiQuotaer/${quotaNoegle()}`;
	const quota = (await hentDoc(quotaSti)) as { antal?: number } | null;
	const brugt = quota?.antal ?? 0;
	if (brugt >= MAX_SAMTALER_PR_DAG) {
		throw error(429, `Du har brugt dine ${MAX_SAMTALER_PR_DAG} spørgsmål i dag. Vi ses i morgen.`);
	}

	const viden = await hentForlobViden(uid, userDoc);
	const forlobBlok = byggForlobKontekst(
		{
			forlobNavn: viden?.forlobNavn ?? '',
			dagNummer: viden?.dagNummer ?? 0,
			antalDage: viden?.antalDage ?? 0,
			iDag: new Date().toISOString().slice(0, 10),
			faq: viden?.faq ?? [],
			lektioner: viden?.lektioner ?? []
		},
		besked
	);
	const grundlag = await byggGrundlag(besked, forlobBlok);
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
	await log({
		uid,
		tilstand: 'samtale',
		spoergsmaal: besked,
		svar,
		sikkerhed,
		// Saa Linn kan se HVILKET grundlag svaret byggede paa, naar hun
		// laeser med. Uden det kan et forkert svar ikke fejlsoeges.
		forlob: viden?.forlobNavn ?? '',
		dagNummer: viden?.dagNummer ?? 0,
		antalFaq: viden?.faq.length ?? 0,
		antalLektioner: viden?.lektioner.length ?? 0
	});

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
