// Genererer refleksions-aktivitet-snapshot til admin-dashboardet: adminStats/
// refleksioner. Dashboardets "Refleksioner"-fane læser kun det ene dokument.
//
// Koer manuelt:  npx tsx scripts/generer-refleksion-stats.ts
// (Samme tal kan også opdateres via "Fuld genberegning"-knappen på dashboardet.)
//
// En refleksion = en vanedag hvor klienten har skrevet i note-feltet.
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { byggRefleksionSnapshot, type ReflRecord } from '../src/lib/stats/refleksionBeregning.ts';

const __dirname = dirname(fileURLToPath(import.meta.url));
const sa = JSON.parse(readFileSync(join(__dirname, 'service-account-key.json'), 'utf-8'));
initializeApp({ credential: cert(sa) });
const db = getFirestore();

const snap = await db.collectionGroup('vanedage').get();
const records: ReflRecord[] = [];
for (const d of snap.docs) {
	// Sti: users/{uid}/products/{productId}/vanedage/{dagId}
	const produkt = d.ref.parent.parent?.id ?? '?';
	const uid = d.ref.parent.parent?.parent?.parent?.id ?? '?';
	const data = d.data() as { dagNummer?: number; note?: string };
	const dagNummer =
		typeof data.dagNummer === 'number' ? data.dagNummer : Number(d.id.replace('dag', '')) || 0;
	records.push({ produkt, uid, dagNummer, laengde: (data.note ?? '').trim().length });
}

const snapshot = byggRefleksionSnapshot(records, Date.now());
await db.collection('adminStats').doc('refleksioner').set(snapshot);

console.log('✓ adminStats/refleksioner opdateret');
console.log(`  Vanedage gennemgået: ${snap.size}`);
const s = snapshot.samlet;
console.log(
	`  Samlet: ${s.antalRefleksioner} refleksioner · ${s.antalKunder} kunder · ${s.gnsPrKunde}/kunde · ${s.gnsLaengde} tegn i snit`
);
console.log(
	`  Kickstart: ${snapshot.prProdukt.kickstart.antalRefleksioner} · Kropsro: ${snapshot.prProdukt.kropsro.antalRefleksioner}`
);
console.log(
	`  Engagement-kurve (samlet, dag:antal): ${s.prDag
		.slice(0, 12)
		.map((p) => `${p.dagNummer}:${p.antal}`)
		.join(' ')}`
);
