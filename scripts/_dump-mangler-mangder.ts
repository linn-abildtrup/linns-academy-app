// Engangs-script: dumper alle ingredienser uden angivet mængde fra CSV'en,
// grupperet pr opskrift. Bruges som input til at estimere mængder.
import { readFileSync } from 'fs';

const CSV_PATH = '/Users/linnabildtrup/Projekter/linns-academy-app/opskrifter-30-30-3.csv';
const BROEK = new Set(['½', '¼', '¾', '⅓', '⅔', '⅛']);

function harMaengde(raw: string): boolean {
	const t = raw.trim();
	if (t.match(/^\d+(?:[,.]\d+)?\s*(g|kg|ml|dl|l)\b/i)) return true;
	const first = t.split(/\s+/)[0];
	if (BROEK.has(first)) return true;
	if (first.match(/^\d+([½¼¾⅓⅔⅛])?$/)) return true;
	return false;
}

const tekst = readFileSync(CSV_PATH, 'utf-8').replace(/\r/g, '');
const linjer = tekst.split('\n').filter((l) => l.trim().length > 0);
const ud: { titel: string; kategori: string; mangler: string[] }[] = [];
for (let i = 1; i < linjer.length; i++) {
	const c = linjer[i].split(';');
	if (c.length !== 11) continue;
	const hoved = c[4]
		.split(',')
		.map((s) => s.trim())
		.filter((s) => s.length > 0);
	const mangler = hoved.filter((h) => !harMaengde(h));
	ud.push({ titel: c[1].trim(), kategori: c[0].trim().toLowerCase(), mangler });
}
console.log(JSON.stringify(ud, null, 2));
