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
	hentAktivtForlobSlut,
	parkerAboTilEfterForlob,
	tilMs
} from '$lib/server/simpleroWebhook';
import { findProduktAdgang } from '$lib/simplero/produktMapping';
import { FORLOB_KOEB_PRODUKTER } from '$lib/content/produkter';
import { forlobAdgangFelter, forlobSlutMs, bibliotekBonusSlutMs } from '$lib/content/forlobAdgang';
import { hentDoc } from '$lib/server/firestoreRest';
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
	if (!felter) {
		const forlobId = FORLOB_KOEB_PRODUKTER[String(produktId)];
		const f = forlobId ? await hentDoc(`forlob/${forlobId}`) : null;
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
		await gemILog(EVENT, payload, 'skipped', `ukendt produkt ${produktId}`);
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
	// skal appen først tage over DAGEN EFTER forløbet er afsluttet (hold-slut +
	// kundens pause-dage). Vi parkerer derfor abo'en på whitelisten med adgangFra
	// og holder forløbet åbent — login-synk aktiverer abo'en på det rigtige
	// tidspunkt. Gælder kun abonnementer (basis + premium), ikke forløbs-køb.
	if (felter.accessSource === 'abonnement') {
		const forlobSlut = await hentAktivtForlobSlut(email);
		if (forlobSlut > Date.now()) {
			await parkerAboTilEfterForlob(email, opdatering, forlobSlut);
			await gemILog(
				EVENT,
				payload,
				'granted',
				`${felter.navn} til ${email} — parkeret til ${new Date(forlobSlut).toISOString().slice(0, 10)} (aktivt forløb)`
			);
			return json({
				ok: true,
				status: 'granted',
				email,
				produkt: felter.navn,
				accessLevel: felter.accessLevel,
				parkeretTil: forlobSlut
			});
		}
	}

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
