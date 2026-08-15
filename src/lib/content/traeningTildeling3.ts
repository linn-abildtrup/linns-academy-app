// Tildeling af traeningsprogrammer i 3.0. Bid 2, 15. august 2026.
//
// En tildeling siger HVEM der faar et program, og HVORNAAR det gaelder.
//
// FIRE SLAGS MODTAGERE
//   hold       ét bestemt hold, fx Kickstart juni 2026
//   kunde      én person
//   medlemmer  alle med et aktivt abonnement
//   alle       alle der kan aabne appen
//
// Linns valg 15. august: hold er ÉT bestemt hold og ikke forloebet
// generelt. Prisen er at hvert nyt hold starter paa nul, og det er
// derfor daeknings-siden og kopiér-knappen findes.
//
// TID MAALES TO FORSKELLIGE STEDER
// Til et hold maales i DAGE i forloebet, fordi holdet har sin egen
// startdato. Til en person, til medlemmer og til alle maales i DATOER.
// Det er den eneste rigtige forskel mellem de fire slags.
//
// DAGEN ER DEN SAMME SOM RESTEN AF APPEN REGNER MED, altsaa den
// getCurrentDay i content/forlob.ts giver, hvor startdatoen er dag 0.
// Der laves ingen omregning her. En omregning er lige praecis det der
// gav en off-by-one i traeningen 12. juni.
//
// BYG EGET PROGRAM ligger i den samme tabel som en tildeling uden
// program, saa adgangen styres med de samme fire knapper. Linns valg.

import type { TraeningKategori3 } from './traeningKategori3';
import type { Traeningsprogram3 } from './traeningsprogram3';

export type ModtagerType3 = 'hold' | 'kunde' | 'medlemmer' | 'alle';
export type TildelingsType3 = 'program' | 'byg-eget';

export interface Traeningstildeling3 {
	id: string;
	type: TildelingsType3;
	/** Tom streng naar type er 'byg-eget'. */
	programId: string;
	modtagerType: ModtagerType3;
	/** Forloebs-id ved 'hold', uid ved 'kunde', tom ved 'medlemmer' og 'alle'. */
	modtagerId: string;
	/**
	 * Modtagerens navn, gemt med i selve tildelingen. Saa kan listen vise
	 * "Mette Hansen" uden at hente 700 kunder for at slaa ét navn op.
	 */
	modtagerNavn: string;
	/** Kun 'hold'. Dagen i forloebet den gaelder fra. 0 er foerste dag. */
	fraDag: number;
	/** Kun 'hold'. null betyder resten af forloebet. */
	tilDag: number | null;
	/** Kun de tre oevrige. YYYY-MM-DD. null betyder med det samme. */
	fraDato: string | null;
	/** Kun de tre oevrige. null betyder ingen slutdato. */
	tilDato: string | null;
	tildeltAt: number;
	tildeltAf: string;
}

export type Tildelingsstatus3 = 'aktiv' | 'venter' | 'slut';

/** Et hold som admin ser det i vaelgeren. */
export interface HoldValg3 {
	id: string;
	navn: string;
	/** Holdets dag lige nu. null naar det ikke er startet. */
	dag: number | null;
	/** Antal kunder paa holdet, eller null naar tallet ikke er hentet. */
	antalKunder: number | null;
}

/** Sand naar tildelingens tid maales i dage og ikke i datoer. */
export function maalerIDage3(t: Pick<Traeningstildeling3, 'modtagerType'>): boolean {
	return t.modtagerType === 'hold';
}

