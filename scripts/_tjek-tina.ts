import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const sa = JSON.parse(readFileSync(join(__dirname, 'service-account-key.json'), 'utf-8'));
initializeApp({ credential: cert(sa) });
const db = getFirestore();

(async () => {
	const a = await db.collection('allowedEmails').doc('pettersontina@gmail.com').get();
	if (a.exists) {
		console.log('allowedEmail:');
		console.log(JSON.stringify(a.data(), null, 2));
	} else {
		console.log('Ingen allowedEmail med dette id.');
	}
	process.exit(0);
})();
