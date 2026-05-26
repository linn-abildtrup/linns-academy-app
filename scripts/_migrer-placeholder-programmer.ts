// Migrerer alle Kropsro-kunders programValg fra de gamle placeholder-
// programmer (test_1, kropsro_uden_kettlebells) til de nye 84-dages
// programmer (kropsro_84_med_kb, kropsro_84_uden_kb).
// Opdaterer baade users/{uid}/products/premiumforloeb.programValg og
// users/{uid}.aktivtTraeningsprogram hvis det peger paa et gammelt.
// Til sidst: saet aktiv=false paa de gamle placeholder-programmer.

import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const sa = JSON.parse(readFileSync(join(__dirname, 'service-account-key.json'), 'utf-8'));
initializeApp({ credential: cert(sa) });
const db = getFirestore();

const FORLOB_ID = 'kropsro_maj_2026';

// Mapping fra gammelt program-id til nyt
const MIGRATION: Record<string, string> = {
	test_1: 'kropsro_84_med_kb',
	kropsro_uden_kettlebells: 'kropsro_84_uden_kb'
};

async function main() {
	const uSnap = await db.collection('users')
		.where('forlobIds', 'array-contains', FORLOB_ID)
		.get();
	console.log(`${uSnap.size} Kropsro-userDocs fundet\n`);

	let opdaterede = 0;
	let sprungetOver = 0;

	for (const uDoc of uSnap.docs) {
		const u = uDoc.data();
		const email = u.email ?? '(ingen email)';
		const opdateringer: Record<string, unknown> = {};

		// 1) aktivtTraeningsprogram paa userDoc
		const aktivt = u.aktivtTraeningsprogram;
		if (aktivt?.kilde === 'tildelt' && aktivt.programId && MIGRATION[aktivt.programId]) {
			const nyt = MIGRATION[aktivt.programId];
			opdateringer.aktivtTraeningsprogram = {
				...aktivt,
				programId: nyt
			};
		}

		if (Object.keys(opdateringer).length > 0) {
			await uDoc.ref.update(opdateringer);
		}

		// 2) programValg paa userProduct
		const pRef = uDoc.ref.collection('products').doc('premiumforløb');
		const pSnap = await pRef.get();
		let upOpdateret = false;
		if (pSnap.exists) {
			const p = pSnap.data() ?? {};
			const valgt = p.programValg?.mikrotraening;
			if (valgt && MIGRATION[valgt]) {
				const nyt = MIGRATION[valgt];
				await pRef.update({
					'programValg.mikrotraening': nyt
				});
				upOpdateret = true;
			}
		}

		if (Object.keys(opdateringer).length > 0 || upOpdateret) {
			console.log(`OK    ${email}`);
			if (opdateringer.aktivtTraeningsprogram) {
				const fra = aktivt?.programId;
				const til = (opdateringer.aktivtTraeningsprogram as { programId: string }).programId;
				console.log(`        userDoc.aktivtTraeningsprogram: ${fra} -> ${til}`);
			}
			if (upOpdateret) {
				console.log(`        userProduct.programValg.mikrotraening migreret`);
			}
			opdaterede++;
		} else {
			sprungetOver++;
		}
	}

	console.log(`\nUserDocs/userProducts opdateret: ${opdaterede}`);
	console.log(`Sprunget over (intet at migrere): ${sprungetOver}`);

	// 3) Deaktiver de gamle placeholder-programmer
	console.log('\nDeaktiverer gamle placeholder-programmer...');
	for (const gammel of Object.keys(MIGRATION)) {
		const ref = db.collection('forlob').doc(FORLOB_ID).collection('mikrotraeningProgrammer').doc(gammel);
		const s = await ref.get();
		if (s.exists) {
			await ref.update({ aktiv: false });
			console.log(`  ${gammel}: aktiv=false`);
		}
	}
}
main().then(() => process.exit(0));
