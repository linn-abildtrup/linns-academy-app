// ============================================================
// Stjernen paa en enkelt foedevare i 3.0. Se SPEC-3.0.md 26.15.
//
// HVOR DE LIGGER: userDoc.favoritFodevarer, et array af foedevare-id'er.
// Feltet findes allerede i den gamle app, saa der er ikke opfundet noget
// nyt, og de 6.855 stjerner der findes virker fra dag ét.
//
// MAALT 12. august 2026:
//   305 kunder, altsaa halvdelen, har stjernet noget. Median 13
//   72 % af stjernerne er hendes EGNE foedevarer, sat automatisk af den
//     gamle app hver gang hun oprettede en vare. Dem har hun ikke valgt
//   kun 18 % af de stjernede ville staa paa fliserne under Det du plejer
//
// DE TO REGLER DER FOELGER AF MAALINGEN:
//   1. hendes EGNE foedevarer holdes UDE af stjerne-listen. De ligger
//      allerede under Mine, og uden filteret ville halvdelen af listen
//      vaere en kopi af den anden halvdel
//   2. 3.0 saetter ALDRIG stjernen automatisk. Gjorde vi det, ville
//      listen igen fyldes med noget hun ikke har valgt, og saa er tallet
//      ubrugeligt naeste gang nogen maaler
//
// Feltet er med vilje IKKE skrevet ind i lib/types.ts. Den fil er delt
// med den app der er i drift. Derfor laeses det gennem stjernerFra() her,
// saa castet ligger ét sted og kan testes. Se CLAUDE.md regel 2.
// ============================================================

import type { Fodevare } from './kost';

/** Navnet paa feltet paa kundens dokument. Samme som den gamle app. */
export const STJERNE_FELT = 'favoritFodevarer';

/**
 * Kundens stjernede foedevarer, laest sikkert af hendes dokument.
 *
 * Taaler at feltet mangler, og at der skulle ligge noget maerkeligt i det.
 * Dubletter fjernes: de kan ikke opstaa via skiftStjerne, men et gammelt
 * dokument kunne have dem, og saa ville listen taelle forkert.
 */
export function stjernerFra(userDoc: unknown): string[] {
	const raa = (userDoc as Record<string, unknown> | null | undefined)?.[STJERNE_FELT];
	if (!Array.isArray(raa)) return [];
	const set = new Set<string>();
	for (const x of raa) {
		if (typeof x !== 'string') continue;
		const t = x.trim();
		if (t) set.add(t);
	}
	return [...set];
}

export function erStjernet(stjerner: string[], foodId: string): boolean {
	return stjerner.includes(foodId);
}

/** Listen med stjernen slaaet til eller fra. Roerer ikke den oprindelige. */
export function skiftStjerne(stjerner: string[], foodId: string): string[] {
	if (!foodId) return stjerner;
	return erStjernet(stjerner, foodId)
		? stjerner.filter((x) => x !== foodId)
		: [...stjerner, foodId];
}

/**
 * De stjernede foedevarer, klar til hylden.
 *
 * HENDES EGNE HOLDES UDE. 72 % af stjernerne er varer hun selv har
 * oprettet, og dem sætter den gamle app automatisk. De staar i forvejen
 * under Mine egne foedevarer, og uden det her filter ville de staa to
 * gange i det samme ark.
 *
 * En stjerne paa en vare der ikke findes laengere springes over. Den kan
 * hverken vises eller bruges, og en tom raekke ligner en fejl.
 */
export function stjernedeFodevarer(
	stjerner: string[],
	foods: Map<string, Fodevare>,
	egneIds: Set<string>
): Fodevare[] {
	const ud: Fodevare[] = [];
	for (const id of stjerner) {
		if (egneIds.has(id)) continue;
		const f = foods.get(id);
		if (!f) continue;
		ud.push(f);
	}
	return ud.sort((a, b) => a.name.localeCompare(b.name, 'da'));
}
