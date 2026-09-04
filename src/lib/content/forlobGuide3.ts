// ============================================================
// Guiden der spoerger om alt, foer et hold maa aabne.
//
// Linns oenske 1. september 2026, tegnet som skaerm 4 i
// mockups-admin.html, og bygget 4. september.
//
// HVORFOR DEN FINDES. Naar noget bliver glemt ved en holdstart, kommer
// der ingen fejl. Der kommer bare ingenting. Et helt hold kan starte
// uden traening, og det opdages foerst naar kunderne skriver. De ting
// der skal vaere paa plads ligger spredt over otte admin-sider, og der
// har aldrig vaeret en liste over dem.
//
// FILEN LAESER INGENTING OG SKRIVER INGENTING. Den faar et billede af
// hvordan verden faktisk ser ud, og siger hvad der mangler. Saa kan
// reglerne proeves uden en database, og skaermen kan noejes med at tegne.
//
// DEN TJEKKER VIRKELIGHEDEN, IKKE SVARENE. Guiden spoerger ikke "har du
// husket at tildele traening" og tror paa svaret. Den ser efter om
// tildelingen ligger der. Et flueben man selv saetter er praecis lige saa
// nemt at saette forkert som at glemme det oprindelige.
//
// GUIDEN ER IKKE ET NYT STED AT GEMME DATA. Alt bliver gemt de samme
// steder som foer, af de samme funktioner. Guiden er vejen ind foerste
// gang, og bagefter rettes alt det saedvanlige sted. Ellers ville der
// vaere to steder der kunne gemme det samme forskelligt.
// ============================================================

import type { ForlobType } from './forlobAdgang';

// ==============================================
// De ni trin
// ==============================================

export type TrinId =
	| 'navn'
	| 'start'
	| 'hvem'
	| 'traening'
	| 'lektioner'
	| 'skridt'
	| 'faellesskab'
	| 'funktioner'
	| 'udgiv';

export interface Trin {
	id: TrinId;
	nr: number;
	navn: string;
	/** Hvad trinnet handler om, i én linje. */
	under: string;
	/** Hvor det rettes bagefter. Tom paa de trin guiden selv gemmer. */
	side: string;
}

/**
 * Raekkefoelgen er den man bygger i, ikke den man taenker i. Navn og
 * dato foerst, fordi resten haenger paa dem. Udgivelsen sidst, fordi den
 * er den eneste der ikke kan tages tilbage uden at kunder har set noget.
 */
export const TRIN: Trin[] = [
	{ id: 'navn', nr: 1, navn: 'Navn og type', under: 'Hvad holdet hedder og hvor langt det er', side: '' },
	{ id: 'start', nr: 2, navn: 'Startdato', under: 'Dagen alt andet regnes ud fra', side: '' },
	{ id: 'hvem', nr: 3, navn: 'Hvem er med', under: 'Hvordan kunderne lander på holdet', side: '' },
	{
		id: 'traening',
		nr: 4,
		navn: 'Træning',
		under: 'Det trin guiden findes for',
		side: 'traening'
	},
	{ id: 'lektioner', nr: 5, navn: 'Lektioner og dage', under: 'Det hun ser hver dag', side: 'lektioner' },
	{ id: 'skridt', nr: 6, navn: 'Små skridt', under: 'Ugens skridt og de faste vaner', side: 'smaa-skridt' },
	{
		id: 'faellesskab',
		nr: 7,
		navn: 'Q&A og Facebook',
		under: 'Det hun spørger om, og hvor hun møder de andre',
		side: 'bibliotek'
	},
	{ id: 'funktioner', nr: 8, navn: 'Funktioner', under: 'Hvad holdet må se i appen', side: '' },
	{ id: 'udgiv', nr: 9, navn: 'Tjek og udgiv', under: 'Sidste blik før holdet åbner', side: '' }
];

// ==============================================
// Trin 1 og 2: det guiden selv opretter
// ==============================================

export interface NytForlobSvar {
	navn: string;
	id: string;
	/** YYYY-MM-DD. */
	startDato: string;
	antalDage: number;
	/** Et frit bygget forloeb, altsaa hverken Kickstart eller Kropsro. */
	bygget: boolean;
	type: ForlobType;
	premium: boolean;
	harTraening: boolean;
	harBuddy: boolean;
	harFacebookGruppe: boolean;
	nulDagePulje: number;
	features: Record<string, boolean>;
	/**
	 * Om holdet skal aabne med det samme.
	 *
	 * Guiden saetter den ALTID til false og aabner foerst paa sidste
	 * trin. Forloebs-listen, der er den hurtige vej for et hold man har
	 * bygget hundrede gange foer, maa gerne saette den selv.
	 */
	aktiv: boolean;
}

