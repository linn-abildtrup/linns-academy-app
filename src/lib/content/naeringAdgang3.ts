// ============================================================
// Hvem ser udvidet naering, og hvem maa rette sine egne maal.
//
// LINNS BESLUTNING 22. august 2026. Der er to kontakter, og de styres i
// tre lag:
//
//  1. En UNDTAGELSE paa kunden selv vinder altid
//  2. Ellers gaelder det FORLOEB hun er paa lige nu
//  3. Ellers gaelder linjen for alle MEDLEMMER
//
// ALT ER SLAAET TIL SOM STANDARD. Linn slaar fra, ikke til. Ellers ville
// kunder der har noget i dag pludselig miste det.
//
// DEN GAMLE APP SPOERGER IKKE HER. Den har sit eget skema pr kundetype i
// "Funktioner og adgang", og det styrer 760 kunder i drift. De to lag maa
// ikke blandes: 3.0 spoerger kun her, den gamle app kun der.
//
// AT MAATTE ER IKKE AT SE. Selvom hun maa, ser hun foerst de udvidede tal
// naar hun selv slaar dem til paa Dine maal. Se visUdvidetNaering.
// ============================================================

/** De to ting Linn kan slaa til og fra. */
export interface NaeringRegel3 {
	/** Maa hun se kulhydrat, fedt og kalorier. */
	udvidet?: boolean;
	/** Maa hun rette sine egne daglige maal. */
	maaRette?: boolean;
}

/** Hele skemaet, ét dokument. */
export interface NaeringRegler3 {
	/** Alle med abonnement og uden forloeb. */
	medlemmer?: NaeringRegel3;
	/** Pr forloeb. Mangler forloebet, arver det medlems-linjen. */
	forlob?: Record<string, NaeringRegel3>;
}

/** Det der faktisk gaelder for én kunde. Aldrig undefined. */
export interface NaeringAdgang3 {
	udvidet: boolean;
	maaRette: boolean;
	/** Hvor svaret kom fra. Vises i admin, saa Linn kan se hvad der styrer. */
	kilde: 'undtagelse' | 'forlob' | 'medlemmer' | 'standard';
}

/** Naar intet er sat. Begge dele er aabne. */
export const STANDARD_NAERING3: NaeringAdgang3 = {
	udvidet: true,
	maaRette: true,
	kilde: 'standard'
};

/**
 * Hvad gaelder for kunden.
 *
 * De to kontakter afgoeres HVER FOR SIG. Har Linn sat en undtagelse der
 * kun siger noget om den ene, arver den anden videre ned. Ellers ville et
 * enkelt flueben paa en kunde komme til at slaa noget fra som Linn aldrig
 * tog stilling til.
 */
export function naeringAdgangFor3(
	regler: NaeringRegler3 | null,
	undtagelse: NaeringRegel3 | null,
	aktivtForlobId: string | null
): NaeringAdgang3 {
	const forlobRegel = aktivtForlobId ? (regler?.forlob?.[aktivtForlobId] ?? null) : null;
	const medlemRegel = regler?.medlemmer ?? null;

	const svar = (felt: keyof NaeringRegel3): { vaerdi: boolean; kilde: NaeringAdgang3['kilde'] } => {
		if (undtagelse && typeof undtagelse[felt] === 'boolean')
			return { vaerdi: undtagelse[felt]!, kilde: 'undtagelse' };
		if (forlobRegel && typeof forlobRegel[felt] === 'boolean')
			return { vaerdi: forlobRegel[felt]!, kilde: 'forlob' };
		if (medlemRegel && typeof medlemRegel[felt] === 'boolean')
			return { vaerdi: medlemRegel[felt]!, kilde: 'medlemmer' };
		return { vaerdi: true, kilde: 'standard' };
	};

	const u = svar('udvidet');
	const r = svar('maaRette');
	// Kilden er den mest specifikke af de to, for det er den Linn leder
	// efter naar hun undrer sig over hvorfor en kunde ser noget.
	const RANG: NaeringAdgang3['kilde'][] = ['standard', 'medlemmer', 'forlob', 'undtagelse'];
	const kilde = RANG.indexOf(u.kilde) >= RANG.indexOf(r.kilde) ? u.kilde : r.kilde;

	return { udvidet: u.vaerdi, maaRette: r.vaerdi, kilde };
}

/**
 * Skal de tre udvidede tal staa paa skaermen.
 *
 * TO TING SKAL VAERE OPFYLDT: Linn skal have givet lov, og hun skal selv
 * have slaaet dem til. Det ene uden det andet er ikke nok, og det er den
 * regel alle skaerme skal spoerge om, saa de ikke driver fra hinanden.
 */
export function visUdvidet3(
	adgang: NaeringAdgang3 | null,
	kundensValg: boolean | undefined
): boolean {
	return !!adgang?.udvidet && kundensValg === true;
}

/** Kort tekst til admin: hvad styrer den her kunde. */
export function kildeTekst3(kilde: NaeringAdgang3['kilde']): string {
	if (kilde === 'undtagelse') return 'Sat på kunden';
	if (kilde === 'forlob') return 'Fra forløbet';
	if (kilde === 'medlemmer') return 'Fra medlemmer';
	return 'Standard';
}

/** Er der overhovedet taget stilling. Bruges til at vise undtagelser. */
export function harRegel3(r: NaeringRegel3 | null | undefined): boolean {
	return !!r && (typeof r.udvidet === 'boolean' || typeof r.maaRette === 'boolean');
}
