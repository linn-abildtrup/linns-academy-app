// ============================================================
// At sige ja til beskeder, set fra telefonen.
//
// TRE TING SKAL VAERE PAA PLADS, og de fejler hver sin vej:
//
//  1. Appen skal vaere lagt paa hjemmeskaermen. Paa iPhone er det Apples
//     regel, og der er ingen vej udenom. Vi spoerger ikke foer den er
//     paa plads, for et ja ville alligevel ikke virke.
//  2. Hun skal sige ja i telefonens egen boks. VI FAAR ÉT FORSOEG. Siger
//     hun nej, kan vi ikke spoerge igen, og det er telefonen der
//     bestemmer det. Derfor spoerger appen selv foerst, med vores ord.
//  3. Telefonen giver os en adresse, som vi gemmer.
//
// Bygget 23. august 2026, se HANDOVER 9.39.
// ============================================================

import { browser } from '$app/environment';
import { gemTelefon3 } from '$lib/firestore/notifikation3';

/**
 * Vores offentlige noegle. Den maa godt staa i klarteksten: den er
 * lavet til at blive delt, og den er ubrugelig uden den private, som
 * kun ligger paa serveren. Se server/webPush.ts.
 */
export const NOTI_NOEGLE3 =
	'BI3gpZY6S_e8yxvfjIzcs-jjt0kXCyicLwp75jTOHpxrvHyX1pLBcpuD7rJb6EaF41EsQh3LdvvqHMl4DQPOpF0';

/** Hvor langt hun er. Styrer hvad opstarten viser. */
export type NotiTilstand3 =
	| 'kan-ikke' // telefonen kan slet ikke, fx en gammel browser
	| 'ikke-hjemmeskaerm' // skal laegges paa hjemmeskaermen foerst
	| 'ikke-spurgt' // klar til at blive spurgt
	| 'sagt-ja'
	| 'sagt-nej'; // og saa kan vi ikke spoerge igen

/** Er appen aabnet fra hjemmeskaermen og ikke inde i browseren. */
export function paaHjemmeskaerm3(): boolean {
	if (!browser) return false;
	// Den foerste virker alle steder. Den anden er Safaris egen, som
	// iPhone brugte foer standarden kom, og den skal blive staaende.
	const svarer = window.matchMedia?.('(display-mode: standalone)').matches ?? false;
	const safari = (window.navigator as { standalone?: boolean }).standalone === true;
	return svarer || safari;
}

/** Kan telefonen overhovedet tage imod beskeder. */
export function kanFaaBeskeder3(): boolean {
	return (
		browser &&
		'serviceWorker' in navigator &&
		'PushManager' in window &&
		typeof Notification !== 'undefined'
	);
}

export function notiTilstand3(): NotiTilstand3 {
	if (!kanFaaBeskeder3()) return 'kan-ikke';
	if (Notification.permission === 'granted') return 'sagt-ja';
	if (Notification.permission === 'denied') return 'sagt-nej';
	// Rækkefoelgen er med vilje: har hun allerede sagt ja i browseren,
	// skal vi ikke sende hende ud i en hjemmeskaerms-vejledning.
	if (!paaHjemmeskaerm3()) return 'ikke-hjemmeskaerm';
	return 'ikke-spurgt';
}

/**
 * Spoerger om lov og gemmer telefonen.
 *
 * SKAL KALDES DIREKTE FRA ET TRYK. Browseren afviser boksen hvis den
 * kommer af sig selv, og saa taeller det som et nej vi ikke kan lave om.
 */
export async function sigJaTilBeskeder3(
	uid: string
): Promise<{ ok: true } | { ok: false; grund: NotiTilstand3 | 'fejl' }> {
	if (!kanFaaBeskeder3()) return { ok: false, grund: 'kan-ikke' };

	try {
		const svar = await Notification.requestPermission();
		if (svar !== 'granted') return { ok: false, grund: 'sagt-nej' };

		const reg = await navigator.serviceWorker.ready;
		// Har hun sagt ja foer paa den her telefon, faar vi den samme
		// tilbage, og saa er der ikke sket noget nyt.
		const eksisterende = await reg.pushManager.getSubscription();
		const tilmelding =
			eksisterende ??
			(await reg.pushManager.subscribe({
				// Telefonen kraever at hver besked bliver VIST. Vi maa ikke
				// sende noget lydloest, og det er en god regel.
				userVisibleOnly: true,
				applicationServerKey: NOTI_NOEGLE3
			}));

		const raa = tilmelding.toJSON() as { endpoint?: string; keys?: Record<string, string> };
		if (!raa.endpoint || !raa.keys?.p256dh || !raa.keys?.auth) return { ok: false, grund: 'fejl' };

		await gemTelefon3(uid, {
			endpoint: raa.endpoint,
			p256dh: raa.keys.p256dh,
			auth: raa.keys.auth
		});
		return { ok: true };
	} catch (e) {
		console.error('[noti] kunne ikke tilmelde telefonen', e);
		return { ok: false, grund: 'fejl' };
	}
}

/** Vejledningen. Den ene halvdel afhaenger af hvilken telefon hun har. */
export function hjemmeskaermTrin3(): { trin: string[]; note: string } {
	const erApple = browser && /iphone|ipad|ipod/i.test(navigator.userAgent);
	if (erApple) {
		return {
			trin: [
				'Tryk på Del-knappen nederst i Safari',
				'Rul ned og vælg "Føj til hjemmeskærm"',
				'Tryk Tilføj. Nu ligger den som en app'
			],
			note: 'Åbn så appen fra det nye ikon, så fortsætter vi hvor vi slap.'
		};
	}
	return {
		trin: [
			'Tryk på menuen med de tre prikker',
			'Vælg "Installer app" eller "Føj til startskærm"',
			'Bekræft. Nu ligger den som en app'
		],
		note: 'Åbn så appen fra det nye ikon, så fortsætter vi hvor vi slap.'
	};
}
