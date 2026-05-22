// Bruger Claude (Anthropic API) til at estimere realistiske mængder for de
// ingredienser i opskrifter-30-30-3.csv der mangler mængde-angivelse i raw-
// strengen ("blåbær", "kanel", "feta", osv.).
//
// Output: estimater-opskrifter-mangder.json (i projekt-roden) — én post pr
// opskrift med {titel, estimerede: {navn: {maengde, enhed}}}.
//
// Idempotent: hvis JSON-filen allerede findes med en post for en opskrift,
// springes opskriften over (re-runs koster ikke).
//
// Brug:
//   npx tsx scripts/_estimer-opskrifter-mangder.ts            # tør-kørsel, viser 2 første
//   npx tsx scripts/_estimer-opskrifter-mangder.ts --apply    # kør for alle 70

import { readFileSync, writeFileSync, existsSync } from 'fs';

const CSV_PATH = '/Users/linnabildtrup/Projekter/linns-academy-app/opskrifter-30-30-3.csv';
const CACHE_PATH = '/Users/linnabildtrup/Projekter/linns-academy-app/estimater-opskrifter-mangder.json';

function laesEnvFil(): Record<string, string> {
	try {
		const indhold = readFileSync(
			'/Users/linnabildtrup/Projekter/linns-academy-app/.env',
			'utf-8'
		);
		const env: Record<string, string> = {};
		for (const linje of indhold.split('\n')) {
			const t = linje.trim();
			if (!t || t.startsWith('#')) continue;
			const eq = t.indexOf('=');
			if (eq === -1) continue;
			const key = t.slice(0, eq).trim();
			let val = t.slice(eq + 1).trim();
			if (
				(val.startsWith('"') && val.endsWith('"')) ||
				(val.startsWith("'") && val.endsWith("'"))
			) {
				val = val.slice(1, -1);
			}
			env[key] = val;
		}
		return env;
	} catch {
		return {};
	}
}

const env = laesEnvFil();
const API_KEY = process.env.ANTHROPIC_API_KEY || env.ANTHROPIC_API_KEY;
if (!API_KEY) {
	console.error('❌ ANTHROPIC_API_KEY mangler i miljø eller .env');
	process.exit(1);
}

const APPLY = process.argv.includes('--apply');

const KENDTE_ENHEDER = new Set([
	'g',
	'kg',
	'ml',
	'dl',
	'spsk',
	'tsk',
	'stk',
	'skive'
]);

const BROEK: Record<string, number> = {
	'½': 0.5,
	'¼': 0.25,
	'¾': 0.75,
	'⅓': 0.333,
	'⅔': 0.667,
	'⅛': 0.125
};

function harMaengde(raw: string): boolean {
	const t = raw.trim();
	if (t.match(/^\d+(?:[,.]\d+)?\s*(g|kg|ml|dl|l)\b/i)) return true;
	const first = t.split(/\s+/)[0];
	if (first in BROEK) return true;
	if (first.match(/^\d+([½¼¾⅓⅔⅛])?$/)) return true;
	return false;
}

type CsvOpskrift = {
	titel: string;
	kategori: string;
	hoved: string[];
	manglerMaengde: string[];
};

function parseCsv(): CsvOpskrift[] {
	const tekst = readFileSync(CSV_PATH, 'utf-8').replace(/\r/g, '');
	const linjer = tekst.split('\n').filter((l) => l.trim().length > 0);
	const opskrifter: CsvOpskrift[] = [];
	for (let i = 1; i < linjer.length; i++) {
		const c = linjer[i].split(';');
		if (c.length !== 11) continue;
		const hoved = c[4]
			.split(',')
			.map((s) => s.trim())
			.filter((s) => s.length > 0);
		const mangler = hoved.filter((h) => !harMaengde(h));
		opskrifter.push({
			titel: c[1].trim(),
			kategori: c[0].trim().toLowerCase(),
			hoved,
			manglerMaengde: mangler
		});
	}
	return opskrifter;
}

type Cache = Record<string, Record<string, { maengde: number; enhed: string }>>;

function laesCache(): Cache {
	if (!existsSync(CACHE_PATH)) return {};
	try {
		return JSON.parse(readFileSync(CACHE_PATH, 'utf-8'));
	} catch {
		return {};
	}
}

function gemCache(c: Cache) {
	writeFileSync(CACHE_PATH, JSON.stringify(c, null, 2), 'utf-8');
}

