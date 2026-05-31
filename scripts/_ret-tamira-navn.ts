// Ændrer Tamiras firstName fra 'Tamira' til 'Tamira Mariann' baade i
// allowedEmails og userDoc, saa hun ser 'Godaften, Tamira Mariann' i appen.

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
const NYT_FORNAVN = 'Tamira Mariann';
const apply = process.argv.includes('--apply');

(async () => {
	console.log(`Mode: ${apply ? 'APPLY' : 'DRY-RUN'}\n`);

	const aRef = db.collection('allowedEmails').doc(EMAIL);
	const aSnap = await aRef.get();
	if (aSnap.exists) {
		console.log(`allowedEmails firstName: '${aSnap.data()?.firstName}' → '${NYT_FORNAVN}'`);
		if (apply) await aRef.update({ firstName: NYT_FORNAVN, updatedAt: Date.now() });
	}

	const uSnap = await db.collection('users').where('email', '==', EMAIL).limit(1).get();
	if (!uSnap.empty) {
		const u = uSnap.docs[0];
		console.log(`userDoc firstName:       '${u.data().firstName}' → '${NYT_FORNAVN}'`);
		if (apply) await u.ref.update({ firstName: NYT_FORNAVN });
	}

	console.log(apply ? '\n✅ Opdateret.' : '\n⚠️  DRY-RUN — koer med --apply.');
	process.exit(0);
})();
