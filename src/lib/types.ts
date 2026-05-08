/**
 * Brugertilstand i Firestore.
 *
 * 'modulbruger' = abonnent der ikke er på et aktivt forløb (ser variant B)
 * 'forlobskunde' = bruger på et aktivt forløb (ser variant A1)
 * 'udlobet' = tidligere kunde uden aktiv adgang (ser variant C)
 */
export type UserState = 'modulbruger' | 'forlobskunde' | 'udlobet';

/**
 * Bruger-dokumentet i Firestore-collection 'users'.
 * Dokument-ID matcher Firebase Auth UID.
 */
export interface UserDoc {
	firstName: string;
	email: string;
	state: UserState;
	createdAt: number; // Unix timestamp i millisekunder

	// Senest tidspunkt brugeren åbnede /app/spoergsmaal og så sine svar.
	// Bruges til at detektere ubeskrevne svar (svar.besvaretAt > dette).
	senestSpoergsmaalLaestAt?: number;
}
