// Engangs-script: tjek de seneste entries i webhookLog for en given email.
// Kør med: npx tsx scripts/inspect-webhook-log.ts bo_andersen1@mac.com

import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const serviceAccount = JSON.parse(
	readFileSync(join(__dirname, 'service-account-key.json'), 'utf-8')
);

initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore();

const email = process.argv[2];
if (!email) {
	console.error('Brug: npx tsx scripts/inspect-webhook-log.ts <email>');
	process.exit(1);
}

async function main() {
	console.log(`\n=== Seneste 30 webhookLog entries (filtreret efter ${email}) ===`);
	const logSnap = await db
		.collection('webhookLog')
		.orderBy('modtaget', 'desc')
		.limit(30)
		.get();

	const target = email.toLowerCase();
	const matches = logSnap.docs.filter((doc) => (doc.data().email ?? '') === target);
	if (matches.length === 0) {
		console.log(`Ingen entries fundet for ${email} blandt de seneste 30.`);
		console.log(`\nSeneste 10 entries overall:`);
		logSnap.docs.slice(0, 10).forEach((doc) => {
			const d = doc.data();
			console.log(
				`${new Date(d.modtaget).toISOString()} | ${d.event} | ${d.status} | ${d.email} | ${d.note}`
			);
		});
	} else {
		matches.forEach((doc) => {
			const d = doc.data();
			console.log(
				`${new Date(d.modtaget).toISOString()} | event=${d.event} | status=${d.status} | produktId=${d.produktId} | note=${d.note}`
			);
		});
	}

	console.log(`\n=== users hvor email = ${email} ===`);
	const userSnap = await db.collection('users').where('email', '==', email.toLowerCase()).get();
	if (userSnap.empty) {
		console.log('Ingen brugere fundet med den email.');
	} else {
		userSnap.forEach((doc) => {
			const d = doc.data();
			console.log(`  uid=${doc.id}`);
			console.log(`    accessLevel=${d.accessLevel}, accessSource=${d.accessSource}`);
			console.log(`    activeProduct=${d.activeProduct}, activeSubscription=${d.activeSubscription}`);
			console.log(`    state=${d.state}, paymentFailedAt=${d.paymentFailedAt}`);
			console.log(`    simpleroCustomerId=${d.simpleroCustomerId}, updatedAt=${d.updatedAt}`);
		});
	}

	console.log(`\n=== allowedEmails/${email} ===`);
	const allowedSnap = await db.collection('allowedEmails').doc(email.toLowerCase()).get();
	if (!allowedSnap.exists) {
		console.log('Ingen entry i allowedEmails.');
	} else {
		console.log(JSON.stringify(allowedSnap.data(), null, 2));
	}
}

main()
	.then(() => process.exit(0))
	.catch((e) => {
		console.error(e);
		process.exit(1);
	});
