// Estimer kalorier pr portion for opskrifter der mangler 'Kalorier: X kcal'
// i instruktioner-feltet. Bruger Claude Haiku 4.5.
//
// Skriver tilbage ved at indsaette ' | Kalorier: X kcal' lige foer ' | Tid:'
// i instruktioner-feltet (eller foer slutningen hvis Tid mangler).
//
// Koer:
//   npx tsx scripts/estimer-opskrift-kalorier.ts             # dry-run
//   npx tsx scripts/estimer-opskrift-kalorier.ts --skriv     # skriv til Firestore
//   npx tsx scripts/estimer-opskrift-kalorier.ts --limit=5   # foerste 5

import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const sa = JSON.parse(readFileSync(join(__dirname, 'service-account-key.json'), 'utf-8'));
initializeApp({ credential: cert(sa) });
const db = getFirestore();

function laesEnvFil(): Record<string, string> {
	try {
		const envPath = join(__dirname, '..', '.env');
		const indhold = readFileSync(envPath, 'utf-8');
		const env: Record<string, string> = {};
		// Robust mod manglende newlines: matcher KEY=VALUE pattern direkte.
		const rx = /([A-Z][A-Z0-9_]*)=([^\n\r]*?)(?=(?:\s*[A-Z][A-Z0-9_]*=|\s*$))/g;
		let m: RegExpExecArray | null;
		while ((m = rx.exec(indhold)) !== null) {
			let val = m[2].trim();
			if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
				val = val.slice(1, -1);
			}
			env[m[1]] = val;
		}
		return env;
	} catch {
		return {};
	}
}

const envFil = laesEnvFil();
const API_KEY = process.env.ANTHROPIC_API_KEY || envFil.ANTHROPIC_API_KEY;
if (!API_KEY) {
	console.error('ANTHROPIC_API_KEY mangler.');
	process.exit(1);
}

const skriv = process.argv.includes('--skriv');
const limitArg = process.argv.find((a) => a.startsWith('--limit='));
const LIMIT = limitArg ? parseInt(limitArg.split('=')[1], 10) : 0;

const MODEL = 'claude-haiku-4-5-20251001';
const BATCH_SIZE = 10;

interface Ingrediens {
	navn: string;
	maengde: number;
	enhed: string;
}

interface OpskriftMini {
	id: string;
	titel: string;
	defaultPortioner: number;
	ingredienser: Ingrediens[];
	instruktioner: string;
	protein: number;
	fiber: number;
}

interface Estimat {
	id: string;
	kalorier: number;
}

function parserMakro(instr: string) {
	const p = instr.match(/Protein:\s*(\d+(?:[.,]\d+)?)\s*g/i);
	const f = instr.match(/Fiber:\s*(\d+(?:[.,]\d+)?)\s*g/i);
	const k = instr.match(/Kalorier:\s*(\d+(?:[.,]\d+)?)\s*kcal/i);
	return {
		protein: p ? parseFloat(p[1].replace(',', '.')) : null,
		fiber: f ? parseFloat(f[1].replace(',', '.')) : null,
		kalorier: k ? parseFloat(k[1].replace(',', '.')) : null
	};
}

