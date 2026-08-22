// ============================================================
// Hvad en oevelse belaster, saa kunden kan bede om hensyn.
//
// HVORFOR DEN FINDES. Linns beslutning 21. august 2026: naar en kunde
// selv bygger et program, skal hun kunne sige "skaan mine knae". Det
// kraever at vi ved hvilke oevelser der er haarde ved knaeene, og det
// staar ingen steder i dag. Kategorien siger Ben, Core, Balance, ikke
// hvad der belastes.
//
// LUKKEDE VALG OG IKKE ET FRIT FELT. Hun vaelger fra en liste, og saa
// filtrerer vi oevelser FRA. Vi fortolker aldrig en saetning om smerte.
// Skriver hun "jeg har ondt i knaeet" i et frit felt og appen bygger et
// program hun udfoerer, giver Linns brand fysioterapeutisk raadgivning.
// Det er forskellen paa et vaerktoej og en diagnose.
//
// VI BEDER IKKE AI'EN OM AT LADE VAERE. Vi giver den ikke muligheden:
// oevelserne er vaek fra den bank den vaelger fra. En instruktion kan
// overses, en tom liste kan ikke.
//
// MAERKERNE ER LINNS FAGLIGHED. Filen her definerer hvilke der findes og
// hvordan de virker. HVILKE oevelser der faar hvilke maerker, bestemmer
// hun i admin. Der er et forslag at rette i, se FORSLAG3, men det er et
// forslag og ikke en sandhed.
// ============================================================

/** Et hensyn kunden kan bede om. */
export interface Hensyn3 {
	id: string;
	/** Det hun trykker paa. */
	navn: string;
	/** Det Linn saetter maerket efter, i admin. */
	adminNavn: string;
}

export const HENSYN3: Hensyn3[] = [
	{ id: 'knae', navn: 'Skån mine knæ', adminNavn: 'Hård ved knæene' },
	{ id: 'ryg', navn: 'Skån min ryg', adminNavn: 'Belaster ryggen' },
	{ id: 'skulder', navn: 'Skån mine skuldre', adminNavn: 'Belaster skuldrene' },
	/**
	 * Bækkenbunden. Tilfoejet 22. august, og den er den vigtigste af dem
	 * alle for maalgruppen: kvinder fra 40 og opefter. Hop, tunge loeft og
	 * mavboejninger er de klassiske, og det er noget mange lever med uden
	 * at tale om det. Derfor er ordlyden neutral og ikke en diagnose.
	 */
	{ id: 'baekkenbund', navn: 'Skån min bækkenbund', adminNavn: 'Belaster bækkenbunden' },
	{ id: 'gulv', navn: 'Jeg kan ikke ligge på gulvet', adminNavn: 'Kræver at man er på gulvet' },
	/**
	 * Larm. Hop og kettlebells der rammer gulvet klokken seks om morgenen
	 * i en lejlighed er en rigtig grund til ikke at traene.
	 */
	{ id: 'larm', navn: 'Det må ikke larme', adminNavn: 'Larmer, hop eller vægt mod gulv' }
];

/** Kortet fra oevelse til de maerker den har faaet. */
export type HensynKort3 = Record<string, string[]>;

/** Findes hensynet. Bruges naar der laeses fra databasen. */
export function erGyldigtHensyn3(id: string): boolean {
	return HENSYN3.some((h) => h.id === id);
}

/** Maerkerne paa én oevelse, uden dem vi ikke kender. */
export function hensynFor3(kort: HensynKort3, exerciseId: string): string[] {
	return (kort[exerciseId] ?? []).filter(erGyldigtHensyn3);
}

/**
 * Oevelserne hun kan faa, naar hun har bedt om hensyn.
 *
 * En oevelse ryger ud hvis den har MINDST ÉT af de maerker hun har
 * valgt. Beder hun om at skaane baade knae og ryg, skal begge dele
 * respekteres, ikke kun det ene.
 *
 * En oevelse UDEN maerker kommer altid med. Det er med vilje: har Linn
 * ikke naaet at maerke den, skal den ikke forsvinde stille. Hellere en
 * oevelse for meget end et program der pludselig er tomt.
 */
export function filtrerPaaHensyn3<T extends { id: string }>(
	oevelser: T[],
	kort: HensynKort3,
	valgte: string[]
): T[] {
	if (valgte.length === 0) return oevelser;
	return oevelser.filter((o) => {
		const maerker = hensynFor3(kort, o.id);
		return !maerker.some((m) => valgte.includes(m));
	});
}

/**
 * Hvor mange oevelser der er tilbage pr hensyn.
 *
 * Bruges i admin, saa Linn kan se konsekvensen af sine maerker FOER en
 * kunde staar med et tomt program. Vaelger hun at maerke halvdelen af
 * benoevelserne som knae-tunge, skal hun kunne se det.
 */
export function tilbageEfterHensyn3<T extends { id: string }>(
	oevelser: T[],
	kort: HensynKort3
): { hensyn: Hensyn3; tilbage: number }[] {
	return HENSYN3.map((hensyn) => ({
		hensyn,
		tilbage: filtrerPaaHensyn3(oevelser, kort, [hensyn.id]).length
	}));
}

/**
 * Er der oevelser nok tilbage til at bygge noget.
 *
 * Under det her tal giver det ingen mening at bede AI'en om et program:
 * den ville gentage de samme faa oevelser hver dag. Saa siger vi det til
 * hende i stedet for at levere noget daarligt.
 */
