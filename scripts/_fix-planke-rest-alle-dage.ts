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
	let aendringer = 0;
	for (const pid of ['mikrotraening_kettlebell', 'mikrotraening_no_kettlebell']) {
		const days = await db.collection(`forlob/kickstart_juni_2026/mikrotraeningProgrammer/${pid}/days`).get();
		for (const d of days.docs) {
			const data = d.data();
			const exs = (data?.exercises ?? []) as { exerciseId: string; restSec: number; sets: number; workSec: number; bonus: boolean }[];
			let aendret = false;
			const opdateret = exs.map((e) => {
				if (e.exerciseId === 'planke' && e.bonus && e.restSec !== 0) {
					aendret = true;
					return { ...e, restSec: 0 };
				}
				return e;
			});
			if (aendret) {
				aendringer++;
				console.log(`${pid} ${d.id}: planke restSec 15 -> 0`);
				if (apply) await d.ref.update({ exercises: opdateret });
			}
		}
	}
	console.log(`\n${apply ? 'Opdateret' : 'Ville opdatere'} ${aendringer} dage`);
	if (!apply) console.log('Koer med --apply');
	process.exit(0);
})();
