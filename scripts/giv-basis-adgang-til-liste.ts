// Giv basis-app-adgang til en liste af kunder. Bruges når Linn manuelt
// skal give adgang udenom Simplero (fx kunder der har købt et nyt forløb
// gennem anden kanal og skal have basis-adgang midlertidigt).
//
// For hver email opdateres BÅDE users-doc og allowedEmails så datalaget
// er konsistent og admin-tællingen viser dem korrekt.
//
// Brug:
//   npx tsx scripts/giv-basis-adgang-til-liste.ts <email1> <email2> ...        # dry-run
//   npx tsx scripts/giv-basis-adgang-til-liste.ts --apply <email1> <email2>    # skriv

import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const sa = JSON.parse(readFileSync(join(__dirname, 'service-account-key.json'), 'utf-8'));
initializeApp({ credential: cert(sa) });
const db = getFirestore();

const args = process.argv.slice(2);
const APPLY = args.includes('--apply');
const emails = args.filter((a) => !a.startsWith('--')).map((e) => e.trim().toLowerCase());

if (emails.length === 0) {
	console.error('Brug: npx tsx scripts/giv-basis-adgang-til-liste.ts [--apply] <email1> <email2> ...');
	process.exit(1);
}

console.log(APPLY ? '=== APPLY ===\n' : '=== DRY-RUN ===\n');
console.log(`Giver basis-app-adgang til ${emails.length} kunder.\n`);

const opdatering = {
	accessLevel: 'basis',
	accessSource: 'abonnement',
	activeProduct: 'basisabo',
	activeSubscription: true,
	state: 'modulbruger',
	expiresAt: null,
	updatedAt: Date.now()
};

let opdaterede = 0;
let manglerKonto = 0;
let fejlede = 0;

for (const email of emails) {
	try {
		const allowedRef = db.collection('allowedEmails').doc(email);
		const allowedSnap = await allowedRef.get();
		const aktuel = allowedSnap.exists ? (allowedSnap.data() as Record<string, unknown>) : null;

		const beskrivelse = aktuel
			? `nuværende: ${aktuel.accessLevel ?? '-'}/${aktuel.accessSource ?? '-'} activeSub=${aktuel.activeSubscription ?? '-'}`
			: '(ingen allowedEmails — opretter)';
		console.log(`  ${email}  ${beskrivelse}`);

		if (APPLY) {
			await allowedRef.set({ email, ...opdatering }, { merge: true });

			const usersSnap = await db.collection('users').where('email', '==', email).get();
			if (usersSnap.empty) {
				manglerKonto++;
				console.log(`    ⚠️  ingen Firebase Auth-konto — kun whitelisted`);
			} else {
				for (const u of usersSnap.docs) {
					await u.ref.set(opdatering, { merge: true });
				}
			}
		}
		opdaterede++;
	} catch (e) {
		fejlede++;
		console.error(`  ! ${email}: ${(e as Error).message}`);
	}
}

console.log(`\nResultat:`);
console.log(`  ${APPLY ? 'Opdaterede' : 'Ville opdatere'}: ${opdaterede}`);
if (manglerKonto > 0) console.log(`  Uden Auth-konto:  ${manglerKonto}`);
console.log(`  Fejlede:           ${fejlede}`);
if (!APPLY) console.log('\nKør med --apply for at skrive.');
