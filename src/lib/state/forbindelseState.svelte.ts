// Global tilstand for om appen kan naa serveren, og om der ligger noget der
// endnu ikke er sendt.
//
// HVORFOR DEN FINDES. Naar kunden gemmer noget uden forbindelse sker der to
// ting paa én gang: telefonen skriver det ned i sin lokale kopi med det
// samme, saa det SER gemt ud, og selve anmodningen til serveren gaar i staa
// og bliver staaende. Den melder aldrig fejl. Derfor rammer appens egne
// fejlbeskeder aldrig, og derfor blev gem-knappen staaende paa "Gemmer...".
//
// En kunde paa Kickstart August mistede tirsdag og onsdag paa den maade, mad,
// vaner og noter, uden at faa det at vide. Set 4. september 2026.
//
// Tilstanden saettes ét sted, i app/+layout.svelte, og laeses af baandet
// oeverst og af de gem-flows der vil sige fra. Ingen side maa selv gaette paa
// forbindelsen.

import { browser } from '$app/environment';
import { waitForPendingWrites } from 'firebase/firestore';
import { db } from '$lib/firebase';

// Telefonen siger selv fra naar flytilstand slaas til eller wifi ryger. Det
// er hurtigt, men det luerer: den kan sagtens sige online paa et hotelnet
// der ikke slipper noget igennem.
let browserOnline = $state(true);

// Firestore er den paalidelige kilde. Kommer svarene fra den lokale kopi i
// stedet for serveren, er der ingen forbindelse i praksis. Saettes udefra af
// layoutet, som lytter paa kundens eget dokument.
let serverSvarer = $state(true);

// True fra det oejeblik et gem er sat i gang og til alt er kvitteret af
// serveren. Bruges til maerket i dagbogen og til den groenne kvittering.
let harUsendt = $state(false);

// Saettes kortvarigt naar alt netop er naaet frem, saa kvitteringen kan vises
// og forsvinde af sig selv igen.
let netopSendt = $state(false);
let netopSendtTimer: ReturnType<typeof setTimeout> | null = null;

/** True hvis appen ikke kan naa serveren lige nu. */
export function erOffline(): boolean {
	return !browserOnline || !serverSvarer;
}

/** True hvis der ligger noget der endnu ikke er kvitteret af serveren. */
export function harUsendteAendringer(): boolean {
	return harUsendt;
}

/** True i de faa sekunder lige efter at alt er naaet frem. */
export function erNetopSendt(): boolean {
	return netopSendt;
}

/** Kaldes af layoutet ud fra browserens egne online- og offline-haendelser. */
export function setBrowserOnline(vaerdi: boolean) {
	browserOnline = vaerdi;
}

/**
 * Kaldes af layoutet med Firestores eget svar: kom dataen fra serveren eller
 * fra den lokale kopi. Det er det taetteste vi kommer paa sandheden.
 */
export function setServerSvarer(vaerdi: boolean) {
	serverSvarer = vaerdi;
}

/**
 * Meldes af et gem-flow naar det saetter en skrivning i gang. Derefter
 * venter vi paa at Firestore kvitterer for ALT hvad der ligger i koe, ikke
 * kun denne ene skrivning, og slaar saa maerket fra igen.
 *
 * waitForPendingWrites afvises aldrig. Den venter bare, ogsaa henover en
 * genstart af appen, saa der er ingen fejl at fange.
 */
export function meldSkrivningIGang() {
	if (!browser) return;
	harUsendt = true;
	void waitForPendingWrites(db).then(() => {
		harUsendt = false;
		netopSendt = true;
		if (netopSendtTimer) clearTimeout(netopSendtTimer);
		netopSendtTimer = setTimeout(() => (netopSendt = false), 6000);
	});
}
