// ============================================================
// Henter et dokument udefra og serverer det fra VORES eget domaene, saa
// det kan vises inde i appen.
//
// HVORFOR DET FINDES. En PDF-lektion var den eneste type hvor siden ikke
// leverede sit indhold: kunden trykkede paa flisen, landede paa en side
// der bad hende trykke igen, og forlod saa appen. Linn 5. september.
// PDF'erne ligger paa Simplero og kan ikke vises i en ramme derfra, men
// en fil fra vores eget domaene kan.
//
// LAASEN LIGGER I content/dokument3.ts, saa den kan testes uden en
// server: kun https, kun kendte vaerter, kun .pdf.
//
// EN AERLIG AFVEJNING. Det her er en proxy, og en proxy kan misbruges til
// at traekke paa vores baandbredde. Tre ting holder den i kort snor:
//   1. Kun de faa vaerter Linns eget indhold ligger paa
//   2. Kun .pdf, og der er en stoerrelsesgraense
//   3. Svaret caches en time, saa den samme fil hentes én gang
//
// DER ER IKKE LOGIN PAA. En ramme kan ikke sende et login-bevis med, og
// dokumenterne ligger i forvejen aabent paa Simplero: vi udstiller altsaa
// ikke noget der var lukket foer. Skal det laases helt, er vejen at slaa
// lektionen op i Firestore i stedet for at tage en adresse imod, se
// server/firestoreRest.ts. Det er ikke gjort, fordi det koster et opslag
// paa hver hentning og ikke beskytter noget hemmeligt.
// ============================================================

import type { RequestHandler } from '@sveltejs/kit';
import { error } from '@sveltejs/kit';
import { maaHentes3, laesUdsnit3, DOKUMENT_MAKS_BYTE } from '$lib/content/dokument3';

/** En time. Den samme PDF hentes af mange kunder paa den samme dag. */
const CACHE_SEKUNDER = 3600;

export const GET: RequestHandler = async ({ url, fetch, request }) => {
	const kilde = url.searchParams.get('url') ?? '';

	const tjek = maaHentes3(kilde);
	if (!tjek.ok) {
		console.warn('[ny-dokument] afvist:', tjek.grund);
		// Kunden faar ikke at vide HVORFOR. Et praecist svar ville hjaelpe
		// den der proever sig frem.
		throw error(400, 'Dokumentet kan ikke vises');
	}

	let svar: Response;
	try {
		svar = await fetch(kilde, { headers: { Accept: 'application/pdf' } });
	} catch (e) {
		console.error('[ny-dokument] kunne ikke hentes', e);
		throw error(502, 'Dokumentet kunne ikke hentes lige nu');
	}

	if (!svar.ok) {
		console.warn('[ny-dokument] kilden svarede', svar.status);
		throw error(svar.status === 404 ? 404 : 502, 'Dokumentet kunne ikke hentes lige nu');
	}

	// Kilden skal ogsaa MENE at det er en pdf. Endelsen alene er ikke nok:
	// en fil kan hedde .pdf og indeholde noget helt andet.
	const type = svar.headers.get('content-type') ?? '';
	if (!type.toLowerCase().includes('pdf')) {
		console.warn('[ny-dokument] forkert type fra kilden:', type);
		throw error(415, 'Dokumentet kan ikke vises');
	}

	// HELE FILEN LAESES IND, og det er ikke af dovenskab.
	//
	// Simplero sender uden at oplyse hvor stor filen er. Browserens
	// PDF-laeser henter et dokument i bidder, og uden en stoerrelse ved den
	// ikke hvad den skal bede om: vaerktoejslinjen kom frem og sagde
	// "1 / 2", men selve siden blev sort. Set i browseren 5. september,
	// efter at have bekraeftet at filen kom korrekt igennem.
	//
	// Ved at laese hele filen ind kan vi selv oplyse stoerrelsen, og saa
	// tegner laeseren den. 25 MB-graensen holder hukommelsen i skak.
	const data = await svar.arrayBuffer();
	if (data.byteLength > DOKUMENT_MAKS_BYTE) {
		console.warn('[ny-dokument] for stort:', data.byteLength);
		throw error(413, 'Dokumentet er for stort til at vises her');
	}

	const faelles = {
		'Content-Type': 'application/pdf',
		// inline, saa den VISES i rammen i stedet for at blive hentet ned.
		'Content-Disposition': 'inline',
		'Cache-Control': `public, max-age=${CACHE_SEKUNDER}`,
		// SIGER AT VI KAN SENDE ET UDSNIT. Uden den spoerger
		// PDF-laeseren slet ikke, og saa tegner den ingenting.
		'Accept-Ranges': 'bytes',
		// Kun vores egen app maa laegge den i en ramme.
		'X-Frame-Options': 'SAMEORIGIN',
		'X-Content-Type-Options': 'nosniff'
	};

	// ET UDSNIT, HVIS DEN BEDER OM DET.
	//
	// Browserens PDF-laeser henter en pdf i bidder: foerst de sidste byte,
	// hvor indholdsfortegnelsen staar, og saa en side ad gangen. Svarer vi
	// altid med hele filen, kommer vaerktoejslinjen frem og siger "1 / 2",
	// men siderne bliver sorte. Det var den rigtige aarsag, efter to
	// forkerte gaet: foerst troede jeg det var hentningen, saa at det var
	// den manglende stoerrelse.
	const udsnit = laesUdsnit3(request.headers.get('range'), data.byteLength);
	if (udsnit) {
		const del = data.slice(udsnit.fra, udsnit.til + 1);
		return new Response(del, {
			status: 206,
			headers: {
				...faelles,
				'Content-Length': String(del.byteLength),
				'Content-Range': `bytes ${udsnit.fra}-${udsnit.til}/${data.byteLength}`
			}
		});
	}

	return new Response(data, {
		headers: { ...faelles, 'Content-Length': String(data.byteLength) }
	});
};
