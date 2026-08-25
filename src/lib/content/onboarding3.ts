// ============================================================
// Onboarding i 3.0. Ren logik, ingen database.
//
// Alle beslutninger staar i SPEC-3.0.md afsnit 31, og skaermene er
// tegnet i v3 app/linns-academy-design/mockups-onboarding.html.
//
// DEN VIGTIGSTE REGEL: onboarding maa ikke have sin egen mening om hvad
// kunden maa se. Den her fil faar adgangen ind som svar paa spoergsmaal
// appen allerede stiller, og bygger listen ud fra dem. Samme princip
// som programmerForKunde3 i traeningen, hvor admin og kunden deler den
// samme regel og derfor aldrig kan sige hver sit.
//
// FOELGEN: listen regnes ud paa ny hver gang og gemmes ALDRIG. En kunde
// der er gaaet fra forloeb til medlemskab faar den app hun har nu, ikke
// den hun havde da hun startede.
// ============================================================

import type { Kundetype } from '$lib/content/features';

// ── Har hun vaeret igennem ───────────────────────────────────

/**
 * Feltet paa bruger-dokumentet. Additivt, den gamle app laeser det ikke.
 *
 * HVORFOR DET SKAL FINDES: uden det betyder en tom udstyrsliste to ting
 * paa én gang, nemlig "hun er aldrig blevet spurgt" og "hun har svaret,
 * og hun har intet udstyr". maaSesMedUdstyr3 viser alt i begge
 * tilfaelde, saa spoergsmaalet ville blive stillet uden at hendes svar
 * betyder noget.
 */
export interface OnboardingKilde3 {
	/** Hvornaar hun blev faerdig, i ms. Undefined = aldrig vaeret igennem. */
	onboardet3?: number;
}

/**
 * Laeses gennem `unknown`, praecis som udstyrFra og favoritterFra goer.
 * Feltet er additivt og staar derfor IKKE i lib/types.ts, som er en
 * eksisterende fil vi ikke maa roere. Castet ligger ét sted og er testet.
 */
export function harVaeretIgennem3(kilde: unknown): boolean {
	const v = (kilde as OnboardingKilde3 | null | undefined)?.onboardet3;
	return typeof v === 'number' && v > 0;
}

/**
 * Skal hun sendes til onboarding lige nu.
 *
 * Admin gaar udenom. Ellers kunne Linn ikke aabne sit eget vaerktoej
 * uden at tage opstarten forfra, og hun er den der aabner appen
 * hyppigst af alle. Samme greb som spaerringen bruger.
 */
export function skalOnboardes3(kilde: unknown, erAdmin: boolean): boolean {
	if (erAdmin) return false;
	return !harVaeretIgennem3(kilde);
}

// ── Tekststoerrelsen ─────────────────────────────────────────

/**
 * De tre trin. Samme vaerdier som den gamle apps textScale, saa de to
 * apper ikke kan komme til at vise hver sin stoerrelse.
 *
 * Den gamle app gemmer kun valget i browserens localStorage. 3.0 gemmer
 * det OGSAA paa kontoen, saa det foelger med til en ny telefon. Se
 * feltet tekstSkala3.
 */
export type TekstSkala3 = 'normal' | 'large' | 'xlarge';

/**
 * NAVNENE er Lille, Normal og Stor. Linns valg 25. august.
 *
 * Foer hed de Almindelig, Større og Størst. Tre trin der alle sammen
 * lyder som varianter af det samme er svaere at vaelge imellem, hvor
 * lille og stor er ord alle kender.
 *
 * VAERDIERNE MAA IKKE OMDOEBES. `normal`, `large` og `xlarge` er den
 * gamle apps egne, og de deles med den, saa de to apper ikke kan komme
 * til at vise hver sin stoerrelse. Kunden ser kun navnet.
 */
export const TEKST_SKALAER_3: { vaerdi: TekstSkala3; navn: string; px: number }[] = [
	{ vaerdi: 'normal', navn: 'Lille', px: 15 },
	{ vaerdi: 'large', navn: 'Normal', px: 17 },
	{ vaerdi: 'xlarge', navn: 'Stor', px: 19.5 }
];

