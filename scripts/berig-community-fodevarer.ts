// Re-beriger gamle DELTE community-fødevarer med rigtige stregkoder fra Open
// Food Facts — fylder kun MANGLENDE næringsfelter (overskriver aldrig
// eksisterende tal). Bruges til at rette fx "Smør (Lurpak)" der står med 0 kcal.
//
// Springer 'manual_'-fødevarer over (de er gamle personlige oprettelser uden
// rigtig stregkode — håndteres separat ved at vises kun for opretteren).
//
// Dry-run (viser før→efter, skriver INTET):  npx tsx scripts/berig-community-fodevarer.ts
// Skriv ændringerne:                          npx tsx scripts/berig-community-fodevarer.ts --apply
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const sa = JSON.parse(readFileSync(join(__dirname, 'service-account-key.json'), 'utf-8'));
initializeApp({ credential: cert(sa) });
const db = getFirestore();

const APPLY = process.argv.includes('--apply');

async function offNaering(barcode: string) {
	try {
		const res = await fetch(
			`https://world.openfoodfacts.org/api/v2/product/${barcode}.json?fields=nutriments`,
			{ headers: { Accept: 'application/json' } }
		);
		if (!res.ok) return null;
		const d = (await res.json()) as {
			status?: number;
			product?: { nutriments?: Record<string, number> };
		};
		if (d.status !== 1 || !d.product) return null;
		const n = d.product.nutriments ?? {};
		let kcal = n['energy-kcal_100g'] ?? n['energy-kcal'] ?? 0;
		if (!kcal) {
			const e = n['energy_100g'] ?? 0;
			kcal = e > 900 ? e / 4.184 : e;
		}
		const r1 = (x: number) => Math.round(x * 10) / 10;
		return {
			kcal: Math.round(kcal),
			fedt: n['fat_100g'] != null ? r1(n['fat_100g']) : null,
			kh: n['carbohydrates_100g'] != null ? r1(n['carbohydrates_100g']) : null
		};
	} catch {
		return null;
	}
}

const snap = await db.collection('fodevarer').where('kilde', '==', 'community').get();
let rettede = 0;
let sprunget = 0;
for (const d of snap.docs) {
	const f = d.data() as {
		name?: string;
		barcode?: string;
		kcal?: number;
		fedt?: number;
		kh?: number;
		p?: number;
	};
	const bc = (f.barcode ?? '').replace(/\D/g, '');
	if (!f.barcode || f.barcode.startsWith('manual_') || bc.length < 6) {
		sprunget++;
		continue;
	}
	const off = await offNaering(bc);
	if (!off) {
		console.log(`⚠️  ${f.name} [${bc}] — ikke fundet i OFF, springes over`);
		continue;
	}
	// Fyld kun felter der mangler (eller er 0) — rør aldrig eksisterende tal.
	const opdatering: Record<string, number> = {};
	if (!(typeof f.fedt === 'number' && f.fedt > 0) && off.fedt && off.fedt > 0)
		opdatering.fedt = off.fedt;
	if (!(typeof f.kh === 'number' && f.kh > 0) && off.kh && off.kh > 0) opdatering.kh = off.kh;
	// kcal fra OFF, ellers udregn fra (evt. nyligt udfyldte) makroer.
	const fedtEndelig = opdatering.fedt ?? f.fedt ?? 0;
	const khEndelig = opdatering.kh ?? f.kh ?? 0;
	const udregnet = Math.round((f.p ?? 0) * 4 + khEndelig * 4 + fedtEndelig * 9);
	if (!(typeof f.kcal === 'number' && f.kcal > 0)) {
		const ny = off.kcal > 0 ? off.kcal : udregnet;
		if (ny > 0) opdatering.kcal = ny;
	}
	if (Object.keys(opdatering).length === 0) continue;
	rettede++;
	console.log(`\n${f.name}  [${bc}]`);
	console.log(
		`   FØR:   kcal=${f.kcal ?? '-'} kh=${f.kh ?? '-'} fedt=${f.fedt ?? '-'} (p=${f.p ?? '-'})`
	);
	console.log(
		`   EFTER: ${Object.entries(opdatering)
			.map(([k, v]) => `${k}=${v}`)
			.join(' ')}  (resten uændret)`
	);
	if (APPLY) await d.ref.set(opdatering, { merge: true });
}
console.log(
	`\n${APPLY ? '✓ SKREVET' : 'DRY-RUN (intet skrevet)'} · ${rettede} fødevarer ${APPLY ? 'rettet' : 'ville blive rettet'} · ${sprunget} manual_/uden-stregkode sprunget over`
);
if (!APPLY && rettede > 0) console.log('Kør med --apply for at skrive ændringerne.');
