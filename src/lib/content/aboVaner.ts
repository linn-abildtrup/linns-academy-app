// Abo-vanetracker — typer og pure-funktioner.
//
// Modsat forløbs-vanerne (vaner.ts) er abo-vaner cyklisk uden slut: brugeren
// vælger selv 3 (basis) eller op til 7 (premium) vaner fra en kurateret liste
// (eller skriver sine egne) og tjekker ind dagligt. 5-slider check-in tages
// ugentligt om søndagen. Bonus-spørgsmål roterer deterministisk fra en pulje.
//
// Vaner er låst i 21 dage efter sidste skift, så brugeren ikke kan zappe rundt.

import type { Timestamp } from 'firebase/firestore';
import type { VaneSvar, BonusSvar, CheckinSvar, DagStatus, FlowerNiveau } from './vaner';
import { CHECKIN_SPORGSMAAL } from './vaner';

export const LOCK_PERIODE_DAGE = 21;
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

/** Et bonus-spørgsmål i puljen. Roteres deterministisk pr dato. */
export interface AboBonusForslag {
	id: string;
	label: string;
}

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
	laastIndtil: Timestamp;
	oprettetAt: Timestamp;
	opdateretAt: Timestamp;
}

/** Brugerens svar for én dato. Doc-id er datoen som YYYY-MM-DD. */
export interface AboVanedagEntry {
	dato: string;
	checks: Record<string, VaneSvar>;
	bonus: Record<string, BonusSvar>;
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
// Lock-logik
// ==============================================

/** Returnerer true hvis brugeren må skifte vaner nu. */
export function kanSkifteVaner(
	opsaetning: AboVaneOpsaetning | null,
	now: Date = new Date()
): boolean {
	if (!opsaetning) return true;
	return opsaetning.laastIndtil.toMillis() <= now.getTime();
}

/** Beregner ny laastIndtil-dato = nu + 21 dage. */
export function beregnLockUdloeb(now: Date = new Date()): Date {
	const d = new Date(now);
	d.setDate(d.getDate() + LOCK_PERIODE_DAGE);
	return d;
}

// ==============================================
// Status og scoring
// ==============================================

const tomEntry = (dato: string): AboVanedagEntry => ({
	dato,
	checks: {},
	bonus: {},
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
	const harBonusSvar = bonus && e.bonus?.[bonus.id];
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
		const isCheckin = erUgentligCheckinDag(cur);
		const bonus = dagensBonus(bonusPulje, datoStr);
		const status = beregnAboDagsStatus(valgteVaner, bonus, isCheckin, entries.get(datoStr) ?? null);
		if (status === 'completed') gennemforte++;
		iAlt++;
		cur.setDate(cur.getDate() + 1);
	}
	return { gennemforte, iAlt };
}
