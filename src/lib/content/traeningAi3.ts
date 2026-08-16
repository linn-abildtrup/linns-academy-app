// AI-vaerktoejet til at bygge traeningsprogrammer. 16. august 2026.
//
// Rene regler. Ingen kald til nogen, saa det hele kan testes.
//
// DEN REGEL DER BAERER DET HELE: AI'en maa aldrig finde paa en oevelse.
// Beder man en model om et traeningsprogram, foreslaar den glad en
// oevelse der ikke findes i banken, ikke har en video og ikke kan
// afspilles. Saa staar kunden med en tom skaerm midt i en traening.
// Derfor sendes oevelserne med som en pulje, prompten siger at der kun
// maa vaelges derfra, og svaret valideres HER. Alt der ikke findes,
// smides vaek. Samme moenster som foreslaa-madplan allerede bruger.
//
// TO VEJE IND. Den ene laver et nyt program. Den anden retter et der
// findes. Den sidste er den svaere, og der vises altid praecis hvilke
// dage der bliver aendret, foer der gemmes.
//
// KUN DE DAGE SAETNINGEN HANDLER OM SENDES AFSTED. "Uge 3" bliver til
// dag 15 til 21 paa vores side. Et 84-dages program kan ikke sendes
// afsted hver gang hun skriver en saetning, hverken i tid eller penge.
// Kan det ikke regnes ud, spoerger AI'en i stedet for at gaette.

import type { DayExercise, TrainingDay } from './mikrotraening';
import { STANDARD_OEVELSE3 } from './traeningsprogram3';

/** Hoejeste antal dage AI'en selv skriver ud. Resten fordeler koden. */
export const MAX_AI_DAGE = 14;

/** Hoejeste antal dage vi sender med naar hun retter et program. */
export const MAX_RET_DAGE = 14;

/** Beskeder pr samtale. Bremser en loekke, ikke hende. */
export const MAX_BESKEDER = 40;

export const MAX_BESKED_TEGN = 1000;

/**
 * AI-samtaler pr dag for admin.
 *
 * Kundernes AI-funktioner har 20 og deler ikke taeller med den her. Et
 * program tager fem til ti beskeder, saa 20 ville kun raekke til to
 * eller tre programmer om dagen. Spaerren mod en loebsk fejl der koster
 * penge natten over er der stadig. Linns valg 16. august.
 */
export const MAX_AI_PR_DAG = 60;

/**
 * Det valideringen skal vide om en oevelse: at den findes, og at den er
 * taendt. Exercise passer paa den af sig selv, og saa kan serveren
 * sende den samme liste videre som den sendte til AI'en uden at bygge
 * en halv Exercise for at faa typerne til at passe.
 */
export interface BankOevelse3 {
	id: string;
	aktiv: boolean;
}

export type AiRolle3 = 'bruger' | 'ai';

export interface AiBesked3 {
	rolle: AiRolle3;
	tekst: string;
}

/** Én oevelse som AI'en har svaret. Raa, altsaa endnu ikke valideret. */
export interface AiOevelseRaa3 {
	exerciseId?: unknown;
	sets?: unknown;
	workSec?: unknown;
	restSec?: unknown;
	bonus?: unknown;
}

export interface AiDagRaa3 {
	dagNummer?: unknown;
	titel?: unknown;
	indledning?: unknown;
	oevelser?: unknown;
}

export interface AiSvarRaa3 {
	svar?: unknown;
	navn?: unknown;
	beskrivelse?: unknown;
	antalDage?: unknown;
	dage?: unknown;
}

/** Et forslag der har vaeret gennem valideringen og er til at stole paa. */
export interface AiForslag3 {
	navn: string;
	beskrivelse: string;
	antalDage: number;
	dage: TrainingDay[];
}

export interface AiSvar3 {
	/** Det AI'en siger i samtalen. Staar altid, ogsaa naar der er forslag. */
	svar: string;
	/** null naar den stiller et spoergsmaal i stedet for at foreslaa. */
	forslag: AiForslag3 | null;
}

// ============================================================
// Validering af det AI'en svarer
// ============================================================

function tilHeltal(v: unknown, standard: number, min: number, max: number): number {
	const n = typeof v === 'number' ? v : Number(v);
	if (!Number.isFinite(n)) return standard;
	return Math.min(max, Math.max(min, Math.round(n)));
}

function tekstFra(v: unknown, maxLaengde: number): string {
	if (typeof v !== 'string') return '';
	return v.trim().slice(0, maxLaengde);
}

