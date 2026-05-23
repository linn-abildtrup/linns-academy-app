// Dumper Kickstart maj 2026's træningsprogrammer
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

const progs = await db
	.collection('forlob')
	.doc(FORLOB_ID)
	.collection('mikrotraeningProgrammer')
	.get();

console.log(`${progs.size} træningsprogram(mer) for ${FORLOB_ID}:\n`);

for (const p of progs.docs) {
	const data = p.data() as { navn?: string; beskrivelse?: string; aktiv?: boolean };
	console.log(`\n=== ${p.id}: "${data.navn}" ${data.aktiv ? '(aktiv)' : '(inaktiv)'} ===`);
	if (data.beskrivelse) console.log(`Beskrivelse: ${data.beskrivelse}`);

	const dage = await p.ref.collection('dage').get();
	const sorteret = dage.docs
		.map((d) => d.data() as Record<string, unknown>)
		.sort((a, b) => (a.dagNummer as number) - (b.dagNummer as number));

	console.log(`${sorteret.length} dage:\n`);
	for (const dag of sorteret) {
		const ex = (dag.exercises as { exerciseId: string; sets?: number; workSec?: number; restSec?: number; bonus?: boolean }[]) || [];
		console.log(`  Dag ${dag.dagNummer}: ${ex.length} øvelser`);
		for (const e of ex) {
			const bonus = e.bonus ? ' [BONUS]' : '';
			console.log(`    · ${e.exerciseId}${bonus} (${e.sets ?? '?'}×${e.workSec ?? '?'}s/${e.restSec ?? '?'}s)`);
		}
	}
}
