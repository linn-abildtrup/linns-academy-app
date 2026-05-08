// Hurtig lookup af fødevarer der matcher et søgeord.
// Kør med: npx tsx scripts/find-fodevare.ts <søgeord>

import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const sa = JSON.parse(readFileSync(join(__dirname, 'service-account-key.json'), 'utf-8'));
initializeApp({ credential: cert(sa) });
const db = getFirestore();

const q = (process.argv[2] ?? '').toLowerCase().trim();
if (!q) {
	console.error('Brug: npx tsx scripts/find-fodevare.ts <søgeord>');
	process.exit(1);
}

const snap = await db.collection('fodevarer').get();
const matches = snap.docs
	.map((d) => ({ id: d.id, ...d.data() }) as { id: string; name?: string; kilde?: string })
	.filter((f) => (f.name ?? '').toLowerCase().includes(q));

console.log(`Søgeord: "${q}" — ${matches.length} match`);
for (const m of matches.slice(0, 30)) {
	console.log(`  ${m.id.padEnd(40)} ${m.name}  [${m.kilde ?? '-'}]`);
}
if (matches.length > 30) console.log(`  ... og ${matches.length - 30} mere`);
process.exit(0);
