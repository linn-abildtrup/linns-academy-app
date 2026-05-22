import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const sa = JSON.parse(readFileSync(join(__dirname, 'service-account-key.json'), 'utf-8'));
initializeApp({ credential: cert(sa) });
const db = getFirestore();

async function main() {
	const snap = await db.collection('opskrifter').limit(2).get();
	for (const d of snap.docs) {
		console.log('---', d.id, '---');
		console.log(JSON.stringify(d.data(), null, 2));
	}
	console.log(`\nTotal i Firestore: ${(await db.collection('opskrifter').count().get()).data().count}`);
}
main().then(() => process.exit(0));
