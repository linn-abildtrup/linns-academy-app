// Dump alle users/{uid}/products docs for en email — bruges til at
// diagnose hvilke produkt-faner kunden ser i biblioteket.

import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const sa = JSON.parse(readFileSync(join(__dirname, 'service-account-key.json'), 'utf-8'));
initializeApp({ credential: cert(sa) });
const db = getFirestore();

const email = (process.argv[2] ?? '').trim().toLowerCase();
if (!email) {
	console.error('Brug: npx tsx scripts/dump-products.ts <email>');
	process.exit(1);
}

const snap = await db.collection('users').where('email', '==', email).get();
for (const userDoc of snap.docs) {
	console.log(`uid=${userDoc.id}`);
	const productsSnap = await userDoc.ref.collection('products').get();
	if (productsSnap.empty) {
		console.log('  (ingen products)');
		continue;
	}
	for (const p of productsSnap.docs) {
		console.log(`  products/${p.id}:`);
		console.log(`    ${JSON.stringify(p.data(), null, 2).replace(/\n/g, '\n    ')}`);
	}
}
