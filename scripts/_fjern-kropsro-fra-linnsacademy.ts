// Fjerner kropsro_maj_2026 fra linnsacademy@gmail.com.forlobIds.
//
// Effekt: hun beholder sin AKTIVE Kropsro-tilmelding (accessSource:
// forløb, activeProduct: premiumforløb) men optræder ikke som
// "gennemført Kropsro" i biblioteket. Kickstart maj 2026 forbliver i
// forlobIds som gennemført forløb.
//
// Brug:
//   npx tsx scripts/_fjern-kropsro-fra-linnsacademy.ts          # dry-run
//   npx tsx scripts/_fjern-kropsro-fra-linnsacademy.ts --apply

import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const sa = JSON.parse(readFileSync(join(__dirname, 'service-account-key.json'), 'utf-8'));
initializeApp({ credential: cert(sa) });
const db = getFirestore();

const EMAIL = 'linnsacademy@gmail.com';
const FJERN_FORLOB_ID = 'kropsro_maj_2026';
const APPLY = process.argv.includes('--apply');

async function main() {
	console.log(APPLY ? '=== APPLY ===\n' : '=== DRY-RUN ===\n');

	const snap = await db.collection('users').where('email', '==', EMAIL).limit(1).get();
	if (snap.empty) {
		console.error(`Ingen userDoc med email ${EMAIL}`);
		process.exit(1);
	}
	const userRef = snap.docs[0].ref;
	const data = snap.docs[0].data();
	const nuvaerende: string[] = data.forlobIds ?? [];

	console.log(`uid: ${snap.docs[0].id}`);
	console.log(`nuværende forlobIds: ${JSON.stringify(nuvaerende)}`);
	console.log(`fjerner: ${FJERN_FORLOB_ID}`);

	if (!nuvaerende.includes(FJERN_FORLOB_ID)) {
		console.log(`\n${FJERN_FORLOB_ID} er ikke i forlobIds — intet at gøre.`);
		return;
	}

	if (!APPLY) {
		console.log(`\nVil sætte forlobIds = ${JSON.stringify(nuvaerende.filter((x) => x !== FJERN_FORLOB_ID))}`);
		console.log(`(dry-run — kør med --apply for at skrive)`);
		return;
	}

	await userRef.update({
		forlobIds: FieldValue.arrayRemove(FJERN_FORLOB_ID),
		updatedAt: Date.now()
	});
	console.log(`\n✅ Fjernet.`);
}

main().then(() => process.exit(0));
