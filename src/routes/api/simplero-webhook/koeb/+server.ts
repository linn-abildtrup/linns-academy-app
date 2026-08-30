// Webhook for Simplero-event "Purchase made" — første køb af et produkt.
// Slår produktet op i PRODUKT_MAPPING og sætter accessLevel + tilhørende
// felter på users/{uid} eller allowedEmails/{email}. For forløbs-køb tilføjes
// 90 dages bibliotek-bonus efter forløbets slut.

import type { RequestHandler } from '@sveltejs/kit';
import { json } from '@sveltejs/kit';
import {
	parseOgVerificer,
	uddragEmail,
	uddragProduktId,
	uddragKundeId,
	uddragNavn,
	gemILog,
	opdaterBrugerEllerWhitelist,
	tilMs
} from '$lib/server/simpleroWebhook';
import { findProduktAdgang } from '$lib/simplero/produktMapping';
import { FORLOB_KOEB_PRODUKTER } from '$lib/content/produkter';
import { forlobAdgangFelter, forlobSlutMs, bibliotekBonusSlutMs } from '$lib/content/forlobAdgang';
import { hentDoc, hentDocsHvorFeltLig } from '$lib/server/firestoreRest';
import { vaelgForlobForProdukt } from '$lib/content/forlobKoeb';
import type { AccessLevel, AccessSource } from '$lib/types';

const EVENT = 'purchase.made';

// Adgangs-felter webhooken skriver — enten fra et fast type-produkt
// (findProduktAdgang) eller udledt fra et hold-forløb (forlobAdgangFelter).
interface KoebFelter {
	accessLevel: AccessLevel;
	accessSource: AccessSource;
	activeProduct: string;
	activeSubscription: boolean;
	forlobId?: string;
	navn: string;
}

