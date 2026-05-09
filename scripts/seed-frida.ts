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
import * as XLSXMod from 'xlsx';
const XLSX = (XLSXMod as { default?: typeof XLSXMod }).default ?? XLSXMod;

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

// Heuristik der gætter kategori ud fra fødevare-navnet, da Frida ikke
// har direkte foodgroup-kolonne på Data_Table-arket. Linn kan rette
// kategorier manuelt via admin-UI senere hvis det bliver relevant.
function gaetKategori(navn: string): string {
	const n = navn.toLowerCase();
	// Mejeri & æg — "mælk" matches også som suffix (sødmælk, kærnemælk osv.)
	if (/mælk|skyr|yoghurt|ymer|kvark|kefir|hytteost|flødeost|smør|fløde|creme fraiche|cottage|mozzarella|feta|cheddar|brie|camembert|ricotta|parmesan|skinkeost|smelteost|ost\b|oste|æg\b|æggehvide|æggeblomme/.test(n)) return 'mejeri';
	if (/kylling|kalkun|svine|svin\b|okse|lamme?|lam\b|hak|frikadel|skinke|bacon|spegepølse|leverpost|pålæg|and(ebryst)?\b|ande|kalv|bøf|roastbeef|fars\b|rullepølse|medister|pølse|kotelet|hamburger|salami|chorizo|kebab|gris/.test(n)) return 'koed';
	if (/laks|torsk|sild|tun|makrel|rejer|krabbe|musling|fisk|skaldyr|sardin|ørred|kuller|ål\b|hellefisk|rødspætte|sej|stenbider|kaviar|rogn|krebs|hummer|blæksprutte/.test(n)) return 'fisk';
	if (/bønne|kikært|linser|sojabønner|edamame|tofu|tempeh|hummus|sojaprotein|sojamælk|havremælk|mandelmælk|risdrik/.test(n)) return 'baelg';
	if (/havre|rugbrød|rugmel|brød|knækbrød|ris\b|risen|pasta|couscous|bulgur|quinoa|byg\b|byggryn|hvede|fuldkorn|mel\b|gryn|müsli|cornflakes|cracker|kiks|kage|wienerbrød|boller|crispbread|tortilla|wrap|tarteletter/.test(n)) return 'korn';
	if (/grøntsag|salat|spinat|kål|broccoli|gulerod|tomat|agurk|peberfrugt|squash|aubergine|porre|løg|hvidløg|champignon|svamp|asparges|kartoffel|sødkartoffel|persille|krydderurt|rødbede|selleri|fennikel|majs|ært|bønnespirer|rucola|grønne bønner|knold|roe|pastinak|jordskok|radise/.test(n)) return 'gront';
	if (/æble|pære|banan|appelsin|jordbær|hindbær|blåbær|solbær|brombær|melon|drue|fersken|mango|kiwi|ananas|granat|fig|abrikos|blomme|kirsebær|tranebær|rabarber|stikkelsbær|nektarin|citron|lime|grapefrugt|svesker|rosin|dadler|tørrede|frugt\b|bær\b|frugt,/.test(n)) return 'baer';
	if (/mandl|valnød|hasselnød|cashew|peanut|jordnød|pistacie|paranød|pinjekerne|sesamfrø|chiafrø|hørfrø|græskarkerne|solsikkekerne|nødde|nødder|kerne|frø\b|frø,|popcorn/.test(n)) return 'noedder';
	if (/proteinpulver|proteinbar|protein,|protein-/.test(n)) return 'prot';
	if (/vand\b|kaffe|the\b|te\b|saft|juice|smoothie|sodavand|øl\b|vin\b|spiritus|cider|drik|cola|læskedrik/.test(n)) return 'drikke';
	return 'andet';
}

/**
 * Find næringsdata-kolonner i Data_Table-arket.
 * Header-rækken er på række 0 (dansk parameter-navn).
 * protein og fiber er obligatoriske, resten er optional (null hvis ikke fundet).
 */
