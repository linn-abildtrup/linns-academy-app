// ============================================================
// Forsidens beregninger i Linns Academy 3.0.
//
// Rene funktioner uden Firestore, saa hver regel kan testes. Siden
// henter data og kalder herind, den regner ikke selv.
//
// Kernen er kurven i "Dit overskud": den gaar ALTID fra kundens
// foerste maaling til den nyeste, uanset om der er gaaet tre uger
// eller tre aar. Det er kun antallet af prikker og datoer der bliver
// faerre, naar der er meget at vise. Perioder med forloeb faar et lyst
// felt, og en pause (meldt ud og kommet med igen) tegnes som et hul.
//
// Se v3 app/linns-academy-design + beslutningerne fra 5. august 2026.
// ============================================================

import type { Adgang } from './adgang3';

/**
 * De fem skydere, som de ligger paa en MRS-udfyldelse. Felterne er
 * valgfrie her, fordi gamle udfyldelser fra foer 22. maj 2026 kan mangle
 * dem. Typen passer strukturelt til MrsSliders.
 */
export interface Skydere {
	energi?: number;
	mave?: number;
	cravings?: number;
	humor?: number;
	sovn?: number;
}

/**
 * Felter 3.0 laegger paa kunde-dokumentet. De staar HER og ikke i
 * types.ts, fordi den gamle apps typer ikke maa aendres. Den gamle app
 * ignorerer felter den ikke kender.
 */
export interface NyeKundeFelter {
	/** Dagens inspirator-tekst, saa vi kun spoerger AI'en én gang. */
	nyInspirator?: { dato: string; tekst: string };
	/** Datoen hun sagde "ikke nu" til inspiratoren. */
	nyInspiratorAfvist?: string;
}

/** Én maaling af Dit overskud. Gennemsnittet af de fem skydere, 1-10. */
export interface Maaling {
	ms: number;
	/** 1-10, hoejere er bedre. Én decimal. */
	vaerdi: number;
}

/** Et forloeb tegnet som et lyst felt bag kurven. */
export interface Baand {
	navn: string;
	produkt: string;
	fraMs: number;
	tilMs: number;
	/** Venstre kant i svg-koordinater. */
	x: number;
	bredde: number;
}

/** Et hul i kurven, hvor hun ikke havde adgang. */
export interface PauseBaand {
	x: number;
	bredde: number;
}

/** Et punkt paa kurven, faerdigt til at tegne. */
export interface Punkt {
	ms: number;
	vaerdi: number;
	x: number;
	y: number;
	/** Skal punktet have en prik. Ved mange maalinger vises kun nogle. */
	visPrik: boolean;
	/** Skal vaerdien staa over punktet. */
	visTal: boolean;
	/** Skal datoen staa under punktet. */
	visDato: boolean;
	erSidste: boolean;
}

export interface Kurve {
	punkter: Punkt[];
	/** Sammenhaengende stykker af linjen. Et nyt stykke efter hver pause. */
	stier: string[];
	/** Stiplede stykker hen over pauserne. */
	huller: string[];
	/**
	 * Fladen under linjen, ét stykke pr sammenhaengende stykke. En tynd
	 * streg i en stor kasse ser tom ud, og en flade goer ikke. Forsiden
	 * bruger den ikke, Udvikling goer.
	 */
	fyld: string[];
	baand: Baand[];
	pauser: PauseBaand[];
	/** Nyeste maaling, eller null hvis hun aldrig har maalt. */
	seneste: Maaling | null;
	/** Foerste maaling nogensinde. */
	foerste: Maaling | null;
	/** Forskellen mellem foerste og nyeste. Positiv er fremgang. */
	aendring: number;
	/** Maalene der er tegnet efter. Komponenten laeser viewBox og y'er her. */
	flade: Flade;
	/** Y-aksens tal. Tegnes kun naar fladen har bedt om en akse. */
	akse: Akse;
}

