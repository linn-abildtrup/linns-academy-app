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
 */
export function effektivState(userDoc: UserDoc | null | undefined): UserState | null {
	if (!userDoc) return null;
	if (userDoc.accessLevel !== undefined) {
		if (userDoc.accessLevel === 'none') return 'udlobet';
		if (userDoc.accessSource === 'forløb') return 'forlobskunde';
		return 'modulbruger';
	}
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

/** True hvis brugeren har premium-niveau. */
export function harPremium(userDoc: UserDoc | null | undefined): boolean {
	return userDoc?.accessLevel === 'premium';
}

/** True hvis brugeren har mindst basis-niveau (basis eller premium). */
export function harBasisAdgang(userDoc: UserDoc | null | undefined): boolean {
	return userDoc?.accessLevel === 'basis' || userDoc?.accessLevel === 'premium';
}

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
