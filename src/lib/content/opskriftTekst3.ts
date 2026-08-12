// ============================================================
// Opskriftens tekst: fremgangsmaade og tilberedningstid.
//
// PROBLEMET. Makro-tallene er gemt som en tekstlinje NEDERST i
// instruktioner-feltet, og feltet blev vist raat. Kunden laeste derfor
//
//   Protein: 24 g | Fiber: 11 g | Kulhydrater: 44 g | Fedt: 16 g |
//   Kalorier: 440 kcal | Tid: 15 minutter
//
// som sidste punkt under Fremgangsmaade, selv om de samme tal staar paent
// opsat oeverst i arket. Hun fik dem altsaa to gange, og anden gang som en
// teknisk streng midt i madlavningen. Den gamle app goer det samme, saa det
// er ikke noget 3.0 har oedelagt.
//
// VI RØRER IKKE DATA. Linjen ER kilden til alle fem makro-tal, se
// parseOpskriftMakro. Slettes den i teksten, mister alle 130 opskrifter deres
// naeringstal i BEGGE apps paa én gang. Derfor klipper vi den kun ud af
// VISNINGEN, og dokumentet bliver liggende uroert.
//
// Maalt 12. august 2026 paa alle 130 aktive opskrifter:
//   - 130 af 130 har linjen paa sin EGEN linje
//   - 130 af 130 har den som den SIDSTE linje med indhold
//   - 129 af 130 har et Tid-felt, med 21 forskellige vaerdier fra 3 til 50
//     minutter
//
// Den langsigtede loesning er at flytte makro ud i egne felter paa
// opskriften i stedet for at gemme tal inde i en tekst. Det er en migrering
// der rører den gamle app, og den er ikke lavet.
// ============================================================

/** En linje er makro-linjen hvis den BEGYNDER med Protein og et tal. */
const MAKRO_LINJE = /^\s*Protein:\s*\d/i;

/**
 * Fremgangsmaaden, som kunden skal laese den, altsaa uden makro-linjen.
 *
 * Kun linjer der BEGYNDER med "Protein:" fjernes. Stod tallene midt i en
 * linje med rigtige instruktioner, ville vi ellers kunne komme til at slette
 * et trin. Det sker ikke i dag paa nogen af de 130, men reglen er skrevet
 * saadan at den fejler paa den sikre side hvis en fremtidig opskrift ser
 * anderledes ud: saa staar linjen der bare, som den goer i dag.
 */
export function fremgangsmaade(instruktioner: string | undefined): string {
	if (!instruktioner) return '';
	return instruktioner
		.split('\n')
		.filter((linje) => !MAKRO_LINJE.test(linje))
		.join('\n')
		.trim();
}

/**
 * Tilberedningstiden, fx "15 minutter", eller null hvis den ikke er der.
 *
 * Tid staar i den samme linje som makroen, sidst, efter en lodret streg.
 * Naar linjen forsvinder fra visningen, ville tiden ryge med, og den er
 * brugbar. Derfor traekkes den ud og vises for sig.
 */
export function tilberedningstid(instruktioner: string | undefined): string | null {
	if (!instruktioner) return null;
	const m = instruktioner.match(/Tid:\s*([^|\n]+)/i);
	if (!m) return null;
	const t = m[1].trim();
	return t.length > 0 ? t : null;
}
