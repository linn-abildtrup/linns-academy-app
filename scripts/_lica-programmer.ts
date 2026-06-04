// Liste over alle traeningsprogrammer Lica kan vaelge imellem:
// - mikrotraeningProgrammer fra hendes forloeb
// - hendes egne (byg-eget) programmer
// - abo-programmer hvis hun har det

import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const sa = JSON.parse(readFileSync(join(__dirname, 'service-account-key.json'), 'utf-8'));
initializeApp({ credential: cert(sa) });
const db = getFirestore();

const uid = 'uLd5uRubf8ajCOPV5buztB3DV123';

(async () => {
	const u = await db.doc(`users/${uid}`).get();
	const ud = u.data() ?? {};
	const forlobIds: string[] = ud.forlobIds ?? [];
	console.log(`Lica's forlob: ${JSON.stringify(forlobIds)}\n`);

	console.log('=== Mikrotraenings-programmer fra hendes forloeb ===');
	for (const fid of forlobIds) {
		const fdoc = await db.collection('forlob').doc(fid).get();
		const fd = fdoc.data();
		console.log(`\n  ${fid} (${fd?.navn ?? '?'})`);
		const progs = await db.collection(`forlob/${fid}/mikrotraeningProgrammer`).get();
		for (const p of progs.docs) {
			const pd = p.data();
			console.log(`    - ${p.id}: ${pd.navn ?? '?'} (${pd.antalDage ?? '?'} dage, niveau: ${pd.niveau ?? '?'})`);
		}
	}

	console.log('\n=== Hendes egne (byg-eget) programmer ===');
	const egne = await db.collection(`users/${uid}/mineProgrammer`).get();
	if (egne.empty) {
		console.log('  (ingen)');
	} else {
		for (const e of egne.docs) {
			const ed = e.data();
			console.log(`  - ${e.id}: ${ed.navn ?? '?'} (${ed.dage?.length ?? '?'} dage)`);
		}
	}

	console.log('\n=== Abo-programmer (basis-abo flow) ===');
	const aboProgs = await db.collection('aboMikrotraeningProgrammer').get();
	for (const a of aboProgs.docs) {
		const ad = a.data();
		console.log(`  - ${a.id}: ${ad.navn ?? '?'}`);
	}

	process.exit(0);
})();
