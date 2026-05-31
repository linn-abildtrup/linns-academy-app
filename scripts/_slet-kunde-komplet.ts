// Sletter en kunde komplet fra alt:
// - users/{uid} + alle subcollections
// - opskrifter/*/ratings/{uid}
// - spoergsmaal hvor uid matcher
// - forlob/*/challenges/*/indtastninger/{uid}
// - Firebase Auth-konto
// - allowedEmails-doc
//
// Brug: npx tsx scripts/_slet-kunde-komplet.ts <email> [--apply]

import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';
import { getAuth as getAdminAuth } from 'firebase-admin/auth';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const sa = JSON.parse(readFileSync(join(__dirname, 'service-account-key.json'), 'utf-8'));
initializeApp({ credential: cert(sa) });
const db = getFirestore();
const auth = getAdminAuth();

const EMAIL = process.argv[2];
if (!EMAIL || EMAIL.startsWith('--')) {
	console.error('Brug: npx tsx scripts/_slet-kunde-komplet.ts <email> [--apply]');
	process.exit(1);
}
const apply = process.argv.includes('--apply');

async function toemSubcollection(db: Firestore, path: string): Promise<number> {
	const snap = await db.collection(path).get();
	let antal = 0;
	for (const d of snap.docs) {
		const subs = await d.ref.listCollections();
		for (const s of subs) antal += await toemSubcollection(db, s.path);
		if (apply) await d.ref.delete();
		antal++;
	}
	return antal;
}

async function main() {
	console.log(`Mode: ${apply ? 'APPLY (sletter alt)' : 'DRY-RUN'}`);
	console.log(`Email: ${EMAIL}\n`);

	// 1) Find userDoc + uid
	const uSnap = await db.collection('users').where('email', '==', EMAIL).get();
	let uid: string | null = null;
	if (!uSnap.empty) {
		uid = uSnap.docs[0].id;
		console.log(`Fundet uid: ${uid}\n`);
	} else {
		console.log('Ingen userDoc — preover at finde via Firebase Auth\n');
	}

	// 2) Firebase Auth
	try {
		const u = await auth.getUserByEmail(EMAIL);
		if (!uid) uid = u.uid;
		console.log(`Firebase Auth uid: ${u.uid}, oprettet: ${u.metadata.creationTime}`);
	} catch {
		console.log('Findes ikke i Firebase Auth.');
	}

	if (uid) {
		// 3) Slet alle user-subcollections rekursivt
		console.log('\n=== Sletter user-subcollections ===');
		let userTotal = 0;
		const userDocRef = db.collection('users').doc(uid);
		const subs = await userDocRef.listCollections();
		for (const s of subs) {
			const n = await toemSubcollection(db, s.path);
			userTotal += n;
			console.log(`  ${s.id.padEnd(28)} ${n} docs`);
		}

		// 4) Slet userDoc
		if (apply) await userDocRef.delete();
		console.log(`  userDoc selv:               1 doc`);
		userTotal++;

		// 5) Slet opskrift-ratings + reducer aggregat
		console.log('\n=== Sletter opskrift-ratings ===');
		const opskrSnap = await db.collection('opskrifter').get();
		let rTotal = 0;
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
					await o.ref.update({ ratingSum: nySum, ratingCount: nyCount, ratingAvg: nyAvg });
					await rRef.delete();
				}
				rTotal++;
			}
		}
		console.log(`  ratings slettet: ${rTotal}`);

		// 6) Slet spoergsmaal
		console.log('\n=== Sletter spoergsmaal ===');
		const sSnap = await db.collection('spoergsmaal').where('uid', '==', uid).get();
		if (apply) for (const s of sSnap.docs) await s.ref.delete();
		console.log(`  spoergsmaal slettet: ${sSnap.size}`);

		// 7) Slet challenge-indtastninger
		console.log('\n=== Sletter challenge-indtastninger ===');
		const alleForlob = await db.collection('forlob').get();
		let chTotal = 0;
		for (const f of alleForlob.docs) {
			const challenges = await db.collection(`forlob/${f.id}/challenges`).get();
			for (const c of challenges.docs) {
				const iRef = db
					.collection(`forlob/${f.id}/challenges/${c.id}/indtastninger`)
					.doc(uid);
				const i = await iRef.get();
				if (i.exists) {
					if (apply) await iRef.delete();
					chTotal++;
				}
			}
		}
		console.log(`  indtastninger slettet: ${chTotal}`);

		// 8) Slet Firebase Auth-konto
		console.log('\n=== Sletter Firebase Auth-konto ===');
		try {
			if (apply) await auth.deleteUser(uid);
			console.log('  ✓ slettet');
		} catch (e) {
			console.log(`  fejl: ${e instanceof Error ? e.message : 'ukendt'}`);
		}
	}

	// 9) Slet allowedEmail
	console.log('\n=== Sletter allowedEmail ===');
	const aRef = db.collection('allowedEmails').doc(EMAIL);
	const a = await aRef.get();
	if (a.exists) {
		const ad = a.data() ?? {};
		console.log(`  ${ad.firstName} ${ad.lastName} paa ${ad.forlobId}`);
		if (apply) await aRef.delete();
		console.log('  ✓ slettet');
	} else {
		console.log('  ingen allowedEmail-doc');
	}

	console.log('');
	if (!apply) console.log('⚠️  DRY-RUN — koer med --apply.');
	else console.log('✅ Komplet sletning gennemfoert.');
}

main().then(() => process.exit(0));
