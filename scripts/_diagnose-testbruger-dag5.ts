import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
const __dirname = dirname(fileURLToPath(import.meta.url));
const sa = JSON.parse(readFileSync(join(__dirname, 'service-account-key.json'), 'utf-8'));
initializeApp({ credential: cert(sa) });
const db = getFirestore();
(async () => {
	const userQ = await db.collection('users').where('email', '==', 'kickstart-01-06-2026@linnsacademy.dk').get();
	const u = userQ.docs[0];
	const ud = u.data();
	console.log(`=== Testbruger ===`);
	console.log(`  variant: ${ud.mikrotraeningVariant}`);
	console.log(`  aktivtTraeningsprogram: ${JSON.stringify(ud.aktivtTraeningsprogram)}`);
	const premium = await db.doc(`users/${u.id}/products/premiumforløb`).get();
	console.log(`  products/premiumforløb.programValg: ${JSON.stringify(premium.data()?.programValg ?? {})}`);

	// Tjek dag 5 paa BEGGE mikrotraening-programmer
	for (const pid of ['mikrotraening_kettlebell', 'mikrotraening_no_kettlebell']) {
		console.log(`\n=== ${pid} / dag5 ===`);
		const dag = await db.doc(`forlob/kickstart_juni_2026/mikrotraeningProgrammer/${pid}/days/dag5`).get();
		if (!dag.exists) { console.log('  (findes ikke)'); continue; }
		const d = dag.data();
		console.log(`  dagNummer: ${d?.dagNummer}, titel: ${d?.titel ?? '(uden)'}`);
		const exs = d?.exercises ?? [];
		console.log(`  exercises (${exs.length}):`);
		for (const e of exs) {
			console.log(`    ${e.exerciseId} sets=${e.sets} work=${e.workSec}s rest=${e.restSec}s bonus=${e.bonus}`);
		}
	}

	// Tjek ogsaa lektioner paa dag 5
	console.log(`\n=== forlobsdage/5 (lektioner) ===`);
	const dag5 = await db.doc(`forlob/kickstart_juni_2026/forlobsdage/5`).get();
	if (dag5.exists) {
		const d = dag5.data();
		console.log(`  uge: ${d?.uge}`);
		console.log(`  lektioner: ${(d?.lektioner ?? []).length}`);
		for (const l of d?.lektioner ?? []) {
			console.log(`    - ${l.titel} (id=${l.id})`);
		}
		console.log(`  noteFraLinn: ${d?.noteFraLinn ? '(har note)' : '(ingen)'}`);
	} else {
		console.log('  (findes ikke)');
	}
	process.exit(0);
})();
