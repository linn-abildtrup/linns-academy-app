// Abo-vanetracker — typer og pure-funktioner.
//
// Modsat forløbs-vanerne (vaner.ts) er abo-vaner cyklisk uden slut: brugeren
// vælger selv 3 (basis) eller op til 7 (premium) vaner fra en kurateret liste
// (eller skriver sine egne) og tjekker ind dagligt. 5-slider check-in tages
// ugentligt om søndagen. Bonus-spørgsmål roterer deterministisk fra en pulje.
//
// Brugeren kan ændre sine vaner når som helst.

import type { Timestamp } from 'firebase/firestore';
import type { VaneSvar, CheckinSvar, DagStatus, FlowerNiveau } from './vaner';
import { CHECKIN_SPORGSMAAL } from './vaner';

export const BASIS_MAKS_VANER = 3;
export const PREMIUM_MAKS_VANER = 7;

// ==============================================
// Skabelon-typer (admin definerer)
// ==============================================

/** Et kurateret vaneforslag som brugeren kan vælge fra. */
export interface AboVaneForslag {
	id: string;
	label: string;
	kategori: string;
}

/**
 * Et bonus-spørgsmål i puljen. Roteres deterministisk pr dato.
 *
 * Konvention: svarmuligheder[0] er det 'positive' svar, [2] det negative.
 * Det gælder også for negativt formulerede spørgsmål — fx 'Har du følt
 * dig stresset?' har svarmuligheder ['Nej', 'Lidt', 'Ja']. Det gør at
 * trend-score kan beregnes uniformt på tværs af alle spørgsmål.
 */
export interface AboBonusForslag {
	id: string;
	label: string;
	kategori: string;
	svarmuligheder: [string, string, string];
}

/** Brugerens svar på et bonus-spørgsmål. 0 = positiv, 1 = neutral, 2 = negativ. */
export type AboBonusSvar = 0 | 1 | 2;

// ==============================================
// Bruger-typer
// ==============================================

/** En vane brugeren har valgt — enten fra kurateret liste eller egen tekst. */
export interface ValgtVane {
	id: string;
	label: string;
	kilde: 'kurateret' | 'egen';
}

/** Brugerens opsætning. Et top-level doc pr bruger. */
export interface AboVaneOpsaetning {
	valgteVaner: ValgtVane[];
	produktType: 'basis' | 'premium';
	oprettetAt: Timestamp;
	opdateretAt: Timestamp;
	/**
	 * Hvis sat: baseline-check-in tælles kun fra og med denne dato.
	 * Brugeren kan trykke 'Nulstil baseline' for at starte sammenligning
	 * forfra (relevant for langtidskunder).
	 */
	baselineNulstilletAt?: Timestamp;
}

/**
 * Brugerens svar for én dato. Doc-id er datoen som YYYY-MM-DD.
 * bonus indeholder kun ét svar pr dag (svarende til dagensBonus-rotation).
 */
export interface AboVanedagEntry {
	dato: string;
	checks: Record<string, VaneSvar>;
	bonus?: { id: string; svar: AboBonusSvar; note?: string } | null;
	checkin: CheckinSvar;
	note: string;
	savedAt?: Timestamp;
}

// ==============================================
// Dato-helpers
// ==============================================

/** Formaterer en Date til YYYY-MM-DD i lokal tid. Bruges som doc-id. */
export function formaterDato(d: Date): string {
	const aar = d.getFullYear();
	const maaned = String(d.getMonth() + 1).padStart(2, '0');
	const dag = String(d.getDate()).padStart(2, '0');
	return `${aar}-${maaned}-${dag}`;
}

/** Parser en YYYY-MM-DD streng til Date i lokal tid (midnat). */
export function parseDato(s: string): Date {
	const [aar, maaned, dag] = s.split('-').map(Number);
	return new Date(aar, maaned - 1, dag);
}

/** Søndag er den ugentlige check-in-dag. */
export function erUgentligCheckinDag(d: Date): boolean {
	return d.getDay() === 0;
}

// ==============================================
// Skabelon-helpers
// ==============================================

export function maksAntalVaner(produktType: 'basis' | 'premium'): number {
	return produktType === 'premium' ? PREMIUM_MAKS_VANER : BASIS_MAKS_VANER;
}

/**
 * Vælger dagens bonus-spørgsmål fra puljen via deterministisk rotation.
 * Samme dato giver altid samme spørgsmål for samme pulje.
 *
 * Bruger en simpel hash af YYYY-MM-DD så rotationen er stabil men
 * ikke for forudsigelig (ikke bare modulo dagen i året).
 */
