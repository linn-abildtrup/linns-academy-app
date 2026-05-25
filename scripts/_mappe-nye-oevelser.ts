// Mapper CSV-oevelser til faktiske video-filer i 'Ny oevelser'-mappen.
// Printer en oversigt der viser hvilke videoer der findes pr CSV-raekke
// og om en oevelse har left/right-varianter.

import { readFileSync, readdirSync, writeFileSync } from 'fs';
import { join } from 'path';

const ROOT = '/Users/linnabildtrup/Projekter/linns-academy-app/videos-to-upload/Ny øvelser';
const CSV_PATH = join(ROOT, 'oevelser_linns_academy.csv');

interface CsvRow {
	navn: string;
	kategori: string;
	status: string;
	beskrivelse: string;
	trin: string[];
}

function parseCsv(tekst: string): CsvRow[] {
	// Simpel CSV-parser der haandterer kvoterede felter med komma
	const linjer: string[] = [];
	let aktuel = '';
	let iKvote = false;
	for (const c of tekst) {
		if (c === '"') iKvote = !iKvote;
		if (c === '\n' && !iKvote) {
			linjer.push(aktuel);
			aktuel = '';
		} else {
			aktuel += c;
		}
	}
	if (aktuel) linjer.push(aktuel);

	const rows: CsvRow[] = [];
	for (let i = 1; i < linjer.length; i++) {
		const linje = linjer[i];
		if (!linje.trim()) continue;
		const felter: string[] = [];
		let f = '';
		let kvote = false;
		for (const c of linje) {
			if (c === '"') {
				kvote = !kvote;
				continue;
			}
			if (c === ',' && !kvote) {
				felter.push(f);
				f = '';
			} else {
				f += c;
			}
		}
		felter.push(f);
		if (felter.length < 3) continue;
		rows.push({
			navn: felter[0].trim(),
			kategori: felter[1].trim(),
			status: felter[2].trim(),
			beskrivelse: (felter[3] ?? '').trim(),
			trin: felter.slice(4, 10).map((t) => t.trim()).filter((t) => t.length > 0)
		});
	}
	return rows;
}

function normaliser(s: string): string {
	return s
		.toLowerCase()
		.replace(/æ/g, 'ae')
		.replace(/ø/g, 'oe')
		.replace(/å/g, 'aa')
		.replace(/[^a-z0-9]+/g, '_')
		.replace(/^_|_$/g, '');
}

const STOP_ORD = new Set(['med', 'paa', 'og', 'der', 'i', 'til', 'en', 'et', 'de', 'den', 'det']);
// Ord der naar de er i FILNAVN men IKKE i CSV-oevelse betyder filen er en
// variant CSV-oevelsen ikke daekker (fx kettlebell-variant af en uden-vaegt-oevelse)
const VARIANT_ORD = ['kettlebell'];
// Side-suffixer der bare angiver hojre/venstre variant — de toelles ikke som
// nye varianter, bare som side-cuts.
const SIDE_SUFFIXER = ['left', 'right', 'venstre', 'hoejre'];

function find_videos(oevelsesnavn: string, alleFiler: string[]): string[] {
	const norm = normaliser(oevelsesnavn);
	const keywords = norm.split('_').filter((k) => k.length > 1 && !STOP_ORD.has(k));
	if (keywords.length === 0) return [];
	const csvOrd = new Set(keywords);
	const matchede: string[] = [];
	for (const fil of alleFiler) {
		const filNorm = fil.toLowerCase().replace('.mp4', '');
		const filOrd = filNorm.split('_');
		const matcher = keywords.every((k) => filNorm.includes(k));
		if (!matcher) continue;
		// Variant-tjek: hvis filen har et variant-ord som CSV'en ikke har, skip
		const filHarUmatchedVariant = VARIANT_ORD.some(
			(v) => filOrd.includes(v) && !csvOrd.has(v)
		);
		if (filHarUmatchedVariant) continue;
		matchede.push(fil);
	}
	// Hvis intet matcher, proev fuzzy (mindst halvdelen af keywords)
	if (matchede.length === 0 && keywords.length >= 2) {
		const trskl = Math.ceil(keywords.length / 2);
		for (const fil of alleFiler) {
			const filNorm = fil.toLowerCase().replace('.mp4', '');
			const hits = keywords.filter((k) => filNorm.includes(k)).length;
			if (hits >= trskl) matchede.push(fil);
		}
	}
	return matchede.sort();
}

