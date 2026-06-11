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
type Sliders = { energi: number; mave: number; cravings: number; humor: number; sovn: number };
const SLIDER_KEYS = ['energi', 'mave', 'cravings', 'humor', 'sovn'] as const;
interface MrsDoc {
	timestamp?: number;
	total?: number;
	subscales?: Sub;
	sliders?: Sliders;
	kunSliders?: boolean;
}

// Én kundes destillerede MRS-rejse — raa-data vi aggregerer pr scope.
// Slider-rejsen er SEPARAT fra MRS-total (sliders findes ogsaa paa kun-slider-
// maalinger, og HOEJERE slider = bedre, modsat MRS).
interface KundeMrs {
	totaler: number[]; // fulde MRS-maalinger i rækkefølge (til rejse-grafen)
	baseline: number; // 0 hvis kunden aldrig lavede et fuldt MRS-skema
	seneste: number;
	harMrs: boolean; // >=1 fuldt MRS-skema
	harUdvikling: boolean; // >=2 fulde MRS-skemaer
	subBaseline?: Sub;
	subSeneste?: Sub;
	alder?: number;
	menopaus?: string;
	sliderMaalinger: Sliders[]; // alle slider-maalinger i rækkefølge (til velvaere-graf)
	sliderBaseline?: Sliders;
	sliderSeneste?: Sliders;
	harSliderUdvikling: boolean; // >=2 maalinger med sliders
}

const gns = (a: number[]) => (a.length ? a.reduce((s, x) => s + x, 0) / a.length : 0);
const r1 = (n: number) => Math.round(n * 10) / 10;

function svaergrad(total: number): 'mild' | 'moderat' | 'svaer' {
	if (total <= 8) return 'mild'; // officielle MRS-cutoffs: 0-8 mild, 9-16 moderat, 17+ svaer
	if (total <= 16) return 'moderat';
	return 'svaer';
}

// Generisk: grupperer udviklings-kunder og giver antal + gns forbedring pr gruppe.
function segmentGruppe<K extends string>(
	udv: KundeMrs[],
	grupper: readonly K[],
	klassificer: (k: KundeMrs) => K
): Record<K, { antal: number; gnsAendring: number }> {
	const buckets = Object.fromEntries(grupper.map((g) => [g, [] as number[]])) as Record<
		K,
		number[]
	>;
	for (const k of udv) buckets[klassificer(k)].push(k.seneste - k.baseline);
	return Object.fromEntries(
		grupper.map((g) => [g, { antal: buckets[g].length, gnsAendring: r1(gns(buckets[g])) }])
	) as Record<K, { antal: number; gnsAendring: number }>;
}

