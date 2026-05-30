// "Mine køb"-listen på profil-siden. Mapper userDoc.activeProduct til en
// brugervenlig Koeb-entry — én pr. aktivt produkt. Tidligere version mappede
// fra UserState (modulbruger → hardcoded "Mikrotræning + Kost-modul"), men
// det er erstattet af det 4-produkt-model fra $lib/content/produkter.

import type { UserDoc, ActiveProduct } from '$lib/types';
import { PRODUKTER } from './produkter';
import { erIBonusPeriode, BONUS_PERIODE_DAGE } from '$lib/utils/userAdgang';

export type KoebType = 'forlob' | 'modul' | 'app';
export type KoebStatus = 'aktiv' | 'udlobet' | 'laeseadgang';

export interface Koeb {
	id: string;
	navn: string;
	kortNavn: string;
	type: KoebType;
	status: KoebStatus;
	lobende: boolean;
	udlobsdato?: string;
}

// Kunden ser bare 'App' uanset om hun har basisabo eller premiumabo.
// Forskellen mellem basis og premium er en intern adgangsdetalje der
// styrer hvilket indhold der vises — den behøver ikke fremgå af 'Mine
// køb' eller andre kunde-vendte labels.
const KORT_NAVN: Record<ActiveProduct, string> = {
	basisabo: 'App',
	premiumabo: 'App',
	kickstart: 'Kickstart',
	premiumforløb: 'Kropsro'
};

const VISNINGS_NAVN: Record<ActiveProduct, string> = {
	basisabo: 'App',
	premiumabo: 'App',
	kickstart: 'Kickstart en sund overgangsalder',
	premiumforløb: 'Kropsro'
};

function isoDato(ms: number): string {
	return new Date(ms).toISOString().slice(0, 10);
}

/**
 * True hvis brugeren er Kropsro-forlobskunde (har 'kropsro_'-id i forlobIds).
 * Bruges til at adskille fra premium-Kickstart-kunder der ogsaa har
 * activeProduct='premiumforløb' men er paa et Kickstart-forl0b.
 */
function erKropsroIfgForlobIds(userDoc: UserDoc): boolean {
	if (Array.isArray(userDoc.forlobIds) && userDoc.forlobIds.length > 0) {
		return userDoc.forlobIds.some((id) => id.startsWith('kropsro_'));
	}
	return userDoc.activeProduct === 'premiumforløb';
}

export function getKoebForUser(userDoc: UserDoc | null | undefined): Koeb[] {
	if (!userDoc) return [];

	const product = userDoc.activeProduct;

	// Premium-Kickstart-kunder skal vises som Kickstart, ikke Kropsro
	const premiumKickstart =
		product === 'premiumforløb' && !erKropsroIfgForlobIds(userDoc);
	const navn = premiumKickstart ? VISNINGS_NAVN.kickstart : product ? VISNINGS_NAVN[product] : '';
	const kortNavn = premiumKickstart ? KORT_NAVN.kickstart : product ? KORT_NAVN[product] : '';

	// Aktiv adgang: vis det nuværende produkt
	if (product && userDoc.accessLevel && userDoc.accessLevel !== 'none') {
		const produkt = PRODUKTER[product];
		if (!produkt) return [];

		const type: KoebType = produkt.accessSource === 'forløb' ? 'forlob' : 'app';
		const udlobsdato =
			produkt.accessSource === 'forløb' && userDoc.bonusPeriodEndsAt
				? isoDato(userDoc.bonusPeriodEndsAt - BONUS_PERIODE_DAGE * 24 * 60 * 60 * 1000)
				: undefined;

		return [
			{
				id: product,
				navn,
				kortNavn,
				type,
				status: 'aktiv',
				lobende: produkt.activeSubscription,
				udlobsdato
			}
		];
	}

	// Forløbskunde i bonus-periode efter forløb-slut: vis læseadgang
	if (product && erIBonusPeriode(userDoc) && PRODUKTER[product]?.accessSource === 'forløb') {
		return [
			{
				id: `${product}-laeseadgang`,
				navn,
				kortNavn,
				type: 'forlob',
				status: 'laeseadgang',
				lobende: false,
				udlobsdato: userDoc.bonusPeriodEndsAt ? isoDato(userDoc.bonusPeriodEndsAt) : undefined
			}
		];
	}

	return [];
}

export function formatUdlobsdato(dato: string): string {
	const d = new Date(dato);
	const maaneder = [
		'jan',
		'feb',
		'mar',
		'apr',
		'maj',
		'jun',
		'jul',
		'aug',
		'sep',
		'okt',
		'nov',
		'dec'
	];
	return `${d.getDate()}. ${maaneder[d.getMonth()]} ${d.getFullYear()}`;
}
