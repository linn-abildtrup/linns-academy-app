// Mapping fra Simplero-produkt-id til app-adgang.
// Bruger den centrale produkt-definition i $lib/content/produkter — tilføj
// nye produkter dér i stedet for her, så vi har én sandhedskilde.

import type { AccessLevel, AccessSource, ActiveProduct } from '$lib/types';
import { alleProdukter } from '$lib/content/produkter';

export interface ProduktAdgang {
	accessLevel: AccessLevel;
	accessSource: AccessSource;
	activeProduct: ActiveProduct;
	activeSubscription: boolean;
	forlobId?: string;
	navn: string;
}

/**
 * Findes Simplero-produktet i vores liste? Returnerer adgangs-felterne
 * webhook'en skal sætte på userDoc/allowedEmails — eller null hvis vi
 * ikke kender produktet (typisk fordi vi ikke har tilføjet det endnu).
 */
export function findProduktAdgang(produktId: string | number): ProduktAdgang | null {
	const id = String(produktId);
	const match = alleProdukter().find((p) => p.simpleroProduktId === id);
	if (!match) return null;
	return {
		accessLevel: match.accessLevel,
		accessSource: match.accessSource,
		activeProduct: match.activeProduct,
		activeSubscription: match.activeSubscription,
		forlobId: match.forlobId,
		navn: match.navn
	};
}
