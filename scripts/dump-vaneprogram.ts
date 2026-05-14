// Dumper Kickstart maj 2026's vaneprogram fra forløb/kickstart_maj_2026/vaneprogram
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

const snap = await db.collection('forlob').doc(FORLOB_ID).collection('vaneprogram').get();
console.log(`${snap.size} vaneprogram-dage for ${FORLOB_ID}:\n`);
const dage = snap.docs
	.map((d) => d.data() as Record<string, unknown>)
	.sort((a, b) => (a.dagNummer as number) - (b.dagNummer as number));
for (const dag of dage) {
	const checks = (dag.checks as { label: string }[]) || [];
	const bonus = dag.bonus as { label: string } | null;
	console.log(
		`Dag ${dag.dagNummer} (uge ${dag.uge})${dag.isCheckin ? ' [check-in]' : ''}${dag.isBaseline ? ' [baseline]' : ''}${dag.isWin ? ' [#win]' : ''}`
	);
	console.log(`  Refleksion: ${dag.reflection}`);
	console.log(`  Vaner: ${checks.map((c) => c.label).join(', ') || '(ingen)'}`);
	if (bonus) console.log(`  Bonus: ${bonus.label}`);
	console.log('');
}