const MAANEDER = [
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

/** 2026-10-01 bliver til "1. oktober 2026". */
export function datoTekst3(iso: string): string {
	const [aar, maaned, dag] = iso.split('-').map(Number);
	if (!aar || !maaned || !dag) return iso;
	return `${dag}. ${MAANEDER[maaned - 1]} ${aar}`;
}

export interface StatusKontekst3 {
	/** Dagens dato som YYYY-MM-DD. */
	idag: string;
	/** Holdets dag lige nu. null naar holdet ikke er startet endnu. */
	holdDag?: number | null;
}

/**
 * Tilstanden lige nu: aktiv, venter eller slut.
 *
 * Uden den skal Linn regne datoer ud i hovedet for at vide om en
 * tildeling overhovedet virker.
 */
export function tildelingStatus3(
	t: Traeningstildeling3,
	kontekst: StatusKontekst3
): Tildelingsstatus3 {
	if (maalerIDage3(t)) {
		const dag = kontekst.holdDag ?? null;
		if (dag === null) return 'venter';
		if (dag < t.fraDag) return 'venter';
		if (t.tilDag !== null && dag > t.tilDag) return 'slut';
		return 'aktiv';
	}
	if (t.fraDato && kontekst.idag < t.fraDato) return 'venter';
	if (t.tilDato && kontekst.idag > t.tilDato) return 'slut';
	return 'aktiv';
}

/** Perioden skrevet som Linn laeser den, fx "Fra dag 15" eller "Med det samme". */
export function periodeTekst3(t: Traeningstildeling3): string {
	if (maalerIDage3(t)) {
		if (t.tilDag === null) return t.fraDag <= 0 ? 'Fra første dag' : `Fra dag ${t.fraDag}`;
		return `Dag ${t.fraDag} til ${t.tilDag}`;
	}
	if (!t.fraDato && !t.tilDato) return 'Med det samme';
	if (t.fraDato && !t.tilDato) return `Fra ${datoTekst3(t.fraDato)}`;
	if (!t.fraDato && t.tilDato) return `Indtil ${datoTekst3(t.tilDato)}`;
	return `${datoTekst3(t.fraDato as string)} til ${datoTekst3(t.tilDato as string)}`;
}

/** Modtageren skrevet som Linn laeser den. */
export function modtagerTekst3(t: Traeningstildeling3): string {
	if (t.modtagerType === 'medlemmer') return 'Alle med et abonnement';
	if (t.modtagerType === 'alle') return 'Alle med appen';
	return t.modtagerNavn || t.modtagerId;
}

// ── Hvem en tildeling rammer ────────────────────────────────────

export interface KundeKontekst3 {
	uid: string;
	/** Kundens forloeb med hendes dag i hvert. null naar det ikke er startet. */
	forlob: { id: string; dag: number | null }[];
	/** Har hun et aktivt app-abonnement. Linns definition 15. august. */
	harAbonnement: boolean;
	/** Kategori-id'er hun har valgt. TOM LISTE betyder hun ikke har valgt endnu. */
	udstyr: string[];
	/** Dagens dato som YYYY-MM-DD. */
	idag: string;
}

/**
 * Rammer tildelingen overhovedet den her kunde. Tiden er ikke regnet med
 * her, kun hvem.
 */
export function rammerKunde3(t: Traeningstildeling3, kunde: KundeKontekst3): boolean {
	if (t.modtagerType === 'alle') return true;
	if (t.modtagerType === 'medlemmer') return kunde.harAbonnement;
	if (t.modtagerType === 'kunde') return t.modtagerId === kunde.uid;
	return kunde.forlob.some((f) => f.id === t.modtagerId);
}

function kontekstFor(t: Traeningstildeling3, kunde: KundeKontekst3): StatusKontekst3 {
	if (!maalerIDage3(t)) return { idag: kunde.idag };
	const hold = kunde.forlob.find((f) => f.id === t.modtagerId);
	return { idag: kunde.idag, holdDag: hold?.dag ?? null };
}

/**
 * Maa programmet ses med kundens udstyr.
 *
 * TOM UDSTYRSLISTE BETYDER JA TIL ALT. Hun har ikke valgt endnu, og
 * indtil valget findes i bid 3 har ingen kunde valgt noget. Skjulte vi
 * alt for dem, ville admin-opslaget vise at 700 kunder ingen traening
 * har, og det passer ikke.
 */
export function maaSesMedUdstyr3(
	program: Traeningsprogram3,
	kategorier: TraeningKategori3[],
	udstyr: string[]
): boolean {
	if (udstyr.length === 0) return true;
	const kategori = kategorier.find((k) => k.id === program.kategoriId);
	if (kategori?.visesAltid) return true;
	return udstyr.includes(program.kategoriId);
}

export type Afvisning3 = 'kladde' | 'ikke-tildelt' | 'venter' | 'sluttet' | 'udstyr';

export interface ProgramForKunde3 {
	program: Traeningsprogram3;
	vises: boolean;
	afvisning: Afvisning3 | null;
	/** Hvorfor, paa dansk. Vises baade naar hun ser det og naar hun ikke goer. */
	forklaring: string;
}

function kildeTekst(t: Traeningstildeling3): string {
	if (t.modtagerType === 'hold') return `Fra ${t.modtagerNavn} · ${periodeTekst3(t).toLowerCase()}`;
	if (t.modtagerType === 'kunde') return `Givet til hende selv · ${periodeTekst3(t).toLowerCase()}`;
	if (t.modtagerType === 'medlemmer') return 'Alle med et abonnement';
	return 'Alle med appen';
}

function venterTekst(t: Traeningstildeling3): string {
	if (maalerIDage3(t)) {
		return t.fraDag <= 0
			? `${t.modtagerNavn} er ikke startet endnu`
			: `Starter først på dag ${t.fraDag}`;
	}
	return t.fraDato ? `Starter først ${datoTekst3(t.fraDato)}` : 'Er ikke startet endnu';
}

function sluttetTekst(t: Traeningstildeling3): string {
	if (maalerIDage3(t)) return `Sluttede på dag ${t.tilDag}`;
	return t.tilDato ? `Sluttede ${datoTekst3(t.tilDato)}` : 'Er slut';
}

/**
 * Hele billedet for én kunde: hvad hun ser, hvad hun ikke ser, og hvorfor.
 *
 * Bruges af admin-opslaget i bid 2 og af kundens egen liste i bid 3. Det
 * er med vilje den SAMME funktion begge steder. To udgaver af den her
 * regel ville drive fra hinanden, og saa ville admin vise noget andet
 * end kunden faktisk har.
 */
export function programmerForKunde3(
	programmer: Traeningsprogram3[],
	tildelinger: Traeningstildeling3[],
	kategorier: TraeningKategori3[],
	kunde: KundeKontekst3
): ProgramForKunde3[] {
	return programmer.map((program) => {
		if (!program.klar) {
			return {
				program,
				vises: false,
				afvisning: 'kladde' as const,
				forklaring: 'Programmet er en kladde'
			};
		}

		const mine = tildelinger.filter(
			(t) => t.type === 'program' && t.programId === program.id && rammerKunde3(t, kunde)
		);
		if (mine.length === 0) {
			return {
				program,
				vises: false,
				afvisning: 'ikke-tildelt' as const,
				forklaring: 'Ikke tildelt hende'
			};
		}

		const medStatus = mine.map((t) => ({ t, status: tildelingStatus3(t, kontekstFor(t, kunde)) }));
		const aktiv = medStatus.find((x) => x.status === 'aktiv');

		if (!aktiv) {
			// Venter siger mere end slut, saa den vinder naar begge findes.
			const venter = medStatus.find((x) => x.status === 'venter');
			if (venter) {
				return {
					program,
					vises: false,
					afvisning: 'venter' as const,
					forklaring: venterTekst(venter.t)
				};
			}
			return {
				program,
				vises: false,
				afvisning: 'sluttet' as const,
				forklaring: sluttetTekst(medStatus[0].t)
			};
		}

		if (!maaSesMedUdstyr3(program, kategorier, kunde.udstyr)) {
			const navn = kategorier.find((k) => k.id === program.kategoriId)?.navn ?? 'den kategori';
			return {
				program,
				vises: false,
				afvisning: 'udstyr' as const,
				forklaring: `Hun har ikke valgt ${navn}`
			};
		}

		return { program, vises: true, afvisning: null, forklaring: kildeTekst(aktiv.t) };
	});
}

/** Maa kunden bygge sit eget program lige nu. */
export function maaByggeEget3(
	tildelinger: Traeningstildeling3[],
	kunde: KundeKontekst3
): boolean {
	return tildelinger.some(
		(t) =>
			t.type === 'byg-eget' &&
			rammerKunde3(t, kunde) &&
			tildelingStatus3(t, kontekstFor(t, kunde)) === 'aktiv'
	);
}

// ── Daekning pr modtager ────────────────────────────────────────

export interface Daekning3 {
	kategori: TraeningKategori3;
	/** Navnene paa de programmer modtageren har i kategorien. */
	programNavne: string[];
}

/**
 * Har modtageren mindst ét program i hver kategori.
 *
 * Uden den her kan en kvinde der har valgt haandvaegte staa med en helt
 * tom traeningsside, uden at nogen opdager det. Kun programmer der er
 * sat til klar taeller med, for en kladde kan hun ikke faa.
 */
export function daekning3(
	programmer: Traeningsprogram3[],
	tildelinger: Traeningstildeling3[],
	kategorier: TraeningKategori3[],
	modtager: { type: ModtagerType3; id: string }
): Daekning3[] {
	const tildelte = new Set(
		tildelinger
			.filter(
				(t) =>
					t.type === 'program' &&
					t.modtagerType === modtager.type &&
					t.modtagerId === modtager.id
			)
			.map((t) => t.programId)
	);
	return kategorier.map((kategori) => ({
		kategori,
		programNavne: programmer
			.filter((p) => p.klar && tildelte.has(p.id) && p.kategoriId === kategori.id)
			.map((p) => p.navn)
	}));
}

/** Kategorier uden et eneste program hos modtageren. */
export function huller3(daekning: Daekning3[]): TraeningKategori3[] {
	return daekning.filter((d) => d.programNavne.length === 0).map((d) => d.kategori);
}

// ── Oprettelse og kopiering ─────────────────────────────────────

export type NyTildeling3 = Omit<Traeningstildeling3, 'id'>;

/**
 * Findes den samme tildeling i forvejen. Uden det her kan det samme hold
 * faa det samme program to gange, og saa staar det to steder i listen
 * uden at nogen kan se forskel.
 */
export function findesAllerede3(
	tildelinger: Traeningstildeling3[],
	kandidat: Pick<NyTildeling3, 'type' | 'programId' | 'modtagerType' | 'modtagerId'>
): boolean {
	return tildelinger.some(
		(t) =>
			t.type === kandidat.type &&
			t.programId === kandidat.programId &&
			t.modtagerType === kandidat.modtagerType &&
			t.modtagerId === kandidat.modtagerId
	);
}

/**
 * Kopierer et holds tildelinger over paa et nyt hold, med de samme dage.
 *
 * Uden den skal Linn tildele op til seks programmer i haanden hver gang
 * hun opretter et hold, og det er praecis dér et hold bliver glemt og
 * starter uden traening.
 *
 * Tildelinger det nye hold allerede har springes over, saa knappen kan
 * trykkes to gange uden at der kommer dubletter.
 */
export function kopierTildelinger3(
	alle: Traeningstildeling3[],
	fraForlobId: string,
	til: { forlobId: string; navn: string },
	nu: number,
	adminUid: string
): NyTildeling3[] {
	const kilde = alle.filter((t) => t.modtagerType === 'hold' && t.modtagerId === fraForlobId);
	const nye: NyTildeling3[] = [];
	for (const t of kilde) {
		const kandidat = {
			type: t.type,
			programId: t.programId,
			modtagerType: 'hold' as const,
			modtagerId: til.forlobId
		};
		if (findesAllerede3(alle, kandidat)) continue;
		if (nye.some((n) => n.type === t.type && n.programId === t.programId)) continue;
		nye.push({
			...kandidat,
			modtagerNavn: til.navn,
			fraDag: t.fraDag,
			tilDag: t.tilDag,
			fraDato: null,
			tilDato: null,
			tildeltAt: nu,
			tildeltAf: adminUid
		});
	}
	return nye;
}

/** Sorterer listen paa tildel-siden: aktive foerst, saa dem der venter. */
export function sorterTildelinger3(
	tildelinger: Traeningstildeling3[],
	status: (t: Traeningstildeling3) => Tildelingsstatus3
): Traeningstildeling3[] {
	const raekke: Record<Tildelingsstatus3, number> = { aktiv: 0, venter: 1, slut: 2 };
	return [...tildelinger].sort(
		(a, b) =>
			raekke[status(a)] - raekke[status(b)] ||
			modtagerTekst3(a).localeCompare(modtagerTekst3(b), 'da')
	);
}
