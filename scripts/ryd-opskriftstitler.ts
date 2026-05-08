// Fjerner tal-prefiks som '17. ' eller '5. ' fra opskrifttitler.
// Mønstret er en eller flere cifre fulgt af punktum og whitespace,
// efterfulgt af det rigtige titel-tekst. Andre tal (fx '5 minutters
// salat') røres ikke.
//
// Kør med:
//   npm run ryd:titler              (skriver til Firestore)
//   npm run ryd:titler -- --dry     (preview uden at skrive)

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
const PREFIX = /^\d+\.\s*/;

async function main() {
	const snap = await db.collection('opskrifter').get();
	const aendringer: { id: string; gammel: string; ny: string }[] = [];

	for (const d of snap.docs) {
		const data = d.data() as { titel?: string };
		const gammel = data.titel ?? '';
		if (!PREFIX.test(gammel)) continue;
		const ny = gammel.replace(PREFIX, '').trim();
		if (!ny || ny === gammel) continue;
		aendringer.push({ id: d.id, gammel, ny });
	}

	console.log(`📋 ${snap.size} opskrifter — ${aendringer.length} har tal-prefiks${dryRun ? ' (DRY-RUN)' : ''}`);
	for (const a of aendringer) {
		console.log(`   "${a.gammel}"  →  "${a.ny}"`);
	}

	if (aendringer.length === 0) {
		console.log('   (intet at rydde op)');
		process.exit(0);
	}

	if (dryRun) {
		console.log('\n   Kør uden --dry for at opdatere titler.');
		process.exit(0);
	}

	const batchSize = 400;
	for (let start = 0; start < aendringer.length; start += batchSize) {
		const batch = db.batch();
		for (const a of aendringer.slice(start, start + batchSize)) {
			batch.update(db.collection('opskrifter').doc(a.id), { titel: a.ny });
		}
		await batch.commit();
	}
	console.log(`\n✅ Opdaterede ${aendringer.length} titler.`);
}

main().then(() => process.exit(0));
