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
	console.log(`  navn: ${fd.navn}`);
	console.log(`  type: ${fd.type}`);
	console.log(`  startDato: ${fd.startDato?.toDate?.()?.toISOString?.()?.slice(0, 10)}`);
	console.log(`  antalDage: ${fd.antalDage}`);
	console.log(`  vaneProgramId: ${fd.vaneProgramId}`);
	console.log(`  aktiv: ${fd.aktiv}`);
	console.log(`  adgangsNiveau: ${fd.adgangsNiveau ?? '(ikke sat)'}`);

	const dage = await db.collection('forlob/kickstart_juni_2026/forlobsdage').get();
	console.log(`\nforlobsdage: ${dage.size}`);
	let medLektioner = 0;
	for (const d of dage.docs) {
		const data = d.data();
		const tael = (data.lektioner ?? []).length;
		if (tael > 0) {
			medLektioner++;
			console.log(
				`  dag ${data.dagNummer}: ${tael} lektion${tael === 1 ? '' : 'er'}: ${data.lektioner
					.map((l: { titel?: string }) => l.titel)
					.join(' | ')}`
			);
		}
	}
	console.log(`\nDage med lektioner: ${medLektioner} af ${dage.size}`);

	// Sammenligning med maj-forl0bet
	const dageMaj = await db.collection('forlob/kickstart_maj_2026/forlobsdage').get();
	let medLektionerMaj = 0;
	for (const d of dageMaj.docs) {
		if ((d.data().lektioner ?? []).length > 0) medLektionerMaj++;
	}
	console.log(`\nTil sammenligning: kickstart_maj_2026 har ${medLektionerMaj} dage med lektioner`);
	process.exit(0);
})();
