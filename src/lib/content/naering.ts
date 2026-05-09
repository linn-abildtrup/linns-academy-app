// Standardværdier og hjælpere til udvidet næringsdata.
// Bruges på profil-siden, i dagbogen og på udviklings-siden.
import type {
	Aktivitetsniveau,
	BrugerProfil,
	DagligeMaal,
	MenopausalStatus
} from '$lib/types';

/**
 * Standard daglige mål for kvinder i overgangsalderen (anbefalingerne
 * der ligger til grund for Linns 30-30-3-koncept). Bruges som
 * default-værdier i profil-vælgeren før brugeren har sat egne tal.
 */
export const STANDARD_DAGLIGE_MAL: DagligeMaal = {
	protein: 90,
	fiber: 30,
	kh: 200,
	fedt: 70,
	kcal: 2000
};

/**
 * Returnerer brugerens daglige mål. Falder tilbage til STANDARD_DAGLIGE_MAL
 * for hvert felt der ikke er sat.
 */
export function dagligeMalForBruger(maal: DagligeMaal | undefined): DagligeMaal {
	if (!maal) return { ...STANDARD_DAGLIGE_MAL };
	return {
		protein: maal.protein ?? STANDARD_DAGLIGE_MAL.protein,
		fiber: maal.fiber ?? STANDARD_DAGLIGE_MAL.fiber,
		kh: maal.kh ?? STANDARD_DAGLIGE_MAL.kh,
		fedt: maal.fedt ?? STANDARD_DAGLIGE_MAL.fedt,
		kcal: maal.kcal ?? STANDARD_DAGLIGE_MAL.kcal
	};
}

export const NAERING_LABELS = {
	protein: 'Protein',
	fiber: 'Fiber',
	kh: 'Kulhydrater',
	fedt: 'Fedt',
	kcal: 'Kalorier'
} as const;

export const NAERING_ENHEDER = {
	protein: 'g',
	fiber: 'g',
	kh: 'g',
	fedt: 'g',
	kcal: 'kcal'
} as const;

// ==============================================
// Automatisk beregning af daglige mål
// ==============================================

/**
 * Aktivitetsfaktor til Mifflin-St Jeor TDEE-beregning.
 * Tallene er industri-standard (Harris, Roza & Shizgal mfl.).
 */
const AKTIVITETS_FAKTOR: Record<Aktivitetsniveau, number> = {
	stille: 1.2,
	let: 1.375,
	moderat: 1.55,
	meget: 1.725
};

export const AKTIVITETS_LABELS: Record<Aktivitetsniveau, string> = {
	stille: 'Stillesiddende',
	let: 'Let aktiv',
	moderat: 'Moderat aktiv',
	meget: 'Meget aktiv'
};

export const AKTIVITETS_BESKRIVELSER: Record<Aktivitetsniveau, string> = {
	stille: 'Lidt eller ingen motion',
	let: '1-3 dages motion om ugen',
	moderat: '3-5 dages motion om ugen',
	meget: '6-7 dages motion om ugen'
};

export const MENOPAUS_LABELS: Record<MenopausalStatus, string> = {
	praemenopause: 'Præmenopause',
	perimenopause: 'Perimenopause',
	postmenopause: 'Postmenopause'
};

export const MENOPAUS_BESKRIVELSER: Record<MenopausalStatus, string> = {
	praemenopause: 'Har stadig regelmæssig menstruation',
	perimenopause: 'Uregelmæssig menstruation, overgangssymptomer',
	postmenopause: '12+ måneder uden menstruation'
};

/** Sundhedsmæssig minimumsgrænse — ingen anbefaling under dette tal. */
export const KALORIE_MINIMUM = 1200;

/** Fast fiber-mål for målgruppen — Sundhedsstyrelsens anbefaling + lidt over. */
const FIBER_MAAL = 30;

/** Andel af kalorier der bør komme fra fedt (essentielt for hormonbalance). */
const FEDT_ANDEL = 0.3;

/**
 * Protein pr kg kropsvægt. Højere værdi for peri- og postmenopausale kvinder
 * pga. tendens til muskelmasse-tab (sarkopeni). Phillips et al. (2016) m.fl.
 */
function proteinPrKg(menopaus: MenopausalStatus): number {
	return menopaus === 'praemenopause' ? 1.5 : 1.6;
}

/**
 * Beregner anbefalede daglige mål ud fra brugerens fysiske profil.
 * Brug Mifflin-St Jeor til BMR, gang med aktivitetsfaktor til TDEE,
 * cap kalorier ved 1.200 (sundhedsmæssig grænse), og fordel makro
 * efter etablerede tommelfingerregler for målgruppen.
 */
export function beregnDagligeMaal(p: BrugerProfil): DagligeMaal {
	const bmr = 10 * p.vaegt + 6.25 * p.hojde - 5 * p.alder - 161;
	const tdee = bmr * AKTIVITETS_FAKTOR[p.aktivitet];
	const kalorier = Math.max(KALORIE_MINIMUM, Math.round(tdee));

	const protein = Math.round(p.vaegt * proteinPrKg(p.menopaus));
	const fedt = Math.round((kalorier * FEDT_ANDEL) / 9);
	const kh = Math.max(0, Math.round((kalorier - protein * 4 - fedt * 9) / 4));

	return {
		protein,
		fiber: FIBER_MAAL,
		kh,
		fedt,
		kcal: kalorier
	};
}
