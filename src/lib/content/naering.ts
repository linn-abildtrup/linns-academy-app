// Standardværdier og hjælpere til udvidet næringsdata.
// Bruges på profil-siden, i dagbogen og på udviklings-siden.
import type { DagligeMaal } from '$lib/types';

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
