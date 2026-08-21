// Kundens fremgang i et traeningsprogram. Bid 3, 15. august 2026.
//
// DET HEDDER TRAENING, IKKE DAG. Linns rettelse 15. august, og den er
// vigtigere end den lyder. Programmets numre rykker kun naar hun har
// traenet, saa "Dag 5" ville lyde som om hun er bagud efter en uges
// pause. Det er hun ikke, hun har bare traenet fire gange.
//
// Ordet dag er dermed frigjort til dét det faktisk betyder: en
// kalenderdag i et forloeb, som naar en tildeling gaelder fra dag 15.
// De to blev foer skrevet ens og betoed noget forskelligt.
//
// FREMGANGEN LIGGER PR PROGRAM, i users/{uid}/traeningFremgang3/{id}.
// Derfor kan hun skifte mellem programmer uden at miste noget, og
// derfor overlever fremgangen at et program bliver taget fra hende.

import type { Traeningsprogram3 } from './traeningsprogram3';

export interface Traeningsfremgang3 {
	programId: string;
	/**
	 * Numrene paa de traeninger hun har klaret I DEN RUNDE HUN ER I GANG
	 * MED. Ikke gennem alle runder. Starter hun forfra, toemmes listen.
	 */
	gennemfoerte: number[];
	/** Unix-ms for den senest gennemfoerte traening. 0 = aldrig traenet. */
	senestAt: number;
	/**
	 * Hvilken gang hun er igennem programmet. 1 foerste gang.
	 *
	 * KOM TIL 20. august 2026, og den rettede en fejl der ville have ramt
	 * den foerste kunde der gennemfoerte et program. Foer stod ALLE
	 * gennemfoerte numre paa listen for altid, og naar programmet skulle
	 * loope, sagde appen "din naeste er nummer 1". Nummer 1 stod allerede
	 * paa listen, saa der skete ingenting, og hun sad fast paa 1.
	 *
	 * Gamle dokumenter har ikke feltet. De laeses som runde 1.
	 */
	runde: number;
}

export function tomFremgang3(programId: string): Traeningsfremgang3 {
	return { programId, gennemfoerte: [], senestAt: 0, runde: 1 };
}

/** Runden, med gamle dokumenter uden feltet laest som den foerste. */
export function runde3(fremgang: Traeningsfremgang3): number {
	return fremgang.runde >= 1 ? fremgang.runde : 1;
}

/** "2. gang igennem". Tom foerste gang, hvor der ikke er noget at sige. */
export function rundeTekst3(fremgang: Traeningsfremgang3): string {
	const n = runde3(fremgang);
	return n <= 1 ? '' : `${n}. gang igennem`;
}

/** Kun de numre der findes i programmet. Bliver et program kortere, skal
 *  gamle numre ikke taelle med i "hvor langt er jeg". */
function indenfor(fremgang: Traeningsfremgang3, antal: number): number[] {
	return fremgang.gennemfoerte.filter((n) => n >= 1 && n <= antal);
}

export function antalKlaret3(fremgang: Traeningsfremgang3, antal: number): number {
	return new Set(indenfor(fremgang, antal)).size;
}

export function erFaerdig3(fremgang: Traeningsfremgang3, antal: number): boolean {
	return antal > 0 && antalKlaret3(fremgang, antal) >= antal;
}

export function erIGang3(fremgang: Traeningsfremgang3, antal: number): boolean {
	const klaret = antalKlaret3(fremgang, antal);
	return klaret > 0 && klaret < antal;
}

/**
 * Den traening hun skal tage nu: den laveste hun ikke har klaret i den
 * runde hun er i gang med.
 *
 * NULL NAAR RUNDEN ER KOERT IGENNEM, ogsaa paa et program der looper.
 * Foer gav den 1 igen med det samme, og det var baade en fejl, se
 * kommentaren ved runde-feltet, og forkert over for kunden: at blive sat
 * tilbage paa nummer 1 uden at have sagt ja foeles som om appen ikke har
 * opdaget at man er faerdig. Linns beslutning 20. august: hun skal
 * spoerges. Se maaTilbydesNyRunde3.
 */
export function naesteTraening3(fremgang: Traeningsfremgang3, antal: number): number | null {
	if (antal <= 0) return null;
	const klaret = new Set(indenfor(fremgang, antal));
	for (let nr = 1; nr <= antal; nr++) {
		if (!klaret.has(nr)) return nr;
	}
	return null;
}

/**
 * Skal hun tilbydes at tage programmet en gang til.
 *
 * Kun naar runden er koert igennem OG programmet er sat til at starte
 * forfra. Fluebenet staar paa hvert program i admin.
 */
export function maaTilbydesNyRunde3(
	fremgang: Traeningsfremgang3,
	program: Pick<Traeningsprogram3, 'antalDage' | 'starterForfra'>
): boolean {
	return erFaerdig3(fremgang, program.antalDage) && program.starterForfra === true;
}

/**
 * Fremgangen som den ser ud naar hun siger ja til en runde mere.
 *
 * Listen toemmes, saa gitteret staar blegt igen og hun kan se sig
 * igennem. Linns beslutning 20. august: bliver felterne groenne, ser
 * skaermen ud som om der ikke er mere at lave.
 *
 * Historikken gaar ikke tabt. Hver gennemfoert traening logges separat i
 * traeningHistorik, og den roeres ikke her.
 */
