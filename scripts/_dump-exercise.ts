import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
const __dirname = dirname(fileURLToPath(import.meta.url));
const sa = JSON.parse(readFileSync(join(__dirname, 'service-account-key.json'), 'utf-8'));
initializeApp({ credential: cert(sa) });
const db = getFirestore();
const id = process.argv[2] ?? 'bent_over_row';
(async () => {
	const snap = await db.collection('exercises').doc(id).get();
	if (!snap.exists) { console.log('Findes ikke'); process.exit(1); }
	const d = snap.data() ?? {};
	console.log(JSON.stringify({
		id: snap.id, name: d.name, desc: d.desc, how: d.how,
		cat: d.cat, catLabel: d.catLabel, tags: d.tags, udstyr: d.udstyr,
		treaningsformer: d.treaningsformer, videoPath: d.videoPath, aktiv: d.aktiv
	}, null, 2));
	process.exit(0);
})();
