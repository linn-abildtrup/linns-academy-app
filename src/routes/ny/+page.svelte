<script lang="ts">
	// ============================================================
	// Forsiden i 3.0. ÉN forside for alle. Se SPEC-3.0.md afsnit 4.1.
	//
	// Har kunden en aktiv tilmelding, laegger forloebs-laget sig ovenpaa.
	// Har hun ikke, er blokken der bare ikke. Ingen forgrening paa
	// kundetype, ingen tre layouts.
	//
	// FOLDNING: en sektion hun har klaret, folder sig til én linje med
	// flueben. Den bliver liggende PRAECIS hvor den stod, saa siden aldrig
	// laver om paa sin egen raekkefoelge. Et tryk folder ud igen, og saa
	// staar den aaben resten af dagen (gemt i sessionStorage pr dato).
	// ============================================================

	import { getContext, onMount, untrack } from 'svelte';
	import { husk, husket } from '$lib/content/sidehukommelse3';
	import { goto } from '$app/navigation';
	import { isAdmin } from '$lib/admin';
	import { skalOnboardes3 } from '$lib/content/onboarding3';
	import type { User } from 'firebase/auth';
	import type { UserDoc } from '$lib/types';
	import type { LektionItem } from '$lib/content/forlob';
	import {
		formatMedlemstid,
		udledAdgange,
		type Adgangsbillede,
		type ForlobKilde
	} from '$lib/content/adgang3';
	import { byggKurve, maalingStatus, type Kurve, type MaalingStatus } from '$lib/content/forside3';
	import { byggBeskeder, type NyestSvar } from '$lib/content/beskeder3';
	import { aboVisning, APP_KOB_URL } from '$lib/content/abonnement';
	import { hentMineSpoergsmaal } from '$lib/firestore/spoergsmaal';
	import { getGreetingWithName } from '$lib/utils/greeting';
	import {
		hentOverskud,
		hentSmaaSkridtIDag,
		saetSkridtSvar,
		gemRefleksion,
		hentAktiveDage,
		hentDagensProgram,
		hentKlaret,
		saetKlaret,
		hentDagensTal,
		hentNaesteHold,
		datoNoegle,
		type SmaaSkridtIDag,
		type DagensTal,
		type NaesteHold as NaesteHoldType
	} from '$lib/firestore/forside3';

	import Overskud from '$lib/components/ny/Overskud.svelte';
	import SmaaSkridt from '$lib/components/ny/SmaaSkridt.svelte';
	import Lektioner from '$lib/components/ny/Lektioner.svelte';
	import Traening from '$lib/components/ny/Traening.svelte';
	import { hentDagensTraening3, type DagensTraening3 } from '$lib/firestore/traeningForside3';
	import DagensTalKort from '$lib/components/ny/DagensTal.svelte';
	import NaesteHoldKort from '$lib/components/ny/NaesteHold.svelte';
	import Refleksion from '$lib/components/ny/Refleksion.svelte';
	import FoldetRaekke from '$lib/components/ny/FoldetRaekke.svelte';
	import Venter from '$lib/components/ny/Venter.svelte';
	import Ugestrimmel from '$lib/components/ny/Ugestrimmel.svelte';
	import TilDig from '$lib/components/ny/TilDig.svelte';
	import { alleSet3 } from '$lib/content/lektionSet3';
	import { beskedTil3, type Forsidebesked3 } from '$lib/content/forsidebesked3';
	import { hentForsidebeskeder3 } from '$lib/firestore/forsidebesked3';
	import { visUdvidet3, type NaeringAdgang3 } from '$lib/content/naeringAdgang3';
	import { hentNaeringAdgang3 } from '$lib/firestore/naeringAdgang3';
	import Fluebe from '$lib/components/ny/Fluebe.svelte';
	import Challenge from '$lib/components/ny/Challenge.svelte';

	// Challenge. Selve indtastningen og stillingen genbruger vi som de
	// er, de virker og kunderne kender dem. Kun blokken paa forsiden er ny.
	import IndtastFrugtGroentDialog from '$lib/components/IndtastFrugtGroentDialog.svelte';
	import ChallengeStilling from '$lib/components/ny/ChallengeStilling.svelte';
	import {
		hentAktivChallenge3,
		hentChallengeTilForside,
		hentStilling,
		gemPlanter,
		type AktivChallenge
	} from '$lib/firestore/challenge3';
	import {
		byggStillingVisning,
		type ChallengeForside,
		type KundeKontekst,
		type StillingVisning
	} from '$lib/content/challenge3';
	import { hentAllowedEmail } from '$lib/firestore/forlob';

	const hentUserDoc = getContext<() => UserDoc | null>('userDoc');
	const hentUser = getContext<() => User | null>('user');
	const hentAdgang = getContext<() => Adgangsbillede>('adgang');
	const forlobKilder = getContext<() => ForlobKilde[]>('forlob');

	const userDoc = $derived(hentUserDoc());
	const user = $derived(hentUser());
	const adgang = $derived(hentAdgang());

	// Appen staar aaben i dagevis paa en telefon. Bliver tidspunktet laest
	// én gang ved indlaesning, viser den gaarsdagens dato naeste morgen.
	let nu = $state(new Date());

	onMount(() => {
		const opdater = () => {
			if (document.visibilityState === 'visible') nu = new Date();
		};
		document.addEventListener('visibilitychange', opdater);
		window.addEventListener('focus', opdater);
		return () => {
			document.removeEventListener('visibilitychange', opdater);
			window.removeEventListener('focus', opdater);
		};
	});

	const nuMs = $derived(nu.getTime());
	const iDag = $derived(datoNoegle(nu));

	// Porten til onboarding ligger HER og ikke i skallen. Skallen omgiver
	// hver eneste side, og et forsoeg paa at laegge noget nyt derind gav en
	// helt blank app 11. august. Hun kommer altid ind via forsiden, saa det
	// er nok i praksis. Se SPEC-3.0.md afsnit 31.
	$effect(() => {
		const ud = userDoc;
		if (!ud) return;
		if (skalOnboardes3(ud, isAdmin(user))) void goto('/ny/velkommen');
	});

	const fornavn = $derived(userDoc?.firstName ?? '');
	const hilsen = $derived(getGreetingWithName(fornavn, nu));
	const aktivtForlob = $derived(adgang.aktiveForlob[0] ?? null);
	// Skal de tre udvidede tal staa paa forsiden. Linn skal have givet lov,
	// OG hun skal selv have slaaet dem til. Se HANDOVER 9.38.
	let naeringAdgang = $state<NaeringAdgang3 | null>(null);
	const visUdvidetTal = $derived(visUdvidet3(naeringAdgang, userDoc?.visUdvidetNaering));

	// Primitiv, saa effekten nedenfor kun koerer naar forloebet FAKTISK
	// skifter. Laeser den aktivtForlob selv, koerer den hver gang
	// adgangsbilledet bygges om, ogsaa naar det er det samme forloeb. Se
	// HANDOVER 9.72.
	const aktivtForlobId = $derived(aktivtForlob?.forlobId ?? null);

	$effect(() => {
		const uid = user?.uid;
		if (!uid) return;
		const fid = aktivtForlobId;
		let afbrudt = false;
		hentNaeringAdgang3(uid, fid)
			.then((a) => {
				if (!afbrudt) naeringAdgang = a;
			})
			.catch((e) => console.warn('[ny] kunne ikke hente naerings-adgangen', e));
		return () => {
			afbrudt = true;
		};
	});

	const medlemstid = $derived(formatMedlemstid(adgang.medlemstidMs));

	// ── Hentede data ────────────────────────────────────────────
	let kurve = $state<Kurve | null>(null);
	let status = $state<MaalingStatus | null>(null);
	let skridtData = $state<SmaaSkridtIDag | null>(null);
	let aktiveDage = $state<Set<string>>(new Set());
	let lektioner = $state<LektionItem[]>([]);
	let noteFraLinn = $state('');

	// Beskeden paa forsiden, den der ikke hoerer til en bestemt dag. Se
	// content/forsidebesked3.ts for hvem der ser hvad.
	let forsidebesked = $state<Forsidebesked3 | null>(null);

	// De aktive forloeb som én streng. Samme grund som aktivtForlobId
	// ovenfor: adgangen selv er et nyt objekt hver gang den bygges om.
	const aktiveForlobIdsNoegle = $derived(adgang.aktiveForlob.map((f) => f.forlobId).join(','));

	$effect(() => {
		const ids = aktiveForlobIdsNoegle ? aktiveForlobIdsNoegle.split(',') : [];
		if (!user) return;
		let afbrudt = false;

		function hent() {
			hentForsidebeskeder3()
				.then((liste) => {
					if (afbrudt) return;
					forsidebesked = beskedTil3(liste, { aktiveForlobIds: ids }, Date.now());
				})
				.catch((e) => console.warn('[ny] kunne ikke hente forsidebesked', e));
		}

		hent();

		// Og igen naar hun kommer tilbage til skaermen. Har hun appen
		// liggende aaben i baggrunden, ville hun ellers se gaarsdagens
		// besked. Se HANDOVER 9.46.
		function naarSynlig() {
			if (typeof document !== 'undefined' && document.visibilityState === 'visible') hent();
		}
		if (typeof document !== 'undefined') document.addEventListener('visibilitychange', naarSynlig);

		return () => {
			afbrudt = true;
			if (typeof document !== 'undefined')
				document.removeEventListener('visibilitychange', naarSynlig);
		};
	});
	let klaret = $state<Set<string>>(new Set());
	let challenge = $state<ChallengeForside | null>(null);
	let aktivChallenge = $state<AktivChallenge | null>(null);
	let minePlanter = $state<string[]>([]);
	let visChallengeDialog = $state(false);
	let visChallengeStilling = $state(false);
	let challengeStilling = $state<StillingVisning | null>(null);
	let henterStilling = $state(false);
	let gemmerChallenge = $state(false);
	let traening = $state<DagensTraening3 | null>(null);
	let tal = $state<DagensTal | null>(null);
	let naesteHold = $state<NaesteHoldType | null>(null);
	let nyestSvar = $state<NyestSvar | null>(null);
	let gemmer = $state<string | null>(null);
	let gemmerNote = $state(false);
	let noteGemtLige = $state(false);

	// Trin-taelleren er fjernet 5. september sammen med procent-bjaelken,
	// se vente-skaermen nedenfor. Den taalte rigtige trin og ikke sekunder,
	// og det var en god idé, men den gjorde forsiden til det eneste sted i
	// appen med sin egen vente-skaerm.
	let henter = $state(true);

	// ── Sikkerhedslinen ─────────────────────────────────────────
	//
	// Den laa FOER inde i hentningen, og det var det der lod forsiden
	// haenge i det uendelige 4. september: startede hentningen forfra,
	// blev uret stillet tilbage til nul, og de tolv sekunder loeb aldrig
	// ud. Vente-skaermen stod og talte 0 % til 100 % og forfra.
	//
	// Nu er der ÉT ur pr besoeg, og det kan ingen genstart roere. Naar det
	// loeber ud, viser vi siden med det vi har. Hentninger der kommer
	// bagefter fylder stille resten ud, uden at vente-skaermen vender
	// tilbage — se hentIGang nedenfor.
	const NOEDBREMSE_MS = 12000;
	let harGivetOp = false;
	onMount(() => {
		const id = setTimeout(() => {
			harGivetOp = true;
			henter = false;
		}, NOEDBREMSE_MS);
		return () => clearTimeout(id);
	});

	const noegle = $derived(
		[user?.uid ?? '', iDag, aktivtForlob?.forlobId ?? '', aktivtForlob?.dagNummer ?? -1].join('|')
	);

	// HENTNINGEN MAA KUN STARTE FORFRA NAAR NOEGLEN SKIFTER, altsaa ved ny
	// kunde, ny dag eller nyt forloeb.
	//
	// Foer laeste den ogsaa userDoc, adgangen, forloebene og uret mens den
	// stillede kaldene op, og alt det blev dermed noget den holdt oeje med.
	// Adgangsbilledet bygges om hver gang bruger-dokumentet aendrer sig, og
	// hver ombygning giver NYE objekter, ogsaa naar indholdet er praecis
	// det samme. Saa startede hentningen forfra, og med den gamle
	// sikkerhedsline inde i sig selv naaede de tolv sekunder aldrig at
	// loebe ud. Det var ringen 4. september.
	//
	// Alt andet end noeglen laeses derfor i untrack. Vaerdierne er de samme
	// som foer, de bliver bare ikke laengere til anledninger til at hente
	// alt igen.
	$effect(() => {
		const n = noegle;
		if (!n) return;
		return untrack(() => hentForsiden());
	});

	/** Det forsiden skal kunne staa med med det samme naeste gang. */
	interface HusketForside {
		kurve: Kurve | null;
		status: MaalingStatus | null;
		skridtData: SmaaSkridtIDag | null;
		aktiveDage: Set<string>;
		klaret: Set<string>;
		traening: DagensTraening3 | null;
		tal: DagensTal | null;
		lektioner: LektionItem[];
		noteFraLinn: string;
		naesteHold: NaesteHoldType | null;
	}

	function hentForsiden(): () => void {
		const uid = user?.uid;
		if (!uid) return () => {};
		let afbrudt = false;

		// NOEGLEN BAERER DAGEN OG FORLOEBET, saa en ny dag aldrig kan vise
		// gaarsdagens forside. Se content/sidehukommelse3.ts.
		const hukommelse = `forside|${noegle}`;
		const gemt = husket<HusketForside>(uid, hukommelse);
		if (gemt) {
			kurve = gemt.kurve;
			status = gemt.status;
			skridtData = gemt.skridtData;
			aktiveDage = gemt.aktiveDage;
			klaret = gemt.klaret;
			traening = gemt.traening;
			tal = gemt.tal;
			lektioner = gemt.lektioner;
			noteFraLinn = gemt.noteFraLinn;
			naesteHold = gemt.naesteHold;
			henter = false;
		}

		(async () => {
			// Har sikkerhedslinen allerede vist siden, eller staar der noget
			// fra sidst, henter vi stille videre i baggrunden.
			// Vente-skaermen maa ikke komme igen.
			if (!harGivetOp && !gemt) {
				henter = true;
			}

			const forlobKontekst = aktivtForlob
				? {
						forlobId: aktivtForlob.forlobId,
						produkt: aktivtForlob.produkt,
						dagNummer: aktivtForlob.dagNummer
					}
				: null;
			// Vi henter to maaneder tilbage, ikke kun en uge. Uge-strimlen
			// bruger de seneste syv dage. Resten blev hentet til inspirator-
			// kortet, som er fjernet 20. august, og vinduet er ikke sat ned
			// endnu, se overdragelsen.
			const ugeStart = new Date(nu);
			ugeStart.setDate(ugeStart.getDate() - 60);

			const [o, s, dage, k, tr, t] = await Promise.all([
				hentOverskud(uid),
				hentSmaaSkridtIDag(uid, forlobKontekst, iDag),
				hentAktiveDage(
					uid,
					aktivtForlob ? { produkt: aktivtForlob.produkt, startMs: aktivtForlob.startMs } : null,
					datoNoegle(ugeStart)
				),
				hentKlaret(uid),
				hentDagensTraening3(uid, userDoc, forlobKilder(), adgang.aktiveForlob, nuMs),
				hentDagensTal(uid, iDag, userDoc)
			]);
			if (afbrudt) return;

			const navne = new Map(adgang.gennemfoerte.map((g) => [g.forlobId, g.navn]));
			for (const f of adgang.aktiveForlob) navne.set(f.forlobId, f.navn);

			kurve = byggKurve(o.maalinger, adgangeFor(), nuMs, navne);
			status = maalingStatus(o.sidsteMs, aktivtForlob?.produkt ?? null, nuMs);
			skridtData = s;
			aktiveDage = dage;
			klaret = k;
			traening = tr;
			tal = t;

			if (aktivtForlob) {
				const program = await hentDagensProgram(
					aktivtForlob.forlobId,
					aktivtForlob.dagNummer,
					nuMs
				);
				lektioner = program.lektioner;
				noteFraLinn = program.note;
			} else {
				lektioner = [];
				noteFraLinn = '';
				naesteHold = await hentNaesteHold(
					userDoc?.forlobIds ?? [],
					adgang.gennemfoerte.map((g) => g.forlobId),
					nuMs
				);
			}

			// Challenge'n hentes til sidst og for begge kundetyper. En
			// challenge kan gaa til et hold, til enkelte kunder eller til
			// alle der har appen, saa et medlem uden forloeb kan ogsaa
			// have en. Er der ingen i gang, staar blokken der bare ikke.
			await hentChallenge(uid);
			if (!afbrudt) {
				husk<HusketForside>(uid, hukommelse, {
					kurve,
					status,
					skridtData,
					aktiveDage,
					klaret,
					traening,
					tal,
					lektioner,
					noteFraLinn,
					naesteHold
				});
				henter = false;
			}
		})().catch((e) => {
			console.error('[ny] kunne ikke hente forsiden', e);
			henter = false;
		});

		return () => {
			afbrudt = true;
		};
	}

	// ── Challenge ───────────────────────────────────────────────
	//
	// Challenge'n kan komme fra et hold eller fra en tildeling til alle
	// der har appen. Laese-laget finder ud af hvilken, saa forsiden her
	// behoever ikke vide hvor den bor.

	function kundeKontekst(uid: string): KundeKontekst {
		return {
			uid,
			forlobIds: adgang.aktiveForlob.map((f) => f.forlobId),
			erAppBruger: adgang.harApp
		};
	}

	async function hentChallenge(uid: string) {
		try {
			const aktiv = await hentAktivChallenge3(kundeKontekst(uid), nuMs);
			aktivChallenge = aktiv;
			challenge = await hentChallengeTilForside(kundeKontekst(uid), nuMs);
			minePlanter = challenge?.planter ?? [];
		} catch (e) {
			console.warn('[ny] kunne ikke hente challenge', e);
			challenge = null;
			aktivChallenge = null;
			minePlanter = [];
		}
	}

	async function gemChallengePlanter(diff: {
		valgte: string[];
		tilfoej: string[];
		fjern: string[];
	}) {
		const uid = user?.uid;
		if (!uid || !challenge || !aktivChallenge || !userDoc) return;
		gemmerChallenge = true;
		try {
			// Efternavnet staar ikke paa kunde-dokumentet, kun fornavnet.
			// Stillingen viser 'Hanne S.', saa vi henter det med.
			let efternavn = '';
			try {
				const ae = userDoc.email ? await hentAllowedEmail(userDoc.email) : null;
				efternavn = ae?.lastName ?? '';
			} catch {
				// Uden efternavn staar der bare fornavnet i stillingen.
			}
			await gemPlanter(
				aktivChallenge,
				uid,
				{ tilfoej: diff.tilfoej, fjern: diff.fjern },
				{ fornavn: userDoc.firstName ?? '', efternavn }
			);
			minePlanter = diff.valgte;
			// Kortet skal vise det nye tal med det samme.
			challenge = {
				...challenge,
				planter: diff.valgte,
				score: new Set(diff.valgte).size,
				senesteJournal:
					diff.tilfoej.length > 0 ? diff.tilfoej[diff.tilfoej.length - 1] : challenge.senesteJournal
			};
			visChallengeDialog = false;
			await aabnChallengeStilling();
		} catch (e) {
			console.error('[ny] kunne ikke gemme challenge-indtastning', e);
		} finally {
			gemmerChallenge = false;
		}
	}

	async function aabnChallengeStilling() {
		const uid = user?.uid;
		if (!uid || !aktivChallenge) return;
		henterStilling = true;
		visChallengeStilling = true;
		try {
			challengeStilling = byggStillingVisning(await hentStilling(aktivChallenge, uid));
		} catch (e) {
			console.warn('[ny] kunne ikke hente stillingen', e);
			challengeStilling = null;
		} finally {
			henterStilling = false;
		}
	}

	// ── Til dig lige nu ─────────────────────────────────────────
	// Ulaeste svar fra Linn hentes for sig selv, IKKE sammen med resten.
	// Primitiv af samme grund som ovenfor: ellers henter vi svarene igen
	// hver gang bruger-dokumentet aendrer sig, uanset om tallet skifter.
	const senestSvarLaestAt = $derived(userDoc?.senestSpoergsmaalLaestAt ?? 0);

	// Forsiden skal ikke staa og vente paa dem, og kommer svaret et halvt
	// sekund senere, glider linjen bare ind oeverst.
	$effect(() => {
		const uid = user?.uid;
		if (!uid) return;
		const senest = senestSvarLaestAt;
		let afbrudt = false;

		hentMineSpoergsmaal(uid)
			.then((liste) => {
				if (afbrudt) return;
				const nyt = liste.find(
					(q) => q.svar && q.besvaretAt && q.besvaretAt.toDate().getTime() > senest
				);
				nyestSvar = nyt ? { id: nyt.id, spoergsmaal: nyt.spoergsmaal, svar: nyt.svar ?? '' } : null;
			})
			.catch((e) => console.error('[ny] kunne ikke hente svar fra Linn', e));

		return () => {
			afbrudt = true;
		};
	});

	const beskeder = $derived.by(() => {
		const abo = aboVisning(userDoc, nuMs);
		// Udloebs-paamindelsen vises kun naar abonnementet er DET der giver
		// hende adgang. Er hun paa et forloeb, loeber adgangen videre der,
		// og saa er datoen ikke noget hun skal handle paa nu.
		const visUdloeb = abo.taetPaaUdloeb && abo.slutterAt !== undefined && !aktivtForlob;
		return byggBeskeder({
			nyestSvar,
			udloeb: visUdloeb
				? { dageTilbage: abo.dageTilbage ?? 0, slutterAt: abo.slutterAt as number }
				: null,
			fornyUrl: APP_KOB_URL
		});
	});

	// Adgangs-raekkerne bruges baade til baand og pauser paa kurven.
	function adgangeFor() {
		return udledAdgange(
			{
				forlobIds: userDoc?.forlobIds,
				afsluttedeForlobIds: userDoc?.afsluttedeForlobIds,
				aboKoebtAt: userDoc?.aboKoebtAt,
				aboSlutterAt: userDoc?.aboSlutterAt,
				aboProdukt: userDoc?.aboProdukt,
				activeProduct: userDoc?.activeProduct,
				activeSubscription: userDoc?.activeSubscription,
				accessSource: userDoc?.accessSource,
				bonusPeriodEndsAt: userDoc?.bonusPeriodEndsAt,
				createdAt: userDoc?.createdAt
			},
			forlobKilder?.() ?? []
		);
	}

	// ── Foldning ────────────────────────────────────────────────
	// En sektion er foldet, naar den er klaret OG hun ikke selv har
	// foldet den ud igen. Udfoldninger huskes for resten af dagen.
	//
	// Det GAAR BEGGE VEJE siden 19. august. Foer kunne hun folde ud, men
	// ikke ind igen, saa en sektion hun havde aabnet for at se paa laa og
	// fyldte resten af dagen. Linns bemaerkning. Under en udfoldet, klaret
	// sektion staar der nu en lille linje der folder den sammen igen.
	let udfoldet = $state<Set<string>>(new Set());

	onMount(() => {
		try {
			const raa = sessionStorage.getItem(`ny-udfoldet-${datoNoegle(new Date())}`);
			if (raa) udfoldet = new Set(JSON.parse(raa));
		} catch {
			// Ingen sessionStorage. Foldningen virker stadig, den husker bare ikke.
		}
	});

	/** Folder en klaret sektion ud, eller sammen igen. */
	function skiftFold(id: string) {
		const ny = new Set(udfoldet);
		if (ny.has(id)) ny.delete(id);
		else ny.add(id);
		udfoldet = ny;
		try {
			sessionStorage.setItem(`ny-udfoldet-${iDag}`, JSON.stringify([...ny]));
		} catch {
			// Ligegyldigt. Sektionen staar rigtigt i denne omgang uanset hvad.
		}
	}

	const skridtKlaret = $derived(
		!!skridtData && skridtData.skridt.length > 0 && skridtData.skridt.every((s) => s.svar === 'ja')
	);
	const lektionerKlaret = $derived(alleSet3(klaret, lektioner));
	const refleksionSkrevet = $derived((skridtData?.note ?? '').trim().length > 0);
	// Dagens tal folder foerst naar BEGGE maal er naaet. Ellers ville den
	// forsvinde, netop som hun skulle bruge den.
	const talKlaret = $derived(
		!!tal &&
			tal.proteinMaal > 0 &&
			tal.fiberMaal > 0 &&
			tal.protein >= tal.proteinMaal &&
			tal.fiber >= tal.fiberMaal
	);

	// fold() er vaek 20. august. Sektionerne spoerger nu direkte paa
	// udfoldet, fordi den klarede tilstand allerede afgoer HVILKEN af de
	// to udgaver der bygges. En hjaelper der blandede de to spoergsmaal
	// gjorde det svaerere at laese, ikke lettere.

	const harMaal = $derived((tal?.proteinMaal ?? 0) > 0 || (tal?.fiberMaal ?? 0) > 0);

	const harRefleksion = $derived(!!aktivtForlob && (skridtData?.refleksion ?? '').length > 0);

	// Alt klaret: hvor mange opgaver dagen havde, og hvor mange der er taget.
	const opgaver = $derived.by(() => {
		const liste: boolean[] = [];
		if (skridtData && skridtData.skridt.length > 0) liste.push(skridtKlaret);
		if (aktivtForlob && lektioner.length > 0) liste.push(lektionerKlaret);
		if (traening) liste.push(traening.klaretIDag);
		if (harRefleksion) liste.push(refleksionSkrevet);
		if (tal && harMaal) liste.push(talKlaret);
		return liste;
	});
	const altKlaret = $derived(opgaver.length > 0 && opgaver.every(Boolean));

	// ── Handlinger ──────────────────────────────────────────────
	async function skiftSkridt(id: string, tilKlaret: boolean) {
		const uid = user?.uid;
		if (!uid || !skridtData) return;
		gemmer = id;
		const foer = skridtData.skridt.map((s) => ({ ...s }));
		skridtData = {
			...skridtData,
			skridt: skridtData.skridt.map((s) =>
				s.id === id ? { ...s, svar: tilKlaret ? 'ja' : null } : s
			)
		};
		try {
			await saetSkridtSvar(uid, skridtData, id, tilKlaret ? 'ja' : null);
			if (tilKlaret) aktiveDage = new Set([...aktiveDage, iDag]);
		} catch (e) {
			console.error('[ny] kunne ikke gemme skridt', e);
			skridtData = { ...skridtData, skridt: foer };
		} finally {
			gemmer = null;
		}
	}

	async function gemNote(tekst: string) {
		const uid = user?.uid;
		if (!uid || !skridtData?.produktId || skridtData.dagNummer === undefined) return;
		gemmerNote = true;
		try {
			await gemRefleksion(uid, skridtData.produktId, skridtData.dagNummer, tekst);
			skridtData = { ...skridtData, note: tekst };
			noteGemtLige = true;
			setTimeout(() => (noteGemtLige = false), 4000);
		} catch (e) {
			console.error('[ny] kunne ikke gemme refleksionen', e);
		} finally {
			gemmerNote = false;
		}
	}
