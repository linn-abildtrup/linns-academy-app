// Opretter de 4 abo-mikrotræningsprogrammer (basis/premium × kettlebell/
// no_kettlebell) i Firestore. Hver med 21 dages randomiseret indhold:
// 3 trænings-øvelser + 1 bonus-øvelse, 1 sæt á 45s arbejde + 15s hvile.
//
// Kør: npm run importer:abo-mikrotraening [-- --dry]

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

// Øvelses-IDs i den nye apps exercises-collection
const POOLS = {
	kettlebell: {
		ben: [
			'bodyweight_squat',
			'sumo_squat',
			'goblet_squat',
			'sumo_dodloft',
			'dodloft_kettlebell',
			'reverse_lunge_nv',
			'reverse_lunge',
			'step_up_nv',
			'step_up',
			'glute_bridge_nv',
			'glute_bridge',
			'wall_sit'
		],
		overkrop: ['shoulder_press', 'incline_pushup', 'bent_over_row', 'superman'],
		core_stab: ['thruster', 'inchworm', 'cat_cow', 'mini_hops', 'good_morning', 'planke', 'bird_dog']
	},
	no_kettlebell: {
		ben: [
			'bodyweight_squat',
			'sumo_squat',
			'reverse_lunge_nv',
			'step_up_nv',
			'glute_bridge_nv',
			'wall_sit'
		],
		overkrop: ['incline_pushup', 'superman'],
		core_stab: ['inchworm', 'cat_cow', 'mini_hops', 'good_morning', 'planke', 'bird_dog']
	}
};

function mulberry32(seed: number): () => number {
	return () => {
		seed |= 0;
		seed = (seed + 0x6d2b79f5) | 0;
		let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
		t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

function generateProgram(
	pool: { ben: string[]; overkrop: string[]; core_stab: string[] },
	seed: number
) {
	const rng = mulberry32(seed);
	const pick = (a: string[]) => a[Math.floor(rng() * a.length)];
	// Pluk et nyt element der ikke allerede er i 'undgaa'-listen. Forhindrer
	// at samme øvelse vælges to gange på samme dag (især bonus = core_stab).
	const pickIkke = (a: string[], undgaa: string[]) => {
		const filtreret = a.filter((x) => !undgaa.includes(x));
		const liste = filtreret.length > 0 ? filtreret : a;
		return liste[Math.floor(rng() * liste.length)];
	};
	return Array.from({ length: 21 }, (_, i) => {
		const ben = pick(pool.ben);
		const overkrop = pick(pool.overkrop);
		const coreStab = pick(pool.core_stab);
		// Bonus-øvelsen skal være anderledes end de 3 obligatoriske.
		const bonus = pickIkke(pool.core_stab, [ben, overkrop, coreStab]);
		return {
			dagNummer: i + 1,
			exercises: [
				{ exerciseId: ben, sets: 1, workSec: 45, restSec: 15 },
				{ exerciseId: overkrop, sets: 1, workSec: 45, restSec: 15 },
				{ exerciseId: coreStab, sets: 1, workSec: 45, restSec: 15 },
				{ exerciseId: bonus, sets: 1, workSec: 45, restSec: 15, bonus: true }
			]
		};
	});
}

async function importerProgram(
	docId: string,
	pool: { ben: string[]; overkrop: string[]; core_stab: string[] },
	seed: number,
	metadata: {
		navn: string;
		beskrivelse: string;
		udstyr: string[];
		variant: 'kettlebell' | 'no_kettlebell';
	}
) {
	const dage = generateProgram(pool, seed);
	console.log(`\n${dryRun ? '[DRY] ' : ''}=== ${docId} (${metadata.navn}) ===`);
	for (const dag of dage.slice(0, 5)) {
		const navne = dag.exercises
			.map((e) => `${e.exerciseId}${e.bonus ? ' [BONUS]' : ''}`)
			.join(', ');
		console.log(`  Dag ${dag.dagNummer}: ${navne}`);
	}
	console.log(`  … og ${dage.length - 5} mere`);

	if (dryRun) return;

	// Slet eksisterende dage (clean slate)
	const eksSnap = await db.collection('aboMikrotraening').doc(docId).collection('days').get();
	if (eksSnap.size > 0) {
		const batch = db.batch();
		for (const d of eksSnap.docs) batch.delete(d.ref);
		await batch.commit();
	}

	// Skriv metadata
	await db.collection('aboMikrotraening').doc(docId).set({
		navn: metadata.navn,
		beskrivelse: metadata.beskrivelse,
		treaningsform: 'mikrotraening',
		niveau: 'begynder',
		aktiv: true,
		udstyr: metadata.udstyr,
		variant: metadata.variant,
		antalDage: 21,
		dagligTid: 4,
		genererConfig: { antalOvelser: 4, sets: 1, workSec: 45, restSec: 15 }
	});

	// Skriv dage
	const batch = db.batch();
	for (const dag of dage) {
		const ref = db
			.collection('aboMikrotraening')
			.doc(docId)
			.collection('days')
			.doc(`dag${dag.dagNummer}`);
		batch.set(ref, dag);
	}
	await batch.commit();
	console.log(`  ✓ ${dage.length} dage skrevet`);
}

async function main() {
	console.log(`${dryRun ? '[DRY] ' : ''}Importerer 4 abo-mikrotræningsprogrammer\n`);

	await importerProgram('basis_kettlebell', POOLS.kettlebell, 11111, {
		navn: 'Daglig mikrotræning – kettlebell',
		beskrivelse: 'Tre minutters daglig styrketræning. 21 dage der looper.',
		udstyr: ['kettlebell'],
		variant: 'kettlebell'
	});
	await importerProgram('basis_no_kettlebell', POOLS.no_kettlebell, 22222, {
		navn: 'Daglig mikrotræning – uden udstyr',
		beskrivelse: 'Tre minutters daglig styrketræning uden udstyr. 21 dage der looper.',
		udstyr: ['ingen'],
		variant: 'no_kettlebell'
	});
	await importerProgram('premium_kettlebell', POOLS.kettlebell, 33333, {
		navn: 'Daglig mikrotræning – kettlebell (premium)',
		beskrivelse: 'Tre minutters daglig styrketræning. 21 dage der looper.',
		udstyr: ['kettlebell'],
		variant: 'kettlebell'
	});
	await importerProgram('premium_no_kettlebell', POOLS.no_kettlebell, 44444, {
		navn: 'Daglig mikrotræning – uden udstyr (premium)',
		beskrivelse: 'Tre minutters daglig styrketræning uden udstyr. 21 dage der looper.',
		udstyr: ['ingen'],
		variant: 'no_kettlebell'
	});

	console.log(`\n${dryRun ? '[DRY] ' : ''}Færdig.`);
}

main().catch((e) => {
	console.error('Fejl:', e);
	process.exit(1);
});