// ── Tegnefladen ─────────────────────────────────────────────
// Maalene laa foer som faste tal her i filen, fordi kurven kun fandtes
// paa forsiden. Siden 18. august tegnes den samme kurve ogsaa paa
// Udvikling, hvor den har en hel side at brede sig paa i stedet for et
// kort. Derfor er maalene nu et argument.
//
// FLADE_FORSIDE er de PRAECIS samme tal som foer, saa forsiden ikke
// flytter sig af sig selv. Vil du aendre forsidens hoejde, saa gør det
// her ét sted, og saa foelger baand, pauser og datoer med.

export interface Flade {
	/** viewBox'ens bredde og hoejde. */
	bredde: number;
	hoejde: number;
	/** Hvor linjen begynder og slutter vandret. */
	xVenstre: number;
	xHoejre: number;
	/** Toppen og bunden af selve kurven. Over og under er der plads til tal. */
	yTop: number;
	yBund: number;
	/** Det lyse felt bag et forloeb. */
	baandTop: number;
	baandHoejde: number;
	/** Den farvede streg under feltet, som ogsaa bruges til pauser. */
	baandStregY: number;
	baandStregHoejde: number;
	/** Datoerne under kurven. */
	datoY: number;
	/** Holdets navn under sit eget baand. Se FLADE_UDVIKLING. */
	baandTekstY: number;
	/**
	 * Skal der staa tal paa y-aksen, og skal skalaen saa rundes ud til
	 * hele tal. Forsidens kort er for lille til en akse, saa den er falsk
	 * der og sand paa Udvikling.
	 */
	akse: boolean;
	/** Hvor langt inde linjen begynder, saa aksens tal kan staa udenfor. */
	akseBredde: number;
	/** Et kort forloeb maa ikke blive til en streg. */
	baandMinBredde: number;
	baandKantVenstre: number;
	baandKantHoejre: number;
}

/** Forsidens kort. Lavere end foer 18. august, se HANDOVER 9.25. */
export const FLADE_FORSIDE: Flade = {
	bredde: 286,
	hoejde: 66,
	xVenstre: 22,
	xHoejre: 264,
	yTop: 14,
	yBund: 48,
	baandTop: 4,
	baandHoejde: 46,
	baandStregY: 52,
	baandStregHoejde: 3,
	datoY: 63,
	// Forsiden har ikke plads til navne paa baandet og bruger sin egen
	// forklaring under kortet. Feltet er sat for at fladen er hel.
	baandTekstY: 63,
	akse: false,
	akseBredde: 0,
	baandMinBredde: 12,
	baandKantVenstre: 14,
	baandKantHoejre: 274
};

/**
 * Udvikling. Kurven er sidens hovedperson og ikke et hjoerne af et kort,
 * saa den faar mere hoejde og gaar taettere paa kanterne.
 */
export const FLADE_UDVIKLING: Flade = {
	bredde: 286,
	hoejde: 116,
	// Helt ud til kanten. Paa forsiden er kurven et hjoerne af et kort og
	// skal have luft omkring sig. Her ER den indholdet.
	xVenstre: 22,
	xHoejre: 278,
	yTop: 14,
	yBund: 90,
	baandTop: 3,
	baandHoejde: 89,
	baandStregY: 94,
	baandStregHoejde: 3,
	datoY: 110,
	baandTekstY: 110,
	akse: true,
	// Plads til "10" til venstre for kurven.
	akseBredde: 16,
	baandMinBredde: 12,
	baandKantVenstre: 18,
	baandKantHoejre: 283
};

/**
 * Traekker maalingerne af Dit overskud ud af MRS-udfyldelserne.
 *
 * De fem skydere (energi, mave, cravings, humoer, soevn) gemmes i samme
 * dokument som symptomspoergsmaalene, og det er gennemsnittet af dem der
 * er Dit overskud. Udfyldelser uden skydere (fra foer 22. maj 2026)
 * springes over, for de har ingen vaerdi at vise.
 */
