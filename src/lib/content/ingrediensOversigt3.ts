// ============================================================
// Oversigten over ALLE ingredienser der indgaar i opskrifterne, med de
// naeringstal de regnes med.
//
// HVORFOR DEN FINDES. Linns oenske 1. september 2026: der skal vaere ét
// sted at kontrollere tallene, ikke ét pr opskrift. Olivenolie staar 38
// steder i opskrifterne men skal kun ses efter én gang.
//
// DEN SAMLER PAA KERNENAVN og ikke paa den skrevne linje. "2 spsk
// olivenolie" og "olivenolie til stegning" er den samme vare. Samlingen
// sker med kerneNavn fra ingrediensNavn3, altsaa praecis den samme
// noegle som koblingerne bruger. Gjorde vi det anderledes, ville
// oversigten vise noget andet end regnemaskinen regner med, og saa er
// den vaerre end ingenting.
//
// TILSTANDEN BLIVER PAA NAVNET. Toerre groenne linser har 20,5 g protein,
// afdryppede har 5,7. De to er derfor to raekker her, ligesom de er to
// koblinger. Se advarslen i ingrediensNavn3.
//
// FILEN LAESER KUN. Den skriver ingenting nogen steder.
// ============================================================

import type { Fodevare } from './kost';
import type { KildeFelter, Vare3 } from './fodevareKilde3';
import type { OpskriftKategori } from './opskrifter';
import { kerneNavn, tilstand, type Tilstand } from './ingrediensNavn3';
import { bidragerIkke } from './enhedsvaegt3';
import type { KoblingsOpslag } from './opskriftMakro3';

/** De fem tal, altid pr 100 g. */
export interface Naering100 {
	protein: number;
	fiber: number;
	kh: number | null;
	fedt: number | null;
	kalorier: number | null;
}

/**
 * Hvorfor en raekke ikke har tal.
 *
 * DE TRE ER IKKE DET SAMME, og de skal ikke se ens ud paa skaermen.
 * En manglende kobling er noget Linn kan rette. En vare der er
 * forsvundet er en fejl i data. En vare uden kalorietal er halvt brugbar,
 * for protein og fiber er stadig rigtige.
 */
export type Tilstandsfejl = 'ingen kobling' | 'varen findes ikke' | 'mangler kalorier' | null;

export interface IngrediensRaekke {
	/** Noeglen. Den samme som koblingen bruger. */
	kerne: string;
	/** Toer, kogt eller afdryppet, naar det staar paa navnet. */
	tilstand: Tilstand;
	/** Alle de maader ingrediensen er skrevet paa i opskrifterne. */
	varianter: string[];
	/** Hvor mange ingrediens-linjer der bruger den. */
	antalLinjer: number;
	/** Hvor mange forskellige opskrifter den indgaar i. */
	antalOpskrifter: number;
	/** Titlerne, saa Linn kan se hvor den bruges. */
	opskriftTitler: string[];
	/** De madtyper de opskrifter hoerer til. Grundlaget for filtreringen. */
	kategorier: OpskriftKategori[];
	/** Foedevaren den er koblet til, hvis der er en. */
	vare: (Fodevare & KildeFelter) | null;
	/** Navnet paa det der leverer tallene. Egne tal foerst. */
	varenavn: string;
	/** Tallene der regnes med, pr 100 g. Null naar der ingen er. */
	naering: Naering100 | null;
	/**
	 * Sand naar tallet er sat i haanden i koblingen i stedet for at komme
	 * fra foedevaredatabasen. De 15 varer databasen ikke havde.
	 */
	egneTal: boolean;
	/** Hvor tallet kommer fra, som tekst. Kun til admin. */
	kilde: string;
	fejl: Tilstandsfejl;
}

/**
 * Ingredienser der med vilje ikke taeller, altsaa salt og peber.
 * De skal hverken have tal eller ligne en mangel.
 */
function udenBetydning(navn: string): boolean {
	return bidragerIkke(navn);
}

function naeringAf(v: Fodevare): Naering100 {
	return {
		protein: Number(v.p) || 0,
		fiber: Number(v.f) || 0,
		kh: typeof v.kh === 'number' ? v.kh : null,
		fedt: typeof v.fedt === 'number' ? v.fedt : null,
		kalorier: typeof v.kcal === 'number' ? v.kcal : null
	};
}

/** Kilde-teksten til admin. Kunden ser den ALDRIG, se samtalen 1. september. */
export function kildeTekst(v: (Fodevare & KildeFelter) | null, egen: boolean, egenKilde?: string): string {
	if (egen) return egenKilde?.trim() || 'Sat i hånden';
	if (!v) return '';
	const k = (v as Vare3).kildeType;
	if (k === 'dtu') return 'Fødevaredatabasen, DTU';
	if (k === 'linn') return 'Linns egne tal';
	if (k === 'scannet') return 'Scannet varedeklaration';
	if (v.kilde === 'custom') return 'Kundens egen vare';
	return 'Uden kilde';
}

export interface OversigtOpskrift {
	id: string;
	titel: string;
	kategorier: OpskriftKategori[];
	ingredienser: { navn: string }[];
}

/**
 * Bygger hele oversigten.
 *
 * Raekkefoelgen er de hyppigste foerst. Det er den samme praemis som
 * koblings-siden bygger paa: de 100 hyppigste navne daekker 78 procent af
 * linjerne, saa arbejdet oeverst i listen betaler sig med det samme.
 */
