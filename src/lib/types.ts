/**
 * @deprecated Erstattes af accessLevel/accessSource/activeProduct. Beholdes
 * indtil etape 2 hvor alle 12 kald-steder er refactoreret. Læs adgangs-
 * status via helpers i $lib/utils/userAdgang.
 *
 * 'modulbruger' = abonnent der ikke er på et aktivt forløb (ser variant B)
 * 'forlobskunde' = bruger på et aktivt forløb (ser variant A1)
 * 'udlobet' = tidligere kunde uden aktiv adgang (ser variant C)
 */
export type UserState = 'modulbruger' | 'forlobskunde' | 'udlobet';

/**
 * Adgangs-niveauet bestemmer hvilket app-indhold brugeren ser.
 * Drives af de fire produkter i Simplero — basis dækker basis-app-niveauet
 * og premium dækker premium-app-niveauet (mere indhold).
 */
export type AccessLevel = 'none' | 'basis' | 'premium';

/**
 * Hvor adgangen er kommet fra — bestemmer hvilken UI-variant brugeren ser
 * på forsiden (forløbskunder ser A1-layout med strip og dagens lektion,
 * abonnenter ser B-layout med modul-grid).
 */
export type AccessSource = 'abonnement' | 'forløb';

/**
 * Det specifikke produkt brugeren har købt. Sat fra Simplero-webhook
 * baseret på hvilket tag der blev tilføjet.
 */
