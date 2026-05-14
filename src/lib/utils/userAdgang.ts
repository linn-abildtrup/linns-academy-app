// Helpers til at læse en brugers adgangs-status. Erstatter direkte tjek på
// userDoc.state med funktioner der læser fra de nye felter
// (accessLevel/accessSource/activeProduct).
//
// Brugerens UI-variant bestemmes nu af accessSource + accessLevel:
//
//   forløb        + basis    → forløbskunde (Maria-flow, Kickstart)
//   forløb        + premium  → forløbskunde på premium-forløb
//   abonnement    + basis    → modulbruger (basisapp)
//   abonnement    + premium  → modulbruger på premiumapp
//   ingenting / none          → udlobet (eller ny bruger uden adgang)
//
// Helpers her returnerer den gamle UserState-værdi indtil etape 2 hvor de
// 12 kald-steder skiftes over til at bruge accessLevel/accessSource direkte.
//
// Hvis userDoc.accessLevel mangler (gamle brugere før migration) falder vi
// tilbage til userDoc.state — det giver kontinuitet under overgangen.

import type { AccessLevel, AccessSource, UserDoc, UserState } from '$lib/types';

/**
 * Returnerer den effektive UserState baseret på de nye adgangs-felter.
 * Hvis adgangs-felterne mangler bruger vi userDoc.state direkte (legacy).
 *
 * Hvis `expiresAt` er passeret betragtes brugeren som udløbet uanset
 * accessLevel — så en forløbskunde automatisk skifter til udlobet-UI når
 * forløbets slutdato er nået (med bibliotek-bonus i 90 dage efter via
 * `bonusPeriodEndsAt`).
 */
export function effektivState(userDoc: UserDoc | null | undefined): UserState | null {
	if (!userDoc) return null;
	const udloebet = !!(userDoc.expiresAt && userDoc.expiresAt < Date.now());
	if (userDoc.accessLevel !== undefined) {
		if (userDoc.accessLevel === 'none' || udloebet) return 'udlobet';
		if (userDoc.accessSource === 'forløb') return 'forlobskunde';
		return 'modulbruger';
	}
	if (udloebet) return 'udlobet';
	return userDoc.state ?? null;
}

/** True hvis brugeren er på et aktivt forløb. */
export function erForlobsklient(userDoc: UserDoc | null | undefined): boolean {
	return effektivState(userDoc) === 'forlobskunde';
}

/** True hvis brugeren har et abonnement (basis eller premium). */
export function erModulbruger(userDoc: UserDoc | null | undefined): boolean {
	return effektivState(userDoc) === 'modulbruger';
}

/** True hvis brugerens adgang er udløbet eller hun aldrig har haft adgang. */
export function erUdlobet(userDoc: UserDoc | null | undefined): boolean {
	return effektivState(userDoc) === 'udlobet';
}

function erUdloebet(userDoc: UserDoc | null | undefined): boolean {
	return !!(userDoc?.expiresAt && userDoc.expiresAt < Date.now());
}

/** True hvis brugeren har premium-niveau (og adgangen ikke er udløbet). */
export function harPremium(userDoc: UserDoc | null | undefined): boolean {
	if (erUdloebet(userDoc)) return false;
	return userDoc?.accessLevel === 'premium';
}

/** True hvis brugeren har mindst basis-niveau (basis eller premium) og adgangen ikke er udløbet. */
export function harBasisAdgang(userDoc: UserDoc | null | undefined): boolean {
	if (erUdloebet(userDoc)) return false;
	return userDoc?.accessLevel === 'basis' || userDoc?.accessLevel === 'premium';
}

/**
 * True hvis en forløbskunde stadig er i sin 90-dages bibliotek-bonus-
 * periode efter forløb-slut. I bonus-perioden har hun adgang til biblioteket
 * (FAQ + Links + Lektioner + Træningsøvelser + Opskrifter) selv om hun
 * ikke længere har et aktivt abonnement.
 */
export function erIBonusPeriode(userDoc: UserDoc | null | undefined): boolean {
	if (!userDoc?.bonusPeriodEndsAt) return false;
	return userDoc.bonusPeriodEndsAt > Date.now();
}

/**
 * True hvis brugeren har adgang til biblioteket. Det gælder hvis hun:
 *   - Har aktivt abonnement eller forløb (accessLevel != 'none')
 *   - ELLER er i sin 90-dages bonus-periode efter forløb-slut
 */
export function harBibliotekAdgang(userDoc: UserDoc | null | undefined): boolean {
	if (!userDoc) return false;
	if (harBasisAdgang(userDoc)) return true;
	return erIBonusPeriode(userDoc);
}

/**
 * True hvis brugeren har INGEN adgang overhovedet — hverken aktivt
 * abonnement/forløb eller bonus-periode. Bruges til at vise "Køb adgang"-
 * siden i stedet for det normale app-indhold. Hun kan stadig logge ind
 * (Firebase Auth virker), men ser ingen moduler eller indhold.
 */
export function harIngenAdgang(userDoc: UserDoc | null | undefined): boolean {
	if (!userDoc) return false;
	return !harBasisAdgang(userDoc) && !erIBonusPeriode(userDoc);
}

/**
 * True hvis brugeren tidligere har været på et forløb (Kickstart eller
 * Premium-forløb). Bruges til at vise Træningsøvelser-fanen i bibliotek
 * for udløbede brugere og rene basis-abonnenter der har gennemført forløb.
 */
export function harGennemfoertForlob(userDoc: UserDoc | null | undefined): boolean {
	return (userDoc?.forlobIds?.length ?? 0) > 0;
}

/**
 * Bonus-perioden er 90 dage. Bruges af cancel-handler og admin-værktøjer.
 */
export const BONUS_PERIODE_DAGE = 90;

/**
 * Mapping fra accessLevel + accessSource → den gamle UserState-værdi.
 * Bruges af migration-script og synkroniserings-flows der skal sætte
 * begge formater korrekt indtil etape 2.
 */
export function udledState(
	accessLevel: AccessLevel | undefined,
	accessSource: AccessSource | undefined
): UserState {
	if (!accessLevel || accessLevel === 'none') return 'udlobet';
	if (accessSource === 'forløb') return 'forlobskunde';
	return 'modulbruger';
}
