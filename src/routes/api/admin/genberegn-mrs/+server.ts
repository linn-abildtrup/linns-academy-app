// Admin-endpoint: genberegning af MRS-/velvære-dashboardet. To modes:
//
//   ?mode=incremental (standard) — "Opdater tal". Henter KUN kunder med en ny
//     måling siden sidste snapshot (collection-group-query), re-destillerer dem
//     og genberegner ud fra per-kunde cachen (mrsCache). Lynhurtig, dagligt.
//
//   ?mode=fuld — "Fuld genberegning". Læser alle brugere + alle målinger i få
//     store opslag (læs-alt + bunke-skriv), re-destillerer ALLE kunder og rydder
//     stale cache. Bruges efter profil-rettelser / sletninger. Tungere men holder
//     sig stadig under Cloudflares loft fordi den læser i bulk, ikke pr kunde.
//
// Begge bruger samme beregnings-logik (mrsBeregning.ts) som det lokale script.
// Sikkerhed: kalderens Firebase ID-token verificeres og email tjekkes mod
// ADMIN_EMAILS. Selve læsning/skrivning sker via service-account (uden om rules).

import type { RequestHandler } from '@sveltejs/kit';
import { json, error, isHttpError } from '@sveltejs/kit';
import { PUBLIC_FIREBASE_API_KEY } from '$env/static/public';
import { ADMIN_EMAILS } from '$lib/admin';
import {
	hentDoc,
	gemDocMerge,
	hentAlleDocs,
	hentHeleCollection,
	hentForaeldreIdsMedNyereEnd,
	hentCollectionGroupAlle,
	batchWrite
} from '$lib/server/firestoreRest';
import {
	distillerKunde,
	byggSnapshot,
	type MrsDoc,
	type KundeMrs,
	type KundeForlobBidrag
} from '$lib/stats/mrsBeregning';

async function verificerAdminToken(idToken: string): Promise<string | null> {
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
		const data = (await res.json()) as { users?: Array<{ email?: string }> };
		const email = data.users?.[0]?.email?.toLowerCase() ?? null;
		if (!email) return null;
		const adminListe = (ADMIN_EMAILS as readonly string[]).map((e) => e.toLowerCase());
		return adminListe.includes(email) ? email : null;
	} catch (e) {
		console.warn('Token-verifikation fejlede:', e);
		return null;
	}
}

// Kører N tasks med højst `graense` samtidige — så vi ikke fyrer hundredevis af
// Firestore-kald af på én gang (Cloudflare har et subrequest-loft).
async function medGraense<T>(items: T[], graense: number, fn: (t: T) => Promise<void>) {
	for (let i = 0; i < items.length; i += graense) {
		await Promise.all(items.slice(i, i + graense).map(fn));
	}
}

