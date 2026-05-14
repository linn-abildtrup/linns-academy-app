<script lang="ts">
	import { getContext, onDestroy, onMount } from 'svelte';
	import { page } from '$app/state';
	import { replaceState } from '$app/navigation';
	import type { User } from 'firebase/auth';
	import type {
		FaqKategori,
		FaqItem,
		GuideKategori,
		GuideItem,
		GuideType
	} from '$lib/content/bibliotek';
	import type { ForlobDag, LektionItem } from '$lib/content/forlob';
	import { getCurrentDay } from '$lib/content/forlob';
	import {
		formatDanskDato,
		GUIDE_TYPE_LABELS,
		grupperEfterKategori,
		kunUdgivne,
		sorterGuides,
		sorterItems,
		sorterKategorier,
		detekterGuideType,
		videoEmbedUrl
	} from '$lib/content/bibliotek';
	import {
		hentFaqKategorier,
		hentFaqItems,
		hentGuideKategorier,
		hentGuideItems
	} from '$lib/firestore/bibliotek';
	import { hentForlob, hentForlobsdage } from '$lib/firestore/forlob';
	import Icon from '$lib/components/Icon.svelte';
	import Loading from '$lib/components/Loading.svelte';
	import AudioPlayer from '$lib/components/AudioPlayer.svelte';
	import type { UserDoc } from '$lib/types';
	import { erForlobsklient, harGennemfoertForlob } from '$lib/utils/userAdgang';
	import { collection, doc, getDoc, getDocs } from 'firebase/firestore';
	import { db } from '$lib/firebase';
	import type { Exercise } from '$lib/content/mikrotraening';
	import {
		hentExercises,
		hentForlobsProgram,
		hentForlobsProgrammer
	} from '$lib/firestore/mikrotraening';
	import { getVideoUrl } from '$lib/utils/storage';
	import { hentAlleOpskrifter } from '$lib/firestore/opskrifter';
	import { KATEGORI_LABELS, type Opskrift } from '$lib/content/opskrifter';
	import { goto } from '$app/navigation';

	/**
	 * Hent alle træningsøvelser fra alle programmer på et forløb. Itererer
	 * gennem alle programmer (fx Mikrotræning Kettlebell + Mikrotræning
	 * Stretch), samler exerciseIds fra alle dage, og henter øvelses-data.
	 */
	async function hentOevelserForForlob(forlobId: string): Promise<Exercise[]> {
		const programmer = await hentForlobsProgrammer(forlobId);
		const programDage = await Promise.all(
			programmer.map((p) => hentForlobsProgram(forlobId, p.id))
		);
		const alleIds = new Set<string>();
		for (const pd of programDage) {
			if (!pd) continue;
			for (const dag of pd.dage) {
				for (const e of dag.exercises) alleIds.add(e.exerciseId);
			}
		}
		const map = await hentExercises(Array.from(alleIds));
		return Array.from(map.values()).filter((ex) => ex.aktiv);
	}

	/**
	 * Hent alle forløb brugeren nogensinde har været på. Primær kilde er
	 * userDoc.forlobIds (sat af webhook + sync). Fallback: scan alle
	 * dokumenter i users/{uid}/products og uddrag deres forlobId-felt
	 * (dækker brugere oprettet før forlobIds-feltet blev introduceret).
	 */
	async function hentBrugerensForlobIds(uid: string): Promise<string[]> {
		const userSnap = await getDoc(doc(db, 'users', uid));
		const data = userSnap.exists() ? (userSnap.data() as UserDoc) : null;
		const fraDoc = data?.forlobIds ?? [];
		if (fraDoc.length > 0) return Array.from(new Set(fraDoc));

		const productsSnap = await getDocs(collection(db, 'users', uid, 'products'));
		const fraProducts: string[] = [];
		for (const p of productsSnap.docs) {
			const fId = (p.data() as { forlobId?: string }).forlobId;
			if (fId) fraProducts.push(fId);
		}
		return Array.from(new Set(fraProducts));
	}

	/**
	 * Henter brugerens forlobIds grupperet efter produkt-type. Bruges til
	 * at gruppere lektioner per type (Kickstart vs Premium-forløb) så
	 * hver type får sin egen fane i biblioteket.
	 */
	async function hentForlobIdsPerProduct(uid: string): Promise<Map<string, string[]>> {
		const productsSnap = await getDocs(collection(db, 'users', uid, 'products'));
		const map = new Map<string, string[]>();
		for (const p of productsSnap.docs) {
			const fId = (p.data() as { forlobId?: string }).forlobId;
			if (!fId) continue;
			const liste = map.get(p.id) ?? [];
			liste.push(fId);
			map.set(p.id, liste);
		}
		return map;
	}

	const getUser = getContext<() => User | null>('user');
	const getUserDoc = getContext<() => UserDoc | null>('userDoc');
	const user = $derived(getUser());
	const userDoc = $derived(getUserDoc?.());
	// FAQ-fanen vises kun for forløbskunder — den hører til det aktive
	// forløb. Modulbrugere (basis-app) ser kun Links + Lektioner.
	const visFaq = $derived(erForlobsklient(userDoc));

	// Tab-id'er er strenge — faste navne som 'faq'/'guides'/'oevelser'/
	// 'opskrifter' og dynamiske 'lektioner-{productType}' (fx 'lektioner-kickstart',
	// 'lektioner-premiumforløb') så hver forløbs-type får sin egen lektion-fane.
	type Tab = string;
	const visOevelser = $derived(harGennemfoertForlob(userDoc));

	// Visningsnavne for lektion-faner per produkt-type. Fallback bruger
	// productId capitalized hvis vi ikke har et eksplicit navn.
	const LEKTION_TAB_LABELS: Record<string, string> = {
		kickstart: 'Kickstart lektioner',
		premiumforløb: 'Premium lektioner'
	};
	function lektionTabLabel(productId: string): string {
		return (
			LEKTION_TAB_LABELS[productId] ??
			`${productId.charAt(0).toUpperCase()}${productId.slice(1)} lektioner`
		);
	}

	function tabFraQuery(): Tab {
		const t = page.url.searchParams.get('tab');
		if (t === 'guides') return 'guides';
		if (t === 'oevelser') return 'oevelser';
		if (t === 'opskrifter') return 'opskrifter';
		if (t && t.startsWith('lektioner-')) return t;
		// Hvis FAQ er skjult for denne bruger, default til Links i stedet
		return visFaqInitial() ? 'faq' : 'guides';
	}

	function visFaqInitial(): boolean {
		// Kan ikke bruge $derived under init — gentag tjekket inline
		return erForlobsklient(getUserDoc?.());
	}

	let aktivTab = $state<Tab>(tabFraQuery());

	function skiftTab(ny: Tab) {
		aktivTab = ny;
		const url = new URL(page.url);
		if (ny === 'faq') {
			url.searchParams.delete('tab');
		} else {
			url.searchParams.set('tab', ny);
		}
		replaceState(url, page.state);
	}

	let faqKategorier = $state<FaqKategori[]>([]);
	let faqItems = $state<FaqItem[]>([]);
	let guideKategorier = $state<GuideKategori[]>([]);
	let guideItems = $state<GuideItem[]>([]);
	// Lektioner grupperes pr forløbs-type (kickstart, premiumforløb osv.) så
	// hver type får sin egen fane. Hver entry er aggregeret over alle
	// instanser af samme type (fx hvis brugeren har gennemført Kickstart Maj
	// 2026 + Kickstart Sept 2026 → samme tab indeholder begge).
	let forlobsdageEfterProduct = $state<Record<string, ForlobDag[]>>({});
	const lektionTabIds = $derived(
		Object.keys(forlobsdageEfterProduct).filter(
			(p) => forlobsdageEfterProduct[p].length > 0
		)
	);
	let loading = $state(true);
	let fejl = $state<string | null>(null);
	let aabneFaqItems = $state<Set<string>>(new Set());

	let aabenGuide = $state<GuideItem | null>(null);
	let aabenLektion = $state<LektionItem | null>(null);

	// Træningsøvelser fra alle brugerens forløb. Aggregeres ved load.
	let oevelser = $state<Exercise[]>([]);
	let aabenOevelse = $state<Exercise | null>(null);
	let oevelseVideoUrl = $state<string | null>(null);
	let oevelseVideoLoading = $state(false);

	// Opskrifter er globale (ikke pr forløb) — vi henter alle aktive og
	// viser dem som en fast fane i biblioteket. Klik åbner detaljesiden
	// under /app/moduler/30-30-3/opskrifter/[id] som allerede findes.
	// fra=bibliotek-query skjuler "tilføj til byg-måltid"-knappen på
	// detaljesiden så bibliotek-flowet er rent læse-orienteret.
	let opskrifter = $state<Opskrift[]>([]);
	let opskriftSoegning = $state('');
	const filtreredeOpskrifter = $derived.by(() => {
		const q = opskriftSoegning.trim().toLowerCase();
		if (!q) return opskrifter;
		return opskrifter.filter(
			(o) =>
				o.titel.toLowerCase().includes(q) ||
				o.beskrivelse.toLowerCase().includes(q) ||
				o.kategorier.some((k) => KATEGORI_LABELS[k].toLowerCase().includes(q)) ||
				o.ingredienser.some((i) => i.navn.toLowerCase().includes(q))
		);
	});

	async function aabnOevelse(ex: Exercise) {
		aabenOevelse = ex;
		oevelseVideoUrl = null;
		if (typeof document !== 'undefined') {
			document.body.classList.add('html-fullscreen-aktiv');
		}
		if (!ex.videoPath) return;
		oevelseVideoLoading = true;
		try {
			oevelseVideoUrl = await getVideoUrl(ex.videoPath);
		} catch (e) {
			console.warn('Kunne ikke hente video for', ex.id, e);
		} finally {
			oevelseVideoLoading = false;
		}
	}

	function lukOevelse() {
		aabenOevelse = null;
		oevelseVideoUrl = null;
		if (typeof document !== 'undefined') {
			document.body.classList.remove('html-fullscreen-aktiv');
		}
	}

	type LektionMedDag = LektionItem & { dagNummer: number; uge: number };

	function lektionerForProduct(productId: string): LektionMedDag[] {
		const dage = forlobsdageEfterProduct[productId] ?? [];
		const ud: LektionMedDag[] = [];
		for (const dag of dage) {
			for (const l of dag.lektioner) {
				if (!l.titel?.trim()) continue;
				ud.push({ ...l, dagNummer: dag.dagNummer, uge: dag.uge });
			}
		}
		return ud.sort((a, b) => a.dagNummer - b.dagNummer);
	}

	const aktivLektionsProduct = $derived(
		aktivTab.startsWith('lektioner-') ? aktivTab.slice('lektioner-'.length) : null
	);
	const aktiveLektioner = $derived(
		aktivLektionsProduct ? lektionerForProduct(aktivLektionsProduct) : []
	);

	const sorterede = $derived(sorterKategorier(faqKategorier));
	const faqItemsPrKategori = $derived(grupperEfterKategori(kunUdgivne(faqItems)));

	const sorteredeGuideKats = $derived(sorterKategorier(guideKategorier));
	const guideItemsPrKategori = $derived(grupperEfterKategori(kunUdgivne(guideItems)));

	// Skjul Links-fanen hvis brugeren ikke har adgang til nogen guides — så
	// vi ikke viser en tom fane uden indhold.
	const visLinks = $derived(sorteredeGuideKats.some((k) => harGuidesIKategori(k.id)));

	$effect(() => {
		if (!loading && aktivTab === 'guides' && !visLinks) {
			skiftTab(visFaq ? 'faq' : 'opskrifter');
		}
	});

	function harFaqIKategori(kategoriId: string): boolean {
		const liste = faqItemsPrKategori[kategoriId];
		return !!liste && liste.length > 0;
	}

	function faqForKategori(kategoriId: string): FaqItem[] {
		return sorterItems(faqItemsPrKategori[kategoriId] ?? []);
	}

	function harGuidesIKategori(kategoriId: string): boolean {
		const liste = guideItemsPrKategori[kategoriId];
		return !!liste && liste.length > 0;
	}

	function guidesForKategori(kategoriId: string): GuideItem[] {
		return sorterGuides(guideItemsPrKategori[kategoriId] ?? []);
	}

	function toggleFaqItem(id: string) {
		const ny = new Set(aabneFaqItems);
		if (ny.has(id)) {
			ny.delete(id);
		} else {
			ny.add(id);
		}
		aabneFaqItems = ny;
	}

	function aabnGuide(it: GuideItem) {
		if (it.type === 'pdf' || it.type === 'link') {
			window.open(it.url, '_blank', 'noopener,noreferrer');
			return;
		}
		aabenGuide = it;
	}

	function lukGuide() {
		aabenGuide = null;
	}

	function aabnLektion(it: LektionMedDag) {
		if (!it.url) {
			aabenLektion = it;
			return;
		}
		const t = detekterGuideType(it.url);
		if (t === 'pdf' || t === 'link') {
			window.open(it.url, '_blank', 'noopener,noreferrer');
			return;
		}
		aabenLektion = it;
	}

	function lukLektion() {
		aabenLektion = null;
	}

	onMount(async () => {
		const u = user;
		if (!u) {
			fejl = 'Du skal være logget ind.';
			loading = false;
			return;
		}

		try {
			// Opskrifter er globale — hent dem parallelt med forløbs-data.
			// De er tilgængelige selv hvis brugeren ikke har været på et forløb.
			const opskrifterPromise = hentAlleOpskrifter().then((alle) =>
				alle.filter((o) => o.aktiv).sort((a, b) => a.titel.localeCompare(b.titel, 'da'))
			);

			// Hent alle forløb brugeren har været på — først fra userDoc.forlobIds
			// (autoritativ kilde), ellers fald tilbage til at scanne userProducts.
			// Bibliotek aggregerer materiale fra alle forløb så historik bevares
			// selv hvis brugeren skifter abonnementstype undervejs.
			const forlobIds = await hentBrugerensForlobIds(u.uid);

			if (forlobIds.length === 0) {
				// Ingen forløb endnu — vis kun opskrifter (globale)
				opskrifter = await opskrifterPromise;
				if (opskrifter.length === 0) {
					fejl = userDoc && erForlobsklient(userDoc)
						? 'Du er ikke tilknyttet et forløb endnu. Kontakt Linn.'
						: 'Du har ikke gennemført et forløb endnu — biblioteket er tomt indtil du har været på et forløb.';
				}
				loading = false;
				return;
			}

			// Load FAQ + Guides + Træningsøvelser aggregeret across ALLE forløb,
			// og lektioner grupperet per produkt-type så hver type får sin
			// egen fane.
			const idsPerProduct = await hentForlobIdsPerProduct(u.uid);

			const resultater = await Promise.all(
				forlobIds.map((forlobId) =>
					Promise.all([
						hentFaqKategorier(forlobId),
						hentFaqItems(forlobId),
						hentGuideKategorier(forlobId),
						hentGuideItems(forlobId),
						hentOevelserForForlob(forlobId)
					])
				)
			);
			faqKategorier = resultater.flatMap((r) => r[0]);
			faqItems = resultater.flatMap((r) => r[1]);
			guideKategorier = resultater.flatMap((r) => r[2]);
			guideItems = resultater.flatMap((r) => r[3]);
			// Dedupliker øvelser efter id (en øvelse kan være i flere forløb)
			const oevelseMap = new Map<string, Exercise>();
			for (const ex of resultater.flatMap((r) => r[4])) {
				oevelseMap.set(ex.id, ex);
			}
			oevelser = Array.from(oevelseMap.values()).sort((a, b) =>
				a.name.localeCompare(b.name, 'da')
			);

			// Lektioner per produkt-type — load forløbsdage særskilt fra det
			// per-product mapping og aggregér til flat liste pr type.
			//
			// VIGTIGT: Hvis brugeren er aktiv på et forløb (accessSource='forløb'
			// og det specifikke forløb stadig kører), filtreres fremtidige dage
			// væk så hun ikke kan se forude. Når forløbet er færdigt vises alle
			// dage (gennemført materiale beholdes som bibliotek).
			const erAktivPaaForlob = userDoc?.accessSource === 'forløb';

			async function dageMedFilter(forlobId: string): Promise<ForlobDag[]> {
				const dage = await hentForlobsdage(forlobId);
				if (!erAktivPaaForlob) return dage;
				const forlob = await hentForlob(forlobId);
				if (!forlob) return dage;
				const startDato = forlob.startDato.toDate().toISOString().slice(0, 10);
				const dagensDag = getCurrentDay({ startDato, antalDage: forlob.antalDage });
				if (dagensDag === null) return [];
				// Hvis forløbet er færdigt — vis alle dage.
				if (dagensDag >= forlob.antalDage) return dage;
				return dage.filter((d) => d.dagNummer <= dagensDag);
			}

			const lektionerPerProductEntries = await Promise.all(
				Array.from(idsPerProduct.entries()).map(async ([productId, ids]) => {
					const dageArrays = await Promise.all(ids.map(dageMedFilter));
					return [productId, dageArrays.flat()] as const;
				})
			);
			const nyForlobsdage: Record<string, ForlobDag[]> = {};
			for (const [pid, dage] of lektionerPerProductEntries) {
				if (dage.length > 0) nyForlobsdage[pid] = dage;
			}
			// Fallback: hvis ingen userProducts har forlobId (legacy/test-bruger),
			// vis lektioner under 'kickstart'-tab så vi ikke mister adgang.
			if (Object.keys(nyForlobsdage).length === 0 && forlobIds.length > 0) {
				const fallbackDage = await Promise.all(forlobIds.map(dageMedFilter));
				nyForlobsdage.kickstart = fallbackDage.flat();
			}
			forlobsdageEfterProduct = nyForlobsdage;

			opskrifter = await opskrifterPromise;
		} catch (e) {
			console.error(e);
			fejl = 'Kunne ikke hente bibliotek. Prøv igen.';
		} finally {
			loading = false;
		}
	});

	function typeKlassenavn(type: GuideType): string {
		return `thumb-${type}`;
	}

	function typeLabel(type: GuideType): string {
		return GUIDE_TYPE_LABELS[type];
	}

	const aabenEmbed = $derived(aabenGuide?.type === 'video' ? videoEmbedUrl(aabenGuide.url) : null);

	const lektionType = $derived(aabenLektion?.url ? detekterGuideType(aabenLektion.url) : null);
	const lektionEmbed = $derived(
		aabenLektion?.url && lektionType === 'video' ? videoEmbedUrl(aabenLektion.url) : null
	);

	let htmlIframeGuide = $state<HTMLIFrameElement | null>(null);
	let htmlIframeLektion = $state<HTMLIFrameElement | null>(null);

	function gemHtmlSomPdf(url: string | undefined) {
		// Åbn HTML-filen i ny fane så brugeren kan bruge browserens native
		// Del/Print → 'Gem som PDF'. Iframens contentWindow.print() blokeres
		// fordi Firebase Storage er cross-origin ift. appen.
		if (url) {
			window.open(url, '_blank', 'noopener,noreferrer');
		}
	}

	// Skjul global Header og TabBar når et HTML-overlay er åbent.
	const htmlOverlayAaben = $derived(
		(aabenGuide && aabenGuide.type === 'html') || (aabenLektion && lektionType === 'html')
	);

	$effect(() => {
		if (typeof document === 'undefined') return;
		if (htmlOverlayAaben) {
			document.body.classList.add('html-fullscreen-aktiv');
		} else {
			document.body.classList.remove('html-fullscreen-aktiv');
		}
	});

	onDestroy(() => {
		if (typeof document !== 'undefined') {
			document.body.classList.remove('html-fullscreen-aktiv');
		}
	});
