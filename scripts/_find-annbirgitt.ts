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
	const uSnap = await db.collection('users').where('email', '==', 'ab.porskrog@gmail.com').limit(1).get();
	if (uSnap.empty) {
		console.log('Ingen userDoc for ab.porskrog@gmail.com');
		return;
	}
	const u = uSnap.docs[0].data();
	console.log('Alle felter på userDoc:');
	for (const [k, v] of Object.entries(u)) {
		console.log(`  ${k}: ${JSON.stringify(v)}`);
	}
}
main().then(() => process.exit(0));
