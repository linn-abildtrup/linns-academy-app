import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
const __dirname = dirname(fileURLToPath(import.meta.url));
const sa = JSON.parse(readFileSync(join(__dirname, 'service-account-key.json'), 'utf-8'));
initializeApp({ credential: cert(sa) });
const db = getFirestore();
const FORLOB = 'kickstart_juni_2026';
const PROGRAMS = ['mikrotraening_kettlebell', 'mikrotraening_no_kettlebell'];
interface Avvik { program: string; dag: number; problem: string; }
(async () => {
	const avvik: Avvik[] = [];
	for (const pid of PROGRAMS) {
		const daysSnap = await db.collection(`forlob/${FORLOB}/mikrotraeningProgrammer/${pid}/days`).orderBy('dagNummer').get();
		if (daysSnap.size !== 21) avvik.push({ program: pid, dag: 0, problem: `Forventede 21 dage, fandt ${daysSnap.size}` });
		for (const d of daysSnap.docs) {
			const data = d.data();
			const dag = data.dagNummer ?? -1;
			const exs = data.exercises ?? [];
			if (exs.length !== 4) {
				avvik.push({ program: pid, dag, problem: `Forventede 4 øvelser, fandt ${exs.length}` });
				continue;
			}
			const hovedOvelser = exs.filter((e: { bonus?: boolean }) => !e.bonus);
			const bonusOvelser = exs.filter((e: { bonus?: boolean }) => e.bonus);
			if (hovedOvelser.length !== 3) avvik.push({ program: pid, dag, problem: `Forventede 3 hoved-øvelser, fandt ${hovedOvelser.length}` });
			if (bonusOvelser.length !== 1) avvik.push({ program: pid, dag, problem: `Forventede 1 bonus, fandt ${bonusOvelser.length}` });
			for (const e of exs) {
				const navn = e.exerciseId;
				if (e.sets !== 1) avvik.push({ program: pid, dag, problem: `${navn}: sets=${e.sets} (skal være 1)` });
				if (e.workSec !== 30) avvik.push({ program: pid, dag, problem: `${navn}: workSec=${e.workSec} (skal være 30)` });
				const forventetRest = e.bonus ? 0 : 15;
				if (e.restSec !== forventetRest) avvik.push({ program: pid, dag, problem: `${navn}: restSec=${e.restSec} (skal være ${forventetRest})` });
			}
			const bonus = bonusOvelser[0];
			if (bonus && bonus.exerciseId !== 'planke') avvik.push({ program: pid, dag, problem: `Bonus er '${bonus.exerciseId}' (skal være 'planke')` });
		}
	}
	console.log(`=== Verifikation af ${FORLOB} ===\n`);
	if (avvik.length === 0) {
		console.log('✅ ALT KORREKT.\n');
		console.log('Begge programmer (med + uden kettlebell) har:');
		console.log('- 21 dage');
		console.log('- 4 øvelser pr dag (3 hoved + 1 bonus)');
		console.log('- Alle øvelser: 1 sæt × 30s arbejde');
		console.log('- Hoved-øvelser: 15s pause efter');
		console.log('- Planken (bonus): 0s pause efter (sidste øvelse)');
	} else {
		console.log(`❌ ${avvik.length} afvigelser fundet:`);
		for (const a of avvik) console.log(`  ${a.program} dag ${a.dag}: ${a.problem}`);
	}
	process.exit(0);
})();
