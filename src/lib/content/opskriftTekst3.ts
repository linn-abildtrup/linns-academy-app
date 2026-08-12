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

/** Et afsnit i fremgangsmaaden. */
export interface Trin {
	tekst: string;
	/** Et nummereret madlavnings-trin, eller en note som "Tip: ..." til sidst. */
	nummereret: boolean;
}

/** Tomme linjer adskiller afsnit, fx trinnene fra en afsluttende note. */
const AFSNIT = /\n\s*\n/;

/**
 * Deler ét afsnit op ved "1. ", "2. " og saa videre. Null hvis det ikke er en
 * nummereret raekke.
 *
 * KUN en raekke der begynder paa 1 og taeller ét op ad gangen accepteres. Uden
 * den regel ville "Bag i ovnen. Skaer i 4. Server straks" blive delt midt i en
 * saetning. Med den skal tallene passe hele vejen, og et enkelt tal i teksten
 * kan ikke aabne et nyt trin.
 */
function delEfterNumre(afsnit: string): string[] | null {
	const rx = /(?:^|\s)(\d{1,2})[.)]\s+/g;
	const fundne: { nr: number; start: number; slut: number }[] = [];
	let m: RegExpExecArray | null;
	while ((m = rx.exec(afsnit)) !== null) {
		const forspring = m[0].length - m[0].trimStart().length;
		fundne.push({ nr: Number(m[1]), start: m.index + forspring, slut: m.index + m[0].length });
	}

	const brugbare: typeof fundne = [];
	let venter = 1;
	for (const f of fundne) {
		if (f.nr === venter) {
			brugbare.push(f);
			venter++;
		}
	}
	// Ét trin er ikke en raekke. Saa er tallet formentlig en maengde i teksten.
	if (brugbare.length < 2) return null;

	const ud: string[] = [];
	for (let i = 0; i < brugbare.length; i++) {
		const til = i + 1 < brugbare.length ? brugbare[i + 1].start : afsnit.length;
		const tekst = afsnit.slice(brugbare[i].slut, til).trim();
		if (tekst) ud.push(`${brugbare[i].nr}. ${tekst}`);
	}
	return ud.length >= 2 ? ud : null;
}

/**
 * Fremgangsmaaden delt op i afsnit, saa hvert trin kan staa for sig med luft
 * imellem i stedet for at loebe sammen til én blok tekst.
 *
 * Opskrifterne er IKKE skrevet ens, og det er hele grunden til at det her er
 * mere end et linjeskift. Nogle har hvert trin paa sin egen linje. Andre har
 * alle fire trin i én lang linje. Derfor deles der foerst paa tomme linjer,
 * saa paa numrene, og til sidst paa almindelige linjeskift.
 *
 * Kan et afsnit ikke deles, staar det som det er. Reglen kan altsaa aldrig
 * goere teksten daarligere end den var.
 */
export function fremgangsmaadeTrin(instruktioner: string | undefined): Trin[] {
	const hel = fremgangsmaade(instruktioner);
	if (!hel) return [];

	const ud: Trin[] = [];
	for (const afsnit of hel.split(AFSNIT)) {
		const rent = afsnit.trim();
		if (!rent) continue;

		const numre = delEfterNumre(rent);
		if (numre) {
			for (const t of numre) ud.push({ tekst: t, nummereret: true });
			continue;
		}
		// Ingen numre. Saa er hver linje sit eget afsnit, fx en note over to
		// linjer, eller trin skrevet uden tal.
		for (const linje of rent.split('\n')) {
			const l = linje.trim();
			if (l) ud.push({ tekst: l, nummereret: false });
		}
	}
	return ud;
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
