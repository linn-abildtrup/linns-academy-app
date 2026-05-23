// "Mine programmer" — kundens egne træningsprogrammer bygget med custom-builder.
//
// Bruger samme tids-baserede mønster som mikrotræning: hvert sæt har en
// arbejdstid (arbejdsSec) og en pause efter (pauseSec). Reps angives ikke —
// klienten arbejder i den givne arbejdstid og pauser i den givne pause.
//
// To program-typer:
//   1. Simpelt: ét sæt øvelser brugeren har valgt (oevelser-feltet)
//   2. Fler-dages: 14 dage hvor hver dag har et andet udvalg, auto-genereret
//      ud fra brugerens udstyr-valg (dage-feltet + config).

export interface CustomProgramOevelse {
	exerciseId: string;
	saet: number;
	arbejdsSec: number;
	pauseSec: number;
}

export interface CustomProgramDag {
	dagNummer: number; // 1-baseret
	oevelser: CustomProgramOevelse[];
}

export interface CustomProgramConfig {
	antalDage: number; // typisk 14
	antalOevelser: number; // pr dag
	saet: number;
	arbejdsSec: number;
	pauseSec: number;
	/** Bruges af klient-side auto-gen til at filtrere øvelser. */
	udstyr: 'ingen' | 'kettlebell';
}

export interface CustomProgram {
	/** Auto-genereret doc-id. Sat efter create. */
	id?: string;
	navn: string;
	/**
	 * Simpel-mode: ét sæt øvelser. Bevares for bagudkompatibilitet.
	 * Ved fler-dages programmer ignoreres dette felt — bruges kun til at
	 * fortsætte at åbne gamle programmer.
	 */
	oevelser: CustomProgramOevelse[];
	/**
	 * Fler-dages program. Hvis sat (typisk 14 dage), tager dette over for
	 * 'oevelser'-feltet. Hver dag har sit eget udvalg af øvelser.
	 */
	dage?: CustomProgramDag[];
	/** Auto-gen-konfiguration. Kun sat for fler-dages programmer. */
	config?: CustomProgramConfig;
	/**
	 * YYYY-MM-DD-dato hvor klient første gang åbnede / startede programmet.
	 * Bruges til at beregne 'I dag: Dag X af N'. Sættes automatisk når
	 * klient åbner programmet første gang.
	 */
	startetDato?: string;
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
 * Returnerer hvilken dag det er i programmet (1-baseret), clampet til antalDage.
 * Bruger startetDato og dagens dato. Hvis startetDato ikke er sat, returneres 1.
 */
export function aktuelDag(program: CustomProgram, idag: Date = new Date()): number {
	if (!program.dage || program.dage.length === 0) return 1;
	const antalDage = program.dage.length;
	if (!program.startetDato) return 1;
	const start = new Date(program.startetDato);
	start.setHours(0, 0, 0, 0);
	const nu = new Date(idag);
	nu.setHours(0, 0, 0, 0);
	const dage = Math.floor((nu.getTime() - start.getTime()) / (24 * 60 * 60 * 1000));
	return Math.max(1, Math.min(antalDage, dage + 1));
}

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
 * Beregner samlet anslået varighed af et sæt øvelser i minutter. Lægger
 * arbejdstid + pauser sammen. Bruges både til simpel-mode og pr-dag for
 * fler-dages programmer.
 */
export function anslaaetVarighedMinutter(
	program: Pick<CustomProgram, 'oevelser'>
): number {
	let totalSec = 0;
	for (const o of program.oevelser) {
		const arbejdSec = o.saet * o.arbejdsSec;
		const pauseSec = Math.max(0, o.saet - 1) * o.pauseSec;
		totalSec += arbejdSec + pauseSec;
	}
	return Math.max(1, Math.round(totalSec / 60));
}

/** Returnerer minutter for én dag i et fler-dages program. */
export function anslaaetDagVarighedMin(dag: CustomProgramDag): number {
	return anslaaetVarighedMinutter({ oevelser: dag.oevelser });
}