export const POST: RequestHandler = async ({ request }) => {
	const res = await parseOgVerificer(request, EVENT);
	if (!res.ok) return res.response;
	const { payload } = res;

	const email = uddragEmail(payload);
	const produktId = uddragProduktId(payload);
	const kundeId = uddragKundeId(payload);

	if (!email) {
		await gemILog(EVENT, payload, 'skipped', 'mangler email');
		return json({ ok: true, status: 'skipped', reason: 'no email' });
	}
	if (!produktId) {
		await gemILog(EVENT, payload, 'skipped', 'mangler produktId');
		return json({ ok: true, status: 'skipped', reason: 'no productId' });
	}

	// 1) Faste type-produkter (basis/premium-abo, generisk Kickstart/Kropsro).
	let felter: KoebFelter | null = findProduktAdgang(produktId);

	// 2) Ellers: et hold-specifikt forløbskøb (fx "Fra Kickstart til Kropsro").
	//    Slå forlobId op og UDLED adgangen fra forløbet selv, så niveau +
	//    data-skuffe altid matcher forløbets opsætning og den manuelle import.
	let forlobUdloeb: { expiresAt: number; bonus: number } | null = null;
	let holdNote = '';
	if (!felter) {
		// 2a) Holdet staar selv med Simplero-nummeret, og fluebenet "Aktivt
		//     forloeb" afgoer hvem der tager imod. Linn saelger hvert nyt
		//     Kickstart-hold under SAMME produkt, saa koblingen kan ikke staa i
		//     koden. Se content/forlobKoeb.ts. Linns beslutning 30. august 2026.
		//
		// 2b) Ellers den gamle faste tabel, saa "Fra Kickstart til Kropsro"
		//     virker praecis som foer.
		let forlobId: string | undefined;
		let f: Record<string, unknown> | null = null;
		try {
			const raekker = await hentDocsHvorFeltLig('forlob', 'simpleroProduktId', String(produktId));
			const valg = vaelgForlobForProdukt(
				raekker.map((r) => ({
					id: r.id,
					navn: r.data.navn as string | undefined,
					aktiv: r.data.aktiv as boolean | undefined,
					startMs: tilMs(r.data.startDato),
					antalDage: (r.data.antalDage as number) ?? 0
				}))
			);
			holdNote = valg.begrundelse;
			if (valg.valgt) {
				forlobId = valg.valgt.id;
				f = raekker.find((r) => r.id === valg.valgt?.id)?.data ?? null;
			}
		} catch (e) {
			// Kan vi ikke slaa hold op, falder vi tilbage paa den faste tabel i
			// stedet for at afvise koebet.
			console.warn('Kunne ikke slaa hold op paa Simplero-nummer:', e);
			holdNote = 'opslag paa holdets nummer fejlede';
		}
		if (!forlobId) {
			forlobId = FORLOB_KOEB_PRODUKTER[String(produktId)];
			f = forlobId ? await hentDoc(`forlob/${forlobId}`) : null;
		}
		if (forlobId && f) {
			const udledt = forlobAdgangFelter({
				type: f.type as 'kickstart' | 'kropsro' | undefined,
				adgangsNiveau: f.adgangsNiveau as 'basis' | 'premium' | undefined,
				byggetForlob: f.byggetForlob as boolean | undefined,
				produktNoegle: f.produktNoegle as string | undefined
			});
			felter = { ...udledt, forlobId, navn: (f.navn as string) ?? forlobId };
			// Sæt udløb + bonus fra DETTE forløb med det samme (samme formel som
			// login-sync, så intet divergerer). Afgørende for gnidningsfri
			// overgang: en kunde der køber mens hun er på fx Kickstart har en
			// kortere udløbsdato — uden dette ville den lukke adgangen ved midnat,
			// FØR det nye forløb tager over. Nu skubbes udløbet frem ved købet.
			const startMs = tilMs(f.startDato);
			const antalDage = (f.antalDage as number) ?? 0;
			if (startMs > 0 && antalDage > 0) {
				forlobUdloeb = {
					expiresAt: forlobSlutMs(startMs, antalDage),
					bonus: bibliotekBonusSlutMs(startMs, antalDage)
				};
			}
		}
	}

	if (!felter) {
		// Noten skal kunne laeses af Linn i webhook-loggen, saa hun kan se om
		// det er nummeret der mangler paa holdet, eller fluebenet der staar
		// forkert.
		const grund = holdNote ? `ukendt produkt ${produktId}: ${holdNote}` : `ukendt produkt ${produktId}`;
		await gemILog(EVENT, payload, 'skipped', grund);
		return json({ ok: true, status: 'skipped', reason: 'unknown product', produktId });
	}

	const opdatering: Record<string, unknown> = {
		accessLevel: felter.accessLevel,
		accessSource: felter.accessSource,
		activeProduct: felter.activeProduct,
		activeSubscription: felter.activeSubscription,
		// state-feltet skrives ikke laengere (A2 etape B) - effektivState
		// udleder tilstanden af accessLevel/accessSource.
		paymentFailedAt: null,
		updatedAt: Date.now()
	};
	if (kundeId) opdatering.simpleroCustomerId = kundeId;
	// Hold-forløbskøb: skub udløb + bonus frem til DETTE forløb (se ovenfor).
	// Kun for forløbs-grenen — abo-flowet røres ikke (det bruger adgangFra).
	if (forlobUdloeb) {
		opdatering.expiresAt = forlobUdloeb.expiresAt;
		opdatering.bonusPeriodEndsAt = forlobUdloeb.bonus;
	}
	const navn = uddragNavn(payload);
	if (navn.firstName) opdatering.firstName = navn.firstName;
	if (navn.lastName) opdatering.lastName = navn.lastName;

	// Abo-køb: gem købsdato + periode-slutdato fra Simplero, så "Dit abonnement"
	// kan vise dem og vi kender hvornår adgangen bør slutte. Kun for abonnementer
	// (forløbs-køb styrer udløb via forløbet selv).
	if (felter.accessSource === 'abonnement') {
		const koebtAt = tilMs(payload.purchased_at);
		const slutterAt = tilMs(payload.period_ends_at);
		if (koebtAt > 0) opdatering.aboKoebtAt = koebtAt;
		if (slutterAt > 0) opdatering.aboSlutterAt = slutterAt;
		// Bevar abo-produkt/niveau så vi kan skifte tilbage til app efter et forløb.
		opdatering.aboProdukt = felter.activeProduct;
		opdatering.aboAccessLevel = felter.accessLevel;
	}

	// A4-oprydning: webhook'en saetter IKKE laengere bonusPeriodEndsAt selv.
	// Den blev tidligere udledt af Simperos period_ends_at, mens login-sync
	// udleder den af forloebets startdato + antal dage. To kilder kunne give
	// forskellige datoer. Nu er login-sync (synkroniserForlobskundeStatus i
	// $lib/userDoc) den ENESTE kilde - den saetter expiresAt + bonus fra
	// forloebet foerste gang kunden logger ind (selv-helbredende).

	// Køber kunden et app-ABONNEMENT mens hun stadig er på et aktivt forløb,
	// styres overgangen nu af den dato-baserede resolver i login-sync: hun
	// forbliver forløbskunde til forløbet slutter, hvorefter abo'en tager over
	// (afløser den gamle adgangFra-parkering). Vi skriver derfor bare abo-felterne.
	await opdaterBrugerEllerWhitelist(email, opdatering, felter.forlobId);
	await gemILog(EVENT, payload, 'granted', `${felter.navn} til ${email}`);

	return json({
		ok: true,
		status: 'granted',
		email,
		produkt: felter.navn,
		accessLevel: felter.accessLevel
	});
};

// GET så Simperos test-ping rammer 200 OK før webhooken godkendes
export const GET: RequestHandler = async () => {
	return json({ ok: true, message: 'Simplero koeb-webhook klar' });
};
