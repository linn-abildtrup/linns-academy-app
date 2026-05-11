// Beriger de resterende ufuldstændige fødevarer ved at bede Claude (Anthropic)
// estimere kh/fedt/kcal pr 100g fra fødevarens navn. Bruger Claude Sonnet 4.6.
//
// Claude er god til generiske danske fødevarer hvor Frida og Open Food Facts
// fejler. Den kender 'Æggeblomme', 'Agavesirup', 'Æbleeddike' osv. og kan
// returnere realistiske værdier baseret på sin trænings-viden.
//
// Forventet kost: ca. 10-20 kr i alt for ca. 500 fødevarer.
//
// Kør:
//   export ANTHROPIC_API_KEY="..."                  # samme key som Cloudflare
//   npx tsx scripts/berig-via-claude.ts             # dry-run
//   npx tsx scripts/berig-via-claude.ts --skriv     # skriv
//   npx tsx scripts/berig-via-claude.ts --limit=20  # første 20

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
		for (const linje of indhold.split('\n')) {
			const trimmet = linje.trim();
			if (!trimmet || trimmet.startsWith('#')) continue;
			const eq = trimmet.indexOf('=');
			if (eq === -1) continue;
			const key = trimmet.slice(0, eq).trim();
			let val = trimmet.slice(eq + 1).trim();
			if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
				val = val.slice(1, -1);
			}
			env[key] = val;
		}
		return env;
	} catch {
		return {};
	}
}

const envFil = laesEnvFil();
const API_KEY = process.env.ANTHROPIC_API_KEY || envFil.ANTHROPIC_API_KEY;
if (!API_KEY) {
	console.error('❌ ANTHROPIC_API_KEY mangler. Sæt enten i .env-filen eller via:');
	console.error('   export ANTHROPIC_API_KEY="..."');
	process.exit(1);
}

const skriv = process.argv.includes('--skriv');
const limitArg = process.argv.find((a) => a.startsWith('--limit='));
const LIMIT = limitArg ? parseInt(limitArg.split('=')[1], 10) : 0;

const BATCH_SIZE = 30;
const MODEL = 'claude-sonnet-4-5-20250929';

interface Fodevare {
	id: string;
	navn?: string;
	name?: string;
	kilde?: string;
	kh?: number;
	fedt?: number;
	kcal?: number;
}

interface ClaudeEstimat {
	id: string;
	navn: string;
	kh: number;
	fedt: number;
	kcal: number;
}

