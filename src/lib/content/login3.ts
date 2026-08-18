// ============================================================
// Login i 3.0. Ren logik, ingen database og ingen Firebase.
//
// HVORFOR DEN FINDES: den gamle /login er delt mellem begge apper og
// bruges af de 760 kunder i drift, saa den maa ikke roeres. 3.0 faar
// sin egen side paa /ny/login i den nye flades design, og den her fil
// holder alt det der kan afproeves uden en browser.
//
// Fejlteksterne er loeftet fra den gamle side og skrevet igennem. De er
// paa dansk MED aeoeaa, fordi kunden laeser dem. Reglen for dem:
//
//  - Sig hvad hun kan goere, ikke hvad der gik galt teknisk
//  - Naevn aldrig at kontoen findes eller ikke findes, undtagen naar hun
//    selv proever at oprette den. Ellers kan siden bruges til at gaette
//    hvem der er kunde
//  - Ingen fejlkoder paa skaermen
// ============================================================

/** Hvilken skaerm hun staar paa. */
export type LoginVisning = 'velkommen' | 'login' | 'opret' | 'glemt';

/** Firebase Auths koder, oversat. Alt andet faar reservebeskeden. */
const FEJL: Record<string, string> = {
	'auth/wrong-password': 'Forkert adgangskode eller email. Prøv igen.',
	'auth/invalid-credential': 'Forkert adgangskode eller email. Prøv igen.',
	'auth/invalid-login-credentials': 'Forkert adgangskode eller email. Prøv igen.',
	'auth/user-not-found':
		'Vi kan ikke finde en konto med den email. Tjek stavemåden, eller opret en konto.',
	'auth/invalid-email': 'Den email ser ikke rigtig ud. Tjek den lige.',
	'auth/missing-password': 'Skriv din adgangskode.',
	'auth/missing-email': 'Skriv din email.',
	'auth/too-many-requests': 'Du har prøvet mange gange. Vent et par minutter og prøv igen.',
	'auth/user-disabled': 'Din konto er lukket. Skriv til kontakt@linnsacademy.dk.',
	'auth/network-request-failed': 'Der er ingen forbindelse. Tjek nettet og prøv igen.',
	'auth/email-already-in-use': 'Der findes allerede en konto med den email. Log ind i stedet.',
	'auth/weak-password': 'Adgangskoden er for kort. Vælg mindst 6 tegn.',
	'auth/operation-not-allowed': 'Den måde at logge ind på er slået fra. Skriv til Linn.'
};

export const RESERVE_FEJL = 'Noget gik galt. Prøv igen om lidt.';

/** Oversaetter en fejl fra Firebase til noget hun kan bruge til noget. */
export function loginFejlTekst(e: unknown): string {
	if (e && typeof e === 'object' && 'code' in e) {
		const kode = (e as { code: unknown }).code;
		if (typeof kode === 'string' && kode in FEJL) return FEJL[kode];
	}
	return RESERVE_FEJL;
}

/**
 * Beskeden naar hun proever at oprette en konto paa en email vi ikke kan
 * finde et koeb paa.
 *
 * Her SKAL vi sige at vi ikke kan finde noget, ellers staar hun med en
 * konto der ikke virker og ved ikke hvorfor. Linns beslutning 18. august:
 * naevn ikke hvor koebet er sket, bare at det er den samme email.
 */
export function intetKoebTekst(email: string): string {
	const e = renEmail(email);
	return `Vi kan ikke finde et køb på ${e}. Brug den samme email som da du købte. Passer det stadig ikke, så skriv til kontakt@linnsacademy.dk.`;
}

/** Kvitteringen paa "glemt kode". Den er ens uanset om emailen findes. */
export function glemtKvittering(email: string): string {
	return `Er ${renEmail(email)} registreret hos os, ligger der nu en mail med et link. Kig også i spam.`;
}

// ── Felterne ────────────────────────────────────────────────

/** Trimmer og saenker. Samme form som allowedEmails bruger som noegle. */
export function renEmail(email: string): string {
	return email.trim().toLowerCase();
}

/** Firebase kraever mindst 6 tegn. Vi siger det foer hun trykker. */
export const MIN_KODE = 6;

/**
 * Er felterne klar til at sende. Returnerer en besked eller null.
 *
 * Vi validerer selv foer vi sender, saa hun ikke skal vente paa et svar
 * fra nettet for at faa at vide at feltet er tomt.
 */
export function tjekFelter(visning: LoginVisning, email: string, kode: string): string | null {
	const e = renEmail(email);

	if (!e) return 'Skriv din email.';
	if (!erEmail(e)) return 'Den email ser ikke rigtig ud. Tjek den lige.';

	// Paa "glemt kode" er der kun en email at skrive.
	if (visning === 'glemt') return null;

	if (!kode) return 'Skriv din adgangskode.';
	if (visning === 'opret' && kode.length < MIN_KODE) {
		return `Adgangskoden skal være mindst ${MIN_KODE} tegn.`;
	}

	return null;
}

/**
 * Ser det ud som en email. Bevidst loes: der skal staa noget, et snabel-a,
 * noget mere, et punktum og en endelse. Firebase laver det rigtige tjek,
 * det her er kun for at fange slaafejl med det samme.
 */
export function erEmail(email: string): boolean {
	return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(renEmail(email));
}

/** Kan knappen trykkes. Bruges til at graane den, ikke til at spaerre. */
export function kanSende(
	visning: LoginVisning,
	email: string,
	kode: string,
	sender: boolean
): boolean {
	if (sender) return false;
	return tjekFelter(visning, email, kode) === null;
}

// ── Teksterne paa skaermen ──────────────────────────────────

export interface LoginTekster {
	titel: string;
	/** Underteksten. Tom naar skaermen ikke har brug for en. */
	under: string;
	knap: string;
}

/** Hvad der staar oeverst og paa knappen, pr skaerm. */
export function teksterFor(visning: LoginVisning): LoginTekster {
	switch (visning) {
		case 'login':
			return { titel: 'Velkommen tilbage', under: '', knap: 'Log ind' };
		case 'opret':
			return {
				titel: 'Opret din konto',
				under: 'Brug den samme email som da du købte.',
				knap: 'Opret konto'
			};
		case 'glemt':
			return {
				titel: 'Glemt din kode',
				under: 'Skriv din email, så sender vi dig et link til at vælge en ny.',
				knap: 'Send mig et link'
			};
		default:
			return { titel: 'Linns Academy', under: '', knap: '' };
	}
}
