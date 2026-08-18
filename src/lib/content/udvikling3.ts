// ============================================================
// Udvikling i 3.0, foerste blok: baseline og check-ins.
// Ren logik, ingen database.
//
// Linns beslutning 18. august. Den gamle side tegner fem farvede streger
// oven i hinanden i ét lille felt, med en farveforklaring under. Den
// viser alt og svarer paa ingenting. Her er det vendt om:
//
//  1. ÉN kurve over hendes overskud samlet, altsaa det samme tal
//     forsiden viser hende
//  2. En liste med "fra → til" pr spoergsmaal, som er DET der svarer paa
//     "har det hjulpet"
//  3. Vil hun grave, kan hun vaelge ét spoergsmaal og se dets egen kurve
//
// ALLE FEM SPOERGSMAAL TAELLER SAMME VEJ. Ti er bedst, ogsaa paa
// cravings, hvor 1 betyder mange og 10 betyder ingen. Det er nemt at
// laese forkert, saa der er en test der holder paa det.
//
// Kilden er kundens maalinger, og der er KUN ÉN kilde. De gamle svar fra
// vaner-modulet blev flyttet over i sommeren 2026 og ligger nu samme
// sted som resten, maerket saa de ikke taeller med i symptom-scoren. De
// har stadig deres fem tal, saa de kommer med i kurven her og hullet i
// historikken opstaar aldrig.
// ============================================================

export type SliderId = 'energi' | 'mave' | 'cravings' | 'humor' | 'sovn';

export interface SliderInfo {
	id: SliderId;
	/** Det korte navn i listen og paa knappen. */
	kort: string;
	/** Den fulde saetning, naar der er plads. */
	lang: string;
}

/**
 * De fem, i den raekkefoelge hun ser dem. Samme raekkefoelge som naar hun
 * udfylder maalingen, saa hun genkender dem.
 */
export const SLIDERE: readonly SliderInfo[] = [
	{ id: 'energi', kort: 'Min energi', lang: 'Min energi' },
	{ id: 'sovn', kort: 'Min søvn', lang: 'Min søvn' },
	{ id: 'humor', kort: 'Mit humør', lang: 'Mit humør og overskud' },
	{ id: 'mave', kort: 'Min mave', lang: 'Min mave og fordøjelse' },
	{ id: 'cravings', kort: 'Mine cravings', lang: 'Mine cravings' }
] as const;

/** Kun det Udvikling har brug for at vide om én maaling. */
export interface MaalingKilde {
	timestamp: number;
	sliders?: Partial<Record<SliderId, number>>;
}

/** Ét punkt paa en kurve. */
export interface Punkt {
	ms: number;
	/** 1 til 10. Én decimal paa den samlede, hele tal paa de enkelte. */
	vaerdi: number;
}

// ── Kurverne ────────────────────────────────────────────────

/**
 * Maalinger med mindst ét svar, i tidsraekkefoelge.
 *
 * Maalinger uden svar springes over. De findes hos kunder fra foer maj
 * 2026, hvor de fem spoergsmaal ikke fandtes endnu, og de har ingen
 * vaerdi at vise.
 */
export function brugbareMaalinger(scores: MaalingKilde[]): MaalingKilde[] {
	return scores
		.filter((s) => tal(s).length > 0)
		.slice()
		.sort((a, b) => a.timestamp - b.timestamp);
}

/** De tal der faktisk er svaret paa i én maaling. */
function tal(s: MaalingKilde): number[] {
	if (!s.sliders) return [];
	return SLIDERE.map((q) => s.sliders?.[q.id]).filter(
		(v): v is number => typeof v === 'number' && Number.isFinite(v)
	);
}

/**
 * Den samlede kurve: gennemsnittet af de svar der er givet, pr maaling.
 *
 * Vi dividerer med ANTAL SVAR og ikke med fem. Har hun sprunget ét
 * spoergsmaal over, ville en division med fem trykke hendes overskud ned
 * uden at hun har det daarligere.
 */
export function samletKurve(scores: MaalingKilde[]): Punkt[] {
	return brugbareMaalinger(scores).map((s) => {
		const v = tal(s);
		const gns = v.reduce((a, b) => a + b, 0) / v.length;
		return { ms: s.timestamp, vaerdi: Math.round(gns * 10) / 10 };
	});
}

