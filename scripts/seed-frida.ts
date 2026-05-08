// Seed-script til Frida fødevaredatabase fra DTU Fødevareinstituttet.
//
// Forventer at Linn har lagt en xlsx-fil i scripts/frida.xlsx hentet via
// formularen på https://frida.fooddata.dk/data
//
// Mapping:
//   - FoodID eller Tagnavn → fodevare-id (slugified navn som fallback)
//   - Fødevarenavn (dansk) → name
//   - Foodgroup → cat (mappet til vores Kategori-type)
//   - Protein (g/100g) → p
//   - Fiber (g/100g) → f
//   - kilde: 'frida' så vi kan skelne fra de eksisterende 840 ref-app items
//
// Items der allerede findes i fodevarer/{id} fra kickstart-seed beholdes —
// frida-items skrives med eget id-prefix ('frida_*') så ingen overskrives.
//
// Kør med:
//   npm run seed:frida              (alle items)
//   npm run seed:frida -- --dry     (preview uden at skrive)

import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { existsSync, readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import * as xlsx from 'xlsx';

const __dirname = dirname(fileURLToPath(import.meta.url));

const dryRun = process.argv.includes('--dry');

const FRIDA_PATH_XLSX = join(__dirname, 'frida.xlsx');
const FRIDA_PATH_CSV = join(__dirname, 'frida.csv');

if (!existsSync(FRIDA_PATH_XLSX) && !existsSync(FRIDA_PATH_CSV)) {
	console.error(`❌ Mangler ${FRIDA_PATH_XLSX} eller ${FRIDA_PATH_CSV}`);
	console.error(`   Hent fra https://frida.fooddata.dk/data og læg som scripts/frida.xlsx`);
	process.exit(1);
}

const sa = JSON.parse(readFileSync(join(__dirname, 'service-account-key.json'), 'utf-8'));
initializeApp({ credential: cert(sa) });
const db = getFirestore();

// ==============================================
// Frida-foodgroups → vores Kategori-type
// ==============================================

const FOODGROUP_MAP: Record<string, string> = {
	mælk: 'mejeri',
	mælkeprodukter: 'mejeri',
	'mejeriprodukter og æg': 'mejeri',
	mejeriprodukter: 'mejeri',
	æg: 'mejeri',
	'æg og æggeprodukter': 'mejeri',
	ost: 'mejeri',
	kød: 'koed',
	'kød og kødprodukter': 'koed',
	'kød og fjerkræ': 'koed',
	'fjerkræ og fjerkræprodukter': 'koed',
	pålæg: 'koed',
	fisk: 'fisk',
	'fisk og fiskeprodukter': 'fisk',
	'fisk og skaldyr': 'fisk',
	skaldyr: 'fisk',
	bælgfrugter: 'baelg',
	'bælgfrugter og soja': 'baelg',
	korn: 'korn',
	'korn og kornprodukter': 'korn',
	kornprodukter: 'korn',
	brød: 'korn',
	morgenmadsprodukter: 'korn',
	pasta: 'korn',
	ris: 'korn',
	grøntsager: 'gront',
	'grøntsager og grøntsagsprodukter': 'gront',
	kartofler: 'gront',
	'kartofler og kartoffelprodukter': 'gront',
	frugt: 'baer',
	'frugt og frugtprodukter': 'baer',
	'frugt, bær': 'baer',
	bær: 'baer',
	'nødder og kerner': 'noedder',
	nødder: 'noedder',
	frø: 'noedder',
	'sportsdrikke, kosttilskud': 'prot',
	kosttilskud: 'prot',
	drikke: 'drikke',
	drikkevarer: 'drikke',
	'drikkevarer, ikke-alkoholiske': 'drikke',
	vand: 'drikke',
	te: 'drikke',
	kaffe: 'drikke'
};

function mapFoodgroup(gruppe: string): string {
	const key = (gruppe || '').toLowerCase().trim();
	return FOODGROUP_MAP[key] ?? 'andet';
}

// ==============================================
// Helpers
// ==============================================

function slugify(s: string): string {
	return s
		.toLowerCase()
		.normalize('NFD')
		.replace(/[̀-ͯ]/g, '')
		.replace(/æ/g, 'ae')
		.replace(/ø/g, 'oe')
		.replace(/å/g, 'aa')
		.replace(/[^a-z0-9]+/g, '_')
		.replace(/^_|_$/g, '')
		.slice(0, 80);
}

function toNumber(v: unknown): number {
	if (typeof v === 'number') return v;
	const s = String(v ?? '').trim().replace(',', '.').replace(/[^\d.\-]/g, '');
	const n = parseFloat(s);
	return Number.isFinite(n) ? n : 0;
}

interface KolonneIdx {
	id: number;
	navnDk: number;
	gruppe: number;
	protein: number;
	fiber: number;
}

function findKolonner(headers: string[]): KolonneIdx | null {
	const lower = headers.map((h) => String(h ?? '').toLowerCase().trim());

	function find(...kandidater: string[]): number {
		for (const k of kandidater) {
			const idx = lower.findIndex((h) => h === k.toLowerCase() || h.includes(k.toLowerCase()));
			if (idx >= 0) return idx;
		}
		return -1;
	}

	const idIdx = find('foodid', 'id', 'tagnavn', 'tagnr');
	const navnIdx = find('fødevarenavn', 'foedevarenavn', 'name', 'navn');
	const gruppeIdx = find('foodgroup', 'fødevaregruppe', 'foedevaregruppe', 'gruppe');
	const proteinIdx = find('protein, total', 'protein');
	const fiberIdx = find('kostfibre', 'fibre', 'fiber');

	if (navnIdx === -1 || proteinIdx === -1 || fiberIdx === -1) return null;
	return {
		id: idIdx,
		navnDk: navnIdx,
		gruppe: gruppeIdx,
		protein: proteinIdx,
		fiber: fiberIdx
	};
}

// ==============================================
// Læs filen
// ==============================================

interface ParsetRekke {
	id: string;
	name: string;
	cat: string;
	p: number;
	f: number;
}

function laesFil(): ParsetRekke[] {
	const sti = existsSync(FRIDA_PATH_XLSX) ? FRIDA_PATH_XLSX : FRIDA_PATH_CSV;
	console.log(`📂 Læser ${sti}...`);
	const wb = xlsx.readFile(sti);
	const sheetName = wb.SheetNames[0];
	const sheet = wb.Sheets[sheetName];
	const rows = xlsx.utils.sheet_to_json<Array<unknown>>(sheet, { header: 1, raw: false });

	if (rows.length === 0) {
		console.error('❌ Filen er tom.');
		process.exit(1);
	}

	// Find header-rækken — kan være første eller anden række afhængigt af format
	let headerIdx = -1;
	let kolonner: KolonneIdx | null = null;
	for (let i = 0; i < Math.min(5, rows.length); i++) {
		const k = findKolonner(rows[i].map(String));
		if (k) {
			headerIdx = i;
			kolonner = k;
			break;
		}
	}
	if (!kolonner) {
		console.error('❌ Kunne ikke finde header-række med kolonnerne FoodID, Navn, Protein og Fiber.');
		console.error('   Første 3 rækker:');
		rows.slice(0, 3).forEach((r, i) => console.error(`   ${i}:`, r.slice(0, 6)));
		process.exit(1);
	}
	console.log(`   ✓ Header fundet på række ${headerIdx + 1}`);

	const dataRows = rows.slice(headerIdx + 1);
	const ud: ParsetRekke[] = [];
	for (const r of dataRows) {
		const navn = String(r[kolonner.navnDk] ?? '').trim();
		if (!navn) continue;
		const protein = toNumber(r[kolonner.protein]);
		const fiber = toNumber(r[kolonner.fiber]);
		const gruppe = kolonner.gruppe >= 0 ? String(r[kolonner.gruppe] ?? '') : '';
		const raId = kolonner.id >= 0 ? String(r[kolonner.id] ?? '').trim() : '';
		const id = `frida_${raId || slugify(navn)}`;
		ud.push({
			id,
			name: navn,
			cat: mapFoodgroup(gruppe),
			p: protein,
			f: fiber
		});
	}
	return ud;
}

// ==============================================
// Skriv til Firestore
// ==============================================

async function main() {
	const items = laesFil();
	console.log(`\n📋 Parsede ${items.length} fødevarer fra Frida${dryRun ? ' (DRY-RUN)' : ''}`);

	const eksempel = items.slice(0, 5);
	for (const f of eksempel) {
		console.log(`   ${f.name}  [${f.cat}]  ${f.p}g protein · ${f.f}g fiber  → id=${f.id}`);
	}
	console.log(`   ... og ${items.length - eksempel.length} mere`);

	if (dryRun) {
		console.log('\n✅ Dry-run færdig. Kør uden --dry for at skrive til Firestore.');
		process.exit(0);
	}

	const batchSize = 400;
	let skrevet = 0;
	for (let start = 0; start < items.length; start += batchSize) {
		const batch = db.batch();
		const chunk = items.slice(start, start + batchSize);
		for (const f of chunk) {
			const ref = db.collection('fodevarer').doc(f.id);
			batch.set(ref, {
				name: f.name,
				cat: f.cat,
				p: f.p,
				f: f.f,
				kilde: 'frida'
			});
		}
		await batch.commit();
		skrevet += chunk.length;
		console.log(`   ✓ Batch ${start}-${start + chunk.length - 1}`);
	}
	console.log(`\n✅ Seedet ${skrevet} Frida-fødevarer.`);
}

main().then(() => process.exit(0));
