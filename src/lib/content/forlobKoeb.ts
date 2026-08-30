// ============================================================
// Hvilket hold skal et nyt Simplero-koeb lande paa.
//
// HVORFOR. Linn saelger hvert nyt Kickstart-hold under det SAMME produkt i
// Simplero. Produkt 253807 har 859 koeb bag sig og har vaeret alle hold.
// Derfor kan koblingen ikke staa i koden som "produkt X betyder hold Y" —
// den ville vaere forkert igen om to maaneder.
//
// I stedet staar Simplero-nummeret paa selve holdet, og fluebenet "Aktivt
// forloeb" afgoer hvilket hold der tager imod nye koeb. Naar Linn aabner et
// nyt hold, flytter hun fluebenet, og koeberne foelger med. Ingen kode.
// Linns beslutning 30. august 2026.
//
// FEJLER VI, SKAL VI FEJLE SYNLIGT. Lander en kunde paa et forkert hold, faar
// hun forkerte datoer og forkert materiale, og ingen opdager det. Lander hun
// slet ikke, staar der "skipped" i webhook-loggen, og Linn tilfoejer hende i
// haanden praecis som i dag. Derfor siger vi hellere nej end maaske.
// ============================================================

/** Et hold der har det koebte Simplero-produkt staaende paa sig. */
export interface ForlobKandidat {
	id: string;
	navn?: string;
	/** forlob.aktiv. Kun et aktivt hold tager imod nye koeb. */
	aktiv?: boolean;
	/** Millisekunder. 0 naar startdatoen mangler. */
	startMs: number;
	antalDage: number;
}

export interface ForlobValg {
	valgt: ForlobKandidat | null;
	/** Kort forklaring til webhook-loggen. Skal kunne laeses af Linn. */
	begrundelse: string;
}

/**
 * Er holdet slut. Et hold der er loebet ud maa ALDRIG tage imod nye koeb,
 * heller ikke selv om fluebenet ved en fejl staar tilbage paa det. Kunden
 * ville faa en udloebsdato i fortiden og ingen adgang.
 *
 * Samme regnestykke som forlobSlutMs, men holdt her uden import, saa filen
 * er ren logik og kan testes alene.
 */
function erSluttet(k: ForlobKandidat, nu: number): boolean {
	if (k.startMs <= 0 || k.antalDage <= 0) return false;
	const slut = k.startMs + (k.antalDage + 1) * 24 * 60 * 60 * 1000;
	return nu > slut;
}

/**
 * Vaelger holdet. Null naar ingen af dem duer, og saa siger begrundelsen
 * hvorfor.
 *
 * Er der ved en fejl flere aktive hold paa samme produkt, vinder det med den
 * seneste startdato. Det er naesten altid det nye hold, altsaa det Linn var i
 * gang med at aabne da hun glemte at fjerne fluebenet paa det gamle.
 */
export function vaelgForlobForProdukt(
	kandidater: ForlobKandidat[],
	nu: number = Date.now()
): ForlobValg {
	if (kandidater.length === 0) {
		return { valgt: null, begrundelse: 'intet hold har det produktnummer staaende' };
	}

	const aktive = kandidater.filter((k) => k.aktiv === true);
	if (aktive.length === 0) {
		return {
			valgt: null,
			begrundelse: `${kandidater.length} hold har nummeret, men ingen af dem er sat som aktivt forloeb`
		};
	}

	const iGang = aktive.filter((k) => !erSluttet(k, nu));
	if (iGang.length === 0) {
		return {
			valgt: null,
			begrundelse: 'det aktive hold er allerede slut, saa fluebenet skal flyttes til det nye'
		};
	}

	const sorteret = [...iGang].sort((a, b) => b.startMs - a.startMs);
	const valgt = sorteret[0];
	const begrundelse =
		sorteret.length > 1
			? `${sorteret.length} aktive hold paa samme nummer, valgte det nyeste (${valgt.navn ?? valgt.id})`
			: `hold ${valgt.navn ?? valgt.id}`;
	return { valgt, begrundelse };
}
