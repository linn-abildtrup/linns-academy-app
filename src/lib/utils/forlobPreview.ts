// Admin-preview-mode for forløbsdage.
//
// Admin kan tilgå klient-flow for et forløb via 'Skift til klient' (sætter
// adminKlientForlobId på sin userDoc). Normalt respekterer klient-flowet
// forløbets dag-lås, så fremtidige dage er utilgængelige.
//
// Preview-mode lader admin se vilkårlige dage som om de var låst op.
// Aktiveres med URL-parameter ?previewDag=N. Banneret 'PREVIEW: Dag N'
// vises i top, med pile til at navigere.
//
// Sikkerhed: koden tjekker selv om brugeren er admin OG i klient-mode for
// et forløb før den honorerer previewDag. En kunde der manuelt skriver
// ?previewDag=42 i adressen får intet ud af det.

import type { UserDoc } from '$lib/types';

/**
 * True hvis brugeren er admin der i øjeblikket tester et forløb som klient.
 * Kun da har preview-mode betydning.
 */
export function erIPreviewKontekst(userDoc: UserDoc | null | undefined, erAdmin: boolean): boolean {
	if (!erAdmin) return false;
	return userDoc?.adminKlientMode === 'forlob' && !!userDoc?.adminKlientForlobId;
}

/**
 * Læser ?previewDag=N fra URL'en hvis admin er i preview-kontekst.
 * Returnerer null hvis ikke admin, ikke i klient-mode, eller param mangler.
 */
export function getPreviewDag(
	searchParams: URLSearchParams,
	userDoc: UserDoc | null | undefined,
	erAdmin: boolean
): number | null {
	if (!erIPreviewKontekst(userDoc, erAdmin)) return null;
	const raw = searchParams.get('previewDag');
	if (raw === null) return null;
	const n = parseInt(raw, 10);
	if (!Number.isFinite(n) || n < 0) return null;
	return n;
}

/**
 * Returnerer hvor mange dage der skal være åbnet, evt overstyret af preview.
 * Bruges som drop-in erstatning for unlockedDays() når preview er aktivt.
 */
export function effektivtUnlocket(
	naturligtUnlocket: number,
	previewDag: number | null,
	antalDage: number
): number {
	if (previewDag === null) return naturligtUnlocket;
	return Math.max(naturligtUnlocket, Math.min(previewDag, antalDage));
}
