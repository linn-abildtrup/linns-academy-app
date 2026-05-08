// Tester ingrediens-matching for alle aktive opskrifter og rapporterer
// hvilke ingredienser der ikke kan matches.

import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import {
	findFodevareForIngrediens,
	type Fodevare
} from '../src/lib/content/kost.ts';

const __dirname = dirname(fileURLToPath(import.meta.url));
const sa = JSON.parse(readFileSync(join(__dirname, 'service-account-key.json'), 'utf-8'));
initializeApp({ credential: cert(sa) });
const db = getFirestore();

const foodSnap = await db.collection('fodevarer').get();
const foods = foodSnap.docs.map((d) => ({ id: d.id, ...d.data() }) as Fodevare);

const opskriftSnap = await db.collection('opskrifter').get();
const ikkeMatchede = new Map<string, number>();
let totalIng = 0;
let matchede = 0;

for (const d of opskriftSnap.docs) {
	const data = d.data() as { ingredienser?: { navn: string }[] };
	for (const ing of data.ingredienser ?? []) {
		totalIng++;
		const navn = (ing.navn ?? '').trim();
		if (!navn) continue;
		const m = findFodevareForIngrediens(navn, foods);
		if (m) {
			matchede++;
		} else {
			ikkeMatchede.set(navn, (ikkeMatchede.get(navn) ?? 0) + 1);
		}
	}
}

console.log(`📋 ${matchede} / ${totalIng} ingredienser matcher`);
console.log(`\nTop 30 ikke-matchede:`);
const sorted = [...ikkeMatchede.entries()].sort((a, b) => b[1] - a[1]);
for (const [navn, antal] of sorted.slice(0, 30)) {
	console.log(`  ${String(antal).padStart(3)}× ${navn}`);
}
if (sorted.length > 30) console.log(`  ... og ${sorted.length - 30} andre`);
process.exit(0);