export function maalingerFraMrs(
	scores: Array<{ timestamp: number; sliders?: Skydere }>
): Maaling[] {
	const ud: Maaling[] = [];
	for (const s of scores) {
		const sl = s.sliders;
		if (!sl) continue;
		const tal = [sl.energi, sl.mave, sl.cravings, sl.humor, sl.sovn].filter(
			(v): v is number => typeof v === 'number'
		);
		if (tal.length === 0) continue;
		const gns = tal.reduce((a, b) => a + b, 0) / tal.length;
		ud.push({ ms: s.timestamp, vaerdi: Math.round(gns * 10) / 10 });
	}
	return ud.sort((a, b) => a.ms - b.ms);
}

/** Dansk kortdato. Aarstallet kommer kun med, naar punktet er fra et andet aar. */
export function formaterKortDato(ms: number, nu: number): string {
	const d = new Date(ms);
	const maaneder = [
		'jan',
		'feb',
		'mar',
		'apr',
		'maj',
		'jun',
		'jul',
		'aug',
		'sep',
		'okt',
		'nov',
		'dec'
	];
	const basis = `${d.getDate()}. ${maaneder[d.getMonth()]}`;
	const sammeAar = d.getFullYear() === new Date(nu).getFullYear();
	return sammeAar ? basis : `${basis} ${d.getFullYear()}`;
}

/**
 * Hvilke punkter der skal have prik, tal og dato.
 *
 * Op til fire maalinger: alt paa alle. Fem til tolv: prik og tal paa alle,
 * dato kun paa foerste, midterste og sidste. Over tolv: linjen tegnes
 * gennem alle, men kun nogle faa faar prik, og tal og dato staar kun i
 * hver ende. Ellers staar tallene oven i hinanden.
 */
export function taethedsregler(antal: number): {
	prik: (i: number) => boolean;
	tal: (i: number) => boolean;
	dato: (i: number) => boolean;
} {
	const sidste = antal - 1;
	const midt = Math.floor(sidste / 2);

	if (antal <= 4) {
		return { prik: () => true, tal: () => true, dato: () => true };
	}
	if (antal <= 12) {
		return {
			prik: () => true,
			tal: () => true,
			dato: (i) => i === 0 || i === sidste || i === midt
		};
	}
	// Over tolv: hoejst seks prikker fordelt jaevnt, plus enderne.
	const skridt = Math.ceil(sidste / 5);
	return {
		prik: (i) => i === 0 || i === sidste || i % skridt === 0,
		tal: (i) => i === 0 || i === sidste,
		dato: (i) => i === 0 || i === sidste
	};
}

/** Y-aksens tre tal. midt er null naar den ikke ville blive et helt tal. */
export interface Akse {
	lav: number;
	hoej: number;
	midt: number | null;
}

/**
 * Skalaen paa y-aksen.
 *
 * Uden hele tal, altsaa paa forsiden: som det altid har vaeret. Aksen
 * laegger sig taet om hendes tal, saa en fremgang fra 5,1 til 6,0 ikke
 * ser ud som ingenting. Der staar ingen tal paa den.
 *
 * Med hele tal, altsaa paa Udvikling: Linns beslutning 18. august. Der
 * skal STAA tal paa aksen, og saa maa der aldrig staa 3,8 eller 8,0.
 * Vi runder derfor ud til hele tal og soerger for at midten ogsaa
 * bliver et. Hannes 4,2 til 7,6 giver 4, 6 og 8.
 *
 * Aksen daekker altid hendes egne tal og ikke hele skalaen fra 1 til 10.
 * Linns valg. Hun vil hellere se bevaegelsen tydeligt end se hvor langt
 * der er til ti.
 */
