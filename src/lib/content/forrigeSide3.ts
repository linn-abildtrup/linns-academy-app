// ============================================================
// Hvor hun kom fra, saa tilbage-knappen peger det rigtige sted hen.
//
// PROBLEMET, Linn 5. september. Tilbage-knappen pegede et FAST sted hen,
// og det er forkert paa de sider man kan naa fra flere steder. Hendes
// eksempel: Dine egne smaa skridt naas baade fra forsiden og fra Din
// side, men knappen sagde altid "Forside". Kom hun fra Din side, blev
// hun sendt et andet sted hen end der hvor hun var.
//
// FIRE SIDER HAR DET PROBLEM: smaa skridt, maalingen, oevelserne og byg
// dit eget program. Resten naas kun ét sted fra, og dér er den faste
// adresse baade rigtig og mere robust end en historik.
//
// HVORFOR IKKE BARE history.back(). Fordi teksten skal sige HVOR hun
// kommer tilbage til. "‹ Tilbage" er en daarligere knap end "‹ Din
// side": hun skal kunne se hvor hun lander uden at proeve. Derfor
// gemmer vi baade adressen og navnet.
//
// DEN LEVER KUN SAA LAENGE APPEN ER AABEN, som resten af 3.0's
// hukommelse. Aabner hun siden fra en besked eller et bogmaerke, er der
// ingen forrige side, og saa bruges den faste adresse. Det er med vilje:
// en gemt "forrige side" fra i gaar ville sende hende et tilfaeldigt
// sted hen.
// ============================================================

export interface ForrigeSide3 {
	sti: string;
	/** Navnet som det skal staa efter pilen, fx "Din side". */
	navn: string;
}

/**
 * Hvad hver rute hedder, naar den skal staa paa en tilbage-knap.
 *
 * Kun de sider man reelt kan komme FRA. Er en rute ikke med, bruger vi
 * sidens egen faste adresse i stedet, og saa er vi hvor vi var foer.
 */
const NAVNE: Record<string, string> = {
	'/ny': 'Forside',
	'/ny/30-30': '30-30',
	'/ny/traening': 'Træning',
	'/ny/beskeder': 'Beskeder',
	'/ny/udvikling': 'Udvikling',
	'/ny/profil': 'Din side',
	'/ny/hjaelp': 'Hjælp',
	'/ny/naering': 'Dine mål',
	'/ny/skridt': 'Små skridt'
};

/** Navnet paa en rute, eller null hvis vi ikke har et godt ord for den. */
export function navnFor3(sti: string): string | null {
	return NAVNE[sti] ?? null;
}

/**
 * Skal den her rute huskes som "forrige side".
 *
 * Kun de sider der HAR et navn. En underside som
 * /ny/traening/abc/3 skal ikke staa paa en knap, for der findes ikke et
 * kort ord for den, og "‹ Tilbage" hjælper hende ikke.
 */
export function kanHuskes3(sti: string): boolean {
	return navnFor3(sti) !== null;
}

// Selve hukommelsen. Modul-niveau, altsaa væk naar appen lukkes.
let forrige: ForrigeSide3 | null = null;
let nuvaerende: string | null = null;

/**
 * Kaldes ved hver navigation inde i appen.
 *
 * Den GAMLE side bliver til "forrige", men kun hvis vi har et navn til
 * den. Gaar hun fra Din side ind i en underside og videre derfra, er
 * Din side stadig det sidste sted hun kan pege tilbage til.
 */
export function registrerSide3(sti: string): void {
	if (sti === nuvaerende) return;
	if (nuvaerende && kanHuskes3(nuvaerende)) {
		forrige = { sti: nuvaerende, navn: navnFor3(nuvaerende) as string };
	}
	nuvaerende = sti;
}

/**
 * Hvor hun kom fra, hvis vi ved det.
 *
 * `ikke` er den side der spoerger. Kom hun fra siden selv, fx ved at
 * genindlaese, ville knappen pege paa sig selv og ikke goere noget.
 */
export function forrigeSide3(ikke?: string): ForrigeSide3 | null {
	if (forrige && forrige.sti === ikke) return null;
	return forrige;
}

/** Ryddes ved log ud, sammen med resten af hukommelsen. */
export function glemForrige3(): void {
	forrige = null;
	nuvaerende = null;
}
