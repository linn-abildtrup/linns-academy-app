// Heidi (heidigabrielleh@gmail.com) blev tilfoejet til Kropsro uden den
// fulde konfiguration. Hun har Kickstart-felter paa sin userDoc + tom
// allowedEmail. Fix: opdater allowedEmail + userDoc med Kropsro-konfiguration
// (samme felter som de andre 22 Kropsro-kunder).

import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const sa = JSON.parse(readFileSync(join(__dirname, 'service-account-key.json'), 'utf-8'));
initializeApp({ credential: cert(sa) });
const db = getFirestore();

const EMAIL = 'heidigabrielleh@gmail.com';
const FORLOB_ID = 'kropsro_maj_2026';
const MS_PER_DAG = 86_400_000;

async function main() {
	console.log(`Fixer ${EMAIL}...\n`);

	const fSnap = await db.collection('forlob').doc(FORLOB_ID).get();
	const f = fSnap.data() ?? {};
	const startMs = f.startDato?.toMillis?.();
	const antalDage = f.antalDage;
	if (!startMs || !antalDage) {
		console.error('Forl0b-doc mangler startDato eller antalDage');
		process.exit(1);
	}
	const forlobSlutMs = startMs + antalDage * MS_PER_DAG;
	const bonusSlutMs = forlobSlutMs + 90 * MS_PER_DAG;
	const nu = Date.now();

	console.log(`  Forventet slutdato: ${new Date(forlobSlutMs).toISOString().slice(0, 10)}`);
	console.log(`  Bonus slutdato:     ${new Date(bonusSlutMs).toISOString().slice(0, 10)}\n`);

	// 1) allowedEmails — tilfoej manglende felter
	const allowedRef = db.collection('allowedEmails').doc(EMAIL);
	await allowedRef.update({
		activeProduct: 'premiumforløb',
		accessLevel: 'premium',
		accessSource: 'forløb',
		activeSubscription: false,
		updatedAt: nu
	});
	console.log('OK   allowedEmails opdateret');

	// 2) userDoc — opdater felter til Kropsro-state
	const uSnap = await db.collection('users').where('email', '==', EMAIL).limit(1).get();
	if (uSnap.empty) {
		console.log('OK   userDoc findes ikke endnu (registreres ved login)');
		return;
	}
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
	console.log(`OK   userDoc opdateret (${uDoc.id})`);

	console.log('\nHeidi vil nu se Kropsro-forsiden korrekt ved naeste login/refresh.');
	console.log('Hun ser onboarding-modal naar hun aabner mikrotraening og vaelger med/uden kettlebells.');
}
main().then(() => process.exit(0));