export type ActiveProduct = 'kickstart' | 'premiumforløb' | 'basisabo' | 'premiumabo';

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

	/**
	 * @deprecated Læses via helpers i $lib/utils/userAdgang i stedet.
	 * Beholdt for backwards compat indtil de 12 kald-steder er refactoreret.
	 * Migrationen sætter dette automatisk fra accessLevel/accessSource.
	 */
	state: UserState;

	createdAt: number; // Unix timestamp i millisekunder

	// ============================================================
	// Adgangs-model (drevet af Simplero-køb)
	// ============================================================

	/** Niveau af app-indhold brugeren har adgang til. */
	accessLevel?: AccessLevel;

	/** Hvor adgangen kommer fra — bestemmer UI-variant. */
	accessSource?: AccessSource;

	/** Det specifikke Simplero-produkt der gav adgangen. */
	activeProduct?: ActiveProduct;

	/** True hvis adgangen er et løbende abonnement (modsat engangs-forløbskøb). */
	activeSubscription?: boolean;

	/** Hvornår adgangen udløber — null for løbende abonnement uden slutdato. */
	expiresAt?: number | null;

	/**
	 * Hvornår bonus-perioden efter et forløb slutter. Sat når et forløbskøb
	 * registreres. Når denne dato er passeret bør accessLevel sættes til 'none'
	 * medmindre brugeren har tegnet abonnement i mellemtiden.
	 */
	bonusPeriodEndsAt?: number | null;

	/**
	 * True hvis brugeren skal tilbydes specialtilbud (fx SK8-under-2-flow).
	 * Sættes manuelt eller via Simplero-tag.
	 */
	specialOffer?: boolean;

	/** Simplero customer-id til at koble adgangen til den ydre betalingskonto. */
	simpleroCustomerId?: string;

	/** Hvornår adgangsfelterne sidst blev opdateret af webhook eller migration. */
	updatedAt?: number;

	// Senest tidspunkt brugeren åbnede /app/spoergsmaal og så sine svar.
	// Bruges til at detektere ubeskrevne svar (svar.besvaretAt > dette).
	senestSpoergsmaalLaestAt?: number;

	// Vis udvidet næringsdata (kh/fedt/kcal) i 30-30-3, dagbog og udvikling.
	// Default false — basis-visningen er kun protein og fiber.
	visUdvidetNaering?: boolean;

	// Brugerens daglige mål for makro-næring. Kun aktiv når
	// visUdvidetNaering = true.
	dagligeMaal?: DagligeMaal;

	// Brugerens favorit-fødevare-ids. Vises filtrerbart i 30-30-3 Slå op
	// og markeres med en stjerne ved siden af fødevaren.
	favoritFodevarer?: string[];

	// Community-fødevarer brugeren har skjult fra sin oversigt (tryk på
	// skraldespand-knappen). Lokal-only skjul — den globale fødevare
	// slettes ikke i Firestore. Andre brugere ser stadig fødevaren.
	skjulteFodevarer?: string[];

	/**
	 * Test-features brugeren har adgang til før de er udrullet til alle.
	 * Liste af feature-keys (se src/lib/content/testFeatures.ts for kendte).
	 * Admin tildeler test-adgang via /admin/testere.
	 *
	 * I koden tjekkes med harTestAdgang(userDoc, 'feature-key'). Når en
	 * feature er produktionsklar fjerner vi tjekken fra koden — listen i
	 * Firestore bevares til næste test-runde.
	 */
	testerFeatures?: string[];

	// Hvilken mikrotræning-variant brugeren har valgt (kettlebell eller
	// uden udstyr). Bruges af aboMikrotraening-systemet til at hente det
	// rigtige program. Hvis ikke sat, bruges 'no_kettlebell' som default.
	mikrotraeningVariant?: 'kettlebell' | 'no_kettlebell';

	// For Kropsro-kunder (premiumforløb): ønsker hun en buddymakker hun kan
	// følges med gennem forløbet? Spørges ved første login som modal og
	// gemmes her. true = ja vil have, false = nej, undefined = ikke spurgt.
	kropsroBuddyOensker?: boolean;

	// For Kropsro-kunder: er hun kommet ind i Facebook-gruppen? Spørges på
	// dag 0 eller senere som modal. true = ja er inde, false = nej endnu
	// ikke, undefined = ikke spurgt endnu.
	kropsroFacebookGruppe?: boolean;

	// Snapshot af det input klienten gav til 'Beregn mine mål'-wizarden.
	// Bruges til at pre-udfylde wizarden næste gang den åbnes.
	brugerProfil?: BrugerProfil;

	// Når admin (Linn) bruger 'Skift til klient'-knappen lander dette
	// felt på hendes egen userDoc. Mens det er sat, scope'r alle
	// klient-data-helpers (måltider, vaner, mikrotræning-fremgang osv.)
	// deres læs/skriv-operationer til 'users/{uid}/adminKlient/{scope}/...'
	// så Linns admin-data ikke blandes sammen med klient-test-data.
	// Felt er KUN aktivt for admin-emails.
	//
	// scope = forløbsId hvis adminKlientMode='forlob', ellers '__basisapp'
	// eller '__premiumapp'. Sat samtidig med adminKlientMode.
	adminKlientForlobId?: string;

	/**
	 * Hvilken klient-oplevelse admin tester:
	 * - 'forlob': admin er klient på et specifikt forløb (forløbskunde)
	 * - 'basisapp': admin tester basis-app som modulbruger
	 * - 'premiumapp': admin tester premium-app som modulbruger
	 * Når feltet ikke er sat, er admin i normal admin-mode.
	 */
	adminKlientMode?: 'forlob' | 'basisapp' | 'premiumapp';

	/**
	 * Alle forløb brugeren nogensinde har været på (Kickstart, Premium-forløb,
	 * fremtidige forløb). Bruges af bibliotek-modulet til at vise materiale
	 * fra alle gennemførte forløb. SKAL aldrig overskrives — kun appendes.
	 * Webhook + sync-funktion bruger arrayUnion for at bevare historik.
	 */
	forlobIds?: string[];

	/**
	 * Hvilket træningsprogram brugeren har valgt som sit aktive program.
	 * Vises på forsiden og bestemmer hvilket program der startes når hun
	 * klikker på træning-modulet.
	 *
	 * kilde='mikrotraening' = det eksisterende abo-mikrotræningsprogram
	 * kilde='eget' = et selvbygget program (programId peger på users/{uid}/mineProgrammer/{programId})
	 * kilde='tildelt' = et admin-tildelt forløbsprogram (programId + forlobId)
	 *
	 * Hvis feltet ikke er sat, defaultes til mikrotræning (backwards-compat).
	 */
	aktivtTraeningsprogram?: {
		kilde: 'mikrotraening' | 'eget' | 'tildelt';
		programId?: string;
		forlobId?: string;
	};
}
