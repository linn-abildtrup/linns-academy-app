// AI svar-udkast endpoint — admin-only.
//
// Modtager et spoergsmaalId for et eksisterende klientspoergsmaal-dok.
// Henter klient-kontekst, FAQ for det aktive forløb, Linns videnbase og
// seneste svar-historik, og bruger Anthropic Claude Sonnet 4.6 med
// prompt-cache til at generere et udkast.
//
// Auth: kræver gyldig Firebase ID-token + at brugerens email er i
// ADMIN_EMAILS-listen.
//
// Skip-detection: trivielle beskeder (meget korte, tak/ros-mønstre)
// returneres med skip=true uden at kalde Anthropic.

import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { env } from '$env/dynamic/private';
import { PUBLIC_FIREBASE_API_KEY } from '$env/static/public';
import { hentAlleDocs, hentDoc, runQuery } from '$lib/server/firestoreRest';
import {
	byggFaqTekst,
	byggKlientKontekstTekst,
	byggSystemBlocks,
	byggTidligereSvarTekst,
	byggUserMessage,
	byggVidenbaseTekst,
	erTrivielBesked,
	parseModelOutput,
	type FaqItem,
	type KlientKontekst,
	type TidligereSvar,
	type UdkastResultat
} from '$lib/content/svarUdkast';
import { ADMIN_EMAILS } from '$lib/admin';

const ANTHROPIC_MODEL = 'claude-sonnet-4-6';
const MAX_TOKENS = 800;
const MAX_SVAR_HISTORIK = 30;
const MAX_VIDENBASE_DOCS = 10;

interface VerifResultat {
	uid: string;
	email: string;
}

async function verificerAdminToken(idToken: string): Promise<VerifResultat | null> {
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
		const data = (await res.json()) as { users?: Array<{ localId: string; email?: string }> };
		const u = data.users?.[0];
		if (!u?.localId || !u?.email) return null;
		const adminListe = ADMIN_EMAILS as readonly string[];
		if (!adminListe.includes(u.email)) return null;
		return { uid: u.localId, email: u.email };
	} catch (e) {
		console.warn('Admin-token-verifikation fejlede:', e);
		return null;
	}
}

interface SpoergsmaalData {
	uid: string;
	email: string;
	spoergsmaal: string;
	forlobId: string;
	forlobNavn: string;
	kundeType: string | null;
}

async function hentSpoergsmaal(id: string): Promise<SpoergsmaalData | null> {
	const d = await hentDoc(`klientspoergsmaal/${id}`);
	if (!d) return null;
	return {
		uid: (d.uid as string) ?? '',
		email: (d.email as string) ?? '',
		spoergsmaal: (d.spoergsmaal as string) ?? '',
		forlobId: (d.forlobId as string) ?? '',
		forlobNavn: (d.forlobNavn as string) ?? '',
		kundeType: (d.kundeType as string) ?? null
	};
}

async function hentFaq(forlobId: string): Promise<FaqItem[]> {
	if (!forlobId) return [];
	try {
		const docs = await hentAlleDocs(`forlob/${forlobId}/faqItems`);
		const items: FaqItem[] = [];
		for (const d of docs) {
			const data = d.data;
			if (data.udgivet === false) continue;
			items.push({
				titel: (data.spoergsmaal as string) ?? '',
				svar: (data.svar as string) ?? ''
			});
		}
		return items;
	} catch (e) {
		console.warn('Kunne ikke hente FAQ:', e);
		return [];
	}
}

interface SvarKandidat {
	spoergsmaalId: string;
	spoergsmaal: string;
	svar: string;
	tidsstempel: number;
}

