// Verificerer at estimater-opskrifter-mangder.json dækker alle
// ingredienser uden mængde i CSV'en. Rapporterer:
//   - Opskrifter der mangler helt i JSON
//   - Ingredienser i CSV der ikke har en estimat-post
//   - Ekstra keys i JSON der ikke findes i CSV (potentiel tastefejl)
//   - Ukendte enheder i estimater

import { readFileSync } from 'fs';

const CSV_PATH = '/Users/linnabildtrup/Projekter/linns-academy-app/opskrifter-30-30-3.csv';
const JSON_PATH = '/Users/linnabildtrup/Projekter/linns-academy-app/estimater-opskrifter-mangder.json';

const KENDTE_ENHEDER = new Set(['g', 'kg', 'ml', 'dl', 'spsk', 'tsk', 'stk', 'skive']);
const BROEK = new Set(['½', '¼', '¾', '⅓', '⅔', '⅛']);

function harMaengde(raw: string): boolean {
	const t = raw.trim();
	if (t.match(/^\d+(?:[,.]\d+)?\s*(g|kg|ml|dl|l)\b/i)) return true;
	const first = t.split(/\s+/)[0];
	if (BROEK.has(first)) return true;
	if (first.match(/^\d+([½¼¾⅓⅔⅛])?$/)) return true;
	return false;
}

type CsvOpskrift = { titel: string; mangler: string[] };

function parseCsv(): CsvOpskrift[] {
	const tekst = readFileSync(CSV_PATH, 'utf-8').replace(/\r/g, '');
	const linjer = tekst.split('\n').filter((l) => l.trim().length > 0);
	const ud: CsvOpskrift[] = [];
	for (let i = 1; i < linjer.length; i++) {
		const c = linjer[i].split(';');
		if (c.length !== 11) continue;
		const hoved = c[4]
			.split(',')
			.map((s) => s.trim())
			.filter((s) => s.length > 0);
		const mangler = hoved.filter((h) => !harMaengde(h));
		ud.push({ titel: c[1].trim(), mangler });
	}
	return ud;
}

const csv = parseCsv();
const estimater = JSON.parse(readFileSync(JSON_PATH, 'utf-8')) as Record<
	string,
	Record<string, { maengde: number; enhed: string }>
>;

let fejlAntal = 0;

// 1) Opskrifter der mangler helt
const csvTitler = new Set(csv.map((o) => o.titel));
const jsonTitler = new Set(Object.keys(estimater));
for (const t of csvTitler) {
	if (!jsonTitler.has(t)) {
		console.log(`❌ MANGLER i JSON: "${t}"`);
		fejlAntal++;
	}
}

// 2) Ekstra keys i JSON
for (const t of jsonTitler) {
	if (!csvTitler.has(t)) {
		console.log(`⚠️ EKSTRA i JSON (ikke i CSV): "${t}"`);
		fejlAntal++;
	}
}

// 3) Pr opskrift: ingrediens-coverage
for (const o of csv) {
	if (o.mangler.length === 0) continue;
	const est = estimater[o.titel];
	if (!est) continue;
	for (const ing of o.mangler) {
		if (!(ing in est)) {
			console.log(`❌ "${o.titel}": ingrediens "${ing}" mangler i estimater`);
			fejlAntal++;
		}
	}
	// Ekstra estimat-keys der ikke matcher CSV
	for (const k of Object.keys(est)) {
		if (!o.mangler.includes(k)) {
			console.log(`⚠️ "${o.titel}": estimat-key "${k}" findes ikke i CSV-ingredienser`);
			fejlAntal++;
		}
	}
}

// 4) Ukendte enheder
for (const [titel, ings] of Object.entries(estimater)) {
	for (const [navn, v] of Object.entries(ings)) {
		if (!KENDTE_ENHEDER.has(v.enhed)) {
			console.log(`❌ "${titel}" / "${navn}": ukendt enhed "${v.enhed}"`);
			fejlAntal++;
		}
		if (!Number.isFinite(v.maengde) || v.maengde < 0) {
			console.log(`❌ "${titel}" / "${navn}": ugyldig mængde ${v.maengde}`);
			fejlAntal++;
		}
	}
}

// Stats
let csvIngTotal = 0;
let jsonIngTotal = 0;
for (const o of csv) csvIngTotal += o.mangler.length;
for (const ings of Object.values(estimater)) jsonIngTotal += Object.keys(ings).length;

console.log(`\n📊 STATS:`);
console.log(`   CSV: ${csv.length} opskrifter, ${csvIngTotal} ingredienser uden mængde`);
console.log(`   JSON: ${Object.keys(estimater).length} opskrifter, ${jsonIngTotal} estimater`);

if (fejlAntal === 0) {
	console.log(`\n✅ Ingen fejl. Estimater dækker CSV'en præcis.`);
} else {
	console.log(`\n❌ ${fejlAntal} fejl/advarsler fundet.`);
}