/** Laeser hendes gemte valg. Ukendte vaerdier falder tilbage paa normal. */
export function tekstSkalaFra3(kilde: unknown): TekstSkala3 {
	const v = (kilde as { tekstSkala3?: unknown } | null | undefined)?.tekstSkala3;
	if (v === 'large' || v === 'xlarge' || v === 'normal') return v;
	return 'normal';
}

// ── Trinnene ─────────────────────────────────────────────────

export type OnboardingTrin3 =
	| 'velkommen'
	| 'tekst'
	| 'udstyr'
	| 'hjemmeskaerm'
	| 'beskeder'
	| 'kort'
	| 'slut';

/** Hvad de to sidste trin afhaenger af. Se spoergsmaalTrin3. */
export interface TrinValg3 {
	/** Ligger appen allerede paa hjemmeskaermen. Saa springes trinnet over. */
	paaHjemmeskaerm: boolean;
	/** Kan telefonen tage imod beskeder, og er hun ikke spurgt endnu. */
	kanSpoergeOmBeskeder: boolean;
}

/**
 * Trinnene hun faktisk skal igennem.
 *
 * DE TO SIDSTE HAENGER SAMMEN, og raekkefoelgen er ikke til at komme
 * udenom: paa iPhone kan beskeder KUN slaas til inde i appen naar den
 * ligger paa hjemmeskaermen. Ligger den ikke, viser vi vejledningen og
 * springer beskederne over. Hun moeder dem naar hun aabner fra ikonet.
 *
 * Linns beslutning 23. august, se HANDOVER 9.39.
 */
export function spoergsmaalTrin3(valg: TrinValg3): OnboardingTrin3[] {
	const trin: OnboardingTrin3[] = ['velkommen', 'tekst', 'udstyr'];
	if (!valg.paaHjemmeskaerm) trin.push('hjemmeskaerm');
	if (valg.kanSpoergeOmBeskeder) trin.push('beskeder');
	return trin;
}

/** Det hun skal oplyse. Fire skaerme, ens for alle. Se SPEC 31.3. */
export const SPOERGSMAAL_TRIN_3: OnboardingTrin3[] = [
	'velkommen',
	'tekst',
	'udstyr',
	'hjemmeskaerm'
];

// ── Rundvisningen ────────────────────────────────────────────

export type KortId3 =
	| 'rundt'
	| 'forside'
	| 'mad'
	| 'traening'
	| 'forlob'
	| 'linn'
	| 'maaling';

export interface Rundvisningskort3 {
	id: KortId3;
	titel: string;
	/** Én saetning. Bliver den to, er kortet for stort til en telefon. */
	tekst: string;
	/**
	 * Filnavnet paa skaermbilledet, uden endelse. Ligger i
	 * static/onboarding/ og tages af scripts/skaermbilleder.ts.
	 *
	 * To kort har hver sin udgave til en forloebskunde og et medlem,
	 * fordi skaermen ser forskellig ud. Mangler filen, viser kortet bare
	 * ingen billede, saa gennemgangen virker ogsaa foer de er taget.
	 */
	billede: string;
	/** Hvad skaermbilledet skal vise. Staar her saa det ikke bliver gaettet. */
	billedeBeskrivelse: string;
}

/** Hvad vi skal vide om kunden for at kunne vaelge kortene. */
export interface KundeBillede3 {
	harAktivtForlob: boolean;
	/** Har hun faaet mindst ét traeningsprogram tildelt. */
	harTraening: boolean;
	/** Maa hun sende spoergsmaal videre til Linn. Se beskedside3. */
	maaSkriveTilLinn: boolean;
	/** Maa hun se kulhydrat, fedt og kalorier. Styrer én saetning. */
	maaSeKalorier: boolean;
}

/**
 * Kortene hun skal se, i raekkefoelge.
 *
 * Et kort hun ikke har adgang til FORSVINDER. Ingen graa kasse der
 * forklarer hvad hun ikke maa, samme regel som i traeningen.
 */
