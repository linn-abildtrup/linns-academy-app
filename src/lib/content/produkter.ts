// Central definition af de 4 produkter brugeren kan købe og hvilken adgang
// hver giver. Bruges som single source of truth — UI-låsninger, webhook-
// mapping og dokumentation skal alle pege herhen.
//
// De 4 produkter:
//   1. Basis-app (abonnement)        → modulbruger på basis-niveau
//   2. Premium-app (abonnement)      → modulbruger på premium-niveau
//   3. Kickstart-forløb (engangs)    → forløbskunde på basis-niveau
//   4. Premium-forløb (engangs)      → forløbskunde på premium-niveau
//
// accessLevel + accessSource bestemmer UI-varianten:
//   - source='forløb'      → forløbskunde-UI (variant A1: strip + dagens lektion)
//   - source='abonnement'  → modulbruger-UI (variant B: modul-grid)
//   - level='premium'      → unlocker premium-only features ovenpå basis

import type { AccessLevel, AccessSource, ActiveProduct } from '$lib/types';

export interface Produkt {
	/** Intern ID brugt i kode + Firestore. */
	activeProduct: ActiveProduct;
	/** Visningsnavn brugt i UI og logs. */
	navn: string;
	/** Niveau af app-indhold. */
	accessLevel: AccessLevel;
	/** Hvor adgangen kommer fra — bestemmer UI-variant. */
	accessSource: AccessSource;
	/** True hvis det er et løbende abonnement (modsat engangs-forløbskøb). */
	activeSubscription: boolean;
	/** Simplero-produkt-id der sender webhooks for dette produkt.
	 *  null hvis produktet endnu ikke er oprettet i Simplero. */
	simpleroProduktId: string | null;
	/** Forløb-id i appens forlob-collection (kun for forløbs-produkter). */
	forlobId?: string;
	/** Kort beskrivelse til admin-oversigt. */
	beskrivelse: string;
}

export const PRODUKTER: Record<ActiveProduct, Produkt> = {
	basisabo: {
		activeProduct: 'basisabo',
		navn: 'Basis-app (abonnement)',
		accessLevel: 'basis',
		accessSource: 'abonnement',
		activeSubscription: true,
		simpleroProduktId: '255519',
		beskrivelse: 'Løbende abonnement på basis-app — mikrotræning, kost, vaner og personligt bibliotek.'
	},
	premiumabo: {
		activeProduct: 'premiumabo',
		navn: 'Premium-app (abonnement)',
		accessLevel: 'premium',
		accessSource: 'abonnement',
		activeSubscription: true,
		simpleroProduktId: null, // TODO: oprettes i Simplero
		beskrivelse: 'Løbende abonnement på premium-app — alt i basis + flere træningsprogrammer, udvidet næringsdata, udvidet vanetracker, Linn AI.'
	},
	kickstart: {
		activeProduct: 'kickstart',
		navn: 'Kickstart-forløb',
		accessLevel: 'basis',
		accessSource: 'forløb',
		activeSubscription: false,
		simpleroProduktId: null, // TODO: oprettes i Simplero
		forlobId: 'kickstart_maj_2026',
		beskrivelse: 'Engangskøb af 21-dages Kickstart-forløb — alt i basis + Mit forløb, beskeder og FAQ.'
	},
	premiumforløb: {
		activeProduct: 'premiumforløb',
		navn: 'Premium-forløb',
		accessLevel: 'premium',
		accessSource: 'forløb',
		activeSubscription: false,
		simpleroProduktId: null, // TODO: oprettes i Simplero
		forlobId: 'kropsro_maj_2026',
		beskrivelse: 'Engangskøb af premium-forløb — alt i Kickstart + premium-features (træningsprogram-valg, næring, vanetracker, Linn AI).'
	}
};

// ============================================================
// Adgangs-matrix — hvad hver klient-type har adgang til
// ============================================================
//
// Brug helpers fra $lib/utils/userAdgang når du tjekker adgang i UI'et:
//   - erForlobsklient(userDoc) → vis Mit forløb + Beskeder + FAQ
//   - erModulbruger(userDoc)   → vis modul-grid forside
//   - harPremium(userDoc)      → vis premium-only features (se nedenfor)
//   - harBasisAdgang(userDoc)  → vis alt der er basis eller premium
//
//                                 Basis-abo  Premium-abo  Kickstart  Premium-forløb
// Mikrotræning                       ✅          ✅           ✅           ✅
// Kost                               ✅          ✅           ✅           ✅
// Vaner (basis-tracker)              ✅          ✅           ✅           ✅
// Personligt bibliotek               ✅          ✅           ✅           ✅
// Mit forløb (modul)                 🔒          🔒           ✅           ✅
// Beskeder (TabBar-fane)             🔒          🔒           ✅           ✅
// FAQ-fane i bibliotek               🚫          🚫           ✅           ✅
//
// Premium-only (kommer):
// - Vælg/sammensæt eget træningsprogram (premium kan vælge ud over standard)
// - Udvidet næringsdata (kh/fedt/kcal — basis ser kun protein/fiber)
// - Udvidet vanetracker (basis-deling besluttes senere)
// - Linn AI (kommer senere)
//
// Når premium-features bygges: tilføj harPremium()-tjek i de relevante komponenter
// og opdater matrixen ovenfor.

export function findProduktAfId(activeProduct: ActiveProduct): Produkt {
	return PRODUKTER[activeProduct];
}

export function alleProdukter(): Produkt[] {
	return Object.values(PRODUKTER);
}

export function produkterMedSimpleroId(): Produkt[] {
	return alleProdukter().filter((p) => p.simpleroProduktId !== null);
}