async function spoergClaude(
	titel: string,
	kategori: string,
	manglende: string[]
): Promise<Record<string, { maengde: number; enhed: string }>> {
	const liste = manglende.map((m) => `- "${m}"`).join('\n');
	const prompt = `Du estimerer realistiske portions-mængder for ingredienser i en dansk opskrift.

Opskrift: "${titel}" (${kategori}, til 1 portion).

Ingredienser uden angivet mængde:
${liste}

Returnér KUN gyldig JSON i præcis dette format (én post pr ingrediens, brug nøglen ordret som i listen ovenfor):
{
  "INGREDIENS_NAVN": { "maengde": TAL, "enhed": "ENHED" }
}

Gyldige enheder: g, ml, dl, spsk, tsk, stk, skive.

Brug realistiske 1-portions-mængder:
- "blåbær" som topping → 50, "g"
- "kanel" som krydderi → 0.5, "tsk"
- "feta" som topping → 30, "g"
- "frisk dild" som garnish → 1, "spsk"
- "chiliflager" → 0.5, "tsk"
- "hakkede tomater" som hoveddel → 200, "g"
- "rucola" som bund → 30, "g"
- "frisk timian" → 1, "tsk"
- "rugbrød" når der står "skive" → 1, "skive"

Kun JSON i svaret, ingen tekst før eller efter.`;

	const res = await fetch('https://api.anthropic.com/v1/messages', {
		method: 'POST',
		headers: {
			'content-type': 'application/json',
			'x-api-key': API_KEY,
			'anthropic-version': '2023-06-01'
		},
		body: JSON.stringify({
			model: 'claude-sonnet-4-6',
			max_tokens: 2000,
			messages: [{ role: 'user', content: prompt }]
		})
	});

	if (!res.ok) {
		throw new Error(`API-fejl ${res.status}: ${await res.text()}`);
	}
	const data = await res.json();
	const tekst = data.content?.[0]?.text ?? '';
	const start = tekst.indexOf('{');
	const slut = tekst.lastIndexOf('}');
	if (start === -1 || slut === -1) {
		throw new Error(`Kunne ikke parse JSON fra svar: ${tekst.slice(0, 200)}`);
	}
	const jsonStr = tekst.slice(start, slut + 1);
	const parsed = JSON.parse(jsonStr) as Record<
		string,
		{ maengde: number; enhed: string }
	>;
	// Sanitér enheder
	for (const k of Object.keys(parsed)) {
		const v = parsed[k];
		if (!KENDTE_ENHEDER.has(v.enhed)) {
			console.warn(`   ⚠️ "${k}": ukendt enhed "${v.enhed}" → fallback "stk"`);
			v.enhed = 'stk';
		}
		if (!Number.isFinite(v.maengde) || v.maengde < 0) v.maengde = 0;
	}
	return parsed;
}

async function main() {
	const opskrifter = parseCsv();
	console.log(`📋 ${opskrifter.length} opskrifter i CSV`);
	const tilEstimering = opskrifter.filter((o) => o.manglerMaengde.length > 0);
	console.log(`📋 ${tilEstimering.length} har ingredienser uden mængde\n`);

	const cache = laesCache();
	const cacheStart = Object.keys(cache).length;
	console.log(`📋 Cache: ${cacheStart} opskrifter allerede estimeret\n`);

	let antalKaldt = 0;
	let antalSpring = 0;
	const grænse = APPLY ? Infinity : 2;

	for (const o of opskrifter) {
		if (o.manglerMaengde.length === 0) continue;
		if (cache[o.titel]) {
			antalSpring++;
			continue;
		}
		if (antalKaldt >= grænse) {
			console.log(`\n(stoppet efter ${grænse} kald — brug --apply for at køre alle)`);
			break;
		}
		console.log(
			`📞 "${o.titel}" (${o.manglerMaengde.length} ing.) [${antalKaldt + 1}/${tilEstimering.length - antalSpring}]`
		);
		try {
			const estimater = await spoergClaude(o.titel, o.kategori, o.manglerMaengde);
			for (const ing of o.manglerMaengde) {
				const v = estimater[ing];
				if (v) {
					console.log(`   ✓ "${ing}" → ${v.maengde} ${v.enhed}`);
				} else {
					console.log(`   ⚠️ "${ing}" mangler i svar → fallback 0 stk`);
					estimater[ing] = { maengde: 0, enhed: 'stk' };
				}
			}
			cache[o.titel] = estimater;
			gemCache(cache);
			antalKaldt++;
		} catch (e) {
			console.error(`   ❌ ${e instanceof Error ? e.message : e}`);
			break;
		}
	}

	console.log(
		`\n📊 Færdig. Estimerede ${antalKaldt} nye opskrifter (${antalSpring} sprunget over fra cache).`
	);
	console.log(`📁 Cache gemt i: ${CACHE_PATH}`);
}

main().then(() => process.exit(0));
