// ============================================================
// Alt hvad appen ved om ÉN kunde, samlet.
//
// Linns oenske 3. september 2026, tegnet i mockups-kunde-opslag.html.
// Foer den dag viste kunde-opslaget kun hendes traening.
//
// FILEN ER REN LOGIK OG LAESER INGENTING. Den faar det hentede ind og
// regner ud hvad der skal staa. Saa kan reglerne testes uden at spoerge
// databasen, og skaermen kan noejes med at tegne.
//
// DEN VIGTIGSTE DEL ER `springerIOejnene`. Den samler det der er GALT ét
// sted, i stedet for at Linn skal lede efter det paa syv faner. Hvert
// punkt paa den liste er noget der har kostet fejlsoegning foer:
// et hold uden traening giver "Din traening er paa vej", en kunde uden
// ja til beskeder kan ikke naas, og et udloeb om faa dage kommer bag paa
// alle.
//
// ER LISTEN TOM, SKAL DER STAA AT ALT SER FINT UD. En tom boks ligner en
// side der ikke virker.
// ============================================================

/** Ét maaltid, som det ligger i hendes dagbog. */
export interface MaaltidRaekke {
	dato: string;
	totalP?: number;
	totalF?: number;
}

export interface DagTal {
	dato: string;
	protein: number;
	fiber: number;
	ramteMaal: boolean;
}

export type Alvor = 'stop' | 'se' | 'ok';

export interface Opmaerksomhed {
	id: string;
	alvor: Alvor;
	tekst: string;
	/** Hvad Linn kan goere ved det. Tom naar der ikke er noget at goere. */
	hvad: string;
}

export interface KundeInput {
	harAktivtForlob: boolean;
	forlobNavn: string;
	/**
	 * Om der er traening at give hende paa hendes hold.
	 *
	 * DER ER TO STEDER AT KIGGE, og den 4. september kiggede jeg kun ét.
	 * 3.0 tildeler programmer i en liste for sig, mens et Kickstart- eller
	 * Kropsro-hold i den gamle app har programmerne liggende paa selve
	 * holdet, hvor kunden vaelger sin variant. Kun det foerste sted blev
	 * tjekket, saa alle kunder paa den gamle app fik "ingen traening
	 * tildelt" selvom deres hold havde begge programmer.
	 */
	holdHarTraening: boolean;
	/** Om hun kan se 3.0. */
	paaNyApp: boolean;
	/** Om hun har sagt ja til beskeder paa telefonen. */
	harSagtJaTilBeskeder: boolean;
	ubesvaredeSpoergsmaal: number;
	/** Dage siden hun sidst registrerede noget. Null naar hun aldrig har. */
	dageSidenAktiv: number | null;
	/**
	 * Om vi overhovedet FIK LOV at se hendes registreringer.
	 *
	 * VI MAA IKKE SIGE "ALDRIG" NAAR VI BARE IKKE KUNNE SE EFTER. Den 4.
	 * september stod der at Randi aldrig havde registreret noget, mens hun
	 * havde spist og tastet hele ugen. Opslaget blev afvist, og siden
	 * meldte det vaerste. En status om et menneske maa ikke gaette.
	 */
	aktivitetKendt: boolean;
	/** Hvornaar adgangen udloeber. Null er loebende. */
	adgangUdloeberOm: number | null;
	/** Om hun har gennemfoert opstarten i 3.0. */
	onboardet: boolean;
}

/** Hvor mange dage uden en registrering foer det er vaerd at naevne. */
export const STILLE_DAGE = 7;

/** Hvor faa dage der skal vaere tilbage foer et udloeb naevnes. */
export const UDLOEB_VARSEL = 14;

/**
 * Det der er galt, i den raekkefoelge Linn skal se det.
 *
 * 'stop' er noget der forhindrer kunden i at bruge appen. 'se' er noget
 * der boer ses paa. Rangordenen er bevidst: et hold uden traening staar
 * oeverst, fordi der ikke kommer nogen fejl naar det glemmes, der kommer
 * bare ingenting.
 */
