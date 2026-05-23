// List alle vaneprogrammer i den nye app
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const sa = JSON.parse(readFileSync(join(__dirname, 'service-account-key.json'), 'utf-8'));
initializeApp({ credential: cert(sa) });
const db = getFirestore();

const snap = await db.collection('vaneProgrammer').get();
console.log(`${snap.size} vaneprogrammer:\n`);
for (const d of snap.docs) {
	const dage = await d.ref.collection('days').get();
	const data = d.data() as { navn?: string; antalDage?: number; aktiv?: boolean };
	console.log(`  · ${d.id} — "${data.navn}" (${data.antalDage} dage, ${dage.size} day-docs, aktiv=${data.aktiv})`);
}
