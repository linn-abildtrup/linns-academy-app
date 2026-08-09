// ============================================================
// Challenge paa 3.0-forsiden: samlingen.
//
// Kunden samler forskellige planter. Hver plante bliver et felt i et
// gitter, og gitteret er lige saa stort som maalet. Der er et maerke
// for hver tiende felt, saa alle passerer noget undervejs, ogsaa hende
// der ender langt fra maalet.
//
// Maalet saettes pr challenge. Er det ikke sat, bruger vi 50.
// Baggrund: den challenge Linn koerte 1. til 7. juni 2026 havde 28
// deltagere. Hoejeste score var 49, median 32, laveste 1. Ingen naaede
// 50 paa en uge. Derfor maa maalet kunne foelge periodens laengde, og
// derfor er det et felt og ikke et tal i koden.
// ============================================================

import type { Challenge } from './challenge';
import type { ModtagerType } from './tildelinger';

/** Bruges naar Linn ikke har sat et maal paa challenge'n. */
export const STANDARD_MAAL = 50;

/** Der saettes et maerke i gitteret for hver saa mange felter. */
export const MAERKE_HVER = 10;

/**
 * Challenge som den ser ud i 3.0. Feltet maal findes ikke paa de
 * challenges der allerede ligger i databasen, derfor er det valgfrit.
 */
export interface Challenge3 extends Challenge {
	maal?: number;
}

// ── Hvem faar challenge'n ───────────────────────────────────
//
// Samme sprog som master-programmerne bruger, se tildelinger.ts:
//   kunde     — én bestemt person, id er hendes uid
//   forlob    — alle paa ét hold, id er forloebets id. Flere hold er
//               flere modtagere.
//   alle-app  — alle der har appen, uanset forloeb. Id er tom.
//
// En challenge kan have flere modtagere paa én gang, saa den samme
// challenge kan koere paa Kickstart, paa Kropsro og for medlemmerne.

export interface Modtager {
	type: ModtagerType;
	id: string;
}

/**
 * Challenge der ligger for sig selv og bliver tildelt, i modsaetning
 * til de gamle der ligger inde under ét forloeb.
 */
export interface MasterChallenge {
	id: string;
	navn: string;
	beskrivelse: string;
	startDato: { toMillis?: () => number } | null;
	slutDato: { toMillis?: () => number } | null;
	aktiv: boolean;
	maal?: number;
	fravalgteBrugere: string[];
	modtagere: Modtager[];
}

export interface KundeKontekst {
	uid: string;
	/** Forloeb hun er paa lige nu. */
	forlobIds: string[];
	/** Har hun appen, altsaa abonnement eller forloeb der giver adgang. */
	erAppBruger: boolean;
}

/**
 * Rammer challenge'n den her kunde. En enkelt modtager er nok.
 *
 * Bemaerk at alle-app ogsaa rammer forloebskunder, saa laenge de har
 * appen. En kvinde paa Kickstart er ogsaa app-bruger, og en challenge
 * til alle skal ikke gaa uden om hende.
 */
export function rammerKunde(challenge: MasterChallenge, kunde: KundeKontekst): boolean {
	return challenge.modtagere.some((m) => {
		if (m.type === 'kunde') return m.id === kunde.uid;
		if (m.type === 'alle-app') return kunde.erAppBruger;
		return kunde.forlobIds.includes(m.id);
	});
}

export interface ChallengeForside {
	/** Id'et paa challenge'n, som gem-funktionen skal bruge. */
	id: string;
	navn: string;
	beskrivelse: string;
	/** Alle hendes planter, i den raekkefoelge de kom ind. */
	planter: string[];
	/** Test- og demokonti der ikke skal taelle med i stillingen. */
	fravalgteBrugere: string[];
	/** Antal forskellige planter kunden har. */
	score: number;
	maal: number;
	/** Den plante der sidst kom til. Tom streng hvis hun ingen har. */
	senesteJournal: string;
	/** Hendes plads, 1 er bedst. Null hvis stillingen ikke er hentet. */
	plads: number | null;
	antalDeltagere: number;
	/** Dage tilbage af perioden. 0 paa sidste dag. */
	dageTilbage: number;
}

/**
 * Maalet for en challenge. Vi tager kun imod hele tal stoerre end nul,
 * saa et tastefejlet maal ikke giver et gitter uden felter eller et
 * gitter paa tusind.
 */
export function maalFor(challenge: { maal?: number } | null): number {
	const m = challenge?.maal;
	if (typeof m !== 'number' || !Number.isFinite(m)) return STANDARD_MAAL;
	const heltal = Math.floor(m);
	if (heltal < 1) return STANDARD_MAAL;
	if (heltal > 500) return 500;
	return heltal;
}

export interface GitterFelt {
	/** Har hun naaet det her felt. */
	fyldt: boolean;
	/** Det felt der sidst kom til, saa hun kan se hvad der er nyt. */
	nyeste: boolean;
}

export interface GitterRaekke {
	felter: GitterFelt[];
	/** Tallet i enden af raekken: 10, 20, 30 og saa videre. */
	indtil: number;
}

