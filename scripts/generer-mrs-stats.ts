// Genererer MRS-KPI-snapshot til admin-dashboardet og gemmer det som ÉT
// dokument: adminStats/mrs. Dashboardet (/app/admin/dashboard) laeser kun det
// dokument — saa siden er lynhurtig uanset hvor mange kunder der er.
//
// Koer manuelt naar tallene skal opdateres:  npx tsx scripts/generer-mrs-stats.ts
//
// MRS = Menopause Rating Scale. LAVERE total = faerre symptomer = bedre.
// Baseline = kundens FOERSTE rigtige maaling (sorteret paa timestamp,
// kun-slider-maalinger springes over), fordi measurePoint-etiketten er
// inkonsistent brugt i data.
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const sa = JSON.parse(readFileSync(join(__dirname, 'service-account-key.json'), 'utf-8'));
initializeApp({ credential: cert(sa) });
const db = getFirestore();

const MAX_REJSE_PUNKTER = 4; // de fleste har <=4 maalinger
type Sub = { somatisk: number; psykologisk: number; urogenital: number };
interface MrsDoc {
	timestamp?: number;
	total?: number;
	subscales?: Sub;
	kunSliders?: boolean;
}

// Én kundes destillerede MRS-rejse — raa-data vi aggregerer pr scope.
interface KundeMrs {
	totaler: number[]; // alle rigtige maalinger i rækkefølge (til rejse-grafen)
	baseline: number;
	seneste: number;
	harUdvikling: boolean; // >=2 maalinger
	subBaseline?: Sub;
	subSeneste?: Sub;
}

const gns = (a: number[]) => (a.length ? a.reduce((s, x) => s + x, 0) / a.length : 0);
const r1 = (n: number) => Math.round(n * 10) / 10;

function svaergrad(total: number): 'mild' | 'moderat' | 'svaer' {
	if (total <= 8) return 'mild'; // officielle MRS-cutoffs: 0-8 mild, 9-16 moderat, 17+ svaer
	if (total <= 16) return 'moderat';
	return 'svaer';
}

// Beregner ÉN scope (samlet eller ét forloeb) ud fra kundernes raa-data.
function beregnScope(kunder: KundeMrs[]) {
	const udv = kunder.filter((k) => k.harUdvikling);
	const baselineT = udv.map((k) => k.baseline);
	const senesteT = udv.map((k) => k.seneste);

	// Rejse: gns MRS ved 1., 2., 3., 4. maaling (faldende n — vis antal bag).
	const rejse: { gns: number; antal: number }[] = [];
	for (let i = 0; i < MAX_REJSE_PUNKTER; i++) {
		const vaerdier = kunder.filter((k) => k.totaler.length > i).map((k) => k.totaler[i]);
		if (vaerdier.length < 5) break; // stop ved for lille n — punktet er upaalideligt
		rejse.push({ gns: r1(gns(vaerdier)), antal: vaerdier.length });
	}

	// Baseline-svaergrad — antal + gns forbedring pr gruppe (over udviklings-kunder).
	const svaergradGrupper = { mild: [] as number[], moderat: [] as number[], svaer: [] as number[] };
	for (const k of udv) svaergradGrupper[svaergrad(k.baseline)].push(k.seneste - k.baseline);
	const svaergradResultat = Object.fromEntries(
		(['mild', 'moderat', 'svaer'] as const).map((g) => [
			g,
			{ antal: svaergradGrupper[g].length, gnsAendring: r1(gns(svaergradGrupper[g])) }
		])
	) as Record<'mild' | 'moderat' | 'svaer', { antal: number; gnsAendring: number }>;

	// Forbedrings-fordeling (over udviklings-kunder).
	const fordeling = { megetBedre: 0, lidtBedre: 0, uaendret: 0, vaerre: 0 };
	for (const k of udv) {
		const a = k.seneste - k.baseline;
		if (a <= -5) fordeling.megetBedre++;
		else if (a < 0) fordeling.lidtBedre++;
		else if (a === 0) fordeling.uaendret++;
		else fordeling.vaerre++;
	}

	const subGns = (vaelg: (k: KundeMrs) => Sub | undefined, key: keyof Sub) => {
		const b = udv.map((k) => vaelg(k)).filter(Boolean) as Sub[];
		return b.length ? gns(b.map((s) => s[key])) : 0;
	};
	const subResultat = (key: keyof Sub) => ({
		gnsBaseline: r1(subGns((k) => k.subBaseline, key)),
		gnsSeneste: r1(subGns((k) => k.subSeneste, key)),
		gnsAendring: r1(subGns((k) => k.subSeneste, key) - subGns((k) => k.subBaseline, key))
	});

	return {
		antalMedData: kunder.length,
		antalMedUdvikling: udv.length,
		gnsBaseline: r1(gns(baselineT)),
		gnsSeneste: r1(gns(senesteT)),
		gnsAendring: r1(gns(senesteT) - gns(baselineT)),
		andelForbedret: udv.length
			? Math.round((udv.filter((k) => k.seneste < k.baseline).length / udv.length) * 100)
			: 0,
		subskalaer: {
			somatisk: subResultat('somatisk'),
			psykologisk: subResultat('psykologisk'),
			urogenital: subResultat('urogenital')
		},
		rejse,
		baselineSvaergrad: svaergradResultat,
		forbedringsFordeling: fordeling
	};
}

