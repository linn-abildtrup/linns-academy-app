// Fix how-steps paa bent_over_row. De var fejlagtigt kopieret fra
// single-arm row (h0jre haand holder vaegt, venstre haand paa laar, skift
// side). Videoen viser i virkeligheden bilateral roning med EN kettlebell
// holdt med begge haender. Rettes til at beskrive det videoen viser.

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

const NYE_HOW = [
	'Stå med fødderne i hoftebredde, knæ let bøjede',
	'Hold kettlebellen foran dig med begge hænder om håndtaget, armene strakte',
	'Bøj fremover i hoften, ryggen lang og parallel med gulvet',
	'Træk kettlebellen op mod maven, albuerne tæt på kroppen',
	'Knib skulderbladene sammen i toppen',
	'Sænk kontrolleret ned og gentag gennem hele intervallet'
];

(async () => {
	const ref = db.collection('exercises').doc('bent_over_row');
	const snap = await ref.get();
	const data = snap.data() ?? {};
	console.log(`Mode: ${apply ? 'APPLY' : 'DRY-RUN'}\n`);
	console.log('Foer:');
	for (const s of data.how ?? []) console.log(`  - ${s}`);
	console.log('\nEfter:');
	for (const s of NYE_HOW) console.log(`  - ${s}`);
	if (apply) {
		await ref.update({ how: NYE_HOW });
		console.log('\nOpdateret.');
	} else {
		console.log('\nKoer med --apply for at gemme.');
	}
	process.exit(0);
})();
