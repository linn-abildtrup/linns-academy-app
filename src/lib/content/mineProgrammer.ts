// "Mine programmer" — kundens egne træningsprogrammer bygget med custom-builder.
//
// Modsat forløbs-mikrotræningen (time-intervaller) bruger custom-builder
// klassisk sæt × reps med pause-sekunder mellem sæt. Det matcher v27-specifikationen
// hvor kunden vælger: øvelser fra katalog, antal sæt, antal reps, pause.
//
// Gemmes pr kunde under users/{uid}/mineProgrammer/{programId}.

export interface CustomProgramOevelse {
	exerciseId: string;
	saet: number;
	reps: number;
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
	reps: 10,
	pauseSec: 60
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
		if (o.reps < 1 || o.reps > 100) return 'Antal reps skal være mellem 1 og 100.';
		if (o.pauseSec < 0 || o.pauseSec > 600) {
			return 'Pause skal være mellem 0 og 600 sekunder.';
		}
	}
	return null;
}

/**
 * Beregner samlet anslået varighed af programmet i minutter. Bruger en grov
 * tommelfingerregel: 3 sekunder pr rep + pause-sekunder mellem hvert sæt.
 * Det er kun til visning og behøver ikke være præcist.
 */
export function anslaaetVarighedMinutter(program: Pick<CustomProgram, 'oevelser'>): number {
	let totalSec = 0;
	for (const o of program.oevelser) {
		const arbejdSec = o.saet * o.reps * 3;
		const pauseSec = Math.max(0, o.saet - 1) * o.pauseSec;
		totalSec += arbejdSec + pauseSec;
	}
	return Math.max(1, Math.round(totalSec / 60));
}
