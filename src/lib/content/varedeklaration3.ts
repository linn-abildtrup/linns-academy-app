// ============================================================
// AT LAESE EN VAREDEKLARATION AF ET BILLEDE.
//
// Se HANDOVER-3.0.md 9.51 og mockups-scan-vare.html for hele forloebet.
//
// HVORFOR BILLEDET OG IKKE STREGKODE-REGISTRET.
// Stregkoden er varens NAVNESKILT: den siger hvilket produkt det er, saa
// to kunder der scanner den samme yoghurt faar den samme vare. Billedet
// er BEVISET for tallene, altsaa producentens lovpligtige deklaration.
// Registret er skrevet af frivillige, og det var netop dér Lurpak laa
// med nul kalorier.
//
// TO FAELDER, OG DE ER BEGGE ALVORLIGE:
//
//   1. MANGE PAKKER HAR TO KOLONNER, pr 100 g og pr portion. Laeses den
//      forkerte, bliver alt skaevt OG DET SER FULDSTAENDIG RIGTIGT UD.
//      Derfor staar det paa skaermen hvilken kolonne der blev laest, og
//      hun kan skifte.
//
//   2. KOSTFIBRE ER FRIVILLIGE at skrive paa en dansk varedeklaration.
//      EU kraever energi, fedt, maettet fedt, kulhydrat, sukkerarter,
//      protein og salt. Fibre staar paa listen over det man MAA skrive.
//      I en app der hedder 30-30 er det den vaerst taenkelige mangel.
//      **Vi skriver ALDRIG et stille nul.** Mangler de, siger vi det.
//
// Alt hvad modellen svarer laeses DEFENSIVT. Svaret er skrevet af en
// model og ikke af vores kode, og hun har lige taget et billede hun ikke
// vil miste. Samme princip som `fraAiSvar` i mineOpskrifter3.ts.
// ============================================================

import { tjekNaering } from './openFoodFacts';

/** De tal en dansk varedeklaration kan indeholde, pr 100 g. */
export interface Deklaration {
	kcal: number | null;
	protein: number | null;
	/** null betyder AT DER IKKE STOD FIBRE PAA PAKKEN. Ikke nul. */
	fiber: number | null;
	kh: number | null;
	fedt: number | null;
	maettetFedt: number | null;
	sukkerarter: number | null;
	salt: number | null;
}

export type Kolonne = 'pr100' | 'prPortion' | 'ukendt';

export interface LaestDeklaration {
	tal: Deklaration;
	/** Hvilken kolonne modellen mener den har laest. */
	kolonne: Kolonne;
	/** Portionens stoerrelse i gram, naar kolonnen er pr portion. */
	portionGram: number | null;
	/** Navnet paa pakken, hvis det kunne laeses. */
	navn: string | null;
}

export const TOM: Deklaration = {
	kcal: null, protein: null, fiber: null, kh: null,
	fedt: null, maettetFedt: null, sukkerarter: null, salt: null
};

/**
 * Et tal fra en model kan komme som streng, med komma, eller som volapyk.
 *
 * FAELDEN: en dansk deklaration skriver energi som "201 kJ / 48 kcal".
 * Fjerner man bare alt der ikke er cifre, bliver de to tal til 20148.
 * Derfor tages ét tal ad gangen, og staar der kcal i strengen, tages det
 * tal der staar LIGE FOER det ord.
 */
export function tilTal(v: unknown): number | null {
	if (typeof v === 'number') return Number.isFinite(v) ? v : null;
	if (typeof v !== 'string') return null;
	const tekst = v.replace(/,/g, '.');
	const foerKcal = tekst.match(/(-?\d+(?:\.\d+)?)\s*kcal/i);
	const foerste = (foerKcal ?? tekst.match(/-?\d+(?:\.\d+)?/))?.[1] ?? tekst.match(/-?\d+(?:\.\d+)?/)?.[0];
	if (!foerste) return null;
	const n = parseFloat(foerste);
	return Number.isFinite(n) ? n : null;
}

/**
 * Laeser modellens svar. Alt der ikke kan forstaas bliver null, aldrig nul.
 * Forskellen er hele pointen: nul betyder "der er ikke noget", null betyder
 * "vi ved det ikke".
 */
