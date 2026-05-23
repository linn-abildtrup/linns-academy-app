// Fjerner alle "Inspireret af: X"-linjer fra opskrifternes instruktioner-felt
// i Firestore. Bevarer fremgangsmåde, tip og næringsfakta.
//
// Brug:
//   npx tsx scripts/_fjern-inspireret-af.ts          # dry-run
//   npx tsx scripts/_fjern-inspireret-af.ts --apply

import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const sa = JSON.parse(readFileSync(join(__dirname, 'service-account-key.json'), 'utf-8'));
initializeApp({ credential: cert(sa) });
const db = getFirestore();

const APPLY = process.argv.includes('--apply');

/**
 * Fjerner "Inspireret af: ..."-linjen fra en instruktioner-tekst.
 * Matcher hele tekstblokken inkl. omkringliggende blank-linjer.
 */
function fjernInspireretAf(instr: string): string {
	if (!instr) return instr;
	// Match "Inspireret af: <indtil næste tom linje eller end-of-string>"
	// efterfulgt af nul eller flere blank-linjer.
	const renset = instr.replace(/\n*Inspireret af:[^\n]*\n*/gi, '\n\n');
	// Reducer 3+ newlines til 2 (= én tom linje mellem afsnit)
	return renset.replace(/\n{3,}/g, '\n\n').trim();
}

async function main() {
	console.log(APPLY ? '=== APPLY ===\n' : '=== DRY-RUN ===\n');
	const snap = await db.collection('opskrifter').get();
	console.log(`📋 ${snap.size} opskrifter i Firestore\n`);

	let aendret = 0;
	let uaendret = 0;
	const updates: { id: string; titel: string; foer: string; efter: string }[] = [];

	for (const d of snap.docs) {
		const data = d.data() as { titel?: string; instruktioner?: string };
		const foer = data.instruktioner ?? '';
		if (!foer.match(/inspireret af/i)) {
			uaendret++;
			continue;
		}
		const efter = fjernInspireretAf(foer);
		if (efter === foer) {
			uaendret++;
			continue;
		}
		aendret++;
		updates.push({ id: d.id, titel: data.titel ?? '(uden titel)', foer, efter });
	}

	console.log(`📊 ${aendret} opskrifter skal ændres · ${uaendret} uændrede\n`);

	// Vis 3 første som diff
	for (const u of updates.slice(0, 3)) {
		console.log(`--- ${u.titel} (${u.id}) ---`);
		// Vis kun linjen der fjernes
		const fjernet = u.foer.match(/Inspireret af:[^\n]*/i);
		console.log(`Fjerner: ${fjernet?.[0] ?? '(intet)'}`);
		console.log('');
	}

	if (!APPLY) {
		console.log(`(dry-run — kør med --apply for at skrive)`);
		return;
	}

	const batchSize = 400;
	let skrevet = 0;
	for (let start = 0; start < updates.length; start += batchSize) {
		const batch = db.batch();
		const sub = updates.slice(start, start + batchSize);
		for (const u of sub) {
			const ref = db.collection('opskrifter').doc(u.id);
			batch.update(ref, {
				instruktioner: u.efter,
				opdateret: FieldValue.serverTimestamp()
			});
		}
		await batch.commit();
		skrevet += sub.length;
		console.log(`   ✓ Skrev ${skrevet}/${updates.length}`);
	}
	console.log(`\n✅ Færdig.`);
}

main().then(() => process.exit(0));
