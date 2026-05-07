// Auto-generate-script til træningsprogrammer
// Fylder et programs days-subcollection med 1 ben + 1 overkrop + 1 core/stabilitet
// pr dag, cyklet deterministisk gennem øvelserne. Default 3 sæt × 30s × 10s.
//
// Filter sker via programmets `udstyr`-felt: hvis det IKKE indeholder 'kettlebell',
// fjernes alle kettlebell-øvelser fra puljen.
//
// Kør med: npm run generate:program -- <programId>

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

interface Exercise {
	id: string;
	cat: 'ben' | 'overkrop' | 'core' | 'stabilitet';
	udstyr: string[];
}

interface ProgramData {
	navn?: string;
	antalDage?: number;
	udstyr?: string[];
}

async function generate(programId: string) {
	const programSnap = await db.collection('trainingPrograms').doc(programId).get();
	if (!programSnap.exists) {
		console.error(`❌ Program ${programId} findes ikke.`);
		process.exit(1);
	}
	const program = programSnap.data() as ProgramData;
	const antalDage = program.antalDage ?? 21;
	const programUdstyr = program.udstyr ?? [];
	console.log(`📋 Program: ${program.navn ?? programId}  (${antalDage} dage)`);

	const exSnap = await db.collection('exercises').get();
	const alleExercises = exSnap.docs.map(
		(d) => ({ id: d.id, ...d.data() }) as unknown as Exercise
	);

	const tilladte = programUdstyr.includes('kettlebell')
		? alleExercises
		: alleExercises.filter((e) => !e.udstyr?.includes('kettlebell'));

	const ben = tilladte.filter((e) => e.cat === 'ben').map((e) => e.id);
	const overkrop = tilladte.filter((e) => e.cat === 'overkrop').map((e) => e.id);
	const coreStab = tilladte
		.filter((e) => e.cat === 'core' || e.cat === 'stabilitet')
		.map((e) => e.id);

	console.log(`   Pulje: ${ben.length} ben · ${overkrop.length} overkrop · ${coreStab.length} core/stab`);

	if (ben.length === 0 || overkrop.length === 0 || coreStab.length === 0) {
		console.error(`❌ Mangler øvelser i en eller flere kategorier — kan ikke generere.`);
		process.exit(1);
	}

	const batch = db.batch();
	const daysCol = db.collection('trainingPrograms').doc(programId).collection('days');
	for (let i = 0; i < antalDage; i++) {
		const dagNummer = i + 1;
		const dag = {
			dagNummer,
			titel: '',
			indledning: '',
			exercises: [
				{
					exerciseId: ben[i % ben.length],
					sets: 3,
					workSec: 30,
					restSec: 10,
					bonus: false
				},
				{
					exerciseId: overkrop[i % overkrop.length],
					sets: 3,
					workSec: 30,
					restSec: 10,
					bonus: false
				},
				{
					exerciseId: coreStab[i % coreStab.length],
					sets: 3,
					workSec: 30,
					restSec: 10,
					bonus: false
				}
			]
		};
		batch.set(daysCol.doc(`dag${dagNummer}`), dag);
	}
	await batch.commit();
	console.log(`\n✅ Skrev ${antalDage} dage til ${programId}.`);
}

const programId = process.argv[2];
if (!programId) {
	console.error('Mangler programId. Brug: npm run generate:program -- <programId>');
	process.exit(1);
}
generate(programId).then(() => process.exit(0));