export function byggOversigt(
	opskrifter: OversigtOpskrift[],
	koblinger: Record<string, KoblingsOpslag>,
	varer: Map<string, Fodevare>
): IngrediensRaekke[] {
	type Saml = {
		varianter: Set<string>;
		linjer: number;
		opskrifter: Set<string>;
		titler: Set<string>;
		kategorier: Set<OpskriftKategori>;
	};
	const kort = new Map<string, Saml>();

	for (const o of opskrifter) {
		for (const ing of o.ingredienser ?? []) {
			const navn = (ing?.navn ?? '').trim();
			if (!navn) continue;
			if (udenBetydning(navn)) continue;
			const kerne = kerneNavn(navn);
			if (!kerne) continue;
			let s = kort.get(kerne);
			if (!s) {
				s = {
					varianter: new Set(),
					linjer: 0,
					opskrifter: new Set(),
					titler: new Set(),
					kategorier: new Set()
				};
				kort.set(kerne, s);
			}
			s.varianter.add(navn);
			s.linjer += 1;
			s.opskrifter.add(o.id);
			s.titler.add(o.titel);
			for (const k of o.kategorier ?? []) s.kategorier.add(k);
		}
	}

	const ud: IngrediensRaekke[] = [];
	for (const [kerne, s] of kort) {
		const kob = koblinger[kerne];
		const egen = kob?.egenVare;
		let vare: (Fodevare & KildeFelter) | null = null;
		let naering: Naering100 | null = null;
		let fejl: Tilstandsfejl = null;
		let varenavn = '';

		if (egen) {
			// Egne tal vinder over foodId. Samme regel som regnemaskinen.
			varenavn = egen.navn;
			naering = {
				protein: egen.p,
				fiber: egen.f,
				kh: egen.kh,
				fedt: egen.fedt,
				kalorier: egen.kcal
			};
		} else if (!kob || !kob.foodId) {
			fejl = 'ingen kobling';
		} else {
			const v = varer.get(kob.foodId) as (Fodevare & KildeFelter) | undefined;
			if (!v) {
				fejl = 'varen findes ikke';
			} else {
				vare = v;
				varenavn = v.name;
				naering = naeringAf(v);
				// Protein og fiber er stadig gyldige. Det er kun kalorier,
				// kulhydrat og fedt der ikke kan bruges. Se opskriftMakro3.
				if (naering.kalorier === null) fejl = 'mangler kalorier';
			}
		}

		ud.push({
			kerne,
			tilstand: tilstand(kerne),
			varianter: Array.from(s.varianter).sort((a, b) => a.localeCompare(b, 'da')),
			antalLinjer: s.linjer,
			antalOpskrifter: s.opskrifter.size,
			opskriftTitler: Array.from(s.titler).sort((a, b) => a.localeCompare(b, 'da')),
			kategorier: Array.from(s.kategorier),
			vare,
			varenavn,
			naering,
			egneTal: Boolean(egen),
			kilde: kildeTekst(vare, Boolean(egen), egen?.kilde),
			fejl
		});
	}

	return ud.sort((a, b) => b.antalLinjer - a.antalLinjer || a.kerne.localeCompare(b.kerne, 'da'));
}

/** Folder ae, oe og aa, saa der kan soeges uden danske bogstaver. */
function fold(s: string): string {
	return s
		.toLowerCase()
		.replace(/æ/g, 'ae')
		.replace(/ø/g, 'oe')
		.replace(/å/g, 'aa');
}

/**
 * Filtrerer oversigten.
 *
 * Soegeordet leder i kernenavnet, i alle de skrevne varianter og i
 * madvarens navn. Det sidste betyder noget: leder Linn efter hvad der
 * bruger "Kyllingebryst", skal hun finde ingrediensen selv om den staar
 * som "kyllingefilet" i opskriften.
 *
 * Madtyperne er OR ligesom paa opskrift-listen: en ingrediens kommer med
 * hvis den indgaar i mindst én opskrift af den slags.
 *
 * KUN de tomme er et filter for sig, for det er den liste der er en
 * opgave. Den kan kombineres med de andre.
 */
export function filtrerOversigt(
	raekker: IngrediensRaekke[],
	soeg: string,
	kategorier: OpskriftKategori[],
	kunMedFejl = false
): IngrediensRaekke[] {
	const termer = fold(soeg)
		.split(/[\s,;]+/)
		.map((t) => t.trim())
		.filter((t) => t.length > 0);

	return raekker.filter((r) => {
		if (kunMedFejl && r.fejl === null) return false;
		if (kategorier.length > 0) {
			if (!r.kategorier.some((k) => kategorier.includes(k))) return false;
		}
		if (termer.length > 0) {
			const tekst = fold([r.kerne, ...r.varianter, r.varenavn].join(' '));
			if (!termer.every((t) => tekst.includes(t))) return false;
		}
		return true;
	});
}

/** Tallene til linjen oeverst paa siden. */
export function opgoerelse(raekker: IngrediensRaekke[]): {
	ialt: number;
	medTal: number;
	udenKobling: number;
	manglerKalorier: number;
	egneTal: number;
} {
	return {
		ialt: raekker.length,
		medTal: raekker.filter((r) => r.naering !== null).length,
		udenKobling: raekker.filter((r) => r.fejl === 'ingen kobling').length,
		manglerKalorier: raekker.filter((r) => r.fejl === 'mangler kalorier').length,
		egneTal: raekker.filter((r) => r.egneTal).length
	};
}
