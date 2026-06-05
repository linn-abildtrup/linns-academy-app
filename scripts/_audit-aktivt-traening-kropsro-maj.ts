import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const sa = JSON.parse(readFileSync(join(__dirname, 'service-account-key.json'), 'utf-8'));
initializeApp({ credential: cert(sa) });
const db = getFirestore();

const apply = process.argv.includes('--apply');
const FORLOB_ID = 'kropsro_maj_2026';

function programIdForVariant(variant: string): string {
	return variant === 'kettlebell' ? 'kropsro_84_med_kb' : 'kropsro_84_uden_kb';
}

(async () => {
	console.log(`Mode: ${apply ? 'APPLY' : 'DRY-RUN'}\n`);

	const users = await db.collection('users').get();
	type Row = {
		email: string;
		uid: string;
		variant: string;
		programNu: string;
		forlobNu: string;
		programOnsket: string;
		fixType: 'forkert-forlob' | 'forkert-variant' | 'mangler';
	};
	const ramt: Row[] = [];
	let kunderPaaForlob = 0;

	for (const u of users.docs) {
		const ud = u.data();
		const forlobIds: string[] = ud.forlobIds ?? [];
		if (!forlobIds.includes(FORLOB_ID)) continue;
		kunderPaaForlob++;

		const variant = ud.mikrotraeningVariant;
		if (variant !== 'kettlebell' && variant !== 'no_kettlebell') continue;
		const onsket = programIdForVariant(variant);
		const akt = ud.aktivtTraeningsprogram;

		let fixType: Row['fixType'] | null = null;
		if (!akt) {
			fixType = 'mangler';
		} else if (akt.forlobId !== FORLOB_ID) {
			fixType = 'forkert-forlob';
		} else if (akt.programId !== onsket) {
			fixType = 'forkert-variant';
		}

		if (fixType) {
			ramt.push({
				email: ud.email ?? '?',
				uid: u.id,
				variant,
				programNu: akt?.programId ?? '(intet)',
				forlobNu: akt?.forlobId ?? '(intet)',
				programOnsket: onsket,
				fixType
			});
		}
	}

	console.log(`Kunder paa ${FORLOB_ID}: ${kunderPaaForlob}`);
	console.log(`Ramt: ${ramt.length}\n`);

	for (const r of ramt) {
		console.log(
			`  ${r.email.padEnd(40)} | type=${r.fixType.padEnd(15)} | variant=${r.variant.padEnd(13)} | nu: ${r.programNu}@${r.forlobNu} -> onsket: ${r.programOnsket}@${FORLOB_ID}`
		);
	}

	if (apply && ramt.length > 0) {
		console.log(`\nAnvender ${ramt.length} opdateringer...`);
		for (const r of ramt) {
			await db.doc(`users/${r.uid}`).update({
				aktivtTraeningsprogram: {
					kilde: 'tildelt',
					programId: r.programOnsket,
					forlobId: FORLOB_ID
				}
			});
		}
		console.log('Faerdig.');
	} else if (!apply) {
		console.log('\nKoer med --apply for at opdatere.');
	}
	process.exit(0);
})();
