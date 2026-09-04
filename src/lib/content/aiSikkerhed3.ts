// ============================================================
// Linjen under et AI-svar, der siger hvor tæt svaret er paa Linns eget.
//
// LINNS BESLUTNING 4. september: 3.0 skal sige det samme som den gamle
// app. De 925 kunder dér har set procenten hele tiden, og de to flader
// maa ikke sige hver sit. Foer stod der i 3.0 at kunden ALDRIG saa
// tallet, og den regel er nu omgjort.
//
// TALLET MAALER LINNS EGNE SVAR og ikke om AI'en har ret. 100 betyder at
// der fandtes et taet matchende svar fra Linn i forvejen. Et lavt tal
// betyder at modellen maatte gaette eller bruge almen viden. Ordlyden
// skal derfor blive ved med at handle om "som Linn ville svare", ikke om
// rigtigt og forkert.
//
// TALLET MANGLER I KNAP HVERT TIENDE SVAR, fordi modellen glemmer at
// saette markoeren paa, eller fordi svaret blev klippet. Foer stod der
// saa ingenting, og et svar UDEN linje saa mere sikkert ud end et med.
// Derfor siges det med ord i stedet.
// ============================================================

/** Under det her er svaret usikkert. Samme tal som api/ny-ai bruger. */
export const USIKKER_UNDER_3 = 60;

export interface SikkerhedsLinje3 {
	/** Er det den forsigtige udgave. Styrer farve og ikon. */
	lav: boolean;
	/** Teksten som kunden laeser den. */
	tekst: string;
}

/**
 * Linjen der staar under svaret.
 *
 * `kanSpoergeLinn` styrer om vi maa henvise videre. Har hun ikke adgang
 * til at skrive til Linn, ville "spørg Linn" pege paa en doer der ikke
 * findes. Samme hensyn som i den gamle app.
 */
export function sikkerhedsLinje3(
	sikkerhed: number | null | undefined,
	kanSpoergeLinn: boolean
): SikkerhedsLinje3 {
	if (sikkerhed === null || sikkerhed === undefined) {
		return {
			lav: true,
			tekst:
				'Jeg kan ikke måle hvor tæt det her er på Linns eget svar' +
				(kanSpoergeLinn ? ' — spørg Linn hvis det er vigtigt' : '')
		};
	}

	// Et tal uden for 0 til 100 er noget modellen har fundet paa. Vi
	// klipper det paa plads frem for at vise "137 % sikker".
	const n = Math.round(Math.min(100, Math.max(0, sikkerhed)));
	const lav = n < USIKKER_UNDER_3;
	return {
		lav,
		tekst:
			`${n} % sikker på at dette er som Linn ville svare` +
			(lav && kanSpoergeLinn ? ' — overvej at spørge Linn' : '')
	};
}