export const TOMT_SVAR: NytForlobSvar = {
	navn: '',
	id: '',
	startDato: '',
	antalDage: 21,
	bygget: false,
	type: 'kickstart',
	premium: false,
	harTraening: true,
	harBuddy: false,
	harFacebookGruppe: false,
	nulDagePulje: 14,
	features: {},
	aktiv: false
};

/**
 * Et id ud af navnet.
 *
 * REGLEN ER FLYTTET HERTIL, IKKE SKREVET OM. Den stod paa forloebs-
 * listen foer, og de eksisterende hold har id'er lavet med praecis den.
 * Skiftede jeg bindestreg for understreg, ville nye hold ikke ligne de
 * gamle, og id'et kan ikke aendres bagefter.
 */
export function idAf(navn: string): string {
	return navn
		.toLowerCase()
		.normalize('NFD')
		.replace(/[\u0300-\u036f]/g, '')
		.replace(/æ/g, 'ae')
		.replace(/ø/g, 'oe')
		.replace(/å/g, 'aa')
		.replace(/[^a-z0-9]+/g, '_')
		.replace(/^_|_$/g, '');
}

/**
 * Hvad der er galt med svarene paa trin 1 og 2. Tom streng betyder klar.
 *
 * Teksten er den Linn faar at se, saa den siger hvad hun skal goere, og
 * ikke hvilket felt der fejlede.
 */
export function validerOprettelse(svar: NytForlobSvar, brugteIds: string[]): string {
	if (!svar.navn.trim()) return 'Forløbet skal have et navn.';
	if (!svar.startDato) return 'Vælg en startdato.';
	if (!/^\d{4}-\d{2}-\d{2}$/.test(svar.startDato)) return 'Startdatoen skal være en rigtig dato.';
	if (svar.antalDage < 1 || svar.antalDage > 365) return 'Antal dage skal være mellem 1 og 365.';
	const id = (svar.id || idAf(svar.navn)).trim();
	if (!id) return 'Kunne ikke lave et id ud af navnet. Skriv et selv.';
	if (brugteIds.includes(id)) return 'Der findes allerede et forløb med det id.';
	return '';
}

/**
 * Felterne der skrives naar forloebet oprettes.
 *
 * SAMME FUNKTION BRUGES AF FORLOEBS-LISTEN. To steder der opretter et
 * forloeb hver paa sin maade er den slags forskel man foerst opdager en
 * maaned senere, naar ét hold opfoerer sig anderledes end alle andre.
 *
 * Datoen gives tilbage som et tal, saa filen ikke skal kende Firestore.
 * Klokken 00:01, saa forloebet daekker kalenderdagene rent og udloebet
 * lander ved midnat efter sidste dag i stedet for at arve et skaevt
 * klokkeslaet.
 */
export function forlobFelter(svar: NytForlobSvar): Record<string, unknown> & { startMs: number } {
	const startMs = new Date(`${svar.startDato}T00:01:00`).getTime();
	const faelles = {
		navn: svar.navn.trim(),
		antalDage: svar.antalDage,
		vaneProgramId: null,
		aktiv: svar.aktiv,
		startMs
	};

	if (svar.bygget) {
		return {
			...faelles,
			byggetForlob: true,
			produktNoegle: (svar.id || idAf(svar.navn)).trim(),
			adgangsNiveau: 'basis' as const,
			features: { ...svar.features },
			harBuddy: svar.harBuddy,
			harFacebookGruppe: svar.harFacebookGruppe,
			harTraening: svar.harTraening,
			nulDagePulje: Math.max(0, Math.min(365, svar.nulDagePulje))
		};
	}

	return {
		...faelles,
		type: svar.type,
		...(svar.premium ? { adgangsNiveau: 'premium' as const } : {})
	};
}

// ==============================================
// Verden, altsaa det der faktisk staar i databasen
// ==============================================

export interface GuideForlob {
	id: string;
	navn: string;
	startMs: number;
	antalDage: number;
	aktiv: boolean;
	bygget: boolean;
	/** Undefined betyder Kickstart eller Kropsro, som altid har traening. */
	harTraening?: boolean;
	traeningStartDag?: number;
	harFacebookGruppe?: boolean;
	facebookUrl?: string;
	simpleroProduktId?: string;
}

