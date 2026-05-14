// Omdøber alle lektioner med format="Skriftlig" til format="Inspiration"
// på Kickstart maj 2026-forløbet.
//
// Kør med:
//   npm run omdoeb:format-skriftlig            (skriver)
//   npm run omdoeb:format-skriftlig -- --dry   (preview)

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
const FRA = 'Skriftlig';
const TIL = 'Inspiration';
const dryRun = process.argv.includes('--dry');

interface LektionItem {
	id: string;
	titel: string;
	beskrivelse: string;
	varighedMin: number;
	format: string;
	url: string;
}

interface ForlobDag {
	dagNummer: number;
	uge: number;
	lektioner: LektionItem[];
	noteFraLinn: string;
}

async function main() {
	console.log(`${dryRun ? '[DRY] ' : ''}Omdøber format "${FRA}" → "${TIL}" på ${FORLOB_ID}\n`);

	const dageSnap = await db
		.collection('forlob')
		.doc(FORLOB_ID)
		.collection('forlobsdage')
		.get();

	let aendret = 0;
	let lektionerAendret = 0;

	for (const doc of dageSnap.docs) {
		const dag = doc.data() as ForlobDag;
		const opdaterede = dag.lektioner.map((l) =>
			l.format === FRA ? { ...l, format: TIL } : l
		);
		const harAendring = opdaterede.some((l, i) => l.format !== dag.lektioner[i].format);
		if (!harAendring) continue;

		const antal = opdaterede.filter((l) => l.format === TIL).length -
			dag.lektioner.filter((l) => l.format === TIL).length;
		console.log(`  ✓ ${doc.id} — ${antal} lektion${antal === 1 ? '' : 'er'} omdøbt`);
		aendret++;
		lektionerAendret += antal;

		if (!dryRun) {
			await doc.ref.update({ lektioner: opdaterede });
		}
	}

	console.log(`\n${dryRun ? '[DRY] ' : ''}Resultat:`);
	console.log(`  Forløbsdage ændret: ${aendret}`);
	console.log(`  Lektioner ændret:   ${lektionerAendret}`);
}

main().catch((e) => {
	console.error('Fejl:', e);
	process.exit(1);
});
