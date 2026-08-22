// ============================================================
// Kunden vaelger selv sine smaa skridt.
//
// TO SPOR, OG DE MAA IKKE BLANDES.
//
//  - Et MEDLEM uden forloeb vaelger alle sine skridt selv, op til tre.
//    Hun kan tage fra Linns forslag eller skrive sine egne.
//  - En kunde PAA ET FORLOEB faar Linns skridt for dagen og maa laegge op
//    til tre af sine EGNE oveni. Linns kan hun ikke fjerne, for de er
//    forloebet. Forslagene vises ikke, for hun har allerede skridt.
//
// Reglerne herunder er de samme for begge, saa der kun findes ét sted
// hvor "hvornaar er der plads til flere" bliver besvaret.
//
// TRE ER MENINGEN, IKKE EN BEGRAENSNING. Den gamle app slukkede bare
// knapperne naar der var valgt tre. Vi siger hvorfor, se tilbageTekst3.
// ============================================================

/** Hvor mange skridt hun maa have ad gangen. Samme tal som i den gamle app. */
export const MAKS_SKRIDT3 = 3;

/** Hvor langt hendes eget skridt maa vaere. Samme graense som i den gamle app. */
export const MAKS_TEGN3 = 60;

/** Et af Linns forslag, som hun kan vaelge fra. */
export interface Forslag3 {
	id: string;
	label: string;
	kategori: string;
}

/** Et skridt hun har valgt. Samme form som den gamle app gemmer. */
export interface ValgtSkridt3 {
	id: string;
	label: string;
	kilde: 'kurateret' | 'egen';
}

/** Forslagene samlet under den overskrift Linn har skrevet paa dem. */
export interface Kategori3 {
	navn: string;
	forslag: Forslag3[];
}

/**
 * Grupperer forslagene i kategorier.
 *
 * Raekkefoelgen foelger listen som Linn har skrevet den, baade for
 * kategorierne og inden i hver kategori. Den gamle app viste kategorien
 * som en lille tekst under hvert forslag, og saa stod "Mad og naering"
 * fire gange spredt ud i listen.
 *
 * Et forslag uden kategori faar sin egen gruppe til sidst, saa det ikke
 * forsvinder.
 */
export function grupperForslag3(forslag: Forslag3[]): Kategori3[] {
	const UDEN = 'Andet';
	const orden: string[] = [];
	const kort = new Map<string, Forslag3[]>();
	for (const f of forslag) {
		const navn = f.kategori?.trim() || UDEN;
		if (!kort.has(navn)) {
			kort.set(navn, []);
			orden.push(navn);
		}
		kort.get(navn)!.push(f);
	}
	// "Andet" er ikke en kategori Linn har skrevet, saa den ligger sidst
	// uanset hvor det foerste ukategoriserede forslag stod i listen.
	const navne = [...orden.filter((n) => n !== UDEN), ...orden.filter((n) => n === UDEN)];
	return navne.map((navn) => ({ navn, forslag: kort.get(navn)! }));
}

/** Er der plads til et skridt mere. */
export function kanVaelgeFlere3(valgte: ValgtSkridt3[]): boolean {
	return valgte.length < MAKS_SKRIDT3;
}

/** Er dette forslag valgt. */
export function erValgt3(valgte: ValgtSkridt3[], forslagId: string): boolean {
	return valgte.some((v) => v.id === forslagId);
}

/**
 * Det valgte skridt der svarer til et forslag, eller null.
 *
 * PAA FORLOEBS-SPORET GEMMES ET FORSLAG SOM HENDES EGET. Hun har ikke en
 * liste med afkrydsninger som medlemmet har, hun har en haandfuld egne
 * skridt, og et forslag hun trykker paa bliver til ét af dem. Derfor kan
 * id'et ikke bruges til at genkende det, og vi maa se paa teksten.
 *
 * Tilfoejet 22. august: Linn saa at en forloebskunde slet ingen forslag
 * fik, og skulle skrive alt selv.
 */
