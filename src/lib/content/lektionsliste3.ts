// ============================================================
// "Dine lektioner" i 3.0. Ren logik, ingen database.
//
// To ting bor her:
//
//  1. Raekkerne paa Profil. Ét forloeb pr raekke, det der koerer lige nu
//     oeverst med en ring, de gennemfoerte nedenunder med stjerne.
//
//  2. Listen inde paa ét forloeb.
//
// PAA ET FORLOEB DER KOERER SER HUN KUN I DAG OG BAGUD. Linns beslutning
// 20. august 2026, og den VENDER hendes egen beslutning fra 18. august om
// at hun skulle kunne se hele forloebet med laas paa. Skriv den ikke om
// igen uden at spoerge: begge udgaver har vaeret proevet, og det her er
// den nyeste.
//
// Paa et GENNEMFOERT forloeb ser hun alt. Der er ingen fremtid tilbage,
// og hele forloebet er hendes historik.
//
// Om laasen. Den gaelder stadig, for der findes stadig laaste raekker paa
// gennemfoerte forloeb via Linns eget synlighedsvindue. En lektion er
// laast af to grunde, og de er ikke ens:
//
//  - Dagen er ikke naaet endnu. Saa aabner den om (dagNummer - idag) dage,
//    regnet fra i dag. Vi regner den IKKE fra forloebets startdato, fordi
//    dagNummer allerede har kundens pauser med. Regnede vi forfra, ville
//    en kunde med to pausedage faa en dato der laa to dage forkert.
//
//  - Linn har sat et synlighedsvindue paa selve lektionen (visFra). Saa
//    gaelder hendes dato, ogsaa selvom dagen forlaengst er aaben.
//
// Er skjulEfter passeret, ryger lektionen helt af listen. Der har Linn
// aktivt taget den ned, og saa skal den ikke staa og friste.
// ============================================================

import type { LektionItem } from './forlob';
import { erSet3 } from './lektionSet3';
import type { AktivtForlob, GennemfoertForlob } from './adgang3';

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

const DAG_MS = 86_400_000;

// ── Raekkerne paa Profil ────────────────────────────────────

/**
 * Hvor meget af et forloeb hun stadig kan komme til.
 *
 *  - 'aaben'  alt er der. Enten koerer forloebet, eller hun har app-adgang
 *  - 'bonus'  forloebet er slut, men de 90 dages bibliotek-bonus loeber
 *  - 'lukket' de 90 dage er gaaet. Kun hendes egne noter staar tilbage
 */
export type ForlobAdgang = 'aaben' | 'bonus' | 'lukket';

/** Hvad adgangen til et tidligere forloeb afhaenger af. */
export interface AdgangVilkaar {
	/** Har hun app-adgang lige nu, altsaa aktivt abo eller aktivt forloeb. */
	harApp: boolean;
	/** Hvornaar bibliotek-bonussen slutter. null naar der ikke er nogen. */
	bonusSlutMs: number | null;
	nu: number;
}

/** Fuld adgang. Bruges naar en kalder ikke oplyser andet. */
const ALT_AABENT: AdgangVilkaar = { harApp: true, bonusSlutMs: null, nu: 0 };

/**
 * Hvad hun kan komme til paa ét forloeb.
 *
 * Et forloeb der koerer er altid aabent, ogsaa hvis abonnementet er
 * udloebet undervejs. Hun har betalt for forloebet. Samme regel som
 * spaerring3 punkt 1.
 */
export function forlobAdgang(aktiv: boolean, v: AdgangVilkaar): ForlobAdgang {
	if (aktiv || v.harApp) return 'aaben';
	if (v.bonusSlutMs !== null && v.nu < v.bonusSlutMs) return 'bonus';
	return 'lukket';
}

/** "Åben 62 dage endnu". Linjen paa et forloeb hvis bonus loeber ud. */
export function bonusTekst(bonusSlutMs: number, nu: number): string {
	const dage = Math.ceil((bonusSlutMs - nu) / DAG_MS);
	if (dage <= 1) return 'Åben dagen ud';
	return `Åben ${dage} dage endnu`;
}

/** Ét forloeb, som det staar paa listen under "Dine lektioner". */
export interface ForlobRaekke {
	forlobId: string;
	navn: string;
	/** Koerer forloebet lige nu. Styrer ring kontra stjerne. */
	aktiv: boolean;
	/** Underteksten, fx "Dag 12 af 21" eller "Gennemført marts 2026". */
	under: string;
	/** 0 til 1. Kun sat naar den er aktiv, ellers null. */
	fremgang: number | null;
	/** Hvor meget af forloebet hun stadig kan komme til. */
	adgang: ForlobAdgang;
}

/** "Gennemført marts 2026". Bruges baade paa diplomet og paa raekken. */
export function gennemfoertTekst(slutMs: number): string {
	const d = new Date(slutMs);
	return `Gennemført ${MAANEDER[d.getMonth()]} ${d.getFullYear()}`;
}

