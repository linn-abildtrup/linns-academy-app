// Markerer premium_app@linnsacademy.dk som havende gennemført
// Kickstart maj 2026 — tilføjer forløb-id til userDoc.forlobIds.
//
// Effekt:
//   - Biblioteket viser nu Kickstart-materiale (FAQ, lektioner, øvelser,
//     opskrifter) for brugeren
//   - Moduler-siden viser 'Du har gennemført Kickstart — næste skridt Kropsro'
//   - 'Tidligere forløb'-sektion på forsiden viser Kickstart maj 2026
//
// Brug:
//   npx tsx scripts/_giv-premium-app-kickstart-historik.ts          # dry-run
//   npx tsx scripts/_giv-premium-app-kickstart-historik.ts --apply

import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const sa = JSON.parse(readFileSync(join(__dirname, 'service-account-key.json'), 'utf-8'));
initializeApp({ credential: cert(sa) });
const db = getFirestore();

const EMAIL = process.argv.find((a) => a.includes('@')) ?? 'premium_app@linnsacademy.dk';
const FORLOB_ID = 'kickstart_maj_2026';
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
	console.log(`tilføjer: ${FORLOB_ID}`);

	if (nuvaerende.includes(FORLOB_ID)) {
		console.log(`\n${FORLOB_ID} er allerede i forlobIds — intet at gøre.`);
		return;
	}

	if (!APPLY) {
		console.log(`\n(dry-run — kør med --apply for at skrive)`);
		return;
	}

	await userRef.update({
		forlobIds: FieldValue.arrayUnion(FORLOB_ID),
		updatedAt: Date.now()
	});
	console.log(`\n✅ Tilføjet.`);
}

main().then(() => process.exit(0));