export function beregnAkse(vaerdier: number[], heleTal: boolean): Akse {
	if (vaerdier.length === 0) return { lav: 1, hoej: 10, midt: null };

	const mindst = Math.min(...vaerdier);
	const stoerst = Math.max(...vaerdier);

	if (!heleTal) {
		let lav = mindst - 0.4;
		let hoej = stoerst + 0.4;
		if (hoej - lav < 1.5) {
			const midte = (hoej + lav) / 2;
			lav = midte - 0.75;
			hoej = midte + 0.75;
		}
		lav = Math.max(1, lav);
		hoej = Math.min(10, hoej);
		if (hoej <= lav) hoej = lav + 1;
		return { lav, hoej, midt: null };
	}

	let lav = Math.max(1, Math.floor(mindst));
	let hoej = Math.min(10, Math.ceil(stoerst));

	// En flad kurve ville ellers faa hoejde nul og forsvinde.
	while (hoej - lav < 2) {
		if (hoej < 10) hoej += 1;
		else if (lav > 1) lav -= 1;
		else break;
	}

	// Midten skal ogsaa vaere et helt tal, ellers staar der 5,5 paa aksen.
	if ((hoej - lav) % 2 !== 0) {
		if (hoej < 10) hoej += 1;
		else if (lav > 1) lav -= 1;
	}

	const spaend = hoej - lav;
	return { lav, hoej, midt: spaend > 0 && spaend % 2 === 0 ? lav + spaend / 2 : null };
}

/** Laegger et tal ind i tegnefladens x-akse. */
function xFor(ms: number, fra: number, til: number, flade: Flade): number {
	if (til <= fra) return flade.xHoejre;
	const andel = (ms - fra) / (til - fra);
	return flade.xVenstre + andel * (flade.xHoejre - flade.xVenstre);
}

/**
 * Bygger alt hvad kurven skal bruge for at blive tegnet.
 *
 * `adgange` bruges til to ting: at markere forloebs-perioder, og at finde
 * de huller hvor hun ikke havde adgang. Begge dele klippes til det vindue
 * kurven daekker, saa et forloeb fra foer foerste maaling ikke fylder.
 */
