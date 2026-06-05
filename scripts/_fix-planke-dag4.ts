import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
const __dirname = dirname(fileURLToPath(import.meta.url));
const sa = JSON.parse(readFileSync(join(__dirname, 'service-account-key.json'), 'utf-8'));
initializeApp({ credential: cert(sa) });
const db = getFirestore();
const apply = process.argv.includes('--apply');
(async () => {
	for (const pid of ['mikrotraening_kettlebell', 'mikrotraening_no_kettlebell']) {
		const ref = db.doc(`forlob/kickstart_juni_2026/mikrotraeningProgrammer/${pid}/days/dag4`);
		const snap = await ref.get();
		const data = snap.data();
		const exs = (data?.exercises ?? []) as { exerciseId: string; restSec: number; sets: number; workSec: number; bonus: boolean }[];
		const opdateret = exs.map((e) => e.exerciseId === 'planke' ? { ...e, restSec: 15 } : e);
		console.log(`${pid} dag4:`);
		for (const e of opdateret) console.log(`  ${e.exerciseId}: rest=${e.restSec}s bonus=${e.bonus}`);
		if (apply) {
			await ref.update({ exercises: opdateret });
			console.log('  ✓ opdateret');
		}
	}
	if (!apply) console.log('\nKoer med --apply');
	process.exit(0);
})();
