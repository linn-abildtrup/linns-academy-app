// Hardkodet eksempel-indhold for forløbet.
// Erstattes senere af data fra Sanity.

export interface Lektion {
	id: string;
	dag: number;
	uge: number;
	titel: string;
	beskrivelse: string;
	varighedMin: number;
	format: string;
}

export type ActionModul = 'kost' | 'traening' | 'vaner';

export interface DagensAction {
	id: string;
	modul: ActionModul;
	eyebrow: string;
	titel: string;
	meta: string;
	done: boolean;
}

export interface Forlob {
	id: string;
	titel: string;
	kortNavn: string;
	startDato: string;
	antalDage: number;
}

export interface DagensIndhold {
	dag: number;
	uge: number;
	lektioner: Lektion[];
	actions: DagensAction[];
	noteFraLinn?: string;
}

// Eksempel-forløb: Maria er på dag 8 af 21
export const aktivtForlob: Forlob = {
	id: 'kickstart-2026',
	titel: 'Kickstart en sund overgangsalder',
	kortNavn: 'Kickstart',
	startDato: '2026-04-27',
	antalDage: 21
};

// Indhold for dag 8
export const dagensIndhold: DagensIndhold = {
	dag: 8,
	uge: 2,
	lektioner: [
		{
			id: 'lektion-d8',
			dag: 8,
			uge: 2,
			titel: 'Hormoner og søvn',
			beskrivelse: 'Hvorfor du vågner kl. 3, og hvad du kan gøre ved det',
			varighedMin: 14,
			format: 'video + tekst'
		}
	],
	actions: [
		{
			id: 'action-kost-d8',
			modul: 'kost',
			eyebrow: 'Kost',
			titel: 'Log dit protein i dag',
			meta: '30g pr. måltid, 1 af 3 logget',
			done: false
		},
		{
			id: 'action-traening-d8',
			modul: 'traening',
			eyebrow: 'Træning',
			titel: 'Mikrotræning, bækkenbund',
			meta: '7 min, valgfri',
			done: true
		},
		{
			id: 'action-vaner-d8',
			modul: 'vaner',
			eyebrow: 'Vaner',
			titel: 'Tjek dagens 3 vaner',
			meta: 'vand, søvn, gå-tur',
			done: true
		}
	],
	noteFraLinn: 'Husk, uge 2 handler om søvnen. Vær blid med dig selv hvis det stadig tager tid.'
};

// Beregner hvor mange dage der er gået siden forløbet startede.
// Returnerer 1 hvis vi er på første dag, 2 hvis vi er på dag 2, osv.
// Returnerer null hvis startdato er i fremtiden.
export function getCurrentDay(forlob: Forlob, now: Date = new Date()): number | null {
	const start = new Date(forlob.startDato);
	const msPerDag = 1000 * 60 * 60 * 24;
	const startMidnat = new Date(start.getFullYear(), start.getMonth(), start.getDate());
	const nowMidnat = new Date(now.getFullYear(), now.getMonth(), now.getDate());
	const diffDage = Math.floor((nowMidnat.getTime() - startMidnat.getTime()) / msPerDag);

	if (diffDage < 0) {
		return null;
	}
	return diffDage + 1;
}

// Formaterer dato som "Tirsdag, 4. juni"
const ugedage = ['Søndag', 'Mandag', 'Tirsdag', 'Onsdag', 'Torsdag', 'Fredag', 'Lørdag'];
const maaneder = [
	'januar',
	'februar',
	'marts',
	'april',
	'maj',
	'juni',
	'juli',
	'august',
	'september',
	'oktober',
	'november',
	'december'
];

export function formatDato(date: Date = new Date()): string {
	const ugedag = ugedage[date.getDay()];
	const dag = date.getDate();
	const maaned = maaneder[date.getMonth()];
	return ugedag + ', ' + dag + '. ' + maaned;
}
