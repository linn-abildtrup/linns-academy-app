// ============================================================
// Portioner og makro paa en opskrift. Regnereglen ét sted.
//
// HVORFOR DEN HER FIL FINDES. Reglen var spredt ud over tre skaerme i to
// apps, og de var uenige. Maalt 12. august 2026 paa alle 130 opskrifter:
//
//   - den gamle apps opskrift-side DELTE makroen med defaultPortioner
//   - 3.0 gangede den med antal portioner uden at dele
//   - den gamle apps madplan-vej gjorde en tredje ting
//
// Paa de 122 opskrifter der staar til én portion gav det samme svar, for at
// dele med 1 aendrer ingenting. Paa de 8 der staar til 2, 4 eller 12 gav det
// svar der var 2, 4 og 12 gange fra hinanden. En kunde fik krediteret 12 g
// protein hvor hun spiste 48.
//
// DE TO KONVENTIONER, som ALT herunder hviler paa:
//
//   1. MAKROEN ER PR PORTION. Altid, ogsaa paa de opskrifter der er til
//      fire. Bekraeftet 12. august: de 8 mange-portioners ligger i samme
//      leje som de 122 én-portioners (protein median 38 mod 30). Var tallet
//      for hele retten, skulle de ligge fire gange hoejere. Og "Kylling med
//      broccoli" erklaerer 475 kcal, mens raavarerne alene er omkring 1.400,
//      saa tallet KAN ikke daekke hele retten.
//
//   2. INGREDIENSLISTEN RAEKKER TIL defaultPortioner. Bekraeftet samme dag:
//      de 8 har 500 til 800 g koed, de 122 har 50 til 250 g.
//
// Deraf foelger at defaultPortioner skal bruges paa ingredienserne og ALDRIG
// paa makroen. Det er hele fejlen, sagt i én saetning.
// ============================================================

import { skalerMaengde } from './opskrifter';
import { formatPortion } from './maengde3';

/**
 * Hvor mange portioner arket aabner paa.
 *
 * Opskriftens eget tal, altsaa 1 for de fleste og 4 for de retter der er
 * skrevet til en familie. Linns valg 12. august: arket skal aabne som
 * opskriften er skrevet, saa ingredienslisten kan laeses direkte.
 *
 * Bemaerk at det samme tal ogsaa er dét der bliver gemt i dagbogen. Derfor
 * siger gem-knappen antallet naar det ikke er 1, se gemEtiket.
 */
export function startPortioner(defaultPortioner: number | undefined): number {
	const d = defaultPortioner ?? 1;
	return d > 0 ? d : 1;
}

/**
 * Maengden af én ingrediens ved det valgte antal portioner.
 *
 * Listen er skrevet til defaultPortioner, saa der skal skaleres FRA det tal.
 * 3.0 gangede foer bare med antal portioner, saa 600 g kylling blev staaende
 * ved 1 portion og blev til 2.400 g ved 4.
 */
export function ingrediensMaengde(
	maengde: number,
	defaultPortioner: number | undefined,
	portioner: number
): number {
	return skalerMaengde(maengde, startPortioner(defaultPortioner), portioner);
}

/**
 * Et makro-tal ved det valgte antal portioner.
 *
 * defaultPortioner indgaar IKKE, for tallet er allerede pr portion. Det er
 * her den gamle app tager fejl ved at dele med det.
 *
 * null ind giver null ud, saa et manglende tal bliver ved med at vaere
 * manglende i stedet for at blive til nul.
 */
export function makroForPortioner(prPortion: number | null, portioner: number): number | null {
	if (prPortion === null) return null;
	return Math.round(prPortion * portioner * 10) / 10;
}

/**
 * Teksten paa gem-knappen.
 *
 * Antallet naevnes kun naar det ikke er 1. Aabner arket paa 4, fordi retten er
 * skrevet til fire, skal hun kunne se hvad der bliver lagt i uden at kigge op
 * paa taelleren. Ved 1 portion ville tallet bare vaere stoej.
 */
export function gemEtiket(maaltidLabel: string, portioner: number): string {
	const maaltid = maaltidLabel.toLowerCase();
	if (portioner === 1) return `Læg i ${maaltid}`;
	return `Læg ${formatPortion(portioner)} portioner i ${maaltid}`;
}