export function dagensBonus(
	pulje: AboBonusForslag[],
	dato: string
): AboBonusForslag | null {
	if (pulje.length === 0) return null;
	let hash = 0;
	for (let i = 0; i < dato.length; i++) {
		hash = (hash * 31 + dato.charCodeAt(i)) | 0;
	}
	const idx = Math.abs(hash) % pulje.length;
	return pulje[idx];
}

// ==============================================
// Status og scoring
// ==============================================

const tomEntry = (dato: string): AboVanedagEntry => ({
	dato,
	checks: {},
	bonus: null,
	checkin: {},
	note: ''
});

/**
 * Beregner status for en abo-vanedag.
 *
 * - empty: intet svar
 * - completed: alle valgte vaner = 'ja' OG (hvis isCheckin) alle 5 sliders sat
 * - partial: noget er svaret men ikke alt
 */
export function beregnAboDagsStatus(
	valgteVaner: ValgtVane[],
	bonus: AboBonusForslag | null,
	isCheckin: boolean,
	entry: AboVanedagEntry | null
): DagStatus {
	const e = entry ?? tomEntry('');

	const harSvarPaaEnVane = valgteVaner.some((v) => e.checks?.[v.id]);
	const harBonusSvar = !!(bonus && e.bonus && e.bonus.id === bonus.id);
	const harNote = (e.note ?? '').trim().length > 0;
	const harCheckinSvar =
		isCheckin &&
		CHECKIN_SPORGSMAAL.some((q) => typeof e.checkin?.[q.id as keyof CheckinSvar] === 'number');

	if (!harSvarPaaEnVane && !harBonusSvar && !harNote && !harCheckinSvar) return 'empty';

	const ja = valgteVaner.filter((v) => e.checks?.[v.id] === 'ja').length;
	const alleVanerJa = valgteVaner.length > 0 && ja === valgteVaner.length;
	const checkinOk =
		!isCheckin ||
		CHECKIN_SPORGSMAAL.every(
			(q) => typeof e.checkin?.[q.id as keyof CheckinSvar] === 'number'
		);

	if (alleVanerJa && checkinOk) return 'completed';
	return 'partial';
}

/**
 * Beregner trend-score for bonus-svarene over en serie af dage.
 *
 * Returnerer procent positive svar (0-100). Index 0 = positiv = 1.0,
 * index 1 = neutral = 0.5, index 2 = negativ = 0.0. Dage uden bonus-svar
 * tælles ikke med.
 *
 * Hvis du vil have trend pr kategori, send entries kun fra dage hvor
 * bonus.id matcher en bestemt kategori — eller udvid funktionen med
 * en bonus-pulje-parameter til at slå kategori op.
 */
export function aboTrendScore(
	entries: AboVanedagEntry[]
): { antal: number; score: number } {
	let sum = 0;
	let antal = 0;
	for (const e of entries) {
		if (!e.bonus || typeof e.bonus.svar !== 'number') continue;
		antal++;
		sum += (2 - e.bonus.svar) / 2;
	}
	if (antal === 0) return { antal: 0, score: 0 };
	return { antal, score: Math.round((sum / antal) * 100) };
}

/**
 * Beregner flower-niveau for en abo-vanedag.
 * Samme tærskler som forløbet (excellent/good/medium/low/poor/none).
 */
export function beregnAboFlowerNiveau(
	valgteVaner: ValgtVane[],
	entry: AboVanedagEntry | null
): FlowerNiveau {
	const e = entry ?? tomEntry('');
	if (valgteVaner.length === 0) return 'none';

	const score = valgteVaner.reduce((sum, v) => {
		const svar = e.checks?.[v.id];
		return sum + (svar === 'ja' ? 1 : svar === 'delvist' ? 0.5 : 0);
	}, 0);
	const procent = (score / valgteVaner.length) * 100;

	if (procent >= 100) return 'excellent';
	if (procent >= 76) return 'good';
	if (procent >= 51) return 'medium';
	if (procent >= 26) return 'low';
	if (procent > 0) return 'poor';
	return 'none';
}

/**
 * Statistik for en specifik vane på tværs af alle besvarede dage.
 * Score 0-100 hvor delvist tæller som 0.5. Kun dage med svar tælles.
 */
export function aboVaneStatistik(
	vaneId: string,
	entries: AboVanedagEntry[]
): { antal: number; score: number } {
	let antal = 0;
	let sum = 0;
	for (const e of entries) {
		const svar = e.checks?.[vaneId];
		if (!svar) continue;
		antal++;
		sum += svar === 'ja' ? 1 : svar === 'delvist' ? 0.5 : 0;
	}
	if (antal === 0) return { antal: 0, score: 0 };
	return { antal, score: Math.round((sum / antal) * 100) };
}