export function byggKurve(
	maalinger: Maaling[],
	adgange: Adgang[],
	nu: number,
	navnePrForlobId: Map<string, string> = new Map(),
	flade: Flade = FLADE_FORSIDE
): Kurve {
	const tom: Kurve = {
		punkter: [],
		stier: [],
		huller: [],
		fyld: [],
		baand: [],
		pauser: [],
		seneste: null,
		foerste: null,
		aendring: 0,
		flade,
		akse: beregnAkse([], flade.akse)
	};
	if (maalinger.length === 0) return tom;

	const sorteret = [...maalinger].sort((a, b) => a.ms - b.ms);
	const foerste = sorteret[0];
	const seneste = sorteret[sorteret.length - 1];

	// Vinduet. Med kun én maaling ville fra og til vaere ens, og saa
	// ville alt lande i hoejre kant. Vi giver den en uges bredde, saa
	// punktet staar paent alene.
	const vindueFra = foerste.ms;
	const vindueTil = seneste.ms > foerste.ms ? seneste.ms : foerste.ms + 7 * 86400000;

	// Y-aksen skalerer efter hendes egne tal, ikke efter 1-10. Se beregnAkse.
	const akse = beregnAkse(
		sorteret.map((m) => m.vaerdi),
		flade.akse
	);
	const lav = akse.lav;
	const hoej = akse.hoej;

	const regler = taethedsregler(sorteret.length);
	const punkter: Punkt[] = sorteret.map((m, i) => ({
		ms: m.ms,
		vaerdi: m.vaerdi,
		x: Math.round(xFor(m.ms, vindueFra, vindueTil, flade) * 10) / 10,
		y:
			Math.round(
				(flade.yBund - ((m.vaerdi - lav) / (hoej - lav)) * (flade.yBund - flade.yTop)) * 10
			) / 10,
		visPrik: regler.prik(i),
		visTal: regler.tal(i),
		visDato: regler.dato(i),
		erSidste: i === sorteret.length - 1
	}));

	// ── Forloebs-baand ──────────────────────────────────────────
	const baand: Baand[] = [];
	for (const a of adgange) {
		if (a.art !== 'forlob') continue;
		const fra = Math.max(a.fra, vindueFra);
		const til = Math.min(a.til ?? nu, vindueTil);
		if (til <= fra) continue;
		let x = xFor(fra, vindueFra, vindueTil, flade);
		let bredde = xFor(til, vindueFra, vindueTil, flade) - x;
		// Et forloeb paa tre uger maa ikke forsvinde til en streg, naar man
		// kigger paa to aar. Derfor en mindstebredde.
		if (bredde < flade.baandMinBredde) {
			x -= (flade.baandMinBredde - bredde) / 2;
			bredde = flade.baandMinBredde;
		}
		x = Math.max(flade.baandKantVenstre, x);
		if (x + bredde > flade.baandKantHoejre) x = flade.baandKantHoejre - bredde;
		baand.push({
			navn: navnePrForlobId.get(a.forlobId ?? '') ?? a.produkt,
			produkt: a.produkt,
			fraMs: a.fra,
			tilMs: a.til ?? nu,
			x: Math.round(x * 10) / 10,
			bredde: Math.round(bredde * 10) / 10
		});
	}

	// ── Pauser ──────────────────────────────────────────────────
	// Perioder inde i vinduet hvor hun slet ingen adgang havde.
	const daekning = flet(
		adgange
			.filter((a) => a.art === 'abo' || a.art === 'forlob')
			.map((a) => ({ fra: a.fra, til: Math.min(a.til ?? nu, nu) }))
			.filter((p) => p.til > p.fra)
	);

	const huller: Array<{ fra: number; til: number }> = [];
	let markoer = vindueFra;
	for (const p of daekning) {
		if (p.til <= vindueFra) continue;
		if (p.fra >= vindueTil) break;
		if (p.fra > markoer) huller.push({ fra: markoer, til: Math.min(p.fra, vindueTil) });
		markoer = Math.max(markoer, p.til);
	}
	if (markoer < vindueTil && daekning.length > 0) {
		huller.push({ fra: markoer, til: vindueTil });
	}

	const pauser: PauseBaand[] = huller
		.map((h) => {
			const x = xFor(h.fra, vindueFra, vindueTil, flade);
			return {
				x: Math.round(x * 10) / 10,
				bredde: Math.round((xFor(h.til, vindueFra, vindueTil, flade) - x) * 10) / 10
			};
		})
		.filter((p) => p.bredde >= 4);

	// ── Linjestykker ────────────────────────────────────────────
	// Linjen brydes hen over en pause, saa hun kan se at der ikke er noget
	// at vise, i stedet for at tro at hun stod stille.
	const stier: string[] = [];
	const fyld: string[] = [];
	const hullerSti: string[] = [];
	let stykke: Punkt[] = [];

	// Linjen brydes naar der ligger et hul MELLEM to maalinger. Hullet
	// behoever ikke daekke hele stykket, det skal bare overlappe det.
	const iPause = (a: number, b: number) => huller.some((h) => h.fra < b && h.til > a);

	for (let i = 0; i < punkter.length; i++) {
		stykke.push(punkter[i]);
		const naeste = punkter[i + 1];
		if (!naeste) break;
		if (iPause(punkter[i].ms, naeste.ms)) {
			stier.push(tilSti(stykke, flade));
			fyld.push(tilFyld(stykke, flade));
			hullerSti.push(`M${punkter[i].x},${punkter[i].y} L${naeste.x},${naeste.y}`);
			stykke = [];
		}
	}
	if (stykke.length) {
		stier.push(tilSti(stykke, flade));
		fyld.push(tilFyld(stykke, flade));
	}

	return {
		punkter,
		stier: stier.filter((s) => s.length > 0),
		fyld: fyld.filter((s) => s.length > 0),
		huller: hullerSti,
		baand,
		pauser,
		seneste,
		foerste,
		aendring: Math.round((seneste.vaerdi - foerste.vaerdi) * 10) / 10,
		flade,
		akse
	};
}

/** Slaar overlappende perioder sammen og sorterer dem. */
function flet(
	perioder: Array<{ fra: number; til: number }>
): Array<{ fra: number; til: number }> {
	const sorteret = [...perioder].sort((a, b) => a.fra - b.fra);
	const ud: Array<{ fra: number; til: number }> = [];
	for (const p of sorteret) {
		const sidste = ud[ud.length - 1];
		if (sidste && p.fra <= sidste.til) {
			sidste.til = Math.max(sidste.til, p.til);
		} else {
			ud.push({ ...p });
		}
	}
	return ud;
}

