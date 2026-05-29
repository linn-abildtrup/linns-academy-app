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
			'Pak choi',
			// Fra fødevaredatabasen — kun rå grundnavne, ikke afarter
			'Kartoffel',
			'Forårsløg',
			'Sukkerærter',
			'Rucola',
			'Rabarber',
			'Majs',
			// Forskellige salater
			'Iceberg',
			'Romainesalat',
			'Bladsalat',
			'Feldsalat',
			// Yderligere groentsager
			'Broccolini',
			'Bønnespirer',
			// Bladgroent og urter
			'Mangold',
			'Brøndkarse',
			'Karse',
			'Endivie',
			'Cikorie',
			// Loeg og rodfrugter
			'Skalotteløg',
			'Jordskok',
			'Knoldselleri',
			'Persillerod',
			'Kålrabi',
			// Svampe
			'Shiitake',
			'Østershatte',
			'Kantareller',
			'Portobello',
			'Karl Johan',
			'Enoki',
			'Træhat',
			// Yderligere kaal og bladgroent
			'Kinakål',
			'Romanesco',
			'Savoykål',
			'Rosenkål',
			'Cavolo nero',
			'Sortkål',
			'Sennepsblade',
			'Mizuna',
			'Ramsløg',
			'Komatsuna',
			// Squash og graeskar
			'Kabocha',
			'Spaghettisquash',
			'Patisson',
			// Eksotiske roedder og knolde
			'Daikon',
			'Lotusrod',
			'Yam',
			'Taro',
			'Cassava',
			'Bambusskud',
			'Vandkastanjer',
			'Wasabi-rod',
			'Sortrod',
			'Skorzonerrod',
			'Kålroe',
			'Roe',
			// Spirer
			'Brokkolispirer',
			'Radisespirer',
			'Alfalfaspirer',
			'Linsespirer',
			// Bredboenner (ofte servered som groentsag)
			'Bredbønner',
			'Snitbønner',
			'Voksbønner'
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
			'Brombær',
			// Fra fødevaredatabasen
			'Honningmelon',
			'Rosiner',
			// Vilde nordiske baer
			'Hyben',
			'Hyldebær',
			'Tyttebær',
			'Tranebær',
			'Solbær',
			'Ribs',
			'Stikkelsbær',
			'Havtorn',
			'Slåen',
			'Multebær',
			// Almindelige stenfrugter
			'Blommer',
			'Kirsebær',
			'Abrikoser',
			'Ferskner',
			'Nektariner',
			'Mirabeller',
			// Citrusfrugt
			'Klementiner',
			'Mandariner',
			// Tropiske og andre
			'Papaya',
			'Passionsfrugt',
			'Litchi',
			'Sharonfrugt',
			'Guava',
			'Drage-frugt',
			'Stjernefrugt',
			'Mangosten',
			'Rambutan',
			'Jackfrugt',
			'Tamarillo',
			'Tamarinde',
			'Lokvat',
			'Quitte',
			'Cherimoya',
			'Persimon',
			// Superbaer
			'Acerola',
			'Acai',
			'Goji-bær',
			'Maqui-bær',
			'Aronia-bær',
			// Citrus
			'Pomelo',
			'Yuzu',
			'Kumquat',
			'Blodappelsin',
			'Tangelo',
			// Andre stenfrugter
			'Surkirsebær',
			'Slåen-blommer'
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
			'Cannellinibønner',
			// Fra fødevaredatabasen
			'Sojabønner',
			// Yderligere boenner og linser
			'Aduki bønner',
			'Pinto bønner',
			'Lima bønner',
			'Sorte øjne bønner',
			'Borlotti bønner',
			'Brune linser',
			'Belugalinser',
			// Endnu flere boenner
			'Hestebønner',
			'Lupinbønner',
			'Anasazi-bønner',
			'Hyacintbønner',
			'Vingerbønner',
			'Tepari-bønner',
			'Sorte linser',
			'Gule linser',
			'Cranberry-bønner',
			'Romanske bønner'
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
			'Macadamianødder',
			// Yderligere noedder og froe
			'Jordnødder',
			'Pistacie',
			'Birkes',
			'Sennepsfrø',
			'Kokosnød',
			// Endnu flere noedder og froe
			'Kastanjer',
			'Tigernødder',
			'Vandmelonkerner',
			'Sortkommen',
			'Bogfrø',
			'Hampehjerter'
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
			'Havreris',
			// Fra fødevaredatabasen
			'Brune ris',
			'Basmati ris',
			// Yderligere ris og korn
			'Vild ris',
			'Sort ris',
			'Jasminris',
			'Teff',
			'Farro',
			'Couscous',
			// Endnu flere korn
			'Hvede',
			'Khorasan',
			'Triticale',
			'Emmer',
			'Einkorn',
			'Rød ris',
			'Sushiris',
			'Mochi ris',
			'Sorghum',
			'Fonio',
			'Kaniwa',
			'Job’s tears',
			'Polenta'
		]
	}
];

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
