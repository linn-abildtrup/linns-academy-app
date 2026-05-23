// Opgrader alle Kropsro-kunder fra basisabo til premiumforloeb.
// Opdaterer baade allowedEmails og userDoc (for registrerede).
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
const SKIP_EMAILS = new Set(['linnsacademy@gmail.com']); // har allerede premium

async function main() {
	const allowed = await db.collection('allowedEmails')
		.where('forlobId', '==', FORLOB_ID)
		.get();

	console.log(`Fandt ${allowed.size} allowedEmails for ${FORLOB_ID}`);
	console.log('');

	let opgraderet = 0;
	let sprungetOver = 0;
	let userDocOpdateret = 0;
	const nu = Date.now();

	for (const d of allowed.docs) {
		const data = d.data();
		const email = data.email ?? d.id;

		if (SKIP_EMAILS.has(email)) {
			console.log(`SKIP  ${email} (allerede premium)`);
			sprungetOver++;
			continue;
		}

		// 1) opdater allowedEmail
		await d.ref.update({
			activeProduct: 'premiumforløb',
			accessLevel: 'premium',
			accessSource: 'forløb',
			activeSubscription: false,
			updatedAt: nu
		});
		opgraderet++;

		// 2) hvis registreret, opdater userDoc ogsaa
		if (data.status === 'registered') {
			const uSnap = await db.collection('users')
				.where('email', '==', email)
				.limit(1)
				.get();
			if (!uSnap.empty) {
				await uSnap.docs[0].ref.update({
					activeProduct: 'premiumforløb',
					accessLevel: 'premium',
					accessSource: 'forløb',
					activeSubscription: false,
					forlobIds: FieldValue.arrayUnion(FORLOB_ID)
				});
				userDocOpdateret++;
				console.log(`OK    ${email} (allowedEmail + userDoc)`);
			} else {
				console.log(`OK    ${email} (kun allowedEmail — userDoc ikke fundet trods status=registered)`);
			}
		} else {
			console.log(`OK    ${email} (kun allowedEmail — status=${data.status ?? '?'})`);
		}
	}

	console.log('');
	console.log(`Opgraderet: ${opgraderet} allowedEmails`);
	console.log(`UserDocs opdateret: ${userDocOpdateret}`);
	console.log(`Sprunget over: ${sprungetOver}`);
}
main().then(() => process.exit(0));