/**
 * Én oevelse, renset.
 *
 * Findes id'et ikke i banken, eller er oevelsen slukket, faar vi null og
 * den falder ud. Tallene klippes ind i de graenser resten af 3.0 bruger
 * i stedet for at blive afvist: en model der skriver 25 saet skal ikke
 * vaelte hele forslaget, den skal rettes til 20.
 */
export function rensOevelse3(
	raa: AiOevelseRaa3,
	bank: Map<string, BankOevelse3>
): DayExercise | null {
	const id = typeof raa.exerciseId === 'string' ? raa.exerciseId : '';
	const fundet = bank.get(id);
	if (!fundet || !fundet.aktiv) return null;
	return {
		exerciseId: id,
		sets: tilHeltal(raa.sets, STANDARD_OEVELSE3.sets, 1, 20),
		workSec: tilHeltal(raa.workSec, STANDARD_OEVELSE3.workSec, 5, 600),
		restSec: tilHeltal(raa.restSec, STANDARD_OEVELSE3.restSec, 0, 600),
		bonus: raa.bonus === true
	};
}

/** Én dag, renset. Dage uden en eneste rigtig oevelse falder ud. */
export function rensDag3(
	raa: AiDagRaa3,
	nr: number,
	bank: Map<string, BankOevelse3>,
	medTekst: boolean
): TrainingDay | null {
	const liste = Array.isArray(raa.oevelser) ? raa.oevelser : [];
	const exercises = liste
		.map((o) => rensOevelse3(o as AiOevelseRaa3, bank))
		.filter((o): o is DayExercise => o !== null);
	if (exercises.length === 0) return null;
	return {
		dagNummer: nr,
		titel: medTekst ? tekstFra(raa.titel, 80) : '',
		indledning: medTekst ? tekstFra(raa.indledning, 400) : '',
		exercises
	};
}

/**
 * Fordeler en skabelon ud over det antal dage hun bad om.
 *
 * AI'en skriver hoejst 14 dage. Beder man en model skrive 84 dage ud i
 * ét svar, bliver de sidste tredive sjuskede, og det koster mange
 * penge. Lader man den designe en uge og lader koden fordele den,
 * bliver det baade bedre og billigere. Linns beslutning 15. august.
 *
 * Skabelonen forskydes én plads for hver gentagelse, saa uge to ikke er
 * en kopi af uge ét. Der kommer ingen nye oevelser til: alt hvad der
 * staar, har AI'en valgt, og alt hvad AI'en valgte, findes i banken.
 */
export function udfoldDage3(skabelon: TrainingDay[], antalDage: number): TrainingDay[] {
	if (skabelon.length === 0) return [];
	const ud: TrainingDay[] = [];
	for (let i = 0; i < antalDage; i++) {
		const runde = Math.floor(i / skabelon.length);
		const kilde = skabelon[(i + runde) % skabelon.length];
		ud.push({
			dagNummer: i + 1,
			titel: kilde.titel,
			indledning: kilde.indledning,
			exercises: kilde.exercises.map((o) => ({ ...o }))
		});
	}
	return ud;
}

/**
 * Hele svaret, renset.
 *
 * Returnerer altid noget. Er der ingenting brugbart i forslaget, staar
 * `forslag` som null og samtalen fortsaetter. Et halvt forslag er
 * vaerre end intet forslag, for saa tror hun at det er faerdigt.
 */
export function rensSvar3(
	raa: AiSvarRaa3,
	oevelser: BankOevelse3[],
	medTekst: boolean,
	oensketAntalDage: number
): AiSvar3 {
	const bank = new Map(oevelser.map((e) => [e.id, e]));
	const svar = tekstFra(raa.svar, 2000);

	const raaDage = Array.isArray(raa.dage) ? raa.dage : [];
	const skabelon = raaDage
		.slice(0, MAX_AI_DAGE)
		.map((d, i) => rensDag3(d as AiDagRaa3, i + 1, bank, medTekst))
		.filter((d): d is TrainingDay => d !== null)
		.map((d, i) => ({ ...d, dagNummer: i + 1 }));

	if (skabelon.length === 0) return { svar, forslag: null };

	const antalDage = tilHeltal(raa.antalDage, oensketAntalDage, 1, 365);
	return {
		svar,
		forslag: {
			navn: tekstFra(raa.navn, 60) || 'Nyt program',
			beskrivelse: tekstFra(raa.beskrivelse, 400),
			antalDage,
			dage: udfoldDage3(skabelon, antalDage)
		}
	};
}

// ============================================================
// Hvilke dage handler saetningen om
// ============================================================

