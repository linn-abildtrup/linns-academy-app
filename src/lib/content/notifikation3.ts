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

/**
 * De tre slags, plus proeven.
 *
 * 'proeve' staar IKKE i hendes indstillinger. Den sendes én gang, i
 * opstarten, saa hun kan se at det virker. Uden den opdager vi foerst at
 * noget er galt den dag et rigtigt svar aldrig kom frem.
 */
export type NotiSlags3 = 'svar' | 'dag' | 'savn' | 'proeve';

/** Dem hun kan slaa til og fra. Proeven hoerer ikke til her. */
export type NotiValgSlags3 = 'svar' | 'dag' | 'savn';

export const NOTI_SLAGS3: NotiValgSlags3[] = ['svar', 'dag', 'savn'];

export interface NotiTekster3 {
	/** Det hun ser i appens egne indstillinger. */
	navn: string;
	forklaring: string;
}

export const NOTI_NAVNE3: Record<NotiValgSlags3, NotiTekster3> = {
	svar: { navn: 'Når Linn svarer dig', forklaring: 'Du har spurgt om noget og venter' },
	dag: { navn: 'Når dagen er klar', forklaring: 'Om morgenen, på de dage der er noget nyt' },
	savn: { navn: 'Hvis der er gået lang tid', forklaring: 'Højst én gang om ugen' }
};

