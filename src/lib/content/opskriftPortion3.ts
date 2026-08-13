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
 * Hvor mange portioner arket aabner paa. ALTID ÉN.
 *
 * Linns valg 13. august, som vendte beslutningen fra 12. august hvor
 * arket aabnede paa opskriftens eget tal.
 *
 * HVORFOR: spoergsmaalet i arket er "hvor meget spiste du". Det
 * almindelige svar er én portion, ikke hele gryden. Aabnede arket paa 4,
 * og hun ikke opdagede det, ville hun logge fire gange for meget, og det
 * samme tal er dét der gemmes i dagbogen.
 *
 * Og opskriftens eget tal er en oplysning hun ikke skal bruge til noget:
 * ingredienserne skalerer med det antal hun vaelger, saa ved 1 portion
 * staar der 75 g linser i stedet for 150. Det ER en opskrift til én
 * person, og saa er det ligegyldigt at listen oprindeligt var skrevet
 * til to.
 *
 * Bemaerk at defaultPortioner stadig bruges, bare ikke her: den fortaeller
 * ingrediensMaengde hvad listen er skrevet til, saa der kan skaleres FRA
 * det tal.
 */
export function startPortioner(_defaultPortioner?: number | undefined): number {
	return 1;
}

/**
 * Hvor mange portioner ingredienslisten er SKREVET til.
 *
 * Den her og startPortioner er to forskellige ting, og de var det samme
 * indtil 13. august. Da arket blev sat til altid at aabne paa én portion,
 * troede ingrediensMaengde pludselig at ALLE lister var skrevet til én,
 * saa 600 g kylling i en ret til fire blev til 2.400 g. Testene fangede
 * det. Hold dem adskilt.
 *
 * Et manglende eller meningsloest tal bliver til 1, for ellers ville hele
 * listen vise nul af alting.
 */
export function listenErSkrevetTil(defaultPortioner: number | undefined): number {
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
	return skalerMaengde(maengde, listenErSkrevetTil(defaultPortioner), portioner);
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
 * Antallet naevnes kun naar det ikke er 1. Arket aabner altid paa én, saa
 * teksten er den samme indtil hun selv skruer op, og saa skal hun kunne se
 * hvad der bliver lagt i uden at kigge op paa taelleren.
 */
export function gemEtiket(maaltidLabel: string, portioner: number): string {
	const maaltid = maaltidLabel.toLowerCase();
	if (portioner === 1) return `Læg i ${maaltid}`;
	return `Læg ${formatPortion(portioner)} portioner i ${maaltid}`;
}