export function matchForslag3(valgte: ValgtSkridt3[], forslag: Forslag3): ValgtSkridt3 | null {
	const paaId = valgte.find((v) => v.id === forslag.id);
	if (paaId) return paaId;
	const tekst = forslag.label.trim().toLowerCase();
	return valgte.find((v) => v.label.trim().toLowerCase() === tekst) ?? null;
}

/**
 * Slaar et forslag til eller fra.
 *
 * Er der ikke plads, sker der ingenting. Det er med vilje at den ikke
 * skubber et andet skridt ud: hun skal selv vaelge hvad der skal vaek,
 * ellers forsvinder noget hun ikke bad om at miste.
 */
export function skiftForslag3(valgte: ValgtSkridt3[], forslag: Forslag3): ValgtSkridt3[] {
	if (erValgt3(valgte, forslag.id)) return valgte.filter((v) => v.id !== forslag.id);
	if (!kanVaelgeFlere3(valgte)) return valgte;
	return [...valgte, { id: forslag.id, label: forslag.label, kilde: 'kurateret' }];
}

/** Fjerner et skridt, uanset om det er Linns forslag eller hendes eget. */
export function fjernSkridt3(valgte: ValgtSkridt3[], id: string): ValgtSkridt3[] {
	return valgte.filter((v) => v.id !== id);
}

/**
 * Hvorfor hendes egen tekst ikke kan bruges, eller null hvis den kan.
 *
 * Dubletten tjekkes uden hensyn til store bogstaver og mellemrum i
 * enderne. To skridt der hedder det samme er to afkrydsninger hun ikke
 * kan kende fra hinanden paa dagen.
 */
export function egetSkridtFejl3(tekst: string, valgte: ValgtSkridt3[]): string | null {
	const ren = tekst.trim();
	if (!ren) return 'Skriv hvad dit lille skridt er.';
	if (ren.length > MAKS_TEGN3) return `Hold det under ${MAKS_TEGN3} tegn, saa det kan staa på én linje.`;
	if (valgte.some((v) => v.label.trim().toLowerCase() === ren.toLowerCase()))
		return 'Det skridt har du allerede.';
	if (!kanVaelgeFlere3(valgte)) return `Du har allerede ${MAKS_SKRIDT3}. Fjern ét først.`;
	return null;
}

/**
 * Laegger hendes eget skridt til. Kalderen giver id'et, for det skal
 * vaere det samme id der gemmes i databasen.
 */
export function tilfoejEget3(valgte: ValgtSkridt3[], id: string, tekst: string): ValgtSkridt3[] {
	if (egetSkridtFejl3(tekst, valgte)) return valgte;
	return [...valgte, { id, label: tekst.trim(), kilde: 'egen' }];
}

const TAL_ORD = ['Ingen', 'Ét', 'To', 'Tre'];

/**
 * Linjen paa flisen under Din side.
 *
 * Den skriver HVAD hun har valgt og ikke bare at man kan vaelge noget.
 * Saa virker flisen ogsaa som en paamindelse de dage hun ikke har vaeret
 * inde paa forsiden.
 */
export function opsummering3(valgte: ValgtSkridt3[]): { titel: string; under: string } {
	if (valgte.length === 0)
		return { titel: 'Vælg op til tre', under: 'Små ting du vil gøre hver dag' };
	return {
		titel: `${TAL_ORD[valgte.length] ?? valgte.length} valgt`,
		under: valgte.map((v) => v.label).join(', ')
	};
}

/**
 * Linjen der forklarer hvorfor der ikke kan vaelges flere.
 *
 * Tom naar der er plads. Naar der ikke er, siger den bade hvad hun kan
 * goere og at tre er meningen. En slukket knap uden forklaring laeser som
 * en fejl i appen.
 */
export function tilbageTekst3(valgte: ValgtSkridt3[]): string {
	if (kanVaelgeFlere3(valgte)) return '';
	return 'Vil du bytte et ud, så fjern et først. Tre er nok til at det kan lykkes.';
}