export function rundvisningskort3(kunde: KundeBillede3): Rundvisningskort3[] {
	const kort: Rundvisningskort3[] = [];

	kort.push({
		id: 'rundt',
		titel: 'Sådan finder du rundt',
		tekst:
			'Nederst har du fem knapper. Forsiden er din dag i dag, 30-30 er maden, ' +
			'Beskeder er mig, Udvikling er dine tal, og Profil er dig.',
		billede: 'rundt',
		billedeBeskrivelse: 'Bundmenuen, beskaaret saa kun de fem knapper er med'
	});

	kort.push({
		id: 'forside',
		titel: 'Forsiden er din dag',
		// Teksten skal passe til det skaermbilledet faktisk viser, og det er
		// toppen af forsiden. Foldningen laa laengere nede og var ikke med.
		tekst: kunde.harAktivtForlob
			? 'Alt du skal i dag står her, også dagens lektion. Øverst kan du følge ' +
				'hvordan dit overskud har flyttet sig siden du startede.'
			: 'Alt du skal i dag står her. Øverst kan du følge hvordan dit overskud ' +
				'har flyttet sig siden du startede.',
		billede: kunde.harAktivtForlob ? 'forside-forlob' : 'forside-medlem',
		billedeBeskrivelse: kunde.harAktivtForlob
			? 'Forsiden for en forloebskunde, hvor en klaret sektion er foldet sammen'
			: 'Forsiden for et medlem, hvor en klaret sektion er foldet sammen'
	});

	kort.push({
		id: 'mad',
		titel: 'Sådan registrerer du mad',
		tekst: kunde.maaSeKalorier
			? 'Tryk på måltidet, tryk tilføj, og find din madvare. Målet er 30 g protein ' +
				'pr måltid og 30 g fiber om dagen, og du kan også se kalorier og resten.'
			: 'Tryk på måltidet, tryk tilføj, og find din madvare. Målet er 30 g protein ' +
				'pr måltid og 30 g fiber om dagen.',
		billede: 'mad',
		billedeBeskrivelse: 'Maaltidsskaermen med Tilfoej-knappen'
	});

	// Kun hvis hun faktisk har faaet et program. Ellers lover kortet noget
	// der ikke er der, og hun lander paa en tom skaerm bagefter.
	if (kunde.harTraening) {
		kort.push({
			id: 'traening',
			titel: 'Din træning',
			tekst:
				'Vælg et program, tryk på træningen, og følg med på videoen. ' +
				'Du rykker først videre når du har trænet, så en pause sætter dig ikke bagud.',
			billede: 'traening',
			billedeBeskrivelse: 'Mikrotraening med et program der er i gang'
		});
	}

	if (kunde.harAktivtForlob) {
		kort.push({
			id: 'forlob',
			titel: 'Dit forløb',
			tekst:
				'Her er alle dine dage. Du kan altid gå tilbage til en dag du har været på, ' +
				'og se hvad der lå på den.',
			billede: 'forlob',
			billedeBeskrivelse: 'Forloebets kalender med baade klarede og laaste dage'
		});
	}

	if (kunde.maaSkriveTilLinn) {
		kort.push({
			id: 'linn',
			titel: 'Skriv til mig',
			tekst:
				'Spørg altid Linn AI først, den svarer med det samme. ' +
				'Er du ikke tilfreds med svaret, sender du spørgsmålet videre til mig.',
			billede: 'linn',
			billedeBeskrivelse: 'Beskeder med send-videre-linjen under et svar'
		});
	}

	kort.push({
		id: 'maaling',
		titel: 'Din måling',
		tekst:
			'Med jævne mellemrum spørger jeg hvordan du har det. ' +
			'Det er den du kan følge under Udvikling.',
		billede: 'maaling',
		billedeBeskrivelse: 'Kortet Dit overskud paa forsiden med kurven'
	});

	return kort;
}

// ── Taelleren ────────────────────────────────────────────────

