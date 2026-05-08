// Migrerer eksisterende top-level trainingPrograms ind under et forløb.
//
// Konvertering: trainingPrograms/{programId} →
//                 forlob/{forlobId}/mikrotraeningProgrammer/{programId}
//               trainingPrograms/{programId}/days/{dagId} →
//                 forlob/{forlobId}/mikrotraeningProgrammer/{programId}/days/{dagId}
//
// Kør:
//   DRY_RUN=true  npx tsx scripts/migrer-mikrotraening-til-forlob.ts
//   DRY_RUN=false npx tsx scripts/migrer-mikrotraening-til-forlob.ts
//
// De gamle top-level dokumenter slettes IKKE — de står som fallback
// indtil ny kode er testet på production. En separat oprydning sker
// senere når vi er sikre.

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

const FORLOB_ID = process.env.FORLOB_ID ?? 'kickstart_maj_2026';
const PROGRAM_IDS = ['mikrotraening_kettlebell', 'mikrotraening_no_kettlebell'];
const DRY_RUN = process.env.DRY_RUN !== 'false';

async function main() {
	console.log(`Migration: trainingPrograms → forlob/${FORLOB_ID}/mikrotraeningProgrammer`);
	console.log(`DRY_RUN = ${DRY_RUN}\n`);

	// 1. Verificer at forløbet findes
	const forlobSnap = await db.collection('forlob').doc(FORLOB_ID).get();
	if (!forlobSnap.exists) {
		console.error(`❌ Forløbet ${FORLOB_ID} findes ikke i Firestore.`);
		process.exit(1);
	}
	console.log(`✅ Forløb ${FORLOB_ID} findes.\n`);

	for (const programId of PROGRAM_IDS) {
		console.log(`📋 Program: ${programId}`);
		const srcRef = db.collection('trainingPrograms').doc(programId);
		const srcSnap = await srcRef.get();

		if (!srcSnap.exists) {
			console.log(`   ⚠️  ${programId} findes ikke top-level — springer over.\n`);
			continue;
		}

		const programData = srcSnap.data();
		console.log(`   Navn: ${programData?.navn}`);

		const dageSnap = await srcRef.collection('days').get();
		console.log(`   ${dageSnap.size} dage at flytte`);

		const dstRef = db
			.collection('forlob')
			.doc(FORLOB_ID)
			.collection('mikrotraeningProgrammer')
			.doc(programId);

		// Tjek om destinationen allerede har data — så har vi måske allerede migreret
		const eksistdst = await dstRef.get();
		if (eksistdst.exists) {
			console.log(`   ⚠️  Destination eksisterer allerede — springer over.\n`);
			continue;
		}

		if (DRY_RUN) {
			console.log(`   DRY_RUN: ville kopiere program + ${dageSnap.size} dage\n`);
			continue;
		}

		// Kopier program-dokumentet
		await dstRef.set(programData ?? {});
		console.log(`   ✓ Program-dokument kopieret`);

		// Kopier alle dage
		for (const dagDoc of dageSnap.docs) {
			await dstRef.collection('days').doc(dagDoc.id).set(dagDoc.data());
		}
		console.log(`   ✓ ${dageSnap.size} dage kopieret\n`);
	}

	if (DRY_RUN) {
		console.log('Kør med DRY_RUN=false for at udføre migrationen.');
	} else {
		console.log('✅ Migration færdig. Verificer med:');
		console.log(`   npm run inspect:program -- (gamle stadig der)`);
		console.log(`   npx tsx scripts/inspect-forlob-programmer.ts ${FORLOB_ID}`);
	}
}

main()
	.then(() => process.exit(0))
	.catch((e) => {
		console.error(e);
		process.exit(1);
	});
