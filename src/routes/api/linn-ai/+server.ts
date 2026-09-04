// Linn AI endpoint — kører på Cloudflare Pages Workers runtime.
//
// Modtager bruger-besked + samtale-historik. Bygger system-prompt fra
// Linns videnbase (linnAiVidenbase-collection i Firestore) og kalder
// Anthropic Claude. Returnerer assistant-svar.
//
// Rate-limit: max 20 queries pr bruger pr dag (gemt i quotaer-collection).
//
// Auth: forventer Firebase ID-token i Authorization-headeren. Verificerer
// at brugeren er authenticated via Google's tokeninfo-endpoint.

import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { env } from '$env/dynamic/private';
import { PUBLIC_FIREBASE_API_KEY } from '$env/static/public';
import { hentAlleDocs, hentDoc, gemDocMerge } from '$lib/server/firestoreRest';
import {
	byggKontekst,
	byggSystemPrompt,
	parseSikkerhed,
	afrundKlippetSvar,
	MAX_QUERIES_PR_DAG,
	quotaNoegle
} from '$lib/content/linnAi';
import type { VidenbaseDokument } from '$lib/content/linnAi';
import { harFeatureAdgang, type FeatureMatrix } from '$lib/content/features';
// Kundens eget forloeb. Delt med /api/ny-ai, saa de to apper ikke kan
// svare forskelligt paa det samme spoergsmaal. Tilfoejet 1. september
// 2026 efter Linns oenske, se 9.61 i HANDOVER-3.0.md.
import { hentForlobViden } from '$lib/server/forlobViden';
import { byggForlobKontekst } from '$lib/content/forlobKontekst3';
import { hentKundeHistorik, hentTidligereSvarMedBackup } from '$lib/server/svarViden';
import { byggTidligereSvarTekst } from '$lib/content/svarUdkast';
import { aktivtForlobId } from '$lib/utils/traeningsvariant';
import type { UserDoc } from '$lib/types';

const ANTHROPIC_MODEL = 'claude-haiku-4-5-20251001';
// Loftet paa svarlaengden. Maalt 4. september 2026 paa 105 gemte svar: det
// laengste fyldte under halvdelen af det gamle loft paa 1024, saa ingen svar
// var blevet klippet endnu. Fordoblet alligevel, saa der er plads den dag en
// kunde beder om noget langt (en madplan for en uge). Der betales kun for den
// tekst der faktisk skrives, saa et hoejere loft koster ikke i sig selv.
const MAX_TOKENS = 2048;

interface IndkommendeBesked {
	rolle: 'user' | 'assistant';
	indhold: string;
}

async function verificerToken(idToken: string): Promise<string | null> {
	// Verificer Firebase ID-token via Google identity toolkit.
	// Returnerer brugerens UID hvis valid, null ellers.
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
		if (!res.ok) {
			const errText = await res.text();
			console.warn('Token-verifikation HTTP-fejl:', res.status, errText);
			return null;
		}
		const data = (await res.json()) as { users?: Array<{ localId: string }> };
		return data.users?.[0]?.localId ?? null;
	} catch (e) {
		console.warn('Token-verifikation fejlede:', e);
		return null;
	}
}

