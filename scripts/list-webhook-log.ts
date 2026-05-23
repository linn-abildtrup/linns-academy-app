import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const sa = JSON.parse(readFileSync(join(__dirname, 'service-account-key.json'), 'utf-8'));
initializeApp({ credential: cert(sa) });
const db = getFirestore();

// Sidste 24 timer
const cutoff = Date.now() - 24 * 60 * 60 * 1000;

const snap = await db.collection('webhookLog').orderBy('modtaget', 'desc').limit(50).get();
console.log(`${snap.size} nyeste webhook-events (af de seneste 50):\n`);

for (const doc of snap.docs) {
	const d = doc.data() as {
		modtaget?: number;
		event?: string;
		email?: string;
		produktId?: string;
		status?: string;
		note?: string;
	};
	if (!d.modtaget) continue;
	const dato = new Date(d.modtaget).toISOString().replace('T', ' ').slice(0, 19);
	const inden24h = d.modtaget > cutoff ? '★' : ' ';
	console.log(
		`  ${inden24h} ${dato} · ${d.event ?? '?'} · ${d.email ?? '-'} · ${d.produktId ?? '-'} · ${d.status ?? '?'}`
	);
	if (d.note) console.log(`      → ${d.note}`);
}