/** Kurven for ét enkelt spoergsmaal. Maalinger uden det svar udelades. */
export function kurveFor(scores: MaalingKilde[], id: SliderId): Punkt[] {
	const ud: Punkt[] = [];
	for (const s of brugbareMaalinger(scores)) {
		const v = s.sliders?.[id];
		if (typeof v !== 'number' || !Number.isFinite(v)) continue;
		ud.push({ ms: s.timestamp, vaerdi: v });
	}
	return ud;
}

// ── Fra og til ──────────────────────────────────────────────

/** Én linje i "Siden du startede". */
export interface FraTil {
	id: SliderId;
	kort: string;
	lang: string;
	/** Hendes allerfoerste svar paa det spoergsmaal. */
	foer: number;
	/** Hendes seneste svar. */
	nu: number;
	/** nu minus foer. Positiv er fremgang paa alle fem. */
	forskel: number;
	/** Er der mere end ét svar at sammenligne. */
	kanSammenlignes: boolean;
}

/**
 * Fra-til pr spoergsmaal, maalt mod hendes ALLERFOERSTE maaling.
 *
 * Linns beslutning 18. august: har hun vaeret med i to aar, er det den
 * historie der er den rigtige, ikke det seneste forloebs egen start.
 *
 * Har hun kun svaret én gang, staar foer og nu ens og kanSammenlignes er
 * falsk. Saa kan skaermen sige "det her er dit udgangspunkt" i stedet for
 * at vise en fremgang paa nul, som ville laese som en fiasko.
 */
export function fraTilListe(scores: MaalingKilde[]): FraTil[] {
	const ud: FraTil[] = [];

	for (const q of SLIDERE) {
		const kurve = kurveFor(scores, q.id);
		if (kurve.length === 0) continue;

		const foer = kurve[0].vaerdi;
		const nu = kurve[kurve.length - 1].vaerdi;
		ud.push({
			id: q.id,
			kort: q.kort,
			lang: q.lang,
			foer,
			nu,
			forskel: Math.round((nu - foer) * 10) / 10,
			kanSammenlignes: kurve.length > 1
		});
	}

	return ud;
}

/** Det spoergsmaal der har rykket sig mest. null hvis intet har rykket sig. */
export function stoersteFremgang(liste: FraTil[]): FraTil | null {
	let bedst: FraTil | null = null;
	for (const f of liste) {
		if (!f.kanSammenlignes || f.forskel <= 0) continue;
		if (!bedst || f.forskel > bedst.forskel) bedst = f;
	}
	return bedst;
}

// ── Hvad skaermen skal vise ─────────────────────────────────

/**
 * Hvor langt hun er.
 *
 *  - 'ingen'   hun har aldrig maalt. Vi inviterer hende til det
 *  - 'foerste' hun har maalt én gang. Det er hendes udgangspunkt, og der
 *              er ikke noget at sammenligne med endnu
 *  - 'flere'   hun har maalt mindst to gange. Nu er der en historie
 */
export type UdviklingTilstand = 'ingen' | 'foerste' | 'flere';

export function tilstandFor(scores: MaalingKilde[]): UdviklingTilstand {
	const n = brugbareMaalinger(scores).length;
	if (n === 0) return 'ingen';
	if (n === 1) return 'foerste';
	return 'flere';
}

/** Overskuddet ved seneste maaling, og hvor meget det har rykket sig. */
export interface Overblik {
	nu: number;
	/** null naar der kun er én maaling. */
	forskel: number | null;
}

export function overblikFor(scores: MaalingKilde[]): Overblik | null {
	const kurve = samletKurve(scores);
	if (kurve.length === 0) return null;
	const nu = kurve[kurve.length - 1].vaerdi;
	if (kurve.length === 1) return { nu, forskel: null };
	return { nu, forskel: Math.round((nu - kurve[0].vaerdi) * 10) / 10 };
}

/** "↑ 2,6 siden start". Tom naar der ikke er noget at sige. */
export function forskelTekst(forskel: number | null): string {
	if (forskel === null || forskel === 0) return '';
	const pil = forskel > 0 ? '↑' : '↓';
	return `${pil} ${formatTal(Math.abs(forskel))} siden start`;
}

/** Dansk komma, og ingen decimal naar der ikke er nogen. */
export function formatTal(v: number): string {
	const afrundet = Math.round(v * 10) / 10;
	return Number.isInteger(afrundet) ? String(afrundet) : String(afrundet).replace('.', ',');
}
