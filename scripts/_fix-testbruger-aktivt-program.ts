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
	const apply = process.argv.includes('--apply');
	const userQ = await db.collection('users').where('email', '==', 'kickstart-01-06-2026@linnsacademy.dk').get();
	const u = userQ.docs[0];
	const ud = u.data();
	console.log(`Foer: ${JSON.stringify(ud.aktivtTraeningsprogram)}`);
	const nyt = {
		kilde: 'tildelt' as const,
		programId: 'mikrotraening_kettlebell',
		forlobId: 'kickstart_juni_2026'
	};
	console.log(`Efter: ${JSON.stringify(nyt)}`);
	if (apply) {
		await u.ref.update({ aktivtTraeningsprogram: nyt });
		console.log('Opdateret.');
	} else {
		console.log('Dry-run — koer med --apply');
	}
	process.exit(0);
})();
