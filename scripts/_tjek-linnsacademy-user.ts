// Tjekker om der findes en userDoc med email linnsacademy@gmail.com,
// og om der er testerFeatures sat.
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
	const snap = await db.collection('users').where('email', '==', 'linnsacademy@gmail.com').limit(1).get();
	if (snap.empty) {
		console.log('Ingen userDoc med email linnsacademy@gmail.com.');
		console.log('(Brugeren har aldrig logget ind med den email.)');
		return;
	}
	const d = snap.docs[0];
	console.log(`userDoc: ${d.ref.path}`);
	console.log(JSON.stringify(d.data(), null, 2));
}
main().then(() => process.exit(0));
