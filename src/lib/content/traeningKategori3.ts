// Traeningskategorier i 3.0. Bid 1 af traeningsmodulet, 15. august 2026.
//
// En kategori er det udstyr kunden traener med, fx "Uden redskaber" eller
// "Med kettlebell". Linn opretter og navngiver dem selv.
//
// HVORFOR DE IKKE STAAR I KODEN
// I dag findes kun kettlebell og uden kettlebell, og de staar haardkodet
// flere steder i den gamle app. Der kan ikke komme et sjippetov ind uden
// en kodeaendring. Naar kategorierne er data, kan Linn lave saa mange hun
// vil uden at nogen skal roere koden.
//
// VISES ALTID
// Én kategori kan maerkes visesAltid, og det flueben saettes paa "Uden
// redskaber". Kropsvaegts-programmer skal vaere synlige uanset hvad kunden
// har valgt, fordi hun altid har sin egen krop med. Uden det kunne hun
// vaelge haandvaegte og staa tilbage med en tom skaerm.
//
// KOBLINGEN TIL OEVELSESBANKEN
// udstyrTag peger paa de maerkater oevelserne allerede har. Den bruges KUN
// til at forudfiltrere naar Linn vaelger oevelser eller beder om et udkast.
// Nye kategorier som sjippetov har ingen maerkater i banken endnu, og saa
// staar udstyrTag til null og hun vaelger frit. Filteret maa aldrig spaerre.

import type { Exercise, Udstyr } from './mikrotraening';
import type { Traeningsprogram3 } from './traeningsprogram3';

export interface TraeningKategori3 {
	id: string;
	navn: string;
	/** Vises altid, uanset hvad kunden har valgt. Saettes paa kropsvaegt. */
	visesAltid: boolean;
	/** Kobling til oevelsesbankens udstyrs-maerkater. null = ingen kobling. */
	udstyrTag: Udstyr | null;
	raekkefolge: number;
}

export const MAX_KATEGORI_NAVN = 40;

/** Valgene i rullelisten paa kategori-arket. Labels er dem Linn ser. */
export const UDSTYR_VALG: { vaerdi: Udstyr | null; label: string }[] = [
	{ vaerdi: null, label: 'Ingen kobling' },
	{ vaerdi: 'ingen', label: 'Ingen redskaber' },
	{ vaerdi: 'kettlebell', label: 'Kettlebell' },
	{ vaerdi: 'haandvaegte', label: 'Håndvægte' },
	{ vaerdi: 'elastik', label: 'Elastik' },
	{ vaerdi: 'forhojning', label: 'Forhøjning' }
];

/**
 * Validerer navnet. To kategorier maa ikke hedde det samme, for kunden
 * vaelger dem paa navnet og ville ikke kunne se forskel.
 */
export function validerKategori3(
	navn: string,
	alle: TraeningKategori3[],
	egetId?: string
): string | null {
	const rent = navn.trim();
	if (!rent) return 'Kategorien skal have et navn.';
	if (rent.length > MAX_KATEGORI_NAVN) {
		return `Navnet må højst være ${MAX_KATEGORI_NAVN} tegn.`;
	}
	const findesAllerede = alle.some(
		(k) => k.id !== egetId && k.navn.trim().toLowerCase() === rent.toLowerCase()
	);
	if (findesAllerede) return 'Der findes allerede en kategori med det navn.';
	return null;
}

export function sorterKategorier3(kategorier: TraeningKategori3[]): TraeningKategori3[] {
	return [...kategorier].sort(
		(a, b) => a.raekkefolge - b.raekkefolge || a.navn.localeCompare(b.navn, 'da')
	);
}

/** Naeste ledige plads i raekkefoelgen, saa en ny kategori lander nederst. */
export function naesteRaekkefolge3(kategorier: TraeningKategori3[]): number {
	if (kategorier.length === 0) return 0;
	return Math.max(...kategorier.map((k) => k.raekkefolge)) + 1;
}

/**
 * Flytter en kategori én plads op eller ned og nummererer hele listen om,
 * saa raekkefoelgen altid er 0, 1, 2 uden huller. Returnerer listen
 * uaendret hvis kategorien allerede ligger yderst.
 */
export function flytKategori3(
	kategorier: TraeningKategori3[],
	id: string,
	retning: 'op' | 'ned'
): TraeningKategori3[] {
	const sorteret = sorterKategorier3(kategorier);
	const index = sorteret.findIndex((k) => k.id === id);
	const til = retning === 'op' ? index - 1 : index + 1;
	if (index < 0 || til < 0 || til >= sorteret.length) return sorteret;
	[sorteret[index], sorteret[til]] = [sorteret[til], sorteret[index]];
	return sorteret.map((k, i) => ({ ...k, raekkefolge: i }));
}

/**
 * En kategori med programmer i maa ikke slettes. Ellers ville programmerne
 * staa uden kategori, og saa kan kunden ikke se dem nogen steder.
 * Returnerer en besked Linn kan laese, eller null hvis den maa slettes.
 */
export function kategoriKanSlettes3(
	id: string,
	programmer: Traeningsprogram3[]
): string | null {
	const antal = programmer.filter((p) => p.kategoriId === id).length;
	if (antal === 0) return null;
	return antal === 1
		? 'Der ligger 1 program i kategorien. Flyt det først.'
		: `Der ligger ${antal} programmer i kategorien. Flyt dem først.`;
}

/** Navnet paa en kategori. Tom streng hvis den er slettet under os. */
export function kategoriNavn3(id: string, kategorier: TraeningKategori3[]): string {
	return kategorier.find((k) => k.id === id)?.navn ?? '';
}

/** Oevelser der ikke kraever noget som helst. Tomt udstyr taeller ogsaa. */
export function kraeverIntetUdstyr(oevelse: Exercise): boolean {
	const u = oevelse.udstyr ?? [];
	return u.length === 0 || u.every((x) => x === 'ingen');
}

/**
 * Oevelserne der passer til en kategori.
 *
 * Uden kobling faar hun alle. Med en kobling faar hun dem der bruger netop
 * det udstyr PLUS dem der ingen redskaber kraever, fordi et kettlebell-
 * program ogsaa indeholder mavebøjninger. Oevelser der kraever et ANDET
 * redskab falder fra, for dem har hun ikke.
 *
 * Kun aktive oevelser. En slukket oevelse skal ikke kunne komme ind i et
 * nyt program ad bagvejen.
 */
export function filtrerOevelserTilKategori(
	oevelser: Exercise[],
	udstyrTag: Udstyr | null
): Exercise[] {
	const aktive = oevelser.filter((e) => e.aktiv);
	if (udstyrTag === null) return aktive;
	if (udstyrTag === 'ingen') return aktive.filter(kraeverIntetUdstyr);
	return aktive.filter((e) => kraeverIntetUdstyr(e) || (e.udstyr ?? []).includes(udstyrTag));
}
