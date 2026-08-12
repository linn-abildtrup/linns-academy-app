// ============================================================
// Tal som hun ville skrive dem, delt af de skaerme hvor hun taster
// naeringstal selv. Se SPEC-3.0.md 26.11 og 26.12.
//
// Felterne er TEKST mens hun skriver, ikke tal. Et talfelt der bliver
// til NaN midt i en indtastning er en klassisk maade at tabe det hun
// har skrevet paa.
// ============================================================

/**
 * Laeser et tal som hun ville skrive det.
 *
 * Dansk komma skal virke: skriver hun 1,5 spsk, er det halvanden og
 * ikke femten. Tomt og volapyk bliver til nul, saa et halvfaerdigt felt
 * aldrig kan blive til NaN i hendes dagbog. "1," midt i "1,5" giver 1,
 * saa hendes tal ikke nulstilles mens hun skriver det.
 */
export function talFra(tekst: string): number {
	const rent = (tekst ?? '').trim().replace(',', '.').replace(/\s/g, '');
	if (!rent) return 0;
	const n = Number(rent);
	if (!Number.isFinite(n) || n < 0) return 0;
	return Math.round(n * 100) / 100;
}

/** Tallet tilbage som tekst, med dansk komma. */
export function talTil(n: number | undefined): string {
	if (n === undefined || n === null) return '';
	return String(n).replace('.', ',');
}

/**
 * Kalorier regnet af makroerne, naar hun ikke selv skriver et tal.
 * Atwater: protein og kulhydrat 4 kcal pr gram, fedt 9. Samme formel
 * som den gamle apps dialog, saa de to apper aldrig kan regne forskelligt.
 */
export function udregnetKcal(protein: number, kh: number, fedt: number): number {
	return Math.round(protein * 4 + kh * 4 + fedt * 9);
}
