// Kunderne set fra admin, til traeningens tildeling. Bid 2, 15. august 2026.
//
// To ting:
//   1. En liste over alle kunder, saa Linn kan soege efter én at tildele til
//   2. Hele billedet for én kunde, saa admin-opslaget kan svare paa
//      hvorfor hun ikke kan se sin traening
//
// ADGANGEN UDLEDES MED DE SAMME FUNKTIONER SOM RESTEN AF 3.0.
// adgangsbilledeFor giver hendes aktive forloeb med dagnummer, og
// udledAdgange giver raekkerne saa vi kan se om hun har et aktivt
// abonnement. To udgaver af den regel ville drive fra hinanden, og saa
// ville admin sige noget andet end kunden faktisk oplever.
//
// Hele bruger-samlingen hentes paa én gang. Det er det samme som de
// oevrige admin-sider goer, og det er ét kald mod cirka 700 dokumenter.

import { collection, getDocs } from 'firebase/firestore';
import { db } from '$lib/firebase';
import type { UserDoc } from '$lib/types';
import { produktTypeForForlob, type Forlob } from '$lib/content/forlobAdgang';
import {
	adgangsbilledeFor,
	erAktiv,
	udledAdgange,
	type ForlobKilde,
	type KundeFelter
} from '$lib/content/adgang3';
import type { KundeKontekst3 } from '$lib/content/traeningTildeling3';

export interface Klient3 {
	uid: string;
	navn: string;
	email: string;
	/** Alt hvad der skal kunne soeges i, samlet i én streng. */
	soegetekst: string;
	felter: KundeFelter;
}

function navnFor(doc: Partial<UserDoc>): string {
	const fornavn = (doc.firstName ?? '').trim();
	const efternavn = (doc.lastName ?? '').trim();
	const samlet = `${fornavn} ${efternavn}`.trim();
	return samlet || (doc.email ?? '');
}

/** Alle kunder, til soegefeltet. */
export async function hentKlienter3(): Promise<Klient3[]> {
	const snap = await getDocs(collection(db, 'users'));
	return snap.docs.map((d) => {
		const data = d.data() as Partial<UserDoc> & KundeFelter;
		const navn = navnFor(data);
		const email = data.email ?? '';
		return {
			uid: d.id,
			navn,
			email,
			soegetekst: `${navn} ${email}`,
			felter: {
				forlobIds: data.forlobIds ?? [],
				aboKoebtAt: data.aboKoebtAt,
				aboSlutterAt: data.aboSlutterAt,
				aboProdukt: data.aboProdukt,
				activeProduct: data.activeProduct,
				activeSubscription: data.activeSubscription,
				accessSource: data.accessSource,
				bonusPeriodEndsAt: data.bonusPeriodEndsAt,
				createdAt: data.createdAt
			}
		};
	});
}

/** Forloebene i den form adgangs-udledningen vil have dem. */
export function forlobKilder3(forlob: Forlob[]): ForlobKilde[] {
	return forlob
		.filter((f) => f.startDato && f.antalDage > 0)
		.map((f) => ({
			id: f.id,
			navn: f.navn,
			startMs: f.startDato.toDate().getTime(),
			antalDage: f.antalDage,
			produkt: produktTypeForForlob(f)
		}));
}

/** YYYY-MM-DD for et tidspunkt, i lokal tid. */
export function isoDato3(nu: number): string {
	const d = new Date(nu);
	const maaned = String(d.getMonth() + 1).padStart(2, '0');
	const dag = String(d.getDate()).padStart(2, '0');
	return `${d.getFullYear()}-${maaned}-${dag}`;
}

/**
 * Hele billedet for én kunde, i den form tildelings-reglerne vil have det.
 *
 * Udstyret staar tomt indtil kunden kan vaelge det i bid 3. En tom liste
 * betyder "hun har ikke valgt endnu", og reglen siger at hun saa ser alt.
 * Det er med vilje: ellers ville opslaget paastaa at ingen kunde har
 * nogen traening.
 */
export function kundeKontekst3(
	klient: Klient3,
	forlob: ForlobKilde[],
	nu: number
): KundeKontekst3 {
	const billede = adgangsbilledeFor(nu, klient.felter, forlob);
	const harAbonnement = udledAdgange(klient.felter, forlob).some(
		(a) => a.art === 'abo' && erAktiv(a, nu)
	);
	return {
		uid: klient.uid,
		forlob: billede.aktiveForlob.map((f) => ({ id: f.forlobId, dag: f.dagNummer })),
		harAbonnement,
		udstyr: [],
		idag: isoDato3(nu)
	};
}

/** Hendes aktive forloeb med navn, til overskriften paa opslaget. */
export function aktiveForlobNavne3(
	klient: Klient3,
	forlob: ForlobKilde[],
	nu: number
): { navn: string; dag: number }[] {
	return adgangsbilledeFor(nu, klient.felter, forlob).aktiveForlob.map((f) => ({
		navn: f.navn,
		dag: f.dagNummer
	}));
}