export const POST: RequestHandler = async ({ request, url }) => {
	const auth = request.headers.get('Authorization');
	if (!auth?.startsWith('Bearer ')) throw error(401, 'Manglende Bearer-token');
	const adminEmail = await verificerAdminToken(auth.slice(7));
	if (!adminEmail) throw error(403, 'Ikke autoriseret som admin');

	try {
		const mode = url.searchParams.get('mode') === 'fuld' ? 'fuld' : 'incremental';

		// Forløb-navne + start-tidspunkt (bruges i begge modes). startDato er en
		// Firestore-timestamp → kommer som ISO-streng via REST.
		const forlobDocs = await hentAlleDocs('forlob');
		const forlobNavn = new Map<string, string>();
		const forlobStart = new Map<string, number>();
		for (const f of forlobDocs) {
			forlobNavn.set(f.id, (f.data.navn as string) ?? f.id);
			const sd = f.data.startDato;
			const start = typeof sd === 'string' ? new Date(sd).getTime() : undefined;
			if (start && !Number.isNaN(start)) forlobStart.set(f.id, start);
		}

		let opdaterede = 0;
		let fundne = 0;

		if (mode === 'fuld') {
			// FULD: læs alle brugere + alle målinger (få store opslag), re-destillér
			// ALLE kunder, skriv cachen i bunker, og ryd stale cache-docs.
			const brugere = new Map<string, Record<string, unknown>>();
			for (const u of await hentHeleCollection('users')) brugere.set(u.id, u.data);

			const maalingerPerUid = new Map<string, MrsDoc[]>();
			for (const m of await hentCollectionGroupAlle('mrs_scores', 'users')) {
				if (!m.parentId) continue;
				if (!maalingerPerUid.has(m.parentId)) maalingerPerUid.set(m.parentId, []);
				maalingerPerUid.get(m.parentId)!.push(m.data as MrsDoc);
			}

			const cacheWrites: Array<
				{ path: string; data: Record<string, unknown> } | { path: string; delete: true }
			> = [];
			const nyeIds = new Set<string>();
			for (const [uid, maalinger] of maalingerPerUid) {
				const u = brugere.get(uid) ?? {};
				const entries = distillerKunde(
					maalinger,
					(u.forlobIds as string[]) ?? [],
					forlobStart,
					(u.brugerProfil as { alder?: number; menopaus?: string }) ?? {}
				);
				if (entries.length === 0) continue;
				nyeIds.add(uid);
				cacheWrites.push({ path: `mrsCache/${uid}`, data: { entries } });
			}
			// Ryd cache-docs for kunder der ikke længere har data.
			for (const c of await hentHeleCollection('mrsCache')) {
				if (!nyeIds.has(c.id)) cacheWrites.push({ path: `mrsCache/${c.id}`, delete: true });
			}
			await batchWrite(cacheWrites);
			opdaterede = nyeIds.size;
			fundne = nyeIds.size;
		} else {
			// INCREMENTAL: kun kunder med en ny måling siden sidste snapshot.
			const snapDoc = await hentDoc('adminStats/mrs');
			const siden = typeof snapDoc?.genereretAt === 'number' ? snapDoc.genereretAt : 0;
			const aendredeUids = await hentForaeldreIdsMedNyereEnd(
				'mrs_scores',
				'users',
				'timestamp',
				siden
			);
			fundne = aendredeUids.length;
			await medGraense(aendredeUids, 8, async (uid) => {
				const brugerDoc = await hentDoc(`users/${uid}`);
				const mrsDocs = (await hentAlleDocs(`users/${uid}/mrs_scores`)).map(
					(d) => d.data as MrsDoc
				);
				const forlobIds = (brugerDoc?.forlobIds as string[]) ?? [];
				const profil = (brugerDoc?.brugerProfil as { alder?: number; menopaus?: string }) ?? {};
				const entries = distillerKunde(mrsDocs, forlobIds, forlobStart, profil);
				if (entries.length === 0) return;
				await gemDocMerge(`mrsCache/${uid}`, { entries });
				opdaterede++;
			});
		}

		// Læs hele cachen og genberegn snapshottet (begge modes).
		const cacheDocs = await hentHeleCollection('mrsCache');
		if (cacheDocs.length === 0) {
			throw error(409, 'Ingen cache fundet — prøv en fuld genberegning.');
		}
		const alleKunder: KundeMrs[] = [];
		const prForlobKunder = new Map<string, KundeMrs[]>();
		for (const c of cacheDocs) {
			const entries = (c.data.entries as KundeForlobBidrag[]) ?? [];
			for (const { forlobId, kunde } of entries) {
				alleKunder.push(kunde);
				if (!prForlobKunder.has(forlobId)) prForlobKunder.set(forlobId, []);
				prForlobKunder.get(forlobId)!.push(kunde);
			}
		}
		const snapshot = byggSnapshot(
			alleKunder,
			prForlobKunder,
			forlobNavn,
			Date.now(),
			cacheDocs.length
		);
		await gemDocMerge('adminStats/mrs', snapshot as unknown as Record<string, unknown>);

		return json({
			ok: true,
			mode,
			opdateredeKunder: opdaterede,
			fundneAendringer: fundne,
			kunderICache: cacheDocs.length,
			genereretAt: snapshot.genereretAt,
			samlet: {
				antalMedData: snapshot.samlet.antalMedData,
				antalMedUdvikling: snapshot.samlet.antalMedUdvikling,
				gnsAendring: snapshot.samlet.gnsAendring,
				andelForbedret: snapshot.samlet.andelForbedret
			}
		});
	} catch (e) {
		if (isHttpError(e)) throw e; // bevar fx 409 + dens besked
		// Vis den RIGTIGE fejl til admin (ellers skjuler SvelteKit den som
		// "Internal Error"). Typisk: collection-group-index mangler — så
		// indeholder beskeden en URL der opretter det.
		console.error('genberegn-mrs fejlede:', e);
		const besked = e instanceof Error ? e.message : 'Ukendt fejl';
		throw error(500, besked);
	}
};
