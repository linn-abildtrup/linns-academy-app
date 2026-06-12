// Ren beregnings-logik for refleksions-aktivitet på admin-dashboardet. INGEN
// data-hentning her — scriptet (firebase-admin) og endpointet (Firestore REST)
// henter rå vanedage på hver sin måde og kalder de SAMME funktioner herfra.
//
// En "refleksion" = en vanedag hvor klienten har skrevet noget i note-feltet.
// Abo-kunder skriver ikke refleksioner (intet spørgsmål), så dette er forløb.

// Ét rå-bidrag pr vanedag (udtrukket af scriptet/endpointet).
export interface ReflRecord {
	produkt: string; // 'kickstart' | 'premiumforløb' (Firestore-productId)
	uid: string;
	dagNummer: number;
	laengde: number; // antal tegn i note (0 = ingen refleksion)
}

const r1 = (n: number) => Math.round(n * 10) / 10;
const MAX_DAG = 90; // engagement-kurven dækker forløbslængder op til ~12 uger

// Beregner aktivitets-tal for en delmaengde af records.
function beregnGruppe(records: ReflRecord[]) {
	const medNote = records.filter((r) => r.laengde > 0);
	const kunder = new Set(medNote.map((r) => r.uid));
	const laengder = medNote.map((r) => r.laengde);

	// Engagement-kurve: hvor mange UNIKKE kunder skrev en refleksion pr forløbsdag.
	const prDagKunder = new Map<number, Set<string>>();
	for (const r of medNote) {
		if (r.dagNummer < 0 || r.dagNummer > MAX_DAG) continue;
		if (!prDagKunder.has(r.dagNummer)) prDagKunder.set(r.dagNummer, new Set());
		prDagKunder.get(r.dagNummer)!.add(r.uid);
	}
	const prDag = [...prDagKunder.entries()]
		.map(([dagNummer, set]) => ({ dagNummer, antal: set.size }))
		.sort((a, b) => a.dagNummer - b.dagNummer);

	return {
		antalRefleksioner: medNote.length,
		antalKunder: kunder.size,
		gnsPrKunde: kunder.size ? r1(medNote.length / kunder.size) : 0,
		gnsLaengde: laengder.length
			? Math.round(laengder.reduce((s, x) => s + x, 0) / laengder.length)
			: 0,
		prDag
	};
}

export type ReflScope = ReturnType<typeof beregnGruppe>;
export interface ReflSnapshot {
	genereretAt: number;
	samlet: ReflScope;
	prProdukt: { kickstart: ReflScope; kropsro: ReflScope };
}

// Samler hele refleksions-snapshottet (samlet + pr produkt).
export function byggRefleksionSnapshot(records: ReflRecord[], genereretAt: number): ReflSnapshot {
	return {
		genereretAt,
		samlet: beregnGruppe(records),
		prProdukt: {
			kickstart: beregnGruppe(records.filter((r) => r.produkt === 'kickstart')),
			kropsro: beregnGruppe(records.filter((r) => r.produkt === 'premiumforløb'))
		}
	};
}
