// Generisk diagnose-script. Brug: npx tsx scripts/_find-kunde.ts <email>

import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getAuth as getAdminAuth } from 'firebase-admin/auth';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const sa = JSON.parse(readFileSync(join(__dirname, 'service-account-key.json'), 'utf-8'));
initializeApp({ credential: cert(sa) });
const db = getFirestore();
const auth = getAdminAuth();

const EMAIL = process.argv[2];
if (!EMAIL) {
	console.error('Brug: npx tsx scripts/_find-kunde.ts <email>');
	process.exit(1);
}

(async () => {
	console.log(`Diagnose: ${EMAIL}\n`);

	const a = await db.collection('allowedEmails').doc(EMAIL).get();
	if (a.exists) {
		const d = a.data() ?? {};
		console.log('=== allowedEmails ===');
		console.log(`  firstName: ${d.firstName}`);
		console.log(`  lastName: ${d.lastName}`);
		console.log(`  forlobId: ${d.forlobId}`);
		console.log(`  accessLevel: ${d.accessLevel}`);
		console.log(`  activeProduct: ${d.activeProduct}`);
		console.log(`  status: ${d.status}`);
	} else {
		console.log('Ingen allowedEmail-doc.');
	}

	console.log('');
	try {
		const u = await auth.getUserByEmail(EMAIL);
		console.log('=== Firebase Auth ===');
		console.log(`  uid: ${u.uid}`);
		console.log(`  oprettet: ${u.metadata.creationTime}`);
		console.log(`  sidste login: ${u.metadata.lastSignInTime}`);
		console.log(`  emailVerified: ${u.emailVerified}`);
		console.log(`  disabled: ${u.disabled}`);
	} catch {
		console.log('Findes IKKE i Firebase Auth — har aldrig oprettet konto.');
	}

	console.log('');
	const u = await db.collection('users').where('email', '==', EMAIL).get();
	if (u.empty) {
		console.log('=== userDoc: ikke fundet ===');
	}
	for (const d of u.docs) {
		const ud = d.data();
		console.log('=== userDoc ===');
		console.log(`  uid: ${d.id}`);
		console.log(`  firstName: ${ud.firstName}`);
		console.log(`  forlobIds: ${JSON.stringify(ud.forlobIds)}`);
		console.log(`  activeProduct: ${ud.activeProduct}`);
		console.log(`  accessLevel: ${ud.accessLevel}`);
		console.log(`  state: ${ud.state}`);
		console.log(`  oprettet: ${ud.createdAt ? new Date(ud.createdAt).toISOString().slice(0, 10) : '—'}`);
	}
	process.exit(0);
})();
