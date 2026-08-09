// ============================================================
// Challenge til 3.0-forsiden.
//
// Der er to steder en challenge kan bo:
//
//   challenges/{id}              — den nye. Ligger for sig selv og
//                                  bliver tildelt til hold, til enkelte
//                                  kunder eller til alle der har appen.
//   forlob/{id}/challenges/{id}  — den gamle. Hoerer til ét forloeb.
//
// Vi laeser begge. De gamle bliver liggende praecis hvor de er, saa
// juni-challenge'ns 28 indtastninger er uroerte og den gamle app ikke
// opdager noget. Nye challenges laves kun det nye sted.
//
// Bemaerk ogsaa at den gamle hentChallenges kun laeser de felter den
// kender, og maal er ikke en af dem. Derfor laeser vi selv her.
// ============================================================

import {
	arrayRemove,
	arrayUnion,
	collection,
	doc,
	getDoc,
	getDocs,
	serverTimestamp,
	setDoc,
	Timestamp
} from 'firebase/firestore';
import { db } from '$lib/firebase';
import { beregnStilling, challengeDisplayNavn } from '$lib/content/challenge';
import {
	hentAlleIndtastninger,
	hentMinIndtastning,
	normaliserFoedevareListe,
	opdaterMinIndtastning
} from '$lib/firestore/challenge';
import {
	dageTilbage,
	erIGang,
	maalFor,
	rammerKunde,
	type Challenge3,
	type ChallengeForside,
	type KundeKontekst,
	type MasterChallenge,
	type Modtager
} from '$lib/content/challenge3';

/** Hvor challenge'n bor. Afgoer hvor indtastningerne skal skrives. */
export type ChallengeKilde = 'master' | 'forlob';

export interface AktivChallenge {
	kilde: ChallengeKilde;
	/** Sat naar kilden er forlob. Tom ved master. */
	forlobId: string;
	challenge: Challenge3 | MasterChallenge;
}

function laesModtagere(raa: unknown): Modtager[] {
	if (!Array.isArray(raa)) return [];
	return raa
		.filter((m): m is Record<string, unknown> => typeof m === 'object' && m !== null)
		.map((m) => ({
			type: m.type as Modtager['type'],
			id: typeof m.id === 'string' ? m.id : ''
		}))
		.filter((m) => m.type === 'kunde' || m.type === 'forlob' || m.type === 'alle-app');
}

function fraMasterDoc(id: string, data: Record<string, unknown>): MasterChallenge {
	return {
		id,
		navn: (data.navn as string) ?? '',
		beskrivelse: (data.beskrivelse as string) ?? '',
		startDato: (data.startDato as Timestamp) ?? null,
		slutDato: (data.slutDato as Timestamp) ?? null,
		aktiv: (data.aktiv as boolean) ?? false,
		maal: typeof data.maal === 'number' ? data.maal : undefined,
		fravalgteBrugere: (data.fravalgteBrugere as string[]) ?? [],
		modtagere: laesModtagere(data.modtagere)
	};
}

function fraForlobDoc(forlobId: string, id: string, data: Record<string, unknown>): Challenge3 {
	return {
		id,
		forlobId,
		navn: (data.navn as string) ?? '',
		beskrivelse: (data.beskrivelse as string) ?? '',
		startDato: data.startDato as Timestamp,
		slutDato: data.slutDato as Timestamp,
		aktiv: (data.aktiv as boolean) ?? false,
		fravalgteBrugere: (data.fravalgteBrugere as string[]) ?? [],
		oprettet: data.oprettet as Timestamp | undefined,
		opdateret: data.opdateret as Timestamp | undefined,
		maal: typeof data.maal === 'number' ? data.maal : undefined
	};
}

/** Alle master-challenges. Der er faa af dem, saa vi henter dem samlet. */
export async function hentMasterChallenges(): Promise<MasterChallenge[]> {
	const snap = await getDocs(collection(db, 'challenges'));
	return snap.docs.map((d) => fraMasterDoc(d.id, d.data()));
}

