<script lang="ts">
	// ============================================================
	// Lektionsvisning i 3.0.
	//
	// Fire slags indhold: video, lyd, indlejret side og link. Alle fire
	// aabnes her, saa hun aldrig sendes ud af den nye flade.
	//
	// Lektionen markeres taget af sig selv, naar hun har haft den aabne i
	// 80 procent af den tid der staar paa den. Vi kan ikke se ind i Vimeos
	// afspiller uden at hente deres kode ind, saa det er et skoen. Derfor
	// er der ogsaa altid en knap.
	// ============================================================

	import { getContext, onMount } from 'svelte';
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import type { User } from 'firebase/auth';
	import type { Adgangsbillede } from '$lib/content/adgang3';
	import type { LektionItem } from '$lib/content/forlob';
	import { artFor, indlejretUrl, sekunderFoerKlaret, formaterVarighed } from '$lib/content/lektion3';
	import { hentDagensLektioner, hentKlaret, saetKlaret } from '$lib/firestore/forside3';
	import Lydafspiller from '$lib/components/ny/Lydafspiller.svelte';
	import Ventetegn from '$lib/components/ny/Ventetegn.svelte';
	import Fluebe from '$lib/components/ny/Fluebe.svelte';

	const hentUser = getContext<() => User | null>('user');
	const hentAdgang = getContext<() => Adgangsbillede>('adgang');
	const user = $derived(hentUser());
	const adgang = $derived(hentAdgang());
	const aktivtForlob = $derived(adgang.aktiveForlob[0] ?? null);

	const dagNummer = $derived(Number(page.params.dag));
	const lektionId = $derived(page.params.id);

	let lektion = $state<LektionItem | null>(null);
	let henter = $state(true);
	let ikkeFundet = $state(false);
	let erKlaret = $state(false);
	let gemmer = $state(false);

	const art = $derived(lektion ? artFor(lektion.url) : 'link');
	const embed = $derived(lektion ? indlejretUrl(lektion.url) : null);

	$effect(() => {
		const uid = user?.uid;
		const forlobId = aktivtForlob?.forlobId;
		const dag = dagNummer;
		const id = lektionId;
		if (!uid || !forlobId || Number.isNaN(dag) || !id) return;

		let afbrudt = false;
		(async () => {
			henter = true;
			const [alle, klarede] = await Promise.all([
				hentDagensLektioner(forlobId, dag, Date.now()),
				hentKlaret(uid)
			]);
			if (afbrudt) return;
			lektion = alle.find((l) => l.id === id) ?? null;
			ikkeFundet = !lektion;
			erKlaret = klarede.has(id);
			henter = false;
		})().catch((e) => {
			console.error('[ny] kunne ikke hente lektionen', e);
			henter = false;
			ikkeFundet = true;
		});

		return () => {
			afbrudt = true;
		};
	});

	// Tiden hun har haft lektionen aaben. Kun for video og sider: dér kan
	// vi ikke se hvornaar hun er faerdig uden at hente Vimeos egen kode
	// ind. Lyd siger selv til, naar den er spillet til ende.
	onMount(() => {
		let sekunder = 0;
		const id = setInterval(() => {
			if (document.visibilityState !== 'visible') return;
			if (art === 'lyd') return;
			sekunder += 1;
			const graense = sekunderFoerKlaret(lektion?.varighedMin);
			if (graense && sekunder >= graense && !erKlaret && !gemmer) {
				void markerKlaret(true);
			}
		}, 1000);
		return () => clearInterval(id);
	});

	async function markerKlaret(klar: boolean) {
		const uid = user?.uid;
		if (!uid || !lektion || gemmer) return;
		gemmer = true;
		const foer = erKlaret;
		erKlaret = klar;
		try {
			await saetKlaret(uid, lektion.id, klar);
		} catch (e) {
			console.error('[ny] kunne ikke gemme klaret', e);
			erKlaret = foer;
		} finally {
			gemmer = false;
		}
	}

	// Tilbage foerer derhen hun kom fra. Kom hun udefra (fx et link),
	// falder vi tilbage til forsiden i stedet for at sende hende ud af appen.
	function tilbage() {
		if (typeof history !== 'undefined' && history.length > 1) {
			history.back();
			return;
		}
		void goto('/ny');
	}
</script>

<div class="lektion-side">
	<header class="side-top">
		<button class="tilbage" onclick={tilbage}>‹ Tilbage</button>
	</header>

	{#if henter}
		<div class="lektion-venter">
			<Ventetegn variant="lille" />
			<span>Henter lektionen</span>
		</div>
	{:else if ikkeFundet || !lektion}
		<div class="kort rolig">
			Lektionen findes ikke længere, eller den er ikke åben endnu.
			<a href="/ny">Tilbage til forsiden</a>
		</div>
	{:else}
		<h1 class="lektion-t">{lektion.titel}</h1>
		{#if lektion.varighedMin}
			<div class="lektion-m">{formaterVarighed(lektion.varighedMin)}</div>
		{/if}

		{#if art === 'video' && embed}
			<div class="video-ramme">
				<iframe
					src={embed}
					title={lektion.titel}
					allow="autoplay; fullscreen; picture-in-picture"
					allowfullscreen
				></iframe>
			</div>
		{:else if art === 'side' && embed}
			<div class="side-ramme">
				<iframe src={embed} title={lektion.titel}></iframe>
			</div>
		{:else if art === 'lyd'}
			<Lydafspiller url={lektion.url} titel={lektion.titel} onfaerdig={() => markerKlaret(true)} />
		{:else}
			<a class="btn bred" href={lektion.url} target="_blank" rel="noopener noreferrer">
				Åbn lektionen
			</a>
			<p class="kort rolig">Den åbner i et nyt vindue, og så er du tilbage her bagefter.</p>
		{/if}

		{#if lektion.beskrivelse}
			<p class="lektion-beskrivelse">{lektion.beskrivelse}</p>
		{/if}

		<div class="lektion-fod">
			{#if erKlaret}
				<button class="klar-chip" disabled={gemmer} onclick={() => markerKlaret(false)}>
					<span class="rund-fluebe" aria-hidden="true"><Fluebe /></span>
					Set
				</button>
				<span class="fod-tekst">Du kan altid åbne den igen.</span>
			{:else}
				<button class="btn" disabled={gemmer} onclick={() => markerKlaret(true)}>
					Markér som set
				</button>
				<span class="fod-tekst">
					Fluebenet kommer af sig selv, når du har {art === 'lyd' ? 'hørt' : 'set'} den færdig.
				</span>
			{/if}
		</div>
	{/if}
</div>
