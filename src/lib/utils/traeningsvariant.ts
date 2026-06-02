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

const KETTLEBELL_PROGRAM = 'mikrotraening_kettlebell';
const NO_KETTLEBELL_PROGRAM = 'mikrotraening_no_kettlebell';

/** Programmets dokument-id i forlob/{id}/mikrotraeningProgrammer/. */
export function programIdForVariant(variant: Variant): string {
	return variant === 'kettlebell' ? KETTLEBELL_PROGRAM : NO_KETTLEBELL_PROGRAM;
}

/** Modsat: hvilken variant svarer et programId til. Returnerer null for ukendte. */
export function variantForProgramId(programId: string | undefined | null): Variant | null {
	if (programId === KETTLEBELL_PROGRAM) return 'kettlebell';
	if (programId === NO_KETTLEBELL_PROGRAM) return 'no_kettlebell';
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
