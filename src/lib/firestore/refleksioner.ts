// Henter klienternes refleksionssvar for ét forloeb.
//
// Svarene ligger spredt: spoergsmaalet paa forloebet, svaret i hver enkelt
// kundes dataskuffe. Den her fil samler dem. Alt det rene arbejde bagefter
// (afgraensning, gruppering, CSV) ligger i $lib/content/refleksioner.
//
// Kun admin kan laese andres vanedage, se firestore.rules. Kunden selv
// bruger aldrig den her fil.

import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '$lib/firebase';
import type { Refleksionssvar } from '$lib/content/refleksioner';
import type { Forlob } from '$lib/content/forlobAdgang';
import { produktTypeForForlob } from '$lib/content/forlobAdgang';

export interface RefleksionsHentning {
	svar: Refleksionssvar[];
	/** Antal klienter paa holdet, ogsaa dem der intet har skrevet. */
	antalKlienter: number;
}

/** Spoergsmaalene: dagNummer til refleksionstekst. Dage uden staar ikke i map'et. */
async function hentSpoergsmaal(forlobId: string): Promise<Map<number, string>> {
	const snap = await getDocs(collection(db, 'forlob', forlobId, 'vaneprogram'));
	const map = new Map<number, string>();
	for (const d of snap.docs) {
		const data = d.data() as { dagNummer?: number; reflection?: string };
		const tekst = (data.reflection ?? '').trim();
		if (typeof data.dagNummer === 'number' && tekst) map.set(data.dagNummer, tekst);
	}
	return map;
}

/** Navnet vi viser. Falder tilbage til mailen hvis kunden intet navn har. */
function klientNavn(data: { firstName?: string; lastName?: string; email?: string }): string {
	const navn = `${data.firstName ?? ''} ${data.lastName ?? ''}`.trim();
	return navn || (data.email ?? 'Ukendt');
}

/**
 * Alle skrevne refleksionssvar paa et forloeb.
 *
 * Skuffe-navnet udledes af forloebet (produktTypeForForlob), saa byggede
 * forloeb med egen noegle rammer rigtigt. Tomme svar springes over — en
 * vanedag findes ogsaa naar kunden kun har sat flueben.
 */
export async function hentRefleksioner(forlob: Forlob): Promise<RefleksionsHentning> {
	const skuffe = produktTypeForForlob(forlob);
	const [spoergsmaal, klienter] = await Promise.all([
		hentSpoergsmaal(forlob.id),
		getDocs(query(collection(db, 'users'), where('forlobIds', 'array-contains', forlob.id)))
	]);

	const svar: Refleksionssvar[] = [];
	// Ét opslag pr klient. Holdene er paa 15-35 kunder, saa det er hurtigt nok
	// til en admin-side, og vi undgaar en collectionGroup-regel paa vanedage.
	const dage = await Promise.all(
		klienter.docs.map((k) =>
			getDocs(collection(db, 'users', k.id, 'products', skuffe, 'vanedage')).catch(() => null)
		)
	);

	klienter.docs.forEach((k, i) => {
		const snap = dage[i];
		if (!snap) return;
		const kunde = k.data() as { firstName?: string; lastName?: string; email?: string };
		for (const d of snap.docs) {
			const data = d.data() as {
				dagNummer?: number;
				note?: string;
				savedAt?: { toMillis?: () => number; seconds?: number };
			};
			const tekst = (data.note ?? '').trim();
			if (!tekst || typeof data.dagNummer !== 'number') continue;
			const gemtMs =
				data.savedAt?.toMillis?.() ??
				(data.savedAt?.seconds ? data.savedAt.seconds * 1000 : null);
			svar.push({
				uid: k.id,
				navn: klientNavn(kunde),
				email: kunde.email ?? '',
				dagNummer: data.dagNummer,
				spoergsmaal: spoergsmaal.get(data.dagNummer) ?? '',
				svar: tekst,
				gemtMs
			});
		}
	});

	return { svar, antalKlienter: klienter.size };
}
