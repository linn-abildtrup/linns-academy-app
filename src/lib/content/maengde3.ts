// ============================================================
// Maengden i 30-30 beregneren. Se SPEC-3.0.md afsnit 26.3.
//
// To veje, og de er valgt bevidst:
//
// 1. GENVEJE. Madvarens egne portioner som knapper, med hendes
//    saedvanlige maengde allerede valgt. Ni ud af ti gange er hun
//    faerdig her uden at taste noget. Maalt 9. august 2026: 68,5 % af
//    alt kunderne registrerer er en gentagelse af noget de har tastet
//    foer, saa den saedvanlige maengde er kendt paa forhaand.
//
// 2. PLUS OG MINUS med en enhed hun kan skifte. Linns valg 10. august.
//
// Springet foelger enheden. Med 1 g pr tryk ville 40 til 65 g vaere
// femogtyve tryk, og med 10 g kunne hun slet ikke ramme 65.
// ============================================================

import { getEnheder, gramForEnhed, type Enhed, type Fodevare } from './kost';

/**
 * Hvor meget ét tryk paa plus eller minus flytter, pr enhed.
 * Godkendt af Linn 10. august 2026.
 */
export const SPRING: Record<string, number> = {
	g: 5,
	ml: 5,
	stk: 1,
	skive: 1,
	spsk: 1,
	tsk: 1,
	dl: 0.5,
	portion: 0.5
};

/** Bruges naar enheden ikke staar i listen. En halv af noget er sjaeldent forkert. */
export const STANDARD_SPRING = 0.5;

export function springFor(enhedId: string | undefined): number {
	if (!enhedId) return SPRING.g;
	return SPRING[enhedId] ?? STANDARD_SPRING;
}

/**
 * Naeste maengde efter et tryk. Kan ikke gaa under ét spring, saa
 * minus-knappen slukker i stedet for at vise nul eller minus.
 */
export function skridt(portion: number, enhedId: string | undefined, retning: 1 | -1): number {
	const s = springFor(enhedId);
	const ny = portion + s * retning;
	if (ny < s) return s;
	// Undgaa 0.30000000000000004 naar vi laegger halve sammen.
	return Math.round(ny * 100) / 100;
}

/** Er minus-knappen slukket. */
export function kanTrykkeMinus(portion: number, enhedId: string | undefined): boolean {
	return portion > springFor(enhedId);
}

/** Maengden som tekst. 1 i stedet for 1,0 og 0,5 i stedet for .5 */
export function formatPortion(portion: number): string {
	const rundet = Math.round(portion * 100) / 100;
	if (Number.isInteger(rundet)) return String(rundet);
	return rundet.toString().replace('.', ',');
}

export interface Naering {
	protein: number;
	fiber: number;
	gram: number;
}

/**
 * Hvad en given maengde af en madvare giver. Tallene i arket opdaterer
 * sig levende af det her, saa hun laerer hvad 65 g havregryn faktisk
 * giver uden at nogen fortaeller hende det.
 */
export function naeringFor(
	food: Fodevare | undefined,
	portion: number,
	enhedId: string | undefined
): Naering {
	if (!food) return { protein: 0, fiber: 0, gram: 0 };
	const gram = portion * gramForEnhed(food, enhedId);
	const f = gram / 100;
	return {
		protein: rund1(food.p * f),
		fiber: rund1(food.f * f),
		gram: Math.round(gram)
	};
}

function rund1(n: number): number {
	return Math.round(n * 10) / 10;
}

export interface Genvej {
	label: string;
	portion: number;
	enhedId: string;
}

/**
 * Genvejene i arket. Madvarens egne enheder, plus 100 g, plus hendes
 * saedvanlige maengde hvis vi kender den.
 *
 * Hendes saedvanlige staar foerst og er valgt paa forhaand. Det er hele
 * pointen: hun skal ikke traeffe et valg hun allerede har truffet
 * tredive gange foer.
 */
export function genvejeFor(
	food: Fodevare | undefined,
	saedvanlig?: { portion: number; enhedId?: string } | null
): Genvej[] {
	if (!food) return [];
	const ud: Genvej[] = [];
	const set = new Set<string>();
	const tilfoej = (g: Genvej) => {
		const noegle = `${g.portion}|${g.enhedId}`;
		if (set.has(noegle)) return;
		set.add(noegle);
		ud.push(g);
	};

	if (saedvanlig && saedvanlig.portion > 0) {
		const e = saedvanlig.enhedId ?? 'g';
		tilfoej({ label: `${formatPortion(saedvanlig.portion)} ${labelFor(food, e)}`, portion: saedvanlig.portion, enhedId: e });
	}

	for (const enhed of getEnheder(food)) {
		if (enhed.u === 'g' || enhed.u === 'ml') continue;
		tilfoej({ label: `1 ${enhed.label}`, portion: 1, enhedId: enhed.u });
	}

	tilfoej({ label: '100 g', portion: 100, enhedId: 'g' });
	// Fem er rigeligt paa en telefon. Flere bliver til to raekker chips.
	return ud.slice(0, 4);
}

function labelFor(food: Fodevare | undefined, enhedId: string): string {
	if (enhedId === 'g') return 'g';
	if (enhedId === 'ml') return 'ml';
	return getEnheder(food).find((e) => e.u === enhedId)?.label ?? enhedId;
}

/** Enhederne til listen, altid med gram som den foerste. */
export function enhederFor(food: Fodevare | undefined): Enhed[] {
	if (!food) return [{ u: 'g', label: 'gram', g: 1 }];
	const egne = getEnheder(food).filter((e) => e.u !== 'g' && e.u !== 'ml');
	const basis: Enhed = food.liquid
		? { u: 'ml', label: 'milliliter', g: 1 }
		: { u: 'g', label: 'gram', g: 1 };
	return [basis, ...egne];
}
