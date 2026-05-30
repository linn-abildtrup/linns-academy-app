// Opgraderer Tinas allowedEmail paa kickstart_juni_2026 fra basis til premium.
// Hun har ikke logget ind paa appen endnu (kun 'invited'), saa der er ingen
// userDoc eller subcollections at oprydde i — kun allowedEmail-doc'en
// skal opdateres.

import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const sa = JSON.parse(readFileSync(join(__dirname, 'service-account-key.json'), 'utf-8'));
initializeApp({ credential: cert(sa) });
const db = getFirestore();

const EMAIL = 'pettersontina@gmail.com';

const apply = process.argv.includes('--apply');

async function main() {
	console.log(`Mode: ${apply ? 'APPLY' : 'DRY-RUN'}\n`);

	const ref = db.collection('allowedEmails').doc(EMAIL);
	const snap = await ref.get();
	if (!snap.exists) {
		console.error(`allowedEmail for ${EMAIL} findes ikke.`);
		process.exit(1);
	}
	const d = snap.data() ?? {};
	console.log('Foer:');
	console.log(`  accessLevel: ${d.accessLevel}`);
	console.log(`  activeProduct: ${d.activeProduct}`);

	const opdatering = {
		accessLevel: 'premium' as const,
		activeProduct: 'premiumforløb' as const,
		updatedAt: Date.now()
	};

	if (apply) {
		await ref.update(opdatering);
		console.log('\nEfter:');
		console.log('  accessLevel: premium');
		console.log('  activeProduct: premiumforløb');
		console.log('\n✅ Tina er nu opgraderet til premium.');
		console.log('   Naar hun foerste gang logger ind, faar userDoc premium-felterne via sync.');
	} else {
		console.log('\nVil opdatere til:');
		console.log('  accessLevel: premium');
		console.log('  activeProduct: premiumforløb');
		console.log('\n⚠️  DRY-RUN — koer med --apply.');
	}
}

main().then(() => process.exit(0));
