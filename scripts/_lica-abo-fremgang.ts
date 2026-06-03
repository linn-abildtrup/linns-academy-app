import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
const __dirname = dirname(fileURLToPath(import.meta.url));
const sa = JSON.parse(readFileSync(join(__dirname, 'service-account-key.json'), 'utf-8'));
initializeApp({ credential: cert(sa) });
const db = getFirestore();
const uid = 'uLd5uRubf8ajCOPV5buztB3DV123';
(async () => {
	const subs = await db.doc(`users/${uid}`).listCollections();
	for (const c of subs) {
		console.log(`\nSubcollection: ${c.id}`);
		const snap = await c.limit(5).get();
		for (const d of snap.docs) {
			console.log(`  ${d.id}: ${JSON.stringify(d.data()).slice(0, 250)}`);
		}
	}
	process.exit(0);
})();