export function naesteRunde3(fremgang: Traeningsfremgang3): Traeningsfremgang3 {
	return { ...fremgang, gennemfoerte: [], runde: runde3(fremgang) + 1 };
}

export function procentKlaret3(fremgang: Traeningsfremgang3, antal: number): number {
	if (antal <= 0) return 0;
	return Math.round((antalKlaret3(fremgang, antal) / antal) * 100);
}

export type Traeningstilstand3 = 'klaret' | 'naeste' | 'venter';

export function traeningstilstand3(
	nr: number,
	fremgang: Traeningsfremgang3,
	naeste: number | null
): Traeningstilstand3 {
	if (fremgang.gennemfoerte.includes(nr)) return 'klaret';
	if (nr === naeste) return 'naeste';
	return 'venter';
}

/**
 * Hvor mange traeninger programmet har.
 *
 * Feltet hedder stadig antalDage i databasen, fra dengang de hed dage.
 * Det bliver staaende, for et navneskift ville kraeve en migrering af
 * data uden at kunden fik noget ud af det. Brug den her i stedet for at
 * skrive antalDage i UI-kode, saa ordet dag ikke sniger sig tilbage.
 */
export function antalTraeninger3(program: Pick<Traeningsprogram3, 'antalDage'>): number {
	return program.antalDage;
}

/**
 * Maa hun aabne den her traening.
 *
 * Nej frem, ja tilbage. Linns valg 15. august. Hun kan altid tage en
 * traening om, men hun kan ikke springe over. Ellers betyder "hvor langt
 * er jeg" ingenting.
 */
export function maaAabnes3(
	nr: number,
	fremgang: Traeningsfremgang3,
	naeste: number | null
): boolean {
	return traeningstilstand3(nr, fremgang, naeste) !== 'venter';
}

// ── Raekkefoelgen paa hendes liste ──────────────────────────────

export interface KundeProgram3 {
	program: Traeningsprogram3;
	fremgang: Traeningsfremgang3;
	klaret: number;
	naeste: number | null;
	procent: number;
	iGang: boolean;
	faerdig: boolean;
}

/**
 * Hendes programmer i den raekkefoelge Linn godkendte 15. august:
 * i gang foerst, saa dem hun ikke er begyndt paa, saa dem hun har gjort
 * faerdige.
 *
 * Inden for "i gang" staar den hun sidst traenede oeverst. Det er
 * meningen med den gruppe: at hun kan fortsaette uden at lede.
 * De to andre grupper er alfabetiske.
 */
export function kundeProgrammer3(
	programmer: Traeningsprogram3[],
	fremgangPrProgram: Map<string, Traeningsfremgang3>
): KundeProgram3[] {
	const beriget: KundeProgram3[] = programmer.map((program) => {
		const fremgang = fremgangPrProgram.get(program.id) ?? tomFremgang3(program.id);
		return {
			program,
			fremgang,
			klaret: antalKlaret3(fremgang, program.antalDage),
			naeste: naesteTraening3(fremgang, program.antalDage),
			procent: procentKlaret3(fremgang, program.antalDage),
			iGang: erIGang3(fremgang, program.antalDage),
			faerdig: erFaerdig3(fremgang, program.antalDage)
		};
	});

	const vaegt = (k: KundeProgram3) => (k.iGang ? 0 : k.faerdig ? 2 : 1);

	return beriget.sort((a, b) => {
		const forskel = vaegt(a) - vaegt(b);
		if (forskel !== 0) return forskel;
		if (vaegt(a) === 0) return b.fremgang.senestAt - a.fremgang.senestAt;
		return a.program.navn.localeCompare(b.program.navn, 'da');
	});
}

/** Den hun sidst traenede, hvis hun er i gang med noget. */
export function iGangMed3(liste: KundeProgram3[]): KundeProgram3 | null {
	return liste.find((k) => k.iGang) ?? null;
}

/**
 * Linjen under programmets navn paa hendes liste.
 *
 * SKRIVER IKKE ANTALLET NAAR HUN IKKE ER BEGYNDT. Raekken saetter den
 * sammen med kategorien og antallet foran, og saa stod der
 * "Uden redskaber · 42 træninger · 42 træninger · ikke begyndt".
 * Set paa Linns skaermbillede 21. august. Den kunne ikke ses foer, fordi
 * den kun rammer et program hun ikke er begyndt paa, og ingen havde to
 * programmer at vaelge imellem.
 *
 * Lille begyndelsesbogstav, fordi den ALTID staar efter noget andet.
 */
export function fremgangTekst3(k: KundeProgram3): string {
	const i_alt = k.program.antalDage;
	if (k.faerdig && k.klaret >= i_alt) return 'du er igennem';
	if (k.klaret === 0) return 'ikke begyndt';
	return `træning ${k.naeste ?? i_alt} af ${i_alt}`;
}

/**
 * "11 træninger klaret". Staar paa det moerke kort ved siden af knappen.
 *
 * Kortet siger i forvejen "Træning 12 af 42" ovenover, saa den her skal
 * sige noget ANDET, nemlig hvor meget hun har lagt bag sig.
 */
export function klaretTekst3(k: KundeProgram3): string {
	return k.klaret === 1 ? '1 træning klaret' : `${k.klaret} træninger klaret`;
}
