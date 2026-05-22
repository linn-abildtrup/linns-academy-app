// Giver 17 Kropsro-købere basis-app-adgang som mellemløsning indtil
// Kropsro-forløbet er sat ordentligt op i appen.
//
// Opretter/opdaterer allowedEmails-entries med:
//   accessLevel: 'basis'
//   accessSource: 'abonnement'
//   activeProduct: 'basisabo'
//   activeSubscription: true
//   status: 'registered'
//
// Når kunden logger ind kører synkroniserForlobskundeStatus (userDoc.ts)
// og kopierer felterne over på hendes userDoc → hun får basis-app-adgang.
//
// Brug:
//   npx tsx scripts/giv-kropsro-kunder-basis-adgang.ts          # dry-run
//   npx tsx scripts/giv-kropsro-kunder-basis-adgang.ts --apply

import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const APPLY = process.argv.includes('--apply');

const sa = JSON.parse(readFileSync(join(__dirname, 'service-account-key.json'), 'utf-8'));
initializeApp({ credential: cert(sa) });
const db = getFirestore();

const EMAILS = [
	's.kolath@hotmail.com',
	'am.brylle@gmail.com',
	'lenejacobsen76@gmail.com',
	'charlottenchristensen@hotmail.com',
	'sannekingo.henneberg@gmail.com',
	'lineahnstrom@gmail.com',
	'ab.porskrog@gmail.com',
	'mie@kjongerskov.dk',
	'anneolsen35@gmail.com',
	'unnivalbjorn@gmail.com',
	'piajuhl@yahoo.dk',
	'emmajuhler@yahoo.dk',
	'lisetteborg87@gmail.com',
	'mette.jessen@hotmail.dk',
	'lica.andersen@gmail.com',
	'vj@vivian-alex.dk',
	'finnk.lone@gmail.com'
];

function docId(email: string): string {
	return email.replace(/\//g, '_');
}

async function main() {
	console.log(APPLY ? '=== APPLY mode ===\n' : '=== DRY-RUN ===\n');
	console.log(`Antal kunder: ${EMAILS.length}\n`);

	let nye = 0;
	let opdaterede = 0;
	let fejlede = 0;

	for (const raw of EMAILS) {
		const email = raw.trim().toLowerCase();
		if (!email || !email.includes('@')) {
			console.warn(`  ! Ugyldig email: ${raw}`);
			fejlede++;
			continue;
		}
		const id = docId(email);
		const ref = db.collection('allowedEmails').doc(id);

		try {
			const snap = await ref.get();
			const findesAllerede = snap.exists;
			const eksisterende = snap.data() ?? {};
			const data: Record<string, unknown> = {
				email,
				accessLevel: 'basis',
				accessSource: 'abonnement',
				activeProduct: 'basisabo',
				activeSubscription: true,
				status: 'registered',
				updatedAt: Date.now()
			};
			if (!findesAllerede) data.oprettet = FieldValue.serverTimestamp();

			console.log(`  ${findesAllerede ? '↻' : '＋'} ${email}`);
			if (findesAllerede) {
				const eksAcc = eksisterende.accessLevel ?? 'ingen';
				const eksSrc = eksisterende.accessSource ?? 'ingen';
				const eksProd = eksisterende.activeProduct ?? 'ingen';
				const eksForlob = eksisterende.forlobId ?? '-';
				console.log(
					`     nuværende: ${eksAcc}/${eksSrc}/${eksProd} · forlobId=${eksForlob}`
				);
			}
			if (APPLY) await ref.set(data, { merge: true });
			if (findesAllerede) opdaterede++;
			else nye++;
		} catch (e) {
			fejlede++;
			console.error(`  ! ${email}: ${(e as Error).message}`);
		}
	}

	console.log(`\nResultat:`);
	console.log(`  Nye:        ${nye}`);
	console.log(`  Opdaterede: ${opdaterede}`);
	console.log(`  Fejlede:    ${fejlede}`);
	if (!APPLY) console.log('\nKør med --apply for at skrive til Firestore.');
}

main()
	.then(() => process.exit(0))
	.catch((e) => {
		console.error(e);
		process.exit(1);
	});
