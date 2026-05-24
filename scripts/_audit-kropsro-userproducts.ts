// Audit: tjek om alle Kropsro-kunder har users/{uid}/products/premiumforløb-
// subdokument med korrekt forlobId. Opgrader-scriptet glemte muligvis at
// oprette dette subdokument for nogle brugere, hvilket kan give problemer
// i mikrotrænings-flow (hentAktivProduktType forventer det).
//
// Brug: npx tsx scripts/_audit-kropsro-userproducts.ts

import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const sa = JSON.parse(readFileSync(join(__dirname, 'service-account-key.json'), 'utf-8'));
initializeApp({ credential: cert(sa) });
const db = getFirestore();

const KROPSRO_FORLOB_ID = 'kropsro_maj_2026';

async function main() {
	const uSnap = await db
		.collection('users')
		.where('forlobIds', 'array-contains', KROPSRO_FORLOB_ID)
		.get();

	console.log(`Fandt ${uSnap.size} userDocs med ${KROPSRO_FORLOB_ID} i forlobIds\n`);

	const mangler: string[] = [];
	const forkertForlobId: { email: string; faktisk: string }[] = [];
	const utenProgramValg: string[] = [];
	const ok: string[] = [];

	for (const d of uSnap.docs) {
		const u = d.data();
		const email = u.email ?? '(ingen email)';
		const pSnap = await d.ref.collection('products').doc('premiumforløb').get();

		if (!pSnap.exists) {
			mangler.push(email);
			continue;
		}
		const p = pSnap.data() ?? {};
		if (p.forlobId !== KROPSRO_FORLOB_ID) {
			forkertForlobId.push({ email, faktisk: p.forlobId ?? '(ikke sat)' });
			continue;
		}
		const programValg = p.programValg ?? {};
		if (!programValg.mikrotraening) {
			utenProgramValg.push(email);
			continue;
		}
		ok.push(email);
	}

	console.log(`OK (har subdok + korrekt forlobId + valgt program): ${ok.length}`);
	for (const e of ok) console.log(`  ${e}`);

	console.log(`\nMangler premiumforløb-subdokument helt: ${mangler.length}`);
	for (const e of mangler) console.log(`  ${e}`);

	console.log(`\nHar subdok men forkert forlobId: ${forkertForlobId.length}`);
	for (const { email, faktisk } of forkertForlobId) console.log(`  ${email} (forlobId=${faktisk})`);

	console.log(`\nHar subdok men intet valgt mikrotrænings-program: ${utenProgramValg.length}`);
	for (const e of utenProgramValg) console.log(`  ${e}`);
}
main().then(() => process.exit(0));
