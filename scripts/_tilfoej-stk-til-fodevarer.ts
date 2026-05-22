// Tilføjer 'stk' som enhed til de fødevarer der mangler den men oplagt
// burde have den (æg, æble, banan, gulerod osv.). Filtrerer forarbejdede
// former fra (tørret, konserves, pasteuriseret, pølse-pålæg, eddike osv.).
//
// Brug:
//   npx tsx scripts/_tilfoej-stk-til-fodevarer.ts          # dry-run
//   npx tsx scripts/_tilfoej-stk-til-fodevarer.ts --apply

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

const STK_KANDIDATER: Record<string, number> = {
	'æg': 58,
	'agurk': 400,
	'citron': 100,
	'lime': 70,
	'æble': 150,
	'pære': 170,
	'banan': 120,
	'avocado': 160,
	'kiwi': 75,
	'appelsin': 150,
	'mandarin': 80,
	'fersken': 130,
	'nektarin': 130,
	'blomme': 60,
	'mango': 250,
	'figen': 60,
	'granatæble': 280,
	'tomat': 100,
	'cherrytomat': 12,
	'peberfrugt': 150,
	'løg': 100,
	'rødløg': 100,
	'hvidløg': 5,
	'forårsløg': 20,
	'radise': 8,
	'gulerod': 80,
	'pastinak': 100,
	'kartoffel': 100,
	'rødbede': 120,
	'tortilla': 50,
	'pita': 60,
	'fuldkornsbolle': 65,
	'bolle': 60,
	'sød kartoffel': 200,
	'persillerod': 100,
	'artiskok': 200
};

const SKIP_KEYWORDS = [
	'tørret', 'konserves', 'pasteuriseret', 'dybfrost', 'hakkede', 'hakket',
	'ristede', 'ristet', 'syltet', 'soltørret', 'industrifremstillet', 'pulver',
	'saltet', 'syrnet', 'mix', 'pure', 'puré', 'ketchup', 'gele', 'paté',
	'pålæg', 'pølse', 'eddike', 'snaps', 'mel', 'chips', 'tilsat sukker',
	'pasta'
];

function gaetStkVaegt(navn: string): number | null {
	const lower = navn.toLowerCase().trim();
	for (const kw of SKIP_KEYWORDS) {
		if (lower.includes(kw)) return null;
	}
	for (const [kand, g] of Object.entries(STK_KANDIDATER)) {
		if (lower === kand) return g;
		if (lower.startsWith(kand + ',')) return g;
		if (lower.startsWith(kand + ' ')) {
			const efter = lower.slice(kand.length + 1).split(/[\s,]/)[0];
			if (
				['helt', 'hel', 'stor', 'stort', 'lille', 'mellem', 'medium', 'økologisk', 'rød', 'grøn', 'gul', 'moden', 'råt', 'rå'].includes(efter) ||
				efter === ''
			) {
				return g;
			}
		}
	}
	return null;
}

async function main() {
	console.log(APPLY ? '=== APPLY ===\n' : '=== DRY-RUN ===\n');
	const snap = await db.collection('fodevarer').get();
	console.log(`📋 ${snap.size} fødevarer i Firestore\n`);

	type Update = { id: string; navn: string; nuvUnits: { u: string; g: number }[]; nyG: number };
	const updates: Update[] = [];

	for (const d of snap.docs) {
		const data = d.data();
		const navn = (data.name || '') as string;
		const units = (data.units ?? []) as { u: string; g: number }[];
		const harStk = units.some((u) => u.u === 'stk');
		if (harStk) continue;
		const g = gaetStkVaegt(navn);
		if (g === null) continue;
		updates.push({
			id: d.id,
			navn,
			nuvUnits: units.map((u) => ({ u: u.u, g: u.g })),
			nyG: g
		});
	}

	console.log(`📋 ${updates.length} fødevarer at opdatere\n`);

	for (const u of updates) {
		const eks = u.nuvUnits.length === 0 ? '(kun gram)' : u.nuvUnits.map((x) => `${x.u}=${x.g}g`).join(', ');
		console.log(`   + stk=${u.nyG}g til "${u.navn}" (var: ${eks})`);
	}

	if (!APPLY) {
		console.log(`\n(Dry-run — kør med --apply for at skrive.)`);
		return;
	}

	const batchSize = 400;
	let skrevet = 0;
	for (let start = 0; start < updates.length; start += batchSize) {
		const batch = db.batch();
		const sub = updates.slice(start, start + batchSize);
		for (const u of sub) {
			const ref = db.collection('fodevarer').doc(u.id);
			batch.update(ref, {
				units: FieldValue.arrayUnion({ u: 'stk', label: 'stk', g: u.nyG })
			});
		}
		await batch.commit();
		skrevet += sub.length;
		console.log(`   ✓ Skrev ${skrevet}/${updates.length}`);
	}
	console.log(`\n✅ Færdig.`);
}

main().then(() => process.exit(0));
