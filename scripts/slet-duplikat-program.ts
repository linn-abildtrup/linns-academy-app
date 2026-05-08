// Sletter trainingPrograms/mikrotraening_kettlebell_21 efter at have
// tjekket at ingen userProducts referer til det. Kører som one-off via
// Firebase Admin SDK.
//
// Kør: npx tsx scripts/slet-duplikat-program.ts
//
// Sletningen er destruktiv — kør først med DRY_RUN=true (default) for
// at se hvad der ville ske, så DRY_RUN=false for at udføre.

import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const serviceAccount = JSON.parse(
	readFileSync(join(__dirname, 'service-account-key.json'), 'utf-8')
);

initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore();

const PROGRAM_ID = 'mikrotraening_kettlebell_21';
const DRY_RUN = process.env.DRY_RUN !== 'false';

async function main() {
	console.log(`Tjek af program: ${PROGRAM_ID}`);
	console.log(`DRY_RUN = ${DRY_RUN}\n`);

	// 1. Tjek brugere
	console.log('🔍 Tjekker om nogen brugere har programmet valgt...');
	const usersSnap = await db.collection('users').get();
	const matches: { uid: string; productId: string }[] = [];

	for (const userDoc of usersSnap.docs) {
		const productsSnap = await userDoc.ref.collection('products').get();
		for (const productDoc of productsSnap.docs) {
			const data = productDoc.data() as { programValg?: Record<string, string> };
			if (data.programValg?.mikrotraening === PROGRAM_ID) {
				matches.push({ uid: userDoc.id, productId: productDoc.id });
			}
		}
	}

	if (matches.length > 0) {
		console.log(`\n⚠️  ${matches.length} bruger(e) har ${PROGRAM_ID} valgt:`);
		for (const m of matches) {
			console.log(`   ${m.uid} / ${m.productId}`);
		}
		console.log('\nKan ikke slette — flyt brugerne til mikrotraening_kettlebell først.');
		process.exit(1);
	}
	console.log('✅ Ingen brugere har programmet valgt.\n');

	// 2. Tæl dage
	const daysSnap = await db
		.collection('trainingPrograms')
		.doc(PROGRAM_ID)
		.collection('days')
		.get();
	console.log(`📋 Programmet har ${daysSnap.size} dag-dokumenter`);

	if (DRY_RUN) {
		console.log('\nDRY_RUN: ville slette:');
		console.log(`   - trainingPrograms/${PROGRAM_ID}`);
		console.log(`   - ${daysSnap.size} dage under days/`);
		console.log('\nKør igen med DRY_RUN=false for at udføre.');
		return;
	}

	// 3. Slet
	console.log('\n🗑  Sletter dage...');
	for (const d of daysSnap.docs) {
		await d.ref.delete();
		console.log(`   ✗ days/${d.id}`);
	}
	await db.collection('trainingPrograms').doc(PROGRAM_ID).delete();
	console.log(`   ✗ trainingPrograms/${PROGRAM_ID}`);
	console.log('\n✅ Færdig.');
}

main()
	.then(() => process.exit(0))
	.catch((e) => {
		console.error(e);
		process.exit(1);
	});
