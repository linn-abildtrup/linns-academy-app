// Audit hvor 'premiumforløb' lever i Firestore-data.
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
const __dirname = dirname(fileURLToPath(import.meta.url));
const sa = JSON.parse(readFileSync(join(__dirname, 'service-account-key.json'), 'utf-8'));
initializeApp({ credential: cert(sa) });
const db = getFirestore();

async function main() {
	const users = await db.collection('users').get();
	let userActive = 0;
	let userProduct = 0;
	for (const u of users.docs) {
		const data = u.data();
		if (data.activeProduct === 'premiumforløb') userActive++;
		const prods = await u.ref.collection('products').get();
		for (const p of prods.docs) {
			if (p.id === 'premiumforløb') userProduct++;
		}
	}

	const allowed = await db.collection('allowedEmails')
		.where('activeProduct', '==', 'premiumforløb').get();

	const webhookLogs = await db.collection('webhookLog')
		.where('activeProduct', '==', 'premiumforløb').get().catch(() => null);

	console.log(`userDocs med activeProduct='premiumforløb':         ${userActive}`);
	console.log(`users/*/products/premiumforløb-dokumenter:           ${userProduct}`);
	console.log(`allowedEmails med activeProduct='premiumforløb':     ${allowed.size}`);
	if (webhookLogs) console.log(`webhookLog-poster med activeProduct='premiumforløb': ${webhookLogs.size}`);

	const fAlle = await db.collection('forlob').get();
	const kropsroForlob = fAlle.docs.filter((d) => d.data().type === 'kropsro').length;
	const kickstartForlob = fAlle.docs.filter((d) => d.data().type === 'kickstart').length;
	const fUdenType = fAlle.docs.filter((d) => !d.data().type).length;
	console.log(`\nforlob/-dokumenter:`);
	console.log(`  type=kropsro:    ${kropsroForlob}`);
	console.log(`  type=kickstart:  ${kickstartForlob}`);
	console.log(`  uden type:       ${fUdenType}`);
}
main().then(() => process.exit(0));