/**
 * Hvor mange trin hun har i alt, og hvor hun er.
 *
 * Linns beslutning 16. august: ÉN taeller der gaar til 11, ikke to.
 * Tallet kan ikke staa fast, for en forloebskunde faar 4 spoergsmaal og
 * 7 kort, mens et medlem faar 4 og 5.
 */
export interface Taeller3 {
	/** 1-baseret, altsaa det tal der staar paa skaermen. */
	nu: number;
	ialt: number;
	/** 0 til 1. Bruges til bredden paa bjaelken. */
	andel: number;
}

export function taeller3(
	trinNr: number,
	antalKort: number,
	medSpoergsmaal = true,
	antalSpoergsmaal = SPOERGSMAAL_TRIN_3.length
): Taeller3 {
	const ialt = (medSpoergsmaal ? antalSpoergsmaal : 0) + antalKort;
	const nu = Math.min(Math.max(trinNr, 1), Math.max(ialt, 1));
	return { nu, ialt, andel: ialt === 0 ? 1 : nu / ialt };
}

/**
 * Hvilket kort trinnet peger paa, eller null hvis vi stadig er i
 * spoergsmaalene.
 *
 * `medSpoergsmaal` er falsk naar hun har trykket "Gennemgå appen" under
 * Profil. Saa springes de fire spoergsmaal over, og taelleren taeller
 * kun kortene. Ville den stadig sige "5 af 11", ville hun lede efter de
 * fire foerste.
 */
export function kortNr3(
	trinNr: number,
	medSpoergsmaal = true,
	antalSpoergsmaal = SPOERGSMAAL_TRIN_3.length
): number {
	return medSpoergsmaal ? trinNr - antalSpoergsmaal - 1 : trinNr - 1;
}

// ── Videoen ──────────────────────────────────────────────────

/**
 * Hilsenen paa foerste skaerm, én pr kundetype. Linns beslutning
 * 16. august.
 *
 * URL'erne er TOMME indtil de fire videoer er optaget. En tom URL
 * betyder at skaermen springer afspilleren over og kun viser hilsenen,
 * saa onboarding virker fuldt ud i mellemtiden. Naar Linn har dem, er
 * det én linje pr kundetype her i filen.
 *
 * URL'en maa vaere Vimeo eller YouTube, se videoEmbedUrl i bibliotek.ts.
 */
export const VELKOMSTVIDEO_3: Record<Kundetype, string> = {
	kickstart: '',
	kropsro: '',
	fleksibelt: '',
	app: ''
};

export function velkomstvideo3(type: Kundetype | null): string {
	if (!type) return '';
	return VELKOMSTVIDEO_3[type] ?? '';
}

/**
 * Linjen under hilsenen. Den staar der ogsaa naar videoen mangler, saa
 * opstarten er personlig fra dag ét.
 */
export function velkomsttekst3(type: Kundetype | null): string {
	switch (type) {
		case 'kickstart':
			return 'De næste 21 dage følges vi ad. Jeg stiller dig lige fire hurtige spørgsmål, og så viser jeg dig rundt.';
		case 'kropsro':
			return 'Du er lige gået i gang med noget der tager tid, og det er meningen. Jeg stiller dig lige fire hurtige spørgsmål, og så viser jeg dig rundt.';
		case 'fleksibelt':
			return 'Godt du er her. Jeg stiller dig lige fire hurtige spørgsmål, og så viser jeg dig rundt.';
		default:
			return 'Der er ikke noget hold og ingen startdato, du bestemmer selv tempoet. Jeg stiller dig lige fire hurtige spørgsmål, og så viser jeg dig rundt.';
	}
}

/** Overskriften paa sidste skaerm, saa slutningen passer til hende. */
export function slutTekst3(harAktivtForlob: boolean): { titel: string; tekst: string } {
	return harAktivtForlob
		? {
				titel: 'Så er du klar',
				tekst:
					'Det første du skal, er din måling, så vi har et sted at måle fra. Den tager to minutter.'
			}
		: {
				titel: 'Så er du klar',
				tekst:
					'Du bestemmer selv tempoet. Prøv at registrere det du har spist i dag, så er du i gang.'
			};
}
