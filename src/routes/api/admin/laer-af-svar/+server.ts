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
const MAX_SVAR = 300; // loft på antal Q&A der sendes til destillering
const MAX_SVAR_LAENGDE = 800; // trim lange svar
const ID_PRAEFIKS = 'destil_';

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

		const qaTekst = alle
			.map(
				(q, i) =>
					`${i + 1}. SPØRGSMÅL: ${q.spoergsmaal}\n   LINNS SVAR: ${q.svar.slice(0, MAX_SVAR_LAENGDE)}`
			)
			.join('\n\n');

		// 2. Destillér med Claude.
		const apiKey = env.ANTHROPIC_API_KEY;
		if (!apiKey) throw error(500, 'ANTHROPIC_API_KEY mangler i Cloudflare Pages env-vars');

		const system =
			'Du er en omhyggelig analytiker for Linns Academy (dansk menopause-coaching). ' +
			'Du får Linns FAKTISKE svar til klienter. Destillér dem til en genbrugelig videnbase ' +
			'en AI kan bruge som reference, så fremtidige svar matcher Linns standpunkter og tone.';
		const userMessage =
			`Her er ${alle.length} af Linns svar til klient-spørgsmål:\n\n${qaTekst}\n\n` +
			'Destillér dem til 4-6 kompakte videns-dokumenter, hvert med et tydeligt tema ' +
			'(fx kost & protein, træning, overgangsalder-symptomer, motivation/mindset, praktisk/teknisk). ' +
			'Hvert dokument: Linns konkrete standpunkter, standard-råd og typiske formuleringer for det tema — ' +
			'i hendes varme, konkrete tone. Hold hvert dokument KORT (max ~250 ord). ' +
			'Find IKKE på noget; brug kun hvad der fremgår af svarene.\n\n' +
			'Svar UDELUKKENDE med et gyldigt JSON-array — ingen forklarende tekst, ingen markdown:\n' +
			'[{"navn": "Kort tema-titel", "tekst": "Destilleret viden for temaet..."}, ...]';

		const res = await fetch('https://api.anthropic.com/v1/messages', {
			method: 'POST',
			headers: {
				'x-api-key': apiKey,
				'anthropic-version': '2023-06-01',
				'content-type': 'application/json'
			},
			body: JSON.stringify({
				model: ANTHROPIC_MODEL,
				max_tokens: 8192,
				system,
				messages: [{ role: 'user', content: userMessage }]
			})
		});
		if (!res.ok) {
			const t = await res.text();
			console.error('Anthropic fejl:', res.status, t.slice(0, 300));
			throw error(502, `Anthropic ${res.status}`);
		}
		const data = (await res.json()) as {
			content?: Array<{ type: string; text?: string }>;
			stop_reason?: string;
		};
		if (data.stop_reason === 'max_tokens') {
			throw error(502, 'AI-svaret blev for langt. Prøv igen.');
		}
		const raw = (data.content ?? [])
			.filter((c) => c.type === 'text')
			.map((c) => c.text ?? '')
			.join('')
			.trim();
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

		return json({ ok: true, antalDocs: docs.length, antalSvarBrugt: alle.length });
	} catch (e) {
		if (isHttpError(e)) throw e;
		console.error('laer-af-svar fejlede:', e);
		throw error(500, e instanceof Error ? e.message : 'Ukendt fejl');
	}
};