export function fraAiSvar(svar: unknown): LaestDeklaration {
	const o = (svar ?? {}) as Record<string, unknown>;
	const n = (o.naering ?? o) as Record<string, unknown>;
	const kol = String(o.kolonne ?? '').toLowerCase();
	return {
		tal: {
			kcal: tilTal(n.kcal ?? n.kalorier ?? n.energi),
			protein: tilTal(n.protein),
			fiber: tilTal(n.fiber ?? n.kostfibre ?? n.fibre),
			kh: tilTal(n.kh ?? n.kulhydrat ?? n.kulhydrater),
			fedt: tilTal(n.fedt),
			maettetFedt: tilTal(n.maettetFedt ?? n['mættet fedt'] ?? n.maettede),
			sukkerarter: tilTal(n.sukkerarter ?? n.sukker),
			salt: tilTal(n.salt)
		},
		kolonne: kol.includes('portion') ? 'prPortion' : kol.includes('100') ? 'pr100' : 'ukendt',
		portionGram: tilTal(o.portionGram ?? o.portion),
		navn: typeof o.navn === 'string' && o.navn.trim() ? o.navn.trim() : null
	};
}

/**
 * Regner om fra "pr portion" til "pr 100 g", saa alt i appen taler samme
 * sprog. Kan portionen ikke laeses, kan vi ikke regne om, og saa maa hun
 * fotografere den rigtige kolonne i stedet.
 */
export function tilPr100(l: LaestDeklaration): Deklaration | null {
	if (l.kolonne !== 'prPortion') return l.tal;
	if (!l.portionGram || l.portionGram <= 0) return null;
	const f = 100 / l.portionGram;
	const gang = (x: number | null) => (x === null ? null : Math.round(x * f * 10) / 10);
	return {
		kcal: l.tal.kcal === null ? null : Math.round(l.tal.kcal * f),
		protein: gang(l.tal.protein),
		fiber: gang(l.tal.fiber),
		kh: gang(l.tal.kh),
		fedt: gang(l.tal.fedt),
		maettetFedt: gang(l.tal.maettetFedt),
		sukkerarter: gang(l.tal.sukkerarter),
		salt: gang(l.tal.salt)
	};
}

/** Stod der fibre paa pakken? Null betyder nej, og det skal siges hoejt. */
export function fibreMangler(d: Deklaration): boolean {
	return d.fiber === null;
}

/** Har vi nok til overhovedet at gemme varen? Protein er det ene der skal med. */
export function nokTilAtGemme(d: Deklaration): boolean {
	return d.protein !== null;
}

export interface Vurdering {
	/** Kan tallene gemmes uden at vi siger noget? */
	ok: boolean;
	/** Advarsler fra kalorie-tjekket, ordret som den gamle app skriver dem. */
	advarsler: string[];
	/** Sat naar den hyppigste forklaring passer: forkert kolonne. */
	maaskeForkertKolonne: boolean;
	/** Sat naar fibrene ikke stod paa pakken. Ikke en fejl, en oplysning. */
	fibreMangler: boolean;
}

/**
 * Vurderer det vi har laest.
 *
 * Kalorie-tjekket er den GAMLE apps `tjekNaering`, og det er med vilje. To
 * steder der doemmer naeringstal forskelligt er vaerre end ét sted der
 * doemmer dem lidt for haardt. Filen er delt og maa kun laeses, se regel 2.
 */
export function vurder(d: Deklaration, kolonne: Kolonne = 'pr100'): Vurdering {
	const tjek = tjekNaering({
		kcal: d.kcal ?? undefined,
		protein: d.protein ?? undefined,
		fiber: d.fiber ?? undefined,
		kh: d.kh ?? undefined,
		fedt: d.fedt ?? undefined
	});
	// Passer kalorierne ikke, er den hyppigste forklaring at kolonnen "pr
	// portion" blev laest i stedet for "pr 100 g". Vi gaetter paa aarsagen
	// i stedet for at sige fejl, saa hun har noget at trykke paa.
	const kalorieFejl = tjek.advarsler.some((a) => a.includes('passer ikke'));
	return {
		ok: tjek.ok && !fibreMangler(d),
		advarsler: tjek.advarsler,
		maaskeForkertKolonne: kalorieFejl && kolonne !== 'pr100',
		fibreMangler: fibreMangler(d)
	};
}

/**
 * Maa varen deles med andre kunder?
 *
 * Kun naar hun IKKE har rettet i tallene og kalorie-tjekket er tilfreds.
 * At fibrene mangler forhindrer IKKE deling: det staar ikke paa pakken,
 * og saa er der ikke noget at goere ved det for nogen. Varen deles med
 * fibrene som de er, altsaa tomme, saa den naeste kan se det samme.
 */
export function maaDeles3(v: Vurdering, kundenHarRettet: boolean): boolean {
	if (kundenHarRettet) return false;
	return v.advarsler.length === 0;
}

/** De tre veje ud naar fibrene ikke stod paa pakken. Linns valg 24. august. */
export type FiberValg = 'tom' | 'egen' | 'laant';

export function medFiber(d: Deklaration, valg: FiberValg, tal: number | null): Deklaration {
	if (valg === 'tom') return { ...d, fiber: null };
	if (tal === null || !Number.isFinite(tal) || tal < 0) return d;
	return { ...d, fiber: tal };
}
