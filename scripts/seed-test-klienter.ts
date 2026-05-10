// Seed: 4 test-klienter, en for hver klient-type.
// Opretter Firebase Auth-brugere + userDoc + nødvendige sub-dokumenter.
//
// Klienter (alle med password 'test1234'):
//   - basis_app@linnsacademy.dk      (modulbruger, basis-abo)
//   - premium_app@linnsacademy.dk    (modulbruger, premium-abo)
//   - kickstart@linnsacademy.dk      (forløbskunde, Kickstart maj 2026)
//   - premium_forlob@linnsacademy.dk (forløbskunde, premium-forløb)
//
// Idempotent: hvis brugeren allerede findes, opdateres password + userDoc-felter.
//
// Kør:
//   npx tsx scripts/seed-test-klienter.ts            # dry-run
//   npx tsx scripts/seed-test-klienter.ts --skriv    # opret rigtigt

import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const sa = JSON.parse(readFileSync(join(__dirname, 'service-account-key.json'), 'utf-8'));
initializeApp({ credential: cert(sa) });
const db = getFirestore();
const auth = getAuth();

const skriv = process.argv.includes('--skriv');
const PASSWORD = 'test1234';

const KICKSTART_FORLOB_ID = 'kickstart_maj_2026';
const PREMIUM_FORLOB_ID = 'premium_forlob_test';

interface TestKlient {
	email: string;
	firstName: string;
	lastName: string;
	accessLevel: 'basis' | 'premium';
	accessSource: 'abonnement' | 'forløb';
	activeProduct: 'basisabo' | 'premiumabo' | 'kickstart' | 'premiumforløb';
	state: 'modulbruger' | 'forlobskunde';
	forlobId?: string;
}

const KLIENTER: TestKlient[] = [
	{
		email: 'basis_app@linnsacademy.dk',
		firstName: 'BasisApp',
		lastName: 'Test',
		accessLevel: 'basis',
		accessSource: 'abonnement',
		activeProduct: 'basisabo',
		state: 'modulbruger'
	},
	{
		email: 'premium_app@linnsacademy.dk',
		firstName: 'PremiumApp',
		lastName: 'Test',
		accessLevel: 'premium',
		accessSource: 'abonnement',
		activeProduct: 'premiumabo',
		state: 'modulbruger'
	},
	{
		email: 'kickstart@linnsacademy.dk',
		firstName: 'Kickstart',
		lastName: 'Test',
		accessLevel: 'basis',
		accessSource: 'forløb',
		activeProduct: 'kickstart',
		state: 'forlobskunde',
		forlobId: KICKSTART_FORLOB_ID
	},
	{
		email: 'premium_forlob@linnsacademy.dk',
		firstName: 'PremiumForlob',
		lastName: 'Test',
		accessLevel: 'premium',
		accessSource: 'forløb',
		activeProduct: 'premiumforløb',
		state: 'forlobskunde',
		forlobId: PREMIUM_FORLOB_ID
	}
];

async function ensurePremiumForlob() {
	const ref = db.collection('forlob').doc(PREMIUM_FORLOB_ID);
	const eks = await ref.get();
	if (eks.exists) {
		console.log(`  Premium-forløb '${PREMIUM_FORLOB_ID}' findes allerede`);
		return;
	}
	console.log(`  Opretter test-premium-forløb '${PREMIUM_FORLOB_ID}'`);
	if (skriv) {
		await ref.set({
			navn: 'Premium-forløb (test)',
			startDato: new Date('2026-05-01T06:00:00'),
			antalDage: 21,
			vaneProgramId: null,
			aktiv: true,
			oprettet: FieldValue.serverTimestamp()
		});
	}
}

