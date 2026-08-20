// ============================================================
// "Vis den lokale kopi med det samme, spoerg serveren stille bagefter."
//
// Bruges af de STORE faelles samlinger i 3.0: foedevarer og opskrifter.
// Se content/lokalKopi3 for hvorfor og for reglerne.
//
// SAADAN VIRKER DET:
//
//   1. Har vi listen i hukommelsen fra tidligere i samme besoeg, faar du
//      den med det samme og der sker ingenting mere.
//   2. Ellers laeser vi telefonens egen kopi UDEN at roere nettet. Duer
//      den, faar du den med det samme, og vi spoerger serveren i
//      baggrunden. Er svaret et andet, kalder vi onFriske.
//   3. Er der ingen kopi, foerste gang paa en telefon, henter vi som foer
//      og venter paa serveren.
//
// DEN LOKALE KOPI KOSTER INGEN LAESNINGER. Firestore regner kun det der
// faktisk gaar over nettet. Det er derfor det her baade er hurtigere for
// kunden og billigere for Linn.
//
// MAA ALDRIG BRUGES TIL ADGANG, kun til indhold. Se content/lokalKopi3.
// ============================================================

import {
	collection,
	getDocs,
	getDocsFromCache,
	type DocumentData,
	type QuerySnapshot
} from 'firebase/firestore';
import { db } from '$lib/firebase';
import { erAendret3, kopiDuer3, type HarId } from '$lib/content/lokalKopi3';

/** Laver raa docs om til den form siden bruger. Skal sortere selv. */
export type Omdanner<T> = (snap: QuerySnapshot<DocumentData>) => T[];

export interface HurtigSamling<T> {
	/** Listen du kan vise med det samme. */
	liste: T[];
	/**
	 * Sand hvis listen kom fra telefonens egen kopi og serveren stadig
	 * bliver spurgt i baggrunden. Siden behoever ikke goere noget ved det,
	 * men det er rart at kunne se i fejlsoegning.
	 */
	fraKopi: boolean;
}

/**
 * Henter en faelles samling, kopi foerst.
 *
 * `husk` er modulets egen hukommelse for resten af besoeget. Send den med
 * ind og ud, saa hvert modul selv ejer sin, og to samlinger ikke deler.
 *
 * `onFriske` kaldes KUN hvis serverens svar er et andet end det du fik.
 * Sker der ingenting, er det fordi listen var den samme, og det er det
 * almindelige.
 */
export async function hentSamlingHurtigt3<T extends HarId>(
	sti: string,
	omdan: Omdanner<T>,
	onFriske?: (liste: T[]) => void
): Promise<HurtigSamling<T>> {
	const kilde = collection(db, sti);

	// 2. Telefonens egen kopi. Roerer aldrig nettet og koster ingen
	//    laesninger. Kaster hvis der ikke er nogen kopi, og det er en helt
	//    normal tilstand, ikke en fejl.
	let kopi: T[] | null = null;
	try {
		kopi = omdan(await getDocsFromCache(kilde));
	} catch {
		kopi = null;
	}

	if (kopiDuer3(kopi)) {
		const vist = kopi as T[];
		// Serveren spoerges i baggrunden. Vi venter IKKE paa den, og en
		// fejl her maa aldrig vaelte siden: hun sidder med et fuldt
		// skaermbillede, og det eneste hun mister er en opdatering.
		void (async () => {
			try {
				const friske = omdan(await getDocs(kilde));
				if (erAendret3(vist, friske)) onFriske?.(friske);
			} catch {
				// Ingen forbindelse. Kopien staar, og det er det rigtige.
			}
		})();
		return { liste: vist, fraKopi: true };
	}

	// 3. Ingen kopi. Foerste gang paa den her telefon, eller browseren har
	//    ryddet op. Saa henter vi som appen altid har gjort.
	return { liste: omdan(await getDocs(kilde)), fraKopi: false };
}
