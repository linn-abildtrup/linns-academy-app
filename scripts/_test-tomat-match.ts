import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
const __dirname = dirname(fileURLToPath(import.meta.url));
const sa = JSON.parse(readFileSync(join(__dirname, 'service-account-key.json'), 'utf-8'));
initializeApp({ credential: cert(sa) });
const db = getFirestore();
(async () => {
	const snap = await db.collection('fodevarer').get();
	const foods: any[] = [];
	for (const d of snap.docs) {
		foods.push({ id: d.id, ...d.data() });
	}
	console.log(`Total foods: ${foods.length}`);
	const tomatExact = foods.find((f) => f.name?.toLowerCase() === 'tomat');
	console.log(`Eksakt 'tomat': ${tomatExact?.name ?? '(NULL)'} (id=${tomatExact?.id ?? '?'})`);
	const tomatList = foods.filter((f) => f.name?.toLowerCase().includes('tomat')).sort((a, b) => a.name.length - b.name.length);
	console.log(`\nAlle 'tomat'-foods sorteret efter length:`);
	for (const f of tomatList) console.log(`  [${f.name.length}] ${f.name} (id=${f.id})`);
	process.exit(0);
})();