export function springerIOejnene(i: KundeInput): Opmaerksomhed[] {
	const ud: Opmaerksomhed[] = [];

	if (i.harAktivtForlob && !i.holdHarTraening) {
		ud.push({
			id: 'ingen-traening',
			alvor: 'stop',
			tekst: 'Hendes hold har ikke fået tildelt træning',
			hvad: 'Hun ser "Din træning er på vej". Tildel programmet under Træning'
		});
	}

	if (i.ubesvaredeSpoergsmaal > 0) {
		ud.push({
			id: 'spoergsmaal',
			alvor: 'stop',
			tekst:
				i.ubesvaredeSpoergsmaal === 1
					? 'Hun venter på svar på et spørgsmål'
					: `Hun venter på svar på ${i.ubesvaredeSpoergsmaal} spørgsmål`,
			hvad: 'Svar under Beskeder'
		});
	}

	if (i.adgangUdloeberOm !== null && i.adgangUdloeberOm <= UDLOEB_VARSEL) {
		ud.push({
			id: 'udloeb',
			alvor: i.adgangUdloeberOm <= 0 ? 'stop' : 'se',
			tekst:
				i.adgangUdloeberOm <= 0
					? 'Hendes adgang er udløbet'
					: `Hendes adgang udløber om ${i.adgangUdloeberOm} ${i.adgangUdloeberOm === 1 ? 'dag' : 'dage'}`,
			hvad: 'Ret datoen under Abonnenter hvis hun skal fortsætte'
		});
	}

	if (!i.aktivitetKendt) {
		// Ingen paastand. Vi ved det ikke, og saa siger vi det.
		ud.push({
			id: 'ukendt-aktivitet',
			alvor: 'se',
			tekst: 'Vi kunne ikke se hvornår hun sidst var i appen',
			hvad: 'Det er ikke det samme som at hun ikke har været der'
		});
	} else if (i.dageSidenAktiv === null) {
		ud.push({
			id: 'aldrig',
			alvor: 'se',
			tekst: 'Hun har aldrig registreret noget i appen',
			hvad: 'Måske er hun ikke kommet i gang'
		});
	} else if (i.dageSidenAktiv >= STILLE_DAGE) {
		ud.push({
			id: 'stille',
			alvor: 'se',
			tekst: `Der er gået ${i.dageSidenAktiv} dage siden hun sidst registrerede noget`,
			hvad: 'Skriv til hende hvis det ikke ligner hende'
		});
	}

	// KUN PAA DEN NYE APP. Beskeder paa telefonen findes slet ikke i den
	// gamle, saa punktet var sandt for hver eneste kunde og betoed
	// ingenting. Opdaget 4. september, da alle 315 paa Kickstart August
	// stod som "kan ikke naas".
	if (i.paaNyApp && i.harAktivtForlob && !i.harSagtJaTilBeskeder) {
		ud.push({
			id: 'ingen-noti',
			alvor: 'se',
			tekst: 'Hun kan ikke nås på telefonen',
			hvad: 'Hun har ikke sagt ja til beskeder, eller appen ligger ikke på hjemmeskærmen'
		});
	}

	if (i.paaNyApp && !i.onboardet) {
		ud.push({
			id: 'ikke-onboardet',
			alvor: 'se',
			tekst: 'Hun har ikke gennemført opstarten i den nye app',
			hvad: 'Så ved appen ikke hvilket udstyr hun har, og hun ser alle programmer'
		});
	}

	return ud;
}

/** Mærkaterne i toppen. De fire spoergsmaal der oftest er svaret. */
export function maerkater(i: KundeInput): { tekst: string; alvor: Alvor }[] {
	const ud: { tekst: string; alvor: Alvor }[] = [];

	ud.push(
		i.harAktivtForlob
			? { tekst: i.forlobNavn, alvor: 'ok' }
			: { tekst: 'Intet aktivt forløb', alvor: 'se' }
	);

	if (!i.aktivitetKendt) ud.push({ tekst: 'Aktivitet ukendt', alvor: 'se' });
	else if (i.dageSidenAktiv === null) ud.push({ tekst: 'Aldrig været i gang', alvor: 'se' });
	else if (i.dageSidenAktiv === 0) ud.push({ tekst: 'Aktiv i dag', alvor: 'ok' });
	else if (i.dageSidenAktiv === 1) ud.push({ tekst: 'Aktiv i går', alvor: 'ok' });
	else ud.push({ tekst: `Sidst aktiv for ${i.dageSidenAktiv} dage siden`, alvor: i.dageSidenAktiv >= STILLE_DAGE ? 'se' : 'ok' });

	if (i.harAktivtForlob && !i.holdHarTraening) {
		ud.push({ tekst: 'Ingen træning tildelt', alvor: 'se' });
	}

	ud.push(i.paaNyApp ? { tekst: 'På den nye app', alvor: 'ok' } : { tekst: 'Ikke på 3.0', alvor: 'ok' });

	return ud;
}

/**
 * Hendes protein og fiber pr dag.
 *
 * KUN DE DAGE HUN HAR REGISTRERET faar en raekke. En dag uden noget er
 * ikke nul, den er en dag vi ikke ved noget om, og et nul ville se ud som
 * om hun ikke spiste. Skaermen tegner de manglende dage som tomme.
 */
