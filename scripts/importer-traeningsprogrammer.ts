// Importerer den gamle apps to træningsprogrammer (kettlebell + no_kettlebell)
// til Kickstart maj 2026 i den nye app. Mapper øvelses-IDs der har skiftet
// navn, og bevarer 1:1 dag-struktur (4 øvelser pr dag, 1 sæt á 45s/15s,
// dag 1+2 tomme som i originalen).
//
// Kør med:
//   npm run importer:traeningsprogrammer            (skriver)
//   npm run importer:traeningsprogrammer -- --dry   (preview)

import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const sa = JSON.parse(readFileSync(join(__dirname, 'service-account-key.json'), 'utf-8'));
initializeApp({ credential: cert(sa) });
const db = getFirestore();

const FORLOB_ID = 'kickstart_maj_2026';
const dryRun = process.argv.includes('--dry');

// Mapping fra gamle app-IDs til den nye apps exercise-IDs.
const ID_MAP: Record<string, string> = {
	squat_stol: 'bodyweight_squat',
	bagud_lunge: 'reverse_lunge',
	skulderpres_sid: 'shoulder_press',
	en_arms_roning: 'bent_over_row',
	superman_hold: 'superman',
	good_mornings: 'good_morning'
};

interface GammelExercise {
	id: string;
	sets: number;
	workSec: number;
	restSec: number;
	bonus?: boolean;
}

interface GammelDag {
	_id: string;
	exercises: GammelExercise[];
}

interface NyExercise {
	exerciseId: string;
	sets: number;
	workSec: number;
	restSec: number;
	bonus?: boolean;
}

interface NyDag {
	dagNummer: number;
	exercises: NyExercise[];
}

function mapExercise(e: GammelExercise): NyExercise {
	const exerciseId = ID_MAP[e.id] ?? e.id;
	const ud: NyExercise = {
		exerciseId,
		sets: e.sets,
		workSec: e.workSec,
		restSec: e.restSec
	};
	if (e.bonus) ud.bonus = true;
	return ud;
}

async function importerProgram(programId: string, dage: GammelDag[]) {
	const sorted = [...dage].sort((a, b) => Number(a._id) - Number(b._id));

	console.log(`\n${dryRun ? '[DRY] ' : ''}=== ${programId} ===`);

	if (!dryRun) {
		// Ryd eksisterende dage (clean slate)
		const eksSnap = await db
			.collection('forlob')
			.doc(FORLOB_ID)
			.collection('mikrotraeningProgrammer')
			.doc(programId)
			.collection('dage')
			.get();
		if (eksSnap.size > 0) {
			const batch = db.batch();
			for (const d of eksSnap.docs) batch.delete(d.ref);
			await batch.commit();
		}
	}

	const batch = db.batch();
	for (const d of sorted) {
		const dagNummer = Number(d._id);
		const exercises = (d.exercises || []).map(mapExercise);
		const dag: NyDag = { dagNummer, exercises };
		console.log(
			`  Dag ${dagNummer}: ${exercises.length === 0 ? '(tom)' : exercises.map((e) => e.exerciseId + (e.bonus ? ' [bonus]' : '')).join(', ')}`
		);
		if (!dryRun) {
			const ref = db
				.collection('forlob')
				.doc(FORLOB_ID)
				.collection('mikrotraeningProgrammer')
				.doc(programId)
				.collection('dage')
				.doc(`dag${dagNummer}`);
			batch.set(ref, dag);
		}
	}
	if (!dryRun) await batch.commit();
}

async function main() {
	console.log(`${dryRun ? '[DRY] ' : ''}Importerer træningsprogrammer → ${FORLOB_ID}`);
	const data = JSON.parse(
		readFileSync(join(__dirname, 'gamle-traeningsprogrammer.json'), 'utf-8')
	) as Record<string, GammelDag[]>;

	await importerProgram('mikrotraening_kettlebell', data.kettlebell);
	await importerProgram('mikrotraening_no_kettlebell', data.no_kettlebell);

	console.log(`\n${dryRun ? '[DRY] ' : ''}Færdig.`);
}

main().catch((e) => {
	console.error('Fejl:', e);
	process.exit(1);
});
