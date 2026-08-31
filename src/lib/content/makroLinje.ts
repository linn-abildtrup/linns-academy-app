// ============================================================
// Makro-linjen nederst i en opskrift.
//
// HVORFOR EN LINJE OG IKKE FELTER. Opskrifternes naeringstal har aldrig
// vaeret felter. De staar som én linje tekst nederst i fremgangsmaaden:
//
//   Protein: 24 g | Fiber: 11 g | Kulhydrater: 44 g | Fedt: 16 g |
//   Kalorier: 440 kcal | Tid: 15 minutter
//
// BEGGE apps laeser den linje, den gamle og 3.0. Derfor bliver et rettet
// tal synligt begge steder med det samme, og der findes ikke to kilder der
// kan komme i utakt. Linns krav 31. august 2026: det skal gaelde begge
// apps.
//
// Her ligger kun teksten. Selve aflaesningen af tallene bliver ved med at
// ske i parseOpskriftMakro, saa der er ét sted der kender formatet.
//
// FORSIGTIGT MED TEKSTEN. Fremgangsmaaden er Linns egne ord. Vi roerer kun
// den ene linje der BEGYNDER med "Protein:", aldrig andet. Maalt 12. august
// 2026: alle 130 opskrifter har linjen paa sin egen linje, og som den
// sidste linje med indhold.
// ============================================================

/** En linje er makro-linjen hvis den BEGYNDER med Protein og et tal. */
const MAKRO_LINJE = /^\s*Protein:\s*\d/i;

export interface MakroFelter {
	protein: number | null;
	fiber: number | null;
	kh: number | null;
	fedt: number | null;
	kalorier: number | null;
}

/** Tallet som det skal staa: 24, ikke 24.0, og 7,5 med komma. */
function tal(v: number): string {
	return Number.isInteger(v) ? String(v) : String(v).replace('.', ',');
}

/**
 * Tilberedningstiden fra linjen, fx "15 minutter". Null hvis den ikke er
 * der. Vi laeser den for at kunne skrive den tilbage uaendret.
 */
export function tidenILinjen(instruktioner: string): string | null {
	const m = instruktioner.match(/Tid:\s*([^|\n]+)/i);
	return m ? m[1].trim() : null;
}

/**
 * Bygger selve linjen. Felter uden tal springes over, saa vi aldrig
 * skriver et nul som var det en maaling.
 */
export function byggMakroLinje(makro: MakroFelter, tid: string | null): string {
	const dele: string[] = [];
	if (makro.protein !== null) dele.push(`Protein: ${tal(makro.protein)} g`);
	if (makro.fiber !== null) dele.push(`Fiber: ${tal(makro.fiber)} g`);
	if (makro.kh !== null) dele.push(`Kulhydrater: ${tal(makro.kh)} g`);
	if (makro.fedt !== null) dele.push(`Fedt: ${tal(makro.fedt)} g`);
	if (makro.kalorier !== null) dele.push(`Kalorier: ${tal(makro.kalorier)} kcal`);
	if (tid) dele.push(`Tid: ${tid}`);
	return dele.join(' | ');
}

/**
 * Fremgangsmaaden med en ny makro-linje.
 *
 * Findes linjen, byttes den ud paa sin plads. Findes den ikke, saettes den
 * nederst efter en tom linje. Er der ingen tal overhovedet, fjernes linjen
 * helt i stedet for at efterlade en tom stump.
 *
 * Resten af teksten staar praecis som den stod, ogsaa mellemrum og tomme
 * linjer.
 */
export function skrivMakroLinje(
	instruktioner: string,
	makro: MakroFelter,
	tid: string | null
): string {
	const linje = byggMakroLinje(makro, tid);
	const linjer = instruktioner.split('\n');
	const plads = linjer.findIndex((l) => MAKRO_LINJE.test(l));

	if (plads !== -1) {
		if (!linje) {
			linjer.splice(plads, 1);
			// Efterlader vi en tom linje til sidst, ryddes den med.
			while (linjer.length && linjer[linjer.length - 1].trim() === '') linjer.pop();
			return linjer.join('\n');
		}
		linjer[plads] = linje;
		return linjer.join('\n');
	}

	if (!linje) return instruktioner;
	const rest = instruktioner.replace(/\s+$/, '');
	return rest ? `${rest}\n\n${linje}` : linje;
}