export function dagensTal(
	maaltider: MaaltidRaekke[],
	maalProtein: number
): Map<string, DagTal> {
	const kort = new Map<string, DagTal>();
	for (const m of maaltider) {
		if (!m?.dato) continue;
		const d = kort.get(m.dato) ?? { dato: m.dato, protein: 0, fiber: 0, ramteMaal: false };
		d.protein += Number(m.totalP) || 0;
		d.fiber += Number(m.totalF) || 0;
		kort.set(m.dato, d);
	}
	for (const d of kort.values()) {
		d.protein = Math.round(d.protein);
		d.fiber = Math.round(d.fiber);
		d.ramteMaal = maalProtein > 0 && d.protein >= maalProtein;
	}
	return kort;
}

/** De sidste N dage som noegler, nyeste sidst. Til soejlerne. */
export function sidsteDage(antal: number, nu: number): string[] {
	const ud: string[] = [];
	for (let i = antal - 1; i >= 0; i--) {
		ud.push(new Date(nu - i * 86400000).toISOString().slice(0, 10));
	}
	return ud;
}

/**
 * Snittet pr dag hun HAR registreret.
 *
 * Linns regel fra Udvikling: en status maa aldrig laese som en anklage.
 * Der deles med de dage hun har tastet, ikke med alle dage, saa en uge
 * uden registrering ikke traekker hende ned. Se 9.26.
 */
export function snitPrRegistreretDag(dage: DagTal[]): { protein: number; fiber: number; antal: number } {
	if (dage.length === 0) return { protein: 0, fiber: 0, antal: 0 };
	return {
		protein: Math.round(dage.reduce((s, d) => s + d.protein, 0) / dage.length),
		fiber: Math.round(dage.reduce((s, d) => s + d.fiber, 0) / dage.length),
		antal: dage.length
	};
}


/**
 * Efternavnet, fundet hvor det nu staar.
 *
 * TO TREDJEDELE AF KUNDERNE HAR IKKE ET EFTERNAVN PAA KONTOEN. Maalt 4.
 * september 2026: 602 af 934 konti havde kun et fornavn, fordi feltet kun
 * bliver sat naar koebet fra Simplero havde det med. Navnet staar til
 * gengaeld naesten altid i koebslisten, og for 596 af de 602 er der et
 * efternavn at hente der.
 *
 * Uden det her finder en soegning paa efternavn kun hver tredje kunde, og
 * det ligner en soegning der er i stykker.
 *
 * KONTOENS EGET NAVN VINDER. Har hun selv rettet sit fornavn, er det
 * hendes. Listen fylder kun det tomme ud.
 */
export function navnMedListen(
	fornavn: string,
	efternavn: string,
	fraListen: string | undefined
): { fornavn: string; efternavn: string } {
	const f = (fornavn ?? '').trim();
	const e = (efternavn ?? '').trim();
	if (f && e) return { fornavn: f, efternavn: e };

	const dele = (fraListen ?? '').trim().split(/\s+/).filter(Boolean);
	if (dele.length === 0) return { fornavn: f, efternavn: e };

	return {
		fornavn: f || dele[0],
		efternavn: e || (dele.length > 1 ? dele.slice(1).join(' ') : '')
	};
}

/**
 * Det der soeges i. Baade kontoens navn, koebslistens navn og mailen, saa
 * et efternavn der kun staar ét af stederne stadig kan findes.
 */
export function soegeTekst(
	fornavn: string,
	efternavn: string,
	email: string,
	fraListen: string | undefined
): string {
	return [fornavn, efternavn, fraListen ?? '', email]
		.map((x) => (x ?? '').trim())
		.filter(Boolean)
		.join(' ');
}

/** Initialerne til feltet i toppen. */
export function initialer(fornavn: string, efternavn: string, email: string): string {
	const f = (fornavn ?? '').trim();
	const e = (efternavn ?? '').trim();
	if (f || e) return `${f.slice(0, 1)}${e.slice(0, 1)}`.toUpperCase();
	return (email ?? '?').slice(0, 2).toUpperCase();
}

/** Hele navnet, eller mailen hvis der ikke er et. */
export function fuldtNavn(fornavn: string, efternavn: string, email: string): string {
	const n = [fornavn, efternavn].map((x) => (x ?? '').trim()).filter(Boolean).join(' ');
	return n || email || '(uden navn)';
}

/** Dage mellem to tidspunkter, gulvet. Negativ bliver til nul. */
export function dageSiden(ms: number | null, nu: number): number | null {
	if (!ms || ms <= 0) return null;
	return Math.max(0, Math.floor((nu - ms) / 86400000));
}
