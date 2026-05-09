// Mapping fra Simplero-produkt-id til app-adgang.
// Når en kunde køber et produkt i Simplero, sendes en webhook med produkt-id.
// Vi slår produktet op her og giver kunden den tilsvarende adgang i appen.
//
// Tilføj nye produkter ved at finde produkt-id'et i Simplero (det står i URL'en
// når du redigerer produktet, fx /admin/products/255519) og tilføje en linje
// her med den ønskede adgangs-konfiguration.

import type { AccessLevel, AccessSource, ActiveProduct } from '$lib/types';

export interface ProduktAdgang {
	/** Niveau af app-indhold brugeren får adgang til. */
	accessLevel: AccessLevel;
	/** Hvor adgangen kommer fra — bestemmer UI-variant på forsiden. */
	accessSource: AccessSource;
	/** Det specifikke produkt der gav adgangen. */
	activeProduct: ActiveProduct;
	/** True hvis det er et løbende abonnement (modsat engangs-forløbskøb). */
	activeSubscription: boolean;
	/** Forløb-id hvis kunden skal kobles til et specifikt forløb. */
	forlobId?: string;
	/** Produktnavn til visning i admin og logs. */
	navn: string;
}

export const PRODUKT_MAPPING: Record<string, ProduktAdgang> = {
	'255519': {
		accessLevel: 'basis',
		accessSource: 'abonnement',
		activeProduct: 'basisabo',
		activeSubscription: true,
		navn: 'Basis-abonnement (basis-app)'
	}
	// Tilføj fremtidige produkter her:
	// '...': { accessLevel: 'premium', accessSource: 'abonnement', ... },
};

export function findProduktAdgang(produktId: string | number): ProduktAdgang | null {
	const id = String(produktId);
	return PRODUKT_MAPPING[id] ?? null;
}