export interface Verden {
	forlob: GuideForlob | null;
	/** Tildelinger der rammer holdet, altsaa hold, medlemmer eller alle. */
	antalTraeningstildelinger: number;
	/**
	 * Programmer der ligger paa selve holdet.
	 *
	 * DER ER TO STEDER AT KIGGE. 3.0 tildeler programmer i en liste for
	 * sig, mens Kickstart og Kropsro har dem liggende paa holdet, hvor
	 * kunden selv vaelger sin variant ved opstarten. Kiggede man kun ét
	 * sted, spaerrede guiden for et hold der havde alt hvad det skulle
	 * have. Opdaget paa Kickstart August 4. september.
	 */
	antalProgrammerPaaHoldet: number;
	/** Dage i forloebet der har mindst én lektion. */
	dageMedLektion: number[];
	antalSmaaSkridt: number;
	antalFaq: number;
	/** Kunder der allerede er sat paa holdet. */
	antalKunder: number;
	/**
	 * Andre hold der er aktive OG staar paa det samme Simplero-nummer.
	 * Er der nogen, lander nye koeb tilfaeldigt, se forlobKoeb.ts.
	 */
	andreAktivePaaSammeProdukt: string[];
}

export type Status = 'klar' | 'mangler' | 'ikke-relevant';

export interface TrinStatus {
	id: TrinId;
	status: Status;
	/** Hvad der staar under trinnets navn i listen til venstre. */
	resume: string;
}

/** Har forloebet mikrotraening? Kickstart og Kropsro har det altid. */
export function harTraening(f: GuideForlob): boolean {
	return f.bygget ? f.harTraening === true : f.harTraening !== false;
}

function datoTekst(ms: number): string {
	if (!ms) return 'Ikke sat';
	return new Date(ms).toLocaleDateString('da-DK', {
		day: 'numeric',
		month: 'long',
		year: 'numeric'
	});
}

/**
 * Hvert trins tilstand, i den raekkefoelge de staar i.
 *
 * Et trin er 'klar' naar det der skal ligge i databasen ligger der.
 * Ikke naar man har trykket videre.
 */
export function tjekTrin(v: Verden): TrinStatus[] {
	const f = v.forlob;
	if (!f) {
		return TRIN.map((t) => ({
			id: t.id,
			status: t.id === 'navn' ? 'mangler' : ('ikke-relevant' as Status),
			resume: t.id === 'navn' ? 'Ikke besvaret' : 'Venter på navn og dato'
		}));
	}

	const traening = harTraening(f);
	const harProgram = v.antalTraeningstildelinger + v.antalProgrammerPaaHoldet > 0;
	const spaerret = spaerringer(v);

	const ud: TrinStatus[] = [
		{
			id: 'navn',
			status: f.navn && f.antalDage > 0 ? 'klar' : 'mangler',
			resume: f.navn ? `${f.navn}, ${f.antalDage} dage` : 'Ikke besvaret'
		},
		{
			id: 'start',
			status: f.startMs > 0 ? 'klar' : 'mangler',
			resume: datoTekst(f.startMs)
		},
		{
			id: 'hvem',
			status: f.simpleroProduktId || v.antalKunder > 0 ? 'klar' : 'mangler',
			resume: f.simpleroProduktId
				? `Køb lander automatisk${v.antalKunder ? `, ${v.antalKunder} med nu` : ''}`
				: v.antalKunder > 0
					? `${v.antalKunder} kunder sat på i hånden`
					: 'Ingen kunder, og ingen kobling til Simplero'
		},
		{
			id: 'traening',
			status: !traening ? 'ikke-relevant' : harProgram ? 'klar' : 'mangler',
			resume: !traening
				? 'Holdet har ikke mikrotræning'
				: v.antalProgrammerPaaHoldet > 0
					? `${v.antalProgrammerPaaHoldet} programmer på holdet, start dag ${f.traeningStartDag ?? 1}`
					: v.antalTraeningstildelinger > 0
						? `${v.antalTraeningstildelinger} ${v.antalTraeningstildelinger === 1 ? 'tildeling' : 'tildelinger'}, start dag ${f.traeningStartDag ?? 1}`
						: 'Ingen programmer tildelt'
		},
		{
			id: 'lektioner',
			status: v.dageMedLektion.length > 0 ? 'klar' : 'mangler',
			resume:
				v.dageMedLektion.length > 0
					? `${v.dageMedLektion.length} af ${f.antalDage} dage har indhold`
					: 'Ingen lektioner endnu'
		},
		{
			id: 'skridt',
			status: v.antalSmaaSkridt > 0 ? 'klar' : 'mangler',
			resume: v.antalSmaaSkridt > 0 ? `${v.antalSmaaSkridt} små skridt` : 'Ingen små skridt'
		},
		{
			id: 'faellesskab',
			status: v.antalFaq > 0 ? 'klar' : 'mangler',
			resume:
				(v.antalFaq > 0 ? `${v.antalFaq} spørgsmål i biblioteket` : 'Ingen FAQ') +
				(f.facebookUrl ? ' · Facebook-gruppe sat' : '')
		},
		{
			id: 'funktioner',
			// Funktionerne har altid en vaerdi, ogsaa naar man ikke har rørt
			// dem. Trinnet er et blik, ikke en opgave.
			status: 'klar',
			resume: f.bygget ? 'Frit valgt pr funktion' : 'Følger holdets type'
		},
		{
			id: 'udgiv',
			status: f.aktiv ? 'klar' : spaerret.length === 0 ? 'mangler' : 'mangler',
			resume: f.aktiv
				? 'Holdet er åbent'
				: spaerret.length === 0
					? 'Klar til at udgive'
					: `${spaerret.length} ting spærrer`
		}
	];

	return ud;
}

