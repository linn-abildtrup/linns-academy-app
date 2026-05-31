import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const sa = JSON.parse(readFileSync(join(__dirname, 'service-account-key.json'), 'utf-8'));
initializeApp({ credential: cert(sa) });
const db = getFirestore();

const EMAIL = 'tamiramariann63@gmail.com';

(async () => {
	const a = await db.collection('allowedEmails').doc(EMAIL).get();
	if (a.exists) {
		const d = a.data() ?? {};
		console.log('allowedEmails:');
		console.log(`  firstName: ${d.firstName}`);
		console.log(`  lastName: ${d.lastName}`);
		console.log(`  status: ${d.status}`);
	}
	const u = await db.collection('users').where('email', '==', EMAIL).get();
	if (u.empty) console.log('\nuserDoc: ikke registreret (har ikke logget ind)');
	for (const d of u.docs) {
		console.log('\nuserDoc:');
		console.log(`  firstName: ${d.data().firstName}`);
	}
	process.exit(0);
})();
