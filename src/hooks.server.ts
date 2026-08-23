// ============================================================
// 3.0 skal have sit EGET ikon paa hjemmeskaermen.
//
// HVORFOR FILEN FINDES. Telefonen laeser ét sted hvad appen hedder og
// hvor ikonet aabner. Der stod /app, altsaa den gamle app, saa uanset
// hvor man stod naar man lagde appen paa hjemmeskaermen, aabnede ikonet
// den gamle. Linn opdagede det 23. august 2026, se HANDOVER 9.40.
//
// LINN BRUGER BEGGE APPER. Derfor skifter vi ikke den gamle ud: hun skal
// have TO ikoner der kan kendes fra hinanden. Det gamle hedder stadig
// "Linn's Academy" og aabner /app. Det nye hedder "Linn's 3.0" og aabner
// /ny. De 760 kunder i drift maerker ingenting: deres ikon ligger der
// allerede, og telefonen husker adressen fra den dag de lagde det paa.
//
// DEN HER FIL LIGGER I VEJEN FOR ALLE SIDER, ogsaa den gamle apps. Den
// goer derfor kun ÉN ting, og kun paa /ny: bytter linjen om hvor ikonets
// navn og adresse staar. Alt andet gaar igennem uroert.
//
// Linns ja 23. august, efter at have faaet forelagt netop det.
// ============================================================

import type { Handle } from '@sveltejs/kit';

const GAMMEL = '/manifest.webmanifest';
const NY = '/manifest-ny.webmanifest';

// iPhone laeser IKKE navnet fra filen. Den bruger den her linje, og den
// vinder over alt andet. Uden den ville begge ikoner hedde det samme paa
// hjemmeskaermen, og saa kunne Linn ikke kende dem fra hinanden.
const TITEL_GAMMEL = '<meta name="apple-mobile-web-app-title" content="Linn\'s Academy" />';
const TITEL_NY = '<meta name="apple-mobile-web-app-title" content="Linn\'s 3.0" />';

export const handle: Handle = async ({ event, resolve }) => {
	const erNy = event.url.pathname === '/ny' || event.url.pathname.startsWith('/ny/');
	if (!erNy) return resolve(event);

	return resolve(event, {
		transformPageChunk: ({ html }) =>
			html.replace(`href="${GAMMEL}"`, `href="${NY}"`).replace(TITEL_GAMMEL, TITEL_NY)
	});
};
