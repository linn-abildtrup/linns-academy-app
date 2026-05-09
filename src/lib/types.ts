/**
 * Brugertilstand i Firestore.
 *
 * 'modulbruger' = abonnent der ikke er på et aktivt forløb (ser variant B)
 * 'forlobskunde' = bruger på et aktivt forløb (ser variant A1)
 * 'udlobet' = tidligere kunde uden aktiv adgang (ser variant C)
 */
export type UserState = 'modulbruger' | 'forlobskunde' | 'udlobet';

/**
 * Bruger-dokumentet i Firestore-collection 'users'.
 * Dokument-ID matcher Firebase Auth UID.
 */
/**
 * Daglige mål for udvidet næringsdata. Sættes af brugeren på profil-siden
 * når 'Vis udvidet næringsdata' er slået til. Hvis ikke sat bruges
 * STANDARD_DAGLIGE_MAL fra $lib/content/naering.
 */
export interface DagligeMaal {
	protein: number;
	fiber: number;
	kh: number;
	fedt: number;
	kcal: number;
}

export type Aktivitetsniveau = 'stille' | 'let' | 'moderat' | 'meget';
export type MenopausalStatus = 'praemenopause' | 'perimenopause' | 'postmenopause';

/**
 * Brugerens fysiske profil — bruges af 'Beregn mine mål automatisk'-wizarden
 * til at foreslå daglige næringsmål via Mifflin-St Jeor-formlen.
 *
 * Felterne huskes så klienten kan åbne wizarden igen og justere uden at
 * skulle indtaste alt forfra.
 */
export interface BrugerProfil {
	hojde: number; // cm
	vaegt: number; // kg
	alder: number; // år
	aktivitet: Aktivitetsniveau;
	menopaus: MenopausalStatus;
}

export interface UserDoc {
	firstName: string;
	email: string;
	state: UserState;
	createdAt: number; // Unix timestamp i millisekunder

	// Senest tidspunkt brugeren åbnede /app/spoergsmaal og så sine svar.
	// Bruges til at detektere ubeskrevne svar (svar.besvaretAt > dette).
	senestSpoergsmaalLaestAt?: number;

	// Vis udvidet næringsdata (kh/fedt/kcal) i 30-30-3, dagbog og udvikling.
	// Default false — basis-visningen er kun protein og fiber.
	visUdvidetNaering?: boolean;

	// Brugerens daglige mål for makro-næring. Kun aktiv når
	// visUdvidetNaering = true.
	dagligeMaal?: DagligeMaal;

	// Snapshot af det input klienten gav til 'Beregn mine mål'-wizarden.
	// Bruges til at pre-udfylde wizarden næste gang den åbnes.
	brugerProfil?: BrugerProfil;
}