</script>

<header class="dawn">
	<div class="dawn-top">
		<h1 class="hello">{hilsen}</h1>
		<div class="linn-ava" role="img" aria-label="Linn"></div>
	</div>

	<div class="status-raekke">
		{#if aktivtForlob}
			<span class="status">
				<span class="prik" aria-hidden="true"></span>
				{aktivtForlob.navn}
				<span class="let">· dag {aktivtForlob.dagNummer} af {aktivtForlob.antalDage}</span>
			</span>
			{#if medlemstid}
				<span class="status tid">Medlem i {medlemstid}</span>
			{/if}
		{:else if medlemstid}
			<span class="status medlem">
				<span class="prik" aria-hidden="true"></span>
				Medlem <span class="let">· {medlemstid}</span>
			</span>
		{/if}
	</div>
</header>

{#if henter}
	<!-- SAMME VENTE-SKAERM SOM RESTEN AF APPEN. Linns oenske 5. september:
	     de skal vaere ens. Forsiden var det eneste sted med en
	     procent-bjaelke, de 21 oevrige sider har den rolige udgave.
	     Bjaelken blev bygget dengang forsiden var langsom. Efter
	     sidehukommelsen 4. september ses vente-skaermen kun FOERSTE gang i
	     et besoeg, saa der er endnu mindre at holde oeje med. -->
	<Venter tekst="Henter dine ting" />
{:else}
	<div class="ny-pad" style="margin-top:16px">
		<!-- Datostrimlen staar OEVERST og ALTID. Linns oenske 18. august.
		     Den laa foer inde i "dagens smaa skridt", og det havde to
		     foelger som ingen havde taenkt over: den forsvandt paa de dage
		     hvor hun HAVDE taget sine skridt, fordi sektionen saa folder
		     sig sammen, og den fandtes slet ikke for en kunde der endnu
		     ikke havde valgt nogen skridt. Altsaa vaek netop naar det gik
		     godt. Nu hoerer den til dagen og ikke til én sektion. -->
		<Ugestrimmel aktivDato={iDag} {aktiveDage} {iDag} nulDage={adgang.nulDatoer} />

		<TilDig {beskeder} />

		<!-- Noten fra Linn. Den folder sig ikke sammen som de andre
		     sektioner, for den er ikke noget hun kan goere faerdig.
		     ÉN BOBLE, ALDRIG TO: den generelle besked staar oeverst, og
		     dagens note under med sit dagnummer. Se HANDOVER 9.44. -->
		{#if noteFraLinn || forsidebesked}
			<section class="note-boble">
				<div class="note-boble-top">
					<span class="note-ava" aria-hidden="true"></span>
					<span class="note-boble-navn">
						{forsidebesked ? 'Fra Linn' : 'Linn skrev til dig i dag'}
					</span>
				</div>
				<div class="note-boble-tekst">
					{#if forsidebesked}
						<p>{forsidebesked.tekst}</p>
					{/if}
					{#if noteFraLinn}
						<div class:note-dagsdel={!!forsidebesked}>
							{#if forsidebesked && aktivtForlob}
								<span class="note-dagsnr">Dag {aktivtForlob.dagNummer}</span>
							{/if}
							<p>{noteFraLinn}</p>
						</div>
					{/if}
					{#if forsidebesked}
						<!-- Hun vil svare paa den, og der er ikke noget at svare i.
						     Uden vejen videre trykker hun paa boblen og opdager at
						     der ikke sker noget. -->
						<a class="note-vej" href="/ny/beskeder?fane=linn">
							Vil du spørge om noget? Skriv til mig ›
						</a>
					{/if}
				</div>
			</section>
		{/if}

		{#if altKlaret}
			<section class="fejring">
				<span class="fejring-rund" aria-hidden="true"><Fluebe /></span>
				<div class="fejring-t">Du har taget hele dagen</div>
				<div class="fejring-s">
					{opgaver.length} ting, og du gjorde dem alle sammen.
				</div>
			</section>
		{/if}

		{#if kurve && status}
			<Overskud {kurve} {status} nu={nuMs} />
		{/if}

		{#if altKlaret}
			<div class="gruppe-lab">Klaret i dag</div>
		{/if}

		{#if skridtData && skridtData.skridt.length > 0}
			{#if skridtKlaret}
				<!-- Klaret. Overskriften er SELV kontakten, og indholdet folder
				     ud i det samme kort. Samme moenster som Udvikling. Linns
				     valg 20. august. -->
				{@const aaben = udfoldet.has('skridt')}
				<section class="fold-omr" class:aaben>
					<FoldetRaekke
						titel="Dagens små skridt"
						detalje="{skridtData.skridt.length} af {skridtData.skridt.length}"
						{aaben}
						onfold={() => skiftFold('skridt')}
					/>
					{#if aaben}
						<div class="fold-krop">
							<SmaaSkridt skridt={skridtData.skridt} {gemmer} onskift={skiftSkridt} />
						</div>
					{/if}
				</section>
			{:else}
				<SmaaSkridt skridt={skridtData.skridt} {gemmer} onskift={skiftSkridt} />
			{/if}
		{:else}
			<!-- Foerte foer til /ny/moduler, som er en tom plads. Rettet 22.
			     august. En forloebskunde faar en anden tekst: hun kan ikke
			     vaelge Linns skridt, kun laegge sine egne oveni. -->
			<a class="kort rolig cta" href="/ny/skridt">
				<b>{aktivtForlob ? 'Tilføj dine egne små skridt' : 'Vælg dine små skridt'}</b>
				<span>
					{aktivtForlob
						? 'Op til tre, oveni dem Linn har lagt ind i forløbet.'
						: 'Tre ting du vil øve dig på. Du kan skifte dem igen senere.'}
				</span>
			</a>
		{/if}

		{#if aktivtForlob && lektioner.length > 0}
			{#if lektionerKlaret}
				{@const aaben = udfoldet.has('lektioner')}
				<section class="fold-omr" class:aaben>
					<FoldetRaekke
						titel="Dag {aktivtForlob.dagNummer} på {aktivtForlob.navn}"
						detalje="{lektioner.length} af {lektioner.length} taget"
						{aaben}
						onfold={() => skiftFold('lektioner')}
					/>
					{#if aaben}
						<div class="fold-krop">
							<Lektioner
								titel={`Dag ${aktivtForlob.dagNummer} på ${aktivtForlob.navn}`}
								dagNummer={aktivtForlob.dagNummer}
								{lektioner}
								{klaret}
								visTitel={false}
							/>
						</div>
					{/if}
				</section>
			{:else}
				<Lektioner
					titel={`Dag ${aktivtForlob.dagNummer} på ${aktivtForlob.navn}`}
					dagNummer={aktivtForlob.dagNummer}
					{lektioner}
					{klaret}
				/>
			{/if}
		{/if}

		{#if traening && traening.tilstand !== 'ingen'}
			{#if traening.klaretIDag}
				{@const aaben = udfoldet.has('traening')}
				<section class="fold-omr" class:aaben>
					<FoldetRaekke
						titel="Dagens træning"
						detalje="{traening.navn} · klaret"
						{aaben}
						onfold={() => skiftFold('traening')}
					/>
					{#if aaben}
						<div class="fold-krop"><Traening {traening} visTitel={false} /></div>
					{/if}
				</section>
			{:else}
				<Traening {traening} />
			{/if}
		{/if}

		{#if harRefleksion}
			{#if refleksionSkrevet}
				{@const aaben = udfoldet.has('refleksion')}
				<section class="fold-omr" class:aaben>
					<FoldetRaekke
						titel="Dagens refleksion"
						detalje="Du har skrevet i dag"
						{aaben}
						onfold={() => skiftFold('refleksion')}
					/>
					{#if aaben}
						<div class="fold-krop">
							<Refleksion
								spoergsmaal={skridtData?.refleksion ?? ''}
								note={skridtData?.note ?? ''}
								gemmer={gemmerNote}
								gemtLige={noteGemtLige}
								ongem={gemNote}
							/>
						</div>
					{/if}
				</section>
			{:else}
				<Refleksion
					spoergsmaal={skridtData?.refleksion ?? ''}
					note={skridtData?.note ?? ''}
					gemmer={gemmerNote}
					gemtLige={noteGemtLige}
					ongem={gemNote}
				/>
			{/if}
		{/if}

		{#if tal && harMaal}
			{#if talKlaret}
				{@const aaben = udfoldet.has('tal')}
				<section class="fold-omr" class:aaben>
					<FoldetRaekke
						titel="Dagens tal"
						detalje="{tal.protein} g protein · {tal.fiber} g fiber"
						{aaben}
						onfold={() => skiftFold('tal')}
					/>
					{#if aaben}
						<div class="fold-krop"><DagensTalKort {tal} visUdvidet={visUdvidetTal} /></div>
					{/if}
				</section>
			{:else}
				<DagensTalKort {tal} visUdvidet={visUdvidetTal} />
			{/if}
		{/if}

		<!-- Challenge'n folder sig ikke sammen. Den er ikke en dagsopgave,
		     den er en samling der loeber gennem hele perioden. -->
		{#if challenge}
			<Challenge
				{challenge}
				onindtast={() => (visChallengeDialog = true)}
				onstilling={aabnChallengeStilling}
			/>
		{/if}

		{#if !aktivtForlob && naesteHold}
			<NaesteHoldKort hold={naesteHold} nu={nuMs} />
		{/if}

		<!-- Kortet "Skriv til Linn" er fjernet 16. august 2026. Snak staar i
		     bundmenuen hele tiden, saa kortet var en genvej til noget der
		     aldrig er mere end ét tryk vaek. Linns beslutning. -->

		<!-- Direkte til AI-en. Naven under /ny/hjaelp fik FAQ og links
		     18. august, og kortet her lover svar med det samme. -->
		<a class="ai-kort" href="/ny/hjaelp/spoerg">
			<!-- Talebobbel med spoergsmaalstegn, og en lille glimt der siger at
			     det er en maskine der svarer. Samme tynde streger som resten
			     af ikonerne, ingen emoji. -->
			<span class="ai-ikon" aria-hidden="true">
				<svg viewBox="0 0 24 24">
					<path
						class="streg"
						d="M6.5 4h11A2.5 2.5 0 0 1 20 6.5v7a2.5 2.5 0 0 1-2.5 2.5H11l-4 3v-3h-.5A2.5 2.5 0 0 1 4 13.5v-7A2.5 2.5 0 0 1 6.5 4Z"
					/>
					<path class="streg" d="M9.9 8.5a2.2 2.2 0 0 1 4.2.8c0 1.5-2.1 1.7-2.1 3" />
					<path class="prik" d="M12 14.4h.01" />
					<path
						class="glimt"
						d="M20.4 1.6l.55 1.45 1.45.55-1.45.55-.55 1.45-.55-1.45L18.4 3.6l1.45-.55z"
					/>
				</svg>
			</span>
			<span class="ai-tekst">
				<span class="t">Spørg om appen</span>
				<span class="s">Du får svar med det samme</span>
			</span>
			<span class="ai-pil" aria-hidden="true">›</span>
		</a>
	</div>
{/if}

<!-- Indtastning og stilling er de samme som i den gamle app. De
     virker, kunderne kender dem, og de henter deres farver fra
     token-broen nederst i ny.css. -->
{#if visChallengeDialog}
	<IndtastFrugtGroentDialog
		startListe={minePlanter}
		onGem={gemChallengePlanter}
		onLuk={() => (visChallengeDialog = false)}
		gemmer={gemmerChallenge}
	/>
{/if}

{#if visChallengeStilling && challenge}
	<ChallengeStilling
		navn={challenge.navn}
		visning={challengeStilling}
		henter={henterStilling}
		onluk={() => (visChallengeStilling = false)}
	/>
{/if}