/**
 * Raekkerne til Profil. Aktive forloeb foerst, saa de gennemfoerte i den
 * raekkefoelge de kommer ind (adgang3 leverer dem nyeste foerst).
 *
 * Samme forloeb kan i teorien staa begge steder, hvis et forloeb baade er
 * markeret gennemfoert og stadig loeber. Saa vinder den aktive raekke, for
 * det er den der er sand for kunden lige nu.
 */
export function byggForlobRaekker(
	aktive: AktivtForlob[],
	gennemfoerte: GennemfoertForlob[],
	vilkaar: AdgangVilkaar = ALT_AABENT
): ForlobRaekke[] {
	const raekker: ForlobRaekke[] = [];
	const set = new Set<string>();

	for (const a of aktive) {
		if (set.has(a.forlobId)) continue;
		set.add(a.forlobId);
		// antalDage kan vaere 0 paa et forloeb der ikke er sat op faerdigt.
		// Saa dropper vi baade ringen og "af N" i stedet for at dele med nul.
		const harLaengde = a.antalDage > 0;
		raekker.push({
			forlobId: a.forlobId,
			navn: a.navn,
			aktiv: true,
			under: harLaengde ? `Dag ${a.dagNummer} af ${a.antalDage}` : `Dag ${a.dagNummer}`,
			fremgang: harLaengde ? Math.min(1, Math.max(0, a.dagNummer / a.antalDage)) : null,
			adgang: 'aaben'
		});
	}

	for (const g of gennemfoerte) {
		if (set.has(g.forlobId)) continue;
		set.add(g.forlobId);
		const adgang = forlobAdgang(false, vilkaar);
		raekker.push({
			forlobId: g.forlobId,
			navn: g.navn,
			aktiv: false,
			// Her staar hvornaar hun gennemfoerte, ogsaa i de 90 dage.
			//
			// Foer talte raekken ned: "Åben 10 dage endnu". Det gjorde den,
			// fordi der ikke fandtes noget andet sted at sige det. Nu staar
			// nedtaellingen ét sted i toppen af appen, se SPEC 35, og saa
			// ville hver eneste raekke gentage den samme sætning i stedet
			// for at fortaelle hvad raekken handler om.
			under: adgang === 'lukket' ? 'Kun dine noter' : gennemfoertTekst(g.slutMs),
			fremgang: null,
			adgang
		});
	}

	return raekker;
}

// ── Listen inde paa ét forloeb ──────────────────────────────

/** En lektion som den staar paa listen, med sin dag og sin laas. */
export interface ListeLektion {
	/** Hvilken dag i forloebet lektionen hoerer til. */
	dagNummer: number;
	lektion: LektionItem;
	/** Kan hun aabne den nu. */
	aaben: boolean;
	/** Tekst paa den laaste, fx "Åbner 20. august". Tom naar den er aaben. */
	aabnerTekst: string;
}

/** Kun det byggLektionsliste har brug for. Matcher ForlobDag. */
export interface DagKilde {
	dagNummer: number;
	lektioner: LektionItem[];
}

export interface ListeVilkaar {
	/**
	 * Hvor langt hun er, hvis forloebet koerer. Er den null, er forloebet
	 * gennemfoert og alle dage staar aabne.
	 */
	aktivDagNummer: number | null;
	nu: number;
}

/**
 * Lektionerne i forloebet, i dagsraekkefoelge. Dage uden lektioner falder
 * ud af sig selv.
 *
 * Koerer forloebet, tages dagene EFTER i dag helt af listen. Se toppen af
 * filen. Er forloebet gennemfoert, kommer alt med.
 */
export function byggLektionsliste(dage: DagKilde[], vilkaar: ListeVilkaar): ListeLektion[] {
	const { aktivDagNummer, nu } = vilkaar;
	const sorterede = [...dage].sort((a, b) => a.dagNummer - b.dagNummer);
	const ud: ListeLektion[] = [];

	for (const dag of sorterede) {
		for (const l of dag.lektioner ?? []) {
			// Taget ned af Linn. Skal ikke staa paa listen overhovedet.
			if (erSkjult(l, nu)) continue;

			// Koerer forloebet, findes fremtiden slet ikke paa listen. Den
			// stod her foer med en laas og en "Aabner om tre dage"-linje.
			const dagLaast = aktivDagNummer !== null && dag.dagNummer > aktivDagNummer;
			if (dagLaast) continue;

			const visFraMs = tilMs(l.visFra);
			const vinduLaast = visFraMs !== null && nu < visFraMs;

			// Har Linn sat et synlighedsvindue frem i tiden, skal raekken
			// heller ikke staa og friste paa et forloeb der koerer. Paa et
			// gennemfoert forloeb bliver den staaende med sin aabner-tekst.
			if (vinduLaast && aktivDagNummer !== null) continue;

			if (!dagLaast && !vinduLaast) {
				ud.push({ dagNummer: dag.dagNummer, lektion: l, aaben: true, aabnerTekst: '' });
				continue;
			}

			// Kun vinduet er tilbage, og kun paa et gennemfoert forloeb.
			ud.push({
				dagNummer: dag.dagNummer,
				lektion: l,
				aaben: false,
				aabnerTekst: formaterAabner(visFraMs as number, nu)
			});
		}
	}

	return ud;
}

