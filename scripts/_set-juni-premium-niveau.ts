// Saetter adgangsNiveau='premium' paa kickstart_juni_2026-forl0bet.
// Det betyder at nye kunder der CSV-importeres eller tilf0jes manuelt
// automatisk faar premium-felter sat via adgangsFelterForForlob.

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

async function main() {
	const ref = db.collection('forlob').doc('kickstart_juni_2026');
	const snap = await ref.get();
	if (!snap.exists) {
		console.error('Forl0b findes ikke.');
		process.exit(1);
	}
	const d = snap.data() ?? {};
	console.log(`Aktuelt adgangsNiveau: ${d.adgangsNiveau ?? '(ikke sat)'}`);

	if (apply) {
		await ref.update({ adgangsNiveau: 'premium' });
		console.log('✅ adgangsNiveau sat til premium.');
	} else {
		console.log('\nVil saette adgangsNiveau = premium');
		console.log('\n⚠️  DRY-RUN — koer med --apply.');
	}
}

main().then(() => process.exit(0));
