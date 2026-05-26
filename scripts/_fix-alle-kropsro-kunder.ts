// Bringer ALLE Kropsro-allowedEmails og deres userDocs til samme
// konsistente state. Idempotent — kan koeres igen uden bivirkninger.
//
// For hver kunde (undtagen linnsacademy@gmail.com):
//  1. allowedEmails: saetter activeProduct, accessLevel, accessSource,
//     activeSubscription, updatedAt
//  2. userDoc (hvis registreret): saetter accessLevel='premium',
//     activeProduct='premiumforloeb', accessSource='forløb',
//     activeSubscription=false, expiresAt, bonusPeriodEndsAt
//     samt arrayUnion(kropsro_maj_2026) til forlobIds
//
// Bruges som engangs-oprydning og kan koeres igen hvis Simplero-webhook
// eller manuel handling bringer felter ud af sync.

import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const sa = JSON.parse(readFileSync(join(__dirname, 'service-account-key.json'), 'utf-8'));
initializeApp({ credential: cert(sa) });
const db = getFirestore();

const FORLOB_ID = 'kropsro_maj_2026';
const SKIP_EMAILS = new Set(['linnsacademy@gmail.com']);
const MS_PER_DAG = 86_400_000;

const apply = process.argv.includes('--apply');

async function main() {
	console.log(`Mode: ${apply ? 'APPLY (skriver til Firestore)' : 'DRY-RUN (ingen skrivninger)'}\n`);

	const fSnap = await db.collection('forlob').doc(FORLOB_ID).get();
	const f = fSnap.data() ?? {};
	const startMs = f.startDato?.toMillis?.();
	const antalDage = f.antalDage;
	if (!startMs || !antalDage) {
		console.error('Forl0b-doc mangler startDato eller antalDage');
		process.exit(1);
	}
	const forventetExp = startMs + antalDage * MS_PER_DAG;
	const forventetBonus = forventetExp + 90 * MS_PER_DAG;
	const nu = Date.now();

	console.log(`Forventet expiresAt:        ${new Date(forventetExp).toISOString().slice(0, 10)}`);
	console.log(`Forventet bonusPeriodEnd:   ${new Date(forventetBonus).toISOString().slice(0, 10)}\n`);

	const allowedSnap = await db.collection('allowedEmails').where('forlobId', '==', FORLOB_ID).get();
	console.log(`Behandler ${allowedSnap.size} Kropsro-allowedEmails\n`);

	let allowedOpdateret = 0;
	let userDocOpdateret = 0;
	let sprungetOver = 0;

	for (const a of allowedSnap.docs) {
		const email = a.data().email ?? a.id;
		if (SKIP_EMAILS.has(email)) {
			console.log(`SKIP  ${email} (paa skip-listen)`);
			sprungetOver++;
			continue;
		}

		const aData = a.data();
		const allowedAend: Record<string, unknown> = {};
		if (aData.activeProduct !== 'premiumforløb') allowedAend.activeProduct = 'premiumforløb';
		if (aData.accessLevel !== 'premium') allowedAend.accessLevel = 'premium';
		if (aData.accessSource !== 'forløb') allowedAend.accessSource = 'forløb';
		if (aData.activeSubscription !== false) allowedAend.activeSubscription = false;
		if (Object.keys(allowedAend).length > 0) {
			allowedAend.updatedAt = nu;
			if (apply) await a.ref.update(allowedAend);
			allowedOpdateret++;
		}

		const uSnap = await db.collection('users').where('email', '==', email).limit(1).get();
		if (uSnap.empty) {
			console.log(`AE    ${email} (ingen userDoc — fix kun allowedEmails)`);
			continue;
		}
		const uDoc = uSnap.docs[0];
		const u = uDoc.data();

		const userAend: Record<string, unknown> = {};
		if (u.accessLevel !== 'premium') userAend.accessLevel = 'premium';
		if (u.activeProduct !== 'premiumforløb') userAend.activeProduct = 'premiumforløb';
		if (u.accessSource !== 'forløb') userAend.accessSource = 'forløb';
		if (u.activeSubscription !== false) userAend.activeSubscription = false;
		if (u.expiresAt !== forventetExp) userAend.expiresAt = forventetExp;
		if (u.bonusPeriodEndsAt !== forventetBonus) userAend.bonusPeriodEndsAt = forventetBonus;
		const harKropsro = Array.isArray(u.forlobIds) && u.forlobIds.includes(FORLOB_ID);
		if (!harKropsro) userAend.forlobIds = FieldValue.arrayUnion(FORLOB_ID);

		if (Object.keys(userAend).length > 0) {
			if (apply) await uDoc.ref.update(userAend);
			userDocOpdateret++;
			const aendringer = Object.keys(userAend).filter((k) => k !== 'updatedAt').join(', ');
			console.log(`OK    ${email} (userDoc: ${aendringer})`);
		} else if (Object.keys(allowedAend).length > 0) {
			console.log(`OK    ${email} (kun allowedEmails)`);
		}
	}

	console.log('');
	console.log(`allowedEmails opdateret: ${allowedOpdateret}`);
	console.log(`userDocs opdateret: ${userDocOpdateret}`);
	console.log(`Sprunget over: ${sprungetOver}`);
	if (!apply && (allowedOpdateret + userDocOpdateret > 0)) {
		console.log('\nKoer med --apply for at skrive aendringerne.');
	}
}
main().then(() => process.exit(0));
