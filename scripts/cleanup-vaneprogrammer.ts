// Cleanup-script: rydder op efter datamodel-skift
//
// Tidligere model: vaneProgrammer/{id}/days/{dayId} delt på tværs af forløb
// Ny model: forlob/{forlobId}/vaneprogram/{dagId} pr forløb
//
// Dette script:
//   1. Sletter hele vaneProgrammer-collection (inkl. days-subcollections)
//   2. Fjerner forlob.vaneProgramId-feltet fra alle forløb
//
// Kør med: npx tsx scripts/cleanup-vaneprogrammer.ts
//
// Idempotent: kan køres flere gange uden problem.

import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const serviceAccount = JSON.parse(
	readFileSync(join(__dirname, 'service-account-key.json'), 'utf-8')
);

initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore();

async function cleanup() {
	console.log('🧹 Cleanup af gammel vaneProgrammer-collection...');

	const programmer = await db.collection('vaneProgrammer').get();
	if (programmer.empty) {
		console.log('   (ingen vaneProgrammer at slette)');
	} else {
		for (const program of programmer.docs) {
			const days = await program.ref.collection('days').get();
			for (const day of days.docs) {
				await day.ref.delete();
			}
			await program.ref.delete();
			console.log(`   ✓ Slettet vaneProgrammer/${program.id} (${days.size} dage)`);
		}
	}

	console.log('\n🧹 Fjerner vaneProgramId-felt fra alle forløb...');
	const forlob = await db.collection('forlob').get();
	let opdateret = 0;
	for (const f of forlob.docs) {
		const data = f.data();
		if ('vaneProgramId' in data) {
			await f.ref.update({ vaneProgramId: FieldValue.delete() });
			console.log(`   ✓ Fjernet vaneProgramId fra forlob/${f.id}`);
			opdateret++;
		}
	}
	if (opdateret === 0) {
		console.log('   (ingen forløb havde vaneProgramId-feltet)');
	}

	console.log('\n✅ Cleanup færdig.');
}

cleanup().then(() => process.exit(0));