/**
 * Bygger gitteret. Har hun flere planter end maalet, vokser gitteret
 * med hende i stedet for at stoppe. Hun skal ikke straffes for at have
 * klaret mere end der blev bedt om.
 */
export function byggGitter(score: number, maal: number): GitterFelt[] {
	const rene = Math.max(0, Math.floor(score));
	const felter = Math.max(maal, rene);
	const ud: GitterFelt[] = [];
	for (let i = 1; i <= felter; i++) {
		ud.push({
			fyldt: i <= rene,
			nyeste: i === rene && rene > 0
		});
	}
	return ud;
}

/**
 * Samme gitter, delt op i raekker af ti med et tal for enden. Raekkerne
 * er selve maerkerne: hun kan se at hun har passeret tredive uden at
 * skulle taelle felter.
 */
export function byggRaekker(score: number, maal: number): GitterRaekke[] {
	const felter = byggGitter(score, maal);
	const raekker: GitterRaekke[] = [];
	for (let i = 0; i < felter.length; i += MAERKE_HVER) {
		const del = felter.slice(i, i + MAERKE_HVER);
		raekker.push({ felter: del, indtil: i + del.length });
	}
	return raekker;
}

/**
 * Linjen under gitteret. Vi naevner hendes plads, men kun naar hun er
 * i den oeverste tredjedel. Ligger hun nummer 26 ud af 28, hjaelper det
 * hende ikke at faa det at vide hver gang hun aabner appen. Stillingen
 * ligger stadig et tryk vaek for den der vil se den.
 */
export function fremdriftTekst(f: ChallengeForside): string {
	if (f.score === 0) {
		return 'Tilføj den første plante du har spist.';
	}
	const mangler = f.maal - f.score;
	if (mangler <= 0) {
		return `Du er i mål. ${f.score} forskellige planter.`;
	}
	return `${mangler} ${mangler === 1 ? 'plante' : 'planter'} til de ${f.maal}.`;
}

/**
 * Vises kun naar det er opmuntrende. Se begrundelsen i fremdriftTekst.
 */
export function pladsTekst(f: ChallengeForside): string | null {
	if (f.plads === null || f.antalDeltagere < 3) return null;
	if (f.plads > Math.ceil(f.antalDeltagere / 3)) return null;
	if (f.plads === 1) return 'Du fører';
	return `Du er nr. ${f.plads}`;
}

/**
 * Det mindste vi skal bruge for at afgoere om noget koerer. Baade de
 * gamle forloebs-challenges og de nye master-challenges passer paa den.
 */
export interface Periode {
	aktiv: boolean;
	startDato: { toMillis?: () => number } | null;
	slutDato: { toMillis?: () => number } | null;
}

/** Er challenge'n i gang paa det givne tidspunkt. */
export function erIGang(challenge: Periode, nu: number): boolean {
	if (!challenge.aktiv) return false;
	const start = challenge.startDato?.toMillis?.() ?? 0;
	const slut = challenge.slutDato?.toMillis?.() ?? 0;
	// Slutdagen taeller med, helt til midnat.
	const slutMidnat = slut + (24 * 60 * 60 * 1000 - 1);
	return nu >= start && nu <= slutMidnat;
}

// ── Stillingen ──────────────────────────────────────────────
//
// En challenge kan nu gaa til alle der har appen, og saa er der 600
// til 700 med i stedet for 28. En liste med 700 navne er ikke en
// stilling, det er en telefonbog, og at staa som nummer 400 fortaeller
// hende ingenting hun kan bruge.
//
// Derfor viser vi de ti oeverste plus hendes egen linje. Det er den
// samme oplevelse hvad enten I er 28 eller 700.

export const STILLING_TOP = 10;

export interface StillingLinje {
	uid: string;
	displayNavn: string;
	score: number;
	erMig: boolean;
	plads: number;
}

export interface StillingVisning {
	top: StillingLinje[];
	/** Hendes linje, kun naar hun ikke allerede staar i toppen. */
	mig: StillingLinje | null;
	antal: number;
}

/**
 * Tager den faerdigsorterede stilling og skaerer den ned til det hun
 * skal se. Raekkefoelgen er allerede afgjort af beregnStilling.
 */
export function byggStillingVisning(
	raekker: Array<{ uid: string; displayNavn: string; score: number; erMig: boolean }>
): StillingVisning {
	const medPlads: StillingLinje[] = raekker.map((r, i) => ({ ...r, plads: i + 1 }));
	const top = medPlads.slice(0, STILLING_TOP);
	const migIToppen = top.some((r) => r.erMig);
	const mig = migIToppen ? null : (medPlads.find((r) => r.erMig) ?? null);
	return { top, mig, antal: medPlads.length };
}

/** Hele dage tilbage af perioden. Sidste dag giver 0. */
export function dageTilbage(challenge: Periode, nu: number): number {
	const slut = challenge.slutDato?.toMillis?.() ?? 0;
	const slutMidnat = slut + (24 * 60 * 60 * 1000 - 1);
	if (nu > slutMidnat) return 0;
	return Math.max(0, Math.floor((slutMidnat - nu) / (24 * 60 * 60 * 1000)));
}
