// Admin-endpoint: opsummerer klienternes refleksions-svar for ÉN produkt-dag
// med Claude. On-demand (admin trykker "Opsummer temaer" i Refleksioner-fanen).
//
// Sender KUN de anonyme svar-tekster til Anthropic — ingen navne/uid'er.
// Sikkerhed: Firebase ID-token verificeres + email tjekkes mod ADMIN_EMAILS.

import type { RequestHandler } from '@sveltejs/kit';
import { json, error, isHttpError } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import { PUBLIC_FIREBASE_API_KEY } from '$env/static/public';
import { ADMIN_EMAILS } from '$lib/admin';
import { hentDoc, hentAlleDocs, hentCollectionGroupAlle } from '$lib/server/firestoreRest';

const ANTHROPIC_MODEL = 'claude-sonnet-4-6';
const MAX_SVAR = 250; // loft så token-forbruget er forudsigeligt
const MAX_SVAR_LAENGDE = 600; // trim meget lange enkeltsvar

async function verificerAdminToken(idToken: string): Promise<string | null> {
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
		const data = (await res.json()) as { users?: Array<{ email?: string }> };
		const email = data.users?.[0]?.email?.toLowerCase() ?? null;
		if (!email) return null;
		const adminListe = (ADMIN_EMAILS as readonly string[]).map((e) => e.toLowerCase());
		return adminListe.includes(email) ? email : null;
	} catch {
		return null;
	}
}

const PRODUKT_NAVN: Record<string, string> = {
	kickstart: 'Kickstart',
	premiumforløb: 'Kropsro'
};

export const POST: RequestHandler = async ({ request }) => {
	const auth = request.headers.get('Authorization');
	if (!auth?.startsWith('Bearer ')) throw error(401, 'Manglende Bearer-token');
	if (!(await verificerAdminToken(auth.slice(7)))) throw error(403, 'Ikke autoriseret som admin');

	try {
		const body = (await request.json()) as { produkt?: string; dag?: number };
		const produkt = body.produkt ?? '';
		const dag = Number(body.dag);
		if (!PRODUKT_NAVN[produkt] || !Number.isFinite(dag)) {
			throw error(400, 'Ugyldig produkt eller dag.');
		}

		// Saml dagens svar (anonymt) for det valgte produkt.
		const vanedage = await hentCollectionGroupAlle('vanedage', 'users');
		const svar: string[] = [];
		for (const vd of vanedage) {
			const dele = vd.path.split('/');
			const pi = dele.lastIndexOf('products');
			const vdProdukt = pi >= 0 && pi + 1 < dele.length ? dele[pi + 1] : '';
			if (vdProdukt !== produkt) continue;
			const d = vd.data as { dagNummer?: number; note?: string };
			const vdDag =
				typeof d.dagNummer === 'number'
					? d.dagNummer
					: Number((dele[dele.length - 1] ?? '').replace('dag', '')) || 0;
			if (vdDag !== dag) continue;
			const note = (d.note ?? '').trim();
			if (note.length > 0) svar.push(note.slice(0, MAX_SVAR_LAENGDE));
		}

		if (svar.length < 3) {
			throw error(409, `For få svar at opsummere (${svar.length}). Vælg en dag med flere svar.`);
		}

		// Dagens refleksions-spørgsmål (best-effort): tag et forløb af samme type.
		const type = produkt === 'premiumforløb' ? 'kropsro' : 'kickstart';
		let spoergsmaal = '';
		const forlob = await hentAlleDocs('forlob');
		const repForlob = forlob.find((f) => (f.data.type as string) === type);
		if (repForlob) {
			const dagDoc = await hentDoc(`forlob/${repForlob.id}/vaneprogram/dag${dag}`);
			spoergsmaal = ((dagDoc?.reflection as string) ?? '').trim();
		}

		const valgte = svar.slice(0, MAX_SVAR);
		const svarTekst = valgte.map((s, i) => `${i + 1}. ${s}`).join('\n');
		const system =
			'Du er en omhyggelig analytiker for et dansk menopause-coachingforløb (Linns Academy). ' +
			'Du får en række ANONYME refleksions-svar fra klienter på samme dag i forløbet. ' +
			'Opsummer kort, konkret og varmt på dansk. Find ikke på noget der ikke står i svarene.';
		const userMessage =
			`Forløb: ${PRODUKT_NAVN[produkt]}, dag ${dag}.` +
			(spoergsmaal ? `\nDagens refleksions-spørgsmål: "${spoergsmaal}"` : '') +
			`\n\nHer er ${valgte.length} anonyme svar:\n\n${svarTekst}\n\n` +
			'Giv en kort opsummering i punktform med disse afsnit:\n' +
			'**Gennemgående temaer** (3-5 punkter)\n' +
			'**Mønstre og stemning** (hvad går igen følelsesmæssigt)\n' +
			'**Vær opmærksom på** (evt. bekymringer eller noget Linn bør reagere på — ellers skriv "intet særligt").\n' +
			'Hold det konkret og kort.';

		const apiKey = env.ANTHROPIC_API_KEY;
		if (!apiKey) throw error(500, 'ANTHROPIC_API_KEY mangler i Cloudflare Pages env-vars');

		const res = await fetch('https://api.anthropic.com/v1/messages', {
			method: 'POST',
			headers: {
				'x-api-key': apiKey,
				'anthropic-version': '2023-06-01',
				'content-type': 'application/json'
			},
			body: JSON.stringify({
				model: ANTHROPIC_MODEL,
				max_tokens: 1024,
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
			usage?: unknown;
		};
		const opsummering = (data.content ?? [])
			.filter((c) => c.type === 'text')
			.map((c) => c.text ?? '')
			.join('')
			.trim();

		return json({
			ok: true,
			produkt,
			dag,
			spoergsmaal,
			antalSvar: valgte.length,
			antalIalt: svar.length,
			opsummering
		});
	} catch (e) {
		if (isHttpError(e)) throw e;
		console.error('refleksion-temaer fejlede:', e);
		throw error(500, e instanceof Error ? e.message : 'Ukendt fejl');
	}
};
