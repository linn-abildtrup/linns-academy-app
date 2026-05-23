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
const KROPSRO_KOB_URL = 'https://linn.simplero.com/12uger';

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
		icon: 'workout'
	},
	{
		id: 'kost',
		navn: 'Mad',
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
		id: 'symptomcheck',
		navn: 'Symptomcheck',
		beskrivelse: 'Mål hvor du står med dine overgangsalder-symptomer',
		accent: '#C4624A',
		icon: 'flower'
	},
	{
		id: 'bibliotek',
		navn: 'Biblioteket',
		beskrivelse: 'Lektioner, videoer og pdf samlet ét sted',
		accent: '#5C7A8C',
		icon: 'book'
	}
];

export interface ModulerOptions {
	/**
	 * True hvis brugeren tidligere har været på et forløb (forlobIds.length > 0).
	 * Bruges af modulbruger-flow til at vælge mellem 'Du har gennemført
	 * Kickstart, næste skridt Kropsro' og 'Start dit forløb — Kickstart'.
	 */
	harGennemfoertForlob?: boolean;
	/**
	 * Det forløb klienten er AKTIVT på lige nu (hvis nogen). Bruges af
	 * forlobskunde-flow til at vise 'Kropsro, dag X af 84' i stedet for
	 * en hardcoded placeholder. Hvis null vises en generisk besked.
	 */
	aktivtForlob?: { navn: string; dagNummer: number; antalDage: number } | null;
}

export function getModulerForUser(state: UserState, options: ModulerOptions = {}): Modul[] {
	return MODULER_BASE.map((base) => {
		if (state === 'forlobskunde') {
			return forlobskundeStatus(base, options.aktivtForlob ?? null);
		}
		if (state === 'modulbruger') {
			return modulbrugerStatus(base, options.harGennemfoertForlob ?? false);
		}
		return udlobetStatus(base);
	});
}

function forlobskundeStatus(
	base: ModulBase,
	aktivtForlob: { navn: string; dagNummer: number; antalDage: number } | null
): Modul {
	// Forlob-sub-tekst beregnes ud fra det faktiske aktive forløb hvis det
	// findes — ellers fallback til generisk besked. De andre sub-tekster
	// (traening/kost/vaner) er placeholders indtil vi har real progress-data
	// på de moduler.
	let forlobSub = 'Dit aktive forløb';
	let forlobProgress = 0.3;
	if (aktivtForlob) {
		const { navn, dagNummer, antalDage } = aktivtForlob;
		// Strip evt suffix fra navn så det bliver fx 'Kropsro' i stedet for
		// 'Kropsro 25. Maj 2026'
		const kortNavn = navn.split(' ')[0];
		forlobSub = `${kortNavn}, dag ${dagNummer} af ${antalDage}`;
		forlobProgress = Math.max(0, Math.min(1, dagNummer / antalDage));
	}

	const subMap: Record<string, string> = {
		forlob: forlobSub,
		traening: 'Mikrotræning og styrke',
		kost: '30-30 beregner og opskrifter',
		vaner: 'Dine daglige rutiner',
		bibliotek: 'Alt fra dit forløb',
		symptomcheck: 'Følg din udvikling gennem forløbet'
	};
	const progressMap: Record<string, number | null> = {
		forlob: forlobProgress,
		traening: null,
		kost: null,
		vaner: null,
		bibliotek: null,
		symptomcheck: null
	};
	const noProgress = progressMap[base.id] === null;
	return {
		...base,
		status: 'aktiv',
		progress: noProgress ? null : progressMap[base.id],
		statusTekst: noProgress ? 'Åbent' : 'I gang',
		subTekst: subMap[base.id],
		laasTekst: null
	};
}

function modulbrugerStatus(base: ModulBase, harGennemfoertForlob: boolean): Modul {
	// Modulbrugere (basis-app) har adgang til mikrotræning, kost, vaner og
	// deres personlige bibliotek (materiale fra forløb de har gennemført —
	// tomt indtil de har været på et forløb). 'forlob'-modulet er kun for
	// aktive forløbskunder.
	const koebt = ['traening', 'kost', 'vaner', 'bibliotek', 'symptomcheck'];
	const erKoebt = koebt.includes(base.id);

	if (!erKoebt) {
		// 'forlob'-modulet er låst for modulbrugere. Teksten tilpasses efter
		// om brugeren tidligere har været på et forløb:
		//   - Har gennemført forløb: vis at næste skridt er Kropsro
		//   - Aldrig været på forløb: vis at hun kan starte med Kickstart
		if (harGennemfoertForlob) {
			return {
				...base,
				status: 'laast',
				progress: null,
				statusTekst: 'Låst',
				subTekst: 'Du har gennemført Kickstart',
				laasTekst: 'Tag næste skridt — Kropsro',
				kobUrl: KROPSRO_KOB_URL
			};
		}
		return {
			...base,
			status: 'laast',
			progress: null,
			statusTekst: 'Låst',
			subTekst: 'Strukturerede forløb gennem overgangsalderen',
			laasTekst: 'Start dit forløb — Kickstart',
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
		bibliotek: 'Dit personlige bibliotek',
		symptomcheck: 'Mål dine symptomer over tid'
	};
	const noProgress = base.id === 'bibliotek' || base.id === 'symptomcheck';
	return {
		...base,
		status: 'aktiv',
		progress: noProgress ? null : progressMap[base.id],
		statusTekst: noProgress ? 'Åbent' : 'Løbende',
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
