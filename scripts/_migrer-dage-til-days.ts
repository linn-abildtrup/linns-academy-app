// Migrerer subcollection-navn 'dage' → 'days' for de to nye Kropsro-
// programmer. Koden laeser fra 'days', men jeg skrev til 'dage'.

import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const sa = JSON.parse(readFileSync(join(__dirname, 'service-account-key.json'), 'utf-8'));
initializeApp({ credential: cert(sa) });
const db = getFirestore();

const FORLOB_ID = 'kropsro_maj_2026';
const PROGRAMMER = ['kropsro_84_uden_kb', 'kropsro_84_med_kb'];

async function main() {
	for (const programId of PROGRAMMER) {
		const programRef = db.collection('forlob').doc(FORLOB_ID).collection('mikrotraeningProgrammer').doc(programId);
		const gamleDage = await programRef.collection('dage').get();
		const nyeDays = await programRef.collection('days').get();
		console.log(`\n${programId}: gamle 'dage'=${gamleDage.size}, eksisterende 'days'=${nyeDays.size}`);

		// Slet evt eksisterende 'days' for at undgaa rester
		if (nyeDays.size > 0) {
			const b = db.batch();
			for (const d of nyeDays.docs) b.delete(d.ref);
			await b.commit();
			console.log(`  Slettede ${nyeDays.size} eksisterende days-docs`);
		}

		// Kopier alle 'dage' → 'days'
		const b = db.batch();
		for (const d of gamleDage.docs) {
			b.set(programRef.collection('days').doc(d.id), d.data());
		}
		await b.commit();
		console.log(`  Kopieret ${gamleDage.size} dage til days/`);

		// Slet de gamle 'dage'-docs
		const b2 = db.batch();
		for (const d of gamleDage.docs) b2.delete(d.ref);
		await b2.commit();
		console.log(`  Slettede ${gamleDage.size} gamle dage-docs`);
	}
	console.log('\nFaerdig.');
}
main().then(() => process.exit(0));
