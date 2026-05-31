// Fjerner birgitte.g.h@gmail.com fra kickstart_juni_2026-whitelisten.
// Hun har aldrig logget ind, saa der er ingen userDoc eller subcollections
// at rydde op i — kun allowedEmail-doc'en slettes.

import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const sa = JSON.parse(readFileSync(join(__dirname, 'service-account-key.json'), 'utf-8'));
initializeApp({ credential: cert(sa) });
const db = getFirestore();

const EMAIL = 'birgitte.g.h@gmail.com';
const apply = process.argv.includes('--apply');

(async () => {
	console.log(`Mode: ${apply ? 'APPLY' : 'DRY-RUN'}\n`);
	const ref = db.collection('allowedEmails').doc(EMAIL);
	const snap = await ref.get();
	if (!snap.exists) {
		console.log('allowedEmail findes ikke — intet at slette.');
		process.exit(0);
	}
	console.log(`Sletter allowedEmail for ${EMAIL}`);
	console.log(`  navn: ${snap.data()?.firstName} ${snap.data()?.lastName}`);
	console.log(`  forlob: ${snap.data()?.forlobId}`);
	if (apply) {
		await ref.delete();
		console.log('\n✅ Slettet.');
	} else {
		console.log('\n⚠️  DRY-RUN — koer med --apply.');
	}
	process.exit(0);
})();
