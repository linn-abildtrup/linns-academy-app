/**
 * Loginskaermens opslag: hvad skal vi vise paa skaerm 2?
 *
 * Kunden skriver kun sin email paa skaerm 1. Herefter afgoer vi hvilken af
 * de tre udgaver hun skal se. Reglerne ligger her som rene funktioner saa
 * de kan testes uden netvaerk — selve opslaget sker paa serveren, fordi
 * koebslisten (allowedEmails) med vilje ikke kan laeses foer man er logget
 * ind. Se /api/login-opslag.
 */

/** Hvad skaerm 2 skal vise. */
export type LoginUdfald =
	/** Kontoen findes — hun skal logge ind med den kode hun allerede har. */
	| 'harKonto'
	/** Koeb fundet, men ingen konto endnu — hun skal vaelge en adgangskode. */
	| 'nyKunde'
	/** Ingen koeb registreret paa emailen — vi kan ikke lukke hende ind. */
	| 'intetKoeb';

export interface OpslagSvar {
	udfald: LoginUdfald;
	/**
	 * Navnet paa det hun har koebt, kun sat ved 'nyKunde'. Vises som
	 * kvittering ("Kickstart August 2026"), saa hun kan se at koebet er naaet
	 * frem. Bevidst IKKE sat ved 'harKonto': der viser vi kun emailen, saa
	 * skaermen ikke roeber mere om en fremmed end noedvendigt.
	 */
	koebNavn?: string;
}

/**
 * Normaliserer en indtastet email. Kunder skriver med store bogstaver, og
 * telefoner tilfoejer gerne et mellemrum til sidst — begge dele ville ellers
 * ramme forbi baade koebslisten og Auth.
 */
export function normaliserEmail(raa: string): string {
	return raa.trim().toLowerCase();
}

/** Meget enkel formkontrol. Den rigtige validering sker hos Firebase. */
export function seromEmailUd(raa: string): boolean {
	const e = normaliserEmail(raa);
	return e.length >= 5 && e.includes('@') && e.includes('.') && !e.includes(' ');
}

/**
 * Faldback-navne for de koeb der ikke hoerer til et forloeb. En abonnent har
 * ingen forlobId paa sin allowedEmail, men skal stadig se en kvittering.
 */
const PRODUKT_NAVNE: Record<string, string> = {
	basisabo: 'Adgang til appen',
	premiumabo: 'Adgang til appen — premium',
	kickstart: 'Kickstart',
	premiumforløb: 'Premium-forløb'
};

/**
 * Hvad hun har koebt, skrevet saa hun kan genkende det. Forloebets eget navn
 * vinder ("Kickstart August 2026"); ellers falder vi tilbage paa produktet.
 * Kender vi ingen af delene, giver vi intet navn — skaermen siger saa bare
 * at koebet er fundet.
 */
export function koebNavnFor(
	forlobNavn: string | null | undefined,
	activeProduct: string | null | undefined
): string | undefined {
	if (forlobNavn && forlobNavn.trim()) return forlobNavn.trim();
	if (activeProduct && PRODUKT_NAVNE[activeProduct]) return PRODUKT_NAVNE[activeProduct];
	return undefined;
}

export interface OpslagKilder {
	/** Har emailen en Firebase Auth-konto? */
	harKonto: boolean;
	/** Findes emailen paa koebslisten? */
	harKoeb: boolean;
	/** Forloebets navn, hvis koebet hoerer til et forloeb. */
	forlobNavn?: string | null;
	/** Produktet fra koebslisten, brugt naar der ikke er et forloeb. */
	activeProduct?: string | null;
}

/**
 * Selve reglen.
 *
 * Kontoen vinder over koebet: har hun allerede en konto, skal hun logge ind —
 * ogsaa selvom koebslisten er ryddet efter et afsluttet forloeb. Ellers ville
 * en tidligere kunde blive maalt som "intet koeb" og ikke kunne komme ind til
 * sit eget materiale.
 */
export function afgoerUdfald(kilder: OpslagKilder): OpslagSvar {
	if (kilder.harKonto) return { udfald: 'harKonto' };
	if (!kilder.harKoeb) return { udfald: 'intetKoeb' };
	return {
		udfald: 'nyKunde',
		koebNavn: koebNavnFor(kilder.forlobNavn, kilder.activeProduct)
	};
}