/** Hvad kunden selv har valgt. Mangler et svar, er det til. */
export type NotiValg3 = Partial<Record<NotiValgSlags3, boolean>>;

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
	slags: NotiValgSlags3,
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
export const KARANTAENE_MS3: Record<NotiValgSlags3, number> = {
	// HVER BESKED FRA LINN ER SIN EGEN. Linns beslutning 23. august, og
	// hun har ret: har hun stillet to spoergsmaal og faaet to svar, skal
	// hun vide det begge gange. Foer var der seks timer imellem, og saa
	// sad kunden og ventede paa et svar der allerede laa der.
	//
	// Der er ingen risiko for stoej: den her slags kommer kun naar Linn
	// selv har skrevet noget. Det er de to andre der sker af sig selv.
	svar: 0,
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
	slags: NotiValgSlags3,
	sidstSendtMs: number | null | undefined,
	nu: number
): boolean {
	// Nul betyder ingen karantaene overhovedet, ikke "et oejeblik".
	if (KARANTAENE_MS3[slags] === 0) return true;
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

/** Proeven i opstarten. Kun tekst, ingen indstilling bag. */
export function proeveNoti3(): Noti3 {
	return {
		titel: 'Så er vi i gang',
		tekst: 'Sådan ser det ud når jeg siger til',
		sti: '/ny',
		slags: 'proeve'
	};
}

/**
 * Beskeden naar Linn skriver FOERST.
 *
 * Der staar "skrevet" og ikke "svaret". Hun har ikke spurgt om noget, og
 * det forkerte ord ville faa hende til at lede efter sit eget
 * spoergsmaal. Linns valg 23. august.
 */
export function skrevetNoti3(tekst: string): Noti3 {
	return {
		titel: 'Linn har skrevet til dig',
		tekst: uddrag3(tekst),
		sti: '/ny/beskeder?fane=linn',
		slags: 'svar'
	};
}

/** Beskeden naar Linn har svaret. */
export function svarNoti3(svar: string): Noti3 {
	return {
		titel: 'Linn har svaret dig',
		tekst: uddrag3(svar),
		// Peger paa FANEN og ikke bare siden. Hun har to, og lander hun paa
		// den forkerte, skal hun lede efter det hun lige blev lovet.
		// Linns valg 23. august, se HANDOVER 9.41.
		sti: '/ny/beskeder?fane=linn',
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

// ============================================================
// Morgen-beskeden og savn-beskeden.
//
// Linns beslutninger 23. august 2026:
//
//  - Dagen er klar sendes 06.15
//  - Savn efter 72 timer paa et forloeb, efter en uge for medlemmer
//  - Alt skal kunne aendres i admin, ogsaa teksten
//  - INGEN AF DEM MAA LAESE SOM EN LOEFTET PEGEFINGER
//
// DEN SIDSTE ER DEN VIGTIGSTE, og den er ikke bare en tone. Beskederne
// naevner ALDRIG hvor mange dage der er gaaet, hvor meget hun har
// misset, eller hvad hun burde. Se savnTekst3, hvor ordlyden er Linns
// egen, og laes dem hoejt foer du aendrer dem.
// ============================================================

/** En besked Linn selv kan skrive om. */
export interface SavnTekst3 {
	titel: string;
	tekst: string;
}

export interface NotiIndstillinger3 {
	/** Hvornaar morgen-beskeden sendes. Dansk tid, "06:15". */
	morgenTid: string;
	/** Timer uden aktivitet foer en forloebskunde faar et savn. */
	forlobTimer: number;
	/** Det samme for et medlem. */
	medlemTimer: number;
	savnForlob: SavnTekst3;
	savnMedlem: SavnTekst3;
}

/**
 * Udgangspunktet. Teksterne er Linns valg 23. august, hvor hun valgte
 * mellem tre til hver.
 *
 * FORLOEBS-TEKSTEN svarer paa det hun er bange for, inden hun naar at
 * taenke det: at hun er kommet bagud og skal starte forfra.
 *
 * MEDLEMS-TEKSTEN handler om OS og ikke om hende. Det er forskellen paa
 * "vi savner dig" og "du har ikke vaeret her".
 */
export const NOTI_STANDARD3: NotiIndstillinger3 = {
	morgenTid: '06:15',
	forlobTimer: 72,
	medlemTimer: 168,
	savnForlob: {
		titel: 'Der er ikke noget du skal indhente',
		tekst: 'Din dag ligger klar når du er. Du behøver ikke starte forfra.'
	},
	savnMedlem: {
		titel: 'Vi savner dig',
		tekst: 'Din app ligger her, og der er ikke noget du er gået glip af.'
	}
};

/** Timer og minutter fra "06:15". Ugyldigt bliver til standarden. */
export function tidsdele3(tid: string): { time: number; minut: number } {
	const m = /^(\d{1,2}):(\d{2})$/.exec(tid.trim());
	if (!m) return { time: 6, minut: 15 };
	const time = Number(m[1]);
	const minut = Number(m[2]);
	if (time > 23 || minut > 59) return { time: 6, minut: 15 };
	return { time, minut };
}

/**
 * Er det tid til morgen-beskeden.
 *
 * Vagten vaekker os hver time, og vi svarer kun ja i den ene. Grunden er
 * sommertid: klokken 6.15 i Danmark er ikke det samme klokkeslaet hele
 * aaret, og en fast tid ude hos vagten ville rykke sig en time om
 * vinteren uden at nogen opdagede det.
 */
export function erMorgen3(nuTimeKbh: number, indstillet: string): boolean {
	return nuTimeKbh === tidsdele3(indstillet).time;
}

/**
 * Er der gaaet laenge nok til et savn.
 *
 * Har vi aldrig set hende goere noget, sender vi INGENTING. En kunde der
 * lige er begyndt, og som ikke naaede at taste noget, skal ikke moedes
 * af et savn paa tredjedagen.
 */
export function skalSavne3(
	sidsteAktivitetMs: number | null,
	nu: number,
	timer: number
): boolean {
	if (!sidsteAktivitetMs) return false;
	return nu - sidsteAktivitetMs >= timer * 60 * 60 * 1000;
}

/** Savn-beskeden, med Linns egen ordlyd. */
export function savnBesked3(erForlobskunde: boolean, ind: NotiIndstillinger3): Noti3 {
	const t = erForlobskunde ? ind.savnForlob : ind.savnMedlem;
	return {
		titel: t.titel.trim() || (erForlobskunde ? NOTI_STANDARD3.savnForlob : NOTI_STANDARD3.savnMedlem).titel,
		tekst: t.tekst.trim(),
		sti: '/ny',
		slags: 'savn'
	};
}

/** Fylder huller ud, saa en halv indstilling ikke slaar noget i stykker. */
export function medStandard3(delvis: Partial<NotiIndstillinger3> | null): NotiIndstillinger3 {
	return {
		morgenTid: delvis?.morgenTid || NOTI_STANDARD3.morgenTid,
		forlobTimer: delvis?.forlobTimer && delvis.forlobTimer > 0 ? delvis.forlobTimer : NOTI_STANDARD3.forlobTimer,
		medlemTimer: delvis?.medlemTimer && delvis.medlemTimer > 0 ? delvis.medlemTimer : NOTI_STANDARD3.medlemTimer,
		savnForlob: { ...NOTI_STANDARD3.savnForlob, ...(delvis?.savnForlob ?? {}) },
		savnMedlem: { ...NOTI_STANDARD3.savnMedlem, ...(delvis?.savnMedlem ?? {}) }
	};
}
