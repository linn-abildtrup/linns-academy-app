import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
const __dirname = dirname(fileURLToPath(import.meta.url));
const sa = JSON.parse(readFileSync(join(__dirname, 'service-account-key.json'), 'utf-8'));
initializeApp({ credential: cert(sa) });
const db = getFirestore();
const sogeOrd = (process.argv[2] ?? 'tomat').toLowerCase();
(async () => {
	const snap = await db.collection('fodevarer').get();
	const matches: { id: string; name: string }[] = [];
	for (const d of snap.docs) {
		const n = (d.data().name ?? '').toLowerCase();
		if (n.includes(sogeOrd)) matches.push({ id: d.id, name: d.data().name });
	}
	matches.sort((a, b) => a.name.length - b.name.length);
	console.log(`Matches for "${sogeOrd}" (${matches.length}):`);
	for (const m of matches) console.log(`  [${m.name.length} chars] ${m.name}`);
	process.exit(0);
})();
