// Admin-endpoint: genberegner "manglende kundeaktivitet"-listen (adminStats/
// aktivitet). Egen knap fordi den er tung (læser alle måltider/vanedage/træning
// i få store opslag). Overvåger kun kunder i et igangværende forløb.
//
// Sikkerhed: Firebase ID-token verificeres + email tjekkes mod ADMIN_EMAILS.

import type { RequestHandler } from '@sveltejs/kit';
import { json, error, isHttpError } from '@sveltejs/kit';
import { PUBLIC_FIREBASE_API_KEY } from '$env/static/public';
import { ADMIN_EMAILS } from '$lib/admin';
import {
	hentAlleDocs,
	hentHeleCollection,
	hentCollectionGroupAlle,
	gemDocMerge
} from '$lib/server/firestoreRest';
import {
	byggAktivitetSnapshot,
	type AktivitetInput,
	type ForlobType
} from '$lib/stats/aktivitetBeregning';

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

const DAG = 86400000;
// Timestamp-felter kommer som ISO-streng via REST; tal-felter som number.
const tsMs = (v: unknown): number | null =>
	typeof v === 'number'
		? v
		: typeof v === 'string' && !Number.isNaN(Date.parse(v))
			? Date.parse(v)
			: null;

export const POST: RequestHandler = async ({ request }) => {
	const auth = request.headers.get('Authorization');
	if (!auth?.startsWith('Bearer ')) throw error(401, 'Manglende Bearer-token');
	if (!(await verificerAdminToken(auth.slice(7)))) throw error(403, 'Ikke autoriseret som admin');

	try {
		const naa = Date.now();

		// 1. Igangværende forløb (startDato kommer som ISO-streng via REST).
		const ongoing = new Map<string, { navn: string; type: ForlobType }>();
		for (const f of await hentAlleDocs('forlob')) {
			const start = tsMs(f.data.startDato);
			if (start === null) continue;
			const slut = start + ((f.data.antalDage as number) ?? 0) * DAG;
			if (naa >= start && naa <= slut) {
				ongoing.set(f.id, {
					navn: (f.data.navn as string) ?? f.id,
					type: f.data.type === 'kropsro' ? 'kropsro' : 'kickstart'
				});
			}
		}

		// 2. Overvågede kunder = produkt knyttet til et igangværende forløb.
		const monit = new Map<string, { forlobNavn: string; forlobType: ForlobType }>();
		for (const pd of await hentCollectionGroupAlle('products', 'users', ['forlobId'])) {
			const fid = pd.data.forlobId as string | undefined;
			if (fid && ongoing.has(fid)) {
				monit.set(pd.parentId, {
					forlobNavn: ongoing.get(fid)!.navn,
					forlobType: ongoing.get(fid)!.type
				});
			}
		}

		// 3. Bruger-info (firstName + email), bulk.
		const brugere = new Map<string, { firstName?: string; email?: string }>();
		for (const u of await hentHeleCollection('users')) {
			brugere.set(u.id, { firstName: u.data.firstName as string, email: u.data.email as string });
		}

		// 4. Aktivitets-tal pr overvåget kunde (maxT + to 7-dages-vinduer). Kun det
		//    nødvendige tidsstempel hentes pr collection (projektion).
		const akt = new Map<string, { maxT: number | null; c7: number; c14: number }>();
		for (const uid of monit.keys()) akt.set(uid, { maxT: null, c7: 0, c14: 0 });
		const reg = (uid: string, t: number | null) => {
			if (t === null) return;
			const a = akt.get(uid);
			if (!a) return;
			if (a.maxT === null || t > a.maxT) a.maxT = t;
			if (t > naa - 7 * DAG) a.c7++;
			else if (t > naa - 14 * DAG) a.c14++;
		};
		const kilder: Array<[string, string]> = [
			['maaltider', 'oprettet'],
			['vanedage', 'savedAt'],
			['aboVanedage', 'savedAt'],
			['traeningHistorik', 'gennemfoertAt']
		];
		for (const [col, felt] of kilder) {
			for (const d of await hentCollectionGroupAlle(col, 'users', [felt])) {
				reg(d.parentId, tsMs(d.data[felt]));
			}
		}

		// 5. Byg input + snapshot.
		const kunder: AktivitetInput[] = [];
		for (const [uid, m] of monit) {
			const a = akt.get(uid)!;
			const u = brugere.get(uid) ?? {};
			kunder.push({
				uid,
				fornavn: u.firstName ?? '',
				email: u.email ?? '',
				forlobNavn: m.forlobNavn,
				forlobType: m.forlobType,
				sidstAktiv: a.maxT,
				sidste7: a.c7,
				forrige7: a.c14
			});
		}
		const snapshot = byggAktivitetSnapshot(kunder, naa);
		await gemDocMerge('adminStats/aktivitet', snapshot as unknown as Record<string, unknown>);

		return json({
			ok: true,
			antalOvervaaget: snapshot.antalOvervaaget,
			inaktive: snapshot.inaktive.length,
			faldende: snapshot.faldende.length
		});
	} catch (e) {
		if (isHttpError(e)) throw e;
		console.error('genberegn-aktivitet fejlede:', e);
		throw error(500, e instanceof Error ? e.message : 'Ukendt fejl');
	}
};