async function spørgClaude(batch: { id: string; navn: string }[]): Promise<ClaudeEstimat[]> {
	const liste = batch.map((b) => `  ${b.id}: ${b.navn}`).join('\n');
	const prompt = `Du er ekspert i dansk fødevare-næringsindhold. Givet en liste af danske fødevarer, estimér næringsindholdet pr 100g for hver. Brug data svarende til Frida (DTU) eller tilsvarende danske kost-tabeller.

Fødevarer:
${liste}

Returnér KUN et JSON array (intet andet, ingen forklaring, ingen markdown), med samme rækkefølge:

[
  {"id": "<id>", "navn": "<navn>", "kh": <gram kulhydrat pr 100g>, "fedt": <gram fedt pr 100g>, "kcal": <kalorier pr 100g>},
  ...
]

Værdier skal være realistiske og kostforskningsmæssigt korrekte. Hvis du er usikker på en specifik vare (fx en obskur dansk specialitet), gør dit bedste skøn baseret på lignende fødevarer. Returnér aldrig 0 medmindre du er sikker (fx vand, salt, krydderier).`;

	const res = await fetch('https://api.anthropic.com/v1/messages', {
		method: 'POST',
		headers: {
			'x-api-key': API_KEY!,
			'anthropic-version': '2023-06-01',
			'content-type': 'application/json'
		},
		body: JSON.stringify({
			model: MODEL,
			max_tokens: 4096,
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

	// Parse JSON — Claude returnerer typisk ren JSON, men ryd op hvis der er markdown
	let json = tekst.trim();
	if (json.startsWith('```')) {
		json = json.replace(/^```(?:json)?\s*/, '').replace(/\s*```$/, '');
	}
	try {
		const parsed = JSON.parse(json) as ClaudeEstimat[];
		return parsed;
	} catch (e) {
		console.error('Kunne ikke parse Claude-svar:', tekst.slice(0, 500));
		throw e;
	}
}

async function main() {
	console.log(`📊 Henter ufuldstændige fødevarer fra Firestore...`);
	const snap = await db.collection('fodevarer').get();
	const alle: Fodevare[] = snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Fodevare);
	const ufuldstaendige = alle.filter((f) => {
		if (f.kilde === 'community') return false;
		const manglerKh = f.kh === undefined || f.kh === null;
		const manglerFedt = f.fedt === undefined || f.fedt === null;
		const manglerKcal = f.kcal === undefined || f.kcal === null;
		return manglerKh || manglerFedt || manglerKcal;
	});

	const total = LIMIT > 0 ? Math.min(LIMIT, ufuldstaendige.length) : ufuldstaendige.length;
	console.log(`   Behandler ${total} af ${ufuldstaendige.length} ufuldstændige`);
	console.log(`   Batch-størrelse: ${BATCH_SIZE}\n`);

	const toBehandle = ufuldstaendige.slice(0, total).map((f) => ({
		id: f.id,
		navn: (f.navn ?? f.name ?? '').trim()
	}));

	const alleResultater: ClaudeEstimat[] = [];
	const fejlede: string[] = [];

	for (let i = 0; i < toBehandle.length; i += BATCH_SIZE) {
		const batch = toBehandle.slice(i, i + BATCH_SIZE);
		const batchNr = Math.floor(i / BATCH_SIZE) + 1;
		const totalBatches = Math.ceil(toBehandle.length / BATCH_SIZE);
		console.log(`  Batch ${batchNr}/${totalBatches} (${batch.length} fødevarer)...`);
		try {
			const resultater = await spørgClaude(batch);
			alleResultater.push(...resultater);
			// Vis første 3 resultater pr batch
			for (const r of resultater.slice(0, 3)) {
				console.log(`     ${r.id.padEnd(30)} "${r.navn}" → ${r.kh}kh, ${r.fedt}fedt, ${r.kcal}kcal`);
			}
			if (resultater.length > 3) console.log(`     ... og ${resultater.length - 3} mere`);
		} catch (e) {
			console.error(`     Batch fejlede: ${e instanceof Error ? e.message : String(e)}`);
			fejlede.push(...batch.map((b) => b.id));
		}
		// Lille pause så vi ikke rammer rate-limit
		await new Promise((r) => setTimeout(r, 500));
	}

	console.log(`\n✓ Estimeret: ${alleResultater.length}`);
	console.log(`✗ Fejlede: ${fejlede.length}\n`);

	if (!skriv) {
		console.log('(dry-run — kør med --skriv for at opdatere Firestore)');
		return;
	}

	console.log(`📝 Skriver ${alleResultater.length} berigelser til Firestore...`);
	const CHUNK = 400;
	for (let i = 0; i < alleResultater.length; i += CHUNK) {
		const batch = db.batch();
		for (const r of alleResultater.slice(i, i + CHUNK)) {
			batch.set(
				db.collection('fodevarer').doc(r.id),
				{ kh: r.kh, fedt: r.fedt, kcal: r.kcal },
				{ merge: true }
			);
		}
		await batch.commit();
		console.log(`   ✓ ${Math.min(i + CHUNK, alleResultater.length)} / ${alleResultater.length}`);
	}
	console.log(`\n✓ ${alleResultater.length} fødevarer beriget via Claude.`);
}

main()
	.then(() => process.exit(0))
	.catch((e) => {
		console.error(e);
		process.exit(1);
	});
