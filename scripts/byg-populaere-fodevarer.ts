// Bygger en liste af de mest brugte fødevarer på tværs af alle kunders
// måltider og favoritter. Listen pakkes som en TypeScript-konstant i
// src/lib/content/populaere-fodevarer.generated.ts der bundles ind i
// appens build.
//
// Resultat: Mad-modulet kan vise top-N fødevarer ØJEBLIKKELIGT uden at
// hente noget fra Firestore. Den fulde liste hentes i baggrunden og
// caches i IndexedDB.
//
// Genkør scriptet en gang i ny og næ (fx ugentligt) hvis populariteten
// skal opdateres. Output-filen skal committes så den havner i build'et.
//
// Brug:
//   npx tsx scripts/byg-populaere-fodevarer.ts          # default 200 items
//   npx tsx scripts/byg-populaere-fodevarer.ts --max=300

import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const sa = JSON.parse(readFileSync(join(__dirname, 'service-account-key.json'), 'utf-8'));
initializeApp({ credential: cert(sa) });
const db = getFirestore();

const maxArg = process.argv.find((a) => a.startsWith('--max='));
const MAX = maxArg ? parseInt(maxArg.split('=')[1], 10) : 200;

interface MaaltidsItem {
	foodId?: string;
	manuel?: unknown;
}

interface Maaltid {
	items?: MaaltidsItem[];
}

console.log(`Scanner alle måltider for at finde top-${MAX} mest brugte fødevarer…\n`);

// 1. Tæl foodId-brug på tværs af ALLE kunders måltider + favoritter
const optaeller = new Map<string, number>();

const usersSnap = await db.collection('users').get();
let scannedUsers = 0;
for (const u of usersSnap.docs) {
	scannedUsers++;
	if (scannedUsers % 50 === 0) console.log(`  Scanner... ${scannedUsers}/${usersSnap.size} brugere`);
	const maaltiderSnap = await u.ref.collection('maaltider').get();
	for (const m of maaltiderSnap.docs) {
		const data = m.data() as Maaltid;
		for (const item of data.items ?? []) {
			if (!item.foodId || item.manuel) continue;
			optaeller.set(item.foodId, (optaeller.get(item.foodId) ?? 0) + 1);
		}
	}
	const favSnap = await u.ref.collection('favoritmaaltider').get();
	for (const f of favSnap.docs) {
		const data = f.data() as Maaltid;
		for (const item of data.items ?? []) {
			if (!item.foodId || item.manuel) continue;
			// Favoritter tæller dobbelt — de er bevidste valg
			optaeller.set(item.foodId, (optaeller.get(item.foodId) ?? 0) + 2);
		}
	}
}
console.log(`  Færdig: ${scannedUsers} brugere scannet, ${optaeller.size} unikke fødevarer brugt.\n`);

// 2. Sortér efter brug-tal, tag top MAX
const top = Array.from(optaeller.entries())
	.sort((a, b) => b[1] - a[1])
	.slice(0, MAX);

console.log(`Top 10 mest brugte:`);
for (const [id, antal] of top.slice(0, 10)) {
	console.log(`  ${antal}× ${id}`);
}
console.log();

// 3. Hent fuld fødevare-data for top-N
const fodevareIds = top.map(([id]) => id);
const fodevarer: Record<string, unknown>[] = [];
const batchSize = 30; // Firestore 'in'-query begrænset til 30 IDs
for (let i = 0; i < fodevareIds.length; i += batchSize) {
	const batch = fodevareIds.slice(i, i + batchSize);
	const docs = await Promise.all(batch.map((id) => db.collection('fodevarer').doc(id).get()));
	for (const d of docs) {
		if (d.exists) {
			const data = d.data() as Record<string, unknown>;
			fodevarer.push({ id: d.id, ...data });
		}
	}
}
console.log(`Hentet ${fodevarer.length} fødevare-docs (af ${fodevareIds.length} forventede).`);

// 4. Skriv som TypeScript-fil der bundles ind i appen
const sti = join(__dirname, '..', 'src', 'lib', 'content', 'populaere-fodevarer.generated.ts');
const indhold = `// AUTO-GENERERET af scripts/byg-populaere-fodevarer.ts — rør IKKE manuelt.
// Genereret: ${new Date().toISOString()}
// Antal: ${fodevarer.length}
// Kilde: top ${MAX} fødevarer brugt mest på tværs af alle kunders måltider + favoritter.

import type { Fodevare } from './kost';

export const POPULAERE_FODEVARER: Fodevare[] = ${JSON.stringify(fodevarer, null, 2)};
`;

writeFileSync(sti, indhold, 'utf-8');
const kb = Math.round(indhold.length / 1024);
console.log(`\nSkrevet til ${sti} (${kb} KB).`);
console.log(`\nHusk at committe filen så den havner i build'et.`);
