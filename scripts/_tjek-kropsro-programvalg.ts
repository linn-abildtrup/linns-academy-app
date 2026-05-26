// Lister alle Kropsro-kunder med deres aktuelle programValg.mikrotraening
// + om det peger paa et gyldigt aktivt program. Hjaelp til at finde kunder
// der har et tomt eller ugyldigt programvalg.
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const sa = JSON.parse(readFileSync(join(__dirname, 'service-account-key.json'), 'utf-8'));
initializeApp({ credential: cert(sa) });
const db = getFirestore();

const FORLOB_ID = 'kropsro_maj_2026';

async function main() {
	// Hent alle programmer for forlob + om de er aktive + antalDage
	const programSnap = await db.collection('forlob').doc(FORLOB_ID).collection('mikrotraeningProgrammer').get();
	const programmer = new Map<string, { navn: string; aktiv: boolean; antalDage: number }>();
	for (const d of programSnap.docs) {
		const data = d.data();
		programmer.set(d.id, {
			navn: data.navn ?? '?',
			aktiv: data.aktiv ?? false,
			antalDage: data.antalDage ?? 0
		});
	}
	console.log('Alle Kropsro-programmer:');
	for (const [id, p] of programmer) {
		console.log(`  ${id}: '${p.navn}' (aktiv=${p.aktiv}, ${p.antalDage} dage)`);
	}

	// Iterer over Kropsro-kunder
	const uSnap = await db.collection('users')
		.where('forlobIds', 'array-contains', FORLOB_ID)
		.get();
	console.log(`\n${uSnap.size} Kropsro-kunder:`);

	const grupper: Record<string, string[]> = {
		ok: [],
		ingen_valg: [],
		ugyldigt: [],
		inaktivt: []
	};

	for (const uDoc of uSnap.docs) {
		const u = uDoc.data();
		const email = u.email ?? '(ingen email)';
		const pSnap = await uDoc.ref.collection('products').doc('premiumforløb').get();
		if (!pSnap.exists) {
			grupper.ingen_valg.push(`${email} (mangler premiumforloeb-doc)`);
			continue;
		}
		const valgt = (pSnap.data() as { programValg?: { mikrotraening?: string } }).programValg?.mikrotraening;
		if (!valgt) {
			grupper.ingen_valg.push(email);
		} else if (!programmer.has(valgt)) {
			grupper.ugyldigt.push(`${email} → '${valgt}'`);
		} else {
			const p = programmer.get(valgt)!;
			if (!p.aktiv) grupper.inaktivt.push(`${email} → '${valgt}' (deaktiveret)`);
			else if (p.antalDage === 0) grupper.inaktivt.push(`${email} → '${valgt}' (0 dage)`);
			else grupper.ok.push(`${email} → ${p.navn}`);
		}
	}

	console.log(`\n## OK (har valgt aktivt program med dage) — ${grupper.ok.length}`);
	for (const e of grupper.ok) console.log(`  ${e}`);

	console.log(`\n## Intet valg endnu (ser onboarding ved første besøg) — ${grupper.ingen_valg.length}`);
	for (const e of grupper.ingen_valg) console.log(`  ${e}`);

	console.log(`\n## UGYLDIGT programvalg (peger paa et program der ikke findes) — ${grupper.ugyldigt.length}`);
	for (const e of grupper.ugyldigt) console.log(`  ${e}`);

	console.log(`\n## INAKTIVT eller TOMT program — ${grupper.inaktivt.length}`);
	for (const e of grupper.inaktivt) console.log(`  ${e}`);
}
main().then(() => process.exit(0));
