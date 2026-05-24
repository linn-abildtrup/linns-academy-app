// Estimer kulhydrater + fedt pr portion for opskrifter der mangler dem.
// Bruger Claude Haiku 4.5 med protein/fiber/kalorier som sanity-check
// (4 kcal/g protein, 4 kcal/g kh, 9 kcal/g fedt).
//
// Skriver tilbage ved at indsaette ' | Kulhydrater: X g | Fedt: Y g'
// lige foer ' | Kalorier:' (eller foer ' | Tid:' eller slutningen).
//
// Koer:
//   npx tsx scripts/estimer-opskrift-kh-fedt.ts             # dry-run
//   npx tsx scripts/estimer-opskrift-kh-fedt.ts --skriv
//   npx tsx scripts/estimer-opskrift-kh-fedt.ts --limit=5

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
const BATCH_SIZE = 8;

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
	kalorier: number;
}

interface Estimat {
	id: string;
	kh: number;
	fedt: number;
}

function parserMakro(instr: string) {
	function nr(rx: RegExp) {
		const m = instr.match(rx);
		return m ? parseFloat(m[1].replace(',', '.')) : null;
	}
	return {
		protein: nr(/Protein:\s*(\d+(?:[.,]\d+)?)\s*g/i),
		fiber: nr(/Fiber:\s*(\d+(?:[.,]\d+)?)\s*g/i),
		kh: nr(/(?:Kulhydrat(?:er)?|Kh):\s*(\d+(?:[.,]\d+)?)\s*g/i),
		fedt: nr(/Fedt:\s*(\d+(?:[.,]\d+)?)\s*g/i),
		kalorier: nr(/Kalorier:\s*(\d+(?:[.,]\d+)?)\s*kcal/i)
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
Kendt pr portion: Protein ${o.protein} g, Fiber ${o.fiber} g, Kalorier ${o.kalorier} kcal`;
		})
		.join('\n\n');

	const prompt = `Du er ekspert i dansk fødevare-næring. For hver opskrift, estimér antallet af GRAM kulhydrater (kh) og GRAM fedt PR PORTION.

Brug makro-balancen til at tjekke dig selv:
- 4 kcal pr g protein
- 4 kcal pr g kulhydrat (fiber er en delmængde af kh — INKLUDÉR fiber i kh-tallet)
- 9 kcal pr g fedt

Dvs: kalorier ≈ 4*protein + 4*kh + 9*fedt

Eksempel: hvis protein=30g, fiber=10g, kalorier=520 → 4*30=120, så 4*kh + 9*fedt ≈ 400. Hvis retten er kødbaseret med olie er fedt fx 25g (→225 kcal), så kh ≈ (400-225)/4 = 44g.

Opskrifter:

${liste}

Returnér KUN et JSON array (intet andet, ingen forklaring, ingen markdown):

[
  {"id": "<id>", "kh": <heltal g kh inkl fiber>, "fedt": <heltal g fedt>},
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

function indsaetKhFedt(instr: string, kh: number, fedt: number): string {
	// Indsaet ' | Kulhydrater: X g | Fedt: Y g' lige foer Kalorier hvis muligt,
	// ellers foer Tid, ellers tilfoejes til sidst.
	const ny = ` | Kulhydrater: ${kh} g | Fedt: ${fedt} g`;
	if (/\|\s*Kalorier:/i.test(instr)) {
		return instr.replace(/(\|\s*Kalorier:)/i, `${ny} $1`);
	}
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
		if (mk.kh !== null && mk.fedt !== null) continue; // har allerede begge
		if (mk.protein === null || mk.fiber === null || mk.kalorier === null) {
			console.log(`SKIP ${data.titel ?? d.id} — mangler protein/fiber/kalorier`);
			continue;
		}
		mangler.push({
			id: d.id,
			titel: String(data.titel ?? ''),
			defaultPortioner: Number(data.defaultPortioner ?? 1),
			ingredienser: ((data.ingredienser ?? []) as Ingrediens[]),
			instruktioner: instr,
			protein: mk.protein,
			fiber: mk.fiber,
			kalorier: mk.kalorier
		});
	}

	const arbejdsliste = LIMIT > 0 ? mangler.slice(0, LIMIT) : mangler;
	console.log(`Mangler kh/fedt: ${mangler.length}, behandler: ${arbejdsliste.length}`);
	console.log(`Skriv-mode: ${skriv ? 'JA' : 'nej (dry-run)'}`);
	console.log('');

	let ok = 0;
	let fejl = 0;
	for (let i = 0; i < arbejdsliste.length; i += BATCH_SIZE) {
		const batch = arbejdsliste.slice(i, i + BATCH_SIZE);
		console.log(`Batch ${i / BATCH_SIZE + 1}: ${batch.length} opskrifter...`);
		try {
			const estimater = await spoergClaude(batch);
			const map = new Map(estimater.map((e) => [e.id, { kh: e.kh, fedt: e.fedt }]));
			for (const o of batch) {
				const est = map.get(o.id);
				if (!est || !Number.isFinite(est.kh) || !Number.isFinite(est.fedt)) {
					console.log(`  FEJL ${o.titel} — intet estimat returneret`);
					fejl++;
					continue;
				}
				const kh = Math.round(est.kh);
				const fedt = Math.round(est.fedt);
				const nyInstr = indsaetKhFedt(o.instruktioner, kh, fedt);
				const beregnedeKcal = 4 * o.protein + 4 * kh + 9 * fedt;
				const diff = Math.abs(beregnedeKcal - o.kalorier);
				const flag = diff > 100 ? ` (afvigelse: ${beregnedeKcal} kcal vs ${o.kalorier})` : '';
				console.log(`  OK   ${o.titel} → kh=${kh}g, fedt=${fedt}g${flag}`);
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
	if (!skriv) console.log('\n(Dry-run — koer med --skriv for at gemme til Firestore)');
}
main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
