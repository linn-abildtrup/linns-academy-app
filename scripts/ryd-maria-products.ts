// Engangs: slet products/basisabo for Maria (forlob@linnsacademy.dk).
// Den blev oprettet ved en fejl da jeg konverterede hende til basis-app-
// bruger — products-collection skal kun indeholde rigtige forløbs-køb.

import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const sa = JSON.parse(readFileSync(join(__dirname, 'service-account-key.json'), 'utf-8'));
initializeApp({ credential: cert(sa) });
const db = getFirestore();

const APPLY = process.argv.includes('--apply');
const EMAIL = 'forlob@linnsacademy.dk';

const snap = await db.collection('users').where('email', '==', EMAIL).get();
if (snap.empty) {
	console.log('Ingen users-doc fundet.');
	process.exit(0);
}

for (const userDoc of snap.docs) {
	const productsRef = userDoc.ref.collection('products');
	const basisaboRef = productsRef.doc('basisabo');
	const basisaboSnap = await basisaboRef.get();
	if (!basisaboSnap.exists) {
		console.log(`products/basisabo findes ikke for ${EMAIL}`);
		continue;
	}
	console.log(`Sletter users/${userDoc.id}/products/basisabo:`);
	console.log(`  ${JSON.stringify(basisaboSnap.data(), null, 2).replace(/\n/g, '\n  ')}`);
	if (APPLY) {
		await basisaboRef.delete();
		console.log('  Slettet.');
	}
}

if (!APPLY) console.log('\nKør med --apply for at slette.');
