import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const sa = JSON.parse(readFileSync(join(__dirname, 'service-account-key.json'), 'utf-8'));
initializeApp({ credential: cert(sa) });
const db = getFirestore();

const FORLOB_ID = process.argv[2] ?? 'kropsro_maj_2026';
const PROGRAMS = ['kropsro_84_med_kb', 'kropsro_84_uden_kb'];

(async () => {
	const exercisesSnap = await db.collection('exercises').get();
	const exMap = new Map<string, { name: string; cat: string; udstyr: string[] }>();
	for (const d of exercisesSnap.docs) {
		const x = d.data();
		exMap.set(d.id, {
			name: x.name ?? '(uden navn)',
			cat: x.catLabel ?? x.cat ?? '',
			udstyr: x.udstyr ?? []
		});
	}

	for (const programId of PROGRAMS) {
		console.log(`\n========== ${programId} ==========`);
		const pgmRef = db.collection(`forlob/${FORLOB_ID}/mikrotraeningProgrammer`).doc(programId);
		const pgm = await pgmRef.get();
		const pData = pgm.data();
		if (!pData) {
			console.log('  (program findes ikke)');
			continue;
		}
		console.log(`Navn: ${pData.navn ?? '(uden navn)'}`);
		console.log(`Niveau: ${pData.niveau ?? '?'}, antalDage: ${pData.antalDage ?? '?'}`);

		const daysSnap = await pgmRef.collection('days').orderBy('dagNummer').get();
		console.log(`Antal day-docs: ${daysSnap.size}`);
		for (const d of daysSnap.docs) {
			const day = d.data();
			const exs = day.exercises ?? [];
			if (exs.length === 0) {
				console.log(`\n--- Dag ${day.dagNummer}: ${day.titel ?? ''} --- (ingen ovelser)`);
				continue;
			}
			console.log(`\n--- Dag ${day.dagNummer}: ${day.titel ?? ''} ---`);
			console.log('  # | Ovelse                                    | Sets | Work | Pause | Kategori     | Udstyr        | Bonus');
			console.log('  --+-------------------------------------------+------+------+-------+--------------+---------------+------');
			exs.forEach((ex: { exerciseId: string; sets: number; workSec: number; restSec: number; bonus: boolean }, i: number) => {
				const meta = exMap.get(ex.exerciseId) ?? { name: ex.exerciseId, cat: '?', udstyr: [] };
				const navn = meta.name.padEnd(42).slice(0, 42);
				const sets = String(ex.sets).padStart(4);
				const work = `${ex.workSec}s`.padStart(4);
				const rest = `${ex.restSec}s`.padStart(5);
				const cat = (meta.cat ?? '').padEnd(12).slice(0, 12);
				const udstyr = (meta.udstyr ?? []).join(',').padEnd(13).slice(0, 13);
				const bonus = ex.bonus ? 'ja' : '';
				console.log(`  ${String(i + 1).padStart(2)} | ${navn} | ${sets} | ${work} | ${rest} | ${cat} | ${udstyr} | ${bonus}`);
			});
		}
	}
	process.exit(0);
})();
