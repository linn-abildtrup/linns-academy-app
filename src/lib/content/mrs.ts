// MRS — Menopause Rating Scale.
//
// 11 spørgsmål om overgangsaldersymptomer, hvert vurderet på en 0-4 skala
// (ingen til voldsomt). Bruges som baseline + midtvejs + afslutning for
// at måle effekt over kundens forløb.
//
// Spørgsmål, subskala-grupperinger og tolkning er baseret på Heinemann et al.
// (2003), Health Qual Life Outcomes 1:28 — dansk tilpasning af Linn's Academy.

export type Subskala = 'somatisk' | 'psykologisk' | 'urogenital';

export type MaalePunkt = 'baseline' | 'midtvejs' | 'afslutning';

export interface MrsItem {
	id: number;
	subscale: Subskala;
	da: string;
	description: string;
}

export const MRS_ITEMS: readonly MrsItem[] = [
	{
		id: 1,
		subscale: 'somatisk',
		da: 'Hedeture og svedeture',
		description: 'Pludselige varmebølger, svedanfald, nattesved'
	},
	{
		id: 2,
		subscale: 'somatisk',
		da: 'Hjertebanken',
		description:
			'Hjertet der banker hårdt, springer et slag over, løber hurtigt, eller trykken for brystet'
	},
	{
		id: 3,
		subscale: 'somatisk',
		da: 'Søvnproblemer',
		description: 'Svært ved at falde i søvn, vågner midt om natten, vågner for tidligt'
	},
	{
		id: 4,
		subscale: 'psykologisk',
		da: 'Nedtrykthed og humørsvingninger',
		description: 'Føler mig nede, trist, tårer tæt på, mangler drivkraft, humøret svinger'
	},
	{
		id: 5,
		subscale: 'psykologisk',
		da: 'Irritabilitet',
		description: 'Kort lunte, indre spænding, let til at blive frustreret'
	},
	{
		id: 6,
		subscale: 'psykologisk',
		da: 'Uro og ængstelse',
		description: 'Indre uro, bekymringstanker, følelse af panik'
	},
	{
		id: 7,
		subscale: 'psykologisk',
		da: 'Træthed og hjernetåge',
		description: 'Mangler overskud, dårlig hukommelse, svært ved at koncentrere mig, glemsomhed'
	},
	{
		id: 8,
		subscale: 'urogenital',
		da: 'Ændringer i sexlyst',
		description: 'Mindre lyst til sex, ændret seksuel tilfredshed'
	},
	{
		id: 9,
		subscale: 'urogenital',
		da: 'Blæreproblemer',
		description: 'Skal tisse oftere, svært ved at holde sig, lidt urinlækage'
	},
	{
		id: 10,
		subscale: 'urogenital',
		da: 'Tørhed nedadtil',
		description: 'Tørhed eller svien i skeden, ubehag ved samleje'
	},
	{
		id: 11,
		subscale: 'somatisk',
		da: 'Led- og muskelsmerter',
		description: 'Ømhed i led, stivhed, muskelsmerter, gigtlignende gener'
	}
] as const;

export interface SeverityNiveau {
	value: 0 | 1 | 2 | 3 | 4;
	label: string;
}

export const SEVERITY: readonly SeverityNiveau[] = [
	{ value: 0, label: 'Ingen' },
	{ value: 1, label: 'Lidt' },
	{ value: 2, label: 'En del' },
	{ value: 3, label: 'Meget' },
	{ value: 4, label: 'Voldsomt' }
] as const;

export interface SubskalaDef {
	label: string;
	items: number[];
	color: string;
	bg: string;
	/** Kort forklaring vist under subskala-scoren på resultat-siden. */
	beskrivelse: string;
}

export const SUBSCALES: Record<Subskala, SubskalaDef> = {
	somatisk: {
		label: 'Krop og søvn',
		items: [1, 2, 3, 11],
		color: '#C4624A',
		bg: '#FDF4F7',
		beskrivelse:
			'Hedeture, hjertebanken, søvn og led-/muskelsmerter. 4 spørgsmål, max 16.'
	},
	psykologisk: {
		label: 'Humør og energi',
		items: [4, 5, 6, 7],
		color: '#2A0F1E',
		bg: '#F3EDF1',
		beskrivelse:
			'Nedtrykthed, irritabilitet, uro og træthed/hjernetåge. 4 spørgsmål, max 16.'
	},
	urogenital: {
		label: 'Underliv og blære',
		items: [8, 9, 10],
		color: '#8B5E3C',
		bg: '#F5F0EB',
		beskrivelse: 'Sexlyst, blære og tørhed nedadtil. 3 spørgsmål, max 12.'
	}
};

export const MAALEPUNKT_LABEL: Record<MaalePunkt, string> = {
	baseline: 'Startpunkt (dag 0)',
	midtvejs: 'Midtvejs (dag 10-11)',
	afslutning: 'Afslutning (dag 21)'
};

/** Et færdigt udfyldt MRS-skema som lagres i Firestore. */
export interface MrsScore {
	id?: string;
	uid: string;
	email: string;
	measurePoint: MaalePunkt;
	timestamp: number;
	scores: Record<number, number>;
	subscales: { somatisk: number; psykologisk: number; urogenital: number };
	total: number;
}

