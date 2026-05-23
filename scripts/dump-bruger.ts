// Dump hele users-doc'en for en email.

import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const sa = JSON.parse(readFileSync(join(__dirname, 'service-account-key.json'), 'utf-8'));
initializeApp({ credential: cert(sa) });
const db = getFirestore();

const email = (process.argv[2] ?? '').trim().toLowerCase();
if (!email) {
	console.error('Brug: npx tsx scripts/dump-bruger.ts <email>');
	process.exit(1);
}

const snap = await db.collection('users').where('email', '==', email).get();
if (snap.empty) {
	console.log(`Ingen users-doc med email=${email}`);
	process.exit(0);
}

for (const d of snap.docs) {
	console.log(`uid=${d.id}`);
	const data = d.data() as Record<string, unknown>;
	console.log(JSON.stringify(data, null, 2));
}
