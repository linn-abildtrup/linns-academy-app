// Auditerer alle kunder paa kickstart_juni_2026 for at finde dem med
// inkonsistente adgangs-felter (fx allowedEmail er premium men userDoc er
// stadig basis, eller manglende forlobIds osv).
//
// Rapporterer pr problem-kategori.

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

async function main() {
	const fSnap = await db.collection('forlob').doc(FORLOB_ID).get();
	if (!fSnap.exists) {
		console.error(`Forl0b ${FORLOB_ID} findes ikke.`);
		process.exit(1);
	}
	const fData = fSnap.data() ?? {};
	const startMs: number = fData.startDato?.toMillis?.() ?? 0;
	const antalDage: number = fData.antalDage ?? 21;
	const forventetExp = startMs + antalDage * MS_PER_DAG;
	const forventetBonus = forventetExp + 90 * MS_PER_DAG;

	console.log(`Auditerer ${FORLOB_ID}`);
	console.log(`Forventet expiresAt:      ${new Date(forventetExp).toISOString().slice(0, 10)}`);
	console.log(`Forventet bonusPeriodEnd: ${new Date(forventetBonus).toISOString().slice(0, 10)}\n`);

	const aSnap = await db
		.collection('allowedEmails')
		.where('forlobId', '==', FORLOB_ID)
		.get();
	console.log(`Behandler ${aSnap.size} kunder paa forl0bet\n`);

	const problemer: Record<string, string[]> = {
		allowedManglerPremium: [],
		userDocBasis: [],
		userDocForkertProduct: [],
		userDocForkertSource: [],
		userDocManglerForlobId: [],
		userDocExpiresAt: [],
		userDocBonusPeriod: [],
		uregistreret: []
	};

	let alleOK = 0;

	for (const a of aSnap.docs) {
		const email = (a.data().email as string) ?? a.id;
		const aData = a.data();

		const allowedKorrekt =
			aData.accessLevel === 'premium' &&
			aData.activeProduct === 'premiumforløb' &&
			aData.accessSource === 'forløb';
		if (!allowedKorrekt) {
			problemer.allowedManglerPremium.push(
				`${email} (har accessLevel=${aData.accessLevel}, activeProduct=${aData.activeProduct})`
			);
		}

		// userDoc-tjek
		const uSnap = await db.collection('users').where('email', '==', email).limit(1).get();
		if (uSnap.empty) {
			problemer.uregistreret.push(email);
			continue;
		}
		const u = uSnap.docs[0].data();

		let userOK = allowedKorrekt;
		if (u.accessLevel !== 'premium') {
			problemer.userDocBasis.push(`${email} (har '${u.accessLevel}')`);
			userOK = false;
		}
		if (u.activeProduct !== 'premiumforløb') {
			problemer.userDocForkertProduct.push(`${email} (har '${u.activeProduct}')`);
			userOK = false;
		}
		if (u.accessSource !== 'forløb') {
			problemer.userDocForkertSource.push(`${email} (har '${u.accessSource}')`);
			userOK = false;
		}
		if (!Array.isArray(u.forlobIds) || !u.forlobIds.includes(FORLOB_ID)) {
			problemer.userDocManglerForlobId.push(`${email} (forlobIds=${JSON.stringify(u.forlobIds)})`);
			userOK = false;
		}
		if (u.expiresAt !== forventetExp) {
			problemer.userDocExpiresAt.push(
				`${email} (har ${u.expiresAt ? new Date(u.expiresAt).toISOString().slice(0, 10) : 'undefined'})`
			);
			userOK = false;
		}
		if (u.bonusPeriodEndsAt !== forventetBonus) {
			problemer.userDocBonusPeriod.push(
				`${email} (har ${u.bonusPeriodEndsAt ? new Date(u.bonusPeriodEndsAt).toISOString().slice(0, 10) : 'undefined'})`
			);
			userOK = false;
		}
		if (userOK) alleOK++;
	}

	const labels: Record<string, string> = {
		allowedManglerPremium: 'allowedEmails mangler premium-felter',
		userDocBasis: "userDoc.accessLevel != 'premium'",
		userDocForkertProduct: "userDoc.activeProduct != 'premiumforloeb'",
		userDocForkertSource: "userDoc.accessSource != 'forløb'",
		userDocManglerForlobId: 'userDoc.forlobIds mangler juni-forl0bet',
		userDocExpiresAt: 'userDoc.expiresAt forkert',
		userDocBonusPeriod: 'userDoc.bonusPeriodEndsAt forkert',
		uregistreret: 'Endnu ikke logget ind (kun invited)'
	};

	let totaltProblemer = 0;
	for (const [key, liste] of Object.entries(problemer)) {
		if (liste.length === 0) continue;
		const showAll = key !== 'uregistreret';
		console.log(`## ${labels[key]} — ${liste.length}`);
		const visning = showAll ? liste : liste.slice(0, 5);
		for (const e of visning) console.log(`  ${e}`);
		if (!showAll && liste.length > 5) console.log(`  ... og ${liste.length - 5} flere`);
		console.log('');
		if (key !== 'uregistreret') totaltProblemer += liste.length;
	}

	console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
	console.log(`Total kunder paa forl0bet:        ${aSnap.size}`);
	console.log(`Registrerede med korrekt setup:   ${alleOK}`);
	console.log(`Uregistrerede (kun invited):      ${problemer.uregistreret.length}`);
	console.log(`Registrerede med problemer:       ${totaltProblemer > 0 ? totaltProblemer : 0}`);
}

main().then(() => process.exit(0));
