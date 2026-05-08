// Bulk-aktivering af opskrifter — sætter aktiv=true på alle docs i
// opskrifter-collection (eller dem der matcher --kun-inaktive).
//
// Kør med:
//   npm run aktiver:opskrifter              (alle)
//   npm run aktiver:opskrifter -- --dry     (preview)

import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const sa = JSON.parse(readFileSync(join(__dirname, 'service-account-key.json'), 'utf-8'));
initializeApp({ credential: cert(sa) });
const db = getFirestore();

const dryRun = process.argv.includes('--dry');

async function main() {
	const snap = await db.collection('opskrifter').get();
	const inaktive = snap.docs.filter((d) => d.data().aktiv === false);

	console.log(
		`📋 Total ${snap.size} opskrifter — ${inaktive.length} er inaktive${dryRun ? ' (DRY-RUN)' : ''}`
	);

	if (inaktive.length === 0) {
		console.log('   (ingen at aktivere)');
		process.exit(0);
	}

	for (const d of inaktive.slice(0, 5)) {
		console.log(`   ✓ ${d.data().titel}`);
	}
	if (inaktive.length > 5) console.log(`   ... og ${inaktive.length - 5} mere`);

	if (dryRun) {
		console.log('\n   Ville sætte aktiv=true. Kør uden --dry for at aktivere.');
		process.exit(0);
	}

	const batchSize = 400;
	for (let start = 0; start < inaktive.length; start += batchSize) {
		const batch = db.batch();
		for (const d of inaktive.slice(start, start + batchSize)) {
			batch.update(d.ref, { aktiv: true });
		}
		await batch.commit();
	}
	console.log(`\n✅ Aktiverede ${inaktive.length} opskrifter.`);
}

main().then(() => process.exit(0));
