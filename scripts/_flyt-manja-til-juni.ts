// Flytter Manja fra kickstart_maj_2026 til kickstart_juni_2026.
// - Sletter ALT af hendes app-data (subcollections + reset paa userDoc)
// - Bevarer hendes auth/uid + firstName/email
// - Saetter premium-adgang paa det nye forl0b
//
// Subcollections der slettes under users/{uid}/:
//   maaltider, aboVanedage, aboVaneOpsaetning, aboBonusValg, aboTraeninger,
//   products, mineProgrammer, privateOpskrifter, traeningHistorik, mrs_scores,
//   appHjaelpQuotaer, aiQuotaer, adminKlient, spoergsmaal_quotas
// Plus:
//   opskrifter/{id}/ratings/{uid} for alle opskrifter
//   spoergsmaal hvor uid == hendes
//
// Brug: npx tsx scripts/_flyt-manja-til-juni.ts [--apply]

import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore, FieldValue, type Firestore } from 'firebase-admin/firestore';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const sa = JSON.parse(readFileSync(join(__dirname, 'service-account-key.json'), 'utf-8'));
initializeApp({ credential: cert(sa) });
const db = getFirestore();

const EMAIL = 'manja.andersen@gmail.com';
const GAMMEL_FORLOB = 'kickstart_maj_2026';
const NYT_FORLOB = 'kickstart_juni_2026';
const MS_PER_DAG = 86_400_000;

const apply = process.argv.includes('--apply');

// Subcollections under users/{uid}/ der skal toemmes helt.
// products skal slettes som hel sub-tree (alle produkt-typer).
const USER_SUBCOLS = [
	'maaltider',
	'aboVanedage',
	'aboVaneOpsaetning',
	'aboBonusValg',
	'aboTraeninger',
	'mineProgrammer',
	'privateOpskrifter',
	'traeningHistorik',
	'mrs_scores',
	'appHjaelpQuotaer',
	'aiQuotaer',
	'spoergsmaal_quotas',
	'adminKlient',
	'fodevarerHidden'
];

// Felter paa userDoc der skal nulstilles (reset til 'fresh')
const USERDOC_RESET_FELTER = [
	'favoritFodevarer',
	'dagligeMaal',
	'visUdvidetNaering',
	'brugerProfil',
	'aktivtTraeningsprogram',
	'mikrotraeningVariant',
	'kropsroBuddyOensker',
	'kropsroFacebookGruppe',
	'senestSpoergsmaalLaestAt',
	'adminKlientMode',
	'adminKlientForlobId',
	'adminKlientAktivProdukt'
];

async function toemSubcollection(db: Firestore, path: string): Promise<number> {
	const snap = await db.collection(path).get();
	let antal = 0;
	for (const d of snap.docs) {
		// Slet evt. nested subcollections foerst (rekursivt)
		const subs = await d.ref.listCollections();
		for (const s of subs) {
			antal += await toemSubcollection(db, s.path);
		}
		if (apply) await d.ref.delete();
		antal++;
	}
	return antal;
}

