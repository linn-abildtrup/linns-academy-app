// Genererer refleksions-aktivitet-snapshot til admin-dashboardet: adminStats/
// refleksioner. Dashboardets "Refleksioner"-fane læser kun det ene dokument.
//
// Koer manuelt:  npx tsx scripts/generer-refleksion-stats.ts
// (Samme tal kan også opdateres via "Fuld genberegning"-knappen på dashboardet.)
//
// En refleksion = en vanedag hvor klienten har skrevet i note-feltet. Grupperes
// pr SPECIFIKT forløb via product-dokumentets forlobId (produkt-id'et lyver —
// juni-Kickstart ligger under premiumforløb-produktet).
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import {
	byggRefleksionSnapshot,
	type ReflRecord,
	type ReflForlobMeta
} from '../src/lib/stats/refleksionBeregning.ts';

const __dirname = dirname(fileURLToPath(import.meta.url));
const sa = JSON.parse(readFileSync(join(__dirname, 'service-account-key.json'), 'utf-8'));
initializeApp({ credential: cert(sa) });
const db = getFirestore();

// Forløb-meta (navn + type) pr forlobId.
const forlobMeta = new Map<string, ReflForlobMeta>();
for (const d of (await db.collection('forlob').get()).docs) {
	const f = d.data() as { navn?: string; type?: string };
	forlobMeta.set(d.id, {
		navn: f.navn ?? d.id,
		type: f.type === 'kropsro' ? 'kropsro' : 'kickstart'
	});
}

// (uid/productId) -> forlobId, fra product-dokumenterne.
const key2forlob = new Map<string, string>();
for (const d of (await db.collectionGroup('products').get()).docs) {
	const fid = d.data().forlobId as string | undefined;
	const uid = d.ref.parent.parent?.id;
	if (fid && uid) key2forlob.set(`${uid}/${d.id}`, fid);
}

const snap = await db.collectionGroup('vanedage').get();
const records: ReflRecord[] = [];
for (const d of snap.docs) {
	const pid = d.ref.parent.parent?.id ?? '?';
	const uid = d.ref.parent.parent?.parent?.parent?.id ?? '?';
	const forlobId = key2forlob.get(`${uid}/${pid}`);
	if (!forlobId) continue; // vanedag uden kendt forløb springes over
	const data = d.data() as { dagNummer?: number; note?: string };
	const dagNummer =
		typeof data.dagNummer === 'number' ? data.dagNummer : Number(d.id.replace('dag', '')) || 0;
	records.push({ forlobId, uid, dagNummer, laengde: (data.note ?? '').trim().length });
}

const snapshot = byggRefleksionSnapshot(records, forlobMeta, Date.now());
await db.collection('adminStats').doc('refleksioner').set(snapshot);

console.log('✓ adminStats/refleksioner opdateret');
console.log(`  Vanedage gennemgået: ${snap.size}`);
const s = snapshot.samlet;
console.log(
	`  Samlet: ${s.antalRefleksioner} refleksioner · ${s.antalKunder} kunder · ${s.gnsPrKunde}/kunde · ${s.gnsLaengde} tegn`
);
console.log(
	`  Alle Kickstart: ${snapshot.prType.kickstart.antalRefleksioner} · Alle Kropsro: ${snapshot.prType.kropsro.antalRefleksioner}`
);
console.log(
	`  Pr forløb: ${snapshot.prForlob.map((f) => `${f.navn}:${f.antalRefleksioner}`).join(' · ')}`
);