async function hentSvarFraSvarHistorik(forlobId: string): Promise<SvarKandidat[]> {
	try {
		const docs = await runQuery('svarHistorik', {
			where: { felt: 'forlobId', vaerdi: forlobId },
			orderBy: { felt: 'oprettet', retning: 'DESCENDING' },
			limit: MAX_SVAR_HISTORIK
		});
		return docs
			.map((d) => {
				const t = d.data.oprettet as string | undefined;
				const ms = t ? new Date(t).getTime() : 0;
				return {
					spoergsmaalId: (d.data.spoergsmaalId as string) ?? '',
					spoergsmaal: (d.data.spoergsmaalTekst as string) ?? '',
					svar: (d.data.endeligTekst as string) ?? '',
					tidsstempel: Number.isFinite(ms) ? ms : 0
				};
			})
			.filter((s) => s.spoergsmaal && s.svar);
	} catch (e) {
		console.warn('svarHistorik-query fejlede (mangler index?):', e);
		return [];
	}
}

async function hentSvarFraKlientspoergsmaal(forlobId: string): Promise<SvarKandidat[]> {
	try {
		const docs = await runQuery('klientspoergsmaal', {
			where: { felt: 'forlobId', vaerdi: forlobId },
			limit: 200
		});
		const ud: SvarKandidat[] = [];
		for (const d of docs) {
			const svar = d.data.svar as string | undefined;
			if (!svar) continue;
			const sp = d.data.spoergsmaal as string | undefined;
			if (!sp) continue;
			const besvaretAt = d.data.besvaretAt as string | undefined;
			const oprettet = d.data.oprettet as string | undefined;
			const tStr = besvaretAt ?? oprettet;
			const ms = tStr ? new Date(tStr).getTime() : 0;
			ud.push({
				spoergsmaalId: d.id,
				spoergsmaal: sp,
				svar,
				tidsstempel: Number.isFinite(ms) ? ms : 0
			});
		}
		return ud;
	} catch (e) {
		console.warn('klientspoergsmaal-query fejlede:', e);
		return [];
	}
}

/**
 * Henter tidligere svar fra BÅDE svarHistorik (nye, med diff-data) OG
 * klientspoergsmaal (eksisterende, ren tekst). svarHistorik vinder ved
 * id-overlap — det er den nyere/redigerede version. Sorteres efter
 * tidsstempel desc og begrænses til MAX_SVAR_HISTORIK.
 *
 * Hvorfor begge kilder: nye svar sendt via /api/svar-udkast-flowet havner
 * i svarHistorik, men ALLE eksisterende svar (incl pre-AI-tid) ligger kun
 * i klientspoergsmaal. Worker'en skal kunne lære stemme + indhold fra dem.
 */
async function hentTidligereSvar(forlobId: string): Promise<TidligereSvar[]> {
	if (!forlobId) return [];
	const [fraHistorik, fraSpoergsmaal] = await Promise.all([
		hentSvarFraSvarHistorik(forlobId),
		hentSvarFraKlientspoergsmaal(forlobId)
	]);

	const set = new Map<string, SvarKandidat>();
	for (const s of fraSpoergsmaal) set.set(s.spoergsmaalId, s);
	for (const s of fraHistorik) set.set(s.spoergsmaalId, s); // overskriver
	const samlet = [...set.values()].sort((a, b) => b.tidsstempel - a.tidsstempel);
	return samlet
		.slice(0, MAX_SVAR_HISTORIK)
		.map((s) => ({ spoergsmaal: s.spoergsmaal, svar: s.svar }));
}

async function hentVidenbase(): Promise<string[]> {
	try {
		const docs = await hentAlleDocs('linnAiVidenbase');
		return docs
			.slice(0, MAX_VIDENBASE_DOCS)
			.map((d) => (d.data.tekst as string) ?? '')
			.filter((t) => t.length > 0);
	} catch {
		return [];
	}
}

async function bestemDagIForlob(forlobId: string): Promise<number | null> {
	if (!forlobId) return null;
	try {
		const forlob = await hentDoc(`forlob/${forlobId}`);
		if (!forlob) return null;
		const startStr = forlob.startDato as string | undefined;
		if (!startStr) return null;
		const startMs = new Date(startStr).getTime();
		if (!Number.isFinite(startMs)) return null;
		const diff = Date.now() - startMs;
		return Math.max(0, Math.floor(diff / (24 * 60 * 60 * 1000)));
	} catch {
		return null;
	}
}

