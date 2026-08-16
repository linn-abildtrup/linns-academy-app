// ============================================================
// "Til dig lige nu" — den fælles plads oeverst paa forsiden.
//
// Én plads, ikke ét kort pr besked. Kommer der flere slags beskeder
// senere, faar de en linje her i stedet for en ny blok paa forsiden.
// Er der ingen beskeder, forsvinder pladsen helt.
//
// Rent regnestykke uden Firestore, saa det kan testes.
// ============================================================

/** Hvor faa dage der skal vaere tilbage, foer udloebet gaar foerst. */
const HASTER_DAGE = 3;

export type BeskedSlags = 'svar' | 'udloeb';

export interface Besked {
	/** Bruges som noegle i listen. */
	id: string;
	slags: BeskedSlags;
	titel: string;
	/** Anden linje. To linjer af selve svaret, eller datoen for udloeb. */
	uddrag: string;
	href: string;
	/** Simplero ligger uden for appen og skal aabne i en ny fane. */
	ekstern: boolean;
}

export interface NyestSvar {
	id: string;
	spoergsmaal: string;
	svar: string;
}

export interface UdloebsGrundlag {
	dageTilbage: number;
	slutterAt: number;
}

export interface BeskedGrundlag {
	/** Nyeste svar fra Linn som hun endnu ikke har set. */
	nyestSvar: NyestSvar | null;
	/** Kun sat naar abonnementet faktisk er taet paa at loebe ud. */
	udloeb: UdloebsGrundlag | null;
	/** Link til at forny. Gives med, saa modulet ikke kender Simplero. */
	fornyUrl: string;
}

/** Dansk dato med ugedag, fx "torsdag den 12. august". */
export function formaterUgedagDato(ms: number): string {
	const d = new Date(ms);
	const ugedag = d.toLocaleDateString('da-DK', { weekday: 'long' });
	const rest = d.toLocaleDateString('da-DK', { day: 'numeric', month: 'long' });
	return `${ugedag} den ${rest}`;
}

function udloebsTitel(dageTilbage: number): string {
	if (dageTilbage <= 0) return 'Din adgang udløber i dag';
	if (dageTilbage === 1) return 'Din adgang udløber i morgen';
	return `Din adgang udløber om ${dageTilbage} dage`;
}

/**
 * Bygger listen af beskeder. Raekkefoelgen er bevidst:
 *
 * Svaret fra Linn staar oeverst, fordi det er indhold hun venter paa.
 * Undtagelsen er naar adgangen loeber ud inden for tre dage. Saa gaar
 * udloebet foerst, for der er en frist, og et svar kan vente en dag.
 */
export function byggBeskeder(g: BeskedGrundlag): Besked[] {
	const liste: Besked[] = [];

	if (g.nyestSvar) {
		liste.push({
			id: `svar-${g.nyestSvar.id}`,
			slags: 'svar',
			titel: 'Nyt svar fra Linn',
			uddrag: g.nyestSvar.svar.trim(),
			// Beskeder, fanen Linn. Hun har sagt hvad hun vil se ved at trykke
			// paa linjen, saa her aabner vi paa den anden fane end normalt.
			// Ordet Snak blev droppet 16. august 2026.
			href: '/ny/beskeder?fane=linn',
			ekstern: false
		});
	}

	if (g.udloeb) {
		const besked: Besked = {
			id: 'udloeb',
			slags: 'udloeb',
			titel: udloebsTitel(g.udloeb.dageTilbage),
			uddrag: `${formaterUgedagDato(g.udloeb.slutterAt)}. Tryk for at forny`,
			href: g.fornyUrl,
			ekstern: true
		};
		if (g.udloeb.dageTilbage <= HASTER_DAGE) liste.unshift(besked);
		else liste.push(besked);
	}

	return liste;
}
