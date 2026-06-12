// Admin-endpoint: incremental genberegning af MRS-/velvære-dashboardet.
//
// I stedet for at læse alle 600+ kunders historik (som den fulde genberegning,
// scripts/generer-mrs-stats.ts) henter dette KUN de kunder der har lavet en ny
// måling siden sidste snapshot, re-destillerer dem, og genberegner snapshottet
// ud fra per-kunde cachen (mrsCache). Dermed kan det køre serverless på
// Cloudflare uden at ramme timeout/subrequest-loftet.
//
// Sikkerhed: kalderens Firebase ID-token verificeres og email tjekkes mod
// ADMIN_EMAILS. Selve læsning/skrivning sker via service-account (uden om rules).

import type { RequestHandler } from '@sveltejs/kit';
import { json, error } from '@sveltejs/kit';
import { PUBLIC_FIREBASE_API_KEY } from '$env/static/public';
import { ADMIN_EMAILS } from '$lib/admin';
import {
	hentDoc,
	gemDocMerge,
	hentAlleDocs,
	hentHeleCollection,
	hentForaeldreIdsMedNyereEnd
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

export const POST: RequestHandler = async ({ request }) => {
	const auth = request.headers.get('Authorization');
	if (!auth?.startsWith('Bearer ')) throw error(401, 'Manglende Bearer-token');
	const adminEmail = await verificerAdminToken(auth.slice(7));
	if (!adminEmail) throw error(403, 'Ikke autoriseret som admin');

	// 1. Cursor: hvornår blev snapshottet sidst genereret? Vi henter kun
	//    målinger nyere end det.
	const snapDoc = await hentDoc('adminStats/mrs');
	const siden = typeof snapDoc?.genereretAt === 'number' ? snapDoc.genereretAt : 0;

	// 2. Forløb-navne + start-tidspunkt (til pr-forløb-tilskrivning). startDato er
	//    en Firestore-timestamp → kommer som ISO-streng via REST.
	const forlobDocs = await hentAlleDocs('forlob');
	const forlobNavn = new Map<string, string>();
	const forlobStart = new Map<string, number>();
	for (const f of forlobDocs) {
		forlobNavn.set(f.id, (f.data.navn as string) ?? f.id);
		const sd = f.data.startDato;
		const start = typeof sd === 'string' ? new Date(sd).getTime() : undefined;
		if (start && !Number.isNaN(start)) forlobStart.set(f.id, start);
	}

	// 3. Find præcis de kunder der har en ny måling siden sidst.
	const aendredeUids = await hentForaeldreIdsMedNyereEnd('mrs_scores', 'users', 'timestamp', siden);

	// 4. Re-destillér hver ændret kunde og opdatér hendes cache-doc.
	let opdaterede = 0;
	await medGraense(aendredeUids, 8, async (uid) => {
		const brugerDoc = await hentDoc(`users/${uid}`);
		const mrsDocs = (await hentAlleDocs(`users/${uid}/mrs_scores`)).map((d) => d.data as MrsDoc);
		const forlobIds = (brugerDoc?.forlobIds as string[]) ?? [];
		const profil = (brugerDoc?.brugerProfil as { alder?: number; menopaus?: string }) ?? {};
		const entries = distillerKunde(mrsDocs, forlobIds, forlobStart, profil);
		// Kunde uden brugbar data længere: vi lader cache-doc'en blive (ryddes ved
		// næste fulde genberegning) — REST-klienten har ingen delete-funktion endnu.
		if (entries.length === 0) return;
		await gemDocMerge(`mrsCache/${uid}`, { entries });
		opdaterede++;
	});

	// 5. Læs hele cachen og rekonstruér kunde-bidragene.
	const cacheDocs = await hentHeleCollection('mrsCache');
	if (cacheDocs.length === 0) {
		throw error(
			409,
			'Ingen cache fundet — kør den fulde genberegning (scripts/generer-mrs-stats.ts) først.'
		);
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

	// 6. Byg og gem det friske snapshot.
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
		opdateredeKunder: opdaterede,
		fundneAendringer: aendredeUids.length,
		kunderICache: cacheDocs.length,
		genereretAt: snapshot.genereretAt,
		samlet: {
			antalMedData: snapshot.samlet.antalMedData,
			antalMedUdvikling: snapshot.samlet.antalMedUdvikling,
			gnsAendring: snapshot.samlet.gnsAendring,
			andelForbedret: snapshot.samlet.andelForbedret
		}
	});
};