function harSideVarianter(filer: string[]): boolean {
	if (filer.length !== 2) return false;
	const norm = filer.map((f) => f.toLowerCase().replace('.mp4', '').split('_'));
	return SIDE_SUFFIXER.some(
		(s) => norm.some((o) => o.includes(s)) && norm.some((o) => !o.includes(s))
	)
		|| filer.some((f) => /_(left|right|venstre|hoejre)\.mp4$/i.test(f));
}

const csvTekst = readFileSync(CSV_PATH, 'utf-8');
const rows = parseCsv(csvTekst);
const alleFiler = readdirSync(ROOT).filter((f) => f.endsWith('.mp4'));

const nyRows = rows.filter((r) => r.status === 'Ny');
console.log(`CSV: ${rows.length} oevelser ialt (${nyRows.length} 'Ny')`);
console.log(`Videofiler: ${alleFiler.length}`);
console.log('');

console.log('## MAPPING (Status=Ny)\n');
const brugteFiler = new Set<string>();
const ikkeFundne: string[] = [];
for (const r of nyRows) {
	const matchede = find_videos(r.navn, alleFiler);
	for (const m of matchede) brugteFiler.add(m);
	if (matchede.length === 0) {
		ikkeFundne.push(r.navn);
		console.log(`[${r.kategori}] ${r.navn}`);
		console.log(`  ⚠ INGEN VIDEO FUNDET`);
	} else if (matchede.length === 1) {
		console.log(`[${r.kategori}] ${r.navn}`);
		console.log(`  → ${matchede[0]}`);
	} else {
		console.log(`[${r.kategori}] ${r.navn} (har ${matchede.length} videoer):`);
		for (const m of matchede) console.log(`  → ${m}`);
	}
}

const ubrugteFiler = alleFiler.filter((f) => !brugteFiler.has(f));
if (ubrugteFiler.length > 0) {
	console.log('\n## VIDEO-FILER UDEN MATCH I CSV');
	for (const f of ubrugteFiler) console.log(`  ${f}`);
}

if (ikkeFundne.length > 0) {
	console.log('\n## CSV-OEVELSER UDEN MATCHENDE VIDEO');
	for (const n of ikkeFundne) console.log(`  ${n}`);
}

// Skriv mapping-CSV ud — én raekke pr planlagt Exercise-doc.
// Side-varianter (left+right) splittes i to raekker hver, saa kalderen
// kan se den endelige liste af Exercise-doks der skal oprettes.
const SIDE_LABEL: Record<string, string> = {
	left: 'venstre',
	right: 'hoejre',
	venstre: 'venstre',
	hoejre: 'hoejre'
};
function detekterSide(filNavn: string): 'left' | 'right' | null {
	const u = filNavn.toLowerCase().replace('.mp4', '');
	if (/_left$|_left_/.test(u) || /_venstre$|_venstre_/.test(u)) return 'left';
	if (/_right$|_right_/.test(u) || /_hoejre$|_hoejre_/.test(u)) return 'right';
	return null;
}

const outRaekker: string[] = ['Exercise id,Navn,Kategori,Video fil,Status,Kort beskrivelse,Trin 1,Trin 2,Trin 3,Trin 4,Trin 5,Trin 6'];
function escCsv(s: string): string {
	if (!s) return '';
	if (s.includes(',') || s.includes('"') || s.includes('\n')) return `"${s.replace(/"/g, '""')}"`;
	return s;
}

for (const r of nyRows) {
	const filer = find_videos(r.navn, alleFiler);
	if (filer.length === 0) {
		outRaekker.push([
			'',
			escCsv(r.navn),
			escCsv(r.kategori),
			'(ingen)',
			r.status,
			escCsv(r.beskrivelse),
			...r.trin.map(escCsv)
		].join(','));
		continue;
	}
	for (const fil of filer) {
		const side = detekterSide(fil);
		const sideLabel = side ? SIDE_LABEL[side] : null;
		const idBase = fil.replace('.mp4', '');
		const navn = sideLabel ? `${r.navn} (${sideLabel})` : r.navn;
		outRaekker.push([
			idBase,
			escCsv(navn),
			escCsv(r.kategori),
			fil,
			r.status,
			escCsv(r.beskrivelse),
			...r.trin.map(escCsv)
		].join(','));
	}
}

const outSti = join(ROOT, 'mapping-resultat.csv');
writeFileSync(outSti, outRaekker.join('\n'), 'utf-8');
console.log(`\n## SKREVET: ${outSti} (${outRaekker.length - 1} Exercise-doks i alt)`);
