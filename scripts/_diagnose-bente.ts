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
	// Find brugere med firstName='Bente' og forlobIds=kickstart_juni_2026
	const snap = await db
		.collection('users')
		.where('forlobIds', 'array-contains', 'kickstart_juni_2026')
		.get();
	for (const d of snap.docs) {
		const u = d.data();
		if (u.firstName !== 'Bente') continue;
		console.log(`uid: ${d.id}`);
		console.log(`  email: ${u.email}`);
		console.log(`  forlobIds: ${JSON.stringify(u.forlobIds)}`);
		console.log(`  activeProduct: ${u.activeProduct}`);
		console.log(`  accessLevel: ${u.accessLevel}`);

		const mrs = await db.collection(`users/${d.id}/mrs_scores`).get();
		console.log(`  mrs_scores: ${mrs.size}`);
		mrs.docs.forEach((m) => {
			const md = m.data();
			console.log(
				`    ${new Date(md.timestamp).toISOString().slice(0, 10)} (mp=${md.measurePoint}, kunSliders=${md.kunSliders === true})`
			);
		});

		console.log('\n');
	}
	process.exit(0);
})();
