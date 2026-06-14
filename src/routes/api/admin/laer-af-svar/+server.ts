// Admin-endpoint: "Lær af alle svar". Destillerer ALLE Linns besvarede
// klientspørgsmål (+ redigerede svar-udkast) til en håndfuld kompakte videns-
// dokumenter via Claude, og gemmer dem i linnAiVidenbase (kilde
// 'klient_spoergsmaal', id-præfiks 'destil_'). De bruges derefter som permanent,
// cachet viden i BÅDE admin-svar-udkast OG Linn AI kunde-chat.
//
// On-demand (admin trykker "Lær af alle svar"). Erstatter de tidligere
// destillerede docs ved hver kørsel; manuelt uploadede docs røres ikke.
// Linn kan bagefter redigere/slette dem i admin-UI'et.

import type { RequestHandler } from '@sveltejs/kit';
import { json, error, isHttpError } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import { PUBLIC_FIREBASE_API_KEY } from '$env/static/public';
import { ADMIN_EMAILS } from '$lib/admin';
import { hentAlleDocs, hentHeleCollection, batchWrite } from '$lib/server/firestoreRest';

const ANTHROPIC_MODEL = 'claude-sonnet-4-6';
// Vi bruger ALLE svar, men i BIDDER så hvert Claude-kald er lille nok til at
// holde sig under Anthropics tokens-pr-minut-grænse (ellers 429). Hver bid
// → kompakte noter; et sidste kald konsoliderer noterne til de endelige docs.
const MAX_SVAR = 800; // øvre sikkerhedsgrænse (bound på køretid)
const MAX_SVAR_LAENGDE = 350; // trim lange svar
const CHUNK = 100; // antal Q&A pr bid
const ID_PRAEFIKS = 'destil_';

async function kaldClaude(
	apiKey: string,
	system: string,
	user: string,
	maxTokens: number
): Promise<string> {
	const body = JSON.stringify({
		model: ANTHROPIC_MODEL,
		max_tokens: maxTokens,
		system,
		messages: [{ role: 'user', content: user }]
	});
	const kald = () =>
		fetch('https://api.anthropic.com/v1/messages', {
			method: 'POST',
			headers: {
				'x-api-key': apiKey,
				'anthropic-version': '2023-06-01',
				'content-type': 'application/json'
			},
			body
		});
	let res = await kald();
	// 429 = rate-limit. Vent (retry-after, max 12 sek) og prøv én gang til.
	if (res.status === 429) {
		const efter = Number(res.headers.get('retry-after')) || 8;
		await new Promise((r) => setTimeout(r, Math.min(efter, 12) * 1000));
		res = await kald();
	}
	if (!res.ok) {
		const t = await res.text();
		console.error('Anthropic fejl:', res.status, t.slice(0, 300));
		if (res.status === 429) {
			throw error(429, 'Anthropic er ramt af rate-limit — vent et minut og prøv igen.');
		}
		throw error(502, `Anthropic ${res.status}`);
	}
	const data = (await res.json()) as { content?: Array<{ type: string; text?: string }> };
	return (data.content ?? [])
		.filter((c) => c.type === 'text')
		.map((c) => c.text ?? '')
		.join('')
		.trim();
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function verificerAdmin(idToken: string): Promise<boolean> {
	if (!PUBLIC_FIREBASE_API_KEY) return false;
	try {
		const res = await fetch(
			`https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${PUBLIC_FIREBASE_API_KEY}`,
			{
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ idToken })
			}
		);
		if (!res.ok) return false;
		const data = (await res.json()) as { users?: Array<{ email?: string }> };
		const email = data.users?.[0]?.email?.toLowerCase() ?? null;
		if (!email) return false;
		return (ADMIN_EMAILS as readonly string[]).map((e) => e.toLowerCase()).includes(email);
	} catch {
		return false;
	}
}

interface QA {
	spoergsmaal: string;
	svar: string;
	t: number;
}