const ALDERSGRUPPER = ['0-40', '41-45', '46-50', '51-55', '56-60', '60+', 'ukendt'] as const;
function aldersgruppe(alder?: number): (typeof ALDERSGRUPPER)[number] {
	if (alder === undefined) return 'ukendt';
	if (alder <= 40) return '0-40';
	if (alder <= 45) return '41-45';
	if (alder <= 50) return '46-50';
	if (alder <= 55) return '51-55';
	if (alder <= 60) return '56-60';
	return '60+';
}
const MENOPAUSE = ['praemenopause', 'perimenopause', 'postmenopause', 'ukendt'] as const;
function menopauseGruppe(m?: string): (typeof MENOPAUSE)[number] {
	return (MENOPAUSE as readonly string[]).includes(m ?? '')
		? (m as (typeof MENOPAUSE)[number])
		: 'ukendt';
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

	// Segmenter (antal + gns forbedring pr gruppe, over udviklings-kunder).
	const baselineSvaergrad = segmentGruppe(udv, ['mild', 'moderat', 'svaer'] as const, (k) =>
		svaergrad(k.baseline)
	);
	const demografi = {
		menopause: segmentGruppe(udv, MENOPAUSE, (k) => menopauseGruppe(k.menopaus)),
		alder: segmentGruppe(udv, ALDERSGRUPPER, (k) => aldersgruppe(k.alder))
	};

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

	// Velvaere-sliders (egen population: kunder med >=2 slider-maalinger).
	const sliderUdv = kunder.filter((k) => k.harSliderUdvikling);
	const sliderGns = (vaelg: (k: KundeMrs) => Sliders | undefined, key: keyof Sliders) => {
		const v = sliderUdv
			.map((k) => vaelg(k)?.[key])
			.filter((x): x is number => typeof x === 'number');
		return v.length ? gns(v) : 0;
	};
	const velvaere = Object.fromEntries(
		SLIDER_KEYS.map((key) => [
			key,
			{
				gnsBaseline: r1(sliderGns((k) => k.sliderBaseline, key)),
				gnsSeneste: r1(sliderGns((k) => k.sliderSeneste, key)),
				gnsAendring: r1(
					sliderGns((k) => k.sliderSeneste, key) - sliderGns((k) => k.sliderBaseline, key)
				)
			}
		])
	) as Record<keyof Sliders, { gnsBaseline: number; gnsSeneste: number; gnsAendring: number }>;

	// Velvaere-rejse: gns slider-vaerdi ved 1., 2., 3. slider-maaling pr slider.
	const velvaereRejse = Object.fromEntries(
		SLIDER_KEYS.map((key) => {
			const punkter: { gns: number; antal: number }[] = [];
			for (let i = 0; i < MAX_REJSE_PUNKTER; i++) {
				const v = kunder
					.filter((k) => k.sliderMaalinger.length > i)
					.map((k) => k.sliderMaalinger[i][key]);
				if (v.length < 5) break;
				punkter.push({ gns: r1(gns(v)), antal: v.length });
			}
			return [key, punkter];
		})
	) as Record<keyof Sliders, { gns: number; antal: number }[]>;

	// Samlet velvaere-rejse: gns af ALLE 5 sliders ved 1., 2., 3. maaling. Bruges
	// til hold-sammenligning paa velvaere-grafen (én linje pr forloeb).
	const velvaereSamletRejse: { gns: number; antal: number }[] = [];
	for (let i = 0; i < MAX_REJSE_PUNKTER; i++) {
		const scores = kunder
			.filter((k) => k.sliderMaalinger.length > i)
			.map((k) => {
				const s = k.sliderMaalinger[i];
				return (s.energi + s.mave + s.cravings + s.humor + s.sovn) / 5;
			});
		if (scores.length < 5) break;
		velvaereSamletRejse.push({ gns: r1(gns(scores)), antal: scores.length });
	}

	return {
		antalMedData: kunder.filter((k) => k.harMrs).length,
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
		baselineSvaergrad,
		demografi,
		velvaere,
		velvaereRejse,
		velvaereSamletRejse,
		antalVelvaere: sliderUdv.length,
		forbedringsFordeling: fordeling
	};
}

// Forloeb-navne + start-tidspunkt (til pr-forloeb-tilskrivning).
const forlobSnap = await db.collection('forlob').get();
const forlobNavn = new Map<string, string>();
const forlobStart = new Map<string, number>();
for (const d of forlobSnap.docs) {
	const f = d.data() as { navn?: string; startDato?: { toDate?: () => Date } };
	forlobNavn.set(d.id, f.navn ?? d.id);
	const start = f.startDato?.toDate?.()?.getTime();
	if (start) forlobStart.set(d.id, start);
}

// Bygger én KundeMrs ud fra et sæt maalinger (allerede sorteret aeldst->nyest).
function bygKunde(docs: MrsDoc[], alder?: number, menopaus?: string): KundeMrs {
	const maalinger = docs.filter((m) => !m.kunSliders && typeof m.total === 'number');
	const sliderM = docs.filter((m) => m.sliders);
	return {
		totaler: maalinger.map((m) => m.total!),
		baseline: maalinger[0]?.total ?? 0,
		seneste: maalinger[maalinger.length - 1]?.total ?? 0,
		harMrs: maalinger.length > 0,
		harUdvikling: maalinger.length >= 2,
		subBaseline: maalinger[0]?.subscales,
		subSeneste: maalinger[maalinger.length - 1]?.subscales,
		alder,
		menopaus,
		sliderMaalinger: sliderM.map((m) => m.sliders!),
		sliderBaseline: sliderM[0]?.sliders,
		sliderSeneste: sliderM[sliderM.length - 1]?.sliders,
		harSliderUdvikling: sliderM.length >= 2
	};
}