/**
 * Den challenge der koerer for kunden lige nu, hvis der er en.
 *
 * En ny slaar en gammel. Har Linn tildelt en challenge til hele appen,
 * og der samtidig ligger en gammel paa hendes forloeb, er det den nye
 * hun ser. Ellers ville de gamle blokere for de nye i al fremtid.
 */
export async function hentAktivChallenge3(
	kunde: KundeKontekst,
	nu: number
): Promise<AktivChallenge | null> {
	try {
		const master = await hentMasterChallenges();
		const truffet = master.find((c) => erIGang(c, nu) && rammerKunde(c, kunde));
		if (truffet) return { kilde: 'master', forlobId: '', challenge: truffet };
	} catch (e) {
		// Findes samlingen ikke endnu, eller mangler reglen, falder vi
		// tilbage til de gamle i stedet for at vise ingenting.
		console.warn('[ny] kunne ikke laese master-challenges', e);
	}

	for (const forlobId of kunde.forlobIds) {
		try {
			const snap = await getDocs(collection(db, 'forlob', forlobId, 'challenges'));
			for (const d of snap.docs) {
				const c = fraForlobDoc(forlobId, d.id, d.data());
				if (erIGang(c, nu)) return { kilde: 'forlob', forlobId, challenge: c };
			}
		} catch (e) {
			console.warn('[ny] kunne ikke laese challenges paa forloeb', forlobId, e);
		}
	}
	return null;
}

/**
 * Skal vi hente hele stillingen allerede paa forsiden.
 *
 * Vigtigt for driften: stillingen kraever ét opslag pr deltager. Paa et
 * hold med 28 er det ingenting. Gaar challenge'n til alle der har appen,
 * er det 600 til 700 opslag hver eneste gang en kunde aabner forsiden,
 * og det bliver dyrt uden at give hende noget hun ikke kan faa ved at
 * trykke paa knappen.
 *
 * Saa: paa et hold viser vi hendes plads med det samme. Gaar den til
 * alle, henter vi foerst stillingen naar hun selv beder om den.
 */
export function stillingPaaForsiden(aktiv: AktivChallenge): boolean {
	if (aktiv.kilde === 'forlob') return true;
	const c = aktiv.challenge as MasterChallenge;
	return !c.modtagere.some((m) => m.type === 'alle-app');
}

/**
 * Alt forsiden skal bruge, eller null hvis der ikke koerer nogen
 * challenge for hende.
 */
export async function hentChallengeTilForside(
	kunde: KundeKontekst,
	nu: number
): Promise<(ChallengeForside & { kilde: ChallengeKilde; forlobId: string }) | null> {
	const aktiv = await hentAktivChallenge3(kunde, nu);
	if (!aktiv) return null;
	const c = aktiv.challenge;

	const mine = await hentMinePlanter(aktiv, kunde.uid);
	// arrayUnion laegger nye planter bagest, saa den sidste er den nyeste.
	const unikke = new Set(mine);

	let plads: number | null = null;
	let antalDeltagere = 0;
	if (stillingPaaForsiden(aktiv)) {
		try {
			const stilling = await hentStilling(aktiv, kunde.uid);
			antalDeltagere = stilling.length;
			const min = stilling.findIndex((r) => r.erMig);
			if (min >= 0) plads = min + 1;
		} catch (e) {
			// Stillingen er pynt paa forsiden. Kan den ikke hentes, skal
			// resten af kortet stadig staa der.
			console.warn('[ny] kunne ikke hente challenge-stillingen', e);
		}
	}

	return {
		id: c.id,
		kilde: aktiv.kilde,
		forlobId: aktiv.forlobId,
		navn: c.navn,
		beskrivelse: c.beskrivelse,
		planter: mine,
		fravalgteBrugere: c.fravalgteBrugere,
		score: unikke.size,
		maal: maalFor(c),
		senesteJournal: mine.length > 0 ? mine[mine.length - 1] : '',
		plads,
		antalDeltagere,
		dageTilbage: dageTilbage(c, nu)
	};
}

