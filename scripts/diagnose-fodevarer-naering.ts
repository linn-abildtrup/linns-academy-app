// Diagnose: hvilke fødevarer mangler kulhydrater, fedt eller kalorier?
//
// Læser alle fødevarer fra Firestore og grupperer dem efter:
//   - Kilde (frida / community / manual)
//   - Hvilke felter der mangler
//
// Brug det til at se hvad der skal beriges. Skriver kun til konsol —
// ændrer ikke data.
//
// Kør:
//   npx tsx scripts/diagnose-fodevarer-naering.ts
//   npx tsx scripts/diagnose-fodevarer-naering.ts --csv > mangler.csv

import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { findFodevareForIngrediens } from '../src/lib/content/kost.js';
import type { Fodevare as FodevareType } from '../src/lib/content/kost.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const serviceAccount = JSON.parse(
	readFileSync(join(__dirname, 'service-account-key.json'), 'utf-8')
);
initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore();

const csvMode = process.argv.includes('--csv');
const opskriftMode = process.argv.includes('--opskrifter');

interface Fodevare {
	id: string;
	navn?: string;
	name?: string; // findFodevareForIngrediens forventer 'name'
	kilde?: string;
	p?: number;
	f?: number;
	kh?: number;
	fedt?: number;
	kcal?: number;
}

interface Ingrediens {
	navn: string;
	maengde: number;
	enhed: string;
}

interface Opskrift {
	id: string;
	titel: string;
	ingredienser?: Ingrediens[];
}

async function diagnose() {
	const snap = await db.collection('fodevarer').get();
	const alle: Fodevare[] = snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Fodevare);

	if (csvMode) {
		console.log('id,navn,kilde,p,f,kh,fedt,kcal,mangler');
		for (const f of alle) {
			const mangler: string[] = [];
			if (f.kh === undefined || f.kh === null) mangler.push('kh');
			if (f.fedt === undefined || f.fedt === null) mangler.push('fedt');
			if (f.kcal === undefined || f.kcal === null) mangler.push('kcal');
			if (mangler.length === 0) continue;
			const navn = (f.navn ?? '').replace(/"/g, '""');
			console.log(
				`${f.id},"${navn}",${f.kilde ?? ''},${f.p ?? ''},${f.f ?? ''},${f.kh ?? ''},${f.fedt ?? ''},${f.kcal ?? ''},${mangler.join('|')}`
			);
		}
		return;
	}

	console.log(`\n=== Diagnose: fødevarer uden udvidet næring ===\n`);
	console.log(`Total fødevarer i databasen: ${alle.length}`);

	const grupper = new Map<string, Fodevare[]>();
	for (const f of alle) {
		const k = f.kilde ?? 'ukendt';
		if (!grupper.has(k)) grupper.set(k, []);
		grupper.get(k)!.push(f);
	}

	for (const [kilde, liste] of grupper) {
		const uden_kh = liste.filter((f) => f.kh === undefined || f.kh === null);
		const uden_fedt = liste.filter((f) => f.fedt === undefined || f.fedt === null);
		const uden_kcal = liste.filter((f) => f.kcal === undefined || f.kcal === null);
		const fuldt_komplet = liste.filter(
			(f) =>
				f.kh !== undefined &&
				f.kh !== null &&
				f.fedt !== undefined &&
				f.fedt !== null &&
				f.kcal !== undefined &&
				f.kcal !== null
		);
		console.log(`\n--- Kilde: ${kilde} (${liste.length} stk) ---`);
		console.log(`  Komplet (kh+fedt+kcal): ${fuldt_komplet.length}`);
		console.log(`  Mangler kh:   ${uden_kh.length}`);
		console.log(`  Mangler fedt: ${uden_fedt.length}`);
		console.log(`  Mangler kcal: ${uden_kcal.length}`);

		if (uden_kh.length > 0 || uden_fedt.length > 0 || uden_kcal.length > 0) {
			const eksempel = liste.filter((f) => {
				return (
					f.kh === undefined ||
					f.kh === null ||
					f.fedt === undefined ||
					f.fedt === null ||
					f.kcal === undefined ||
					f.kcal === null
				);
			});
			console.log(`\n  Første 10 ufuldstændige:`);
			for (const f of eksempel.slice(0, 10)) {
				const m: string[] = [];
				if (f.kh === undefined || f.kh === null) m.push('kh');
				if (f.fedt === undefined || f.fedt === null) m.push('fedt');
				if (f.kcal === undefined || f.kcal === null) m.push('kcal');
				console.log(`    ${f.id.padEnd(40)} ${(f.navn ?? '').padEnd(40)} mangler: ${m.join(', ')}`);
			}
			if (eksempel.length > 10) {
				console.log(`    ... og ${eksempel.length - 10} mere`);
			}
		}
	}

	console.log(`\n=== Tip: ===`);
	console.log(`  --csv > mangler.csv     full CSV-liste`);
	console.log(`  --opskrifter            gennemgå opskrifters ingredienser også\n`);
}