/** Har Linn taget lektionen ned. Samme +59s som resten af appen bruger. */
function erSkjult(l: LektionItem, nu: number): boolean {
	const til = tilMs(l.skjulEfter);
	if (til === null) return false;
	return nu > til + 59_000;
}

/** Lokal ISO-streng til ms. null baade ved tom og ved ugyldig dato. */
function tilMs(v: string | undefined): number | null {
	if (!v) return null;
	const ms = new Date(v).getTime();
	return Number.isNaN(ms) ? null : ms;
}

/**
 * "Åbner i dag", "Åbner i morgen" eller "Åbner 20. august". Vi sammenligner
 * paa kalenderdage og ikke paa timer, saa noget der aabner kl. 23 i aften
 * siger "i dag" og ikke "om 0 dage".
 */
export function formaterAabner(aabnerMs: number, nu: number): string {
	const dage = kalenderdageMellem(nu, aabnerMs);
	if (dage <= 0) return 'Åbner i dag';
	if (dage === 1) return 'Åbner i morgen';
	const d = new Date(aabnerMs);
	return `Åbner ${d.getDate()}. ${MAANEDER[d.getMonth()]}`;
}

/** Hele kalenderdage fra a til b, uden hensyn til klokkeslaet. */
function kalenderdageMellem(a: number, b: number): number {
	const da = new Date(a);
	const db = new Date(b);
	const fra = new Date(da.getFullYear(), da.getMonth(), da.getDate()).getTime();
	const til = new Date(db.getFullYear(), db.getMonth(), db.getDate()).getTime();
	return Math.round((til - fra) / DAG_MS);
}

// ── Hendes noter ────────────────────────────────────────────

/** Kun det noterne skal bruge herfra. Matcher LektionNote. */
export interface NoteKilde {
	lektionId: string;
	tekst: string;
	opdateret: number;
}

/** En note som den staar under fanen "Mine noter". */
export interface NoteRaekke {
	lektionId: string;
	/** Lektionens titel, eller en reservetekst hvis lektionen er vaek. */
	titel: string;
	/** Dagen i forloebet. null naar lektionen ikke findes laengere. */
	dagNummer: number | null;
	tekst: string;
	opdateret: number;
	/** Kan hun aabne lektionen og se noten i sin sammenhaeng. */
	aaben: boolean;
}

/** Hvilke lektioner hun har skrevet en note paa. Til blyanten i listen. */
export function lektionerMedNote(noter: NoteKilde[]): Set<string> {
	return new Set(noter.filter((n) => n.tekst.trim().length > 0).map((n) => n.lektionId));
}

/**
 * Hendes noter, i forloebets raekkefoelge.
 *
 * En note kan overleve sin lektion. Har Linn taget lektionen ned, eller er
 * dens synlighedsvindue loebet ud, staar noten stadig her, for det er
 * kundens egne ord. Linns beslutning 18. august. De havner nederst, fordi
 * vi ikke laengere ved hvilken dag de hoerte til.
 */
export function byggNoteliste(liste: ListeLektion[], noter: NoteKilde[]): NoteRaekke[] {
	const prLektion = new Map(liste.map((p) => [p.lektion.id, p]));
	const med: NoteRaekke[] = [];
	const forladte: NoteRaekke[] = [];

	for (const n of noter) {
		if (!n.tekst.trim()) continue;
		const p = prLektion.get(n.lektionId);
		if (p) {
			med.push({
				lektionId: n.lektionId,
				titel: p.lektion.titel,
				dagNummer: p.dagNummer,
				tekst: n.tekst,
				opdateret: n.opdateret,
				aaben: p.aaben
			});
		} else {
			forladte.push({
				lektionId: n.lektionId,
				titel: 'En lektion der ikke ligger her længere',
				dagNummer: null,
				tekst: n.tekst,
				opdateret: n.opdateret,
				aaben: false
			});
		}
	}

	med.sort((a, b) => (a.dagNummer ?? 0) - (b.dagNummer ?? 0));
	forladte.sort((a, b) => b.opdateret - a.opdateret);
	return [...med, ...forladte];
}

/** Hvor mange af lektionerne hun har set. Til linjen oeverst paa siden. */
export function opgoerSete(
	liste: ListeLektion[],
	klaret: Set<string>
): {
	sete: number;
	aabne: number;
	ialt: number;
} {
	let sete = 0;
	let aabne = 0;
	for (const p of liste) {
		if (p.aaben) aabne += 1;
		if (erSet3(klaret, p.lektion)) sete += 1;
	}
	return { sete, aabne, ialt: liste.length };
}
