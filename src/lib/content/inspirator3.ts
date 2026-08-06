// ============================================================
// Inspiratoren i Linns Academy 3.0.
//
// Et lille kort under Dit overskud, der melder sig naar kunden har
// vaeret vaek et stykke tid, eller naar hendes overskud falder to
// maalinger i traek.
//
// TONEN ER HELE POINTEN. Maalgruppen har rigeligt daarlig samvittighed
// om sundhed i forvejen, og skam er den hurtigste vej ud af en app.
// Derfor: fravaeret naevnes aldrig som en anklage, og der slutter altid
// med én lille konkret ting hun kan goere nu.
//
// Rene funktioner uden Firestore og uden AI, saa hver regel kan testes.
// Selve teksten skrives af AI'en ud fra de fakta vi udleder her.
// ============================================================

/** Hvad kortet handler om. Bestemmer hvilken slags tekst AI'en skal skrive. */
export type Situation =
	| 'vaek-kort' // 3 til 6 dage
	| 'vaek-laenge' // 7 til 20 dage
	| 'vaek-meget' // 21 dage eller mere
	| 'overskud-falder'; // aktiv, men to maalinger nedad

/** De tal AI'en faar at vide. Kun fakta, aldrig gaet. */
export interface Fakta {
	situation: Situation;
	dageSidenAktiv: number;
	/** Nyeste maaling af Dit overskud, 1-10. null hvis hun aldrig har maalt. */
	overskudNu: number | null;
	/** Hendes allerfoerste maaling. Til at vise hvor langt hun er kommet. */
	overskudStart: number | null;
	/** Faldet over de seneste to maalinger. Kun sat ved overskud-falder. */
	fald: number | null;
	/** Hvad hun selv har valgt at oeve sig paa. AI'en maa foreslaa ét af dem. */
	smaaSkridt: string[];
	/** Forloebets navn hvis hun er paa et, ellers null. */
	forlobNavn: string | null;
	dagNummer: number | null;
}

export interface Grundlag {
	/** Dage siden hun sidst gjorde noget som helst. 0 = i dag. */
	dageSidenAktiv: number;
	/** Alle maalinger af Dit overskud, aeldste foerst. */
	maalinger: Array<{ ms: number; vaerdi: number }>;
	smaaSkridt: string[];
	forlobNavn: string | null;
	dagNummer: number | null;
	/** Har hun allerede gjort noget i dag. Saa skal vi ikke blande os. */
	harGjortNogetIDag: boolean;
	/** Datoen hun sagde "ikke nu" (YYYY-MM-DD), hvis hun gjorde. */
	afvistDato: string | null;
	iDag: string;
}

const VAEK_KORT = 3;
const VAEK_LAENGE = 7;
const VAEK_MEGET = 21;

/**
 * Afgoer om kortet skal vises, og hvad det skal handle om.
 *
 * Returnerer null naar vi skal lade hende vaere i fred. Det er det
 * normale svar, og det skal det vaere.
 */
export function vurderInspirator(g: Grundlag): Fakta | null {
	// Har hun sagt "ikke nu", eller har hun allerede snakket med AI'en om
	// det, er vi stille resten af dagen.
	if (g.afvistDato === g.iDag) return null;

	const nyeste = g.maalinger.length ? g.maalinger[g.maalinger.length - 1] : null;
	const foerste = g.maalinger.length ? g.maalinger[0] : null;

	const basis = {
		overskudNu: nyeste?.vaerdi ?? null,
		overskudStart: foerste?.vaerdi ?? null,
		smaaSkridt: g.smaaSkridt,
		forlobNavn: g.forlobNavn,
		dagNummer: g.dagNummer,
		dageSidenAktiv: g.dageSidenAktiv
	};

	// Falder overskuddet mens hun ER aktiv, er det vigtigere end alt
	// andet. Det handler ikke om at goere mere, men om hvordan hun har det.
	if (g.dageSidenAktiv < VAEK_KORT && g.maalinger.length >= 3) {
		const [a, b, c] = g.maalinger.slice(-3);
		if (c.vaerdi < b.vaerdi && b.vaerdi < a.vaerdi) {
			return {
				...basis,
				situation: 'overskud-falder',
				fald: Math.round((a.vaerdi - c.vaerdi) * 10) / 10
			};
		}
	}

	// De tre fravaers-situationer handler om at komme i gang igen. Er hun
	// allerede i gang i dag, giver det ingen mening at byde hende velkommen
	// tilbage. Faldet ovenfor gaelder derimod uanset, for det handler om
	// hvordan hun har det, ikke om dagens opgaver er krydset af.
	if (g.harGjortNogetIDag) return null;

	if (g.dageSidenAktiv >= VAEK_MEGET) return { ...basis, situation: 'vaek-meget', fald: null };
	if (g.dageSidenAktiv >= VAEK_LAENGE) return { ...basis, situation: 'vaek-laenge', fald: null };
	if (g.dageSidenAktiv >= VAEK_KORT) return { ...basis, situation: 'vaek-kort', fald: null };

	return null;
}

/**
 * Hvad AI'en faar at vide om situationen. Holdes adskilt fra selve
 * prompten, saa teksterne kan justeres uden at roere reglerne.
 */
export const SITUATION_BESKRIVELSE: Record<Situation, string> = {
	'vaek-kort':
		'Hun har ikke vaeret i appen i nogle faa dage. Byd hende velkommen tilbage uden at naevne hvor mange dage der er gaaet. Foreslaa ét lille skridt.',
	'vaek-laenge':
		'Hun har ikke vaeret her i over en uge. Vaer varm og helt uden bebrejdelse. Goer det saa nemt som muligt at komme i gang igen, med én enkelt ting.',
	'vaek-meget':
		'Hun har ikke vaeret her i over tre uger. Antag at livet er kommet i vejen, og at det er helt i orden. Tilbyd en frisk start med én lille ting, og mind hende om at hendes data stadig er her.',
	'overskud-falder':
		'Hun er aktiv, men hendes overskud er faldet tre maalinger i traek. Dette handler IKKE om at goere mere. Anerkend at det kan vaere en haard periode, og foreslaa noget der giver ro frem for praestation.'
};

/** Systemets regler for hvad AI'en aldrig maa. Sendes med hver gang. */
export const INSPIRATOR_REGLER = `Du skriver en kort besked til en kvinde i overgangsalderen, som bruger Linns Academy.

UFRAVIGELIGE REGLER:
- Hoejst to saetninger. Skriv paa dansk, i du-form.
- Naevn ALDRIG hvor mange dage hun har vaeret vaek. Ingen bebrejdelse, ingen "husk", ingen "kom nu", ingen udraabstegn.
- Ingen sundhedsraad, ingen diagnoser, intet om medicin, intet om vaegt.
- Opfind ALDRIG tal eller fakta. Brug kun det du faar oplyst.
- Slut altid med én lille konkret ting hun kan goere nu, og tag den gerne fra hendes egne smaa skridt.
- Skriv varmt og roligt, som en klog veninde. Ikke som en coach og ikke som en app.`;