/** Et sammenhaengende linjestykke som svg-sti. */
function tilSti(punkter: Punkt[], flade: Flade): string {
	if (punkter.length === 0) return '';
	if (punkter.length === 1) {
		// Ét punkt kan ikke tegne en linje. En kort vandret streg giver
		// stadig noget at se paa, saa kortet ikke ser tomt ud.
		const p = punkter[0];
		return `M${Math.max(flade.xVenstre, p.x - 10)},${p.y} L${p.x},${p.y}`;
	}
	return punkter.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ');
}

/**
 * Fladen under et stykke af linjen. Lukket ned mod kurvens bund, saa den
 * kan fyldes med en toning.
 *
 * Ét punkt giver ingen flade. En lodret streg ville se ud som en fejl.
 */
function tilFyld(punkter: Punkt[], flade: Flade): string {
	if (punkter.length < 2) return '';
	const linje = punkter.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ');
	const sidste = punkter[punkter.length - 1];
	return `${linje} L${sidste.x},${flade.yBund} L${punkter[0].x},${flade.yBund} Z`;
}

/**
 * Hvornaar der maales. Kickstart hver uge, alt andet hver fjerde uge.
 * Besluttet af Linn 5. august 2026.
 */
export function kadenceDage(produkt: string | null): number {
	return produkt === 'kickstart' ? 7 : 28;
}

/**
 * Naar maalingen er aaben, staar baandet paa score-kortet. Det staar i
 * en uge og forsvinder saa, saa hun ikke moeder en bebrejdelse hver dag.
 */
export const MAALING_VINDUE_DAGE = 7;

export interface MaalingStatus {
	/** Skal det honningfarvede baand staa paa kortet. */
	erAaben: boolean;
	/** Hvornaar naeste maaling falder. null hvis hun aldrig har maalt. */
	naesteMs: number | null;
	/** Faerdig tekst til kortets fod, fx "Næste måling på søndag". */
	tekst: string;
}

/**
 * Opgoer om maalingen er aaben nu.
 *
 * Har hun aldrig maalt, er den aaben med det samme. Ellers falder den
 * kadenceDage efter sidste maaling og staar aaben en uge derefter.
 */
export function maalingStatus(
	sidsteMaalingMs: number | null,
	produkt: string | null,
	nu: number
): MaalingStatus {
	if (sidsteMaalingMs === null) {
		return { erAaben: true, naesteMs: null, tekst: 'Din første måling er klar' };
	}
	const dage = kadenceDage(produkt);
	const naesteMs = sidsteMaalingMs + dage * 86400000;
	const vinduetSlutter = naesteMs + MAALING_VINDUE_DAGE * 86400000;

	if (nu >= naesteMs && nu < vinduetSlutter) {
		return { erAaben: true, naesteMs, tekst: 'Din måling er klar' };
	}
	if (nu >= vinduetSlutter) {
		// Hun sprang den over. Vi venter til naeste gang uden at brokke os.
		const efterfoelgende = naesteMs + dage * 86400000;
		return {
			erAaben: false,
			naesteMs: efterfoelgende,
			tekst: `Næste måling ${formaterNaeste(efterfoelgende, nu)}`
		};
	}
	return { erAaben: false, naesteMs, tekst: `Næste måling ${formaterNaeste(naesteMs, nu)}` };
}

/** "på søndag", "i morgen", "om 12 dage" eller en dato. */
function formaterNaeste(ms: number, nu: number): string {
	const enDag = 86400000;
	const start = new Date(nu);
	start.setHours(0, 0, 0, 0);
	const maal = new Date(ms);
	maal.setHours(0, 0, 0, 0);
	const dage = Math.round((maal.getTime() - start.getTime()) / enDag);

	if (dage <= 0) return 'i dag';
	if (dage === 1) return 'i morgen';
	if (dage <= 7) {
		const ugedage = [
			'på søndag',
			'på mandag',
			'på tirsdag',
			'på onsdag',
			'på torsdag',
			'på fredag',
			'på lørdag'
		];
		return ugedage[maal.getDay()];
	}
	if (dage <= 21) return `om ${dage} dage`;
	return `den ${formaterKortDato(ms, nu)}`;
}
