// Tjekker alle Kropsro-kunder for konfigurations-problemer:
//  1. allowedEmails mangler Kropsro-felter (activeProduct, accessLevel etc)
//  2. userDoc har forkert activeProduct eller accessLevel
//  3. userDoc.expiresAt peger paa Kickstart-slut (eller anden ugyldig dato)
//  4. userDoc.bonusPeriodEndsAt er ikke korrekt
//
// Lister hver kunde under den problem-kategori de tilhoerer.

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
const MS_PER_DAG = 86_400_000;

async function main() {
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

	const allowedSnap = await db.collection('allowedEmails').where('forlobId', '==', FORLOB_ID).get();
	console.log(`${allowedSnap.size} allowedEmails for ${FORLOB_ID}\n`);

	const problemer: Record<string, string[]> = {
		allowedMangler: [],
		userDocAccessLevel: [],
		userDocActiveProduct: [],
		userDocExpiresAt: [],
		userDocBonusPeriod: [],
		userDocIkkeRegistreret: []
	};

	for (const a of allowedSnap.docs) {
		const email = a.data().email ?? a.id;
		if (email === 'linnsacademy@gmail.com') continue;
		const aData = a.data();

		// 1. allowedEmails-tjek
		if (aData.activeProduct !== 'premiumforløb' || aData.accessLevel !== 'premium') {
			problemer.allowedMangler.push(email);
		}

		// 2. userDoc-tjek
		const uSnap = await db.collection('users').where('email', '==', email).limit(1).get();
		if (uSnap.empty) {
			problemer.userDocIkkeRegistreret.push(email);
			continue;
		}
		const u = uSnap.docs[0].data();
		if (u.accessLevel !== 'premium') problemer.userDocAccessLevel.push(`${email} (har '${u.accessLevel}')`);
		if (u.activeProduct !== 'premiumforløb')
			problemer.userDocActiveProduct.push(`${email} (har '${u.activeProduct}')`);
		if (u.expiresAt !== forventetExp)
			problemer.userDocExpiresAt.push(
				`${email} (har ${u.expiresAt ? new Date(u.expiresAt).toISOString().slice(0, 10) : 'undefined'})`
			);
		if (u.bonusPeriodEndsAt !== forventetBonus)
			problemer.userDocBonusPeriod.push(
				`${email} (har ${u.bonusPeriodEndsAt ? new Date(u.bonusPeriodEndsAt).toISOString().slice(0, 10) : 'undefined'})`
			);
	}

	const labels: Record<string, string> = {
		allowedMangler: 'allowedEmails mangler Kropsro-felter',
		userDocAccessLevel: "userDoc.accessLevel != 'premium'",
		userDocActiveProduct: "userDoc.activeProduct != 'premiumforløb'",
		userDocExpiresAt: 'userDoc.expiresAt forkert',
		userDocBonusPeriod: 'userDoc.bonusPeriodEndsAt forkert',
		userDocIkkeRegistreret: 'userDoc ikke fundet (har ikke registreret sig endnu)'
	};

	let totalt = 0;
	for (const [key, liste] of Object.entries(problemer)) {
		if (liste.length === 0) continue;
		console.log(`## ${labels[key]} — ${liste.length}`);
		for (const e of liste) console.log(`  ${e}`);
		console.log('');
		if (key !== 'userDocIkkeRegistreret') totalt += liste.length;
	}

	console.log(`Total konfigurations-problemer (eksklusive uregistrede): ${totalt}`);
}
main().then(() => process.exit(0));
