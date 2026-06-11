// Genererer MRS-KPI-snapshot til admin-dashboardet og gemmer det som ÉT
// dokument: adminStats/mrs. Dashboardet (/app/admin/dashboard) laeser kun det
// dokument — saa siden er lynhurtig uanset hvor mange kunder der er.
//
// Koer manuelt naar tallene skal opdateres:  npx tsx scripts/generer-mrs-stats.ts
//
// MRS = Menopause Rating Scale. LAVERE total = faerre symptomer = bedre.
// Baseline bestemmes robust som kundens FOERSTE rigtige maaling (sorteret paa
// timestamp, kun-slider-maalinger springes over), fordi measurePoint-etiketten
// er inkonsistent brugt i data (nogle har 'baseline' efter 'forste').
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const sa = JSON.parse(readFileSync(join(__dirname, 'service-account-key.json'), 'utf-8'));
initializeApp({ credential: cert(sa) });
const db = getFirestore();

interface MrsDoc {
	measurePoint?: string;
	timestamp?: number;
	total?: number;
	subscales?: { somatisk: number; psykologisk: number; urogenital: number };
	kunSliders?: boolean;
}

// En akkumulator pr gruppe (samlet + pr forloeb). Vi samler raa-vaerdier og
// gennemsnitsberegner til sidst.
// "MedData" = mindst én rigtig maaling (daekning/baseline-snapshot).
// Foer->efter-tallene beregnes KUN over kunder med >=2 maalinger, saa
// gnsBaseline -> gnsSeneste altid matcher gnsAendring (samme population).
interface Akk {
	antalMedData: number; // >=1 rigtig maaling
	baselineTotaler: number[]; // kun udviklings-kunder (>=2)
	senesteTotaler: number[]; // kun udviklings-kunder (>=2)
	forbedret: number; // antal udviklings-kunder med aendring < 0
	sub: Record<'somatisk' | 'psykologisk' | 'urogenital', { b: number[]; s: number[] }>;
}
function nyAkk(): Akk {
	return {
		antalMedData: 0,
		baselineTotaler: [],
		senesteTotaler: [],
		forbedret: 0,
		sub: {
			somatisk: { b: [], s: [] },
			psykologisk: { b: [], s: [] },
			urogenital: { b: [], s: [] }
		}
	};
}

const gns = (a: number[]) => (a.length ? a.reduce((s, x) => s + x, 0) / a.length : 0);
const r1 = (n: number) => Math.round(n * 10) / 10;

function opsummer(a: Akk) {
	const subResultat = (k: 'somatisk' | 'psykologisk' | 'urogenital') => ({
		gnsBaseline: r1(gns(a.sub[k].b)),
		gnsSeneste: r1(gns(a.sub[k].s)),
		gnsAendring: r1(gns(a.sub[k].s) - gns(a.sub[k].b))
	});
	return {
		antalMedData: a.antalMedData,
		antalMedUdvikling: a.baselineTotaler.length,
		gnsBaseline: r1(gns(a.baselineTotaler)),
		gnsSeneste: r1(gns(a.senesteTotaler)),
		gnsAendring: r1(gns(a.senesteTotaler) - gns(a.baselineTotaler)),
		andelForbedret: a.baselineTotaler.length
			? Math.round((a.forbedret / a.baselineTotaler.length) * 100)
			: 0,
		subskalaer: {
			somatisk: subResultat('somatisk'),
			psykologisk: subResultat('psykologisk'),
			urogenital: subResultat('urogenital')
		}
	};
}

// Forloeb-navne til pr-forloeb-tabellen
const forlobSnap = await db.collection('forlob').get();
const forlobNavn = new Map<string, string>();
for (const d of forlobSnap.docs) forlobNavn.set(d.id, (d.data() as { navn?: string }).navn ?? d.id);

const samlet = nyAkk();
const prForlob = new Map<string, Akk>();

const users = await db.collection('users').get();
let kunderTjekket = 0;

for (const d of users.docs) {
	kunderTjekket++;
	const mrsSnap = await db.collection('users').doc(d.id).collection('mrs_scores').get();
	if (mrsSnap.empty) continue;

	// Kun rigtige MRS-maalinger (ikke kun-slider), sorteret aeldst->nyest.
	const maalinger = mrsSnap.docs
		.map((m) => m.data() as MrsDoc)
		.filter((m) => !m.kunSliders && typeof m.total === 'number')
		.sort((x, y) => (x.timestamp ?? 0) - (y.timestamp ?? 0));
	if (maalinger.length === 0) continue;

	const baseline = maalinger[0];
	const seneste = maalinger[maalinger.length - 1];
	const harUdvikling = maalinger.length >= 2;

	// Kundens forloebs-gruppe: seneste forloeb i forlobIds, ellers 'app' for
	// modulbrugere uden forloeb.
	const u = d.data() as { forlobIds?: string[]; accessSource?: string };
	const forlobId =
		u.forlobIds && u.forlobIds.length > 0 ? u.forlobIds[u.forlobIds.length - 1] : 'app';

	const grupper = [samlet];
	if (!prForlob.has(forlobId)) prForlob.set(forlobId, nyAkk());
	grupper.push(prForlob.get(forlobId)!);

	for (const a of grupper) {
		a.antalMedData++;
		if (!harUdvikling) continue;
		a.baselineTotaler.push(baseline.total!);
		a.senesteTotaler.push(seneste.total!);
		if (baseline.subscales) {
			a.sub.somatisk.b.push(baseline.subscales.somatisk);
			a.sub.psykologisk.b.push(baseline.subscales.psykologisk);
			a.sub.urogenital.b.push(baseline.subscales.urogenital);
		}
		if (seneste.subscales) {
			a.sub.somatisk.s.push(seneste.subscales.somatisk);
			a.sub.psykologisk.s.push(seneste.subscales.psykologisk);
			a.sub.urogenital.s.push(seneste.subscales.urogenital);
		}
		if (seneste.total! - baseline.total! < 0) a.forbedret++;
	}
}

const prForlobResultat = [...prForlob.entries()]
	.map(([forlobId, a]) => ({
		forlobId,
		navn: forlobNavn.get(forlobId) ?? forlobId,
		...opsummer(a)
	}))
	.filter((g) => g.antalMedData >= 3) // skjul mini-grupper (stoej/privatliv)
	.sort((a, b) => b.antalMedData - a.antalMedData);

const snapshot = {
	genereretAt: Date.now(),
	kunderTjekket,
	samlet: opsummer(samlet),
	prForlob: prForlobResultat
};

await db.collection('adminStats').doc('mrs').set(snapshot);

console.log('✓ adminStats/mrs opdateret');
console.log(`  Kunder tjekket: ${kunderTjekket}`);
console.log(`  Med MRS-data: ${snapshot.samlet.antalMedData}`);
console.log(`  Med udvikling (>=2 maalinger): ${snapshot.samlet.antalMedUdvikling}`);
console.log(
	`  Gns baseline -> seneste: ${snapshot.samlet.gnsBaseline} -> ${snapshot.samlet.gnsSeneste} (${snapshot.samlet.gnsAendring})`
);
console.log(`  Andel forbedret: ${snapshot.samlet.andelForbedret}%`);
console.log(`  Forloebs-grupper: ${prForlobResultat.length}`);
