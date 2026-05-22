// Dumper hver opskrift med fuldt sammenflettet ingrediens-liste (CSV's
// angivne mængder + estimater for de manglende) plus de erklærede
// næringstal — så man kan vurdere om mængderne er fornuftige som helhed.

import { readFileSync, writeFileSync } from 'fs';

const CSV_PATH = '/Users/linnabildtrup/Projekter/linns-academy-app/opskrifter-30-30-3.csv';
const JSON_PATH = '/Users/linnabildtrup/Projekter/linns-academy-app/estimater-opskrifter-mangder.json';
const UD_PATH = '/Users/linnabildtrup/Projekter/linns-academy-app/_flettet-opskrifter.txt';

const KENDTE = new Set(['g', 'kg', 'ml', 'dl', 'l', 'spsk', 'tsk', 'stk', 'skive', 'skiver']);
const BROEK: Record<string, number> = {
	'½': 0.5, '¼': 0.25, '¾': 0.75, '⅓': 0.333, '⅔': 0.667, '⅛': 0.125
};

type Ing = { navn: string; maengde: number; enhed: string; kilde: 'CSV' | 'EST' };

function parseMaengde(s: string): number | null {
	const t = s.trim();
	if (t in BROEK) return BROEK[t];
	const blandet = t.match(/^(\d+)([½¼¾⅓⅔⅛])$/);
	if (blandet) return parseInt(blandet[1], 10) + BROEK[blandet[2]];
	const n = parseFloat(t.replace(',', '.'));
	return Number.isFinite(n) ? n : null;
}

function parseIng(raw: string): { maengde: number; enhed: string; navn: string } | null {
	const t = raw.trim();
	const klistret = t.match(/^(\d+(?:[,.]\d+)?)\s*(g|kg|ml|dl|l)\b\s*(.+)$/i);
	if (klistret) {
		return {
			navn: klistret[3].trim(),
			maengde: parseFloat(klistret[1].replace(',', '.')),
			enhed: klistret[2].toLowerCase()
		};
	}
	const tokens = t.split(/\s+/);
	const m = parseMaengde(tokens[0]);
	if (m !== null) {
		if (tokens.length >= 2 && KENDTE.has(tokens[1].toLowerCase())) {
			return { navn: tokens.slice(2).join(' '), maengde: m, enhed: tokens[1].toLowerCase() };
		}
		return { navn: tokens.slice(1).join(' '), maengde: m, enhed: 'stk' };
	}
	return null; // ingen mængde i CSV
}

const csvTekst = readFileSync(CSV_PATH, 'utf-8').replace(/\r/g, '');
const linjer = csvTekst.split('\n').filter((l) => l.trim().length > 0);
const estimater = JSON.parse(readFileSync(JSON_PATH, 'utf-8')) as Record<
	string,
	Record<string, { maengde: number; enhed: string }>
>;

const lines: string[] = [];
for (let i = 1; i < linjer.length; i++) {
	const c = linjer[i].split(';');
	if (c.length !== 11) continue;
	const kategori = c[0].trim();
	const titel = c[1].trim();
	const inspireret = c[3].trim();
	const hoved = c[4].split(',').map((s) => s.trim()).filter((s) => s.length > 0);
	const protein = parseFloat(c[5]) || 0;
	const fiber = parseFloat(c[6]) || 0;
	const kcal = parseFloat(c[7]) || 0;
	const tid = parseFloat(c[8]) || 0;

	const ings: Ing[] = [];
	const est = estimater[titel] || {};
	for (const raw of hoved) {
		const p = parseIng(raw);
		if (p) {
			ings.push({ ...p, kilde: 'CSV' });
		} else {
			const e = est[raw];
			if (e) {
				ings.push({ navn: raw, maengde: e.maengde, enhed: e.enhed, kilde: 'EST' });
			} else {
				ings.push({ navn: raw, maengde: 0, enhed: 'stk', kilde: 'EST' });
			}
		}
	}

	lines.push(`\n========================================`);
	lines.push(`[${i}] ${kategori} — ${titel}`);
	lines.push(`Inspireret af: ${inspireret} | Tid: ${tid} min`);
	lines.push(`Erklæret: ${protein}g protein | ${fiber}g fiber | ${kcal} kcal (pr 1 portion)`);
	lines.push(`Ingredienser:`);
	for (const ing of ings) {
		const marker = ing.kilde === 'EST' ? '  [est]' : '       ';
		lines.push(`${marker}  ${ing.maengde} ${ing.enhed.padEnd(5)} ${ing.navn}`);
	}
}

writeFileSync(UD_PATH, lines.join('\n'), 'utf-8');
console.log(`Skrev ${UD_PATH}`);
