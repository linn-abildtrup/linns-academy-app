// ============================================================
// Hvilket traeningsprogram hun FOELGER.
//
// HVORFOR DEN FINDES. Foer 21. august 2026 fandtes valget slet ikke. Der
// stod ordret i traeningens forside: "Der er ikke noget gemt valg: hun
// vaelger ved at begynde." Appen regnede ud hvad hun fulgte ved at se
// hvilket program hun SENEST havde traenet i.
//
// Det holdt saa laenge ingen havde mere end ét program. I det oejeblik
// Linn tildelte Kickstart til en kunde der allerede havde traenet i
// Kettle, kunne hun ikke skifte: forsiden blev ved med at vise Kettle,
// indtil hun startede en traening i det nye, og saa var valget allerede
// truffet uden at hun var blevet spurgt.
//
// Nu er valget en ting der gemmes paa hende. Filen her er ren logik.
// ============================================================

export interface HarProgramId {
	program: { id: string };
}

/**
 * Hvilket program hun foelger.
 *
 * Raekkefoelgen er vigtig, og hvert trin daekker en rigtig situation:
 *
 *  1. Har hun valgt et program, og har hun det stadig, vinder valget.
 *     Ogsaa selv om hun ikke har traenet i det endnu. Det er hele
 *     pointen med at gemme det.
 *  2. Ellers den hun er i gang med. Det daekker alle de kunder der
 *     traenede foer valget fandtes, og de skal ikke maerke noget.
 *  3. Ellers den eneste hun har, hvis hun kun har én. Saa er der ikke
 *     noget at vaelge imellem.
 *  4. Ellers ingen. Hun har flere og har ikke valgt, og saa skal hun
 *     spoerges i stedet for at faa noget stukket ud.
 *
 * Trin 1 tjekker at programmet stadig findes paa listen. Bliver et
 * program taget fra hende, maa appen ikke blive ved med at pege paa
 * noget hun ikke har.
 */
export function vaelgProgram3<T extends HarProgramId>(
	liste: T[],
	valgtId: string | null,
	iGang: T | null
): T | null {
	if (valgtId) {
		const fundet = liste.find((k) => k.program.id === valgtId);
		if (fundet) return fundet;
	}
	if (iGang) return iGang;
	if (liste.length === 1) return liste[0];
	return null;
}

/**
 * Skal hun spoerges foer der skiftes.
 *
 * Kun naar hun faktisk skifter VAEK fra noget. Har hun ikke valgt endnu,
 * eller trykker hun paa det hun allerede foelger, er der ingenting at
 * bekraefte, og en dialog ville vaere en forhindring uden indhold.
 */
export function skalBekraefteSkift3(nuvaerendeId: string | null, nyId: string): boolean {
	return nuvaerendeId !== null && nuvaerendeId !== nyId;
}

/**
 * Har hun taget en traening i DET HER program i dag.
 *
 * Foer spurgte forsiden "har hun traenet i dag" uden at skele til
 * hvilket program, og saa foldede den traeningen sammen med et flueben
 * efter et skift, selv om hun ikke havde roert det nye program.
 *
 * Linns beslutning 21. august: fluebenet foelger programmet.
 *
 * `senestAt` er 0 naar hun aldrig har traenet i programmet.
 */
export function klaretIProgramIDag3(senestAt: number, nu: number): boolean {
	if (senestAt <= 0) return false;
	return sammeDag3(senestAt, nu);
}

/** Samme kalenderdag i lokal tid. */
export function sammeDag3(a: number, b: number): boolean {
	const x = new Date(a);
	const y = new Date(b);
	return (
		x.getFullYear() === y.getFullYear() &&
		x.getMonth() === y.getMonth() &&
		x.getDate() === y.getDate()
	);
}
