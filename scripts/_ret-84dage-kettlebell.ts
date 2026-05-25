// To rettelser til 84dage_kettlebell.csv:
// 1. Ankelstraek → Ankelstraek (V) + Ankelstraek (H) paa mobilitetsdage
// 2. Floor press med kettlebell (V)+(H) → én samlet Floor press med kettlebell
//    (Linn afklarede at den udføres med begge haender)

import { readFileSync, writeFileSync } from 'fs';

const CSV_PATH = '/Users/linnabildtrup/Projekter/linns-academy-app/84dage_kettlebell.csv';

function formatTid(sek: number): string {
	const min = Math.floor(sek / 60);
	const rest = sek % 60;
	if (rest === 0) return `${min} min`;
	return `${min} min ${rest} sek`;
}

function regnTider(felter: string[]): { effektiv: number; total: number } {
	let effektiv = 0;
	let total = 0;
	for (let pos = 4; pos + 2 < felter.length - 3; pos += 3) {
		const navn = (felter[pos] ?? '').trim();
		if (!navn) continue;
		const arb = parseInt(felter[pos + 1] ?? '0', 10) || 0;
		const pause = parseInt(felter[pos + 2] ?? '0', 10) || 0;
		effektiv += arb;
		total += arb + pause;
	}
	return { effektiv, total };
}

const tekst = readFileSync(CSV_PATH, 'utf-8');
const linjer = tekst.split('\n');
const header = linjer[0];
const totalKol = header.split(',').length;

const nyeLinjer: string[] = [header];
let opdaterede = 0;

for (let i = 1; i < linjer.length; i++) {
	const linje = linjer[i];
	if (!linje.trim()) {
		nyeLinjer.push(linje);
		continue;
	}
	let f = linje.split(',');
	let aendret = false;

	// 1. Ankelstraek-split
	for (let pos = 4; pos + 2 < f.length - 3; pos += 3) {
		const navn = (f[pos] ?? '').trim();
		if (navn.toLowerCase() === 'ankelstræk') {
			f[pos] = 'Ankelstræk (V)';
			f[pos + 1] = '30';
			f[pos + 2] = '5';
			if (pos + 5 < f.length - 3) {
				f[pos + 3] = 'Ankelstræk (H)';
				f[pos + 4] = '30';
				f[pos + 5] = '0';
			}
			aendret = true;
			break;
		}
	}

	// 2. Floor press med kettlebell (V)+(H) → én samlet
	for (let pos = 4; pos + 5 < f.length - 3; pos += 3) {
		const a = (f[pos] ?? '').trim();
		const b = (f[pos + 3] ?? '').trim();
		if (
			a.toLowerCase() === 'floor press med kettlebell (v)' &&
			b.toLowerCase() === 'floor press med kettlebell (h)'
		) {
			// Slot pos: Floor press med kettlebell, 45, 15
			f[pos] = 'Floor press med kettlebell';
			f[pos + 1] = '45';
			f[pos + 2] = '15';
			// Slot pos+3..pos+5: skift alt efter en plads til venstre
			for (let j = pos + 3; j + 3 < f.length - 3; j += 3) {
				f[j] = f[j + 3] ?? '';
				f[j + 1] = f[j + 4] ?? '';
				f[j + 2] = f[j + 5] ?? '';
			}
			// Sidste slot bliver tomt
			const sidstePos = f.length - 6;
			f[sidstePos] = '';
			f[sidstePos + 1] = '';
			f[sidstePos + 2] = '';
			aendret = true;
			break;
		}
	}

	if (aendret) {
		const { effektiv, total } = regnTider(f);
		f[totalKol - 2] = formatTid(effektiv);
		f[totalKol - 1] = formatTid(total);
		opdaterede++;
		console.log(`Dag ${f[0]}: opdateret (effektiv ${formatTid(effektiv)}, total ${formatTid(total)})`);
	}
	nyeLinjer.push(f.join(','));
}

writeFileSync(CSV_PATH, nyeLinjer.join('\n'), 'utf-8');
console.log(`\nFaerdig — ${opdaterede} dage opdateret`);
