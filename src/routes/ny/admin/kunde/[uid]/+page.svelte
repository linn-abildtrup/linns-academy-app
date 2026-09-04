<script lang="ts">
	// ============================================================
	// Alt hvad appen ved om ÉN kunde.
	//
	// Linns oenske 3. september 2026, tegnet i mockups-kunde-opslag.html.
	// Foer den dag viste kunde-opslaget kun hendes traening.
	//
	// HVER FANE HENTER FOERST NAAR DEN AABNES. Overblikket er hurtigt, og
	// en fane hun ikke aabner koster ingenting. Der er syv faner og fire af
	// dem laeser undersamlinger, saa alt paa én gang ville vaere langsomt og
	// dyrt.
	//
	// REGLERNE LIGGER I content/kundeOpslag3.ts og er testet. Den her fil
	// tegner kun. Saa kan "hvad er galt med hende" proeves uden at spoerge
	// databasen.
	//
	// SIDEN SKRIVER INGENTING. Alt hvad Linn kan aendre ligger paa de sider
	// der er bygget til det, og knapperne oeverst peger derhen.
	// ============================================================

	import { getContext, onMount } from 'svelte';
	import { page } from '$app/state';
	import type { User } from 'firebase/auth';
	import { isAdmin } from '$lib/admin';
	import { collection, doc, getDoc, getDocs, orderBy, query, where, limit } from 'firebase/firestore';
	import { hentAllowedEmail } from '$lib/firestore/forlob';
	import { db } from '$lib/firebase';
	import type { BrugerProfil, DagligeMaal, UserDoc } from '$lib/types';
	import type { Forlob } from '$lib/content/forlobAdgang';
	import { hentAlleForlob } from '$lib/firestore/forlob';
	import { hentTildelinger3 } from '$lib/firestore/traeningTildeling3';
	import { hentForlobsProgrammer } from '$lib/firestore/mikrotraening';
	import {
		springerIOejnene,
		maerkater,
		dagensTal,
		sidsteDage,
		snitPrRegistreretDag,
		initialer,
		fuldtNavn,
		dageSiden,
		navnMedListen,
		type DagTal,
		type KundeInput,
		type MaaltidRaekke
	} from '$lib/content/kundeOpslag3';
	import AdmSide from '$lib/components/admin/AdmSide.svelte';
	import {
		MRS_ITEMS,
		SUBSCALES,
		SEVERITY,
		SLIDER_SPORGSMAAL,
		MAALEPUNKT_LABEL,
		type MrsScore
	} from '$lib/content/mrs';
	import {
		punkter,
		linje,
		udviklingTekst,
		yAkse,
		RAMME_TOTAL,
		RAMME_SLIDER
	} from '$lib/content/mrsGraf3';
	import AdmKort from '$lib/components/admin/AdmKort.svelte';
	import AdmKnap from '$lib/components/admin/AdmKnap.svelte';
	import AdmTom from '$lib/components/admin/AdmTom.svelte';

	const hentAdmin = getContext<() => User | null>('user');
	const maaVaereHer = $derived(isAdmin(hentAdmin()));

	const uid = $derived(page.params.uid ?? '');
	const nu = Date.now();
	const DAG = 86400000;

	type Fane = 'overblik' | 'forlob' | 'mad' | 'traening' | 'symptomer' | 'beskeder' | 'konto';
	const FANER: { id: Fane; navn: string }[] = [
		{ id: 'overblik', navn: 'Overblik' },
		{ id: 'forlob', navn: 'Forløb' },
		{ id: 'mad', navn: 'Mad' },
		{ id: 'traening', navn: 'Træning' },
		{ id: 'symptomer', navn: 'Symptomer' },
		{ id: 'beskeder', navn: 'Beskeder' },
		{ id: 'konto', navn: 'Konto' }
	];
	let fane = $state<Fane>('overblik');

	let kunde = $state<(UserDoc & { lastName?: string; sidstAktiv3?: number }) | null>(null);
	let henter = $state(true);
	let fejl = $state('');

	let alleForlob = $state<Forlob[]>([]);
	// Efternavnet fra koebslisten. To tredjedele af kunderne har det ikke
	// paa selve kontoen, se kundeOpslag3.navnMedListen.
	let navnFraListen = $state<string | undefined>(undefined);
	let holdHarTraening = $state(false);
	let ubesvarede = $state(0);
	let sidstRegistreret = $state<number | null>(null);
	// Om vi FIK LOV at se efter. Se noten i kundeOpslag3.KundeInput.
	let aktivitetKendt = $state(false);
	let harNoti = $state(false);

	// Hver fane har sin egen tilstand. 'nej' betyder ikke hentet endnu.
	let hentet = $state<Record<string, 'nej' | 'henter' | 'ja' | 'fejl'>>({});

	let maaltider = $state<MaaltidRaekke[]>([]);
	let egneOpskrifter = $state(0);
	let fasteMaaltider = $state(0);
	let traening = $state<{ dato: string; programNavn?: string }[]>([]);
	// Hele maalingen, ikke kun totalen. Sliderne og de elleve svar ligger
	// i den, og Linn skal kunne se dem uden at spoerge kunden.
	let symptomer = $state<MrsScore[]>([]);
	let spoergsmaal = $state<{ spoergsmaal: string; svar?: string; oprettet?: { toMillis?: () => number } }[]>([]);
	let vanedage = $state<Record<string, unknown>[]>([]);

	onMount(() => void indlaesGrundlag());

	async function indlaesGrundlag() {
		henter = true;
		fejl = '';
		try {
			const [snap, forlob, tildelinger] = await Promise.all([
				getDoc(doc(db, 'users', uid)),
				hentAlleForlob().catch(() => [] as Forlob[]),
				hentTildelinger3().catch(() => [])
			]);
			if (!snap.exists()) {
				fejl = 'Der findes ingen kunde med det id.';
				return;
			}
			kunde = snap.data() as UserDoc & { lastName?: string; sidstAktiv3?: number };
			alleForlob = forlob;

			// HENDES EGEN RAEKKE, ikke hele koebslisten. Soegesiden henter alle
			// navne, fordi den skal kunne soege i dem. Her er der ét navn at
			// bruge, og saa er 900 opslag spild.
			void (async () => {
				try {
					const r = await hentAllowedEmail(kunde?.email ?? '');
					const n = `${r?.firstName ?? ''} ${r?.lastName ?? ''}`.trim();
					if (n) navnFraListen = n;
				} catch (e) {
					console.warn('[admin] navn fra købslisten', e);
				}
			})();

			// Har hun traening at tage? Det er den enkelte ting der oftest er
			// glemt, se 9.32.
			//
			// DER ER TO STEDER AT KIGGE. 3.0 tildeler programmer i en liste
			// for sig. Kickstart og Kropsro har dem liggende paa selve
			// holdet, hvor kunden vaelger sin variant ved opstarten. Kiggede
			// man kun ét sted, fik hver eneste kunde paa den gamle app
			// "ingen traening tildelt" selvom holdet havde begge programmer.
			// Opdaget paa Randi 4. september.
			const rigtige = tildelinger.filter((t) => t.type === 'program');
			const alleHarEt = rigtige.some((t) => t.modtagerType === 'alle');
			const daekket = new Set(
				rigtige.filter((t) => t.modtagerType === 'hold').map((t) => t.modtagerId)
			);
			const hendes = (kunde as unknown as { forlobIds?: string[] }).forlobIds ?? [];
			const tildelt =
				alleHarEt ||
				rigtige.some((t) => t.modtagerType === 'kunde' && t.modtagerId === uid) ||
				hendes.some((f) => daekket.has(f));

			holdHarTraening = tildelt;
			if (!tildelt) {
				void (async () => {
					const lister = await Promise.all(
						hendes.map((f) => hentForlobsProgrammer(f).catch(() => []))
					);
					if (lister.some((l) => l.length > 0)) holdHarTraening = true;
				})();
			}

			// De tre smaa ting overblikket har brug for. Hver fejler for sig,
			// saa en manglende rettighed ét sted ikke tager hele siden.
			void (async () => {
				try {
					const q = query(collection(db, 'klientspoergsmaal'), where('uid', '==', uid));
					const s = await getDocs(q);
					ubesvarede = s.docs.filter((d) => !(d.data() as { svar?: string }).svar).length;
				} catch (e) {
					console.warn('[admin] spørgsmål', e);
				}
			})();

			void (async () => {
				try {
					// HVORNAAR VAR HUN HER SIDST. Login-datoen lyver: en kunde med
					// appen paa hjemmeskaermen staar logget ind i maaneder uden at
					// aabne noget. Derfor det seneste af to ting hun selv har gjort,
					// nemlig vores eget stempel og hendes sidste registrering.
					const s = await getDocs(
						query(collection(db, 'users', uid, 'maaltider'), orderBy('dato', 'desc'), limit(1))
					);
					const dato = (s.docs[0]?.data() as { dato?: string } | undefined)?.dato;
					const fraMad = dato ? new Date(`${dato}T12:00:00`).getTime() : 0;
					const stempel = (kunde as unknown as { sidstAktiv3?: number })?.sidstAktiv3 ?? 0;
					sidstRegistreret = Math.max(fraMad, stempel) || null;
					aktivitetKendt = true;
				} catch (e) {
					// VI SIGER IKKE "ALDRIG" NAAR VI IKKE FIK LOV AT SE EFTER.
					console.warn('[admin] seneste registrering', e);
					aktivitetKendt = false;
				}
			})();

			void (async () => {
				// Om hun kan naas paa telefonen. Har hun ingen telefon liggende,
				// er beskederne ligegyldige, hvad enten hun har slaaet dem fra
				// eller aldrig er blevet spurgt.
				try {
					const s = await getDocs(collection(db, 'users', uid, 'pushTelefon3'));
					harNoti = !s.empty;
				} catch {
					harNoti = false;
				}
			})();
		} catch (e) {
			console.error('[admin] kunde', e);
			fejl = 'Kunne ikke hente kunden.';
		} finally {
			henter = false;
		}
	}

	const navn = $derived(
		navnMedListen(kunde?.firstName ?? '', kunde?.lastName ?? '', navnFraListen)
	);

	const forlobIds = $derived((kunde as unknown as { forlobIds?: string[] })?.forlobIds ?? []);
	const afsluttede = $derived(
		(kunde as unknown as { afsluttedeForlobIds?: string[] })?.afsluttedeForlobIds ?? []
	);

	const aktivtForlob = $derived.by<Forlob | null>(() => {
		for (const id of forlobIds) {
			const f = alleForlob.find((x) => x.id === id);
			if (!f) continue;
			const start = f.startDato?.toMillis?.() ?? 0;
			const dage = Number(f.antalDage) || 0;
			if (!start || !dage) continue;
			if (nu >= start && nu <= start + (dage + 1) * DAG) return f;
		}
		return null;
	});

	const dagNummer = $derived.by(() => {
		const f = aktivtForlob;
		if (!f) return 0;
		const start = f.startDato?.toMillis?.() ?? 0;
		return Math.min(f.antalDage, Math.max(1, Math.floor((nu - start) / DAG) + 1));
	});

	const paaNyApp = $derived(((kunde?.testerFeatures ?? []) as string[]).includes('ny-app'));

	// expiresAt er den dato der faktisk lukker adgangen. aboSlutterAt er
	// registreret fra Simplero men haandhaeves ikke, saa den bruges kun
	// naar der ikke staar noget andet.
	const udloeberOm = $derived.by<number | null>(() => {
		const ms = kunde?.expiresAt ?? (kunde as unknown as { aboSlutterAt?: number })?.aboSlutterAt;
		if (!ms) return null;
		return Math.floor((ms - nu) / DAG);
	});

	const input = $derived<KundeInput>({
		harAktivtForlob: !!aktivtForlob,
		forlobNavn: aktivtForlob ? `${aktivtForlob.navn} · dag ${dagNummer} af ${aktivtForlob.antalDage}` : '',
		holdHarTraening,
		paaNyApp,
		harSagtJaTilBeskeder: harNoti,
		ubesvaredeSpoergsmaal: ubesvarede,
		dageSidenAktiv: dageSiden(sidstRegistreret, nu),
		aktivitetKendt,
		adgangUdloeberOm: udloeberOm,
		onboardet: (kunde as unknown as { onboardet3?: boolean })?.onboardet3 === true
	});

	const opmaerksomhed = $derived(springerIOejnene(input));
	const topMaerker = $derived(maerkater(input));

	const maal = $derived<Partial<DagligeMaal>>(kunde?.dagligeMaal ?? {});
	const profil = $derived<Partial<BrugerProfil>>(kunde?.brugerProfil ?? {});

	// De maalinger der faktisk har MRS-tal. En migreret raekke fra
	// vaner-modulet har kun sliders og ville ellers tegne en total paa nul.
	const mrsMaalinger = $derived(symptomer.filter((s) => s.kunSliders !== true));
	const medSliders = $derived(symptomer.filter((s) => s.sliders !== undefined));
	const sidsteMaaling = $derived(symptomer[symptomer.length - 1] ?? null);

	const totalPunkter = $derived(
		punkter(
			mrsMaalinger.map((s) => ({ t: s.timestamp ?? 0, v: s.total ?? 0 })),
			RAMME_TOTAL
		)
	);

	/** Kurven for én slider. */
	function sliderPunkter(id: keyof NonNullable<MrsScore['sliders']>) {
		return punkter(
			medSliders.map((s) => ({ t: s.timestamp ?? 0, v: s.sliders?.[id] ?? 1 })),
			RAMME_SLIDER
		);
	}

	function svarOrd(v: number | undefined): string {
		return SEVERITY.find((x) => x.value === v)?.label ?? '—';
	}

	const dageMedTal = $derived(dagensTal(maaltider, maal.protein ?? 90));
	const soejler = $derived(sidsteDage(14, nu).map((d) => dageMedTal.get(d) ?? null));
	const snit = $derived(snitPrRegistreretDag([...dageMedTal.values()]));

	/** Henter en fanes data foerste gang den aabnes. */
	async function aabnFane(id: Fane) {
		fane = id;
		if (hentet[id] && hentet[id] !== 'nej') return;
		hentet = { ...hentet, [id]: 'henter' };
		try {
			if (id === 'mad') {
				const [m, o, f] = await Promise.all([
					getDocs(query(collection(db, 'users', uid, 'maaltider'), limit(500))),
					getDocs(collection(db, 'users', uid, 'privateOpskrifter')),
					getDocs(collection(db, 'users', uid, 'favoritmaaltider'))
				]);
				maaltider = m.docs.map((d) => d.data() as MaaltidRaekke);
				egneOpskrifter = o.size;
				fasteMaaltider = f.size;
			} else if (id === 'traening') {
				const s = await getDocs(collection(db, 'users', uid, 'traeningHistorik'));
				traening = s.docs
					.map((d) => d.data() as { dato: string; programNavn?: string })
					.sort((a, b) => (b.dato ?? '').localeCompare(a.dato ?? ''));
			} else if (id === 'symptomer') {
				const s = await getDocs(collection(db, 'users', uid, 'mrs_scores'));
				symptomer = s.docs
					.map((d) => ({ id: d.id, ...(d.data() as Omit<MrsScore, 'id'>) }))
					.sort((a, b) => (a.timestamp ?? 0) - (b.timestamp ?? 0));
			} else if (id === 'beskeder') {
				const s = await getDocs(query(collection(db, 'klientspoergsmaal'), where('uid', '==', uid)));
				spoergsmaal = s.docs
					.map((d) => d.data() as { spoergsmaal: string; svar?: string; oprettet?: { toMillis?: () => number } })
					.sort((a, b) => (b.oprettet?.toMillis?.() ?? 0) - (a.oprettet?.toMillis?.() ?? 0));
			} else if (id === 'forlob') {
				const prod = await getDocs(collection(db, 'users', uid, 'products'));
				const alle: Record<string, unknown>[] = [];
				for (const p of prod.docs) {
					const v = await getDocs(collection(p.ref, 'vanedage'));
					for (const d of v.docs) alle.push({ id: d.id, produkt: p.id, ...d.data() });
				}
				vanedage = alle.sort((a, b) => String(b.id).localeCompare(String(a.id)));
			}
			hentet = { ...hentet, [id]: 'ja' };
		} catch (e) {
			console.error('[admin] fane', id, e);
			hentet = { ...hentet, [id]: 'fejl' };
		}
	}

	function dato(ms?: number | null): string {
		if (!ms) return '—';
		return new Date(ms).toLocaleDateString('da-DK', { day: 'numeric', month: 'short', year: 'numeric' });
	}

	// Fasen staar i databasen som et kodeord. Linn skal laese et ord.
	const FASE: Record<string, string> = {
		praemenopause: 'Præmenopause',
		perimenopause: 'Perimenopause',
		postmenopause: 'Postmenopause'
	};
	const AKTIVITET: Record<string, string> = {
		stille: 'Stillesiddende',
		let: 'Let aktiv',
		moderat: 'Moderat aktiv',
		meget: 'Meget aktiv'
	};

	function navnPaaForlob(id: string): string {
		return alleForlob.find((f) => f.id === id)?.navn ?? id;
	}