</script>

<div class="page">
	<header class="page-header">
		<a class="back" href="/app/moduler">
			<Icon name="arrow-l" size={14} color="var(--text2)" />
			<span>Moduler</span>
		</a>
		<div class="eyebrow">Bibliotek</div>
		<h1>Bibliotek</h1>
	</header>

	<div class="tabs">
		{#if visFaq}
			<button
				class="tab-knap"
				class:aktiv={aktivTab === 'faq'}
				type="button"
				onclick={() => skiftTab('faq')}
			>
				FAQ
			</button>
		{/if}
		{#if visLinks}
			<button
				class="tab-knap"
				class:aktiv={aktivTab === 'guides'}
				type="button"
				onclick={() => skiftTab('guides')}
			>
				Links
			</button>
		{/if}
		{#each lektionTabIds as productId (productId)}
			<button
				class="tab-knap"
				class:aktiv={aktivTab === `lektioner-${productId}`}
				type="button"
				onclick={() => skiftTab(`lektioner-${productId}`)}
			>
				{lektionTabLabel(productId)}
			</button>
		{/each}
		{#if visOevelser}
			<button
				class="tab-knap"
				class:aktiv={aktivTab === 'oevelser'}
				type="button"
				onclick={() => skiftTab('oevelser')}
			>
				Træningsøvelser
			</button>
		{/if}
		<button
			class="tab-knap"
			class:aktiv={aktivTab === 'opskrifter'}
			type="button"
			onclick={() => skiftTab('opskrifter')}
		>
			Opskrifter
		</button>
	</div>

	{#if aktivTab === 'faq'}
		{#if loading}
			<Loading tekst="Henter FAQ..." kompakt />
		{:else if fejl}
			<div class="status-besked fejl">{fejl}</div>
		{:else if sorterede.length === 0}
			<div class="status-besked">
				Der er ikke lagt FAQ ind for dit forløb endnu.
			</div>
		{:else}
			{@const synligeKategorier = sorterede.filter((k) => harFaqIKategori(k.id))}
			{#if synligeKategorier.length === 0}
				<div class="status-besked">
					Der er ingen udgivne spørgsmål endnu.
				</div>
			{:else}
				<div class="kat-liste">
					{#each synligeKategorier as kat (kat.id)}
						<section class="kat-section">
							<h2 class="kat-title">{kat.navn}</h2>
							<div class="faq-liste">
								{#each faqForKategori(kat.id) as it (it.id)}
									<article class="faq-item" class:open={aabneFaqItems.has(it.id)}>
										<button
											class="faq-q"
											type="button"
											onclick={() => toggleFaqItem(it.id)}
											aria-expanded={aabneFaqItems.has(it.id)}
										>
											<span class="faq-q-text">{it.spoergsmaal}</span>
											<span class="faq-chev">
												<Icon name="chevron-d" size={16} color="var(--terra)" />
											</span>
										</button>
										{#if aabneFaqItems.has(it.id)}
											<div class="faq-a">
												<div class="faq-a-inner">{it.svar}</div>
											</div>
										{/if}
									</article>
								{/each}
							</div>
						</section>
					{/each}
				</div>
			{/if}
		{/if}
	{:else if aktivTab === 'guides'}
		{#if loading}
			<Loading tekst="Henter links..." kompakt />
		{:else if fejl}
			<div class="status-besked fejl">{fejl}</div>
		{:else if sorteredeGuideKats.length === 0}
			<div class="status-besked">
				Der er ikke lagt links op for dit forløb endnu.
			</div>
		{:else}
			{@const synligeKategorier = sorteredeGuideKats.filter((k) => harGuidesIKategori(k.id))}
			{#if synligeKategorier.length === 0}
				<div class="status-besked">
					Der er ingen udgivne links endnu.
				</div>
			{:else}
				<div class="kat-liste">
					{#each synligeKategorier as kat (kat.id)}
						<section class="kat-section">
							<h2 class="kat-title">{kat.navn}</h2>
							<div class="guide-liste">
								{#each guidesForKategori(kat.id) as it (it.id)}
									<button class="guide-card" type="button" onclick={() => aabnGuide(it)}>
										<div class="guide-thumb {typeKlassenavn(it.type)}">
											<span class="guide-type-pill">{typeLabel(it.type)}</span>
											<div class="guide-thumb-icon">
												{#if it.type === 'video'}
													<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,.95)" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
														<circle cx="12" cy="12" r="10" />
														<path d="M10 8l6 4-6 4V8z" fill="rgba(255,255,255,.95)" stroke="none" />
													</svg>
												{:else if it.type === 'pdf'}
													<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,.95)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
														<path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6z" />
														<path d="M14 2v6h6" />
														<path d="M9 13h6M9 17h4" />
													</svg>
												{:else if it.type === 'audio'}
													<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,.95)" stroke-width="1.8" stroke-linecap="round">
														<path d="M3 10v4M7 7v10M11 4v16M15 8v8M19 11v2" />
													</svg>
												{:else if it.type === 'html'}
													<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,.95)" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
														<path d="M4 5h16v14H4z" />
														<path d="M4 9h16" />
														<path d="M8 13l-2 2 2 2M16 13l2 2-2 2" />
													</svg>
												{:else}
													<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,.95)" stroke-width="1.5">
														<circle cx="12" cy="12" r="9" />
														<path d="M12 3c-2 2-3 5-3 9s1 7 3 9M12 3c2 2 3 5 3 9s-1 7-3 9M3 12h18" />
													</svg>
												{/if}
											</div>
										</div>
										<div class="guide-body">
											<div class="guide-titel">{it.titel}</div>
											{#if it.beskrivelse}
												<div class="guide-beskrivelse">{it.beskrivelse}</div>
											{/if}
											{#if it.dato}
												<div class="guide-dato">{formatDanskDato(it.dato)}</div>
											{/if}
										</div>
									</button>
								{/each}
							</div>
						</section>
					{/each}
				</div>
			{/if}
		{/if}
	{:else if aktivLektionsProduct}
		{#if loading}
			<Loading tekst="Henter lektioner..." kompakt />
		{:else if fejl}
			<div class="status-besked fejl">{fejl}</div>
		{:else if aktiveLektioner.length === 0}
			<div class="status-besked">
				Der er ikke lagt lektioner op for dette forløb endnu.
			</div>
		{:else}
			<div class="lektion-liste-bib">
				{#each aktiveLektioner as l (l.dagNummer + '-' + l.id)}
					{@const t = l.url ? detekterGuideType(l.url) : null}
					<button class="lektion-card-bib" type="button" onclick={() => aabnLektion(l)}>
						<div class="lektion-dag-badge">
							<span class="lektion-dag-tal">{l.dagNummer}</span>
							<span class="lektion-dag-label">{l.dagNummer === 0 ? 'Baseline' : 'Dag'}</span>
						</div>
						<div class="lektion-body-bib">
							<div class="lektion-uge-bib">Uge {l.uge}</div>
							<div class="lektion-titel-bib">{l.titel}</div>
							{#if l.beskrivelse}
								<div class="lektion-beskrivelse-bib">{l.beskrivelse}</div>
							{/if}
							<div class="lektion-meta-bib">
								{#if t}
									<span
										class="lektion-type-pill"
										class:type-video={t === 'video'}
										class:type-audio={t === 'audio'}
										class:type-pdf={t === 'pdf'}
										class:type-link={t === 'link'}
										class:type-html={t === 'html'}
									>
										{GUIDE_TYPE_LABELS[t]}
									</span>
								{/if}
								{#if l.varighedMin > 0}
									<span class="lektion-duration-bib">{l.varighedMin} min</span>
								{/if}
							</div>
						</div>
						<Icon name="chevron-r" size={14} color="var(--text3)" />
					</button>
				{/each}
			</div>
		{/if}
	{:else if aktivTab === 'oevelser'}
		{#if loading}
			<Loading tekst="Henter træningsøvelser..." kompakt />
		{:else if oevelser.length === 0}
			<div class="status-besked">
				Der er ingen træningsøvelser fra dine forløb endnu.
			</div>
		{:else}
			<div class="oevelser-liste">
				{#each oevelser as ex (ex.id)}
					<button class="oevelse-rad" type="button" onclick={() => aabnOevelse(ex)}>
						<div class="oevelse-info">
							<div class="oevelse-navn">{ex.name}</div>
							<div class="oevelse-meta">{ex.catLabel}</div>
						</div>
						<div class="oevelse-play" aria-label="Afspil">
							<Icon name="play" size={14} color="#fff" filled />
						</div>
					</button>
				{/each}
			</div>
		{/if}
	{:else if aktivTab === 'opskrifter'}
		{#if loading}
			<Loading tekst="Henter opskrifter..." kompakt />
		{:else if opskrifter.length === 0}
			<div class="status-besked">
				Der er ingen opskrifter endnu.
			</div>
		{:else}
			<div class="opskrift-soegning-wrap">
				<Icon name="search" size={14} color="var(--text3)" />
				<input
					class="opskrift-soegning"
					type="search"
					placeholder="Søg efter opskrift..."
					bind:value={opskriftSoegning}
				/>
			</div>
			{#if filtreredeOpskrifter.length === 0}
				<div class="status-besked">
					Ingen opskrifter matcher søgningen.
				</div>
			{:else}
				<div class="opskrifter-liste">
					{#each filtreredeOpskrifter as o (o.id)}
						<button
							class="opskrift-rad"
							type="button"
							onclick={() => goto(`/app/moduler/30-30-3/opskrifter/${o.id}?fra=bibliotek`)}
						>
							{#if o.billedeUrl}
								<img class="opskrift-billede" src={o.billedeUrl} alt="" loading="lazy" />
							{:else}
								<div class="opskrift-billede opskrift-billede-fallback">
									<Icon name="leaf" size={20} color="var(--text3)" />
								</div>
							{/if}
							<div class="opskrift-info">
								<div class="opskrift-titel">{o.titel}</div>
								{#if o.kategorier.length > 0}
									<div class="opskrift-kategorier">
										{o.kategorier.map((k) => KATEGORI_LABELS[k]).join(' · ')}
									</div>
								{/if}
							</div>
							<Icon name="chevron-r" size={14} color="var(--text3)" />
						</button>
					{/each}
				</div>
			{/if}
		{/if}
	{/if}
</div>

{#if aabenOevelse}
	<div
		class="oevelse-overlay"
		role="dialog"
		aria-modal="true"
		aria-label={aabenOevelse.name}
	>
		<button class="oevelse-luk" type="button" onclick={lukOevelse} aria-label="Luk">
			×
		</button>
		<div class="oevelse-indhold">
			<h2 class="oevelse-titel">{aabenOevelse.name}</h2>
			<p class="oevelse-cat">{aabenOevelse.catLabel}</p>
			<div class="oevelse-video-wrap">
				{#if oevelseVideoLoading}
					<Loading tekst="Henter video..." kompakt />
				{:else if oevelseVideoUrl}
					<!-- svelte-ignore a11y_media_has_caption -->
					<video
						class="oevelse-video"
						src={oevelseVideoUrl}
						controls
						autoplay
						playsinline
					></video>
				{:else}
					<div class="status-besked">Ingen video tilgængelig.</div>
				{/if}
			</div>
			{#if aabenOevelse.desc}
				<p class="oevelse-desc">{aabenOevelse.desc}</p>
			{/if}
			{#if aabenOevelse.how && aabenOevelse.how.length > 0}
				<div class="oevelse-how">
					<div class="oevelse-how-titel">Sådan gør du</div>
					<ol>
						{#each aabenOevelse.how as step}
							<li>{step}</li>
						{/each}
					</ol>
				</div>
			{/if}
		</div>
	</div>
{/if}

{#if aabenGuide && aabenGuide.type === 'html'}
	<div class="html-overlay" role="dialog" aria-modal="true">
		<header class="html-overlay-head">
			<button class="html-overlay-luk" type="button" onclick={lukGuide}>
				<Icon name="arrow-l" size={14} color="var(--text)" />
				<span>Luk</span>
			</button>
			<div class="html-overlay-titel">{aabenGuide.titel}</div>
		</header>
		<iframe
			bind:this={htmlIframeGuide}
			src={aabenGuide.url}
			title={aabenGuide.titel}
			sandbox="allow-same-origin allow-scripts allow-popups allow-modals"
		></iframe>
		<div class="html-overlay-foot">
			<button class="html-overlay-pdf" type="button" onclick={() => gemHtmlSomPdf(aabenGuide?.url)}>
				📄 Gem som PDF
			</button>
		</div>
	</div>
{:else if aabenGuide && aabenGuide.type === 'audio'}
	<AudioPlayer
		url={aabenGuide.url}
		titel={aabenGuide.titel}
		sub={aabenGuide.beskrivelse}
		kategori="Lydguide"
		onClose={lukGuide}
	/>
{:else if aabenGuide}
	<div
		class="overlay-bg"
		role="button"
		tabindex="0"
		onclick={lukGuide}
		onkeydown={(e) => e.key === 'Escape' && lukGuide()}
	></div>
	<div class="overlay" role="dialog" aria-modal="true">
		<header class="overlay-head">
			<div class="overlay-titel">{aabenGuide.titel}</div>
			<button class="overlay-luk" type="button" onclick={lukGuide} aria-label="Luk">×</button>
		</header>

		{#if aabenGuide.type === 'video'}
			{#if aabenEmbed}
				<div class="overlay-video">
					<iframe
						src={aabenEmbed}
						title={aabenGuide.titel}
						allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture"
						allowfullscreen
					></iframe>
				</div>
			{:else}
				<div class="overlay-fallback">
					<p>Videoen kan ikke afspilles indlejret.</p>
					<a class="overlay-link" href={aabenGuide.url} target="_blank" rel="noopener noreferrer">
						Åbn i ny fane
					</a>
				</div>
			{/if}
		{/if}

		{#if aabenGuide.beskrivelse}
			<p class="overlay-beskrivelse">{aabenGuide.beskrivelse}</p>
		{/if}

		{#if aabenGuide.dato}
			<div class="overlay-dato">{formatDanskDato(aabenGuide.dato)}</div>
		{/if}
	</div>
{/if}

{#if aabenLektion && lektionType === 'html'}
	<div class="html-overlay" role="dialog" aria-modal="true">
		<header class="html-overlay-head">
			<button class="html-overlay-luk" type="button" onclick={lukLektion}>
				<Icon name="arrow-l" size={14} color="var(--text)" />
				<span>Luk</span>
			</button>
			<div class="html-overlay-titel">{aabenLektion.titel}</div>
		</header>
		<iframe
			bind:this={htmlIframeLektion}
			src={aabenLektion.url}
			title={aabenLektion.titel}
			sandbox="allow-same-origin allow-scripts allow-popups allow-modals"
		></iframe>
		<div class="html-overlay-foot">
			<button class="html-overlay-pdf" type="button" onclick={() => gemHtmlSomPdf(aabenLektion?.url)}>
				📄 Gem som PDF
			</button>
		</div>
	</div>
{:else if aabenLektion && lektionType === 'audio'}
	<AudioPlayer
		url={aabenLektion.url}
		titel={aabenLektion.titel}
		sub={aabenLektion.beskrivelse}
		kategori="Lektion"
		onClose={lukLektion}
	/>
{:else if aabenLektion}
	<div
		class="overlay-bg"
		role="button"
		tabindex="0"
		onclick={lukLektion}
		onkeydown={(e) => e.key === 'Escape' && lukLektion()}
	></div>
	<div class="overlay" role="dialog" aria-modal="true">
		<header class="overlay-head">
			<div class="overlay-titel">{aabenLektion.titel}</div>
			<button class="overlay-luk" type="button" onclick={lukLektion} aria-label="Luk">×</button>
		</header>

		{#if lektionEmbed}
			<div class="overlay-video">
				<iframe
					src={lektionEmbed}
					title={aabenLektion.titel}
					allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture"
					allowfullscreen
				></iframe>
			</div>
		{/if}

		{#if aabenLektion.beskrivelse}
			<p class="overlay-beskrivelse">{aabenLektion.beskrivelse}</p>
		{/if}

		{#if aabenLektion.varighedMin > 0 || aabenLektion.format}
			<div class="overlay-dato">
				{aabenLektion.varighedMin > 0 ? aabenLektion.varighedMin + ' min' : ''}{aabenLektion.varighedMin > 0 && aabenLektion.format ? ' · ' : ''}{aabenLektion.format}
			</div>
		{/if}
	</div>
{/if}

<style>
	.page {
		padding: 18px 18px 100px;
		max-width: 520px;
		margin: 0 auto;
	}

	.page-header {
		margin-bottom: 14px;
	}

	.back {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		font-size: calc(12px * var(--fs-scale, 1));
		color: var(--text2);
		text-decoration: none;
		margin-bottom: 12px;
	}

	.eyebrow {
		font-size: calc(10px * var(--fs-scale, 1));
		font-weight: 600;
		letter-spacing: 0.18em;
		text-transform: uppercase;
		color: var(--text3);
	}

	h1 {
		font-family: var(--ff-d);
		font-size: calc(30px * var(--fs-scale, 1));
		font-weight: 600;
		letter-spacing: -0.02em;
		margin: 4px 0 0;
		line-height: 1.05;
		color: var(--text);
	}

	.page-sub {
		font-size: calc(13px * var(--fs-scale, 1));
		color: var(--text2);
		margin: 6px 0 0;
		line-height: 1.4;
	}

	.tabs {
		display: grid;
		grid-template-columns: 1fr 1fr 1fr;
		background: var(--bg2);
		padding: 4px;
		border-radius: 12px;
		margin-bottom: 14px;
		gap: 4px;
	}

	.tab-knap {
		padding: 10px 6px;
		font-size: calc(12.5px * var(--fs-scale, 1));
		font-weight: 600;
		border-radius: 8px;
		border: none;
		background: transparent;
		color: var(--text2);
		cursor: pointer;
		font-family: var(--ff-b);
	}

	.tab-knap.aktiv {
		background: var(--white);
		color: var(--terra);
		box-shadow: 0 1px 3px rgba(0, 0, 0, 0.06);
	}

	.status-besked {
		padding: 14px 16px;
		background: var(--white);
		border: 1px solid var(--border);
		border-radius: 12px;
		color: var(--text2);
		font-size: calc(13px * var(--fs-scale, 1));
		text-align: center;
	}

	.status-besked.fejl {
		color: #8a4a3e;
		background: #fbeeea;
		border-color: #f0d6cf;
	}

	.kat-liste {
		display: flex;
		flex-direction: column;
		gap: 18px;
	}

	.kat-section {
		display: flex;
		flex-direction: column;
		gap: 8px;
	}

	.kat-title {
		font-family: var(--ff-d);
		font-size: calc(16px * var(--fs-scale, 1));
		font-weight: 500;
		font-style: italic;
		color: var(--text);
		margin: 4px 2px;
	}

	.faq-liste {
		display: flex;
		flex-direction: column;
		gap: 8px;
	}

	.faq-item {
		background: var(--white);
		border: 1px solid var(--border);
		border-radius: 12px;
		overflow: hidden;
		transition: border-color 0.18s;
	}

	.faq-item.open {
		border-color: var(--terra);
	}

	.faq-q {
		display: flex;
		align-items: center;
		gap: 10px;
		padding: 13px 14px;
		width: 100%;
		text-align: left;
		background: transparent;
		border: none;
		cursor: pointer;
		font-family: inherit;
	}

	.faq-q-text {
		flex: 1;
		font-size: calc(14px * var(--fs-scale, 1));
		font-weight: 500;
		color: var(--text);
		line-height: 1.4;
	}

	.faq-chev {
		flex-shrink: 0;
		display: flex;
		align-items: center;
		transition: transform 0.25s;
	}

	.faq-item.open .faq-chev {
		transform: rotate(180deg);
	}

	.faq-a-inner {
		padding: 0 14px 14px;
		font-size: calc(13px * var(--fs-scale, 1));
		line-height: 1.65;
		color: var(--text2);
		white-space: pre-wrap;
	}

	.guide-liste {
		display: flex;
		flex-direction: column;
		gap: 10px;
	}

	.guide-card {
		display: flex;
		flex-direction: column;
		background: var(--white);
		border: 1px solid var(--border);
		border-radius: 14px;
		overflow: hidden;
		cursor: pointer;
		text-align: left;
		font-family: inherit;
		padding: 0;
		transition: border-color 0.18s, transform 0.1s;
	}

	.guide-card:active {
		transform: scale(0.995);
		border-color: var(--terra);
	}

	.guide-card:hover {
		border-color: var(--terra);
	}

	.guide-thumb {
		position: relative;
		width: 100%;
		aspect-ratio: 16 / 9;
		display: flex;
		align-items: center;
		justify-content: center;
		overflow: hidden;
	}

	.guide-thumb-icon {
		position: relative;
		z-index: 1;
		filter: drop-shadow(0 1px 3px rgba(0, 0, 0, 0.18));
	}

	.guide-type-pill {
		position: absolute;
		top: 8px;
		left: 8px;
		z-index: 2;
		background: rgba(42, 15, 30, 0.72);
		color: #fff;
		font-size: calc(10px * var(--fs-scale, 1));
		font-weight: 500;
		letter-spacing: 0.06em;
		padding: 4px 9px;
		border-radius: 999px;
		backdrop-filter: blur(6px);
	}

	.thumb-video {
		background: linear-gradient(135deg, #B87B6E 0%, #9D6358 100%);
	}

	.thumb-pdf {
		background: linear-gradient(135deg, #F5E4DC 0%, #E8C9BC 55%, #D9A895 100%);
	}

	.thumb-pdf .guide-thumb-icon svg {
		stroke: rgba(60, 30, 22, 0.85);
	}

	.thumb-pdf .guide-type-pill {
		color: #2a0f1e;
		background: rgba(255, 255, 255, 0.7);
	}

	.thumb-link {
		background: linear-gradient(135deg, #C8DDD1 0%, #A9CBBA 100%);
	}

	.thumb-link .guide-thumb-icon svg {
		stroke: rgba(31, 58, 42, 0.85);
	}

	.thumb-link .guide-type-pill {
		color: #1f3a2a;
		background: rgba(255, 255, 255, 0.7);
	}

	.thumb-audio {
		background: linear-gradient(135deg, #B87B6E 0%, #CC9080 100%);
	}

	.thumb-html {
		background: linear-gradient(135deg, #B89BCB 0%, #8E6FA8 100%);
	}

	.guide-body {
		padding: 12px 14px 14px;
		display: flex;
		flex-direction: column;
		gap: 4px;
	}

	.guide-titel {
		font-size: calc(14px * var(--fs-scale, 1));
		font-weight: 600;
		color: var(--text);
		line-height: 1.35;
	}

	.guide-beskrivelse {
		font-size: calc(12.5px * var(--fs-scale, 1));
		color: var(--text2);
		line-height: 1.5;
	}

	.guide-dato {
		font-size: calc(10.5px * var(--fs-scale, 1));
		color: var(--text3);
		letter-spacing: 0.04em;
		margin-top: 2px;
	}

	.overlay-bg {
		position: fixed;
		inset: 0;
		background: rgba(20, 14, 18, 0.7);
		z-index: 60;
		border: none;
	}

	.overlay {
		position: fixed;
		left: 50%;
		top: 50%;
		transform: translate(-50%, -50%);
		background: var(--white);
		border-radius: 16px;
		width: calc(100% - 24px);
		max-width: 720px;
		max-height: 92vh;
		overflow-y: auto;
		display: flex;
		flex-direction: column;
		gap: 12px;
		padding: 16px;
		z-index: 61;
		box-shadow: 0 20px 50px rgba(0, 0, 0, 0.3);
	}

	.overlay-head {
		display: flex;
		align-items: center;
		gap: 10px;
	}

	.overlay-titel {
		flex: 1;
		font-family: var(--ff-d);
		font-size: calc(18px * var(--fs-scale, 1));
		font-weight: 600;
		color: var(--text);
		line-height: 1.3;
	}

	.overlay-luk {
		width: 32px;
		height: 32px;
		border-radius: 999px;
		border: 1px solid var(--border);
		background: var(--white);
		color: var(--text2);
		font-size: calc(18px * var(--fs-scale, 1));
		cursor: pointer;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.overlay-video {
		position: relative;
		width: 100%;
		aspect-ratio: 16 / 9;
		background: #000;
		border-radius: 10px;
		overflow: hidden;
	}

	.overlay-video iframe {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		border: none;
	}

	.html-overlay {
		position: fixed;
		inset: 0;
		z-index: 100;
		background: var(--white);
		display: flex;
		flex-direction: column;
		padding-top: env(safe-area-inset-top);
		padding-bottom: env(safe-area-inset-bottom);
	}

	.html-overlay-head {
		display: flex;
		align-items: center;
		gap: 10px;
		padding: 10px 14px;
		border-bottom: 1px solid var(--border);
		flex-shrink: 0;
		background: var(--white);
	}

	.html-overlay-luk {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		padding: 8px 12px;
		border-radius: 8px;
		border: 1px solid var(--border);
		background: var(--white);
		color: var(--text);
		font-size: calc(13px * var(--fs-scale, 1));
		font-weight: 500;
		cursor: pointer;
		font-family: var(--ff-b);
		flex-shrink: 0;
	}

	.html-overlay-titel {
		flex: 1;
		font-family: var(--ff-d);
		font-size: calc(14px * var(--fs-scale, 1));
		font-weight: 600;
		color: var(--text);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.html-overlay iframe {
		flex: 1;
		width: 100%;
		border: none;
		background: var(--white);
	}

	.html-overlay-foot {
		flex-shrink: 0;
		padding: 12px 14px;
		border-top: 1px solid var(--border);
		background: var(--white);
	}

	.html-overlay-pdf {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 8px;
		width: 100%;
		padding: 14px;
		border-radius: 12px;
		border: none;
		background: var(--terra);
		color: #fff;
		font-size: calc(15px * var(--fs-scale, 1));
		font-weight: 600;
		cursor: pointer;
		font-family: var(--ff-b);
	}

	.html-overlay-pdf:active {
		opacity: 0.85;
	}

	.overlay-beskrivelse {
		font-size: calc(13px * var(--fs-scale, 1));
		line-height: 1.6;
		color: var(--text2);
		margin: 0;
		white-space: pre-wrap;
	}

	.overlay-dato {
		font-size: calc(11px * var(--fs-scale, 1));
		color: var(--text3);
		letter-spacing: 0.04em;
	}

	.overlay-fallback {
		padding: 20px;
		text-align: center;
		color: var(--text2);
		font-size: calc(13px * var(--fs-scale, 1));
	}

	.overlay-link {
		display: inline-block;
		margin-top: 10px;
		padding: 8px 16px;
		background: var(--terra);
		color: #fff;
		text-decoration: none;
		border-radius: 8px;
		font-size: calc(13px * var(--fs-scale, 1));
		font-weight: 600;
	}

	.lektion-liste-bib {
		display: flex;
		flex-direction: column;
		gap: 10px;
	}

	.lektion-card-bib {
		display: flex;
		align-items: center;
		gap: 12px;
		padding: 12px 14px;
		background: var(--white);
		border: 1px solid var(--border);
		border-radius: 14px;
		text-align: left;
		font-family: inherit;
		color: inherit;
		cursor: pointer;
		width: 100%;
	}

	.lektion-card-bib:hover {
		border-color: var(--terra);
	}

	.lektion-dag-badge {
		width: 44px;
		height: 44px;
		border-radius: 10px;
		background: var(--bg2);
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		flex-shrink: 0;
	}

	.lektion-dag-tal {
		font-family: var(--ff-d);
		font-weight: 700;
		font-size: calc(16px * var(--fs-scale, 1));
		line-height: 1;
		color: var(--text);
	}

	.lektion-dag-label {
		font-size: calc(8px * var(--fs-scale, 1));
		letter-spacing: 0.1em;
		text-transform: uppercase;
		color: var(--text3);
		margin-top: 2px;
	}

	.lektion-body-bib {
		flex: 1;
		min-width: 0;
		display: flex;
		flex-direction: column;
		gap: 2px;
	}

	.lektion-uge-bib {
		font-size: calc(10px * var(--fs-scale, 1));
		color: var(--text3);
		letter-spacing: 0.06em;
		text-transform: uppercase;
	}

	.lektion-titel-bib {
		font-family: var(--ff-d);
		font-size: calc(15px * var(--fs-scale, 1));
		font-weight: 600;
		color: var(--text);
		line-height: 1.3;
	}

	.lektion-beskrivelse-bib {
		font-size: calc(12.5px * var(--fs-scale, 1));
		color: var(--text2);
		line-height: 1.45;
		margin-top: 2px;
		overflow: hidden;
		display: -webkit-box;
		-webkit-line-clamp: 2;
		line-clamp: 2;
		-webkit-box-orient: vertical;
	}

	.lektion-meta-bib {
		display: flex;
		align-items: center;
		gap: 8px;
		margin-top: 4px;
	}

	.lektion-type-pill {
		display: inline-block;
		padding: 3px 9px;
		border-radius: 999px;
		font-size: calc(10px * var(--fs-scale, 1));
		font-weight: 600;
		letter-spacing: 0.04em;
	}

	.lektion-type-pill.type-video {
		background: var(--tdim);
		color: var(--terra);
	}

	.lektion-type-pill.type-audio {
		background: #f5e4dc;
		color: #8a4a3e;
	}

	.lektion-type-pill.type-pdf {
		background: #f0e6da;
		color: #6b4f30;
	}

	.lektion-type-pill.type-link {
		background: #d9e8df;
		color: #2f5640;
	}

	.lektion-type-pill.type-html {
		background: #e6dcef;
		color: #4a3568;
	}

	.lektion-duration-bib {
		font-size: calc(11px * var(--fs-scale, 1));
		color: var(--text3);
	}

	.oevelser-liste {
		display: flex;
		flex-direction: column;
		gap: 8px;
	}

	.oevelse-rad {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
		padding: 14px 16px;
		background: var(--white);
		border: 1px solid var(--border);
		border-radius: 12px;
		font-family: inherit;
		text-align: left;
		cursor: pointer;
	}

	.oevelse-info {
		flex: 1;
		min-width: 0;
	}

	.oevelse-navn {
		font-size: calc(14px * var(--fs-scale, 1));
		font-weight: 600;
		color: var(--text);
		margin-bottom: 2px;
	}

	.oevelse-meta {
		font-size: calc(11px * var(--fs-scale, 1));
		color: var(--text3);
	}

	.oevelse-play {
		width: 36px;
		height: 36px;
		border-radius: 50%;
		background: var(--terra);
		display: flex;
		align-items: center;
		justify-content: center;
		flex-shrink: 0;
	}

	.oevelse-overlay {
		position: fixed;
		inset: 0;
		background: var(--bg);
		z-index: 1000;
		overflow-y: auto;
		padding: 56px 16px 32px;
	}

	.oevelse-luk {
		position: fixed;
		top: 12px;
		right: 12px;
		width: 36px;
		height: 36px;
		border-radius: 50%;
		background: var(--white);
		border: 1px solid var(--border);
		display: flex;
		align-items: center;
		justify-content: center;
		cursor: pointer;
		z-index: 1001;
	}

	.oevelse-indhold {
		max-width: 600px;
		margin: 0 auto;
	}

	.oevelse-titel {
		font-size: calc(20px * var(--fs-scale, 1));
		margin: 0 0 4px;
	}

	.oevelse-cat {
		font-size: calc(12px * var(--fs-scale, 1));
		color: var(--text3);
		margin: 0 0 16px;
	}

	.oevelse-video-wrap {
		background: var(--bg2);
		border-radius: 12px;
		overflow: hidden;
		aspect-ratio: 16 / 9;
		display: flex;
		align-items: center;
		justify-content: center;
		margin-bottom: 16px;
	}

	.oevelse-video {
		width: 100%;
		height: 100%;
		object-fit: contain;
		background: #000;
	}

	.oevelse-desc {
		font-size: calc(14px * var(--fs-scale, 1));
		color: var(--text2);
		line-height: 1.5;
		margin: 0 0 16px;
	}

	.oevelse-how {
		background: var(--bg2);
		border-radius: 12px;
		padding: 16px;
	}

	.oevelse-how-titel {
		font-weight: 600;
		font-size: calc(14px * var(--fs-scale, 1));
		margin-bottom: 8px;
	}

	.oevelse-how ol {
		margin: 0;
		padding-left: 20px;
		color: var(--text2);
		font-size: calc(13px * var(--fs-scale, 1));
		line-height: 1.5;
	}

	.opskrift-soegning-wrap {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 0 12px;
		background: var(--white);
		border: 1px solid var(--border);
		border-radius: 12px;
		margin-bottom: 12px;
	}

	.opskrift-soegning {
		flex: 1;
		border: none;
		background: transparent;
		padding: 12px 0;
		font-size: 16px;
		font-family: inherit;
		color: var(--text);
		outline: none;
	}

	.opskrift-soegning::placeholder {
		color: var(--text3);
	}

	.opskrifter-liste {
		display: flex;
		flex-direction: column;
		gap: 8px;
	}

	.opskrift-rad {
		display: flex;
		align-items: center;
		gap: 12px;
		padding: 10px;
		background: var(--white);
		border: 1px solid var(--border);
		border-radius: 12px;
		font-family: inherit;
		text-align: left;
		cursor: pointer;
	}

	.opskrift-billede {
		width: 56px;
		height: 56px;
		border-radius: 8px;
		object-fit: cover;
		background: var(--bg2);
		flex-shrink: 0;
	}

	.opskrift-billede-fallback {
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.opskrift-info {
		flex: 1;
		min-width: 0;
	}

	.opskrift-titel {
		font-size: calc(14px * var(--fs-scale, 1));
		font-weight: 600;
		color: var(--text);
		margin-bottom: 2px;
	}

	.opskrift-kategorier {
		font-size: calc(11px * var(--fs-scale, 1));
		color: var(--text3);
	}
</style>