async function spoergClaude(batch: OpskriftMini[]): Promise<Estimat[]> {
	const liste = batch
		.map((o) => {
			const ing = o.ingredienser
				.map((i) => `${i.maengde} ${i.enhed} ${i.navn}`.trim())
				.join(', ');
			return `ID: ${o.id}
Titel: ${o.titel}
Portioner: ${o.defaultPortioner}
Ingredienser: ${ing}
Kendt: ${o.protein} g protein pr portion, ${o.fiber} g fiber pr portion`;
		})
		.join('\n\n');

	const prompt = `Du er ekspert i dansk fødevare-næring. For hver opskrift, estimér antallet af kalorier (kcal) PR PORTION.

Brug ingredienserne (totalt) divideret med portionsantallet. De allerede kendte protein- og fiber-tal er PR PORTION og kan bruges som sanity-check (4 kcal pr g protein, 4 kcal pr g kulhydrat/fiber, 9 kcal pr g fedt). En typisk hovedret ligger mellem 350 og 700 kcal pr portion, en snack mellem 100 og 250 kcal.

Opskrifter:

${liste}

Returnér KUN et JSON array (intet andet, ingen forklaring, ingen markdown):

[
  {"id": "<id>", "kalorier": <heltal kcal pr portion>},
  ...
]`;

	const res = await fetch('https://api.anthropic.com/v1/messages', {
		method: 'POST',
		headers: {
			'x-api-key': API_KEY!,
			'anthropic-version': '2023-06-01',
			'content-type': 'application/json'
		},
		body: JSON.stringify({
			model: MODEL,
			max_tokens: 2048,
			messages: [{ role: 'user', content: prompt }]
		})
	});

	if (!res.ok) {
		const err = await res.text();
		throw new Error(`Claude API fejl (${res.status}): ${err}`);
	}
	const data = (await res.json()) as { content: Array<{ type: string; text?: string }> };
	const tekst = data.content
		.filter((c) => c.type === 'text')
		.map((c) => c.text ?? '')
		.join('');
	let json = tekst.trim();
	if (json.startsWith('```')) {
		json = json.replace(/^```(?:json)?\s*/, '').replace(/\s*```$/, '');
	}
	return JSON.parse(json) as Estimat[];
}

function indsaetKalorier(instr: string, kcal: number): string {
	// Vi indsaetter ' | Kalorier: X kcal' lige foer ' | Tid:' hvis det findes,
	// ellers tilfoejes det til sidst.
	const ny = ` | Kalorier: ${kcal} kcal`;
	if (/\|\s*Tid:/i.test(instr)) {
		return instr.replace(/(\|\s*Tid:)/i, `${ny} $1`);
	}
	return instr + ny;
}

async function main() {
	const snap = await db.collection('opskrifter').get();
	const mangler: OpskriftMini[] = [];
	for (const d of snap.docs) {
		const data = d.data() as Record<string, unknown>;
		if (data.aktiv === false) continue;
		const instr = String(data.instruktioner ?? '');
		const mk = parserMakro(instr);
		if (mk.kalorier !== null) continue;
		if (mk.protein === null || mk.fiber === null) continue; // skip hvis protein/fiber ogsaa mangler
		mangler.push({
			id: d.id,
			titel: String(data.titel ?? ''),
			defaultPortioner: Number(data.defaultPortioner ?? 1),
			ingredienser: ((data.ingredienser ?? []) as Ingrediens[]),
			instruktioner: instr,
			protein: mk.protein,
			fiber: mk.fiber
		});
	}

	const arbejdsliste = LIMIT > 0 ? mangler.slice(0, LIMIT) : mangler;
	console.log(`Mangler kalorier: ${mangler.length}, behandler: ${arbejdsliste.length}`);
	console.log(`Skriv-mode: ${skriv ? 'JA' : 'nej (dry-run)'}`);
	console.log('');

	let ok = 0;
	let fejl = 0;
	for (let i = 0; i < arbejdsliste.length; i += BATCH_SIZE) {
		const batch = arbejdsliste.slice(i, i + BATCH_SIZE);
		console.log(`Batch ${i / BATCH_SIZE + 1}: ${batch.length} opskrifter...`);
		try {
			const estimater = await spoergClaude(batch);
			const map = new Map(estimater.map((e) => [e.id, e.kalorier]));
			for (const o of batch) {
				const kcal = map.get(o.id);
				if (kcal === undefined || !Number.isFinite(kcal)) {
					console.log(`  FEJL ${o.titel} — intet estimat returneret`);
					fejl++;
					continue;
				}
				const nyInstr = indsaetKalorier(o.instruktioner, Math.round(kcal));
				console.log(`  OK   ${o.titel} → ${Math.round(kcal)} kcal`);
				if (skriv) {
					await db.collection('opskrifter').doc(o.id).update({
						instruktioner: nyInstr
					});
				}
				ok++;
			}
		} catch (e) {
			console.error(`  Batch fejlede:`, e);
			fejl += batch.length;
		}
	}

	console.log('');
	console.log(`OK:    ${ok}`);
	console.log(`Fejl:  ${fejl}`);
	if (!skriv) console.log('\n(Dry-run — kør med --skriv for at gemme til Firestore)');
}
main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