export const POST: RequestHandler = async ({ request }) => {
	const auth = request.headers.get('Authorization');
	if (!auth?.startsWith('Bearer ')) throw error(401, 'Manglende Bearer-token');
	if (!(await verificerAdmin(auth.slice(7)))) throw error(403, 'Ikke autoriseret som admin');

	try {
		// 1. Saml alle Q&A. svarHistorik (redigerede udkast) vinder over
		//    klientspoergsmaal (rå besvarede) ved samme spørgsmål.
		const perId = new Map<string, QA>();
		const tid = (s: unknown) => (typeof s === 'string' ? new Date(s).getTime() || 0 : 0);

		for (const d of await hentHeleCollection('klientspoergsmaal')) {
			const sp = (d.data.spoergsmaal as string) ?? '';
			const svar = (d.data.svar as string) ?? '';
			if (!sp || !svar) continue;
			perId.set(d.id, {
				spoergsmaal: sp,
				svar,
				t: tid(d.data.besvaretAt) || tid(d.data.oprettet)
			});
		}
		for (const d of await hentHeleCollection('svarHistorik')) {
			const sp = (d.data.spoergsmaalTekst as string) ?? '';
			const svar = (d.data.endeligTekst as string) ?? '';
			const sid = (d.data.spoergsmaalId as string) ?? d.id;
			if (!sp || !svar) continue;
			perId.set(sid, { spoergsmaal: sp, svar, t: tid(d.data.oprettet) });
		}

		const alle = [...perId.values()].sort((a, b) => b.t - a.t).slice(0, MAX_SVAR);
		if (alle.length < 5) {
			throw error(409, `For få besvarede spørgsmål at lære af (${alle.length}).`);
		}

		const apiKey = env.ANTHROPIC_API_KEY;
		if (!apiKey) throw error(500, 'ANTHROPIC_API_KEY mangler i Cloudflare Pages env-vars');

		// 2a. MAP: del alle svar i bidder; hver bid → kompakte noter (lille input
		//     pr kald, så vi undgår 429). Sekventielt + lille pause mellem bidder.
		const mapSystem =
			'Du er analytiker for Linns Academy (dansk menopause-coaching). Du får et udsnit ' +
			'af Linns FAKTISKE svar til klienter. Lav KOMPAKTE noter om gennemgående temaer, ' +
			'hendes standpunkter, standard-råd og typiske formuleringer. Kun noter — ikke JSON. ' +
			'Find IKKE på noget; brug kun hvad der står i svarene.';
		const noter: string[] = [];
		for (let i = 0; i < alle.length; i += CHUNK) {
			const del = alle.slice(i, i + CHUNK);
			const qaTekst = del
				.map(
					(q, j) => `${j + 1}. SPM: ${q.spoergsmaal}\n   SVAR: ${q.svar.slice(0, MAX_SVAR_LAENGDE)}`
				)
				.join('\n\n');
			const note = await kaldClaude(
				apiKey,
				mapSystem,
				`Udsnit af Linns svar:\n\n${qaTekst}\n\nLav kompakte tema-noter.`,
				2048
			);
			if (note) noter.push(note);
			if (i + CHUNK < alle.length) await sleep(3500); // spred tokens-pr-minut
		}
		if (noter.length === 0) throw error(502, 'AI returnerede ingen noter. Prøv igen.');

		// 2b. REDUCE: konsolider alle bid-noterne til de endelige videns-docs.
		const reduceSystem =
			'Du er analytiker for Linns Academy. Du får noter destilleret fra ALLE Linns svar ' +
			'(i bidder). Konsolider til en genbrugelig videnbase en AI kan bruge som reference, ' +
			'så fremtidige svar matcher Linns standpunkter og tone.';
		const reduceUser =
			`Her er noter fra ${alle.length} af Linns svar, i ${noter.length} bidder:\n\n` +
			noter.map((n, i) => `=== Bid ${i + 1} ===\n${n}`).join('\n\n') +
			'\n\nKonsolider til 4-6 kompakte videns-dokumenter, hvert med et tydeligt tema ' +
			'(fx kost & protein, træning, overgangsalder-symptomer, motivation/mindset, praktisk). ' +
			'Hvert dokument: Linns konkrete standpunkter, standard-råd og typiske formuleringer — ' +
			'i hendes varme, konkrete tone. Hold hvert dokument KORT (max ~250 ord).\n\n' +
			'Svar UDELUKKENDE med et gyldigt JSON-array — ingen forklarende tekst, ingen markdown:\n' +
			'[{"navn": "Kort tema-titel", "tekst": "Destilleret viden..."}, ...]';
		await sleep(2000);
		const raw = await kaldClaude(apiKey, reduceSystem, reduceUser, 8192);

		// Robust: træk JSON-arrayet ud uanset evt tekst/markdown rundt om det.
		const start = raw.indexOf('[');
		const end = raw.lastIndexOf(']');
		const jsonTekst = start >= 0 && end > start ? raw.slice(start, end + 1) : raw;
		let docs: Array<{ navn: string; tekst: string }>;
		try {
			const parsed = JSON.parse(jsonTekst);
			if (!Array.isArray(parsed)) throw new Error('ikke et array');
			docs = parsed
				.filter((d) => d && typeof d.navn === 'string' && typeof d.tekst === 'string')
				.map((d) => ({ navn: d.navn.slice(0, 120), tekst: d.tekst }));
		} catch (e) {
			console.error('Kunne ikke parse Claude-output:', e, raw.slice(0, 200));
			throw error(502, 'AI returnerede ugyldigt format. Prøv igen.');
		}
		if (docs.length === 0) throw error(502, 'AI returnerede ingen dokumenter.');

		// 3. Erstat tidligere destillerede docs (id-præfiks 'destil_'); rør ikke
		//    manuelt uploadede. Slet gamle + skriv nye i bunker.
		const eksisterende = await hentAlleDocs('linnAiVidenbase');
		const writes: Array<
			{ path: string; data: Record<string, unknown> } | { path: string; delete: true }
		> = [];
		for (const d of eksisterende) {
			if (d.id.startsWith(ID_PRAEFIKS))
				writes.push({ path: `linnAiVidenbase/${d.id}`, delete: true });
		}
		const stempel = Date.now();
		docs.forEach((doc, i) => {
			writes.push({
				path: `linnAiVidenbase/${ID_PRAEFIKS}${stempel}_${i}`,
				data: {
					navn: doc.navn,
					kilde: 'klient_spoergsmaal',
					tekst: doc.tekst,
					oprettetAt: new Date(stempel).toISOString(),
					opdateretAt: new Date(stempel).toISOString()
				}
			});
		});
		await batchWrite(writes);

		return json({
			ok: true,
			antalDocs: docs.length,
			antalSvarBrugt: alle.length,
			antalBidder: noter.length
		});
	} catch (e) {
		if (isHttpError(e)) throw e;
		console.error('laer-af-svar fejlede:', e);
		throw error(500, e instanceof Error ? e.message : 'Ukendt fejl');
	}
};