/**
 * Det der spaerrer for at udgive.
 *
 * EN ADVARSEL KAN OVERSES, EN KNAP DER IKKE KAN TRYKKES KAN IKKE. Derfor
 * er listen kort og kun det der faktisk goer at en kunde sidder med en
 * app der ikke virker. Alt andet staar som en bemaerkning i stedet.
 */
export function spaerringer(v: Verden): string[] {
	const f = v.forlob;
	if (!f) return ['Forløbet er ikke oprettet endnu'];

	const ud: string[] = [];

	if (!f.navn.trim()) ud.push('Forløbet har intet navn');
	if (!f.startMs) ud.push('Der er ingen startdato, og så kan ingen dag regnes ud');
	if (f.antalDage < 1) ud.push('Forløbet er nul dage langt');

	if (harTraening(f) && v.antalTraeningstildelinger + v.antalProgrammerPaaHoldet === 0) {
		ud.push(
			'Ingen træningsprogrammer er tildelt holdet. Kunderne ser "Din træning er på vej" i hele forløbet'
		);
	}

	if (harTraening(f) && (f.traeningStartDag ?? 1) > f.antalDage) {
		ud.push(
			`Træningen starter på dag ${f.traeningStartDag}, men forløbet er kun ${f.antalDage} dage. Så starter den aldrig`
		);
	}

	if (v.dageMedLektion.length === 0) {
		ud.push('Der er ingen lektioner på nogen dag. Forsiden er tom fra dag 1');
	}

	if (v.antalSmaaSkridt === 0) {
		ud.push('Der er ingen små skridt. Så har hun ingenting at gå i gang med');
	}

	if (f.harFacebookGruppe && !f.facebookUrl?.trim()) {
		ud.push(
			'Facebook-gruppen er slået til, men der er ikke sat et link ind. Så bliver hun spurgt om en gruppe hun ikke kan finde'
		);
	}

	if (f.simpleroProduktId && v.andreAktivePaaSammeProdukt.length > 0) {
		ud.push(
			`${v.andreAktivePaaSammeProdukt.join(' og ')} står på det samme Simplero-nummer og er stadig aktive. Nye køb kan lande på det forkerte hold`
		);
	}

	return ud;
}

/**
 * Det der boer ses paa, men som ikke er i vejen for at aabne holdet.
 *
 * Skellet er med vilje skarpt. Spaerrer alt, spaerrer ingenting, fordi
 * saa begynder man at lede efter vejen udenom.
 */
export function bemaerkninger(v: Verden): string[] {
	const f = v.forlob;
	if (!f) return [];

	const ud: string[] = [];

	if (!f.simpleroProduktId && v.antalKunder === 0) {
		ud.push('Ingen kunder er sat på holdet, og der er ingen kobling til Simplero');
	}

	if (v.antalFaq === 0) {
		ud.push('Der er ingen FAQ. Linn AI kan så ikke svare på hvornår der er Q&A');
	}

	const huller = manglendeDage(v);
	if (huller.length > 0) {
		ud.push(
			huller.length === 1
				? `Dag ${huller[0]} har ingen lektioner`
				: `${huller.length} dage har ingen lektioner, blandt andre dag ${huller.slice(0, 3).join(', ')}`
		);
	}

	if (f.startMs && f.startMs < Date.now()) {
		ud.push('Startdatoen er allerede passeret');
	}

	return ud;
}

/** Dage i forloebet uden en eneste lektion. Dag 0 er baseline og taeller ikke. */
export function manglendeDage(v: Verden): number[] {
	const f = v.forlob;
	if (!f || f.antalDage < 1) return [];
	const har = new Set(v.dageMedLektion);
	const ud: number[] = [];
	for (let d = 1; d <= f.antalDage; d++) if (!har.has(d)) ud.push(d);
	return ud;
}

/** Maa holdet aabne? */
export function kanUdgives(v: Verden): boolean {
	return spaerringer(v).length === 0;
}

/** Hvor langt man er. Udgivelses-trinnet taeller ikke med. */
export function fremdrift(v: Verden): { klar: number; ialt: number } {
	const t = tjekTrin(v).filter((x) => x.id !== 'udgiv');
	return {
		klar: t.filter((x) => x.status === 'klar' || x.status === 'ikke-relevant').length,
		ialt: t.length
	};
}
