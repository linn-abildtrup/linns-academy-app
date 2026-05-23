import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const sa = JSON.parse(readFileSync(join(__dirname, 'service-account-key.json'), 'utf-8'));
initializeApp({ credential: cert(sa) });
const db = getFirestore();

const snap = await db.collection('exercises').get();
console.log(`${snap.size} exercises:`);
for (const d of snap.docs) {
	const data = d.data() as { name?: string; cat?: string; videoPath?: string };
	console.log(`  ${d.id} — ${data.name} → videoPath: ${data.videoPath ?? '(ingen)'}`);
}