const TAL_ORD: Record<string, number> = {
	en: 1,
	et: 1,
	to: 2,
	tre: 3,
	fire: 4,
	fem: 5,
	seks: 6,
	syv: 7,
	otte: 8,
	ni: 9,
	ti: 10
};

function tal(ord: string): number | null {
	const rent = ord.trim().toLowerCase();
	if (/^\d+$/.test(rent)) return Number(rent);
	return TAL_ORD[rent] ?? null;
}

function spaend(fra: number, til: number, antalDage: number): number[] {
	const start = Math.max(1, Math.min(fra, til));
	const slut = Math.min(antalDage, Math.max(fra, til));
	if (start > antalDage || slut < 1) return [];
	const ud: number[] = [];
	for (let i = start; i <= slut; i++) ud.push(i);
	return ud;
}

/**
 * Hvilke dage hun taler om.
 *
 * Returnerer null naar det ikke kan regnes ud. Saa spoerger AI'en
 * hvilke dage hun mener i stedet for at gaette, og det er med vilje:
 * et gaet der rammer forkert retter dage hun ikke bad om.
 *
 * En tom liste betyder at hun naevnte dage der ligger uden for
 * programmet, fx uge 20 i et program paa 14 dage.
 */
export function dageFraSaetning3(tekst: string, antalDage: number): number[] | null {
	const t = tekst.toLowerCase();

	// "uge 2 til 4" og "uge 2-4"
	const ugeSpaend = t.match(/uge\s+(\w+)\s*(?:til|-|og)\s*(?:uge\s*)?(\w+)/);
	if (ugeSpaend) {
		const a = tal(ugeSpaend[1]);
		const b = tal(ugeSpaend[2]);
		if (a !== null && b !== null) return spaend((a - 1) * 7 + 1, b * 7, antalDage);
	}

	// "uge 3"
	const uge = t.match(/uge\s+(\w+)/);
	if (uge) {
		const n = tal(uge[1]);
		if (n !== null) return spaend((n - 1) * 7 + 1, n * 7, antalDage);
	}

	// "dag 15 til 21" og "dag 15-21"
	const dagSpaend = t.match(/dag\s+(\w+)\s*(?:til|-|og)\s*(?:dag\s*)?(\w+)/);
	if (dagSpaend) {
		const a = tal(dagSpaend[1]);
		const b = tal(dagSpaend[2]);
		if (a !== null && b !== null) return spaend(a, b, antalDage);
	}

	// "dag 5"
	const dag = t.match(/dag\s+(\w+)/);
	if (dag) {
		const n = tal(dag[1]);
		if (n !== null) return spaend(n, n, antalDage);
	}

	// "de foerste to uger", "de sidste tre dage"
	const foerste = t.match(/f(?:ø|oe)rste\s+(\w+)\s+(uger?|dage?)/);
	if (foerste) {
		const n = tal(foerste[1]);
		if (n !== null) {
			const laengde = foerste[2].startsWith('uge') ? n * 7 : n;
			return spaend(1, laengde, antalDage);
		}
	}
	const sidste = t.match(/sidste\s+(\w+)\s+(uger?|dage?)/);
	if (sidste) {
		const n = tal(sidste[1]);
		if (n !== null) {
			const laengde = sidste[2].startsWith('uge') ? n * 7 : n;
			return spaend(antalDage - laengde + 1, antalDage, antalDage);
		}
	}

	// "hele programmet" og "alle dage". Er programmet kort nok, sender vi
	// det hele. Er det langt, spoerger AI'en hvilken del hun mener, for
	// 84 dage kan ikke sendes afsted paa én gang.
	if (/hele programmet|alle dage|hele vejen|alle traeninger|alle træninger/.test(t)) {
		return antalDage <= MAX_RET_DAGE ? spaend(1, antalDage, antalDage) : null;
	}

	return null;
}

// ============================================================
// Hvad bliver aendret
// ============================================================

export type AendringsArt3 = 'aendret' | 'uroert';

export interface Aendring3 {
	dagNummer: number;
	art: AendringsArt3;
	/** Linjerne under dagen, fx "Kettlebell swing, 4 sæt → Hoftevip, 3 sæt". */
	linjer: string[];
}

function oevelseTekst3(o: DayExercise, navnPaa: (id: string) => string): string {
	return `${navnPaa(o.exerciseId)}, ${o.sets} sæt`;
}

/**
 * Hvad der bliver aendret, dag for dag.
 *
 * Der vises ALTID praecis hvilke dage der bliver roert, foer der gemmes.
 * Linns krav 15. august, og det er den vigtigste spaerre i ret-vejen:
 * uden den kan hun ikke se om AI'en har roert dage hun ikke bad om.
 */
