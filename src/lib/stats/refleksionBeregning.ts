// Ren beregnings-logik for refleksions-aktivitet på admin-dashboardet. INGEN
// data-hentning her — scriptet (firebase-admin) og endpointet (Firestore REST)
// henter rå vanedage på hver sin måde og kalder de SAMME funktioner herfra.
//
// En "refleksion" = en vanedag hvor klienten har skrevet noget i note-feltet.
// Abo-kunder skriver ikke refleksioner (intet spørgsmål), så dette er forløb.
//
// VIGTIGT: refleksioner grupperes pr SPECIFIKT forløb (forlobId), IKKE pr
// produkt-id. Juni-Kickstart's vanedage blev migreret til 'premiumforløb'-
// produktet, så produkt-id'et lyver om holdet. forlobId kommer fra
// product-dokumentets forlobId-felt.

export type ReflForlobType = 'kickstart' | 'kropsro';
export interface ReflForlobMeta {
	navn: string;
	type: ReflForlobType;
}

// Ét rå-bidrag pr vanedag (udtrukket af scriptet/endpointet).
export interface ReflRecord {
	forlobId: string;
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
export type ReflForlob = { forlobId: string; navn: string; type: ReflForlobType } & ReflScope;
export interface ReflSnapshot {
	genereretAt: number;
	samlet: ReflScope;
	prType: { kickstart: ReflScope; kropsro: ReflScope };
	prForlob: ReflForlob[];
}

// Samler hele refleksions-snapshottet: samlet + pr type (alle kickstart/kropsro)
// + pr specifikt forløb. forlobMeta giver navn + type pr forlobId.
export function byggRefleksionSnapshot(
	records: ReflRecord[],
	forlobMeta: Map<string, ReflForlobMeta>,
	genereretAt: number
): ReflSnapshot {
	const medType = records.filter((r) => forlobMeta.has(r.forlobId));
	const afType = (t: ReflForlobType) =>
		medType.filter((r) => forlobMeta.get(r.forlobId)!.type === t);

	const prForlobMap = new Map<string, ReflRecord[]>();
	for (const r of medType) {
		if (!prForlobMap.has(r.forlobId)) prForlobMap.set(r.forlobId, []);
		prForlobMap.get(r.forlobId)!.push(r);
	}
	const prForlob: ReflForlob[] = [...prForlobMap.entries()]
		.map(([forlobId, recs]) => ({
			forlobId,
			navn: forlobMeta.get(forlobId)!.navn,
			type: forlobMeta.get(forlobId)!.type,
			...beregnGruppe(recs)
		}))
		.filter((g) => g.antalRefleksioner >= 10) // skjul test/junk-forløb
		.sort((a, b) => b.antalRefleksioner - a.antalRefleksioner);

	return {
		genereretAt,
		samlet: beregnGruppe(records),
		prType: {
			kickstart: beregnGruppe(afType('kickstart')),
			kropsro: beregnGruppe(afType('kropsro'))
		},
		prForlob
	};
}
