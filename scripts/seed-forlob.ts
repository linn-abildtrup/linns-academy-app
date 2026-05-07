// Seed-script til Kickstart-forløb og whitelist
// Opretter et eksempel-forløb (Kickstart maj 2026) og tilknytter test-brugerne
// Kører lokalt med admin-rettigheder via service-account-key.json
//
// Kør med: npm run seed:forlob
//
// Idempotent: kører du det igen, opdaterer det blot eksisterende dokumenter.

import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const serviceAccount = JSON.parse(
	readFileSync(join(__dirname, 'service-account-key.json'), 'utf-8')
);

initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore();

const MARIA_UID = 'NxqDU9r5VJhDSNP1PnFa5UimntC2';

const FORLOB_ID = 'kickstart_maj_2026';

// Eksempel-forløb: starter 4. maj 2026 (mandag), 21 dage
const FORLOB_DATA = {
	navn: 'Kickstart maj 2026',
	startDato: new Date('2026-05-04T06:00:00'),
	antalDage: 21,
	vaneProgramId: null,
	aktiv: true
};

// Test-brugere på whitelist. forlob@linnsacademy.dk er Maria
// (allerede oprettet som bruger), så hendes status sættes til registered.
const WHITELIST = [
	{
		email: 'forlob@linnsacademy.dk',
		firstName: 'Maria',
		lastName: 'Olsen',
		status: 'registered' as const
	}
];

async function seed() {
	console.log(`🌱 Seeder forløb '${FORLOB_ID}'...`);

	const forlobRef = db.collection('forlob').doc(FORLOB_ID);
	const findes = await forlobRef.get();
	if (findes.exists) {
		await forlobRef.set(FORLOB_DATA, { merge: true });
		console.log(`   ✓ Forløb opdateret`);
	} else {
		await forlobRef.set({
			...FORLOB_DATA,
			oprettet: FieldValue.serverTimestamp()
		});
		console.log(`   ✓ Forløb oprettet`);
	}

	console.log(`\n📋 Tilknytter ${WHITELIST.length} email(s) til whitelist...`);
	for (const entry of WHITELIST) {
		const ref = db.collection('allowedEmails').doc(entry.email.toLowerCase());
		const eks = await ref.get();
		const data: Record<string, unknown> = {
			email: entry.email.toLowerCase(),
			firstName: entry.firstName,
			lastName: entry.lastName,
			forlobId: FORLOB_ID,
			status: entry.status
		};
		if (entry.status === 'registered') {
			data.registreret = FieldValue.serverTimestamp();
		}
		if (!eks.exists) {
			data.oprettet = FieldValue.serverTimestamp();
		}
		await ref.set(data, { merge: true });
		console.log(`   ✓ ${entry.email} (${entry.status})`);
	}

	console.log(`\n🔗 Tilknytter Maria til forløb på userProduct...`);
	await db
		.collection('users')
		.doc(MARIA_UID)
		.collection('products')
		.doc('kickstart')
		.set({ forlobId: FORLOB_ID }, { merge: true });
	console.log(`   ✓ users/${MARIA_UID}/products/kickstart.forlobId = ${FORLOB_ID}`);

	console.log(`\n✅ Seed færdig.`);
}

seed().then(() => process.exit(0));