async function diagnoseOpskrifter() {
	console.log(`\n=== Diagnose: opskrifters ingredienser ===\n`);

	const [opskriftSnap, fodevareSnap] = await Promise.all([
		db.collection('opskrifter').get(),
		db.collection('fodevarer').get()
	]);

	const opskrifter = opskriftSnap.docs.map((d) => ({ id: d.id, ...d.data() }) as Opskrift);
	const fodevarer = fodevareSnap.docs.map((d) => {
		const data = d.data() as Fodevare;
		// findFodevareForIngrediens forventer 'name' (engelsk) — vi bruger 'navn' i DB
		return { ...data, id: d.id, name: data.navn ?? data.name ?? '' };
	});

	console.log(`Total opskrifter: ${opskrifter.length}`);
	console.log(`Total fødevarer: ${fodevarer.length}\n`);

	let ingredienserIAlt = 0;
	let ikkeMatchede = 0;
	let matchedeMenMangler = 0;
	const problemer: Array<{ opskrift: string; ingrediens: string; problem: string; match?: string }> = [];

	for (const o of opskrifter) {
		const ing = o.ingredienser ?? [];
		for (const i of ing) {
			if (!i.navn) continue;
			ingredienserIAlt++;
			const food = findFodevareForIngrediens(i.navn, fodevarer as FodevareType[]);
			if (!food) {
				ikkeMatchede++;
				problemer.push({
					opskrift: o.titel,
					ingrediens: i.navn,
					problem: 'INGEN MATCH'
				});
			} else {
				const f = food as Fodevare;
				const manglerKh = f.kh === undefined || f.kh === null;
				const manglerFedt = f.fedt === undefined || f.fedt === null;
				const manglerKcal = f.kcal === undefined || f.kcal === null;
				if (manglerKh || manglerFedt || manglerKcal) {
					matchedeMenMangler++;
					const m: string[] = [];
					if (manglerKh) m.push('kh');
					if (manglerFedt) m.push('fedt');
					if (manglerKcal) m.push('kcal');
					problemer.push({
						opskrift: o.titel,
						ingrediens: i.navn,
						problem: `mangler ${m.join(',')}`,
						match: f.navn ?? f.name
					});
				}
			}
		}
	}

	console.log(`Ingredienser i alt: ${ingredienserIAlt}`);
	console.log(`Ingredienser uden match: ${ikkeMatchede} (giver 0 i ALLE næringsfelter)`);
	console.log(`Ingredienser matchet men fødevare mangler felter: ${matchedeMenMangler}`);
	console.log(`Komplet: ${ingredienserIAlt - ikkeMatchede - matchedeMenMangler}\n`);

	if (problemer.length > 0) {
		console.log(`=== Første 30 problemer: ===\n`);
		for (const p of problemer.slice(0, 30)) {
			const matchInfo = p.match ? ` → matchet til "${p.match}"` : '';
			console.log(`  [${p.opskrift}]`);
			console.log(`    "${p.ingrediens}"${matchInfo}: ${p.problem}`);
		}
		if (problemer.length > 30) {
			console.log(`\n  ... og ${problemer.length - 30} mere`);
		}
	}
}

async function main() {
	if (opskriftMode) {
		await diagnoseOpskrifter();
	} else {
		await diagnose();
	}
}

main().catch((e) => {
	console.error(e);
	process.exit(1);
});