/**
 * Samlet procent vaner opnået på tværs af alle dage hvor brugeren har
 * besvaret mindst én vane. Hver vane vægtes lige. 'ja' = 1, 'delvist' = 0.5,
 * 'nej' = 0. Returnerer { antalDage, score } hvor score er 0-100.
 *
 * Eksempel: bruger har 3 vaner, har besvaret 4 dage. På dag 1 har hun 3 ja
 * = 100%. På dag 2 har hun 2 ja og 1 delvist = 83%. Osv. Samlet score er
 * gennemsnittet af dagsscorerne.
 */
export function aboVaneSamletProcent(
	valgteVaner: ValgtVane[],
	entries: AboVanedagEntry[]
): { antalDage: number; score: number } {
	if (valgteVaner.length === 0) return { antalDage: 0, score: 0 };

	let antalDage = 0;
	let sumDage = 0;
	for (const e of entries) {
		const harSvarPaaEnVane = valgteVaner.some((v) => e.checks?.[v.id]);
		if (!harSvarPaaEnVane) continue;
		antalDage++;
		const dagScore = valgteVaner.reduce((s, v) => {
			const svar = e.checks?.[v.id];
			return s + (svar === 'ja' ? 1 : svar === 'delvist' ? 0.5 : 0);
		}, 0);
		sumDage += dagScore / valgteVaner.length;
	}
	if (antalDage === 0) return { antalDage: 0, score: 0 };
	return { antalDage, score: Math.round((sumDage / antalDage) * 100) };
}

/**
 * Returnerer den FØRSTE entry hvor alle 5 sliders er udfyldt — bruges som
 * baseline til sammenligning. Sorterer entries efter dato.
 *
 * Hvis fraDato er givet, returneres den første komplette check-in PÅ ELLER
 * EFTER den dato. Bruges til 'nulstil baseline'-funktionen så langtidskunder
 * kan starte sammenligning forfra.
 */
export function forsteCheckin(
	entries: AboVanedagEntry[],
	fraDato?: string
): AboVanedagEntry | null {
	const sorteret = [...entries].sort((a, b) => a.dato.localeCompare(b.dato));
	for (const e of sorteret) {
		if (fraDato && e.dato < fraDato) continue;
		if (harKomplettCheckin(e)) return e;
	}
	return null;
}

/**
 * Returnerer den SENESTE entry hvor alle 5 sliders er udfyldt.
 * Bruges til 'din udvikling siden baseline'-visning.
 */
export function senesteCheckin(entries: AboVanedagEntry[]): AboVanedagEntry | null {
	const sorteret = [...entries].sort((a, b) => b.dato.localeCompare(a.dato));
	for (const e of sorteret) {
		if (harKomplettCheckin(e)) return e;
	}
	return null;
}

function harKomplettCheckin(e: AboVanedagEntry): boolean {
	if (!e.checkin) return false;
	return CHECKIN_SPORGSMAAL.every(
		(q) => typeof e.checkin[q.id as keyof CheckinSvar] === 'number'
	);
}

/**
 * Returnerer alle entries med komplet 5-slider check-in, sorteret
 * kronologisk. fraDato er valgfri (filtrerer 'fra og med'). Bruges
 * af linje-grafen.
 */
export function alleCheckins(
	entries: AboVanedagEntry[],
	fraDato?: string
): AboVanedagEntry[] {
	return entries
		.filter((e) => harKomplettCheckin(e))
		.filter((e) => !fraDato || e.dato >= fraDato)
		.sort((a, b) => a.dato.localeCompare(b.dato));
}

/**
 * Tæller hvor mange dage i intervallet der har status='completed'.
 * fraDato/tilDato inklusive, format YYYY-MM-DD.
 */
export function beregnAboFremgang(
	valgteVaner: ValgtVane[],
	entries: Map<string, AboVanedagEntry>,
	bonusPulje: AboBonusForslag[],
	fraDato: string,
	tilDato: string
): { gennemforte: number; iAlt: number } {
	const fra = parseDato(fraDato);
	const til = parseDato(tilDato);
	let gennemforte = 0;
	let iAlt = 0;
	const cur = new Date(fra);
	while (cur <= til) {
		const datoStr = formaterDato(cur);
		const bonus = dagensBonus(bonusPulje, datoStr);
		const status = beregnAboDagsStatus(valgteVaner, bonus, false, entries.get(datoStr) ?? null);
		if (status === 'completed') gennemforte++;
		iAlt++;
		cur.setDate(cur.getDate() + 1);
	}
	return { gennemforte, iAlt };
}
