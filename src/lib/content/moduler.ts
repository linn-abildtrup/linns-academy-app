import type { UserState } from '$lib/types';
import type { IconName } from '$lib/components/Icon.svelte';

export type ModulStatus = 'aktiv' | 'laast' | 'laeseadgang';

export interface Modul {
	id: string;
	navn: string;
	beskrivelse: string;
	accent: string;
	icon: IconName;
	status: ModulStatus;
	progress: number | null;
	statusTekst: string;
	subTekst: string;
	laasTekst: string | null;
	/** Ekstern købs-URL — vises hvis modulet er låst og brugeren kan købe det. */
	kobUrl?: string;
}

const KICKSTART_KOB_URL = 'https://linn.simplero.com/21dage';

interface ModulBase {
	id: string;
	navn: string;
	beskrivelse: string;
	accent: string;
	icon: IconName;
}

const MODULER_BASE: ModulBase[] = [
	{
		id: 'forlob',
		navn: 'Mit forløb',
		beskrivelse: 'Strukturerede rejser gennem overgangsalderen',
		accent: '#9D6358',
		icon: 'path'
	},
	{
		id: 'traening',
		navn: 'Træning',
		beskrivelse: 'Mikrotræning og styrke for kroppen',
		accent: '#B87B6E',
		icon: 'flame'
	},
	{
		id: 'kost',
		navn: 'Kost',
		beskrivelse: '30-30 beregner og opskrifter',
		accent: '#B8956A',
		icon: 'leaf'
	},
	{
		id: 'vaner',
		navn: 'Vaner',
		beskrivelse: 'Vanetracker og daglige rutiner',
		accent: '#6F9E7E',
		icon: 'check'
	},
	{
		id: 'bibliotek',
		navn: 'Biblioteket',
		beskrivelse: 'Lektioner, videoer og pdf samlet ét sted',
		accent: '#5C7A8C',
		icon: 'book'
	}
];

export function getModulerForUser(state: UserState): Modul[] {
	return MODULER_BASE.map((base) => {
		if (state === 'forlobskunde') {
			return forlobskundeStatus(base);
		}
		if (state === 'modulbruger') {
			return modulbrugerStatus(base);
		}
		return udlobetStatus(base);
	});
}

function forlobskundeStatus(base: ModulBase): Modul {
	const progressMap: Record<string, number> = {
		forlob: 0.3,
		traening: 0.42,
		kost: 0.65,
		vaner: 0.18,
		bibliotek: 0
	};
	const subMap: Record<string, string> = {
		forlob: 'Kickstart, dag 6 af 21',
		traening: '3 af 7 sessioner',
		kost: 'Uge 4 af 6',
		vaner: '3 dage i træk',
		bibliotek: 'Alt fra dit forløb'
	};
	const isLibrary = base.id === 'bibliotek';
	return {
		...base,
		status: 'aktiv',
		progress: isLibrary ? null : progressMap[base.id],
		statusTekst: isLibrary ? 'Åbent' : 'I gang',
		subTekst: subMap[base.id],
		laasTekst: null
	};
}

function modulbrugerStatus(base: ModulBase): Modul {
	// Modulbrugere (basis-app) har adgang til mikrotræning, kost, vaner og
	// deres personlige bibliotek (materiale fra forløb de har gennemført —
	// tomt indtil de har været på et forløb). 'forlob'-modulet er kun for
	// aktive forløbskunder.
	const koebt = ['traening', 'kost', 'vaner', 'bibliotek'];
	const erKoebt = koebt.includes(base.id);

	if (!erKoebt) {
		return {
			...base,
			status: 'laast',
			progress: null,
			statusTekst: 'Låst',
			subTekst: 'Findes kun i Kickstart-forløbet',
			laasTekst: 'Få adgang via Kickstart',
			kobUrl: KICKSTART_KOB_URL
		};
	}

	const progressMap: Record<string, number> = {
		traening: 0.42,
		kost: 0.65,
		vaner: 0.18
	};
	const subMap: Record<string, string> = {
		traening: '3 af 7 sessioner',
		kost: 'Uge 4 af 6',
		vaner: '3 dage i træk',
		bibliotek: 'Dit personlige bibliotek'
	};
	const isLibrary = base.id === 'bibliotek';
	return {
		...base,
		status: 'aktiv',
		progress: isLibrary ? null : progressMap[base.id],
		statusTekst: isLibrary ? 'Åbent' : 'Løbende',
		subTekst: subMap[base.id],
		laasTekst: null
	};
}

function udlobetStatus(base: ModulBase): Modul {
	// Udløbet Kickstart-bruger har KUN adgang til bibliotek (forevigt).
	// Bibliotek indeholder alt brugerens personlige indhold:
	//   - FAQ + Links + Lektioner + Træningsøvelser + Opskrifter
	// Alle andre moduler er låst — deres indhold (træning + opskrifter)
	// er flyttet til biblioteket så det er ét samlet sted at finde alt.
	if (base.id === 'bibliotek') {
		return {
			...base,
			status: 'aktiv',
			progress: null,
			statusTekst: 'Åbent',
			subTekst: 'Dit personlige bibliotek',
			laasTekst: null
		};
	}
	const subMap: Record<string, string> = {
		traening: 'Øvelserne ligger i biblioteket',
		kost: 'Opskrifterne ligger i biblioteket',
		vaner: 'Kræver aktivt abonnement eller forløb',
		forlob: 'Kræver aktivt forløb'
	};
	return {
		...base,
		status: 'laast',
		progress: null,
		statusTekst: 'Låst',
		subTekst: subMap[base.id] ?? 'Kræver aktivt abonnement eller forløb',
		laasTekst: 'Få adgang igen',
		kobUrl: KICKSTART_KOB_URL
	};
}