export const MIN_OEVELSER3 = 8;

export function nokTilbage3(antal: number): boolean {
	return antal >= MIN_OEVELSER3;
}

/**
 * FORSLAG TIL MAERKER, som Linn retter i.
 *
 * Sat efter hvad oevelserne hedder og hvad de aabenlyst goer. Det er
 * IKKE en faglig vurdering, og det er praecis derfor det er et forslag
 * og ikke en fast liste. Linn retter i admin, og hendes valg vinder.
 *
 * Bemaerk at et par af dem er svaere:
 *
 *  - En glute bridge foregaar paa gulvet, men er samtidig noget af det
 *    mest knaevenlige der findes. Den har derfor 'gulv' og ikke 'knae'.
 *  - PLANKEN har IKKE faaet 'baekkenbund'. Dybe mavboejninger er den
 *    klassiske synder, mens planken normalt regnes for i orden. Det er
 *    et fagligt valg, og Linn kan aendre det.
 *  - Presset over hovedet, altsaa shoulder press og thruster, HAR faaet
 *    'baekkenbund', fordi det oeger trykket i maven.
 */
export const FORSLAG3: HensynKort3 = {
	// Ben, boejer knaeet dybt eller lander haardt
	bodyweight_squat: ['knae'],
	goblet_squat: ['knae'],
	sumo_squat: ['knae'],
	curtsy_lunge: ['knae'],
	lateral_lunge: ['knae'],
	reverse_lunge: ['knae'],
	reverse_lunge_nv: ['knae'],
	split_squat_left: ['knae'],
	split_squat_right: ['knae'],
	step_up: ['knae', 'larm'],
	step_up_nv: ['knae', 'larm'],
	step_up_knee_lift: ['knae', 'larm'],
	wall_sit: ['knae'],
	wall_sit_kettlebell: ['knae'],
	mini_hops: ['knae', 'baekkenbund', 'larm'],
	burpees: ['knae', 'ryg', 'skulder', 'gulv', 'baekkenbund', 'larm'],
	lunges_rotation: ['knae', 'ryg'],
	thruster: ['knae', 'skulder', 'baekkenbund'],

	// Ryg, loefter fra gulv eller boejer ryggen
	dodloft_kettlebell: ['ryg', 'baekkenbund'],
	romanian_deadlift_kettlebell: ['ryg', 'baekkenbund'],
	sumo_dodloft: ['ryg', 'baekkenbund'],
	suitcase_deadlift_left: ['ryg', 'baekkenbund'],
	suitcase_deadlift_right: ['ryg', 'baekkenbund'],
	kettlebell_swing: ['ryg', 'baekkenbund', 'larm'],
	bent_over_row: ['ryg'],
	good_morning: ['ryg'],
	single_arm_row_kettlebell_left: ['ryg'],
	single_arm_row_kettlebell_right: ['ryg'],

	// Skulder, over hovedet eller vaegt paa haenderne
	shoulder_press: ['skulder', 'baekkenbund'],
	kettlebell_high_pulls: ['skulder'],
	incline_pushup: ['skulder'],
	dips_chair: ['skulder'],
	inchworm: ['skulder', 'gulv'],

	// Gulv
	glute_bridge: ['gulv'],
	glute_bridge_nv: ['gulv'],
	single_leg_glute_bridge_left: ['gulv'],
	single_leg_glute_bridge_right: ['gulv'],
	superman: ['gulv'],
	mavelaeggende_armfoering: ['gulv'],
	floor_press_kettlebell: ['gulv'],
	cat_cow: ['gulv'],
	dead_bug: ['gulv'],
	bird_dog: ['gulv'],
	maveboejninger: ['ryg', 'gulv', 'baekkenbund'],
	russian_twist: ['ryg', 'gulv', 'baekkenbund'],
	russian_twist_kettlebell: ['ryg', 'gulv', 'baekkenbund'],

	// Planke og sidevendt planke: vaegt paa skuldrene OG paa gulvet
	planke: ['skulder', 'gulv'],
	side_plank_left: ['skulder', 'gulv'],
	side_plank_right: ['skulder', 'gulv'],
	shoulder_taps: ['skulder', 'gulv'],

	// Balance paa ét ben. Knaeet boejes ikke dybt, men staar man
	// uroligt, belastes det alligevel. Linns vurdering afgoer.
	single_leg_deadlift_left: ['ryg'],
	single_leg_deadlift_right: ['ryg'],
	single_leg_deadlift_kettlebell_left: ['ryg'],
	single_leg_deadlift_kettlebell_right: ['ryg'],

	// Roterer i ryggen med vaegt
	wood_chop_left: ['ryg', 'skulder'],
	wood_chop_right: ['ryg', 'skulder'],
	kettlebell_figure_8: ['ryg'],

	// De her er med VILJE uden maerker. De belaster ikke noget saerligt,
	// og en oevelse uden maerker kommer altid med. Linn kan tilfoeje.
	//   ankelstraek_left, ankelstraek_right  strækket, staaende
	//   calf_raise                            laegge, staaende
	//   single_leg_stand_left, _right         balance, staaende
	ankelstraek_left: [],
	ankelstraek_right: [],
	calf_raise: [],
	single_leg_stand_left: [],
	single_leg_stand_right: []
};
