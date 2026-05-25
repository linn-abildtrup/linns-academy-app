// Erstatter 'Ankelstraek' i 84dage_kropsvaegt.csv med to slots:
// 'Ankelstraek (V)' 30 sek + 5 sek pause + 'Ankelstraek (H)' 30 sek 0 pause.
// Justerer ogsaa effektiv-tid og total-tid kolonnerne pr dag.
// Skriver tilbage til CSV-filen.

import { readFileSync, writeFileSync } from 'fs';

const CSV_PATH = '/Users/linnabildtrup/Projekter/linns-academy-app/84dage_kropsvægt.csv';

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
const headerFelter = header.split(',');
const totalKol = headerFelter.length;

const nyeLinjer: string[] = [header];
let opdaterede = 0;

for (let i = 1; i < linjer.length; i++) {
	const linje = linjer[i];
	if (!linje.trim()) {
		nyeLinjer.push(linje);
		continue;
	}
	const f = linje.split(',');
	// Find Ankelstraek-slot
	let aktuel = i;
	let aendret = false;
	for (let pos = 4; pos + 2 < f.length - 3; pos += 3) {
		const navn = (f[pos] ?? '').trim();
		if (navn.toLowerCase() === 'ankelstræk') {
			// Erstat med to slots: V og H
			// Slot pos: Ankelstraek (V), 30, 5
			// Slot pos+3: Ankelstraek (H), 30, 0
			f[pos] = 'Ankelstræk (V)';
			f[pos + 1] = '30';
			f[pos + 2] = '5';
			// Indsaet H-slot lige efter
			if (pos + 5 < f.length - 3) {
				// Naeste slot er tomt — udfyld det
				f[pos + 3] = 'Ankelstræk (H)';
				f[pos + 4] = '30';
				f[pos + 5] = '0';
			}
			aendret = true;
			break;
		}
	}
	if (aendret) {
		// Genberegn tider
		const { effektiv, total } = regnTider(f);
		// Sidste to kolonner: effektiv-tid + total-tid
		f[totalKol - 2] = formatTid(effektiv);
		f[totalKol - 1] = formatTid(total);
		opdaterede++;
		console.log(`Dag ${f[0]}: opdateret (effektiv ${formatTid(effektiv)}, total ${formatTid(total)})`);
	}
	nyeLinjer.push(f.join(','));
}

writeFileSync(CSV_PATH, nyeLinjer.join('\n'), 'utf-8');
console.log(`\nFaerdig — ${opdaterede} dage opdateret`);
