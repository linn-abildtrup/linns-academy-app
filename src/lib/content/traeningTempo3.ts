// ============================================================
// Tempo paa en traening hun selv bygger.
//
// HVORFOR DEN FINDES. Foer skulle hun saette saet, sekunder og pause for
// HVER ENKELT oevelse. Tre talfelter gange antallet af oevelser, uden
// nogen hjaelp til hvad der er fornuftigt. En kunde der ikke traener i
// forvejen har ingen maade at vide om 45 sekunder er meget eller lidt.
//
// Nu vaelger hun ét tempo for hele traeningen. Hun KAN stadig rette en
// enkelt oevelse bagefter, men hun behoever ikke.
//
// Tallene er Linns, 21. august 2026.
// ============================================================

export interface Tempo3 {
	id: string;
	navn: string;
	/** Sekunder med arbejde. */
	workSec: number;
	/** Sekunder pause bagefter. */
	restSec: number;
}

/**
 * De tre tempoer, fra roligst til haardest.
 *
 * Ét saet pr oevelse i alle tre. Skal hun have flere saet, retter hun den
 * enkelte oevelse. De fleste egne programmer er korte, og saet gange
 * oevelser loeber hurtigt op i noget der tager en halv time.
 *
 * BEMAERK at de tre ikke tager lige lang tid. Roligt er 50 sekunder pr
 * oevelse, de to andre er 60. Det er Linns tal fra 21. august, og det er
 * skrevet her saa ingen retter det uden at spoerge hende.
 */
export const TEMPOER3: Tempo3[] = [
	{ id: 'roligt', navn: 'Roligt', workSec: 30, restSec: 20 },
	{ id: 'almindeligt', navn: 'Almindeligt', workSec: 45, restSec: 15 },
	{ id: 'haardt', navn: 'Hårdt', workSec: 50, restSec: 10 }
];

/** "30/20", altsaa det der staar med lille skrift paa knappen. */
export function tempoTal3(t: Tempo3): string {
	return `${t.workSec}/${t.restSec}`;
}

/**
 * Hvilket tempo traeningen koerer i lige nu.
 *
 * Null naar oevelserne ikke koerer det SAMME tempo. Det sker hvis hun har
 * rettet en enkelt, og saa maa ingen af knapperne staa valgt: ellers ser
 * det ud som om hele traeningen koerer noget den ikke goer.
 */
export function nuvaerendeTempo3(oevelser: { workSec: number; restSec: number }[]): Tempo3 | null {
	if (oevelser.length === 0) return null;
	const foerste = oevelser[0];
	const ens = oevelser.every((o) => o.workSec === foerste.workSec && o.restSec === foerste.restSec);
	if (!ens) return null;
	return (
		TEMPOER3.find((t) => t.workSec === foerste.workSec && t.restSec === foerste.restSec) ?? null
	);
}

/** Oevelserne med det nye tempo paa. Saet og alt andet roeres ikke. */
export function saetTempo3<T extends { workSec: number; restSec: number }>(
	oevelser: T[],
	tempo: Tempo3
): T[] {
	return oevelser.map((o) => ({ ...o, workSec: tempo.workSec, restSec: tempo.restSec }));
}
