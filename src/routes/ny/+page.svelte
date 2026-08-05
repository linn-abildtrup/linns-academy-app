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
	import { byggKurve, maalingStatus, type Kurve, type MaalingStatus } from '$lib/content/forside3';
	import { getGreetingWithName } from '$lib/utils/greeting';
	import {
		hentOverskud,
		hentSmaaSkridtIDag,
		saetSkridtSvar,
		gemRefleksion,
		hentAktiveDage,
		hentDagensLektioner,
		hentKlaret,
		saetKlaret,
		hentDagensTal,
		hentDagensTraening,
		hentNaesteHold,
		datoNoegle,
		type SmaaSkridtIDag,
		type DagensTal,
		type DagensTraening,
		type NaesteHold as NaesteHoldType
	} from '$lib/firestore/forside3';

	import Overskud from '$lib/components/ny/Overskud.svelte';
	import SmaaSkridt from '$lib/components/ny/SmaaSkridt.svelte';
	import Lektioner from '$lib/components/ny/Lektioner.svelte';
	import Traening from '$lib/components/ny/Traening.svelte';
	import DagensTalKort from '$lib/components/ny/DagensTal.svelte';
	import NaesteHoldKort from '$lib/components/ny/NaesteHold.svelte';
	import Refleksion from '$lib/components/ny/Refleksion.svelte';
	import FoldetRaekke from '$lib/components/ny/FoldetRaekke.svelte';
	import Henter from '$lib/components/ny/Henter.svelte';
	import Fluebe from '$lib/components/ny/Fluebe.svelte';

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
	let klaret = $state<Set<string>>(new Set());
	let traening = $state<DagensTraening | null>(null);
	let tal = $state<DagensTal | null>(null);
	let naesteHold = $state<NaesteHoldType | null>(null);
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

		(async () => {
			henter = true;
			hentet = 0;
			const tael = () => {
				if (!afbrudt) hentet += 1;
			};

			const forlobKontekst = aktivtForlob
				? { produkt: aktivtForlob.produkt, dagNummer: aktivtForlob.dagNummer }
				: null;
			const ugeStart = new Date(nu);
			ugeStart.setDate(ugeStart.getDate() - 7);

			const [o, s, dage, k, tr, t] = await Promise.all([
				hentOverskud(uid).then((r) => (tael(), r)),
				hentSmaaSkridtIDag(uid, forlobKontekst, iDag).then((r) => (tael(), r)),
				hentAktiveDage(
					uid,
					aktivtForlob ? { produkt: aktivtForlob.produkt, startMs: aktivtForlob.startMs } : null,
					datoNoegle(ugeStart)
				).then((r) => (tael(), r)),
				hentKlaret(uid).then((r) => (tael(), r)),
				hentDagensTraening(uid, userDoc, nuMs, iDag).then((r) => (tael(), r)),
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
				lektioner = await hentDagensLektioner(
					aktivtForlob.forlobId,
					aktivtForlob.dagNummer,
					nuMs
				);
			} else {
				lektioner = [];
				naesteHold = await hentNaesteHold(
					userDoc?.forlobIds ?? [],
					adgang.gennemfoerte.map((g) => g.forlobId),
					nuMs
				);
			}
			if (!afbrudt) henter = false;
		})().catch((e) => {
			console.error('[ny] kunne ikke hente forsiden', e);
			henter = false;
		});

		return () => {
			afbrudt = true;
		};
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

	// ── Ugestrimlen ─────────────────────────────────────────────
	// Mandag til soendag. Soendag hoerer til den uge der lige er gaaet.
	const ugen = $derived.by(() => {
		const ugedage = ['Man', 'Tir', 'Ons', 'Tor', 'Fre', 'Lør', 'Søn'];
		const mandag = new Date(nu);
		mandag.setDate(mandag.getDate() - ((mandag.getDay() + 6) % 7));
		mandag.setHours(0, 0, 0, 0);

		return ugedage.map((navn, i) => {
			const d = new Date(mandag);
			d.setDate(mandag.getDate() + i);
			const n = datoNoegle(d);
			return {
				navn,
				dato: d.getDate(),
				noegle: n,
				erIdag: n === iDag,
				erFremtid: d.getTime() > nu.getTime() && n !== iDag,
				harData: aktiveDage.has(n)
			};
		});
	});

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

	async function skiftLektion(id: string, tilKlaret: boolean) {
		const uid = user?.uid;
		if (!uid) return;
		gemmer = id;
		const foer = new Set(klaret);
		const ny = new Set(klaret);
		if (tilKlaret) ny.add(id);
		else ny.delete(id);
		klaret = ny;
		try {
			await saetKlaret(uid, id, tilKlaret);
		} catch (e) {
			console.error('[ny] kunne ikke gemme klaret-status', e);
			klaret = foer;
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
			{#if fold('skridt', skridtKlaret)}
				<FoldetRaekke
					titel="Dagens små skridt"
					detalje="{skridtData.skridt.length} af {skridtData.skridt.length}"
					onfold={() => foldUd('skridt')}
				/>
			{:else}
				<section class="uge">
					{#each ugen as dag (dag.noegle)}
						<div class="dag" class:idag={dag.erIdag} class:senere={dag.erFremtid}>
							<span class="u">{dag.navn}</span>
							<span class="d">{dag.dato}</span>
							{#if dag.harData}<span class="prik"></span>{/if}
						</div>
					{/each}
				</section>
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
					{lektioner}
					{klaret}
					{gemmer}
					onklaret={skiftLektion}
				/>
			{/if}
		{/if}

		{#if traening}
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

		{#if !aktivtForlob && naesteHold}
			<NaesteHoldKort hold={naesteHold} nu={nuMs} />
		{/if}

		{#if aktivtForlob}
			<a class="coach" href="/ny/moduler">
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
