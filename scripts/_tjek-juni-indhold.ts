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
	const f = await db.collection('forlob').doc('kickstart_juni_2026').get();
	const fd = f.data() ?? {};
	console.log('=== kickstart_juni_2026 ===');
	console.log(`  vaneProgramId: ${fd.vaneProgramId ?? '(ikke sat)'}`);

	// Vaneprogram-dage
	const vp = await db.collection('forlob/kickstart_juni_2026/vaneprogram').get();
	console.log(`\nvaneprogram-dage: ${vp.size}`);
	if (vp.size > 0) {
		for (const d of vp.docs.slice(0, 5)) {
			const data = d.data();
			console.log(
				`  ${d.id}: dag=${data.dagNummer}, reflection=${data.reflection ? '"' + data.reflection.slice(0, 60) + '..."' : '(tom)'}`
			);
		}
		if (vp.size > 5) console.log(`  ... og ${vp.size - 5} flere`);
	}

	// Mikrotraeningsprogrammer
	const mt = await db.collection('forlob/kickstart_juni_2026/mikrotraeningProgrammer').get();
	console.log(`\nmikrotraeningProgrammer: ${mt.size}`);
	for (const m of mt.docs) {
		const md = m.data();
		console.log(`  ${m.id}: ${md.navn ?? '(uden navn)'} (variant: ${md.variant ?? '?'})`);
	}

	// Forlobsdage (lektioner)
	const dage = await db.collection('forlob/kickstart_juni_2026/forlobsdage').get();
	let medLektioner = 0;
	for (const d of dage.docs) {
		const data = d.data();
		if ((data.lektioner ?? []).length > 0) medLektioner++;
	}
	console.log(`\nforlobsdage med lektioner: ${medLektioner} af ${dage.size}`);

	// Sammenligning maj
	console.log('\n--- Til sammenligning kickstart_maj_2026 ---');
	const fMaj = await db.collection('forlob').doc('kickstart_maj_2026').get();
	const fmd = fMaj.data() ?? {};
	console.log(`  vaneProgramId: ${fmd.vaneProgramId ?? '(ikke sat)'}`);
	const vpMaj = await db.collection('forlob/kickstart_maj_2026/vaneprogram').get();
	console.log(`  vaneprogram-dage: ${vpMaj.size}`);
	const mtMaj = await db.collection('forlob/kickstart_maj_2026/mikrotraeningProgrammer').get();
	console.log(`  mikrotraeningProgrammer: ${mtMaj.size}`);
	process.exit(0);
})();