async function main() {
	console.log(`Mode: ${apply ? 'APPLY (skriver til Firestore)' : 'DRY-RUN'}`);
	console.log(`Flytter ${EMAIL} fra ${GAMMEL_FORLOB} → ${NYT_FORLOB}\n`);

	// 1) Find userDoc
	const uSnap = await db.collection('users').where('email', '==', EMAIL).get();
	if (uSnap.empty) {
		console.error('Bruger ikke fundet — afbryder.');
		process.exit(1);
	}
	if (uSnap.size > 1) {
		console.error(`${uSnap.size} match — afbryder for sikkerhed.`);
		process.exit(1);
	}
	const uDoc = uSnap.docs[0];
	const uid = uDoc.id;
	const u = uDoc.data();
	console.log(`uid: ${uid}`);
	console.log(`firstName: ${u.firstName}\n`);

	// 2) Hent nyt forl0b for dato-beregning
	const nytSnap = await db.collection('forlob').doc(NYT_FORLOB).get();
	if (!nytSnap.exists) {
		console.error(`Forl0b ${NYT_FORLOB} findes ikke.`);
		process.exit(1);
	}
	const nytF = nytSnap.data() ?? {};
	const startMs: number = nytF.startDato?.toMillis?.() ?? 0;
	const antalDage: number = nytF.antalDage ?? 21;
	const expiresAt = startMs + antalDage * MS_PER_DAG;
	const bonusEnd = expiresAt + 90 * MS_PER_DAG;
	console.log(`Nyt forl0b start: ${new Date(startMs).toISOString().slice(0, 10)}`);
	console.log(`Nyt forl0b slut:  ${new Date(expiresAt).toISOString().slice(0, 10)}`);
	console.log(`Bonus slutter:    ${new Date(bonusEnd).toISOString().slice(0, 10)}\n`);

	// 3) Toem alle user-subcollections
	console.log('=== Sletter user-subcollections ===');
	let totalSlettet = 0;
	for (const sub of USER_SUBCOLS) {
		const path = `users/${uid}/${sub}`;
		const n = await toemSubcollection(db, path);
		totalSlettet += n;
		console.log(`  ${sub.padEnd(25)} ${n} docs${n === 0 ? ' (tom)' : ''}`);
	}
	// products har nested subcollections (vanedage etc) — slet sub-tree
	const productsRef = db.collection(`users/${uid}/products`);
	const productSnaps = await productsRef.get();
	let prodAntal = 0;
	for (const p of productSnaps.docs) {
		const subs = await p.ref.listCollections();
		for (const s of subs) {
			prodAntal += await toemSubcollection(db, s.path);
		}
		if (apply) await p.ref.delete();
		prodAntal++;
	}
	totalSlettet += prodAntal;
	console.log(`  products (rekursivt)      ${prodAntal} docs`);

	// 4) Slet hendes opskrift-ratings
	console.log('\n=== Sletter opskrift-ratings ===');
	const opskrSnap = await db.collection('opskrifter').get();
	let ratingsSlettet = 0;
	for (const o of opskrSnap.docs) {
		const rRef = db.collection(`opskrifter/${o.id}/ratings`).doc(uid);
		const r = await rRef.get();
		if (r.exists) {
			if (apply) {
				// Reduceer aggregat foer sletning
				const stjerner = (r.data() as { stjerner?: number }).stjerner ?? 0;
				const oData = o.data() ?? {};
				const prevSum = (oData.ratingSum as number) ?? 0;
				const prevCount = (oData.ratingCount as number) ?? 0;
				const nySum = Math.max(0, prevSum - stjerner);
				const nyCount = Math.max(0, prevCount - 1);
				const nyAvg = nyCount > 0 ? Math.round((nySum / nyCount) * 10) / 10 : null;
				await o.ref.update({
					ratingSum: nySum,
					ratingCount: nyCount,
					ratingAvg: nyAvg
				});
				await rRef.delete();
			}
			ratingsSlettet++;
		}
	}
	console.log(`  ratings slettet: ${ratingsSlettet}`);

	// 5) Slet hendes kunde-spoergsmaal
	console.log('\n=== Sletter klient-spoergsmaal ===');
	const spSnap = await db.collection('spoergsmaal').where('uid', '==', uid).get();
	if (apply) {
		for (const s of spSnap.docs) await s.ref.delete();
	}
	console.log(`  spoergsmaal slettet: ${spSnap.size}`);

	// 6) Slet challenge-indtastninger (under alle forl0b)
	console.log('\n=== Sletter challenge-indtastninger ===');
	let chSlettet = 0;
	const alleForlob = await db.collection('forlob').get();
	for (const f of alleForlob.docs) {
		const challenges = await db.collection(`forlob/${f.id}/challenges`).get();
		for (const c of challenges.docs) {
			const indtRef = db.collection(`forlob/${f.id}/challenges/${c.id}/indtastninger`).doc(uid);
			const i = await indtRef.get();
			if (i.exists) {
				if (apply) await indtRef.delete();
				chSlettet++;
			}
		}
	}
	console.log(`  indtastninger slettet: ${chSlettet}`);

	// 7) Slet gammel allowedEmail
	console.log('\n=== Sletter gammel allowedEmail ===');
	const aRef = db.collection('allowedEmails').doc(EMAIL);
	const aSnap = await aRef.get();
	if (aSnap.exists) {
		if (apply) await aRef.delete();
		console.log(`  allowedEmails/${EMAIL} slettet`);
	} else {
		console.log('  (ingen allowedEmail-doc)');
	}

	// 8) Opret ny allowedEmail med premium-felter
	console.log('\n=== Opretter ny allowedEmail paa juni-forl0bet ===');
	const lastName = (aSnap.data()?.lastName as string | undefined) ?? '';
	const nyAllowedData = {
		email: EMAIL,
		firstName: u.firstName ?? '',
		lastName,
		forlobId: NYT_FORLOB,
		status: 'registered' as const,
		accessLevel: 'premium' as const,
		accessSource: 'forløb' as const,
		activeProduct: 'premiumforløb' as const,
		activeSubscription: false,
		oprettet: FieldValue.serverTimestamp(),
		updatedAt: Date.now()
	};
	if (apply) await aRef.set(nyAllowedData);
	console.log(`  allowedEmail oprettet med ${Object.keys(nyAllowedData).length} felter`);

	// 9) Reset userDoc + saet nye adgangs-felter
	console.log('\n=== Resetter userDoc + premium-adgang ===');
	const userOpdatering: Record<string, unknown> = {
		// Adgangs-felter — premium paa nyt forl0b
		accessLevel: 'premium',
		accessSource: 'forløb',
		activeProduct: 'premiumforløb',
		activeSubscription: false,
		expiresAt,
		bonusPeriodEndsAt: bonusEnd,
		// forlobIds: kun juni-forl0bet
		forlobIds: [NYT_FORLOB],
		// state forbliver forlobskunde
		state: 'forlobskunde'
	};
	// Nulstil personlige felter
	for (const f of USERDOC_RESET_FELTER) {
		userOpdatering[f] = FieldValue.delete();
	}
	if (apply) await uDoc.ref.update(userOpdatering);
	console.log('  userDoc opdateret:');
	console.log('    accessLevel: premium');
	console.log('    activeProduct: premiumforloeb');
	console.log(`    forlobIds: [${NYT_FORLOB}]`);
	console.log(`    expiresAt: ${new Date(expiresAt).toISOString().slice(0, 10)}`);
	console.log(`    bonusPeriodEndsAt: ${new Date(bonusEnd).toISOString().slice(0, 10)}`);
	console.log(`    nulstillede felter: ${USERDOC_RESET_FELTER.length}`);

	console.log('\n=== Opsummering ===');
	console.log(`  User-subcols slettet: ${totalSlettet} docs`);
	console.log(`  Opskrift-ratings: ${ratingsSlettet}`);
	console.log(`  Spoergsmaal: ${spSnap.size}`);
	console.log(`  Challenge-indtastninger: ${chSlettet}`);
	console.log(`  allowedEmail: omdoebt fra ${GAMMEL_FORLOB} til ${NYT_FORLOB}`);
	console.log(`  userDoc: resetted + premium`);

	if (!apply) {
		console.log('\n⚠️  DRY-RUN — ingen aendringer skrevet. Koer med --apply.');
	}
}

main().then(() => process.exit(0));
