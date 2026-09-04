// ============================================================
// Kurverne over et symptomtjek.
//
// Linns oenske 4. september 2026: kunde-opslaget skal ogsaa vise
// sliderne og en graf over udviklingen.
//
// SAMME KURVE SOM KUNDEN SELV SER. Regnestykket er flyttet hertil fra
// symptomcheck-siden i den gamle app, ikke skrevet om. Ellers kunne
// Linns skaerm og kundens skaerm vise hver sin udvikling af det samme,
// og saa er samtalen tabt paa forhaand.
//
// TO SKALAER DER VENDER HVER SIN VEJ, og det er den nemmeste fejl at
// lave her:
//   MRS gaar 0 til 44, og LAVT er bedst. Faerre gener.
//   Sliderne gaar 1 til 10, og HOEJT er bedst. Mere velvaere.
// Derfor tager `retning` altid stilling til hvilken vej der er den gode,
// i stedet for at gaette paa tallet.
//
// FILEN TEGNER IKKE, den regner kun koordinater ud. Saa kan kurven
// proeves uden en browser.
// ============================================================

export interface Maaling {
	/** Hvornaar. Bruges kun til at saette dem i raekkefoelge. */
	t: number;
	v: number;
}

export interface Punkt {
	x: number;
	y: number;
	t: number;
	v: number;
}

export interface Ramme {
	min: number;
	max: number;
	bredde: number;
	hoejde: number;
	/** Luft hele vejen rundt, saa en prik paa kanten ikke bliver klippet. */
	kant: number;
}

/** Rammen om den store MRS-kurve. 0 til 44. */
export const RAMME_TOTAL: Ramme = { min: 0, max: 44, bredde: 320, hoejde: 120, kant: 10 };

/** Rammen om de fem smaa slider-kurver. 1 til 10. */
export const RAMME_SLIDER: Ramme = { min: 1, max: 10, bredde: 320, hoejde: 80, kant: 10 };

/**
 * Maalingerne omsat til koordinater, aeldste til venstre.
 *
 * Punkterne fordeles jaevnt, IKKE efter hvor lang tid der gik imellem.
 * Det er med vilje: maalingerne kommer med faste mellemrum, og en pause
 * skal ikke goere en enkelt maaling bredere end de andre.
 */
export function punkter(maalinger: Maaling[], r: Ramme): Punkt[] {
	if (maalinger.length === 0) return [];
	const raekke = [...maalinger].sort((a, b) => a.t - b.t);
	const n = raekke.length;
	const spand = Math.max(1, r.max - r.min);
	const tegneBredde = r.bredde - r.kant * 2;
	const tegneHoejde = r.hoejde - r.kant * 2;

	return raekke.map((m, i) => {
		// Én maaling staar i midten. En prik yderst til venstre ville ligne
		// starten paa en kurve der ikke findes.
		const x = n === 1 ? r.bredde / 2 : (i / (n - 1)) * tegneBredde + r.kant;
		const klemt = Math.min(r.max, Math.max(r.min, m.v));
		const y = r.hoejde - r.kant - ((klemt - r.min) / spand) * tegneHoejde;
		return { x, y, t: m.t, v: m.v };
	});
}

/** Linjen mellem punkterne. Tom streng ved under to punkter. */
export function linje(p: Punkt[]): string {
	if (p.length < 2) return '';
	return p.map((q, i) => `${i === 0 ? 'M' : 'L'} ${q.x},${q.y}`).join(' ');
}

export type Retning = 'bedre' | 'daarligere' | 'ens' | 'for-faa';

/**
 * Er det gaaet den rigtige vej?
 *
 * `lavereErBedre` skal saettes bevidst hver gang. MRS og sliderne vender
 * hver sin vej, og et fortegn der er byttet om ville rose en kunde der
 * har det vaerre.
 */
export function retning(maalinger: Maaling[], lavereErBedre: boolean): Retning {
	if (maalinger.length < 2) return 'for-faa';
	const raekke = [...maalinger].sort((a, b) => a.t - b.t);
	const foerste = raekke[0].v;
	const sidste = raekke[raekke.length - 1].v;
	if (foerste === sidste) return 'ens';
	const faldet = sidste < foerste;
	return faldet === lavereErBedre ? 'bedre' : 'daarligere';
}

/**
 * Sætningen under kurven.
 *
 * DEN ROSER IKKE, OG DEN BEBREJDER IKKE. Et symptomtjek der gaar den
 * forkerte vej siger noget om en krop i en haard periode, ikke om en
 * kunde der ikke goer sit arbejde. Linns regel, se 9.26.
 */
export function udviklingTekst(maalinger: Maaling[], lavereErBedre: boolean, hvad: string): string {
	const r = retning(maalinger, lavereErBedre);
	if (r === 'for-faa') return 'Der skal to målinger til før der er en udvikling at se.';

	const raekke = [...maalinger].sort((a, b) => a.t - b.t);
	const foerste = raekke[0].v;
	const sidste = raekke[raekke.length - 1].v;

	if (r === 'ens') return `${hvad} ligger på ${sidste}, det samme som ved første måling.`;
	if (r === 'bedre') return `${hvad} er gået fra ${foerste} til ${sidste}, altså den rigtige vej.`;
	return `${hvad} er gået fra ${foerste} til ${sidste}. Kroppen har haft en hårdere periode, og det siger ikke noget om hvor godt hun gør det.`;
}

/** Vaerdierne paa y-aksen, oeverst foerst. */
export function yAkse(r: Ramme, antal = 3): number[] {
	const ud: number[] = [];
	for (let i = 0; i < antal; i++) {
		ud.push(Math.round(r.max - ((r.max - r.min) / (antal - 1)) * i));
	}
	return ud;
}
