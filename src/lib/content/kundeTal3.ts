// ============================================================
// Kundens egne tal, som AI'en skal kunne svare ud fra.
//
// Linns oenske 1. september 2026. Foer den her fil kunne AI'en kun svare
// generelt: spurgte kunden "faar jeg protein nok", vidste den ikke at
// kunden i gaar fik 42 gram.
//
// LINNS REGEL FRA UDVIKLING GAELDER OGSAA HER, og den er vigtigere end
// tallene: EN STATUS MAA ALDRIG LAESE SOM EN ANKLAGE. Se 9.26 i
// overdragelsen. Den gamle Udvikling-side gjorde det fire steder uden at
// det var ondt ment, fx "12 af 30 dage", hvor kunden laeser de 18 dage
// hun ikke gjorde det.
//
// Derfor:
//  - vi taeller de dage hun HAR registreret, ikke dem hun ikke har
//  - snittet regnes pr dag hun har registreret, saa en uge uden
//    registrering ikke traekker hende ned
//  - maalet naevnes, men "under maalet" skrives aldrig som en mangel
//
// OG TALLENE ER IKKE EN DIAGNOSE. AI'en faar besked paa at bruge dem til
// at svare konkret, ikke til at vurdere hendes helbred.
//
// FILEN LAESER KUN.
// ============================================================

/** Én registreret madvare, som den ligger i kundens dagbog. */
export interface Maaltid {
	dato: string;
	protein?: number;
	fiber?: number;
}

export interface KundeTal {
	/** Dagens tal indtil nu. */
	iDagProtein: number;
	iDagFiber: number;
	/** Har hun overhovedet registreret noget i dag. */
	harRegistreretIDag: boolean;
	/** Snit pr dag hun HAR registreret, de sidste syv dage. */
	snitProtein: number;
	snitFiber: number;
	/** Hvor mange af de sidste syv dage hun har registreret paa. */
	dageMed: number;
	/** Hendes egne maal, eller standarden. */
	maalProtein: number;
	maalFiber: number;
}

export const STANDARD_PROTEIN = 90;
export const STANDARD_FIBER = 30;

function rund(x: number): number {
	return Math.round(x);
}

/** Dato-noeglen for en dag, altsaa 2026-09-01. */
export function datoNoegle(ms: number): string {
	return new Date(ms).toISOString().slice(0, 10);
}

/**
 * Regner kundens tal ud af hendes maaltider.
 *
 * `maaltider` er de sidste syv dage inklusive i dag.
 */
export function byggKundeTal(
	maaltider: Maaltid[],
	nu: number,
	maalProtein?: number | null,
	maalFiber?: number | null
): KundeTal {
	const iDag = datoNoegle(nu);
	const perDag = new Map<string, { p: number; f: number }>();

	for (const m of maaltider) {
		if (!m?.dato) continue;
		const d = perDag.get(m.dato) ?? { p: 0, f: 0 };
		d.p += Number(m.protein) || 0;
		d.f += Number(m.fiber) || 0;
		perDag.set(m.dato, d);
	}

	const dagen = perDag.get(iDag);
	// Kun de dage hun HAR registreret paa. Se reglen i filens hoved.
	const dage = [...perDag.values()];

	return {
		iDagProtein: rund(dagen?.p ?? 0),
		iDagFiber: rund(dagen?.f ?? 0),
		harRegistreretIDag: perDag.has(iDag),
		snitProtein: dage.length > 0 ? rund(dage.reduce((s, d) => s + d.p, 0) / dage.length) : 0,
		snitFiber: dage.length > 0 ? rund(dage.reduce((s, d) => s + d.f, 0) / dage.length) : 0,
		dageMed: dage.length,
		maalProtein: maalProtein && maalProtein > 0 ? maalProtein : STANDARD_PROTEIN,
		maalFiber: maalFiber && maalFiber > 0 ? maalFiber : STANDARD_FIBER
	};
}

/**
 * Teksten AI'en faar med.
 *
 * ORDLYDEN ER IKKE TILFAELDIG. Der staar hvad hun HAR gjort og aldrig hvad
 * hun ikke har. "Hun har registreret 5 af de sidste 7 dage" ville vaere
 * en anklage forklaedt som et tal, saa der staar bare hvor mange dage
 * snittet bygger paa.
 */
export function byggKundeTalTekst(t: KundeTal | null): string {
	if (!t) return '';
	const dele: string[] = ['HENDES EGNE TAL. Brug dem til at svare konkret, ikke til at bedømme hende:'];

	if (t.harRegistreretIDag) {
		dele.push(
			`I dag har hun registreret ${t.iDagProtein} g protein og ${t.iDagFiber} g fiber. Hendes mål er ${t.maalProtein} g protein og ${t.maalFiber} g fiber om dagen.`
		);
	} else {
		dele.push(
			`Hun har ikke registreret mad i dag endnu. Hendes mål er ${t.maalProtein} g protein og ${t.maalFiber} g fiber om dagen.`
		);
	}

	if (t.dageMed > 0) {
		dele.push(
			`På de ${t.dageMed} dage hun har registreret den seneste uge, ligger hun i snit på ${t.snitProtein} g protein og ${t.snitFiber} g fiber.`
		);
	} else {
		dele.push('Der er ingen registreringer den seneste uge, så du kan ikke sige noget om hendes tal.');
	}

	dele.push(
		[
			'REGLER FOR HENDES TAL:',
			'- Sig aldrig hvor mange dage hun IKKE har registreret, og læg hende aldrig noget til last. En status må aldrig læse som en bebrejdelse.',
			'- Tallene er kun det hun har tastet ind. De siger ikke hvad hun har spist, og de er ikke en vurdering af hendes helbred.',
			'- Ligger hun under sit mål, så hjælp hende videre med et konkret forslag i stedet for at gøre et nummer ud af tallet.',
			'- Nævn kun tallene hvis hun spørger om noget hvor de hjælper.'
		].join('\n')
	);

	return dele.join('\n\n') + '\n\n---\n';
}
