// Opgraderer alle kunder paa kickstart_juni_2026 til premium-niveau
// (samme adgang som Kropsro-kunderne).
//
// For hver kunde:
// 1. allowedEmail-doc: saet accessLevel='premium', activeProduct='premiumforløb'
// 2. userDoc (hvis registreret): saet samme felter + opdater expiresAt og
//    bonusPeriodEndsAt til at matche juni-forl0bets daekning
//
// Ingen data slettes — kunderne kan stadig bruge deres data efter
// opgraderingen.
//
// Brug: npx tsx scripts/_alle-juni-til-premium.ts [--apply]

import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const sa = JSON.parse(readFileSync(join(__dirname, 'service-account-key.json'), 'utf-8'));
initializeApp({ credential: cert(sa) });
const db = getFirestore();

const FORLOB_ID = 'kickstart_juni_2026';
const MS_PER_DAG = 86_400_000;

const apply = process.argv.includes('--apply');

async function main() {
	console.log(`Mode: ${apply ? 'APPLY (skriver til Firestore)' : 'DRY-RUN'}`);
	console.log(`Opgraderer alle paa ${FORLOB_ID} til premium\n`);

	// Hent forl0b for dato-beregning
	const fSnap = await db.collection('forlob').doc(FORLOB_ID).get();
	if (!fSnap.exists) {
		console.error(`Forl0b ${FORLOB_ID} findes ikke.`);
		process.exit(1);
	}
	const fData = fSnap.data() ?? {};
	const startMs: number = fData.startDato?.toMillis?.() ?? 0;
	const antalDage: number = fData.antalDage ?? 21;
	const expiresAt = startMs + antalDage * MS_PER_DAG;
	const bonusEnd = expiresAt + 90 * MS_PER_DAG;
	console.log(`Forl0b start:   ${new Date(startMs).toISOString().slice(0, 10)}`);
	console.log(`Forl0b slutter: ${new Date(expiresAt).toISOString().slice(0, 10)}`);
	console.log(`Bonus slutter:  ${new Date(bonusEnd).toISOString().slice(0, 10)}\n`);

	// Hent alle allowedEmails for forl0bet
	const aSnap = await db
		.collection('allowedEmails')
		.where('forlobId', '==', FORLOB_ID)
		.get();
	console.log(`${aSnap.size} kunder paa forl0bet\n`);

	let allowedOpdateret = 0;
	let allowedSpringet = 0;
	let userDocOpdateret = 0;
	let userDocIkkeRegistreret = 0;

	for (const a of aSnap.docs) {
		const email = (a.data().email as string) ?? a.id;
		const aData = a.data() ?? {};

		// 1) allowedEmail-opdatering
		const allowedAend: Record<string, unknown> = {};
		if (aData.accessLevel !== 'premium') allowedAend.accessLevel = 'premium';
		if (aData.activeProduct !== 'premiumforløb') allowedAend.activeProduct = 'premiumforløb';
		if (aData.accessSource !== 'forløb') allowedAend.accessSource = 'forløb';
		if (aData.activeSubscription !== false) allowedAend.activeSubscription = false;

		let statusEmoji = '✓';
		if (Object.keys(allowedAend).length > 0) {
			allowedAend.updatedAt = Date.now();
			if (apply) await a.ref.update(allowedAend);
			allowedOpdateret++;
			statusEmoji = '↑';
		} else {
			allowedSpringet++;
		}

		// 2) userDoc-opdatering (kun hvis registreret)
		const uSnap = await db.collection('users').where('email', '==', email).limit(1).get();
		let userInfo = '';
		if (uSnap.empty) {
			userDocIkkeRegistreret++;
			userInfo = ' (ikke registreret)';
		} else {
			const uDoc = uSnap.docs[0];
			const u = uDoc.data();
			const userAend: Record<string, unknown> = {};
			if (u.accessLevel !== 'premium') userAend.accessLevel = 'premium';
			if (u.activeProduct !== 'premiumforløb') userAend.activeProduct = 'premiumforløb';
			if (u.accessSource !== 'forløb') userAend.accessSource = 'forløb';
			if (u.activeSubscription !== false) userAend.activeSubscription = false;
			if (u.expiresAt !== expiresAt) userAend.expiresAt = expiresAt;
			if (u.bonusPeriodEndsAt !== bonusEnd) userAend.bonusPeriodEndsAt = bonusEnd;

			if (Object.keys(userAend).length > 0) {
				if (apply) await uDoc.ref.update(userAend);
				userDocOpdateret++;
				userInfo = ` (userDoc opdateret: ${Object.keys(userAend).join(', ')})`;
			} else {
				userInfo = ' (userDoc allerede premium)';
			}
		}

		console.log(`${statusEmoji} ${email.padEnd(35)}${userInfo}`);
	}

	console.log('\n=== Opsummering ===');
	console.log(`allowedEmails opdateret: ${allowedOpdateret}`);
	console.log(`allowedEmails allerede premium: ${allowedSpringet}`);
	console.log(`userDocs opdateret: ${userDocOpdateret}`);
	console.log(`Ikke-registrerede (kun invited): ${userDocIkkeRegistreret}`);

	if (!apply) {
		console.log('\n⚠️  DRY-RUN — koer med --apply.');
	}
}

main().then(() => process.exit(0));
