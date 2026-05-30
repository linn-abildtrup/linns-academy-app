// Flytter en eller flere kunder fra kickstart_maj_2026 til kickstart_juni_2026.
// Samme reset + premium-flow som _flyt-manja-til-juni.ts, men over flere
// kunder paa én gang.
//
// Brug: npx tsx scripts/_flyt-kunder-til-juni.ts [--apply]

import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore, FieldValue, type Firestore } from 'firebase-admin/firestore';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const sa = JSON.parse(readFileSync(join(__dirname, 'service-account-key.json'), 'utf-8'));
initializeApp({ credential: cert(sa) });
const db = getFirestore();

const EMAILS = ['line_dybro@hotmail.com'];
const NYT_FORLOB = 'kickstart_juni_2026';
const MS_PER_DAG = 86_400_000;

const apply = process.argv.includes('--apply');

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
		const subs = await d.ref.listCollections();
		for (const s of subs) {
			antal += await toemSubcollection(db, s.path);
		}
		if (apply) await d.ref.delete();
		antal++;
	}
	return antal;
}

async function flytKunde(
	db: Firestore,
	email: string,
	startMs: number,
	antalDage: number
): Promise<{ ok: boolean; uid?: string; subSlettet?: number; ratings?: number; sp?: number; ch?: number; }> {
	console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
	console.log(`Flytter: ${email}`);

	// 1) userDoc
	const uSnap = await db.collection('users').where('email', '==', email).get();
	if (uSnap.empty) {
		console.log('  Bruger ikke fundet — springer over.');
		return { ok: false };
	}
	if (uSnap.size > 1) {
		console.log(`  ${uSnap.size} match — springer over for sikkerhed.`);
		return { ok: false };
	}
	const uDoc = uSnap.docs[0];
	const uid = uDoc.id;
	const u = uDoc.data();
	console.log(`  uid: ${uid}, firstName: ${u.firstName}`);

	const expiresAt = startMs + antalDage * MS_PER_DAG;
	const bonusEnd = expiresAt + 90 * MS_PER_DAG;

	// 2) Slet alle subcollections
	let totalSlettet = 0;
	for (const sub of USER_SUBCOLS) {
		const path = `users/${uid}/${sub}`;
		const n = await toemSubcollection(db, path);
		totalSlettet += n;
	}
	const productsSnap = await db.collection(`users/${uid}/products`).get();
	for (const p of productsSnap.docs) {
		const subs = await p.ref.listCollections();
		for (const s of subs) totalSlettet += await toemSubcollection(db, s.path);
		if (apply) await p.ref.delete();
		totalSlettet++;
	}

	// 3) Opskrift-ratings
	const opskrSnap = await db.collection('opskrifter').get();
	let ratingsSlettet = 0;
	for (const o of opskrSnap.docs) {
		const rRef = db.collection(`opskrifter/${o.id}/ratings`).doc(uid);
		const r = await rRef.get();
		if (r.exists) {
			if (apply) {
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

	// 4) Spoergsmaal
	const spSnap = await db.collection('spoergsmaal').where('uid', '==', uid).get();
	if (apply) for (const s of spSnap.docs) await s.ref.delete();

	// 5) Challenge-indtastninger
	let chSlettet = 0;
	const alleForlob = await db.collection('forlob').get();
	for (const f of alleForlob.docs) {
		const challenges = await db.collection(`forlob/${f.id}/challenges`).get();
		for (const c of challenges.docs) {
			const iRef = db
				.collection(`forlob/${f.id}/challenges/${c.id}/indtastninger`)
				.doc(uid);
			const i = await iRef.get();
			if (i.exists) {
				if (apply) await iRef.delete();
				chSlettet++;
			}
		}
	}

	// 6) Gammel allowedEmail + ny
	const aRef = db.collection('allowedEmails').doc(email);
	const aSnap = await aRef.get();
	const gammelData = aSnap.exists ? aSnap.data() ?? {} : {};
	const lastName = (gammelData.lastName as string | undefined) ?? '';
	if (aSnap.exists && apply) await aRef.delete();

	const nyAllowedData = {
		email,
		firstName: u.firstName ?? gammelData.firstName ?? '',
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

	// 7) Reset userDoc + premium-adgang
	const userOpdatering: Record<string, unknown> = {
		accessLevel: 'premium',
		accessSource: 'forløb',
		activeProduct: 'premiumforløb',
		activeSubscription: false,
		expiresAt,
		bonusPeriodEndsAt: bonusEnd,
		forlobIds: [NYT_FORLOB],
		state: 'forlobskunde'
	};
	for (const f of USERDOC_RESET_FELTER) userOpdatering[f] = FieldValue.delete();
	if (apply) await uDoc.ref.update(userOpdatering);

	console.log(`  Slettet: ${totalSlettet} sub-docs, ${ratingsSlettet} ratings, ${spSnap.size} spoergsmaal, ${chSlettet} challenges`);
	console.log(`  Premium-adgang sat: expiresAt=${new Date(expiresAt).toISOString().slice(0, 10)}, bonus=${new Date(bonusEnd).toISOString().slice(0, 10)}`);
	return { ok: true, uid, subSlettet: totalSlettet, ratings: ratingsSlettet, sp: spSnap.size, ch: chSlettet };
}

async function main() {
	console.log(`Mode: ${apply ? 'APPLY (skriver til Firestore)' : 'DRY-RUN'}`);
	console.log(`Flytter ${EMAILS.length} kunder → ${NYT_FORLOB} (premium-niveau)\n`);

	const nytSnap = await db.collection('forlob').doc(NYT_FORLOB).get();
	if (!nytSnap.exists) {
		console.error(`Forl0b ${NYT_FORLOB} findes ikke.`);
		process.exit(1);
	}
	const nytF = nytSnap.data() ?? {};
	const startMs: number = nytF.startDato?.toMillis?.() ?? 0;
	const antalDage: number = nytF.antalDage ?? 21;
	console.log(`Nyt forl0b start: ${new Date(startMs).toISOString().slice(0, 10)}`);
	console.log(`Nyt forl0b antal dage: ${antalDage}`);

	let ok = 0;
	let fejl = 0;
	for (const email of EMAILS) {
		const res = await flytKunde(db, email, startMs, antalDage);
		if (res.ok) ok++;
		else fejl++;
	}

	console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
	console.log(`Faerdigt: ${ok} flyttet, ${fejl} sprunget over`);
	if (!apply) console.log('\n⚠️  DRY-RUN — ingen aendringer skrevet. Koer med --apply.');
}

main().then(() => process.exit(0));
