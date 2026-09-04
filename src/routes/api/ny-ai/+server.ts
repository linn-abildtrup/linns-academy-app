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
import { hentTidligereSvarMedBackup, hentKundeHistorik } from '$lib/server/svarViden';
import { byggTidligereSvarTekst } from '$lib/content/svarUdkast';
import {
	afrundKlippetSvar,
	byggKontekst,
	byggSystemPrompt,
	parseSikkerhed,
	quotaNoegle
} from '$lib/content/linnAi';
import type { VidenbaseDokument } from '$lib/content/linnAi';
import { byggForlobKontekst } from '$lib/content/forlobKontekst3';
import { hentForlobViden } from '$lib/server/forlobViden';
import type { UserDoc } from '$lib/types';

const ANTHROPIC_MODEL = 'claude-haiku-4-5-20251001';
// Se kommentaren i api/linn-ai: maalt paa de gemte svar, ingen ramte det
// gamle loft, men der skal vaere plads til et langt svar.
const MAX_TOKENS_SAMTALE = 2048;

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
): Promise<{ tekst: string; klippet: boolean }> {
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
	const data = (await res.json()) as {
		content: Array<{ type: string; text?: string }>;
		stop_reason?: string;
	};
	const tekst = data.content
		.filter((c) => c.type === 'text')
		.map((c) => c.text ?? '')
		.join('');
	return { tekst, klippet: data.stop_reason === 'max_tokens' };
}

/**
 * Bygger persona + videnbase, praecis som Linn AI goer det.
 * `emne` bruges til at vaelge de mest relevante dokumenter fra videnbasen.
 */
async function byggGrundlag(
	emne: string,
	forlobBlok: string,
	tidligereSvarTekst: string
): Promise<string> {
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
	//
	// LINNS TIDLIGERE SVAR er det vigtigste grundlag, og de kom foerst med
	// 1. september. Bemaerk at sikkerheds-procenten HELE TIDEN har maalt
	// hvor godt de daekkede spoergsmaalet, se SIKKERHEDS_INSTRUKTION. Uden
	// dem maalte tallet paa noget der ikke var der.
	return byggSystemPrompt(
		forlobBlok + byggKontekst(videnbase, emne),
		konf?.systemPrompt,
		tidligereSvarTekst
	);
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

	// Alt grundlaget hentes paa én gang. Fejler noget af det, svarer AI'en
	// paa det den har i stedet for slet ikke.
	const forlobId =
		(userDoc as unknown as { forlobIds?: string[] })?.forlobIds?.slice(-1)[0] ?? '';
	const [viden, tidligereSvar, kundeHistorik] = await Promise.all([
		hentForlobViden(uid, userDoc),
		hentTidligereSvarMedBackup(forlobId).catch(() => []),
		hentKundeHistorik(uid).catch(() => [])
	]);
	const forlobBlok = byggForlobKontekst(
		viden ? { ...viden, iDag: new Date().toISOString().slice(0, 10) } : null,
		besked
	);
	// Hendes egen historik ligger EFTER forloebs-blokken og foer videnbasen,
	// saa den ikke skaeres vaek.
	//
	// HENDES MAD-TAL ER MED VILJE IKKE MED. Linns beslutning 1. september:
	// glem tallene paa maaltider. Det blev undersoegt samme dag, og der var
	// ogsaa en teknisk grund: maaltiderne ligger i en undersamling under
	// kunden, og firestoreRest kan kun spoerge fra roden. hentAlleDocs
	// stopper ved 300 dokumenter i tilfaeldig raekkefoelge, og en kunde har
	// tusindvis af madlinjer, saa et snit ville blive forkert uden at nogen
	// opdagede det. Bygges det en dag, laa regnestykket i
	// content/kundeTal3.ts, slettet samme dag. Se git-historikken.
	const egetBlok =
		(kundeHistorik.length > 0
			? `HUN HAR SPURGT DIG OM DET HER FOER, og du svarede saadan. Gentag ikke dig selv ordret:\n${kundeHistorik
					.slice(0, 5)
					.map((h, i) => `--- ${i + 1} ---\nHun spurgte: ${h.spoergsmaal}\nDu svarede: ${h.svar}`)
					.join('\n\n')}\n\n---\n`
			: '');

	const grundlag = await byggGrundlag(
		besked,
		forlobBlok + egetBlok,
		byggTidligereSvarTekst(tidligereSvar)
	);
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
	const parset = parseSikkerhed(raat.tekst);
	// Ramte svaret loftet, stoppede den midt i en saetning. Rund af og sig
	// det, i stedet for at gemme en halv linje i hendes samtale.
	if (raat.klippet) console.warn('[ny-ai] Svaret ramte loftet paa svarlaengden.');
	const svar = raat.klippet ? afrundKlippetSvar(parset.svar) : parset.svar;
	const sikkerhed = raat.klippet ? null : parset.sikkerhed;

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
		antalLektioner: viden?.lektioner.length ?? 0,
		antalTidligereSvar: tidligereSvar.length,
		antalEgenHistorik: kundeHistorik.length
	});

	return json({
		svar,
		// Sikkerheds-procenten er KUN til Linn og gaar aldrig til kunden.
		// Klienten faar kun at vide OM den er usikker, saa vi kan tilbyde
		// at sende spoergsmaalet videre.
		// Mangler tallet, regner vi det som usikkert. Saa hellere tilbyde
		// hende Linn én gang for meget end at lade et tvivlsomt svar staa
		// som om det var sikkert.
		usikker: sikkerhed === null || sikkerhed < USIKKER_UNDER,
		brugtIDag: brugt + 1,
		maksIDag: MAX_SAMTALER_PR_DAG
	});
};