/**
 * Hendes egne planter, uanset hvor challenge'n bor. Vi henter det ene
 * dokument direkte, ikke hele samlingen. Ellers ville et kig paa hendes
 * egen score koste ét opslag pr deltager.
 */
async function hentMinePlanter(aktiv: AktivChallenge, uid: string): Promise<string[]> {
	if (aktiv.kilde === 'forlob') {
		const mine = await hentMinIndtastning(aktiv.forlobId, aktiv.challenge.id, uid);
		return mine?.foedevarer ?? [];
	}
	const snap = await getDoc(doc(db, 'challenges', aktiv.challenge.id, 'indtastninger', uid));
	if (!snap.exists()) return [];
	return ((snap.data().foedevarer as string[]) ?? []).slice();
}

/**
 * Gemmer med en diff, altsaa kun det hun har tilfoejet og kun det hun
 * har fjernet. Aldrig hele listen.
 *
 * Grunden staar i den gamle firestore/challenge.ts: gemmer man hele
 * listen, kan en tom liste i dialogen slette alle en kundes planter paa
 * én gang. Det skete for en kunde 6. juni 2026. arrayUnion og
 * arrayRemove kan kun tilfoeje og fjerne det man udpeger.
 */
export async function gemPlanter(
	aktiv: AktivChallenge,
	uid: string,
	diff: { tilfoej: string[]; fjern: string[] },
	navn: { fornavn: string; efternavn: string }
): Promise<void> {
	if (aktiv.kilde === 'forlob') {
		await opdaterMinIndtastning({
			forlobId: aktiv.forlobId,
			challengeId: aktiv.challenge.id,
			uid,
			tilfoej: diff.tilfoej,
			fjern: diff.fjern,
			fornavn: navn.fornavn,
			efternavn: navn.efternavn
		});
		return;
	}

	const tilfoej = normaliserFoedevareListe(diff.tilfoej);
	const fjern = normaliserFoedevareListe(diff.fjern);
	const ref = doc(db, 'challenges', aktiv.challenge.id, 'indtastninger', uid);
	// Firestore tillader ikke arrayUnion og arrayRemove paa samme felt i
	// samme skrivning, saa det bliver to naar hun baade har tilfoejet og
	// fjernet noget.
	const meta = {
		fornavn: navn.fornavn ?? '',
		efternavn: navn.efternavn ?? '',
		opdateret: serverTimestamp()
	};
	if (tilfoej.length > 0) {
		await setDoc(ref, { foedevarer: arrayUnion(...tilfoej), ...meta }, { merge: true });
	}
	if (fjern.length > 0) {
		await setDoc(ref, { foedevarer: arrayRemove(...fjern), ...meta }, { merge: true });
	}
}

/** Den fulde, sorterede stilling. Skaeres ned til top ti i visningen. */
export async function hentStilling(aktiv: AktivChallenge, uid: string) {
	const raa =
		aktiv.kilde === 'forlob'
			? await hentAlleIndtastninger(aktiv.forlobId, aktiv.challenge.id)
			: (await getDocs(collection(db, 'challenges', aktiv.challenge.id, 'indtastninger'))).docs.map(
					(d) => {
						const data = d.data();
						return {
							uid: d.id,
							foedevarer: ((data.foedevarer as string[]) ?? []).slice(),
							fornavn: data.fornavn as string | undefined,
							efternavn: data.efternavn as string | undefined
						};
					}
				);

	return beregnStilling(
		raa.map((i) => ({
			uid: i.uid,
			foedevarer: i.foedevarer,
			displayNavn: challengeDisplayNavn(i.fornavn ?? '', i.efternavn ?? '')
		})),
		aktiv.challenge.fravalgteBrugere,
		uid
	);
}
