// Beriger eksisterende Frida-fødevarer med kulhydrater, fedt og kalorier
// uden at overskrive andre felter (cat/name/p/f/units etc).
//
// Bruges som follow-up til seed-frida — lader os tilføje udvidet
// næringsdata uden at miste manuelle kategori-rettelser eller andre
// felter der måtte være ændret siden seed-tid.
//
// Kør:
//   npx tsx scripts/berig-fodevarer-naering.ts            # dry-run
//   npx tsx scripts/berig-fodevarer-naering.ts --skriv    # skriv

import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { existsSync, readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import * as XLSXMod from 'xlsx';
const XLSX = (XLSXMod as { default?: typeof XLSXMod }).default ?? XLSXMod;

const __dirname = dirname(fileURLToPath(import.meta.url));
const skriv = process.argv.includes('--skriv');

const FRIDA_PATH = join(__dirname, 'frida.xlsx');
if (!existsSync(FRIDA_PATH)) {
	console.error(`❌ Mangler ${FRIDA_PATH}`);
	process.exit(1);
}

const sa = JSON.parse(readFileSync(join(__dirname, 'service-account-key.json'), 'utf-8'));
initializeApp({ credential: cert(sa) });
const db = getFirestore();

function toNumber(v: unknown): number {
	if (typeof v === 'number') return v;
	if (typeof v !== 'string') return 0;
	const cleaned = v.replace(',', '.').replace(/[^\d.-]/g, '');
	const n = parseFloat(cleaned);
	return Number.isFinite(n) ? n : 0;
}

interface Berigelse {
	id: string;
	kh: number;
	fedt: number;
	kcal: number;
}

function laesFrida(): Berigelse[] {
	console.log(`📂 Læser ${FRIDA_PATH}...`);
	const wb = XLSX.readFile(FRIDA_PATH);
	const sheet = wb.Sheets['Data_Table'];
	if (!sheet) {
		console.error('❌ Mangler arket Data_Table');
		process.exit(1);
	}
	const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, raw: false });
	const headerRow = rows[0];
	const cells = headerRow.map((c) => String(c ?? '').toLowerCase().trim());
	let kh = -1;
	let fedt = -1;
	let kcal = -1;
	for (let i = 0; i < cells.length; i++) {
		const c = cells[i];
		if (
			kh === -1 &&
			(c === 'kulhydrat tilgængelig' ||
				c === 'kulhydrat, tilgængelig' ||
				c === 'kulhydrat' ||
				c === 'tilgængelig kulhydrat')
		)
			kh = i;
		if (fedt === -1 && c === 'fedt') fedt = i;
		if (kcal === -1 && (c === 'energi, kcal' || c === 'energi (kcal)' || c === 'energi kcal'))
			kcal = i;
	}
	console.log(`   ✓ Kulhydrat: ${kh}, Fedt: ${fedt}, Kcal: ${kcal}`);
	if (kh === -1 || fedt === -1 || kcal === -1) {
		console.error('❌ Kunne ikke finde alle nødvendige kolonner');
		process.exit(1);
	}

	const ud: Berigelse[] = [];
	for (const r of rows.slice(4)) {
		const navn = String(r[0] ?? '').trim();
		if (!navn) continue;
		const foodId = String(r[2] ?? '').trim();
		if (!foodId) continue;
		ud.push({
			id: `frida_${foodId}`,
			kh: toNumber(r[kh]),
			fedt: toNumber(r[fedt]),
			kcal: toNumber(r[kcal])
		});
	}
	return ud;
}

async function main() {
	const berigelser = laesFrida();
	console.log(`\nFundet ${berigelser.length} Frida-fødevarer med næringsdata.\n`);

	if (!skriv) {
		console.log('Eksempler:');
		for (const b of berigelser.slice(0, 8)) {
			console.log(`   ${b.id}: ${b.kh}g kh · ${b.fedt}g fedt · ${b.kcal} kcal`);
		}
		console.log('\n(dry-run — kør med --skriv for at opdatere Firestore)');
		return;
	}

	const CHUNK = 400;
	let skrevet = 0;
	for (let i = 0; i < berigelser.length; i += CHUNK) {
		const batch = db.batch();
		for (const b of berigelser.slice(i, i + CHUNK)) {
			batch.set(
				db.collection('fodevarer').doc(b.id),
				{ kh: b.kh, fedt: b.fedt, kcal: b.kcal },
				{ merge: true }
			);
		}
		await batch.commit();
		skrevet += Math.min(CHUNK, berigelser.length - i);
		console.log(`   ✓ ${skrevet} / ${berigelser.length}`);
	}
	console.log(`\n✓ ${skrevet} fødevarer beriget med kh/fedt/kcal`);
}

main()
	.then(() => process.exit(0))
	.catch((e) => {
		console.error(e);
		process.exit(1);
	});
