// Ren beregnings-logik for MRS-/velvære-dashboardet. INGEN data-hentning her —
// hverken firebase-admin (scripts) eller Firestore REST (Cloudflare-endpoint).
// Begge sider henter rå-data på hver sin måde og kalder så de SAMME pure
// funktioner herfra, så scriptet og "Opdater tal"-knappen altid giver ens tal.
//
// MRS = Menopause Rating Scale. LAVERE total = færre symptomer = bedre.
// Velvære-sliders (energi/mave/cravings/humør/søvn): 1-10, HØJERE = bedre.

export const MAX_REJSE_PUNKTER = 4; // de fleste har <=4 maalinger
export type Sub = { somatisk: number; psykologisk: number; urogenital: number };
export type Sliders = {
	energi: number;
	mave: number;
	cravings: number;
	humor: number;
	sovn: number;
};
export const SLIDER_KEYS = ['energi', 'mave', 'cravings', 'humor', 'sovn'] as const;

export interface MrsDoc {
	timestamp?: number;
	total?: number;
	subscales?: Sub;
	sliders?: Sliders;
	kunSliders?: boolean;
}

// Én kundes destillerede MRS-rejse — raa-data vi aggregerer pr scope.
// Slider-rejsen er SEPARAT fra MRS-total (sliders findes ogsaa paa kun-slider-
// maalinger, og HOEJERE slider = bedre, modsat MRS).
export interface KundeMrs {
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

// Alle velvaere-tal for en given kunde-delmaengde. Kaldes to gange pr scope:
// for ALLE slider-kunder, og for "gennemfoerte" (har en maaling ved hvert
// check-in). Samme logik begge gange → tallene er konsistente.
function velvaereStats(kunder: KundeMrs[]) {
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

	// Velvaere check-in-for-check-in (MATCHET/PARRET — som den eksterne
	// statistik-rapports "udvikling uge for uge"). For HVERT slutpunkt i
	// (check-in 1, 2, 3 ...) bruges KUN kunder der naaede dertil, parret mod
	// deres EGEN baseline (slider-maaling index 0). Derfor skifter baade
	// population og baseline-gns pr slutpunkt — og forbedringen vokser jo
	// laengere ud man kommer, modsat den samlede "baseline->sidste maaling"-
	// tabel der blander tidlige drop-outs ind. Positionel index (samme
	// forbehold som velvaereRejse): check-in N = N'te slider-maaling.
	const sliderComposite = (s: Sliders) => (s.energi + s.mave + s.cravings + s.humor + s.sovn) / 5;
	const velvaereCheckIns: {
		checkin: number;
		antalMatchede: number;
		perMaal: Record<
			keyof Sliders,
			{ gnsBaseline: number; gnsCheckin: number; delta: number; forbedretPct: number }
		>;
		composite: { gnsBaseline: number; gnsCheckin: number; delta: number; forbedretPct: number };
	}[] = [];
	for (let i = 1; i < MAX_REJSE_PUNKTER; i++) {
		const matchede = kunder.filter((k) => k.sliderMaalinger.length > i);
		if (matchede.length < 5) break; // for lille n — slutpunktet er upaalideligt
		const procentForbedret = (faar: (k: KundeMrs) => number, ved: (k: KundeMrs) => number) =>
			Math.round((matchede.filter((k) => ved(k) > faar(k)).length / matchede.length) * 100);
		const perMaal = Object.fromEntries(
			SLIDER_KEYS.map((key) => {
				const bl = matchede.map((k) => k.sliderMaalinger[0][key]);
				const ci = matchede.map((k) => k.sliderMaalinger[i][key]);
				return [
					key,
					{
						gnsBaseline: r1(gns(bl)),
						gnsCheckin: r1(gns(ci)),
						delta: r1(gns(ci) - gns(bl)),
						forbedretPct: procentForbedret(
							(k) => k.sliderMaalinger[0][key],
							(k) => k.sliderMaalinger[i][key]
						)
					}
				];
			})
		) as Record<
			keyof Sliders,
			{ gnsBaseline: number; gnsCheckin: number; delta: number; forbedretPct: number }
		>;
		const compBl = matchede.map((k) => sliderComposite(k.sliderMaalinger[0]));
		const compCi = matchede.map((k) => sliderComposite(k.sliderMaalinger[i]));
		velvaereCheckIns.push({
			checkin: i,
			antalMatchede: matchede.length,
			perMaal,
			composite: {
				gnsBaseline: r1(gns(compBl)),
				gnsCheckin: r1(gns(compCi)),
				delta: r1(gns(compCi) - gns(compBl)),
				forbedretPct: procentForbedret(
					(k) => sliderComposite(k.sliderMaalinger[0]),
					(k) => sliderComposite(k.sliderMaalinger[i])
				)
			}
		});
	}

	return {
		velvaere,
		velvaereRejse,
		velvaereSamletRejse,
		velvaereCheckIns,
		antalVelvaere: sliderUdv.length
	};
}

// Alle MRS-total-tal for en given kunde-delmaengde. Kaldes to gange pr scope:
// for ALLE udviklings-kunder, og for "gennemfoerte" (et fuldt MRS-skema ved
// hvert rejse-punkt). Samme logik begge gange → tallene er konsistente.
function mrsStats(kunder: KundeMrs[]) {
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

	return {
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
		forbedringsFordeling: fordeling
	};
}

// Beregner ÉN scope (samlet eller ét forloeb) ud fra kundernes raa-data.
export function beregnScope(kunder: KundeMrs[]) {
	// MRS — for ALLE udviklings-kunder, og separat for "gennemfoerte" (et fuldt
	// MRS-skema ved hvert rejse-punkt: totaler.length >= antal rejse-punkter).
	const m = mrsStats(kunder);
	const mrsGennemfoerte =
		m.rejse.length > 0 ? kunder.filter((k) => k.totaler.length >= m.rejse.length) : [];
	const mGennemfoerte = mrsStats(mrsGennemfoerte);

	// Velvaere — for ALLE slider-kunder, og separat for "gennemfoerte" (en
	// slider-maaling ved hvert check-in: baseline + alle check-ins der findes).
	const v = velvaereStats(kunder);
	const antalCheckIns = v.velvaereCheckIns.length;
	const gennemfoerte =
		antalCheckIns > 0 ? kunder.filter((k) => k.sliderMaalinger.length >= antalCheckIns + 1) : [];
	const vGennemfoerte = velvaereStats(gennemfoerte);

	return {
		antalMedData: kunder.filter((k) => k.harMrs).length,
		...m,
		// "Gennemfoerte" MRS = kunder med et fuldt MRS-skema ved hvert rejse-punkt.
		// Samme tal-typer som top-niveau, blot over delmaengden.
		mrsCompletere: {
			...mGennemfoerte,
			antalGennemfoerte: mrsGennemfoerte.length,
			maalingerKraevet: m.rejse.length
		},
		velvaere: v.velvaere,
		velvaereRejse: v.velvaereRejse,
		velvaereSamletRejse: v.velvaereSamletRejse,
		velvaereCheckIns: v.velvaereCheckIns,
		antalVelvaere: v.antalVelvaere,
		// "Gennemfoerte" velvaere = kunder med en slider-maaling ved hvert check-in.
		velvaereCompletere: {
			velvaere: vGennemfoerte.velvaere,
			velvaereSamletRejse: vGennemfoerte.velvaereSamletRejse,
			velvaereCheckIns: vGennemfoerte.velvaereCheckIns,
			antalVelvaere: vGennemfoerte.antalVelvaere,
			antalGennemfoerte: gennemfoerte.length,
			checkInsKraevet: antalCheckIns
		}
	};
}

// Ét forløbs-bidrag fra én kunde — også formatet vi cacher pr kunde i
// mrsCache/{uid}.entries, så "Opdater tal"-knappen kan genberegne uden at
// hente uændrede kunder igen.
export type KundeForlobBidrag = { forlobId: string; kunde: KundeMrs };

export type Scope = ReturnType<typeof beregnScope>;
export type Forlob = { forlobId: string; navn: string } & Scope;
export interface MrsSnapshot {
	genereretAt: number;
	kunderTjekket: number;
	samlet: Scope;
	prType: { kickstart: Scope; kropsro: Scope };
	prForlob: Forlob[];
	// Samlet 2-fase-rejse (Kickstart -> Kropsro) til bund-graferne. Ét sæt pr
	// maal, hvert med begge population-varianter. Se byggSamletRejse nederst.
	samletRejse: { velvaere: SamletRejse; mrs: SamletRejse };
}

// Bygger én KundeMrs ud fra et sæt maalinger (allerede sorteret aeldst->nyest).
export function bygKunde(docs: MrsDoc[], alder?: number, menopaus?: string): KundeMrs {
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
export const TILSKRIV_BUFFER_MS = 3 * 86400000;

// Tilskriver én kundes maalinger til forloeb og destillerer ÉN KundeMrs pr
// forloeb kunden har maalinger i. Hver maaling tilskrives det forloeb der var
// SENEST startet paa maaletidspunktet (+ buffer) — saa en kickstart->kropsro-
// kundes maalinger aldrig blandes. App-kunder uden forloeb faar ét pseudo-
// forloeb 'app'. Springer forloeb-bidrag over uden hverken MRS eller sliders.
//
// VIGTIGT: `forlobIds` skal indeholde ALLE kundens forloeb — baade igangvaerende
// (users.forlobIds) OG afsluttede (users.afsluttedeForlobIds). Ellers falder en
// afsluttet fase (typisk Kickstart for en kunde der er gaaet videre til Kropsro)
// ud af tilskrivningen, og dens maalinger havner faejlagtigt i det forkerte
// forloeb. Kalderne (scriptet + genberegn-endpointet) skal forene de to lister.
export function distillerKunde(
	mrsDocs: MrsDoc[],
	forlobIds: string[],
	forlobStart: Map<string, number>,
	profil: { alder?: number; menopaus?: string }
): KundeForlobBidrag[] {
	const alle = [...mrsDocs].sort((x, y) => (x.timestamp ?? 0) - (y.timestamp ?? 0));

	const kundeForlob = (forlobIds ?? [])
		.filter((id) => forlobStart.has(id))
		.map((id) => ({ id, start: forlobStart.get(id)! }))
		.sort((a, b) => a.start - b.start);
	if (kundeForlob.length === 0) kundeForlob.push({ id: 'app', start: 0 });

	const perForlob = new Map<string, MrsDoc[]>();
	for (const m of alle) {
		let valgt = kundeForlob[0].id;
		for (const f of kundeForlob)
			if (f.start <= (m.timestamp ?? 0) + TILSKRIV_BUFFER_MS) valgt = f.id;
		if (!perForlob.has(valgt)) perForlob.set(valgt, []);
		perForlob.get(valgt)!.push(m);
	}

	const result: Array<{ forlobId: string; kunde: KundeMrs }> = [];
	for (const [forlobId, docs] of perForlob) {
		const kunde = bygKunde(docs, profil.alder, profil.menopaus);
		if (!kunde.harMrs && kunde.sliderMaalinger.length === 0) continue;
		result.push({ forlobId, kunde });
	}
	return result;
}

// Samler hele snapshottet ud fra kundernes forloebs-bidrag: ét array pr kunde
// (samme form som cachen mrsCache/{uid}.entries). Bygger samlet + pr type + pr
// forloeb, samt den samlede 2-fase-rejse. Skjuler mini-grupper (<3 med data) og
// sorterer forloeb efter stoerste population. `forlobStart` bruges til fase-
// inddelingen (vaelg senest startede forloeb pr fase).
export function byggSnapshot(
	kundeBidrag: KundeForlobBidrag[][],
	forlobNavn: Map<string, string>,
	forlobStart: Map<string, number>,
	genereretAt: number,
	kunderTjekket: number
): MrsSnapshot {
	// Fold bidragene ud til de aggregeringer beregningen bruger, og byg samtidig
	// én FaseKunde pr kunde (til rejse-graferne).
	const alleKunder: KundeMrs[] = [];
	const prForlobKunder = new Map<string, KundeMrs[]>();
	const faseKunder: FaseKunde[] = [];
	for (const bidrag of kundeBidrag) {
		for (const { forlobId, kunde } of bidrag) {
			alleKunder.push(kunde);
			if (!prForlobKunder.has(forlobId)) prForlobKunder.set(forlobId, []);
			prForlobKunder.get(forlobId)!.push(kunde);
		}
		faseKunder.push(faseInddel(bidrag, forlobStart));
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

	return {
		genereretAt,
		kunderTjekket,
		samlet: beregnScope(alleKunder),
		prType: {
			kickstart: beregnScope(kickstartKunder),
			kropsro: beregnScope(kropsroKunder)
		},
		prForlob,
		samletRejse: {
			velvaere: byggSamletRejse(faseKunder, 'velvaere'),
			mrs: byggSamletRejse(faseKunder, 'mrs')
		}
	};
}

// ==============================================
// Samlet 2-fase-rejse (Kickstart -> Kropsro) til dashboardets bund-graf.
// Viser kundernes udvikling som ÉN bue gennem begge faser, med maale-punkterne
// jaevnt fordelt (positionelt: 1., 2., 3. maaling i hver fase). To populationer
// og to maal — hvert maal vises i sin egen graf:
//   - Maal 'velvaere' (gns af de 5 sliders, HOEJERE = bedre)
//   - Maal 'mrs'      (den fulde MRS-total, LAVERE = bedre)
// ==============================================

export type Fase = 'kickstart' | 'kropsro';
export type RejseMaal = 'velvaere' | 'mrs';

// Én kundes to fase-segmenter. null hvis kunden ikke har det segment.
export type FaseKunde = { kickstart: KundeMrs | null; kropsro: KundeMrs | null };

// Ét punkt paa rejse-grafen. `antal` bruges til at graatone tynde punkter i UI.
export type RejsePunkt = { fase: Fase; index: number; gns: number; antal: number };

// Rejsen for ét maal, i begge population-varianter.
export type SamletRejse = { beggeFaser: RejsePunkt[]; alleIHverFase: RejsePunkt[] };

// Den ordnede vaerdi-serie for ét segment og ét maal: velvaere = gns af de 5
// sliders pr maaling; MRS = de fulde MRS-totaler.
function serieForMaal(k: KundeMrs, maal: RejseMaal): number[] {
	if (maal === 'velvaere')
		return k.sliderMaalinger.map((s) => (s.energi + s.mave + s.cravings + s.humor + s.sovn) / 5);
	return k.totaler;
}

// True hvis segmentet har mindst 2 maalinger af den paagaeldende type — nok til
// at indgaa i "begge faser"-kohorten, som kraever en udvikling i HVER fase.
function segmentHarUdvikling(k: KundeMrs | null, maal: RejseMaal): boolean {
	return k !== null && serieForMaal(k, maal).length >= 2;
}

// Inddeler én kundes forloebs-bidrag (fra distillerKunde) i de to faser. Faar
// kunden flere forloeb i samme fase (fx to kickstart-hold), vaelges det SENEST
// startede — den nyeste rejse. Forudsaetter at bidrag stammer fra distillerKunde
// kaldt med ALLE kundens forloeb (igangvaerende + afsluttede), ellers mangler
// den afsluttede fase.
export function faseInddel(
	bidrag: KundeForlobBidrag[],
	forlobStart: Map<string, number>
): FaseKunde {
	const vaelg = (praefix: string): KundeMrs | null => {
		const kandidater = bidrag.filter((b) => b.forlobId.startsWith(praefix));
		if (kandidater.length === 0) return null;
		const nyeste = [...kandidater].sort(
			(a, b) => (forlobStart.get(a.forlobId) ?? 0) - (forlobStart.get(b.forlobId) ?? 0)
		);
		return nyeste[nyeste.length - 1].kunde;
	};
	return { kickstart: vaelg('kickstart_'), kropsro: vaelg('kropsro_') };
}

// Bygger ét bens punkter (én fase) for de kunder der taeller med. Et punkt
// medtages saa laenge mindst én kunde har en maaling ved det index (tynde
// punkter graatones i UI, ikke her). n falder naturligt langs x-aksen.
function faseBen(
	pop: FaseKunde[],
	fase: Fase,
	hent: (fk: FaseKunde) => KundeMrs | null,
	maal: RejseMaal
): RejsePunkt[] {
	const punkter: RejsePunkt[] = [];
	for (let i = 0; i < MAX_REJSE_PUNKTER; i++) {
		const vaerdier = pop
			.map((fk) => {
				const seg = hent(fk);
				return seg ? serieForMaal(seg, maal)[i] : undefined;
			})
			.filter((x): x is number => typeof x === 'number');
		if (vaerdier.length === 0) continue;
		punkter.push({ fase, index: i, gns: r1(gns(vaerdier)), antal: vaerdier.length });
	}
	return punkter;
}

// Den samlede rejse for ét maal, i begge populationer:
//  - alleIHverFase: kickstart-benet = ALLE med et kickstart-segment, kropsro-
//    benet = ALLE med et kropsro-segment. Forskellige kunder i de to ben, saa
//    linjen kan "hoppe" ved faseskiftet.
//  - beggeFaser: KUN kunder med en udvikling (>=2 maalinger) i BEGGE faser —
//    samme mennesker hele vejen, altsaa én aerlig ubrudt rejse.
export function byggSamletRejse(faseKunder: FaseKunde[], maal: RejseMaal): SamletRejse {
	const alleKick = faseKunder.filter((fk) => fk.kickstart !== null);
	const alleKrop = faseKunder.filter((fk) => fk.kropsro !== null);
	const begge = faseKunder.filter(
		(fk) => segmentHarUdvikling(fk.kickstart, maal) && segmentHarUdvikling(fk.kropsro, maal)
	);
	return {
		alleIHverFase: [
			...faseBen(alleKick, 'kickstart', (fk) => fk.kickstart, maal),
			...faseBen(alleKrop, 'kropsro', (fk) => fk.kropsro, maal)
		],
		beggeFaser: [
			...faseBen(begge, 'kickstart', (fk) => fk.kickstart, maal),
			...faseBen(begge, 'kropsro', (fk) => fk.kropsro, maal)
		]
	};
}
