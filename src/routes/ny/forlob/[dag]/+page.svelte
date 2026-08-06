<script lang="ts">
	// ============================================================
	// Én dag i forloebet. Linns note, dagens lektioner og dagens
	// refleksions-spoergsmaal.
	//
	// Fremtidige dage er laaste. Aabner hun en alligevel, faar hun det at
	// vide i stedet for at se noget tomt.
	// ============================================================

	import { getContext } from 'svelte';
	import { page } from '$app/state';
	import type { User } from 'firebase/auth';
	import type { Adgangsbillede } from '$lib/content/adgang3';
	import type { LektionItem } from '$lib/content/forlob';
	import { artFor } from '$lib/content/lektion3';
	import { videoThumbnail } from '$lib/content/bibliotek';
	import { dagDato } from '$lib/content/forlobAdgang';
	import { hentForlobsdag } from '$lib/firestore/forlob';
	import { hentDagensLektioner, hentKlaret, hentSmaaSkridtIDag } from '$lib/firestore/forside3';
	import Ventetegn from '$lib/components/ny/Ventetegn.svelte';
	import Fluebe from '$lib/components/ny/Fluebe.svelte';

	const hentUser = getContext<() => User | null>('user');
	const hentAdgang = getContext<() => Adgangsbillede>('adgang');
	const user = $derived(hentUser());
	const adgang = $derived(hentAdgang());
	const forlob = $derived(adgang.aktiveForlob[0] ?? null);

	const dagNummer = $derived(Number(page.params.dag));
	const laast = $derived(!!forlob && dagNummer > forlob.dagNummer);

	let lektioner = $state<LektionItem[]>([]);
	let note = $state('');
	let refleksion = $state('');
	let klaret = $state<Set<string>>(new Set());
	let henter = $state(true);

	$effect(() => {
		const uid = user?.uid;
		const f = forlob;
		const dag = dagNummer;
		if (!uid || !f || Number.isNaN(dag) || laast) {
			henter = false;
			return;
		}
		let afbrudt = false;

		(async () => {
			henter = true;
			const [dagDoc, synlige, k, skridt] = await Promise.all([
				hentForlobsdag(f.forlobId, dag),
				hentDagensLektioner(f.forlobId, dag, Date.now()),
				hentKlaret(uid),
				hentSmaaSkridtIDag(
					uid,
					{ forlobId: f.forlobId, produkt: f.produkt, dagNummer: dag },
					''
				)
			]);
			if (afbrudt) return;
			note = dagDoc?.noteFraLinn ?? '';
			lektioner = synlige;
			klaret = k;
			refleksion = skridt.refleksion ?? '';
			henter = false;
		})().catch((e) => {
			console.error('[ny] kunne ikke hente dagen', e);
			henter = false;
		});

		return () => {
			afbrudt = true;
		};
	});

	const MAANEDER = ['jan', 'feb', 'mar', 'apr', 'maj', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'dec'];
	const datoTekst = $derived.by(() => {
		if (!forlob || Number.isNaN(dagNummer)) return '';
		const d = dagDato(new Date(forlob.startMs), dagNummer);
		return `${d.getDate()}. ${MAANEDER[d.getMonth()]}`;
	});

	const IKON: Record<string, string> = { lyd: '♪', video: '▶', side: '✦', link: '↗' };
</script>

<div class="ny-pad forlob-side">
	<header class="side-top" style="padding-left:0;padding-right:0">
		<a class="tilbage" href="/ny/forlob">‹ Alle dage</a>
		<h1>{dagNummer === 0 ? 'Baseline' : `Dag ${dagNummer}`}</h1>
		<p>{datoTekst}{forlob ? ` · ${forlob.navn}` : ''}</p>
	</header>

	{#if laast}
		<div class="kort rolig">
			Den dag er der ikke åbnet for endnu. Den kommer {datoTekst}.
		</div>
	{:else if henter}
		<div class="lektion-venter">
			<Ventetegn variant="lille" />
			<span>Henter dagen</span>
		</div>
	{:else}
		{#if note}
			<section class="note-fra-linn">
				<span class="note-ava" aria-hidden="true"></span>
				<div>
					<div class="note-k">Fra Linn</div>
					<p class="note-tekst">{note}</p>
				</div>
			</section>
		{/if}

		{#if lektioner.length === 0}
			<div class="kort rolig">Der er ikke lagt lektioner op til den dag.</div>
		{:else}
			<div class="medie-liste">
				{#each lektioner as l (l.id)}
					{@const erKlaret = klaret.has(l.id)}
					{@const billede = l.thumbnailUrl || videoThumbnail(l.url)}
					<a class="medie-raekke" class:set={erKlaret} href={`/ny/lektion/${dagNummer}/${l.id}`}>
						<span class="medie-thumb {artFor(l.url)}">
							{#if erKlaret}
								<span class="rund-fluebe stor" aria-hidden="true"><Fluebe /></span>
							{:else if billede}
								<img class="medie-foto" src={billede} alt="" loading="lazy" />
								<span class="medie-play" aria-hidden="true">{IKON[artFor(l.url)]}</span>
							{:else}
								<span class="medie-glyph" aria-hidden="true">{IKON[artFor(l.url)]}</span>
							{/if}
						</span>
						<span class="medie-tekst">
							<span class="medie-t">{l.titel}</span>
							<span class="medie-m">
								{#if erKlaret}<span class="klar-tekst">Taget</span> · se igen{:else if l.varighedMin}{l.varighedMin}
									min{:else}Åbn{/if}
							</span>
						</span>
					</a>
				{/each}
			</div>
		{/if}

		{#if refleksion}
			<section class="refleksion">
				<div class="refleksion-k">Dagens refleksion</div>
				<p class="refleksion-spm">{refleksion}</p>
				<p class="privat">Du svarer på forsiden den dag, spørgsmålet hører til.</p>
			</section>
		{/if}
	{/if}
</div>
