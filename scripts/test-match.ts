// Test ingrediens-matching mod databasen.
// Kør med: npx tsx scripts/test-match.ts <ingrediens>

import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import {
	findFodevareForIngrediens,
	renseIngrediensNavn,
	type Fodevare
} from '../src/lib/content/kost.ts';

const __dirname = dirname(fileURLToPath(import.meta.url));
const sa = JSON.parse(readFileSync(join(__dirname, 'service-account-key.json'), 'utf-8'));
initializeApp({ credential: cert(sa) });
const db = getFirestore();

const q = process.argv[2] ?? 'kyllingebryst, i tern';
const snap = await db.collection('fodevarer').get();
const foods = snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Fodevare);

console.log(`Total ${foods.length} fødevarer`);
console.log(`Søgeord: "${q}"`);
console.log(`Renset: "${renseIngrediensNavn(q)}"`);

const match = findFodevareForIngrediens(q, foods);
if (match) {
	console.log(`✓ Match: ${match.name}  (id=${match.id}, p=${match.p}, f=${match.f})`);
} else {
	console.log('❌ Intet match');
}
process.exit(0);