async function hentKlientKontekst(uid: string, forlobId: string): Promise<KlientKontekst> {
	const [userDoc, productDoc, dagIForlob] = await Promise.all([
		hentDoc(`users/${uid}`),
		hentDoc(`users/${uid}/products/premiumforløb`),
		bestemDagIForlob(forlobId)
	]);
	const fornavn = (userDoc?.firstName as string) ?? 'klienten';
	const kundeType = (userDoc?.state as string) ?? null;
	const programValg =
		((productDoc?.programValg as Record<string, unknown> | undefined)?.mikrotraening as
			| string
			| undefined) ?? null;
	return { fornavn, kundeType, dagIForlob, programValg };
}

interface AnthropicSvar {
	content?: Array<{ type: string; text?: string }>;
	usage?: {
		input_tokens?: number;
		output_tokens?: number;
		cache_creation_input_tokens?: number;
		cache_read_input_tokens?: number;
	};
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
	const verif = await verificerAdminToken(auth.slice(7));
	if (!verif) throw error(403, 'Kræver admin');

	let body: { spoergsmaalId?: string };
	try {
		body = await request.json();
	} catch {
		throw error(400, 'Ugyldig JSON');
	}
	const spoergsmaalId = body.spoergsmaalId?.trim();
	if (!spoergsmaalId) throw error(400, 'Manglende spoergsmaalId');

	const spm = await hentSpoergsmaal(spoergsmaalId);
	if (!spm) throw error(404, 'Spørgsmål ikke fundet');
	if (!spm.forlobId) throw error(400, 'Spørgsmålet har intet forlobId');

	// Hurtig skip-tjek inden vi bruger kontekst på Anthropic-kald
	if (erTrivielBesked(spm.spoergsmaal)) {
		const res: UdkastResultat = {
			udkast: '',
			lavSikkerhed: false,
			skip: true,
			skipBegrundelse: 'Beskeden ser ud til ikke at kræve et substantielt svar.'
		};
		return json({ ...res, kilde: 'pre-skip' });
	}

	// Hent alt kontekst parallelt
	const [klientKontekst, faqItems, tidligereSvar, videnbaseUddrag] = await Promise.all([
		hentKlientKontekst(spm.uid, spm.forlobId),
		hentFaq(spm.forlobId),
		hentTidligereSvar(spm.forlobId),
		hentVidenbase()
	]);

	const systemBlocks = byggSystemBlocks({
		faqTekst: byggFaqTekst(faqItems),
		videnbaseTekst: byggVidenbaseTekst(videnbaseUddrag),
		tidligereSvarTekst: byggTidligereSvarTekst(tidligereSvar)
	});

	const userMessage = byggUserMessage({
		klientKontekstTekst: byggKlientKontekstTekst(klientKontekst),
		sidsteBeskeder: [],
		spoergsmaalTekst: spm.spoergsmaal
	});

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
			system: systemBlocks,
			messages: [{ role: 'user', content: userMessage }]
		})
	});

	if (!anthropicRes.ok) {
		const errorText = await anthropicRes.text();
		console.error('Anthropic API fejl:', anthropicRes.status, errorText);
		throw error(502, 'AI-tjenesten svarede ikke. Prøv igen om lidt.');
	}

	const anthropicData = (await anthropicRes.json()) as AnthropicSvar;
	const rawText = (anthropicData.content ?? [])
		.filter((c) => c.type === 'text')
		.map((c) => c.text ?? '')
		.join('')
		.trim();

	const parsed = parseModelOutput(rawText);
	const resultat: UdkastResultat = parsed ?? {
		udkast: rawText,
		lavSikkerhed: true,
		skip: false,
		skipBegrundelse: null
	};

	return json({
		...resultat,
		usage: anthropicData.usage ?? null,
		antalFaqItems: faqItems.length,
		antalTidligereSvar: tidligereSvar.length
	});
};
