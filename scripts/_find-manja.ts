// Finder manja.andersen@gmail.com og rapporterer hendes allowedEmail
// + evt userDoc + forlobIds.

import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const sa = JSON.parse(readFileSync(join(__dirname, 'service-account-key.json'), 'utf-8'));
initializeApp({ credential: cert(sa) });
const db = getFirestore();

const EMAIL = 'manja.andersen@gmail.com';

async function main() {
	console.log(`Søger efter: ${EMAIL}\n`);

	// 1) allowedEmails-doc
	const aSnap = await db.collection('allowedEmails').doc(EMAIL).get();
	if (aSnap.exists) {
		console.log('=== allowedEmails ===');
		const d = aSnap.data() ?? {};
		console.log(JSON.stringify(d, null, 2));
	} else {
		console.log('Ingen allowedEmail-doc med dette id.');
		// fallback: query
		const q = await db
			.collection('allowedEmails')
			.where('email', '==', EMAIL)
			.get();
		if (!q.empty) {
			console.log('Fandt via email-felt-query:');
			q.docs.forEach((d) => console.log(d.id, JSON.stringify(d.data(), null, 2)));
		}
	}

	console.log('');

	// 2) userDoc — søg via email
	const uSnap = await db.collection('users').where('email', '==', EMAIL).get();
	if (uSnap.empty) {
		console.log('Ingen userDoc — hun har aldrig logget ind på appen.');
	} else {
		console.log(`=== userDoc (${uSnap.size} match) ===`);
		uSnap.docs.forEach((d) => {
			const u = d.data();
			console.log('uid:', d.id);
			console.log('  firstName:', u.firstName);
			console.log('  email:', u.email);
			console.log('  state:', u.state);
			console.log('  accessLevel:', u.accessLevel);
			console.log('  accessSource:', u.accessSource);
			console.log('  activeProduct:', u.activeProduct);
			console.log('  activeSubscription:', u.activeSubscription);
			console.log('  forlobIds:', u.forlobIds);
			console.log(
				'  expiresAt:',
				u.expiresAt ? new Date(u.expiresAt).toISOString().slice(0, 10) : '—'
			);
			console.log(
				'  bonusPeriodEndsAt:',
				u.bonusPeriodEndsAt ? new Date(u.bonusPeriodEndsAt).toISOString().slice(0, 10) : '—'
			);
			console.log('  oprettet:', u.createdAt ? new Date(u.createdAt).toISOString().slice(0, 10) : '—');
		});
	}
}

main().then(() => process.exit(0));
