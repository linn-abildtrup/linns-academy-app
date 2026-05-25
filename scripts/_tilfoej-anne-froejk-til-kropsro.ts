// Tilfojer Anne Froejk (frojk@bbsyd.dk) til Kropsro med samme felter som
// de andre 22 patched Kropsro-kunder. Hvis hun allerede har en userDoc
// (registreret), opdateres den ogsaa.
//
// Brug: npx tsx scripts/_tilfoej-anne-froejk-til-kropsro.ts

import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const sa = JSON.parse(readFileSync(join(__dirname, 'service-account-key.json'), 'utf-8'));
initializeApp({ credential: cert(sa) });
const db = getFirestore();

const EMAIL = 'frojk@bbsyd.dk';
const FORLOB_ID = 'kropsro_maj_2026';
const MS_PER_DAG = 86_400_000;

async function main() {
	console.log(`Tilfojer ${EMAIL} til ${FORLOB_ID}...\n`);

	// 1) Beregn slutdato og bonus-slutdato fra forloeb-doc
	const fSnap = await db.collection('forlob').doc(FORLOB_ID).get();
	if (!fSnap.exists) {
		console.error(`Forloeb ${FORLOB_ID} findes ikke.`);
		process.exit(1);
	}
	const f = fSnap.data() ?? {};
	const startMs = f.startDato?.toMillis?.();
	const antalDage = f.antalDage;
	if (!startMs || !antalDage) {
		console.error('forlob-doc mangler startDato eller antalDage.');
		process.exit(1);
	}
	const forlobSlutMs = startMs + antalDage * MS_PER_DAG;
	const bonusSlutMs = forlobSlutMs + 90 * MS_PER_DAG;
	const nu = Date.now();

	console.log(`  forloebet starter:   ${new Date(startMs).toISOString().slice(0, 10)}`);
	console.log(`  forlobSlutMs:        ${new Date(forlobSlutMs).toISOString().slice(0, 10)}`);
	console.log(`  bonusSlutMs (+90d):  ${new Date(bonusSlutMs).toISOString().slice(0, 10)}\n`);

	// 2) Tilfoj/opdater allowedEmails
	const allowedRef = db.collection('allowedEmails').doc(EMAIL);
	const allowedSnap = await allowedRef.get();
	const allowedData = {
		email: EMAIL,
		forlobId: FORLOB_ID,
		activeProduct: 'premiumforløb',
		accessLevel: 'premium',
		accessSource: 'forløb',
		activeSubscription: false,
		updatedAt: nu
	};
	if (allowedSnap.exists) {
		await allowedRef.update(allowedData);
		console.log(`OK   allowedEmails opdateret (eksisterede allerede)`);
	} else {
		await allowedRef.set({
			...allowedData,
			status: 'invited',
			oprettetAt: nu
		});
		console.log(`OK   allowedEmails oprettet`);
	}

	// 3) Tjek om hun allerede har en userDoc og opdater den
	const uSnap = await db.collection('users').where('email', '==', EMAIL).limit(1).get();
	if (uSnap.empty) {
		console.log(`OK   userDoc findes ikke endnu — opdateres naar hun registrerer sig`);
	} else {
		const uDoc = uSnap.docs[0];
		await uDoc.ref.update({
			activeProduct: 'premiumforløb',
			accessLevel: 'premium',
			accessSource: 'forløb',
			activeSubscription: false,
			forlobIds: FieldValue.arrayUnion(FORLOB_ID),
			expiresAt: forlobSlutMs,
			bonusPeriodEndsAt: bonusSlutMs
		});
		// Marker allowedEmail som registreret nu hvor hun ER registreret
		await allowedRef.update({ status: 'registered' });
		console.log(`OK   userDoc opdateret (${uDoc.id})`);
	}

	console.log(`\nFaerdig. Anne Froejk har samme Kropsro-setup som de andre 22.`);
}
main().then(() => process.exit(0));
