// ============================================================
// Hurtig opstart af 3.0.
//
// Samme kur som den gamle app fik, se content/hurtigStart.ts, men /ny har en
// ekstra faelde der skal haandteres.
//
// PROBLEMET. Skallen i routes/ny/+layout.svelte henter tre ting i koe og uden
// tidsgraense: bruger-dokumentet fra SERVEREN, saa forloebene, og saa pause-
// dagene, som foerst kan hentes naar forloebene er hjemme fordi de skal bruge
// produkt-noeglerne. Tre ture efter hinanden. Foerst derefter forsvinder
// "Et oejeblik, jeg lukker dig ind". Alle tre ting ligger allerede i
// telefonens egen kopi, fordi Firestore gemmer hver doc i IndexedDB.
//
// FAELDEN. Vi kan ikke noejes med at hente bruger-dokumentet fra kopien og
// lukke op, som den gamle app goer. Spaerringen i 3.0 hviler paa regel 1 i
// spaerring3.ts: et aktivt forloeb vinder over alt. Er forloebene ikke hentet
// endnu, ser en Kropsro-kunde med udloebet abonnement ud som om hun ikke har
// noget forloeb, og saa ville hun faa "Din adgang er udloebet" at se midt i
// sit forloeb. Derfor hentes HELE billedet fra kopien, ikke kun det foerste
// led. Se firestore/hurtigStart3.ts.
//
// DEN ANDEN SIKKERHEDSREGEL. Vi aabner aldrig en LUKKET doer paa en kopi.
// Baade "Ikke aaben endnu" og "Din adgang er udloebet" skal bekraeftes af
// serveren, for en kopi kan vaere gammel, fx hvis hun lige har fornyet. Den
// anden vej er ufarlig: aabner vi appen paa en kopi der viser lidt for lidt,
// retter serveren det et oejeblik efter.
//
// Ingen udrulning bag flag her. /ny er allerede kun aaben for admin og de
// konti der har 'ny-app'-flaget, saa publikum ER testerne.
// ============================================================

import type { UserDoc } from '$lib/types';
import { harTestAdgang } from '$lib/utils/userAdgang';
import {
	adgangsbilledeFor,
	type Adgangsbillede,
	type ForlobKilde,
	type NulDageKilde
} from '$lib/content/adgang3';
import {
	vurderSpaerring,
	vurderTilstand,
	type SpaerringSvar,
	type Tilstand
} from '$lib/content/spaerring3';

/** Flaget der giver adgang til 3.0. Samme noegle som skallen bruger. */
export const NY_APP_FLAG = 'ny-app';

/** Alt skallen skal bruge for at vide hvilken skaerm kunden skal se. */
export interface OpstartsKilde {
	userDoc: UserDoc | null;
	forlob: ForlobKilde[];
	nulDage: NulDageKilde;
	erAdmin: boolean;
}

/** Den afgoerelse skallen traeffer, opgjort ét sted. */
export interface OpstartsBillede {
	adgang: Adgangsbillede;
	spaerring: SpaerringSvar;
	/** Har hun overhovedet lov til at se 3.0? */
	maaSeNyApp: boolean;
	/**
	 * Hvilken af de tre tilstande hun er i. Se SPEC 35 og spaerring3.
	 *
	 * fuld, bonus eller lukket. Foer fandtes kun fuld og lukket, og en
	 * kunde i sine 90 dage blev derfor lukket ude paa dag 1 i stedet for
	 * dag 91.
	 */
	tilstand: Tilstand;
	/** Skal hun moede "Din adgang er udloebet"? Det samme som lukket. */
	erSpaerret: boolean;
}

/**
 * Regner ud hvilken skaerm kunden skal se, ud fra det vi ved lige nu.
 *
 * Skallen bruger den til sine $derived, og den hurtige opstart bruger den til
 * at afgoere om kopien duer. Det er med vilje det SAMME kald begge steder, saa
 * de to aldrig kan naa frem til hver sit svar.
 */
export function opstartsBillede(kilde: OpstartsKilde, nu: number): OpstartsBillede {
	const d = kilde.userDoc;

	// Adgangsbilledet udledes af de felter der allerede staar paa kunden.
	// Ingen skrivninger, ingen migrering. Se SPEC-3.0.md afsnit 2.2.1.
	const adgang = adgangsbilledeFor(
		nu,
		{
			forlobIds: d?.forlobIds,
			aboKoebtAt: d?.aboKoebtAt,
			aboSlutterAt: d?.aboSlutterAt,
			aboProdukt: d?.aboProdukt,
			activeProduct: d?.activeProduct,
			activeSubscription: d?.activeSubscription,
			accessSource: d?.accessSource,
			bonusPeriodEndsAt: d?.bonusPeriodEndsAt,
			createdAt: d?.createdAt
		},
		kilde.forlob,
		kilde.nulDage
	);

	const spaerring = vurderSpaerring(
		{
			harApp: adgang.harApp,
			harAktivtForlob: adgang.aktiveForlob.length > 0,
			aboSlutterAt: d?.aboSlutterAt ?? null
		},
		nu
	);

	// Admin spaerres aldrig og saettes aldrig i bonus. Ellers kunne Linn
	// laase sig selv ude af sit eget vaerktoej med en forkert dato paa sin
	// egen konto, eller staa uden adgang til admin-siderne.
	const tilstand: Tilstand = kilde.erAdmin
		? 'fuld'
		: vurderTilstand(
				{
					harApp: adgang.harApp,
					harAktivtForlob: adgang.aktiveForlob.length > 0,
					aboSlutterAt: d?.aboSlutterAt ?? null,
					bonusSlutMs: d?.bonusPeriodEndsAt ?? null
				},
				nu
			);

	return {
		adgang,
		spaerring,
		maaSeNyApp: kilde.erAdmin || harTestAdgang(d, NY_APP_FLAG),
		tilstand,
		erSpaerret: tilstand === 'lukket'
	};
}

/**
 * Maa vi lukke kunden ind paa kopien, uden at vente paa serveren?
 *
 * Kun hvis kopien foerer til en AABEN doer. Begge de lukkede skaerme,
 * "Ikke aaben endnu" og "Din adgang er udloebet", skal bekraeftes af serveren
 * foer de vises. Se hovedkommentaren oeverst i filen.
 */
export function maaAabnePaaKopi3(kilde: OpstartsKilde, nu: number): boolean {
	if (!kilde.userDoc) return false;
	const billede = opstartsBillede(kilde, nu);
	if (!billede.maaSeNyApp) return false;
	// Bonus er en AABEN doer, bare en mindre. Den maa kopien godt vise med
	// det samme. Kun de to lukkede skaerme skal bekraeftes af serveren.
	if (billede.erSpaerret) return false;
	return true;
}
