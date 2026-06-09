// Helpers til at læse en brugers adgangs-status. Erstatter direkte tjek på
// userDoc.state med funktioner der læser fra de nye felter
// (accessLevel/accessSource/activeProduct).
//
// Brugerens UI-variant bestemmes nu af accessSource + accessLevel:
//
//   forløb        + basis    → forløbskunde (Maria-flow, Kickstart)
//   forløb        + premium  → forløbskunde på Kropsro
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
 * `expiresAt` har FORSKELLIG semantik afhængigt af accessSource:
 * - Forløb: forløbets slutdato — passeret = udlobet (med 90 dages bibliotek-
 *   bonus efter via `bonusPeriodEndsAt`).
 * - Abonnement: næste fornyelse — passeret betyder IKKE udløb. Et abonnement
 *   udløber kun når `activeSubscription` bliver false (cancel-webhook).
 *
 * Det er vigtigt fordi migrerede kunder kan have et expiresAt fra deres
 * forløb selv om de senere er overgået til et abonnement.
 */
export function effektivState(userDoc: UserDoc | null | undefined): UserState | null {
	if (!userDoc) return null;
	const erAktivAbonnent =
		userDoc.accessSource === 'abonnement' && userDoc.activeSubscription === true;
	const udloebet =
		!erAktivAbonnent && !!(userDoc.expiresAt && userDoc.expiresAt < Date.now());
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

/**
 * True hvis brugerens adgang er udløbet eller hun aldrig har haft adgang.
 * BEMÆRK: kaldes pt. ingen steder. Beholdt som del af state-trioen
 * (erForlobsklient / erModulbruger / erUdlobet) til fremtidig brug.
 */
export function erUdlobet(userDoc: UserDoc | null | undefined): boolean {
	return effektivState(userDoc) === 'udlobet';
}

// Intern udløbs-tjek der KUN ser på udløbsdatoen (expiresAt), modsat den
// eksporterede erUdlobet ovenfor der ser på den fulde effektivState. Holdt
// adskilt med et tydeligt navn så de to ikke forveksles (de gjorde det nemt
// før, da navnene kun adskilte sig med ét bogstav: erUdlobet vs erUdloebet).
function erUdloebetViaUdloebsdato(userDoc: UserDoc | null | undefined): boolean {
	// Aktive abonnenter er aldrig udløbet via expiresAt. Feltet repræsenterer
	// næste fornyelse for dem, ikke adgangs-slut. Cancel-webhook sætter
	// activeSubscription=false når abonnementet ophører.
	const erAktivAbonnent =
		userDoc?.accessSource === 'abonnement' && userDoc?.activeSubscription === true;
	if (erAktivAbonnent) return false;
	return !!(userDoc?.expiresAt && userDoc.expiresAt < Date.now());
}

/** True hvis brugeren har premium-niveau (og adgangen ikke er udløbet). */
export function harPremium(userDoc: UserDoc | null | undefined): boolean {
	if (erUdloebetViaUdloebsdato(userDoc)) return false;
	return userDoc?.accessLevel === 'premium';
}

/**
 * True hvis brugeren er paa et Kropsro-forl0b (ikke bare premium-niveau).
 * Bruges til at adskille Kropsro-forl0bskunder fra premium-Kickstart-kunder
 * (begge har activeProduct='premiumforløb' men kun Kropsro-kunder har et
 * 'kropsro_'-id i forlobIds).
 *
 * Tilbagefald: hvis forlobIds ikke er sat, gaetter vi paa activeProduct
 * (matchaer den hidtidige opfoersel for legacy-data).
 */
export function erKropsroForlobskunde(userDoc: UserDoc | null | undefined): boolean {
	if (!userDoc) return false;
	if (Array.isArray(userDoc.forlobIds) && userDoc.forlobIds.length > 0) {
		return userDoc.forlobIds.some((id) => id.startsWith('kropsro_'));
	}
	return userDoc.activeProduct === 'premiumforløb';
}

/**
 * True hvis brugeren er paa et Kickstart-forl0b (basis ELLER premium-niveau).
 */
export function erKickstartForlobskunde(userDoc: UserDoc | null | undefined): boolean {
	if (!userDoc) return false;
	if (Array.isArray(userDoc.forlobIds) && userDoc.forlobIds.length > 0) {
		return userDoc.forlobIds.some((id) => id.startsWith('kickstart_'));
	}
	return userDoc.activeProduct === 'kickstart';
}

/** True hvis brugeren har mindst basis-niveau (basis eller premium) og adgangen ikke er udløbet. */
export function harBasisAdgang(userDoc: UserDoc | null | undefined): boolean {
	if (erUdloebetViaUdloebsdato(userDoc)) return false;
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
 * Kropsro). Bruges til at vise Træningsøvelser-fanen i bibliotek
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

/**
 * Returnerer true hvis brugeren har test-adgang til den givne feature-key.
 * Bruges til at gate eksperimentelle funktioner: kun brugere på testere-
 * listen ser dem indtil de er klar til alle.
 *
 * Eksempel: {#if harTestAdgang(userDoc, 'madplan-v2')}<NyMadplan />{/if}
 *
 * Når funktionen er produktionsklar fjernes tjekken — alle brugere får
 * adgangen, og testere-listen i Firestore er stadig der til næste runde.
 */
export function harTestAdgang(
	userDoc: UserDoc | null | undefined,
	feature: string
): boolean {
	return userDoc?.testerFeatures?.includes(feature) ?? false;
}
