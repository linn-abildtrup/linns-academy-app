// Firestore-helpers til ingrediens-koblingen, etape 3 af regnemaskinen.
//
// Koblingerne ligger i ÉN doc: ingrediensKobling/koblinger, med et kort
// fra kernenavn til foedevare-id.
//
// HVORFOR IKKE PAA SELVE OPSKRIFTEN
// Fordi admin-siden i den gamle app gemmer hele ingrediens-listen naar
// Linn retter en opskrift. Skrev vi foodId ind paa hver ingrediens,
// ville den blive toerret af foerste gang nogen aendrede en opskrift, og
// ingen ville opdage det. Regel 2 siger desuden at den gamle admin-side
// ikke maa rettes.
//
// Koblingen er pr KERNENAVN og ikke pr linje. "olivenolie" staar 38
// gange fordelt paa mange opskrifter, men skal kun kobles én gang.

import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '$lib/firebase';

const STI = 'ingrediensKobling';
const DOK = 'koblinger';

/**
 * Naeringstal vi selv har slaaet op, fordi databasen ikke havde varen.
 *
 * De ligger HER og ikke i fodevarer-samlingen, saa de ikke dukker op i
 * kundernes soegning. Kunden skal se en kort, kurateret liste, og den
 * beslutning er ikke truffet endnu. Se samtalen 13. august.
 *
 * Alle tal er pr 100 g.
 */
export interface EgenVare {
	navn: string;
	/** protein */
	p: number;
	/** kostfibre */
	f: number;
	kh: number;
	fedt: number;
	kcal: number;
	/** Hvor tallet kommer fra. Skal altid udfyldes. */
	kilde: string;
}

export interface GemtKobling {
	/**
	 * Id paa foedevaren i fodevarer-samlingen.
	 * Tom streng naar vi bruger egenVare i stedet.
	 */
	foodId: string;
	/**
	 * Sat naar databasen ikke havde varen, og tallene er slaaet op
	 * andetsteds. Vinder over foodId naar begge er sat.
	 */
	egenVare?: EgenVare;
	/** true naar et menneske har bekraeftet den. */
	bekraeftet: boolean;
	/** Hvem der satte den. 'auto' eller en uid. */
	af: string;
}

export type Koblingskort = Record<string, GemtKobling>;

/**
 * Henter hele kortet. Returnerer et tomt kort foerste gang, saa
 * kalderen ikke skal haandtere at dokumentet ikke findes endnu.
 */
export async function hentKoblinger(): Promise<Koblingskort> {
	const snap = await getDoc(doc(db, STI, DOK));
	if (!snap.exists()) return {};
	const data = snap.data() as Record<string, unknown>;
	const kort = data.kort;
	return (kort && typeof kort === 'object' ? kort : {}) as Koblingskort;
}

/**
 * Gemmer hele kortet paa én gang.
 *
 * Der er cirka 290 kernenavne, saa dokumentet er lille nok til at blive
 * skrevet i sin helhed. Det er enklere og sikrere end delvise skrivninger
 * naar to admin-faner er aabne samtidig.
 */
export async function gemKoblinger(kort: Koblingskort, af: string): Promise<void> {
	await setDoc(
		doc(db, STI, DOK),
		{ kort, opdateret: serverTimestamp(), opdateretAf: af },
		{ merge: true }
	);
}

/** Saetter én kobling og gemmer hele kortet. */
export async function saetKobling(
	kort: Koblingskort,
	kerne: string,
	foodId: string | null,
	af: string
): Promise<Koblingskort> {
	const nyt = { ...kort };
	if (foodId === null) delete nyt[kerne];
	else nyt[kerne] = { foodId, bekraeftet: true, af };
	await gemKoblinger(nyt, af);
	return nyt;
}