/** Beregner subskala-scoren for hver gruppe ud fra individuelle svar. */
export function calculateSubscales(
	scores: Record<number, number>
): { somatisk: number; psykologisk: number; urogenital: number } {
	return {
		somatisk: SUBSCALES.somatisk.items.reduce((s, id) => s + (scores[id] ?? 0), 0),
		psykologisk: SUBSCALES.psykologisk.items.reduce((s, id) => s + (scores[id] ?? 0), 0),
		urogenital: SUBSCALES.urogenital.items.reduce((s, id) => s + (scores[id] ?? 0), 0)
	};
}

/** Summen af alle 11 svar. Max 44. */
export function calculateTotal(scores: Record<number, number>): number {
	return MRS_ITEMS.reduce((s, item) => s + (scores[item.id] ?? 0), 0);
}

export interface Fortolkning {
	label: string;
	color: string;
	/** Længere beskrivelse vist under label på resultat-siden. */
	beskrivelse: string;
}

/**
 * Mapper totalscore til en menneskelig fortolkning + farve.
 *
 * Cutoffs følger Heinemann et al. (2003), Health Qual Life Outcomes 1:28 —
 * international konsensus om severity-niveauer for MRS total score (0-44):
 *  0-4 = none/very few · 5-8 = little · 9-16 = moderate ·
 *  17-24 = severe · 25+ = very severe.
 */
export function getInterpretation(total: number): Fortolkning {
	if (total <= 4)
		return {
			label: 'Ingen eller meget få gener',
			color: '#1D9E75',
			beskrivelse:
				'Du oplever stort set ingen overgangsalder-symptomer lige nu. Det er en stærk udgangsposition.'
		};
	if (total <= 8)
		return {
			label: 'Lette gener',
			color: '#639922',
			beskrivelse:
				'Du mærker enkelte symptomer, men de fylder ikke meget i din hverdag. Det her er et godt sted at sætte ind med små justeringer.'
		};
	if (total <= 16)
		return {
			label: 'Mærkbare gener',
			color: '#BA7517',
			beskrivelse:
				'Du har symptomer der mærker dig flere gange om ugen. De påvirker din hverdag — og det er typisk her, kvinder begynder at søge hjælp.'
		};
	if (total <= 24)
		return {
			label: 'Tydelige gener i hverdagen',
			color: '#C4624A',
			beskrivelse:
				'Symptomerne fylder dagligt og påvirker dit velvære, søvn eller relationer. Det er ikke noget du behøver leve med — der er meget at gøre.'
		};
	return {
		label: 'Kraftige gener der fylder meget',
		color: '#A32D2D',
		beskrivelse:
			'Symptomerne fylder meget i dit liv og forringer din livskvalitet markant. Det er værd at tale med din læge om mulighederne — og dette forløb er designet til at hjælpe.'
	};
}

/**
 * Subskala-fortolkning ud fra Heinemann et al.'s officielle cutoffs.
 * Hver subskala har sin egen skala fordi de har forskelligt antal items.
 *  somatisk (max 16): 0-2 none/little · 3-4 moderate · 5-8 severe · 9+ very severe
 *  psykologisk (max 16): 0-1 none/little · 2-3 moderate · 4-6 severe · 7+ very severe
 *  urogenital (max 12): 0 none/little · 1-2 moderate · 3+ severe · 6+ very severe
 */
export type SubskalaNiveau = 'ingen' | 'mild' | 'moderat' | 'svaer';

export function getSubskalaFortolkning(
	subskala: Subskala,
	score: number
): { label: string; niveau: SubskalaNiveau } {
	let niveau: SubskalaNiveau;
	if (subskala === 'somatisk') {
		if (score <= 2) niveau = 'ingen';
		else if (score <= 4) niveau = 'mild';
		else if (score <= 8) niveau = 'moderat';
		else niveau = 'svaer';
	} else if (subskala === 'psykologisk') {
		if (score <= 1) niveau = 'ingen';
		else if (score <= 3) niveau = 'mild';
		else if (score <= 6) niveau = 'moderat';
		else niveau = 'svaer';
	} else {
		// urogenital
		if (score === 0) niveau = 'ingen';
		else if (score <= 2) niveau = 'mild';
		else if (score <= 5) niveau = 'moderat';
		else niveau = 'svaer';
	}
	const labels: Record<SubskalaNiveau, string> = {
		ingen: 'Ingen til lette gener',
		mild: 'Milde gener',
		moderat: 'Moderate gener',
		svaer: 'Svære gener'
	};
	return { label: labels[niveau], niveau };
}

/** Returnerer en fejlbesked eller null hvis scores-objektet er gyldigt. */
export function validerScores(scores: Record<number, number>): string | null {
	for (const item of MRS_ITEMS) {
		const v = scores[item.id];
		if (v === undefined) return `Mangler svar på spørgsmål ${item.id} (${item.da}).`;
		if (typeof v !== 'number' || !Number.isInteger(v) || v < 0 || v > 4) {
			return `Ugyldigt svar på spørgsmål ${item.id}: skal være 0-4.`;
		}
	}
	return null;
}
