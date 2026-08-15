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

	import { getContext, onMount } from 'svelte';
	import type { User } from 'firebase/auth';
	import type { UserDoc } from '$lib/types';
	import type { LektionItem } from '$lib/content/forlob';
	import {
		formatMedlemstid,
		udledAdgange,
		type Adgangsbillede,
		type ForlobKilde
	} from '$lib/content/adgang3';
	import {
		byggKurve,
		maalingStatus,
		type Kurve,
		type MaalingStatus,
		type NyeKundeFelter
	} from '$lib/content/forside3';
	import { vurderInspirator, type Fakta } from '$lib/content/inspirator3';
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
		dageSidenAktiv,
		gemInspiratorAfvist,
		gemInspiratorTekst,
		datoNoegle,
		type SmaaSkridtIDag,
		type DagensTal,
		type NaesteHold as NaesteHoldType
	} from '$lib/firestore/forside3';

	import Overskud from '$lib/components/ny/Overskud.svelte';
	import SmaaSkridt from '$lib/components/ny/SmaaSkridt.svelte';
	import Lektioner from '$lib/components/ny/Lektioner.svelte';
	import Traening from '$lib/components/ny/Traening.svelte';
	import {
		hentDagensTraening3,
		type DagensTraening3
	} from '$lib/firestore/traeningForside3';
	import DagensTalKort from '$lib/components/ny/DagensTal.svelte';
	import NaesteHoldKort from '$lib/components/ny/NaesteHold.svelte';
	import Refleksion from '$lib/components/ny/Refleksion.svelte';
	import FoldetRaekke from '$lib/components/ny/FoldetRaekke.svelte';
	import Henter from '$lib/components/ny/Henter.svelte';
	import Ugestrimmel from '$lib/components/ny/Ugestrimmel.svelte';
	import Inspirator from '$lib/components/ny/Inspirator.svelte';
	import TilDig from '$lib/components/ny/TilDig.svelte';
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
	// 3.0's egne felter paa kunde-dokumentet. Den gamle types.ts kender dem
	// ikke, og den maa ikke aendres, saa de laeses gennem en egen type.
	const nyeFelter = $derived((userDoc ?? {}) as NyeKundeFelter);
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

	const fornavn = $derived(userDoc?.firstName ?? '');
	const hilsen = $derived(getGreetingWithName(fornavn, nu));
	const datoTekst = $derived(
		new Intl.DateTimeFormat('da-DK', { weekday: 'long', day: 'numeric', month: 'long' })
			.format(nu)
			.replace(' den ', ' · ')
			.replace(/^(\w)/, (c) => c.toUpperCase())
	);

	const aktivtForlob = $derived(adgang.aktiveForlob[0] ?? null);
	const medlemstid = $derived(formatMedlemstid(adgang.medlemstidMs));

	// ── Hentede data ────────────────────────────────────────────
	let kurve = $state<Kurve | null>(null);
	let status = $state<MaalingStatus | null>(null);
	let skridtData = $state<SmaaSkridtIDag | null>(null);
	let aktiveDage = $state<Set<string>>(new Set());
	let lektioner = $state<LektionItem[]>([]);
	let noteFraLinn = $state('');
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

	// Fremdrift: tallet paa vente-skaermen taeller RIGTIGE trin, ikke
	// sekunder. Se Henter.svelte for hvorfor.
	const TRIN = [
		'Henter din udvikling',
		'Henter dine små skridt',
		'Henter din uge',
		'Henter dit forløb',
		'Henter din træning',
		'Henter dine tal'
	];
	let hentet = $state(0);
	let henter = $state(true);
	const trinTekst = $derived(TRIN[Math.min(hentet, TRIN.length - 1)]);

	const noegle = $derived(
		[user?.uid ?? '', iDag, aktivtForlob?.forlobId ?? '', aktivtForlob?.dagNummer ?? -1].join('|')
	);

	$effect(() => {
		const uid = user?.uid;
		const n = noegle;
		if (!uid || !n) return;
		let afbrudt = false;

		// Sikkerhedsline: har vi ikke alt efter tolv sekunder, viser vi
		// siden med det vi har. Bedre en halv forside end en der staar og
		// venter i det uendelige paa en daarlig forbindelse.
		const noedbremse = setTimeout(() => {
			if (!afbrudt) henter = false;
		}, 12000);

		(async () => {
			henter = true;
			hentet = 0;
			const tael = () => {
				if (!afbrudt) hentet += 1;
			};

			const forlobKontekst = aktivtForlob
				? {
						forlobId: aktivtForlob.forlobId,
						produkt: aktivtForlob.produkt,
						dagNummer: aktivtForlob.dagNummer
					}
				: null;
			// Vi henter to maaneder tilbage, ikke kun en uge. Uge-strimlen
			// bruger de seneste syv dage, inspiratoren bruger resten til at
			// se hvor laenge hun har vaeret vaek.
			const ugeStart = new Date(nu);
			ugeStart.setDate(ugeStart.getDate() - 60);

			const [o, s, dage, k, tr, t] = await Promise.all([
				hentOverskud(uid).then((r) => (tael(), r)),
				hentSmaaSkridtIDag(uid, forlobKontekst, iDag).then((r) => (tael(), r)),
				hentAktiveDage(
					uid,
					aktivtForlob ? { produkt: aktivtForlob.produkt, startMs: aktivtForlob.startMs } : null,
					datoNoegle(ugeStart)
				).then((r) => (tael(), r)),
				hentKlaret(uid).then((r) => (tael(), r)),
				hentDagensTraening3(
					uid,
					userDoc,
					forlobKilder(),
					adgang.aktiveForlob,
					nuMs,
					iDag
				).then((r) => (tael(), r)),
				hentDagensTal(uid, iDag, userDoc).then((r) => (tael(), r))
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
			if (!afbrudt) henter = false;
		})().catch((e) => {
			console.error('[ny] kunne ikke hente forsiden', e);
			henter = false;
		});

		return () => {
			afbrudt = true;
			clearTimeout(noedbremse);
		};
	});

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
					diff.tilfoej.length > 0
						? diff.tilfoej[diff.tilfoej.length - 1]
						: challenge.senesteJournal
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
	// Forsiden skal ikke staa og vente paa dem, og kommer svaret et halvt
	// sekund senere, glider linjen bare ind oeverst.
	$effect(() => {
		const uid = user?.uid;
		if (!uid) return;
		const senest = userDoc?.senestSpoergsmaalLaestAt ?? 0;
		let afbrudt = false;

		hentMineSpoergsmaal(uid)
			.then((liste) => {
				if (afbrudt) return;
				const nyt = liste.find(
					(q) => q.svar && q.besvaretAt && q.besvaretAt.toDate().getTime() > senest
				);
				nyestSvar = nyt
					? { id: nyt.id, spoergsmaal: nyt.spoergsmaal, svar: nyt.svar ?? '' }
					: null;
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
	let udfoldet = $state<Set<string>>(new Set());

	onMount(() => {
		try {
			const raa = sessionStorage.getItem(`ny-udfoldet-${datoNoegle(new Date())}`);
			if (raa) udfoldet = new Set(JSON.parse(raa));
		} catch {
			// Ingen sessionStorage. Foldningen virker stadig, den husker bare ikke.
		}
	});

	function foldUd(id: string) {
		udfoldet = new Set([...udfoldet, id]);
		try {
			sessionStorage.setItem(`ny-udfoldet-${iDag}`, JSON.stringify([...udfoldet]));
		} catch {
			// Ligegyldigt. Sektionen er foldet ud i denne omgang uanset hvad.
		}
	}

	const skridtKlaret = $derived(
		!!skridtData && skridtData.skridt.length > 0 && skridtData.skridt.every((s) => s.svar === 'ja')
	);
	const lektionerKlaret = $derived(lektioner.length > 0 && lektioner.every((l) => klaret.has(l.id)));
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

	const fold = (id: string, klar: boolean) => klar && !udfoldet.has(id);

	const harMaal = $derived((tal?.proteinMaal ?? 0) > 0 || (tal?.fiberMaal ?? 0) > 0);

	// ── Inspiratoren ────────────────────────────────────────────
	// Kortet under Dit overskud. Melder sig kun naar hun har vaeret vaek,
	// eller naar overskuddet falder mens hun er aktiv.
	let inspiratorTekst = $state('');
	let henterInspirator = $state(false);
	let afvistIDag = $state<string | null>(null);

	// Har hun gjort noget I DAG. Ikke "nogensinde". Det skal vaere dagens
	// lektioner der er klaret, ikke bare at hun engang har markeret én.
	const gjortNogetIDag = $derived(
		(skridtData?.skridt ?? []).some((s) => s.svar === 'ja') ||
			lektioner.some((l) => klaret.has(l.id)) ||
			(traening?.klaretIDag ?? false) ||
			refleksionSkrevet
	);

	const fakta = $derived.by<Fakta | null>(() => {
		if (henter || !kurve) return null;
		return vurderInspirator({
			dageSidenAktiv: dageSidenAktiv(aktiveDage, nu),
			maalinger: kurve.punkter.map((p) => ({ ms: p.ms, vaerdi: p.vaerdi })),
			smaaSkridt: (skridtData?.skridt ?? []).map((s) => s.label),
			forlobNavn: aktivtForlob?.navn ?? null,
			dagNummer: aktivtForlob?.dagNummer ?? null,
			harGjortNogetIDag: gjortNogetIDag,
			afvistDato: afvistIDag ?? nyeFelter.nyInspiratorAfvist ?? null,
			iDag
		});
	});

	// Er dagens tekst allerede skrevet, viser vi den, uanset hvad hun har
	// naaet siden. Kortet skal blive staaende til hun selv goer noget ved
	// det. Indhold der forsvinder under haenderne paa hende er forvirrende.
	$effect(() => {
		const gemt = nyeFelter.nyInspirator;
		if (gemt?.dato === iDag && gemt.tekst && !inspiratorTekst) {
			inspiratorTekst = gemt.tekst;
		}
	});

	// Henter teksten én gang om dagen.
	$effect(() => {
		const f = fakta;
		const uid = user?.uid;
		if (!f || !uid || inspiratorTekst || henterInspirator) return;

		henterInspirator = true;
		(async () => {
			try {
				const idToken = await user!.getIdToken();
				const res = await fetch('/api/ny-ai', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
					body: JSON.stringify({ tilstand: 'inspirator', fakta: f })
				});
				if (!res.ok) return;
				const data = (await res.json()) as { svar: string };
				inspiratorTekst = data.svar;
				await gemInspiratorTekst(uid, iDag, data.svar);
			} catch (e) {
				// Kan vi ikke hente en tekst, viser vi ingenting. Et tomt kort
				// er bedre end et kort der undskylder for sig selv.
				console.warn('[ny] kunne ikke hente inspirator', e);
			} finally {
				henterInspirator = false;
			}
		})();
	});

	// Naar teksten foerst er hentet, staar kortet der resten af dagen.
	// Kun hun kan faa det vaek: ved at sige "ikke nu", eller ved at
	// tage imod og snakke med AI'en om det.
	const visInspirator = $derived(
		(inspiratorTekst.length > 0 || henterInspirator) &&
			afvistIDag !== iDag &&
			(nyeFelter.nyInspiratorAfvist ?? '') !== iDag
	);

	async function afvisInspirator() {
		const uid = user?.uid;
		afvistIDag = iDag;
		inspiratorTekst = '';
		if (!uid) return;
		try {
			await gemInspiratorAfvist(uid, iDag);
		} catch (e) {
			console.warn('[ny] kunne ikke gemme afvisning', e);
		}
	}
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
	<div class="date">{datoTekst}</div>
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
	<Henter ialt={TRIN.length} {hentet} tekst={trinTekst} />
{:else}
	<div class="ny-pad" style="margin-top:16px">
		<TilDig {beskeder} />

		<!-- Noten fra Linn. Den folder sig ikke sammen som de andre
		     sektioner, for den er ikke noget hun kan goere faerdig. -->
		{#if noteFraLinn}
			<section class="note-boble">
				<div class="note-boble-top">
					<span class="note-ava" aria-hidden="true"></span>
					<span class="note-boble-navn">Linn skrev til dig i dag</span>
				</div>
				<div class="note-boble-tekst">
					<p>{noteFraLinn}</p>
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

		{#if visInspirator}
			<Inspirator
				tekst={inspiratorTekst}
				henter={henterInspirator}
				onafvis={afvisInspirator}
				ontagimod={afvisInspirator}
			/>
		{/if}

		{#if altKlaret}
			<div class="gruppe-lab">Klaret i dag</div>
		{/if}

		{#if skridtData && skridtData.skridt.length > 0}
			{#if fold('skridt', skridtKlaret)}
				<FoldetRaekke
					titel="Dagens små skridt"
					detalje="{skridtData.skridt.length} af {skridtData.skridt.length}"
					onfold={() => foldUd('skridt')}
				/>
			{:else}
				<Ugestrimmel aktivDato={iDag} {aktiveDage} {iDag} nulDage={adgang.nulDatoer} />
				<SmaaSkridt skridt={skridtData.skridt} {gemmer} onskift={skiftSkridt} />
			{/if}
		{:else}
			<a class="kort rolig cta" href="/ny/moduler">
				<b>Vælg dine små skridt</b>
				<span>Tre ting du vil øve dig på. Du kan skifte dem igen senere.</span>
			</a>
		{/if}

		{#if aktivtForlob && lektioner.length > 0}
			{#if fold('lektioner', lektionerKlaret)}
				<FoldetRaekke
					titel="Dag {aktivtForlob.dagNummer} på {aktivtForlob.navn}"
					detalje="{lektioner.length} af {lektioner.length} taget"
					onfold={() => foldUd('lektioner')}
				/>
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
			{#if fold('traening', traening.klaretIDag)}
				<FoldetRaekke
					titel="Dagens træning"
					detalje="{traening.navn} · klaret"
					onfold={() => foldUd('traening')}
				/>
			{:else}
				<Traening {traening} />
			{/if}
		{/if}

		{#if harRefleksion}
			{#if fold('refleksion', refleksionSkrevet)}
				<FoldetRaekke
					titel="Dagens refleksion"
					detalje="Du har skrevet i dag"
					onfold={() => foldUd('refleksion')}
				/>
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
			{#if fold('tal', talKlaret)}
				<FoldetRaekke
					titel="Dagens tal"
					detalje="{tal.protein} g protein · {tal.fiber} g fiber"
					onfold={() => foldUd('tal')}
				/>
			{:else}
				<DagensTalKort {tal} />
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

		{#if aktivtForlob}
			<a class="coach" href="/ny/beskeder">
				<span class="coach-ava" aria-hidden="true"></span>
				<span class="coach-tekst">
					<span class="k">En hånd i ryggen</span>
					<span class="t">Skriv til Linn</span>
					<span class="s">Du får svar inden for et døgn</span>
				</span>
				<span class="coach-pil" aria-hidden="true">›</span>
			</a>
		{/if}

		<a class="ai-kort" href="/ny/hjaelp">
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
					<path class="glimt" d="M20.4 1.6l.55 1.45 1.45.55-1.45.55-.55 1.45-.55-1.45L18.4 3.6l1.45-.55z" />
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
