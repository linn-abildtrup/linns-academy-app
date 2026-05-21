// "Mine programmer" — kundens egne træningsprogrammer bygget med custom-builder.
//
// Bruger samme tids-baserede mønster som mikrotræning: hvert sæt har en
// arbejdstid (arbejdsSec) og en pause efter (pauseSec). Reps angives ikke —
// klienten arbejder i den givne arbejdstid og pauser i den givne pause.

export interface CustomProgramOevelse {
	exerciseId: string;
	saet: number;
	arbejdsSec: number;
	pauseSec: number;
}

export interface CustomProgram {
	/** Auto-genereret doc-id. Sat efter create. */
	id?: string;
	navn: string;
	oevelser: CustomProgramOevelse[];
	/** Unix-ms da programmet blev oprettet. */
	oprettet: number;
	/** Unix-ms da programmet sidst blev opdateret. */
	opdateret: number;
}

/** Standard-værdier for en ny øvelse tilføjet til et program. */
export const STANDARD_OEVELSE: Omit<CustomProgramOevelse, 'exerciseId'> = {
	saet: 3,
	arbejdsSec: 30,
	pauseSec: 15
};

/**
 * Validerer at et program kan gemmes. Returnerer en fejlbesked eller null
 * hvis programmet er gyldigt.
 */
export function validerProgram(program: Pick<CustomProgram, 'navn' | 'oevelser'>): string | null {
	const navn = program.navn.trim();
	if (!navn) return 'Programmet skal have et navn.';
	if (navn.length > 60) return 'Navnet må højst være 60 tegn.';
	if (program.oevelser.length === 0) return 'Tilføj mindst én øvelse.';
	for (const o of program.oevelser) {
		if (!o.exerciseId) return 'En øvelse mangler reference.';
		if (o.saet < 1 || o.saet > 20) return 'Antal sæt skal være mellem 1 og 20.';
		if (o.arbejdsSec < 5 || o.arbejdsSec > 600) {
			return 'Arbejdstid skal være mellem 5 og 600 sekunder.';
		}
		if (o.pauseSec < 0 || o.pauseSec > 600) {
			return 'Pause skal være mellem 0 og 600 sekunder.';
		}
	}
	return null;
}

/**
 * Beregner samlet anslået varighed af programmet i minutter. Lægger
 * arbejdstid + pauser sammen.
 */
export function anslaaetVarighedMinutter(program: Pick<CustomProgram, 'oevelser'>): number {
	let totalSec = 0;
	for (const o of program.oevelser) {
		const arbejdSec = o.saet * o.arbejdsSec;
		const pauseSec = Math.max(0, o.saet - 1) * o.pauseSec;
		totalSec += arbejdSec + pauseSec;
	}
	return Math.max(1, Math.round(totalSec / 60));
}
