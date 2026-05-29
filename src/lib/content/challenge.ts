// Challenge: tidsbegraenset konkurrence pr forloeb hvor klienterne spiser
// saa mange forskellige frugter og groentsager som muligt.
//
// Datamodel:
// - forlob/{id}/challenges/{challengeId} — selve challenge-doc
// - forlob/{id}/challenges/{challengeId}/indtastninger/{uid} — hver
//   klients liste af unikke foedevarer
//
// Score = antal unikke foedevarer pr klient. Duplikater taeller kun én gang.

import type { Timestamp } from 'firebase/firestore';

export interface Challenge {
	id: string;
	forlobId: string;
	navn: string;
	beskrivelse: string;
	startDato: Timestamp;
	slutDato: Timestamp;
	aktiv: boolean;
	// Brugere der ikke skal taelle med (test/demo-klienter). Liste af uids.
	fravalgteBrugere: string[];
	oprettet?: Timestamp;
	opdateret?: Timestamp;
}

export interface ChallengeIndtastning {
	uid: string;
	foedevarer: string[];
	// Cachet ved gem-tidspunktet saa klient-stillings-skaermen kan vise
	// 'Hanne S.' uden at maatte slaa op i andre brugeres userDocs (klienter
	// kan ikke laese hinandens userDocs).
	fornavn?: string;
	efternavn?: string;
	opdateret?: Timestamp;
}

export interface StillingRaekke {
	uid: string;
	displayNavn: string;
	score: number;
	erMig: boolean;
}

/**
 * Pra'definerede frugter og groentsager klienten kan vaelge fra. Listen
 * daekker det meste typisk dansk koekken. Klienten kan ogsaa skrive egne
 * via fritekst-felt hvis hun spiste noget der ikke staar her.
 *
 * Sorteret alfabetisk (sortering sker ogsaa i UI'en for sikkerheds skyld).
 */
export const FRUGT_OG_GROENT: string[] = [
	// Frugt
	'Abrikos',
	'Ananas',
	'Appelsin',
	'Avocado',
	'Banan',
	'Blomme',
	'Blaabær',
	'Brombær',
	'Citron',
	'Drueagurk',
	'Druer',
	'Fersken',
	'Figen',
	'Granatæble',
	'Grapefrugt',
	'Hindbær',
	'Honningmelon',
	'Jordbær',
	'Kirsebær',
	'Kiwi',
	'Klementin',
	'Lime',
	'Mango',
	'Mandarin',
	'Melon',
	'Nektarin',
	'Papaya',
	'Pasionsfrugt',
	'Pære',
	'Ribs',
	'Rabarber',
	'Solbær',
	'Stikkelsbær',
	'Tranebær',
	'Vandmelon',
	'Æble',
	// Groentsager — bladgroent og rodfrugter
	'Agurk',
	'Artiskok',
	'Asparges',
	'Aubergine',
	'Avokado-salat',
	'Bladbede',
	'Bladsalat',
	'Blomkål',
	'Broccoli',
	'Bønner',
	'Champignon',
	'Edamame',
	'Fennikel',
	'Grønkål',
	'Gulerod',
	'Hvidkål',
	'Hvidløg',
	'Iceberg-salat',
	'Ingefær',
	'Jordskok',
	'Kartoffel',
	'Knoldselleri',
	'Kål',
	'Linser',
	'Løg',
	'Majs',
	'Mangold',
	'Pak choi',
	'Pastinak',
	'Peberfrugt',
	'Persille',
	'Persillerod',
	'Porre',
	'Radise',
	'Rosenkål',
	'Rucola',
	'Rødbede',
	'Rødkål',
	'Salat',
	'Selleri',
	'Skalotteløg',
	'Spidskål',
	'Spinat',
	'Spirer',
	'Squash',
	'Søde kartofler',
	'Tomat',
	'Vandkarse',
	'Ærter'
];

/**
 * Returnerer kortet displaynavn 'Fornavn E.' baseret paa fulde navn.
 * Bruges i stilling for at vise hvem der har hvilken score uden at
 * eksponere fulde efternavne.
 */
export function challengeDisplayNavn(fornavn: string, efternavn: string): string {
	const f = (fornavn ?? '').trim();
	const e = (efternavn ?? '').trim();
	if (!e) return f || '(uden navn)';
	return `${f} ${e[0].toUpperCase()}.`;
}

/**
 * Pure-funktion: beregn stillingen ud fra alle indtastninger og en liste
 * over fravalgte uids. Returnerer sorteret efter score (faldende).
 * Brugere med 0 score inkluderes ogsaa saa de kan se sig selv.
 */
export function beregnStilling(
	indtastninger: Array<{ uid: string; foedevarer: string[]; displayNavn: string }>,
	fravalgteBrugere: string[],
	migUid: string | null
): StillingRaekke[] {
	const fravalgt = new Set(fravalgteBrugere);
	return indtastninger
		.filter((i) => !fravalgt.has(i.uid))
		.map((i) => ({
			uid: i.uid,
			displayNavn: i.displayNavn,
			score: new Set(i.foedevarer).size,
			erMig: i.uid === migUid
		}))
		.sort((a, b) => {
			if (b.score !== a.score) return b.score - a.score;
			return a.displayNavn.localeCompare(b.displayNavn, 'da');
		});
}

/**
 * Returnerer true hvis given dato falder i challenge-perioden
 * (begge endepunkter inklusiv).
 */
export function erIChallengePeriode(
	challenge: { startDato: Timestamp; slutDato: Timestamp; aktiv: boolean },
	dato: Date = new Date()
): boolean {
	if (!challenge.aktiv) return false;
	const t = dato.getTime();
	const start = new Date(challenge.startDato.toDate());
	start.setHours(0, 0, 0, 0);
	const slut = new Date(challenge.slutDato.toDate());
	slut.setHours(23, 59, 59, 999);
	return t >= start.getTime() && t <= slut.getTime();
}