</script>

<svelte:head>
	<title>{kunde ? fuldtNavn(navn.fornavn, navn.efternavn, kunde.email ?? '') : 'Kunde'} · Admin</title>
</svelte:head>

{#if !maaVaereHer}
	<p class="ku-kun">Siden er kun for admin.</p>
{:else if henter}
	<AdmSide titel="Kunde"><AdmTom tekst="Henter kunden…" /></AdmSide>
{:else if fejl || !kunde}
	<AdmSide titel="Kunde">
		<AdmTom tekst={fejl || 'Kunne ikke hente kunden.'} fejl>
			{#snippet handling()}
				<AdmKnap onclick={() => (window.location.href = '/ny/admin/kunde')}>Tilbage til søgning</AdmKnap>
			{/snippet}
		</AdmTom>
	</AdmSide>
{:else}
	<div class="ku">
		<!-- TOPPEN STAAR FAST naar du skifter fane. Et navn der forsvinder
		     goer at man kommer til at kigge paa den forkerte kunde. -->
		<header class="ku-top">
			<span class="ku-ini">{initialer(navn.fornavn, navn.efternavn, kunde.email ?? '')}</span>
			<div class="ku-hvem">
				<h1>{fuldtNavn(navn.fornavn, navn.efternavn, kunde.email ?? '')}</h1>
				<p class="ku-mail">
					{kunde.email}
					{#if kunde.createdAt}· kunde siden {dato(kunde.createdAt)}{/if}
				</p>
				<div class="ku-maerker">
					{#each topMaerker as m (m.tekst)}
						<span class="ku-mrk" class:se={m.alvor === 'se'}>{m.tekst}</span>
					{/each}
				</div>
			</div>
			<div class="ku-handling">
				<AdmKnap slags="primaer" onclick={() => (window.location.href = '/ny/admin/skriv')}>
					Skriv til hende
				</AdmKnap>
				<AdmKnap onclick={() => (window.location.href = '/ny/admin/kunde')}>Anden kunde</AdmKnap>
			</div>
		</header>

		<nav class="ku-faner">
			{#each FANER as f (f.id)}
				<button type="button" class="ku-fane" class:paa={fane === f.id} onclick={() => aabnFane(f.id)}>
					{f.navn}
				</button>
			{/each}
		</nav>

		<div class="ku-krop">
			{#if fane === 'overblik'}
				<div class="ku-rk">
					<AdmKort>
						<h3>Sidst i appen</h3>
						<span class="ku-stor">
							{#if !aktivitetKendt}Ved ikke
							{:else if input.dageSidenAktiv === null}Aldrig
							{:else if input.dageSidenAktiv === 0}I dag
							{:else if input.dageSidenAktiv === 1}I går
							{:else}{input.dageSidenAktiv} dage siden{/if}
						</span>
						<span class="ku-u">
							{#if !aktivitetKendt}
								Hendes registreringer kunne ikke hentes. Det er ikke det samme som at der ikke
								er nogen.
							{:else}
								Målt på hvornår hun sidst registrerede noget. Login-datoen lyver.
							{/if}
						</span>
					</AdmKort>
					<AdmKort>
						<h3>Dag i forløbet</h3>
						{#if aktivtForlob}
							<span class="ku-stor">{dagNummer} <em>af {aktivtForlob.antalDage}</em></span>
							<div class="ku-bar"><i style="width:{Math.round((dagNummer / aktivtForlob.antalDage) * 100)}%"></i></div>
						{:else}
							<span class="ku-stor">—</span>
							<span class="ku-u">Hun er ikke på et forløb lige nu</span>
						{/if}
					</AdmKort>
					<AdmKort>
						<h3>Ubesvarede spørgsmål</h3>
						<span class="ku-stor">{ubesvarede}</span>
						<span class="ku-u">{ubesvarede === 0 ? 'Alt er besvaret' : 'Se dem under Beskeder'}</span>
					</AdmKort>
				</div>

				<!-- DEN VIGTIGSTE BOKS. Den samler det der er galt ét sted, i
				     stedet for at Linn skal lede paa syv faner. -->
				<AdmKort>
					<h3>Det der springer i øjnene</h3>
					{#if opmaerksomhed.length === 0}
						<p class="ku-ok">Der er ikke noget der ser forkert ud for hende.</p>
					{:else}
						{#each opmaerksomhed as o (o.id)}
							<div class="ku-op" class:stop={o.alvor === 'stop'}>
								<span class="ku-op-t">{o.tekst}</span>
								<span class="ku-op-h">{o.hvad}</span>
							</div>
						{/each}
					{/if}
				</AdmKort>
			{:else if hentet[fane] === 'henter'}
				<AdmTom tekst="Henter…" />
			{:else if hentet[fane] === 'fejl'}
				<AdmTom tekst="Kunne ikke hente det her. Resten af siden virker." fejl>
					{#snippet handling()}
						<AdmKnap onclick={() => aabnFane(fane)}>Prøv igen</AdmKnap>
					{/snippet}
				</AdmTom>
			{:else if fane === 'mad'}
				<div class="ku-rk to">
					<AdmKort>
						<h3>Protein de sidste 14 dage</h3>
						<div class="ku-graf">
							{#each soejler as d, i (i)}
								<i
									class:ramte={d?.ramteMaal}
									style="height:{d ? Math.min(100, Math.round((d.protein / Math.max(1, maal.protein ?? 90)) * 100)) : 0}%"
									title={d ? `${d.dato}: ${d.protein} g` : 'ingen registrering'}
								></i>
							{/each}
						</div>
						<span class="ku-u">
							Mørk søjle er en dag hun ramte målet. Tom plads er en dag uden registrering.
						</span>
					</AdmKort>
					<AdmKort>
						<h3>Hendes mål og profil</h3>
						<div class="ku-l"><b>Protein</b><span>{maal.protein ?? 90} g</span></div>
						<div class="ku-l"><b>Fiber</b><span>{maal.fiber ?? 30} g</span></div>
						{#if maal.kcal}<div class="ku-l"><b>Kalorier</b><span>{maal.kcal}</span></div>{/if}
						{#if profil.hojde || profil.vaegt}
							<div class="ku-l"><b>Højde og vægt</b><span>{profil.hojde ?? '—'} cm · {profil.vaegt ?? '—'} kg</span></div>
						{/if}
						{#if profil.alder || profil.menopaus}
							<div class="ku-l">
								<b>Alder og fase</b>
								<span>{profil.alder ?? '—'} år · {profil.menopaus ? (FASE[profil.menopaus] ?? profil.menopaus) : '—'}</span>
							</div>
						{/if}
						{#if profil.aktivitet}
							<div class="ku-l"><b>Aktivitet</b><span>{AKTIVITET[profil.aktivitet] ?? profil.aktivitet}</span></div>
						{/if}
					</AdmKort>
				</div>

				<div class="ku-rk">
					<AdmKort><h3>Snit pr dag hun har tastet</h3><span class="ku-stor">{snit.protein} g</span><span class="ku-u">protein, målt på {snit.antal} dage</span></AdmKort>
					<AdmKort><h3>Egne opskrifter</h3><span class="ku-stor">{egneOpskrifter}</span></AdmKort>
					<AdmKort><h3>Faste måltider</h3><span class="ku-stor">{fasteMaaltider}</span></AdmKort>
				</div>
			{:else if fane === 'traening'}
				<AdmKort>
					<h3>Træninger hun har taget</h3>
					{#if traening.length === 0}
						<p class="ku-tom">Hun har ikke taget nogen træninger endnu.</p>
					{:else}
						<p class="ku-u">{traening.length} i alt</p>
						{#each traening.slice(0, 40) as t, i (i)}
							<div class="ku-l"><b>{t.dato}</b><span>{t.programNavn ?? ''}</span></div>
						{/each}
					{/if}
				</AdmKort>
			{:else if fane === 'symptomer'}
				{#if symptomer.length === 0}
					<AdmKort>
						<h3>Symptomtjek</h3>
						<p class="ku-tom">Hun har ikke udfyldt et symptomtjek endnu.</p>
					</AdmKort>
				{:else}
					<!-- TO SKALAER DER VENDER HVER SIN VEJ. MRS gaar 0 til 44 og
					     lavt er bedst. Sliderne gaar 1 til 10 og hoejt er bedst.
					     Derfor staar der ved hver kurve hvad der er den gode vej,
					     saa ingen kommer til at laese den forkert. -->
					{#if mrsMaalinger.length > 0}
						<AdmKort>
							<h3>Symptomer over tid</h3>
							<p class="ku-u">
								Menopause Rating Scale, 0 til 44. <b>Et lavere tal er bedre</b>, altså færre
								gener. En kurve der falder er et godt tegn.
							</p>
							<div class="ku-graf-r">
								<div class="ku-y">
									{#each yAkse(RAMME_TOTAL, 5) as v (v)}<span>{v}</span>{/each}
								</div>
								<svg class="ku-svg" viewBox="0 0 {RAMME_TOTAL.bredde} {RAMME_TOTAL.hoejde}" preserveAspectRatio="none">
									<line x1={RAMME_TOTAL.kant} y1={RAMME_TOTAL.kant} x2={RAMME_TOTAL.kant} y2={RAMME_TOTAL.hoejde - RAMME_TOTAL.kant} stroke="var(--line)" />
									<line x1={RAMME_TOTAL.kant} y1={RAMME_TOTAL.hoejde - RAMME_TOTAL.kant} x2={RAMME_TOTAL.bredde - RAMME_TOTAL.kant} y2={RAMME_TOTAL.hoejde - RAMME_TOTAL.kant} stroke="var(--line)" />
									<path d={linje(totalPunkter)} fill="none" stroke="var(--plum)" stroke-width="2.5" stroke-linejoin="round" />
									{#each totalPunkter as p (p.t)}
										<circle cx={p.x} cy={p.y} r="4" fill="var(--plum)" />
									{/each}
								</svg>
							</div>
							<div class="ku-x">
								<span>{dato(mrsMaalinger[0].timestamp)}</span>
								<span>{dato(mrsMaalinger[mrsMaalinger.length - 1].timestamp)}</span>
							</div>
							<p class="ku-u">
								{udviklingTekst(
									mrsMaalinger.map((s) => ({ t: s.timestamp ?? 0, v: s.total ?? 0 })),
									true,
									'Hendes samlede tal'
								)}
							</p>
						</AdmKort>

						<AdmKort>
							<h3>Hver måling</h3>
							<p class="ku-u">De tre delscorer viser hvor generne sidder.</p>
							{#each [...mrsMaalinger].reverse() as m (m.id)}
								<div class="ku-m">
									<div class="ku-m-h">
										<b>{MAALEPUNKT_LABEL[m.measurePoint] ?? m.measurePoint}</b>
										<span>{dato(m.timestamp)}</span>
										<em>{m.total ?? '—'} af 44</em>
									</div>
									<div class="ku-sub">
										{#each Object.entries(SUBSCALES) as [noegle, def] (noegle)}
											<span>
												{def.label}
												<b>{m.subscales?.[noegle as keyof typeof m.subscales] ?? '—'}</b>
											</span>
										{/each}
									</div>
								</div>
							{/each}
						</AdmKort>
					{/if}

					{#if medSliders.length > 0}
						<AdmKort>
							<h3>Hendes egen vurdering</h3>
							<p class="ku-u">
								De fem sliders hun sætter selv, 1 til 10. <b>Her er et højere tal bedre</b>, altså
								modsat kurven ovenfor. Cravings tæller også den vej: 10 betyder ingen.
							</p>
							{#each SLIDER_SPORGSMAAL as spm (spm.id)}
								{@const p = sliderPunkter(spm.id)}
								<div class="ku-mini">
									<div class="ku-mini-h">
										<span>{spm.label}</span>
										<b>{medSliders[medSliders.length - 1].sliders?.[spm.id] ?? '—'}</b>
									</div>
									<div class="ku-graf-r">
										<div class="ku-y lille">
											{#each yAkse(RAMME_SLIDER, 3) as v (v)}<span>{v}</span>{/each}
										</div>
										<svg class="ku-svg lille" viewBox="0 0 {RAMME_SLIDER.bredde} {RAMME_SLIDER.hoejde}" preserveAspectRatio="none">
											<line x1={RAMME_SLIDER.kant} y1={RAMME_SLIDER.kant} x2={RAMME_SLIDER.kant} y2={RAMME_SLIDER.hoejde - RAMME_SLIDER.kant} stroke="var(--line)" />
											<line x1={RAMME_SLIDER.kant} y1={RAMME_SLIDER.hoejde - RAMME_SLIDER.kant} x2={RAMME_SLIDER.bredde - RAMME_SLIDER.kant} y2={RAMME_SLIDER.hoejde - RAMME_SLIDER.kant} stroke="var(--line)" />
											<path d={linje(p)} fill="none" stroke="var(--sage)" stroke-width="2" stroke-linejoin="round" />
											{#each p as q (q.t)}
												<circle cx={q.x} cy={q.y} r="3" fill="var(--sage)" />
											{/each}
										</svg>
									</div>
									<p class="ku-u">
										{udviklingTekst(
											medSliders.map((s) => ({ t: s.timestamp ?? 0, v: s.sliders?.[spm.id] ?? 1 })),
											false,
											'Tallet'
										)}
									</p>
								</div>
							{/each}
							<div class="ku-x">
								<span>{dato(medSliders[0].timestamp)}</span>
								<span>{dato(medSliders[medSliders.length - 1].timestamp)}</span>
							</div>
						</AdmKort>
					{/if}

					{#if sidsteMaaling && sidsteMaaling.kunSliders !== true}
						<AdmKort>
							<h3>Seneste måling, spørgsmål for spørgsmål</h3>
							<p class="ku-u">Udfyldt {dato(sidsteMaaling.timestamp)}.</p>
							{#each MRS_ITEMS as item (item.id)}
								<div class="ku-l">
									<b>{item.da}</b>
									<span>{svarOrd(sidsteMaaling.scores?.[item.id])}</span>
								</div>
							{/each}
						</AdmKort>
					{/if}
				{/if}
			{:else if fane === 'beskeder'}
				<AdmKort>
					<h3>Hvad hun har spurgt om</h3>
					{#if spoergsmaal.length === 0}
						<p class="ku-tom">Hun har ikke skrevet til dig endnu.</p>
					{:else}
						{#each spoergsmaal as q, i (i)}
							<div class="ku-sp">
								<div class="ku-sp-m">{dato(q.oprettet?.toMillis?.())}</div>
								<p>{q.spoergsmaal}</p>
								{#if q.svar}<div class="ku-sp-s"><b>Dit svar</b><p>{q.svar}</p></div>
								{:else}<div class="ku-sp-venter">Venter på svar</div>{/if}
							</div>
						{/each}
					{/if}
				</AdmKort>
			{:else if fane === 'forlob'}
				<AdmKort>
					<h3>Hold</h3>
					{#if forlobIds.length === 0 && afsluttede.length === 0}
						<p class="ku-tom">Hun har aldrig været på et forløb.</p>
					{:else}
						{#each forlobIds as id (id)}
							<div class="ku-l"><b>{navnPaaForlob(id)}</b><span>{aktivtForlob?.id === id ? 'kører nu' : 'på hendes konto'}</span></div>
						{/each}
						{#each afsluttede as id (id)}
							<div class="ku-l"><b>{navnPaaForlob(id)}</b><span>afsluttet</span></div>
						{/each}
					{/if}
				</AdmKort>
				<AdmKort>
					<h3>Hendes dage</h3>
					{#if vanedage.length === 0}
						<p class="ku-tom">Hun har ikke svaret på noget endnu.</p>
					{:else}
						<p class="ku-u">{vanedage.length} dage med svar</p>
						{#each vanedage.slice(0, 30) as d, i (i)}
							<div class="ku-l">
								<b>{String(d.id)}</b>
								<span>{typeof d.refleksion === 'string' && d.refleksion ? d.refleksion : ''}</span>
							</div>
						{/each}
					{/if}
				</AdmKort>
			{:else if fane === 'konto'}
				<AdmKort>
					<h3>Adgang</h3>
					<div class="ku-l"><b>Mail</b><span>{kunde.email}</span></div>
					<div class="ku-l"><b>Produkt</b><span>{(kunde as unknown as { activeProduct?: string }).activeProduct ?? '—'}</span></div>
					<div class="ku-l"><b>Niveau</b><span>{(kunde as unknown as { accessLevel?: string }).accessLevel ?? '—'}</span></div>
					<div class="ku-l"><b>Adgang udløber</b><span>{udloeberOm === null ? 'Løbende, udløber ikke' : `om ${udloeberOm} dage`}</span></div>
					<div class="ku-l"><b>På den nye app</b><span>{paaNyApp ? 'Ja' : 'Nej'}</span></div>
					<div class="ku-l"><b>Kan nås på telefonen</b><span>{harNoti ? 'Ja' : 'Nej'}</span></div>
					<div class="ku-l"><b>App-version</b><span>{(kunde as unknown as { appVersion?: string }).appVersion ?? '—'}</span></div>
					<div class="ku-l"><b>Tekststørrelse</b><span>{(kunde as unknown as { tekstSkala3?: string }).tekstSkala3 ?? 'Normal'}</span></div>
					<div class="ku-l"><b>Tester af</b><span>{((kunde.testerFeatures ?? []) as string[]).join(', ') || 'ingenting'}</span></div>
				</AdmKort>
			{/if}
		</div>

		<p class="ku-fod">
			Siden skriver ingenting. Skal noget rettes, ligger det under Kunder, Abonnenter eller
			Beskeder.
		</p>
	</div>
{/if}

<style>
	.ku-kun {
		padding: 24px 18px;
		color: var(--ink-2);
		font-size: calc(14px * var(--fs-scale, 1));
	}

	.ku {
		max-width: 1100px;
		margin: 0 auto;
		padding: 22px 20px 60px;
	}

	.ku-top {
		display: flex;
		align-items: flex-start;
		gap: 15px;
		flex-wrap: wrap;
		margin-bottom: 16px;
	}

	.ku-ini {
		width: 56px;
		height: 56px;
		flex-shrink: 0;
		display: grid;
		place-items: center;
		background: var(--plum-tint);
		border-radius: 16px;
		color: var(--plum);
		font-size: calc(21px * var(--fs-scale, 1));
		font-weight: 600;
	}

	.ku-hvem {
		min-width: 0;
		flex: 1 1 260px;
	}

	.ku-hvem h1 {
		margin: 0;
		font-size: calc(24px * var(--fs-scale, 1));
		font-weight: 600;
		letter-spacing: -0.02em;
	}

	.ku-mail {
		margin: 2px 0 0;
		font-size: calc(12.5px * var(--fs-scale, 1));
		color: var(--ink-3);
	}

	.ku-maerker {
		display: flex;
		gap: 6px;
		flex-wrap: wrap;
		margin-top: 8px;
	}

	.ku-mrk {
		padding: 3px 10px;
		border-radius: 99px;
		background: var(--sage-tint);
		color: var(--sage-tekst);
		font-size: calc(11px * var(--fs-scale, 1));
		font-weight: 700;
	}

	.ku-mrk.se {
		background: var(--honey-tint);
		color: var(--honey-deep);
	}

	.ku-handling {
		display: flex;
		gap: 8px;
		flex-wrap: wrap;
	}

	.ku-faner {
		display: flex;
		gap: 6px;
		flex-wrap: wrap;
		padding-bottom: 12px;
		margin-bottom: 14px;
		border-bottom: 1px solid var(--line);
	}

	/* Baggrunden staar eksplicit, se noten i AdmKnap. */
	.ku-fane {
		padding: 8px 14px;
		background: var(--paper-2);
		border: 1px solid var(--line);
		border-radius: 99px;
		color: var(--ink-2);
		font-size: calc(12.5px * var(--fs-scale, 1));
		font-family: inherit;
		font-weight: 600;
		cursor: pointer;
	}

	.ku-fane.paa {
		background: var(--plum);
		border-color: var(--plum);
		color: #fff;
	}

	.ku-rk {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(210px, 1fr));
		gap: 11px;
	}

	.ku-rk.to {
		grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
	}

	.ku-krop :global(h3) {
		margin: 0 0 9px;
		font-size: calc(10.5px * var(--fs-scale, 1));
		font-weight: 700;
		letter-spacing: 0.12em;
		text-transform: uppercase;
		color: var(--ink-3);
	}

	.ku-stor {
		display: block;
		font-size: calc(27px * var(--fs-scale, 1));
		line-height: 1.05;
		letter-spacing: -0.02em;
	}

	.ku-stor em {
		font-size: calc(14px * var(--fs-scale, 1));
		color: var(--ink-3);
		font-style: normal;
	}

	.ku-u {
		display: block;
		margin-top: 5px;
		font-size: calc(11.5px * var(--fs-scale, 1));
		color: var(--ink-3);
		line-height: 1.45;
	}

	.ku-bar {
		height: 7px;
		border-radius: 99px;
		background: var(--line);
		overflow: hidden;
		margin-top: 8px;
	}

	.ku-bar i {
		display: block;
		height: 100%;
		background: var(--plum);
	}

	.ku-graf {
		display: flex;
		align-items: flex-end;
		gap: 3px;
		height: 60px;
		margin-top: 4px;
	}

	.ku-graf i {
		flex: 1;
		min-height: 2px;
		background: var(--plum-tint);
		border-radius: 3px 3px 0 0;
	}

	.ku-graf i.ramte {
		background: var(--plum);
	}

	.ku-l {
		display: flex;
		justify-content: space-between;
		gap: 12px;
		padding: 6px 0;
		border-bottom: 1px solid var(--line);
		font-size: calc(13px * var(--fs-scale, 1));
	}

	.ku-l:last-child {
		border-bottom: none;
	}

	.ku-l b {
		font-weight: 600;
	}

	.ku-l span {
		color: var(--ink-2);
		text-align: right;
		min-width: 0;
	}

	.ku-ok {
		margin: 0;
		font-size: calc(13.5px * var(--fs-scale, 1));
		color: var(--sage-tekst);
		font-weight: 600;
	}

	.ku-tom {
		margin: 0;
		font-size: calc(12.5px * var(--fs-scale, 1));
		color: var(--ink-3);
		font-style: italic;
	}

	.ku-op {
		padding: 11px 13px;
		background: var(--honey-tint);
		border-radius: 11px;
		margin-bottom: 7px;
	}

	.ku-op.stop {
		background: var(--ler-tint);
	}

	.ku-op-t {
		display: block;
		font-size: calc(13.5px * var(--fs-scale, 1));
		font-weight: 600;
		color: var(--honey-deep);
	}

	.ku-op.stop .ku-op-t {
		color: var(--ler-tekst);
	}

	.ku-op-h {
		display: block;
		margin-top: 2px;
		font-size: calc(11.5px * var(--fs-scale, 1));
		color: var(--ink-2);
	}

	/* Kurverne. Y-aksen staar for sig, saa tallene ikke bliver traukket
	   skaeve naar selve tegningen straekkes i bredden. */
	.ku-graf-r {
		display: flex;
		align-items: stretch;
		gap: 7px;
		margin-top: 6px;
	}

	.ku-y {
		display: flex;
		flex-direction: column;
		justify-content: space-between;
		padding: 8px 0;
		font-size: calc(10px * var(--fs-scale, 1));
		color: var(--ink-3);
		text-align: right;
		min-width: 18px;
	}

	.ku-svg {
		flex: 1;
		height: 130px;
		width: 100%;
	}

	.ku-svg.lille {
		height: 78px;
	}

	.ku-x {
		display: flex;
		justify-content: space-between;
		padding-left: 25px;
		font-size: calc(10.5px * var(--fs-scale, 1));
		color: var(--ink-3);
	}

	.ku-m {
		padding: 10px 0;
		border-bottom: 1px solid var(--line);
	}

	.ku-m:last-child {
		border-bottom: none;
	}

	.ku-m-h {
		display: flex;
		align-items: baseline;
		gap: 8px;
		flex-wrap: wrap;
		font-size: calc(13px * var(--fs-scale, 1));
	}

	.ku-m-h span {
		color: var(--ink-3);
		font-size: calc(11.5px * var(--fs-scale, 1));
	}

	.ku-m-h em {
		margin-left: auto;
		font-style: normal;
		font-weight: 600;
		color: var(--plum);
	}

	.ku-sub {
		display: flex;
		gap: 7px;
		flex-wrap: wrap;
		margin-top: 6px;
	}

	.ku-sub span {
		padding: 4px 11px;
		background: var(--paper);
		border-radius: 99px;
		font-size: calc(11.5px * var(--fs-scale, 1));
		color: var(--ink-2);
	}

	.ku-sub b {
		margin-left: 5px;
		color: var(--espresso);
	}

	.ku-mini {
		margin-bottom: 14px;
	}

	.ku-mini-h {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: 10px;
		font-size: calc(12.5px * var(--fs-scale, 1));
		color: var(--ink-2);
	}

	.ku-mini-h b {
		font-size: calc(15px * var(--fs-scale, 1));
		color: var(--sage-tekst);
	}

	.ku-sp {
		padding: 11px 13px;
		background: var(--paper);
		border-radius: 11px;
		margin-bottom: 7px;
	}

	.ku-sp-m {
		font-size: calc(11px * var(--fs-scale, 1));
		color: var(--ink-3);
		margin-bottom: 3px;
	}

	.ku-sp p {
		margin: 0;
		font-size: calc(13px * var(--fs-scale, 1));
		line-height: 1.5;
		white-space: pre-wrap;
	}

	.ku-sp-s {
		margin-top: 7px;
		padding-top: 7px;
		border-top: 1px solid var(--line);
	}

	.ku-sp-s b {
		display: block;
		font-size: calc(10.5px * var(--fs-scale, 1));
		font-weight: 700;
		letter-spacing: 0.09em;
		text-transform: uppercase;
		color: var(--ink-3);
		margin-bottom: 3px;
	}

	.ku-sp-venter {
		margin-top: 7px;
		font-size: calc(11.5px * var(--fs-scale, 1));
		color: var(--ler-tekst);
		font-weight: 600;
	}

	.ku-fod {
		margin: 22px 0 0;
		font-size: calc(11.5px * var(--fs-scale, 1));
		color: var(--ink-3);
	}

	@media (max-width: 700px) {
		.ku {
			padding: 16px 15px 44px;
		}

		.ku-handling {
			width: 100%;
		}
	}
</style>
