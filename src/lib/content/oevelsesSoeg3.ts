// ============================================================
// Soegning og filtre paa oevelses-biblioteket. Ren logik.
//
// 62 oevelser, og alle 62 har baade video, en beskrivelse og en
// trin-for-trin-vejledning. Talt 20. august.
//
// Soegningen leder i FIRE felter og ikke kun i navnet: navnet,
// beskrivelsen, kategorien og oevelsens maerkater. Det er den samme
// erkendelse som paa opskrifterne, hvor 56 % af alle traeffer ikke har
// ordet i titlen. Soeger hun "ryg", hedder ingen oevelse det, men flere
// traener den, og de skal frem.
//
// Æ, ø og å skal kunne findes uden at hun skriver dem. Soeger hun
// "ovelse", skal "øvelse" komme med.
// ============================================================

/** Kun det soegningen skal bruge om én oevelse. */
export interface SoegbarOevelse {
	id: string;
	name: string;
	desc: string;
	catLabel: string;
	tags: string[];
	udstyr: string[];
}

/** Udstyret skrevet som kunden laeser det. */
export const UDSTYR_NAVN: Record<string, string> = {
	ingen: 'Uden udstyr',
	kettlebell: 'Kettlebell',
	elastik: 'Elastik',
	haandvaegte: 'Håndvægte',
	forhojning: 'Forhøjning'
};

export function udstyrTekst(udstyr: string[]): string {
	const navne = udstyr.map((u) => UDSTYR_NAVN[u] ?? u).filter(Boolean);
	return navne.length > 0 ? navne.join(' · ') : '';
}

/**
 * Gaør en tekst sammenlignelig: smaa bogstaver, og æ, ø og å skrevet ud.
 *
 * Uden det kan hun ikke finde "Ankelstræk" ved at skrive "ankelstraek",
 * og det er praecis hvad man goer paa et tastatur i en fart.
 */
export function normaliser(tekst: string): string {
	return (tekst ?? '')
		.toLowerCase()
		.replace(/æ/g, 'ae')
		.replace(/ø/g, 'oe')
		.replace(/å/g, 'aa')
		.normalize('NFD')
		.replace(/[̀-ͯ]/g, '');
}

/** Soegeordene, delt op. Tomme og gentagne ord falder fra. */
export function soegetermer(soegeord: string): string[] {
	const ud: string[] = [];
	for (const ord of normaliser(soegeord).split(/\s+/)) {
		if (ord.length > 0 && !ud.includes(ord)) ud.push(ord);
	}
	return ud;
}

export interface OevelsesFiltre {
	soegeord?: string;
	/** Kategori-etiketter, fx "Core". Tom liste = alle. */
	kategorier?: string[];
	/** Udstyrs-ider, fx "kettlebell". Tom liste = alt. */
	udstyr?: string[];
}

/**
 * Passer oevelsen paa alle soegeordene.
 *
 * ALLE ord skal findes, men de maa gerne findes i hver sit felt. Soeger
 * hun "squat kettlebell", er det fordi hun vil have begge dele.
 */
function passerSoegning(o: SoegbarOevelse, termer: string[]): boolean {
	if (termer.length === 0) return true;
	const felter = normaliser(
		[
			o.name,
			o.desc,
			o.catLabel,
			...(o.tags ?? []),
			...(o.udstyr ?? []).map((u) => UDSTYR_NAVN[u] ?? u)
		].join(' ')
	);
	return termer.every((t) => felter.includes(t));
}

/** Filtrerer listen. Raekkefoelgen fra input bevares. */
export function filtrerOevelser<T extends SoegbarOevelse>(
	oevelser: T[],
	filtre: OevelsesFiltre
): T[] {
	const termer = soegetermer(filtre.soegeord ?? '');
	const kategorier = filtre.kategorier ?? [];
	const udstyr = filtre.udstyr ?? [];

	return oevelser.filter((o) => {
		if (kategorier.length > 0 && !kategorier.includes(o.catLabel)) return false;
		if (udstyr.length > 0 && !(o.udstyr ?? []).some((u) => udstyr.includes(u))) return false;
		return passerSoegning(o, termer);
	});
}

/**
 * Kategorierne der findes, med antal, stoerste foerst.
 *
 * Talt paa den liste der er tilbage NAAR soegningen og udstyret er lagt
 * paa, men UDEN kategori-filteret selv. Saa siger tallet hvad hun faar
 * hvis hun trykker, og ikke hvad hun allerede har.
 */
export function kategoriAntal(oevelser: SoegbarOevelse[]): { navn: string; antal: number }[] {
	const kort = new Map<string, number>();
	for (const o of oevelser) {
		if (!o.catLabel) continue;
		kort.set(o.catLabel, (kort.get(o.catLabel) ?? 0) + 1);
	}
	return [...kort]
		.map(([navn, antal]) => ({ navn, antal }))
		.sort((a, b) => b.antal - a.antal || a.navn.localeCompare(b.navn, 'da'));
}

/** Det udstyr der findes i listen, med antal. */
export function udstyrAntal(
	oevelser: SoegbarOevelse[]
): { id: string; navn: string; antal: number }[] {
	const kort = new Map<string, number>();
	for (const o of oevelser) {
		for (const u of o.udstyr ?? []) kort.set(u, (kort.get(u) ?? 0) + 1);
	}
	return [...kort]
		.map(([id, antal]) => ({ id, navn: UDSTYR_NAVN[id] ?? id, antal }))
		.sort((a, b) => b.antal - a.antal || a.navn.localeCompare(b.navn, 'da'));
}

/** "62 øvelser" eller "1 øvelse". */
export function antalTekst(antal: number): string {
	return antal === 1 ? '1 øvelse' : `${antal} øvelser`;
}