async function ensureUser(klient: TestKlient): Promise<string> {
	let uid: string;
	try {
		const eks = await auth.getUserByEmail(klient.email);
		uid = eks.uid;
		console.log(`  ${klient.email}: bruger eksisterer (${uid}) — opdaterer password`);
		if (skriv) {
			await auth.updateUser(uid, {
				password: PASSWORD,
				displayName: klient.firstName,
				emailVerified: true
			});
		}
	} catch (err) {
		const code = (err as { code?: string }).code;
		if (code !== 'auth/user-not-found') throw err;
		console.log(`  ${klient.email}: opretter ny bruger`);
		if (skriv) {
			const ny = await auth.createUser({
				email: klient.email,
				password: PASSWORD,
				displayName: klient.firstName,
				emailVerified: true
			});
			uid = ny.uid;
		} else {
			uid = '<dry-run-uid>';
		}
	}
	return uid;
}

async function ensureUserDoc(klient: TestKlient, uid: string) {
	const ref = db.collection('users').doc(uid);
	const data: Record<string, unknown> = {
		firstName: klient.firstName,
		email: klient.email,
		state: klient.state,
		accessLevel: klient.accessLevel,
		accessSource: klient.accessSource,
		activeProduct: klient.activeProduct,
		activeSubscription: klient.accessSource === 'abonnement',
		updatedAt: Date.now()
	};
	if (klient.forlobId) {
		data.forlobIds = FieldValue.arrayUnion(klient.forlobId);
	}
	const eks = await ref.get();
	if (!eks.exists) {
		data.createdAt = Date.now();
	}
	console.log(
		`  → users/${uid}: ${klient.accessLevel}/${klient.accessSource}/${klient.activeProduct}${klient.forlobId ? ` (forlob: ${klient.forlobId})` : ''}`
	);
	if (skriv) {
		await ref.set(data, { merge: true });
	}
}

async function ensureForlobsKunde(klient: TestKlient, uid: string) {
	if (!klient.forlobId) return;

	// allowedEmails-record så login-flowet sætter status korrekt hvis hun
	// logger ud og ind igen via flow.
	const allowedRef = db.collection('allowedEmails').doc(klient.email.toLowerCase());
	const allowedData: Record<string, unknown> = {
		email: klient.email.toLowerCase(),
		firstName: klient.firstName,
		lastName: klient.lastName,
		forlobId: klient.forlobId,
		accessLevel: klient.accessLevel,
		accessSource: klient.accessSource,
		activeProduct: klient.activeProduct,
		state: klient.state,
		status: 'registered',
		registreret: FieldValue.serverTimestamp()
	};
	console.log(`  → allowedEmails/${klient.email.toLowerCase()}`);
	if (skriv) {
		await allowedRef.set(allowedData, { merge: true });
	}

	// userProduct med forlobId så mikrotræning + vaner kan finde forløbet
	const productId = klient.activeProduct === 'premiumforløb' ? 'premiumforløb' : 'kickstart';
	const productRef = db
		.collection('users')
		.doc(uid)
		.collection('products')
		.doc(productId);
	console.log(`  → users/${uid}/products/${productId}.forlobId = ${klient.forlobId}`);
	if (skriv) {
		const eks = await productRef.get();
		const baseData: Record<string, unknown> = {
			productId,
			forlobId: klient.forlobId
		};
		if (!eks.exists) {
			baseData.koebt = FieldValue.serverTimestamp();
			baseData.startDato = new Date('2026-05-01T06:00:00');
			baseData.programValg = {};
			baseData.fremgang = {};
		}
		await productRef.set(baseData, { merge: true });
	}
}

async function main() {
	console.log(`\n--- Seed test-klienter (${skriv ? 'skriv' : 'dry-run'}) ---\n`);

	console.log('Sikrer premium-forløb (test):');
	await ensurePremiumForlob();
	console.log('');

	for (const klient of KLIENTER) {
		console.log(`📧 ${klient.email} (password: ${PASSWORD})`);
		const uid = await ensureUser(klient);
		await ensureUserDoc(klient, uid);
		await ensureForlobsKunde(klient, uid);
		console.log('');
	}

	console.log('Færdig.');
	if (!skriv) {
		console.log('\nKør med --skriv for at oprette/opdatere rigtigt.');
	}
}

main().catch((e) => {
	console.error(e);
	process.exit(1);
});