// Buffer saa en baseline taget lige FOER forloebsstart stadig tilskrives forloebet.
const TILSKRIV_BUFFER_MS = 3 * 86400000;

const alleKunder: KundeMrs[] = [];
const prForlobKunder = new Map<string, KundeMrs[]>();

const users = await db.collection('users').get();
let kunderTjekket = 0;

for (const d of users.docs) {
	kunderTjekket++;
	const mrsSnap = await db.collection('users').doc(d.id).collection('mrs_scores').get();
	if (mrsSnap.empty) continue;

	const alle = mrsSnap.docs
		.map((m) => m.data() as MrsDoc)
		.sort((x, y) => (x.timestamp ?? 0) - (y.timestamp ?? 0));
	const u = d.data() as {
		forlobIds?: string[];
		brugerProfil?: { alder?: number; menopaus?: string };
	};

	// Kundens kendte forloeb, sorteret efter start. App-kunder uden forloeb faar
	// ét pseudo-forloeb 'app' der "starter" ved tid 0 (alle maalinger samles der).
	const kundeForlob = (u.forlobIds ?? [])
		.filter((id) => forlobStart.has(id))
		.map((id) => ({ id, start: forlobStart.get(id)! }))
		.sort((a, b) => a.start - b.start);
	if (kundeForlob.length === 0) kundeForlob.push({ id: 'app', start: 0 });

	// Tilskriv hver maaling til det forloeb der var SENEST startet paa
	// maaletidspunktet — saa en kickstart->kropsro-kundes maalinger aldrig
	// blandes mellem forloebene.
	const perForlob = new Map<string, MrsDoc[]>();
	for (const m of alle) {
		let valgt = kundeForlob[0].id;
		for (const f of kundeForlob)
			if (f.start <= (m.timestamp ?? 0) + TILSKRIV_BUFFER_MS) valgt = f.id;
		if (!perForlob.has(valgt)) perForlob.set(valgt, []);
		perForlob.get(valgt)!.push(m);
	}

	// Ét KundeMrs-bidrag pr forloeb kunden har maalinger i.
	for (const [forlobId, docs] of perForlob) {
		const kunde = bygKunde(docs, u.brugerProfil?.alder, u.brugerProfil?.menopaus);
		if (!kunde.harMrs && kunde.sliderMaalinger.length === 0) continue;
		alleKunder.push(kunde);
		if (!prForlobKunder.has(forlobId)) prForlobKunder.set(forlobId, []);
		prForlobKunder.get(forlobId)!.push(kunde);
	}
}

const prForlob = [...prForlobKunder.entries()]
	.map(([forlobId, kunder]) => ({
		forlobId,
		navn: forlobNavn.get(forlobId) ?? forlobId,
		...beregnScope(kunder)
	}))
	.filter((g) => g.antalMedData >= 3 || g.antalVelvaere >= 3) // skjul mini-grupper
	.sort(
		(a, b) =>
			Math.max(b.antalMedUdvikling, b.antalVelvaere) -
			Math.max(a.antalMedUdvikling, a.antalVelvaere)
	);

// Type-aggregater til graf-linjerne 'Alle Kickstart' og 'Kropsro alle'.
const kickstartKunder = [...prForlobKunder.entries()]
	.filter(([id]) => id.startsWith('kickstart_'))
	.flatMap(([, k]) => k);
const kropsroKunder = [...prForlobKunder.entries()]
	.filter(([id]) => id.startsWith('kropsro_'))
	.flatMap(([, k]) => k);

const snapshot = {
	genereretAt: Date.now(),
	kunderTjekket,
	samlet: beregnScope(alleKunder),
	prType: {
		kickstart: beregnScope(kickstartKunder),
		kropsro: beregnScope(kropsroKunder)
	},
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
