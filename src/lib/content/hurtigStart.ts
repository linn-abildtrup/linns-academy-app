// ============================================================
// Hurtig opstart af den gamle app.
//
// PROBLEMET. Naar kunden aabner appen, skete alt i koe og uden tidsgraense:
// Firebase Auth svarer, saa hentes bruger-dokumentet fra SERVEREN, og saa
// koeres forloebs-synkroniseringen, som selv er 2 til 4 ture mere frem og
// tilbage plus skrivninger. Foerst derefter forsvandt "Et oejeblik". Paa en
// mobil med en doed forbindelse blev det maalt til over ét minut, selv om
// bruger-dokumentet hele tiden laa klar i telefonens egen kopi (Firestore
// gemmer hver doc i browserens IndexedDB, se localCache i lib/firebase.ts).
//
// LOESNINGEN. Vi laeser kopien lokalt, hvilket ikke koster netvaerk, og
// kapløber den rigtige kaede mod et lille ur. Vinder kaeden, er alt praecis
// som foer. Trækker den ud, lukker vi kunden ind paa kopien og lader kaeden
// loebe faerdig i baggrunden.
//
// Denne fil er ren logik uden database, saa reglen kan testes.
// ============================================================

import type { UserDoc } from '$lib/types';
import { harIngenAdgang, harTestAdgang } from '$lib/utils/userAdgang';

/**
 * UDRULNING. Den hurtige opstart ligger i den gamle apps login-flow, altsaa
 * noget hver eneste af de cirka 760 kunder i drift gaar igennem hver gang.
 * Derfor blev den ikke aabnet for alle paa én gang.
 *
 * AABNET FOR ALLE 12. august 2026, efter at have koert bag HURTIG_START_FLAG
 * hos admin og de to testkonti siden 11. august uden problemer.
 *
 * Kontakten bliver staaende med vilje. Dukker der noget op, vippes den
 * tilbage til false, og saa er alle andre end testerne oejeblikkeligt tilbage
 * paa den opstart de koerte paa foer. Det er den eneste linje der skal
 * aendres, begge veje.
 */
export const HURTIG_START_FOR_ALLE = true;

/**
 * Flaget der giver den hurtige opstart under udrulningen. Vi genbruger med
 * vilje 'ny-app'-flaget i stedet for at lave et nyt: det sidder allerede paa
 * de rigtige konti, og et flag mere ville bare vaere endnu et sted at holde
 * styr paa. Se harTestAdgang i utils/userAdgang.ts.
 */
export const HURTIG_START_FLAG = 'ny-app';

/**
 * Hvor laenge den rigtige kaede maa vaere om at blive faerdig, foer vi lukker
 * kunden ind paa den lokale kopi.
 *
 * Tallet er valgt saa den normale kunde paa en normal forbindelse ALDRIG naar
 * hertil: bruger-dokumentet tager typisk 0,15 til 0,4 sek, og forloebs-
 * synkroniseringen laegger 2 til 4 ture oveni, altsaa 0,5 til 1,5 sek i alt.
 * 2,5 sek giver rigelig luft, saa opstarten ser fuldstaendig ud som foer for
 * alle andre end dem der faktisk sidder og venter. Det er hele pointen: vi
 * aendrer kun noget for den kunde der ellers ville stirre paa en spinner.
 */
export const HURTIG_START_MS = 2500;

/**
 * Maa vi lukke kunden ind paa den lokale kopi af hendes bruger-dokument?
 *
 * Der er tre porte, og alle tre skal sige ja.
 *
 * 1. Er der overhovedet en kopi? Foerste gang kunden logger ind paa en enhed
 *    er der ingen, og saa er der intet at aabne paa.
 *
 * 2. Er den hurtige opstart aabnet for hende? Under udrulningen er det kun
 *    admin og kunder med flaget, se HURTIG_START_FOR_ALLE ovenfor.
 *
 * 3. Ville kopien foere til skaermen "du har ingen adgang"? Saa venter vi
 *    hellere paa serveren. En betalende kunde maa ALDRIG risikere at faa den
 *    skaerm at se, bare fordi hendes telefon laa med en gammel kopi. Den anden
 *    vej er ufarlig: aabner vi paa en kopi der viser lidt for lidt, retter
 *    serveren det et oejeblik efter.
 *
 * Admin gaar igennem port 2 og 3, praecis som i selve skallen, saa en forkert
 * dato paa Linns egen konto ikke kan bremse hendes opstart. Port 1 gaelder
 * ogsaa admin, for uden en kopi er der bogstavelig talt ingenting at vise.
 */
export function maaAabnePaaKopi(kopi: UserDoc | null | undefined, erAdmin: boolean): boolean {
	if (!kopi) return false;
	if (!HURTIG_START_FOR_ALLE && !erAdmin && !harTestAdgang(kopi, HURTIG_START_FLAG)) return false;
	if (erAdmin) return true;
	return !harIngenAdgang(kopi);
}

/**
 * Et loefte der falder til ro naar der er gaaet ms millisekunder. Bruges til
 * at kapløbe den rigtige kaede mod uret.
 */
export function tidsgraense(ms: number): Promise<'tid'> {
	return new Promise((afslut) => setTimeout(() => afslut('tid'), ms));
}