export const POST: RequestHandler = async ({ request }) => {
	const apiKey = env.ANTHROPIC_API_KEY;
	if (!apiKey) {
		throw error(500, 'ANTHROPIC_API_KEY mangler i Cloudflare Pages env-vars');
	}

	const auth = request.headers.get('Authorization');
	if (!auth?.startsWith('Bearer ')) {
		throw error(401, 'Manglende Bearer-token');
	}
	const idToken = auth.slice(7);
	const uid = await verificerToken(idToken);
	if (!uid) throw error(401, 'Ugyldig token');

	let body: { besked: string; samtaleHistorik?: IndkommendeBesked[] };
	try {
		body = await request.json();
	} catch {
		throw error(400, 'Ugyldig JSON');
	}

	const besked = body.besked?.trim();
	if (!besked) throw error(400, 'Tom besked');
	const historik = body.samtaleHistorik ?? [];

	// Tjek bruger-adgang via feature-skemaet — SAMME kilde som klient-siden
	// (harFeatureAdgang tjekker baade tester-undtagelse og skema pr kundetype).
	// adminKlientMode='premiumapp' bevares saa admin kan teste premium-app.
	const userDoc = (await hentDoc(`users/${uid}`)) as UserDoc | null;
	const matrix = (await hentDoc('featureAdgang/aktiv')) as FeatureMatrix | null;
	const harAdgang =
		harFeatureAdgang(userDoc, matrix, 'linn-ai') || userDoc?.adminKlientMode === 'premiumapp';
	if (!harAdgang) {
		throw error(403, 'Linn AI er ikke en del af din adgang');
	}

	// Rate-limit
	const noegle = quotaNoegle();
	const quotaPath = `users/${uid}/linnAiQuotaer/${noegle}`;
	const quotaDoc = (await hentDoc(quotaPath)) as { antal?: number } | null;
	const antalIDag = quotaDoc?.antal ?? 0;
	if (antalIDag >= MAX_QUERIES_PR_DAG) {
		throw error(
			429,
			`Du har brugt dine ${MAX_QUERIES_PR_DAG} daglige queries. Prøv igen i morgen.`
		);
	}

	// Hent videnbase
	const docs = await hentAlleDocs('linnAiVidenbase');
	const videnbaseDokumenter: VidenbaseDokument[] = docs.map((d) => ({
		id: d.id,
		navn: (d.data.navn as string) ?? d.id,
		kilde: ((d.data.kilde as string) ?? 'manual') as VidenbaseDokument['kilde'],
		tekst: (d.data.tekst as string) ?? ''
	}));

	const kontekst = byggKontekst(videnbaseDokumenter, besked);

	// Hent Linns FAKTISKE tidligere svar (samme videns-motor som admin-svar-
	// vaerktoejet): kundens eget forloeb foerst, suppleret paa tvaers. Det er
	// chattens vigtigste grundlag — saa den svarer "som Linn" (etape 1).
	const forlobId = aktivtForlobId(userDoc) ?? '';
	const tidligereSvar = await hentTidligereSvarMedBackup(forlobId);
	const tidligereSvarTekst = byggTidligereSvarTekst(tidligereSvar);

	// Kundens EGET forloeb: navn, dagnummer, dagens dato, hendes FAQ og de
	// lektioner hun har adgang til. Uden det kunne AI'en ikke svare paa
	// hvornaar der er Q&A, selv om svaret staar ordret i hendes egen FAQ.
	//
	// BEGGE HENTNINGER FEJLER NEDAD. Der er 925 kunder i drift her, og et
	// daarligere svar er uendeligt meget bedre end intet svar. Gaar noget
	// galt, svarer AI'en praecis som den gjorde foer 1. september.
	const [viden, kundeHistorik] = await Promise.all([
		hentForlobViden(uid, userDoc).catch(() => null),
		hentKundeHistorik(uid).catch(() => [])
	]);

	const forlobBlok = byggForlobKontekst(
		viden ? { ...viden, iDag: new Date().toISOString().slice(0, 10) } : null,
		besked
	);

	const egetBlok =
		kundeHistorik.length > 0
			? `HUN HAR SPURGT DIG OM DET HER FOER, og du svarede saadan. Gentag ikke dig selv ordret:\n${kundeHistorik
					.slice(0, 5)
					.map((h, i) => `--- ${i + 1} ---\nHun spurgte: ${h.spoergsmaal}\nDu svarede: ${h.svar}`)
					.join('\n\n')}\n\n---\n`
			: '';

	// Hent admin's custom system-prompt hvis sat
	const konfig = (await hentDoc('linnAiKonfiguration/aktiv')) as { systemPrompt?: string } | null;
	// Forloebs-blokken staar FOERST, saa den ikke skaeres vaek naar
	// videnbasen fylder. Det er den der indeholder tidspunkterne.
	const systemPrompt = byggSystemPrompt(
		forlobBlok + egetBlok + kontekst,
		konfig?.systemPrompt,
		tidligereSvarTekst
	);

	// Byg messages-array til Anthropic
	const messages: Array<{ role: 'user' | 'assistant'; content: string }> = [];
	for (const m of historik) {
		messages.push({ role: m.rolle, content: m.indhold });
	}
	messages.push({ role: 'user', content: besked });

	// Kald Anthropic
	const anthropicRes = await fetch('https://api.anthropic.com/v1/messages', {
		method: 'POST',
		headers: {
			'x-api-key': apiKey,
			'anthropic-version': '2023-06-01',
			'content-type': 'application/json'
		},
		body: JSON.stringify({
			model: ANTHROPIC_MODEL,
			max_tokens: MAX_TOKENS,
			system: systemPrompt,
			messages
		})
	});

	if (!anthropicRes.ok) {
		const errorText = await anthropicRes.text();
		console.error('Anthropic API fejl:', anthropicRes.status, errorText);
		throw error(502, 'AI-tjenesten svarede ikke. Prøv igen om lidt.');
	}

	const anthropicData = (await anthropicRes.json()) as {
		content: Array<{ type: string; text?: string }>;
		stop_reason?: string;
	};
	const raat = anthropicData.content
		.filter((c) => c.type === 'text')
		.map((c) => c.text ?? '')
		.join('');
	// Udtraek sikkerheds-markoeren saa den ikke vises til brugeren.
	const parset = parseSikkerhed(raat);
	// Ramte svaret loftet, stoppede den midt i en saetning. Saa runder vi af
	// og siger det, i stedet for at gemme en halv linje i hendes samtale.
	// Markoeren staar allersidst, saa den er ogsaa vaek — sikkerhed bliver
	// null, og kunden ser den forsigtige linje.
	const klippet = anthropicData.stop_reason === 'max_tokens';
	if (klippet) console.warn('Linn AI ramte loftet paa svarlaengden — svaret er rundet af.');
	const svar = klippet ? afrundKlippetSvar(parset.svar) : parset.svar;
	const sikkerhed = klippet ? null : parset.sikkerhed;

	// Opdater quota efter succesfuld kald (så fejlede kald ikke tæller)
	await gemDocMerge(quotaPath, { antal: antalIDag + 1, sidste: Date.now() });

	return json({ svar, sikkerhed, queriesIDag: antalIDag + 1, queriesMaks: MAX_QUERIES_PR_DAG });
};
