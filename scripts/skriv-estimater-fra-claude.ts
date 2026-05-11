// Skriver estimater-fra-claude.json til Firestore.
//
// Værdierne er genereret af Claude (mig, AI'en) baseret på danske kost-tabeller
// (Frida og lignende). De er typisk præcise indenfor 10-15% af de officielle
// tal — vil typisk ramme rigtigt for store grupper (mejeri, kød, frugt) og
// kan være lidt off for brand-produkter eller eksotiske varer.
//
// Kør:
//   npx tsx scripts/skriv-estimater-fra-claude.ts             # dry-run
//   npx tsx scripts/skriv-estimater-fra-claude.ts --skriv     # skriv

import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const sa = JSON.parse(readFileSync(join(__dirname, 'service-account-key.json'), 'utf-8'));
initializeApp({ credential: cert(sa) });
const db = getFirestore();

const skriv = process.argv.includes('--skriv');

interface Estimat {
	id: string;
	kh: number;
	fedt: number;
	kcal: number;
}

const estimater: Estimat[] = JSON.parse(
	readFileSync(join(__dirname, 'estimater-fra-claude.json'), 'utf-8')
);

console.log(`\n=== Skriver ${estimater.length} estimater ===`);
console.log(`Mode: ${skriv ? 'SKRIVER til Firestore' : 'dry-run (ingen ændringer)'}\n`);

console.log('Første 10:');
for (const e of estimater.slice(0, 10)) {
	console.log(`  ${e.id.padEnd(30)} kh=${e.kh}  fedt=${e.fedt}  kcal=${e.kcal}`);
}

if (!skriv) {
	console.log('\n(kør med --skriv for at opdatere Firestore)');
	process.exit(0);
}

console.log('\nSkriver i batches af 400...');
const CHUNK = 400;
for (let i = 0; i < estimater.length; i += CHUNK) {
	const batch = db.batch();
	for (const e of estimater.slice(i, i + CHUNK)) {
		batch.set(
			db.collection('fodevarer').doc(e.id),
			{ kh: e.kh, fedt: e.fedt, kcal: e.kcal },
			{ merge: true }
		);
	}
	await batch.commit();
	console.log(`  ✓ ${Math.min(i + CHUNK, estimater.length)} / ${estimater.length}`);
}
console.log(`\n✓ ${estimater.length} fødevarer opdateret.`);
process.exit(0);
