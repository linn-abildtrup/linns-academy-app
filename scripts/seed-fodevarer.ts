// Seed-script til fødevaredatabasen
// Skriver alle PF_FOODS-items til fodevarer/{id}-collection.
// Idempotent: kører du det igen, opdateres eksisterende docs uden at miste
// custom fødevarer Linn har tilføjet via admin (de har egne id'er).
//
// Kør med: npm run seed:fodevarer

import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { PF_FOODS } from './foods-data';

const __dirname = dirname(fileURLToPath(import.meta.url));
const serviceAccount = JSON.parse(
	readFileSync(join(__dirname, 'service-account-key.json'), 'utf-8')
);

initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore();

async function seed() {
	console.log(`🥦 Seeder fødevaredatabase (${PF_FOODS.length} items)...`);

	const batchSize = 400;
	let skrevet = 0;

	for (let start = 0; start < PF_FOODS.length; start += batchSize) {
		const batch = db.batch();
		const chunk = PF_FOODS.slice(start, start + batchSize);
		for (const food of chunk) {
			const { id, ...data } = food;
			const ref = db.collection('fodevarer').doc(id);
			batch.set(ref, data, { merge: true });
		}
		await batch.commit();
		skrevet += chunk.length;
		console.log(`   ✓ Batch ${start}-${start + chunk.length - 1} (${chunk.length} items)`);
	}

	console.log(`\n✅ Seedet ${skrevet} fødevarer.`);
}

seed().then(() => process.exit(0));
