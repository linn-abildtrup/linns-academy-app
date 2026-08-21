// ============================================================
// Det program hun foelger, gemt paa hende.
//
// Feltet ligger paa kunde-dokumentet og hedder valgtTraeningsprogram3.
// Den gamle app kender det ikke og ignorerer felter den ikke kender, saa
// den maerker ingenting. Se content/valgtProgram3 for hvorfor valget
// overhovedet skal gemmes.
//
// Den TOLVTE fil i 3.0 der skriver kundedata.
// ============================================================

import { doc, setDoc } from 'firebase/firestore';
import { db } from '$lib/firebase';

/** Feltet paa kunde-dokumentet. Staar ét sted, saa det ikke driver. */
export const VALGT_PROGRAM_FELT = 'valgtTraeningsprogram3';

/** Gemmer at hun nu foelger det her program. */
export async function gemValgtProgram3(uid: string, programId: string): Promise<void> {
	await setDoc(doc(db, 'users', uid), { [VALGT_PROGRAM_FELT]: programId }, { merge: true });
}