// Forloeb-navne
const forlobSnap = await db.collection('forlob').get();
const forlobNavn = new Map<string, string>();
for (const d of forlobSnap.docs) forlobNavn.set(d.id, (d.data() as { navn?: string }).navn ?? d.id);

const alleKunder: KundeMrs[] = [];
const prForlobKunder = new Map<string, KundeMrs[]>();

const users = await db.collection('users').get();
let kunderTjekket = 0;

for (const d of users.docs) {
	kunderTjekket++;
	const mrsSnap = await db.collection('users').doc(d.id).collection('mrs_scores').get();
	if (mrsSnap.empty) continue;

	const maalinger = mrsSnap.docs
		.map((m) => m.data() as MrsDoc)
		.filter((m) => !m.kunSliders && typeof m.total === 'number')
		.sort((x, y) => (x.timestamp ?? 0) - (y.timestamp ?? 0));
	if (maalinger.length === 0) continue;

	const kunde: KundeMrs = {
		totaler: maalinger.map((m) => m.total!),
		baseline: maalinger[0].total!,
		seneste: maalinger[maalinger.length - 1].total!,
		harUdvikling: maalinger.length >= 2,
		subBaseline: maalinger[0].subscales,
		subSeneste: maalinger[maalinger.length - 1].subscales
	};

	const u = d.data() as { forlobIds?: string[] };
	const forlobId =
		u.forlobIds && u.forlobIds.length > 0 ? u.forlobIds[u.forlobIds.length - 1] : 'app';

	alleKunder.push(kunde);
	if (!prForlobKunder.has(forlobId)) prForlobKunder.set(forlobId, []);
	prForlobKunder.get(forlobId)!.push(kunde);
}

const prForlob = [...prForlobKunder.entries()]
	.map(([forlobId, kunder]) => ({
		forlobId,
		navn: forlobNavn.get(forlobId) ?? forlobId,
		...beregnScope(kunder)
	}))
	.filter((g) => g.antalMedData >= 3) // skjul mini-grupper (stoej/privatliv)
	.sort((a, b) => b.antalMedUdvikling - a.antalMedUdvikling);

const snapshot = {
	genereretAt: Date.now(),
	kunderTjekket,
	samlet: beregnScope(alleKunder),
	prForlob
};

await db.collection('adminStats').doc('mrs').set(snapshot);

console.log('✓ adminStats/mrs opdateret');
console.log(`  Kunder tjekket: ${kunderTjekket}`);
console.log(
	`  Med MRS-data: ${snapshot.samlet.antalMedData}, med udvikling: ${snapshot.samlet.antalMedUdvikling}`
);
console.log(
	`  Gns ${snapshot.samlet.gnsBaseline} -> ${snapshot.samlet.gnsSeneste} (${snapshot.samlet.gnsAendring}), ${snapshot.samlet.andelForbedret}% forbedret`
);
console.log(
	`  Rejse-punkter: ${snapshot.samlet.rejse.map((p) => `${p.gns}(n=${p.antal})`).join(' -> ')}`
);
console.log(
	`  Svaergrad: ${(['mild', 'moderat', 'svaer'] as const).map((g) => `${g} ${snapshot.samlet.baselineSvaergrad[g].antal}st/${snapshot.samlet.baselineSvaergrad[g].gnsAendring}`).join(', ')}`
);
console.log(`  Fordeling: ${JSON.stringify(snapshot.samlet.forbedringsFordeling)}`);
console.log(`  Forloebs-grupper: ${prForlob.length}`);
