// Inspect-script til hurtigt at se status på et træningsprogram
// Tæller hvor mange dage der har øvelser, og viser de tomme dage.
//
// Kør med: npm run inspect:program -- <programId>
//   eller: npm run inspect:program (lister alle programmer kort)

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

async function inspectProgram(programId: string) {
	const programSnap = await db.collection('trainingPrograms').doc(programId).get();
	if (!programSnap.exists) {
		console.error(`❌ Program ${programId} findes ikke.`);
		process.exit(1);
	}
	const program = programSnap.data() as { navn?: string; antalDage?: number };
	console.log(`📋 Program: ${program.navn ?? programId}  (antalDage: ${program.antalDage ?? '?'})`);

	const daysSnap = await db.collection('trainingPrograms').doc(programId).collection('days').get();
	const dage = daysSnap.docs
		.map((d) => d.data() as { dagNummer: number; titel?: string; exercises?: unknown[] })
		.sort((a, b) => a.dagNummer - b.dagNummer);

	let tomme = 0;
	let fyldte = 0;
	for (const d of dage) {
		const antal = d.exercises?.length ?? 0;
		const status = antal > 0 ? '✓' : '·';
		const titel = d.titel ? ` (${d.titel})` : '';
		console.log(`   ${status} Dag ${d.dagNummer}: ${antal} øvelser${titel}`);
		if (antal === 0) tomme++;
		else fyldte++;
	}
	console.log(`\n   Total: ${dage.length} dage  ·  ${fyldte} fyldte  ·  ${tomme} tomme`);
}

async function listAlle() {
	const snap = await db.collection('trainingPrograms').get();
	if (snap.empty) {
		console.log('Ingen programmer fundet.');
		return;
	}
	console.log('📋 Programmer i Firestore:\n');
	for (const d of snap.docs) {
		const data = d.data() as { navn?: string; antalDage?: number };
		console.log(`   ${d.id}  —  ${data.navn ?? '(uden navn)'}  (${data.antalDage ?? '?'} dage)`);
	}
	console.log(`\nKør npm run inspect:program -- <programId> for detaljer.`);
}

const programId = process.argv[2];
const promise = programId ? inspectProgram(programId) : listAlle();
promise.then(() => process.exit(0));
