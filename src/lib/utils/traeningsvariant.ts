// Hjaelpefunktioner til kettlebell/no-kettlebell-valget der gaelder paa
// tvaers af abo og forloeb. Valget gemmes to steder for at undgaa
// migreringer paa eksisterende data:
//
// - userDoc.mikrotraeningVariant - bruges af abo-mikrotraening og af
//   forsiden til hurtigt at se om kunden har valgt
// - users/{uid}/products/{productId}.programValg.mikrotraening - bruges
//   af forloebs-mikrotraening til at vide hvilket program der skal
//   vises (programId matcher et dokument i forlob/{id}/mikrotraeningProgrammer/)
//
// Helperne her holder de to felter i sync og udleder den ene fra den
// anden hvis kun ét er sat.

import type { UserDoc } from '$lib/types';
import type { UserProduct } from '$lib/content/mikrotraening';

export type Variant = 'kettlebell' | 'no_kettlebell';
export type ForlobType = 'kropsro' | 'kickstart';

// Kickstart-forloeb har 21-dages programmer med navne 'mikrotraening_*'.
// Kropsro-forloeb har 84-dages programmer med navne 'kropsro_84_*'.
// Hvis vi tilfoejer flere forloebs-typer i fremtiden skal denne mapping
// udvides - eller bedre: programId udledes via forlob/{id}/mikrotraeningProgrammer
// med matching paa udstyrs-tags.
const KICKSTART_PGM = {
	kettlebell: 'mikrotraening_kettlebell',
	no_kettlebell: 'mikrotraening_no_kettlebell'
} as const;
const KROPSRO_PGM = {
	kettlebell: 'kropsro_84_med_kb',
	no_kettlebell: 'kropsro_84_uden_kb'
} as const;

/**
 * Programmets dokument-id i forlob/{id}/mikrotraeningProgrammer/.
 * forlobType skal angives - ellers antages 'kickstart' (default for
 * bagudkompatibilitet, men det giver forkert program-id paa Kropsro).
 */
export function programIdForVariant(variant: Variant, forlobType: ForlobType = 'kickstart'): string {
	const map = forlobType === 'kropsro' ? KROPSRO_PGM : KICKSTART_PGM;
	return map[variant];
}

/** Udleder forlobType fra forlobId via navngivnings-praefix. */
export function forlobTypeForId(forlobId: string | null | undefined): ForlobType {
	return forlobId?.startsWith('kropsro_') ? 'kropsro' : 'kickstart';
}

/** Modsat: hvilken variant svarer et programId til. Returnerer null for ukendte. */
export function variantForProgramId(programId: string | undefined | null): Variant | null {
	if (programId === KICKSTART_PGM.kettlebell || programId === KROPSRO_PGM.kettlebell) return 'kettlebell';
	if (programId === KICKSTART_PGM.no_kettlebell || programId === KROPSRO_PGM.no_kettlebell) return 'no_kettlebell';
	return null;
}

/**
 * Udleder kundens valgte variant fra userDoc eller userProduct.
 * userDoc.mikrotraeningVariant har forrang. Falder tilbage til at oversaette
 * userProduct.programValg.mikrotraening hvis det er sat.
 * Returnerer null hvis ingen af felterne er sat - dvs kunden har ikke valgt endnu.
 */
export function udledVariant(
	userDoc: UserDoc | null | undefined,
	userProduct: UserProduct | null | undefined
): Variant | null {
	if (userDoc?.mikrotraeningVariant) return userDoc.mikrotraeningVariant;
	const programId = userProduct?.programValg?.mikrotraening;
	return variantForProgramId(programId);
}

/** True hvis kunden har et registreret variant-valg (paa userDoc eller userProduct). */
export function harValgtVariant(
	userDoc: UserDoc | null | undefined,
	userProduct: UserProduct | null | undefined
): boolean {
	return udledVariant(userDoc, userProduct) !== null;
}

/**
 * Finder forløbskundens aktive forlobId. Primær kilde er
 * aktivtTraeningsprogram.forlobId, som login-sync saetter til kundens
 * aktuelle forløb. Har kunden endnu ikke valgt variant (saa
 * aktivtTraeningsprogram ikke er sat), falder vi tilbage til det seneste
 * forløb i forlobIds — login-sync appender kronologisk, saa sidste = nyeste.
 * Returnerer null hvis kunden ikke har nogen forløb.
 *
 * Bruges af Moduler→Træning saa den viser SAMME forløbs-programmer som
 * forsiden (der laeser aktivtTraeningsprogram direkte).
 */
export function aktivtForlobId(userDoc: UserDoc | null | undefined): string | null {
	const fraProgram = userDoc?.aktivtTraeningsprogram?.forlobId;
	if (fraProgram) return fraProgram;
	const ids = userDoc?.forlobIds ?? [];
	return ids.length > 0 ? ids[ids.length - 1] : null;
}
