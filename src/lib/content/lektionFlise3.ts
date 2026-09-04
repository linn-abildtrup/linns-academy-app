// ============================================================
// Teksten paa en skriftlig lektions flise.
//
// Linn 4. september: en laesning uden billede blev til en lilla flade med
// en stjerne, og to helt forskellige lektioner lignede hinanden
// fuldstaendig. Flisen viser nu lektionens egen titel. 23 af de 42
// lektioner i Kickstart August har intet billede, saa det er ikke en
// enkelt flise. Se mockups-skriftlige-lektioner.html.
// ============================================================

/**
 * Titlen som den staar PAA flisen, uden "Dag 5, " foran.
 *
 * Dagnummeret staar allerede i overskriften over listen, og paa en flise
 * der er 140 px bred aeder det pladsen fra netop det der adskiller
 * lektionerne fra hinanden. I raekken ved siden af staar den fulde titel
 * uaendret, saa intet forsvinder.
 *
 * Den taaler de skilletegn Linn faktisk bruger, komma, kolon, punktum og
 * begge slags streger, og den er ligeglad med store og smaa bogstaver.
 * Bliver der ingenting tilbage, giver vi den fulde titel: en tom flise er
 * vaerre end en med et dagnummer paa.
 */
export function fliseTitel3(titel: string): string {
	const uden = titel.replace(/^\s*dag\s*\d+\s*[,:.–—-]\s*/i, '').trim();
	return uden || titel.trim();
}