export function aendringsliste3(
	foer: TrainingDay[],
	efter: TrainingDay[],
	navnPaa: (id: string) => string
): Aendring3[] {
	const efterKort = new Map(efter.map((d) => [d.dagNummer, d]));
	const ud: Aendring3[] = [];

	for (const gammel of foer) {
		const ny = efterKort.get(gammel.dagNummer);
		if (!ny) {
			ud.push({ dagNummer: gammel.dagNummer, art: 'uroert', linjer: [] });
			continue;
		}
		const linjer: string[] = [];
		const antal = Math.max(gammel.exercises.length, ny.exercises.length);
		for (let i = 0; i < antal; i++) {
			const a = gammel.exercises[i];
			const b = ny.exercises[i];
			if (!a && b) {
				linjer.push(`Ny: ${oevelseTekst3(b, navnPaa)}`);
			} else if (a && !b) {
				linjer.push(`Ud: ${oevelseTekst3(a, navnPaa)}`);
			} else if (a && b) {
				const foerTekst = oevelseTekst3(a, navnPaa);
				const efterTekst = oevelseTekst3(b, navnPaa);
				if (foerTekst !== efterTekst || a.workSec !== b.workSec || a.restSec !== b.restSec) {
					linjer.push(`${foerTekst} → ${efterTekst}`);
				}
			}
		}
		ud.push({
			dagNummer: gammel.dagNummer,
			art: linjer.length > 0 ? 'aendret' : 'uroert',
			linjer
		});
	}
	return ud;
}

/** Numrene paa de dage der faktisk bliver aendret. */
export function aendredeDage3(liste: Aendring3[]): number[] {
	return liste.filter((a) => a.art === 'aendret').map((a) => a.dagNummer);
}

/** Slaar sammenhaengende numre sammen: [1,2,3,7] bliver "1 til 3 og 7". */
export function numreTekst3(numre: number[]): string {
	const sorteret = [...new Set(numre)].sort((a, b) => a - b);
	if (sorteret.length === 0) return '';
	const stykker: string[] = [];
	let start = sorteret[0];
	let sidst = sorteret[0];
	for (const n of sorteret.slice(1)) {
		if (n === sidst + 1) {
			sidst = n;
			continue;
		}
		stykker.push(start === sidst ? `${start}` : `${start} til ${sidst}`);
		start = n;
		sidst = n;
	}
	stykker.push(start === sidst ? `${start}` : `${start} til ${sidst}`);
	if (stykker.length === 1) return stykker[0];
	return `${stykker.slice(0, -1).join(', ')} og ${stykker[stykker.length - 1]}`;
}

/**
 * Linjen om hvad der IKKE bliver roert.
 *
 * Lige saa vigtig som listen over det der aendres. Linns ord 15. august.
 */
export function uroerteTekst3(aendrede: number[], antalDage: number): string {
	const roert = new Set(aendrede);
	const fri: number[] = [];
	for (let i = 1; i <= antalDage; i++) if (!roert.has(i)) fri.push(i);
	if (fri.length === 0) return 'Alle dage i programmet bliver ændret.';
	if (fri.length === antalDage) return 'Ingen dage bliver ændret.';
	return `Dag ${numreTekst3(fri)} er urørte.`;
}

/**
 * Beskeden til hende naar en saetning ikke kan oversaettes til dage.
 * AI'en spoerger i stedet for at gaette.
 */
export function hvilkeDageSpoergsmaal3(antalDage: number): string {
	return `Hvilke dage mener du? Programmet er på ${antalDage} dage, og jeg kan tage op til ${MAX_RET_DAGE} ad gangen. Skriv fx "uge 3" eller "dag 15 til 21".`;
}

// ============================================================
// Samtalen
// ============================================================

/** Kan hun sende én mere. Bremser en loekke i koden, ikke hende. */
export function maaSendeMere3(beskeder: AiBesked3[]): boolean {
	return beskeder.length < MAX_BESKEDER;
}

export function validerBesked3(tekst: string): string | null {
	const rent = tekst.trim();
	if (!rent) return 'Skriv hvad du vil have.';
	if (rent.length > MAX_BESKED_TEGN) {
		return `Beskeden må højst være ${MAX_BESKED_TEGN} tegn.`;
	}
	return null;
}

/** Kort linje under forslaget, saa hun kan se hvad hun faar. */
export function forslagTekst3(forslag: AiForslag3, kategoriNavn: string): string {
	const dele = [
		kategoriNavn,
		forslag.antalDage === 1 ? '1 træning' : `${forslag.antalDage} træninger`
	].filter(Boolean);
	return dele.join(' · ');
}
