// ============================================================
// "Det du plejer" i 30-30 beregneren.
//
// HVORFOR DEN HER FIL ER DEN VIGTIGSTE I HELE MODULET:
//
// Maalt paa rigtige data 9. august 2026 over 60 dage, 11.201 maaltider
// og 222 aktive kunder:
//   68,5 % af alt kunderne registrerer er en gentagelse
//   hendes 10 hyppigste madvarer daekker 54 % af alt hun taster
//   hendes 20 hyppigste daekker 74 %
//   medianen er 13 madvarer paa en dag
//
// Derfor er den hurtigste vej ikke en bedre soegning, men at hun slet
// ikke skal soege. Fire fliser med hendes egne hyppigste, med den
// maengde hun plejer at bruge, goer over halvdelen af hendes dag til
// ét tryk.
//
// Tre ting SKAL foelge med, ellers virker det ikke:
//   1. maengden huskes pr madvare
//   2. listen er hendes egen, ikke en generel top-liste
//   3. den nye kunde faar de mest brugte paa tvaers indtil hun har sine
// ============================================================

import type { Maaltidstype } from './kost';

export interface PlejerPost {
	foodId: string;
	navn: string;
	/** Den maengde hun oftest bruger. */
	portion: number;
	enhedId?: string;
	/** Hvor mange gange hun har registreret den til det maaltid. */
	antal: number;
}

/** Det vi skal bruge fra hendes tidligere maaltider. */
export interface HistorikMaaltid {
	type: Maaltidstype;
	items: { foodId?: string; portion?: number; enhedId?: string; manuel?: { navn: string } }[];
	/**
	 * Dagen. Fliserne her i filen bruger den ikke, men de faste maaltider
	 * goer, for de skal laegge en hel dags maaltid sammen paa tvaers af
	 * dokumenterne. Se fasteMaaltider3.brugsstatistik. Den ligger her og
	 * ikke i sin egen hentning, saa de 45 dage kun hentes én gang.
	 */
	dato?: string;
}

/** Navne slaas op udefra, saa den her fil kan testes uden database. */
export type NavneOpslag = (foodId: string) => string | undefined;

/** Fire fliser passer paa to raekker af to. Flere bliver til rulning. */
export const ANTAL_FLISER = 4;

/**
 * Hendes hyppigste madvarer til ét bestemt maaltid.
 *
 * Vi taeller pr maaltidstype og ikke paa tvaers, fordi hun spiser noget
 * andet til morgenmad end til aftensmad. En generel top-liste ville
 * foreslaa kylling til morgenmad.
 */
export function plejerFor(
	historik: HistorikMaaltid[],
	type: Maaltidstype,
	navneOpslag: NavneOpslag,
	antal: number = ANTAL_FLISER
): PlejerPost[] {
	const taelling = new Map<
		string,
		{ antal: number; portioner: Map<string, { portion: number; enhedId?: string; n: number }> }
	>();

	for (const m of historik) {
		if (m.type !== type) continue;
		for (const it of m.items ?? []) {
			const id = it.foodId;
			// Manuelt indtastede poster har intet foodId, saa de kan ikke
			// tilfoejes igen med ét tryk. De springes over.
			if (!id) continue;
			if (!taelling.has(id)) taelling.set(id, { antal: 0, portioner: new Map() });
			const t = taelling.get(id)!;
			t.antal++;
			const portion = it.portion ?? 0;
			if (portion > 0) {
				const noegle = `${portion}|${it.enhedId ?? 'g'}`;
				const p = t.portioner.get(noegle) ?? { portion, enhedId: it.enhedId, n: 0 };
				p.n++;
				t.portioner.set(noegle, p);
			}
		}
	}

	const ud: PlejerPost[] = [];
	for (const [foodId, t] of taelling) {
		const navn = navneOpslag(foodId);
		// Findes madvaren ikke laengere, kan vi hverken vise navn eller
		// regne makro. Saa er den ubrugelig som genvej.
		if (!navn) continue;
		// Den maengde hun oftest bruger. Ved uafgjort tager vi den mindste,
		// saa vi hellere giver for lidt end for meget.
		const bedste = [...t.portioner.values()].sort(
			(a, b) => b.n - a.n || a.portion - b.portion
		)[0];
		ud.push({
			foodId,
			navn,
			portion: bedste?.portion ?? 100,
			enhedId: bedste?.enhedId,
			antal: t.antal
		});
	}

	return ud
		.sort((a, b) => b.antal - a.antal || a.navn.localeCompare(b.navn, 'da'))
		.slice(0, antal);
}

/**
 * Har hun nok historik til at listen er hendes egen?
 *
 * Under den her graense viser vi de mest brugte paa tvaers af alle
 * kunder i stedet, saa den nye kunde ikke moeder fire tomme felter.
 */
export const NOK_HISTORIK = 3;

export function harEgenHistorik(poster: PlejerPost[]): boolean {
	return poster.length >= NOK_HISTORIK;
}
