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
 * Praedefinerede planter klienten kan vaelge fra. Daekker syv kategorier
 * fra Linns 'Planter til dit tarmmikrobiom'-afkrydsningsliste. Klienten kan
 * ogsaa skrive egne via fritekst-felt hvis hun spiste noget der ikke staar
 * her, og databasen fra Mad-modulet merges ind reaktivt i dialogen.
 */
export interface PlanteKategori {
	id: string;
	label: string;
	items: string[];
}

export const PLANTE_KATEGORIER: PlanteKategori[] = [
	{
		id: 'groent',
		label: 'Grøntsager',
		items: [
			'Spinat',
			'Broccoli',
			'Blomkål',
			'Gulerødder',
			'Rødbeder',
			'Squash',
			'Aubergine',
			'Spidskål',
			'Hvidkål',
			'Rødkål',
			'Grønkål',
			'Porre',
			'Løg',
			'Rødløg',
			'Hvidløg',
			'Selleri',
			'Fennikel',
			'Artiskok',
			'Radiser',
			'Asparges',
			'Tomater',
			'Agurk',
			'Peberfrugt',
			'Champignon',
			'Søde kartofler',
			'Pastinak',
			'Hokkaido',
			'Butternut squash',
			'Pak choi'
		]
	},
	{
		id: 'frugt',
		label: 'Frugt og bær',
		items: [
			'Æbler',
			'Pærer',
			'Bananer',
			'Blåbær',
			'Hindbær',
			'Jordbær',
			'Avocado',
			'Citron',
			'Lime',
			'Appelsin',
			'Grapefrugt',
			'Figner',
			'Dadler',
			'Granatæble',
			'Mango',
			'Kiwi',
			'Ananas',
			'Vindruer',
			'Vandmelon',
			'Brombær'
		]
	},
	{
		id: 'baelg',
		label: 'Bælgfrugter',
		items: [
			'Røde linser',
			'Grønne linser',
			'Kikærter',
			'Sorte bønner',
			'Hvide bønner',
			'Kidneybønner',
			'Edamame',
			'Grønne ærter',
			'Snapærter',
			'Gule ærter',
			'Mungbønner',
			'Cannellinibønner'
		]
	},
	{
		id: 'noedder',
		label: 'Nødder og frø',
		items: [
			'Valnødder',
			'Mandler',
			'Cashewnødder',
			'Hasselnødder',
			'Hørfrø',
			'Chiafrø',
			'Hampfrø',
			'Solsikkefrø',
			'Græskarkerner',
			'Sesamfrø',
			'Pinjekerner',
			'Paranødder',
			'Pekannødder',
			'Macadamianødder'
		]
	},
	{
		id: 'krydderier',
		label: 'Krydderier og urter',
		items: [
			'Gurkemeje',
			'Kanel',
			'Ingefær',
			'Spidskommen',
			'Koriander (frø)',
			'Koriander (frisk)',
			'Persille',
			'Dild',
			'Basilikum',
			'Timian',
			'Rosmarin',
			'Mynte',
			'Oregano',
			'Kardemomme',
			'Muskatnød',
			'Sort peber',
			'Chili',
			'Paprika',
			'Purløg',
			'Estragon'
		]
	},
	{
		id: 'korn',
		label: 'Korn og pseudokorn',
		items: [
			'Havregryn',
			'Quinoa',
			'Boghvede',
			'Rug',
			'Spelt',
			'Byggryn',
			'Bulgur',
			'Hirse',
			'Amaranth',
			'Havreris'
		]
	},
	{
		id: 'fermenteret',
		label: 'Fermenterede fødevarer',
		items: [
			'Kefir',
			'Kimchi',
			'Kombucha',
			'Miso',
			'Surkål',
			'Yoghurt med levende kulturer',
			'Tempeh'
		]
	}
];

/**
 * Mapping fra Mad-modulets Fodevare.cat-felt til vores PlanteKategori-id.
 * Database-foedevarer flettes ind under den matchende kategori i dialogen.
 */
export const CAT_TIL_PLANTE_KATEGORI: Record<string, string> = {
	gront: 'groent',
	baer: 'frugt',
	baelg: 'baelg',
	noedder: 'noedder',
	korn: 'korn'
	// 'mejeri', 'koed', 'fisk', 'prot', 'drikke', 'andet' indgaar ikke som planter.
};

/** Flat liste over alle planter — bruges som soegegrundlag. */
export const ALLE_PLANTER: string[] = PLANTE_KATEGORIER.flatMap((k) => k.items);

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
