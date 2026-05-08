// Hurtig inspect af Frida-filen for at finde hvor data ligger.
import * as XLSXMod from 'xlsx';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const XLSX = (XLSXMod as { default?: typeof XLSXMod }).default ?? XLSXMod;

const __dirname = dirname(fileURLToPath(import.meta.url));
const wb = XLSX.readFile(join(__dirname, 'frida.xlsx'));

console.log(`Workbook har ${wb.SheetNames.length} ark:`);
for (const name of wb.SheetNames) {
	const sheet = wb.Sheets[name];
	const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, raw: false });
	console.log(`\n══ Ark: "${name}"  (${rows.length} rækker) ══`);
	for (let i = 0; i < Math.min(10, rows.length); i++) {
		const cells = (rows[i] as unknown[]).slice(0, 6).map((c) => {
			const s = String(c ?? '');
			return s.length > 40 ? s.slice(0, 40) + '...' : s;
		});
		console.log(`  ${i}: [${cells.join(' | ')}]`);
	}
}
