// ============================================================
// Beskeder paa telefonen, og mail som reserve.
//
// Linns beslutninger 23. august 2026, tegnet i
// mockups-notifikationer.html.
//
// TRE SLAGS, og de er valgt fordi hver af dem er noget hun ellers ville
// gaa glip af mens appen er lukket:
//
//   svar    Linn har svaret paa hendes spoergsmaal. Den vigtigste
//   dag     Dagens indhold er klart. Kun forloebskunder
//   savn    Der er gaaet for lang tid. Den farligste, se nedenfor
//
// "DU HAR NAAET DIT MAAL" ER IKKE MED. Den slags sker mens hun har
// telefonen i haanden, og saa kan appen sige det selv. En notifikation
// om noget hun lige har gjort er stoej.
//
// MAIL ER EN RESERVE, IKKE EN KOPI. Kan hun naas paa telefonen, sender
// vi kun dér. Ellers en mail. Ellers ville hun faa alt to gange og slaa
// begge dele fra.
//
// SAVN-BESKEDEN MAA ALDRIG LAESE SOM EN LOEFTET PEGEFINGER. Se Linns
// regel om at en side aldrig maa laese som en anklage. Den staar med
// hendes egne ord og kan slaas fra pr forloeb.
// ============================================================

/** De tre slags. Rækkefoelgen er hvor vigtige de er. */
export type NotiSlags3 = 'svar' | 'dag' | 'savn';

export const NOTI_SLAGS3: NotiSlags3[] = ['svar', 'dag', 'savn'];

export interface NotiTekster3 {
	/** Det hun ser i appens egne indstillinger. */
	navn: string;
	forklaring: string;
}

export const NOTI_NAVNE3: Record<NotiSlags3, NotiTekster3> = {
	svar: { navn: 'Når Linn svarer dig', forklaring: 'Du har spurgt om noget og venter' },
	dag: { navn: 'Når dagen er klar', forklaring: 'Om morgenen, på de dage der er noget nyt' },
	savn: { navn: 'Hvis der er gået lang tid', forklaring: 'Højst én gang om ugen' }
};

/** Hvad kunden selv har valgt. Mangler et svar, er det til. */
export type NotiValg3 = Partial<Record<NotiSlags3, boolean>>;

/** Hvad Linn tillader. Samme tre lag som naeringen, se naeringAdgang3. */
export interface NotiRegler3 {
	medlemmer?: NotiValg3;
	forlob?: Record<string, NotiValg3>;
}

/**
 * Maa den her slags sendes til hende.
 *
 * BEGGE SKAL SIGE JA: Linn skal tillade den, og kunden skal ikke have
 * slaaet den fra. Alt er til naar ingen har taget stilling.
 */
export function maaSende3(
	slags: NotiSlags3,
	regler: NotiRegler3 | null,
	kundensValg: NotiValg3 | null,
	aktivtForlobId: string | null
): boolean {
	if (kundensValg?.[slags] === false) return false;
	const forlob = aktivtForlobId ? regler?.forlob?.[aktivtForlobId] : null;
	if (forlob && typeof forlob[slags] === 'boolean') return forlob[slags]!;
	const medlem = regler?.medlemmer;
	if (medlem && typeof medlem[slags] === 'boolean') return medlem[slags]!;
	return true;
}

/** Hvor lang tid der mindst skal gaa mellem to af samme slags. */
export const KARANTAENE_MS3: Record<NotiSlags3, number> = {
	// Svarer Linn tre gange paa ti minutter, faar hun én besked.
	svar: 6 * 60 * 60 * 1000,
	// Én om dagen. To "dagen er klar" samme dag er en fejl.
	dag: 20 * 60 * 60 * 1000,
	// Hoejst én om ugen, og det er rigeligt.
	savn: 7 * 24 * 60 * 60 * 1000
};

/**
 * Er der gaaet nok tid siden sidst.
 *
 * Uden den her ville en travl formiddag i admin give kunden fem
 * notifikationer, og saa slaar hun dem fra. Se HANDOVER 9.39.
 */
export function udenforKarantaene3(
	slags: NotiSlags3,
	sidstSendtMs: number | null | undefined,
	nu: number
): boolean {
	if (!sidstSendtMs) return true;
	return nu - sidstSendtMs >= KARANTAENE_MS3[slags];
}

/** Selve beskeden, som den staar paa laaseskaermen. */
export interface Noti3 {
	titel: string;
	tekst: string;
	/** Hvor hun lander naar hun trykker. Altid det rigtige sted. */
	sti: string;
	slags: NotiSlags3;
}

/** Hvor mange tegn af et svar der maa staa paa en laast skaerm. */
const UDDRAG_TEGN3 = 80;

/**
 * Et uddrag af Linns svar.
 *
 * DER STAAR ALDRIG NOGET FORTROLIGT. Beskeden ligger paa en laast skaerm
 * hvor andre kan laese med, saa det er LINNS svar der vises, aldrig
 * kundens spoergsmaal. Hun har selv skrevet spoergsmaalet og ved godt
 * hvad det handler om.
 */
export function uddrag3(svar: string): string {
	const ren = svar.replace(/\s+/g, ' ').trim();
	if (ren.length <= UDDRAG_TEGN3) return ren;
	// Klip ved sidste hele ord, saa der ikke staar et halvt ord foer
	// prikkerne.
	const kort = ren.slice(0, UDDRAG_TEGN3);
	const sidsteMellemrum = kort.lastIndexOf(' ');
	return `${(sidsteMellemrum > 40 ? kort.slice(0, sidsteMellemrum) : kort).trimEnd()}…`;
}

/** Beskeden naar Linn har svaret. */
export function svarNoti3(svar: string): Noti3 {
	return {
		titel: 'Linn har svaret dig',
		tekst: uddrag3(svar),
		sti: '/ny/beskeder',
		slags: 'svar'
	};
}

/** Beskeden om morgenen, naar dagen har noget nyt. */
export function dagNoti3(dagNummer: number, antalLektioner: number, harTraening: boolean): Noti3 {
	const dele: string[] = [];
	if (antalLektioner > 0)
		dele.push(`${antalLektioner} ${antalLektioner === 1 ? 'lektion' : 'lektioner'}`);
	if (harTraening) dele.push('din træning');
	return {
		titel: `Dag ${dagNummer} er klar`,
		tekst: dele.length ? `${dele.join(' og ')} venter` : 'Der er noget nyt til dig i dag',
		sti: '/ny',
		slags: 'dag'
	};
}

/** Beskeden naar der er gaaet for lang tid. Linns egne ord. */
export function savnNoti3(dage: number, egenTekst: string): Noti3 {
	return {
		titel: 'Vi ses igen når du er klar',
		tekst: egenTekst.trim() || `Der er gået ${dage} dage. Der er ingen der tæller`,
		sti: '/ny',
		slags: 'savn'
	};
}

/**
 * Hvilken kanal beskeden skal ud ad.
 *
 * Reglen er Linns: mail er en reserve. Har hun sagt ja paa telefonen og
 * har en levende tilmelding, sender vi kun dér.
 */
export type Kanal3 = 'telefon' | 'mail' | 'ingen';

export function vaelgKanal3(harPush: boolean, harMail: boolean): Kanal3 {
	if (harPush) return 'telefon';
	if (harMail) return 'mail';
	return 'ingen';
}
