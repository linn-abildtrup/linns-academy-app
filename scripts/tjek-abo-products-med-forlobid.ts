// Scanner alle users for products/basisabo eller products/premiumabo der
// fejlagtigt har forlobId sat. Disse vil vise en duplikeret lektion-fane
// i biblioteket. Efter bibliotek-koden er fixet er det kun et data-rod,
// men det er pænere at rydde op.
//
// Brug:
//   npx tsx scripts/tjek-abo-products-med-forlobid.ts          # rapport
//   npx tsx scripts/tjek-abo-products-med-forlobid.ts --apply  # ryd op

import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const sa = JSON.parse(readFileSync(join(__dirname, 'service-account-key.json'), 'utf-8'));
initializeApp({ credential: cert(sa) });
const db = getFirestore();

const APPLY = process.argv.includes('--apply');
const ABO_PRODUKTER = ['basisabo', 'premiumabo'];

interface ProductData {
	forlobId?: string;
	productId?: string;
	startDato?: unknown;
	fremgang?: unknown;
}

const usersSnap = await db.collection('users').get();
console.log(`Scanner ${usersSnap.size} users…\n`);

const ramte: { uid: string; email: string; productId: string; data: ProductData }[] = [];
const harOgsaaForlobProduct = new Set<string>(); // uid-pr-fund

for (const userDoc of usersSnap.docs) {
	const email = (userDoc.data() as { email?: string }).email ?? '?';
	const productsSnap = await userDoc.ref.collection('products').get();
	let harForlob = false;
	const aboFundne: { id: string; data: ProductData }[] = [];

	for (const p of productsSnap.docs) {
		const data = p.data() as ProductData;
		if (p.id === 'kickstart' || p.id === 'premiumforløb') {
			if (data.forlobId) harForlob = true;
		}
		if (ABO_PRODUKTER.includes(p.id) && data.forlobId) {
			aboFundne.push({ id: p.id, data });
		}
	}

	for (const a of aboFundne) {
		ramte.push({ uid: userDoc.id, email, productId: a.id, data: a.data });
		if (harForlob) harOgsaaForlobProduct.add(userDoc.id);
	}
}

console.log(`Fundet ${ramte.length} abo-products med forlobId:`);
console.log(`  Heraf ${harOgsaaForlobProduct.size} har ALSO et forløb-product`);
console.log(`  ${ramte.length - harOgsaaForlobProduct.size} har KUN abo-product med forlobId\n`);

for (const r of ramte) {
	const dup = harOgsaaForlobProduct.has(r.uid) ? ' [dup-bibliotek-fane]' : '';
	console.log(`  ${r.email} · products/${r.productId} · forlobId=${r.data.forlobId}${dup}`);
}

if (APPLY) {
	console.log('\nFjerner forlobId fra abo-product docs (beholder selve dokumentet)…');
	for (const r of ramte) {
		await db
			.collection('users')
			.doc(r.uid)
			.collection('products')
			.doc(r.productId)
			.update({ forlobId: null });
	}
	console.log(`Færdig — ${ramte.length} docs opdateret.`);
} else if (ramte.length > 0) {
	console.log('\nKør med --apply for at fjerne forlobId-feltet fra abo-product docs.');
}
