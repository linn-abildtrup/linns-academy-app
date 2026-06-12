// Ren klassificerings-logik for "manglende kundeaktivitet"-fanen. INGEN data-
// hentning her — scriptet/endpointet samler per-kunde aktivitets-tal og kalder
// denne funktion. Overvåger KUN kunder i et igangværende forløb.
//
// Aktivitet = faktisk handling (måltid, vanedag/refleksion, træning). Login-tid
// bruges IKKE (den lyver). Sidste-aktivitet = nyeste handling på tværs.

export type ForlobType = 'kickstart' | 'kropsro';

// Per-kunde aktivitets-resumé (beregnet i data-laget).
export interface AktivitetInput {
	uid: string;
	fornavn: string;
	email: string;
	forlobNavn: string;
	forlobType: ForlobType;
	sidstAktiv: number | null; // ms for nyeste handling (null = aldrig aktiv)
	sidste7: number; // antal handlinger i de seneste 7 dage
	forrige7: number; // antal handlinger i de 7 dage før det
}

export type AktivitetStatus = 'inaktiv' | 'faldende';
export interface AtRisk extends AktivitetInput {
	dageSiden: number | null; // dage siden sidste handling
	status: AktivitetStatus;
}
export interface AktivitetSnapshot {
	genereretAt: number;
	antalOvervaaget: number;
	inaktive: AtRisk[];
	faldende: AtRisk[];
}

const DAG = 86400000;
const INAKTIV_DAGE = 3; // ingen aktivitet i 3+ dage = inaktiv

export function byggAktivitetSnapshot(kunder: AktivitetInput[], naa: number): AktivitetSnapshot {
	const inaktive: AtRisk[] = [];
	const faldende: AtRisk[] = [];
	for (const k of kunder) {
		const dageSiden = k.sidstAktiv === null ? null : Math.floor((naa - k.sidstAktiv) / DAG);
		const base: AtRisk = { ...k, dageSiden, status: 'inaktiv' };
		if (dageSiden === null || dageSiden >= INAKTIV_DAGE) {
			inaktive.push(base);
		} else if (k.forrige7 >= 4 && k.sidste7 < k.forrige7 / 2) {
			// Stadig aktiv, men aktiviteten er mere end halveret vs ugen før.
			faldende.push({ ...base, status: 'faldende' });
		}
	}
	// Mest kritiske øverst: inaktive efter flest dage væk; faldende efter størst fald.
	inaktive.sort((a, b) => (b.dageSiden ?? 99999) - (a.dageSiden ?? 99999));
	faldende.sort((a, b) => b.forrige7 - b.sidste7 - (a.forrige7 - a.sidste7));
	return { genereretAt: naa, antalOvervaaget: kunder.length, inaktive, faldende };
}