function findKolonner(headerRow: unknown[]): {
	protein: number;
	fiber: number;
	kh: number;
	fedt: number;
	kcal: number;
} | null {
	const cells = headerRow.map((c) => String(c ?? '').toLowerCase().trim());
	let protein = -1;
	let fiber = -1;
	let kh = -1;
	let fedt = -1;
	let kcal = -1;
	for (let i = 0; i < cells.length; i++) {
		const c = cells[i];
		if (protein === -1 && c === 'protein') protein = i;
		if (fiber === -1 && (c === 'kostfibre' || c === 'fibre, kost' || c === 'kostfiber')) fiber = i;
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
	if (protein === -1 || fiber === -1) return null;
	return { protein, fiber, kh, fedt, kcal };
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
	kh: number;
	fedt: number;
	kcal: number;
}

function laesFil(): ParsetRekke[] {
	const sti = existsSync(FRIDA_PATH_XLSX) ? FRIDA_PATH_XLSX : FRIDA_PATH_CSV;
	console.log(`📂 Læser ${sti}...`);
	const wb = XLSX.readFile(sti);

	const sheetName = wb.SheetNames.find((n) => n === 'Data_Table');
	if (!sheetName) {
		console.error(`❌ Mangler arket "Data_Table". Fundne ark: ${wb.SheetNames.join(', ')}`);
		process.exit(1);
	}
	const sheet = wb.Sheets[sheetName];
	const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, raw: false });

	if (rows.length < 5) {
		console.error('❌ Data_Table-arket har for få rækker.');
		process.exit(1);
	}

	// Frida's Data_Table er pivot-format:
	//   Række 0: dansk parameter-navn (Energi, Protein, ...)
	//   Række 1: engelsk parameter-navn
	//   Række 2: enhed (g/100g)
	//   Række 3: '↓FødevareNavn | ↓FoodName | ↓FoodID/→ParameterID | <ParameterID>...'
	//   Række 4+: data — kolonne 0 = navn (dk), 1 = navn (en), 2 = FoodID, 3+ = værdier
	const headerRow = rows[0];
	const kolonner = findKolonner(headerRow);
	if (!kolonner) {
		console.error('❌ Kunne ikke finde "Protein" og "Kostfibre"-kolonner i Data_Table række 0.');
		console.error('   Første 30 kolonner:', headerRow.slice(0, 30));
		process.exit(1);
	}
	console.log(
		`   ✓ Protein: ${kolonner.protein}, Fiber: ${kolonner.fiber}, Kulhydrat: ${kolonner.kh}, Fedt: ${kolonner.fedt}, Kcal: ${kolonner.kcal}`
	);

	const dataRows = rows.slice(4);
	const ud: ParsetRekke[] = [];
	let oversprunget = 0;
	for (const r of dataRows) {
		const navn = String(r[0] ?? '').trim();
		if (!navn) {
			oversprunget++;
			continue;
		}
		const foodId = String(r[2] ?? '').trim();
		const protein = toNumber(r[kolonner.protein]);
		const fiber = toNumber(r[kolonner.fiber]);
		const kh = kolonner.kh >= 0 ? toNumber(r[kolonner.kh]) : 0;
		const fedt = kolonner.fedt >= 0 ? toNumber(r[kolonner.fedt]) : 0;
		const kcal = kolonner.kcal >= 0 ? toNumber(r[kolonner.kcal]) : 0;
		const id = `frida_${foodId || slugify(navn)}`;
		ud.push({
			id,
			name: navn,
			cat: gaetKategori(navn),
			p: protein,
			f: fiber,
			kh,
			fedt,
			kcal
		});
	}
	if (oversprunget > 0) console.log(`   ℹ️  Sprang ${oversprunget} tomme rækker over`);
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

	const fordeling: Record<string, number> = {};
	for (const f of items) {
		fordeling[f.cat] = (fordeling[f.cat] ?? 0) + 1;
	}
	console.log(`\n📊 Kategori-fordeling:`);
	for (const [cat, antal] of Object.entries(fordeling).sort((a, b) => b[1] - a[1])) {
		console.log(`   ${cat.padEnd(10)} ${antal}`);
	}

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
			batch.set(
				ref,
				{
					name: f.name,
					cat: f.cat,
					p: f.p,
					f: f.f,
					kh: f.kh,
					fedt: f.fedt,
					kcal: f.kcal,
					kilde: 'frida'
				},
				{ merge: true }
			);
		}
		await batch.commit();
		skrevet += chunk.length;
		console.log(`   ✓ Batch ${start}-${start + chunk.length - 1}`);
	}
	console.log(`\n✅ Seedet ${skrevet} Frida-fødevarer.`);
}

main().then(() => process.exit(0));
