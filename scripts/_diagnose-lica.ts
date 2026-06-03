// Diagnose: hvad ser lica.andersen@gmail.com paa traening?
// Hun siger hun har lavet de samme oevelser i et par dage.

import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const sa = JSON.parse(readFileSync(join(__dirname, 'service-account-key.json'), 'utf-8'));
initializeApp({ credential: cert(sa) });
const db = getFirestore();

const EMAIL = 'lica.andersen@gmail.com';

(async () => {
	const userQ = await db.collection('users').where('email', '==', EMAIL).get();
	if (userQ.empty) {
		console.log(`Ingen bruger med email ${EMAIL}`);
		process.exit(1);
	}
	const userDoc = userQ.docs[0];
	const uid = userDoc.id;
	const ud = userDoc.data();
	console.log(`=== Bruger ${EMAIL} (uid: ${uid}) ===`);
	console.log(`state: ${ud.state}`);
	console.log(`accessLevel: ${ud.accessLevel ?? '(ikke sat)'}`);
	console.log(`activeProduct: ${ud.activeProduct ?? '(ikke sat)'}`);
	console.log(`forlobIds: ${JSON.stringify(ud.forlobIds ?? [])}`);
	console.log(`mikrotraeningVariant: ${ud.mikrotraeningVariant ?? '(ikke sat)'}`);
	console.log(`aktivtTraeningsprogram: ${JSON.stringify(ud.aktivtTraeningsprogram ?? null)}`);

	for (const fid of ud.forlobIds ?? []) {
		const f = await db.collection('forlob').doc(fid).get();
		const fd = f.data();
		console.log(`\nforlob ${fid}: type=${fd?.type}, adgangsNiveau=${fd?.adgangsNiveau ?? '(ikke sat)'}, startDato=${fd?.startDato?.toDate?.().toISOString().slice(0,10)}`);
	}

	const products = await db.collection(`users/${uid}/products`).get();
	console.log(`\n=== products-doks (${products.size}) ===`);
	for (const p of products.docs) {
		const pd = p.data();
		console.log(`\n--- products/${p.id} ---`);
		console.log(`  programValg: ${JSON.stringify(pd.programValg ?? {})}`);
		const fremgang = pd.fremgang?.mikrotraening;
		if (fremgang) {
			console.log(`  fremgang.mikrotraening.gennemforte: ${JSON.stringify(fremgang.gennemforte ?? [])}`);
		} else {
			console.log(`  fremgang.mikrotraening: (ikke sat)`);
		}
		console.log(`  nulDage: ${JSON.stringify(pd.nulDage ?? null)}`);
	}

	// Historik
	const historik = await db.collection(`users/${uid}/traeningHistorik`).orderBy('gennemfoertAt', 'desc').limit(20).get();
	console.log(`\n=== traeningHistorik (seneste ${historik.size}) ===`);
	for (const h of historik.docs) {
		const hd = h.data();
		const tid = new Date(hd.gennemfoertAt).toLocaleString('da-DK');
		console.log(`  ${hd.dato} | ${hd.kilde} | programId=${hd.programId ?? '-'} | ${hd.programNavn ?? '?'} | ${tid}`);
	}
	process.exit(0);
})();
